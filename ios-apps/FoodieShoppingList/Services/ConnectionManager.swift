import Foundation
import Combine
import Network
import UIKit
import CoreLocation

class ConnectionManager: NSObject, ObservableObject, URLSessionWebSocketDelegate, NetServiceBrowserDelegate, NetServiceDelegate, CLLocationManagerDelegate {
    @Published var isConnected = false
    @Published var syncStatus: SyncStatus = .idle
    @Published var availableStores: [String] = []
    @Published var atStore: String? = nil
    @Published var remoteTimers: [[String: Any]] = []
    
    @Published var serverAddress: String = "" {
        didSet {
            UserDefaults.standard.set(serverAddress, forKey: "serverAddress")
        }
    }
    
    // Pairing state
    @Published var isPaired = false
    @Published var requiresPairing = false
    @Published var pairingError: String? = nil
    
    // Persistent device ID for pairing
    private var deviceId: String {
        if let id = UserDefaults.standard.string(forKey: "foodie_device_id") {
            return id
        }
        let newId = UUID().uuidString
        UserDefaults.standard.set(newId, forKey: "foodie_device_id")
        return newId
    }
    
    // Bonjour discovery
    private var serviceBrowser: NetServiceBrowser?
    private var discoveredServices: [NetService] = []
    
    var shoppingListStore: ShoppingListStore?
    
    private var webSocketTask: URLSessionWebSocketTask?
    private var session: URLSession!
    private var pingTimer: Timer?
    private var reconnectTimer: Timer?
    private var reconnectAttempts = 0
    private let maxReconnectAttempts = 5
    
    // Geofencing for "Store Senses"
    private let locationManager = CLLocationManager()
    private let monitoredStores: [String: CLLocationCoordinate2D] = [
        "Kroger": CLLocationCoordinate2D(latitude: 34.35201064556783, longitude: -84.05382156342527),
        "Publix": CLLocationCoordinate2D(latitude: 34.35356956534028, longitude: -84.04455184890703),
        "Costco": CLLocationCoordinate2D(latitude: 34.221834062203186, longitude: -84.11322934468497)
    ]
    
    // Network monitoring for auto-reconnect
    private let networkMonitor = NWPathMonitor()
    private let monitorQueue = DispatchQueue(label: "NetworkMonitor")
    
    enum SyncStatus: Equatable {
        case idle
        case syncing
        case success
        case failed(String)
        
        var message: String {
            switch self {
            case .idle: return ""
            case .syncing: return "Syncing..."
            case .success: return "Auto-sync successful"
            case .failed(let error): return "Sync failed: \(error)"
            }
        }
    }
    
    override init() {
        self.serverAddress = UserDefaults.standard.string(forKey: "serverAddress") ?? ""
        
        super.init()
        
        session = URLSession(configuration: .default, delegate: self, delegateQueue: nil)
        
        setupNetworkMonitoring()
        startBonjourDiscovery()
        setupLocationMonitoring()
    }
    
    deinit {
        networkMonitor.cancel()
        stopBonjourDiscovery()
        disconnect()
    }
    
    // MARK: - Network Monitoring
    
    private func setupNetworkMonitoring() {
        networkMonitor.pathUpdateHandler = { [weak self] path in
            if path.status == .satisfied {
                DispatchQueue.main.async {
                    if !(self?.isConnected ?? false) {
                        print("📡 Network available, attempting auto-connect...")
                        self?.attemptAutoConnect()
                    }
                }
            }
        }
        networkMonitor.start(queue: monitorQueue)
    }
    
    // MARK: - Connection Management
    
    func connect() {
        guard !serverAddress.isEmpty else {
            Logger.warn("No server address configured")
            return
        }
        
        let urlString = serverAddress.hasPrefix("ws://") ? serverAddress : "ws://\(serverAddress):8080"
        guard let url = URL(string: urlString) else {
            Logger.error("Invalid server address: \(serverAddress)")
            return
        }
        
        stopPingTimer()
        stopReconnectTimer()
        webSocketTask?.cancel(with: .goingAway, reason: nil)
        webSocketTask = nil
        
        var request = URLRequest(url: url)
        request.setValue(deviceId, forHTTPHeaderField: "X-Device-ID")
        request.setValue("iPhone", forHTTPHeaderField: "X-Device-Type")
        request.setValue(UIDevice.current.name, forHTTPHeaderField: "X-Device-Name")
        request.timeoutInterval = 10
        
        webSocketTask = session.webSocketTask(with: request)
        webSocketTask?.resume()
        
        receiveMessage()
        Logger.info("Connecting to \(urlString)...")
    }
    
    func disconnect() {
        stopPingTimer()
        stopReconnectTimer()
        webSocketTask?.cancel(with: .goingAway, reason: nil)
        webSocketTask = nil
        
        DispatchQueue.main.async {
            self.isConnected = false
        }
    }
    
    func attemptAutoConnect() {
        guard !serverAddress.isEmpty, !isConnected else { return }
        connect()
    }
    
    private func scheduleReconnect() {
        guard reconnectAttempts < maxReconnectAttempts else {
            print("❌ Max reconnect attempts reached")
            return
        }
        
        reconnectAttempts += 1
        let delay = min(Double(reconnectAttempts) * 2.0, 30.0)
        
        print("🔄 Reconnecting in \(delay)s (attempt \(reconnectAttempts)/\(maxReconnectAttempts))")
        
        reconnectTimer = Timer.scheduledTimer(withTimeInterval: delay, repeats: false) { [weak self] _ in
            self?.connect()
        }
    }
    
    private func stopReconnectTimer() {
        reconnectTimer?.invalidate()
        reconnectTimer = nil
    }
    
    // MARK: - Pairing
    
    func sendPairingCode(_ code: String) {
        // Check if WebSocket is connected
        guard let task = webSocketTask else {
            print("❌ WebSocket not connected, cannot send pairing code")
            DispatchQueue.main.async {
                self.pairingError = "Not connected to server. Please check your network."
            }
            return
        }
        
        let message: [String: Any] = [
            "type": "pair",
            "code": code,
            "deviceName": UIDevice.current.name
        ]
        
        guard let jsonData = try? JSONSerialization.data(withJSONObject: message),
              let jsonString = String(data: jsonData, encoding: .utf8) else {
            print("❌ Failed to serialize pairing message")
            DispatchQueue.main.async {
                self.pairingError = "Failed to create pairing request"
            }
            return
        }
        
        print("📤 Sending pairing code...")
        task.send(.string(jsonString)) { [weak self] error in
            if let error = error {
                print("❌ Failed to send pairing code: \(error)")
                DispatchQueue.main.async {
                    self?.pairingError = "Failed to send code: \(error.localizedDescription)"
                }
            } else {
                print("✅ Pairing code sent successfully")
            }
        }
    }
    
    // MARK: - Message Handling
    
    private func receiveMessage() {
        webSocketTask?.receive { [weak self] result in
            switch result {
            case .success(let message):
                switch message {
                case .string(let text):
                    self?.handleMessage(text)
                case .data(let data):
                    if let text = String(data: data, encoding: .utf8) {
                        self?.handleMessage(text)
                    }
                @unknown default:
                    break
                }
                self?.receiveMessage()
                
            case .failure(let error):
                print("❌ WebSocket error: \(error.localizedDescription)")
                DispatchQueue.main.async {
                    let wasConnected = self?.isConnected ?? false
                    self?.isConnected = false
                    self?.isPaired = false
                    
                    if wasConnected {
                        self?.syncStatus = .failed("Connection lost")
                        
                        DispatchQueue.main.asyncAfter(deadline: .now() + 3) {
                            if case .failed = self?.syncStatus {
                                self?.syncStatus = .idle
                            }
                        }
                    }
                    
                    self?.scheduleReconnect()
                }
            }
        }
    }
    
    private func handleMessage(_ text: String) {
        guard let data = text.data(using: .utf8),
              let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
              let type = json["type"] as? String else {
            return
        }
        
        DispatchQueue.main.async {
            switch type {
            case "connected":
                let authenticated = json["authenticated"] as? Bool ?? false
                if authenticated {
                    self.isConnected = true
                    self.isPaired = true
                    self.requiresPairing = false
                    self.pairingError = nil
                    print("✅ Connected to desktop (trusted device)")
                    self.reconnectAttempts = 0
                    self.stopReconnectTimer()
                    self.startPingTimer()
                    self.requestShoppingList()
                    self.requestStoreList()
                } else {
                    if !self.isConnected {
                        self.isConnected = true
                        print("✅ Connected to desktop")
                    }
                    self.reconnectAttempts = 0
                    self.stopReconnectTimer()
                    self.startPingTimer()
                    self.requestShoppingList()
                    self.requestStoreList()
                }
                
            case "pairing_required":
                self.requiresPairing = true
                self.isPaired = false
                self.pairingError = nil
                print("🔐 Pairing required - show pairing screen")
                
            case "paired":
                self.isPaired = true
                self.requiresPairing = false
                self.pairingError = nil
                self.isConnected = true
                self.reconnectAttempts = 0
                self.stopReconnectTimer()
                self.startPingTimer()
                self.requestShoppingList()
                self.requestStoreList()
                print("✅ Device paired successfully")
                
            case "pairing_failed":
                self.pairingError = json["message"] as? String ?? "Invalid pairing code"
                print("❌ Pairing failed: \(self.pairingError ?? "unknown")")
                
            case "pairing_timeout":
                self.requiresPairing = false
                self.pairingError = "Pairing timed out - reconnecting..."
                print("⏰ Pairing timed out")
                self.scheduleReconnect()
                
            case "unpaired":
                UserDefaults.standard.removeObject(forKey: "foodie_device_id")
                self.isPaired = false
                self.requiresPairing = true
                self.isConnected = false
                print("🔓 Device was unpaired by server")
                
            case "pong":
                break
                
            case "shopping_list", "shopping_list_update":
                if let itemsData = json["data"] as? [[String: Any]] {
                    let newItems = itemsData.compactMap { ShoppingItem(from: $0) }
                    
                    let version = json["version"] as? String
                    let forceReplace = json["forceReplace"] as? Bool ?? (type == "shopping_list_update")
                    
                    self.shoppingListStore?.updateFromServer(newItems, version: version, forceReplace: forceReplace)
                    print("📝 Received \(newItems.count) items from desktop (version: \(version ?? "none"), force: \(forceReplace))")
                    
                    if let userDefaults = UserDefaults(suiteName: "group.com.foodie") {
                        if let encoded = try? JSONEncoder().encode(newItems) {
                            userDefaults.set(encoded, forKey: "widget_shopping_items")
                        }
                    }
                    
                    if self.isConnected && type == "shopping_list_update" {
                        self.syncStatus = .success
                        DispatchQueue.main.asyncAfter(deadline: .now() + 2) {
                            if case .success = self.syncStatus {
                                self.syncStatus = .idle
                            }
                        }
                    }
                }
                
            case "sync_confirmed":
                self.shoppingListStore?.confirmSync()
                self.syncStatus = .success
                print("✅ Sync confirmed by desktop")
                
                DispatchQueue.main.asyncAfter(deadline: .now() + 3) {
                    if case .success = self.syncStatus {
                        self.syncStatus = .idle
                    }
                }
            
            case "store_list":
                if let storeData = json["data"] as? [[String: Any]] {
                    self.availableStores = storeData.compactMap { $0["Name"] as? String }
                    print("📋 Received \(self.availableStores.count) stores from desktop")
                }
                
            case "timer_update":
                if let timers = json["data"] as? [String: Any],
                   let timerList = timers["timers"] as? [[String: Any]] {
                    self.remoteTimers = timerList
                    print("⏱️ Received \(timerList.count) remote timer updates")
                }
                
            case "error":
                let errorMsg = json["message"] as? String ?? "Unknown error"
                let errorCode = json["error"] as? String ?? ""
                if errorCode == "not_authenticated" {
                    self.requiresPairing = true
                    self.isPaired = false
                }
                print("❌ Server error: \(errorMsg)")
                
            default:
                break
            }
        }
    }
    
    // MARK: - Send Messages
    
    private func sendMessage(_ message: Message) {
        guard isConnected && isPaired else {
            print("⚠️ Not connected or not paired, cannot send message")
            return
        }
        
        Task { @MainActor in
            let encoder = JSONEncoder()
            guard let data = try? encoder.encode(message),
                  let text = String(data: data, encoding: .utf8) else {
                return
            }
            
            self.webSocketTask?.send(.string(text)) { error in
                if let error = error {
                    print("❌ Send error: \(error.localizedDescription)")
                }
            }
        }
    }
    
    func requestShoppingList() {
        let message = Message(type: "request_shopping_list")
        sendMessage(message)
    }
    
    func requestStoreList() {
        let message = Message(type: "request_store_list")
        sendMessage(message)
    }
    
    // MARK: - Public Send Method
    
    func send(_ messageDict: [String: Any]) {
        guard isConnected && isPaired else {
            print("⚠️ Not connected or not paired, cannot send message")
            return
        }
        
        guard let jsonData = try? JSONSerialization.data(withJSONObject: messageDict),
              let jsonString = String(data: jsonData, encoding: .utf8) else {
            print("❌ Failed to serialize message dictionary")
            return
        }
        
        webSocketTask?.send(.string(jsonString)) { error in
            if let error = error {
                print("❌ Send error: \(error.localizedDescription)")
            }
        }
    }
    
    // MARK: - Sync
    
    func syncNow() {
        guard let store = shoppingListStore else { return }
        
        syncStatus = .syncing
        
        var changes: [[String: Any]] = []
        
        for itemId in store.pendingSync {
            if let item = store.items.first(where: { $0.id == itemId }) {
                changes.append([
                    "id": item.id,
                    "isPurchased": item.isPurchased,
                    "isManuallyAdded": item.isManuallyAdded,
                    "name": item.name,
                    "quantity": item.quantity,
                    "category": item.category
                ])
            } else {
                changes.append([
                    "id": itemId,
                    "isDeleted": true
                ])
            }
        }
        
        if changes.isEmpty {
            syncStatus = .success
            DispatchQueue.main.asyncAfter(deadline: .now() + 2) {
                if case .success = self.syncStatus {
                    self.syncStatus = .idle
                }
            }
            return
        }
        
        let message = Message(type: "sync_changes", data: changes)
        sendMessage(message)
        
        print("📤 Syncing \(changes.count) changes to desktop")
    }
    
    // MARK: - Ping/Keep-Alive
    
    private func startPingTimer() {
        stopPingTimer()
        pingTimer = Timer.scheduledTimer(withTimeInterval: 30, repeats: true) { [weak self] _ in
            self?.sendPing()
        }
    }
    
    private func stopPingTimer() {
        pingTimer?.invalidate()
        pingTimer = nil
    }
    
    private func sendPing() {
        guard isConnected else { return }
        
        let message: [String: Any] = ["type": "ping"]
        guard let jsonData = try? JSONSerialization.data(withJSONObject: message),
              let jsonString = String(data: jsonData, encoding: .utf8) else { return }
        
        webSocketTask?.send(.string(jsonString)) { error in
            if let error = error {
                print("❌ Ping error: \(error.localizedDescription)")
            }
        }
    }
    
    // MARK: - URLSessionWebSocketDelegate
    
    func urlSession(_ session: URLSession, webSocketTask: URLSessionWebSocketTask, didOpenWithProtocol protocol: String?) {
        Logger.success("WebSocket opened")
    }
    
    func urlSession(_ session: URLSession, webSocketTask: URLSessionWebSocketTask, didCloseWith closeCode: URLSessionWebSocketTask.CloseCode, reason: Data?) {
        Logger.warn("WebSocket closed: \(closeCode)")
        DispatchQueue.main.async {
            self.isConnected = false
            self.isPaired = false
            self.scheduleReconnect()
        }
    }
    
    // MARK: - Bonjour Discovery
    
    func startBonjourDiscovery() {
        Logger.info("Starting Bonjour discovery for _foodie._tcp")
        serviceBrowser = NetServiceBrowser()
        serviceBrowser?.delegate = self
        serviceBrowser?.searchForServices(ofType: "_foodie._tcp.", inDomain: "local.")
    }
    
    func stopBonjourDiscovery() {
        serviceBrowser?.stop()
        serviceBrowser = nil
    }
    
    func netServiceBrowser(_ browser: NetServiceBrowser, didFind service: NetService, moreComing: Bool) {
        Logger.info("Found Bonjour service: \(service.name)")
        discoveredServices.append(service)
        service.delegate = self
        service.resolve(withTimeout: 5.0)
    }
    
    func netServiceDidResolveAddress(_ sender: NetService) {
        if let host = sender.hostName {
            let address = host.hasSuffix(".") ? String(host.dropLast()) : host
            Logger.success("Resolved Bonjour service to: \(address)")
            
            DispatchQueue.main.async {
                if self.serverAddress.isEmpty || !self.isConnected {
                    self.serverAddress = address
                    self.connect()
                }
            }
        }
    }
    
    // MARK: - Smart Store Senses (Location)
    
    private func setupLocationMonitoring() {
        locationManager.delegate = self
        locationManager.desiredAccuracy = kCLLocationAccuracyNearestTenMeters
        locationManager.requestWhenInUseAuthorization()
        
        for (name, coord) in monitoredStores {
            let region = CLCircularRegion(center: coord, radius: 100, identifier: name)
            region.notifyOnEntry = true
            region.notifyOnExit = true
            locationManager.startMonitoring(for: region)
        }
        
        locationManager.startUpdatingLocation()
    }
    
    func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
        guard let location = locations.last else { return }
        
        for (name, coord) in monitoredStores {
            let storeLoc = CLLocation(latitude: coord.latitude, longitude: coord.longitude)
            if location.distance(from: storeLoc) < 150 {
                if atStore != name {
                    DispatchQueue.main.async {
                        self.atStore = name
                        Logger.success("📍 Welcome to \(name)! Your shopping list is ready.")
                    }
                }
                return
            }
        }
        
        if atStore != nil {
            DispatchQueue.main.async {
                self.atStore = nil
            }
        }
    }
    
    func locationManager(_ manager: CLLocationManager, didEnterRegion region: CLRegion) {
        if let circularRegion = region as? CLCircularRegion {
            DispatchQueue.main.async {
                self.atStore = circularRegion.identifier
                Logger.success("📍 Entered \(circularRegion.identifier)")
            }
        }
    }
    
    func locationManager(_ manager: CLLocationManager, didExitRegion region: CLRegion) {
        DispatchQueue.main.async {
            self.atStore = nil
            Logger.info("📍 Left the store")
        }
    }
    
    func locationManager(_ manager: CLLocationManager, didChangeAuthorization status: CLAuthorizationStatus) {
        if status == .authorizedWhenInUse || status == .authorizedAlways {
            locationManager.startUpdatingLocation()
        }
    }
}
