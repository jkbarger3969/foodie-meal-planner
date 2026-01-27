import Foundation
import Network
import Combine
import UIKit

class ConnectionManager: NSObject, ObservableObject, NetServiceBrowserDelegate, NetServiceDelegate {
    @Published var isConnected = false
    @Published var connectionStatus: ConnectionStatus = .disconnected
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
    
    weak var recipeStore: RecipeStore?
    
    private var webSocket: URLSessionWebSocketTask?
    private var pingTimer: Timer?
    private var reconnectAttempts = 0
    private let maxReconnectAttempts = 5
    private var reconnectTimer: Timer?
    private var isConnecting = false
    private var lastConnectionAttempt: Date?
    private let minRetryInterval: TimeInterval = 5.0
    
    private let networkMonitor = NWPathMonitor()
    private let monitorQueue = DispatchQueue(label: "NetworkMonitor")
    
    enum ConnectionStatus: Equatable {
        case connected
        case connecting
        case disconnected
        case error(String)
    }
    
    override init() {
        super.init()
        setupNetworkMonitor()
        loadServerAddress()
        startBonjourDiscovery()
    }
    
    deinit {
        networkMonitor.cancel()
        stopBonjourDiscovery()
        disconnect()
    }
    
    private func setupNetworkMonitor() {
        networkMonitor.pathUpdateHandler = { [weak self] path in
            DispatchQueue.main.async {
                if path.status == .satisfied && !(self?.isConnected ?? false) {
                    Logger.info("Network available, attempting auto-connect...")
                    self?.attemptAutoConnect()
                }
            }
        }
        networkMonitor.start(queue: monitorQueue)
    }
    
    private func loadServerAddress() {
        serverAddress = UserDefaults.standard.string(forKey: "serverAddress") ?? ""
    }
    
    func saveServerAddress(_ address: String) {
        serverAddress = address
        UserDefaults.standard.set(address, forKey: "serverAddress")
    }
    
    func attemptAutoConnect() {
        guard !serverAddress.isEmpty else { return }
        guard !isConnecting else { return }
        
        if let lastAttempt = lastConnectionAttempt,
           Date().timeIntervalSince(lastAttempt) < minRetryInterval {
            return
        }
        
        if reconnectAttempts >= maxReconnectAttempts {
            return
        }
        
        connect()
    }
    
    func connect() {
        guard !serverAddress.isEmpty else {
            connectionStatus = .error("No server address configured")
            Logger.warn("No server address configured")
            return
        }
        
        guard !isConnecting else { return }
        
        isConnecting = true
        lastConnectionAttempt = Date()
        disconnect()
        
        connectionStatus = .connecting
        
        let urlString = serverAddress.hasPrefix("ws://") ? serverAddress : "ws://\(serverAddress):8080"
        guard let url = URL(string: urlString) else {
            connectionStatus = .error("Invalid server address")
            Logger.error("Invalid server address: \(serverAddress)")
            isConnecting = false
            return
        }
        
        var request = URLRequest(url: url)
        request.timeoutInterval = 10
        request.setValue(deviceId, forHTTPHeaderField: "X-Device-ID")
        request.setValue("iPad", forHTTPHeaderField: "X-Device-Type")
        request.setValue(UIDevice.current.name, forHTTPHeaderField: "X-Device-Name")
        
        let session = URLSession(configuration: .default)
        webSocket = session.webSocketTask(with: request)
        webSocket?.resume()
        
        receiveMessage()
        startPingTimer()
        
        DispatchQueue.main.asyncAfter(deadline: .now() + 10) { [weak self] in
            guard let self = self else { return }
            if !self.isConnected && self.isConnecting {
                self.isConnecting = false
                self.handleDisconnection()
            }
        }
    }
    
    func disconnect() {
        isConnecting = false
        pingTimer?.invalidate()
        pingTimer = nil
        reconnectTimer?.invalidate()
        reconnectTimer = nil
        webSocket?.cancel(with: .goingAway, reason: nil)
        webSocket = nil
        isConnected = false
        isPaired = false
        connectionStatus = .disconnected
    }
    
    // MARK: - Pairing
    
    func sendPairingCode(_ code: String) {
        // Check if WebSocket is connected
        guard let socket = webSocket else {
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
        socket.send(.string(jsonString)) { [weak self] error in
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
    
    private func receiveMessage() {
        guard let socket = webSocket else {
            print("❌ receiveMessage: webSocket is nil, cannot listen for messages")
            return
        }
        
        socket.receive { [weak self] result in
            switch result {
            case .success(let message):
                switch message {
                case .string(let text):
                    print("📥 Received string message (\(text.count) chars)")
                    if let data = text.data(using: .utf8) {
                        if let rawJSON = Message.getRawJSON(data),
                           let type = rawJSON["type"] as? String {
                            print("📥 Message type: \(type)")
                            if type == "meal_plan" {
                                self?.handleMealPlan(rawJSON)
                            } else if type == "recipe" {
                                self?.handleRecipeMessage(rawJSON)
                            } else {
                                self?.handleRawMessage(text)
                            }
                        } else {
                            self?.handleRawMessage(text)
                        }
                    }
                case .data(let data):
                    print("📥 Received data message (\(data.count) bytes)")
                    if let rawJSON = Message.getRawJSON(data),
                       let type = rawJSON["type"] as? String {
                        print("📥 Message type: \(type)")
                        if type == "meal_plan" {
                            self?.handleMealPlan(rawJSON)
                        } else if type == "recipe" {
                            self?.handleRecipeMessage(rawJSON)
                        } else if let text = String(data: data, encoding: .utf8) {
                            self?.handleRawMessage(text)
                        }
                    } else if let text = String(data: data, encoding: .utf8) {
                        self?.handleRawMessage(text)
                    }
                @unknown default:
                    break
                }
                self?.receiveMessage()
                
            case .failure(let error):
                let nsError = error as NSError
                print("❌ WebSocket receive error: \(error.localizedDescription)")
                print("   Error domain: \(nsError.domain), code: \(nsError.code)")
                Logger.error("WebSocket receive error: \(error)")
                DispatchQueue.main.async {
                    self?.isConnected = false
                    self?.handleDisconnection()
                }
            }
        }
    }
    
    private func handleRecipeMessage(_ json: [String: Any]) {
        guard let recipeData = json["data"] as? [String: Any],
              let recipe = Recipe(from: recipeData) else {
            print("❌ Failed to parse recipe from message")
            return
        }
        
        DispatchQueue.main.async {
            self.recipeStore?.setCurrentRecipe(recipe)
        }
    }
    
    private func handleMealPlan(_ json: [String: Any]) {
        guard let mealsArray = json["data"] as? [[String: Any]] else {
            return
        }
        
        let mealSlots = mealsArray.compactMap { MealSlot(from: $0) }
        
        DispatchQueue.main.async {
            // Ensure connection state is correct since we received a message
            self.isConnected = true
            self.isPaired = true
            
            self.recipeStore?.setAvailableMealSlots(mealSlots)
            if !mealSlots.isEmpty {
                self.recipeStore?.shouldShowMealList = true
            }
        }
    }
    
    private func handleRawMessage(_ text: String) {
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
                    self.connectionStatus = .connected
                    self.reconnectAttempts = 0
                    self.isConnecting = false
                    Logger.success("Connected to companion server (trusted device)")
                } else {
                    self.isConnected = true
                    self.connectionStatus = .connected
                    self.reconnectAttempts = 0
                    self.isConnecting = false
                    Logger.success("Connected to companion server")
                }
                
            case "pairing_required":
                self.requiresPairing = true
                self.isPaired = false
                self.pairingError = nil
                self.isConnecting = false
                print("🔐 Pairing required - show pairing screen")
                
            case "paired":
                self.isPaired = true
                self.requiresPairing = false
                self.pairingError = nil
                self.isConnected = true
                self.connectionStatus = .connected
                self.reconnectAttempts = 0
                self.isConnecting = false
                print("✅ Device paired successfully")
                
            case "pairing_failed":
                self.pairingError = json["message"] as? String ?? "Invalid pairing code"
                print("❌ Pairing failed: \(self.pairingError ?? "unknown")")
                
            case "pairing_timeout":
                self.requiresPairing = false
                self.pairingError = "Pairing timed out - reconnecting..."
                print("⏰ Pairing timed out")
                self.handleDisconnection()
                
            case "unpaired":
                UserDefaults.standard.removeObject(forKey: "foodie_device_id")
                self.isPaired = false
                self.requiresPairing = true
                self.isConnected = false
                self.connectionStatus = .disconnected
                print("🔓 Device was unpaired by server")
                
            case "pong":
                break
                
            case "recipe":
                if let msgData = Message.from(data) {
                    self.handleMessage(msgData)
                }
                
            case "todays_meals":
                if let msgData = Message.from(data) {
                    self.handleMessage(msgData)
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
                if let msgData = Message.from(data) {
                    self.handleMessage(msgData)
                }
            }
        }
    }
    
    private func handleMessage(_ message: Message) {
        DispatchQueue.main.async {
            switch message.type {
            case "pong":
                break
                
            case "connected":
                self.isConnected = true
                self.connectionStatus = .connected
                self.reconnectAttempts = 0
                self.isConnecting = false
                Logger.success("Connected to companion server")
                
            case "recipe":
                // Now handled by handleRecipeMessage fast-path
                if let data = message.data,
                   let recipe = Recipe(from: data) {
                    self.recipeStore?.setCurrentRecipe(recipe)
                }
                
            case "todays_meals":
                if let data = message.data {
                    var recipesData: [[String: Any]] = []
                    
                    if let mealsArray = data["data"] as? [[String: Any]] {
                        for meal in mealsArray {
                            if let recipeDict = meal["recipe"] as? [String: Any] {
                                recipesData.append(recipeDict)
                            }
                        }
                    }
                    else if let recipesArray = data["recipes"] as? [[String: Any]] {
                        recipesData = recipesArray
                    }
                    
                    let recipes = recipesData.compactMap { Recipe(from: $0) }
                    self.recipeStore?.setAvailableRecipes(recipes)
                }
                
            default:
                print("Unknown message type: \(message.type)")
            }
        }
    }
    
    func sendMessage(_ message: Message) {
        print("📤 sendMessage: type=\(message.type), isConnected=\(isConnected), isPaired=\(isPaired)")
        guard isConnected && isPaired else {
            print("❌ sendMessage blocked: not connected or not paired")
            return
        }
        
        guard let socket = webSocket else {
            print("❌ sendMessage: webSocket is nil!")
            DispatchQueue.main.async {
                self.isConnected = false
                self.handleDisconnection()
            }
            return
        }
        
        guard let data = message.toJSON(),
              let text = String(data: data, encoding: .utf8) else {
            print("❌ sendMessage: failed to serialize")
            return
        }
        
        print("📤 Sending: \(text)")
        socket.send(.string(text)) { [weak self] error in
            if let error = error {
                Logger.error("Send error: \(error)")
                print("❌ Send failed with error: \(error.localizedDescription)")
                DispatchQueue.main.async {
                    self?.isConnected = false
                    self?.handleDisconnection()
                }
            } else {
                print("✅ Message sent successfully")
            }
        }
    }
    
    private func startPingTimer() {
        pingTimer?.invalidate()
        pingTimer = Timer.scheduledTimer(withTimeInterval: 30, repeats: true) { [weak self] _ in
            self?.sendPing()
        }
    }
    
    private func sendPing() {
        guard isConnected else { return }
        
        let message: [String: Any] = ["type": "ping"]
        guard let jsonData = try? JSONSerialization.data(withJSONObject: message),
              let jsonString = String(data: jsonData, encoding: .utf8) else { return }
        
        webSocket?.send(.string(jsonString)) { [weak self] error in
            if let error = error {
                print("❌ Ping error: \(error.localizedDescription)")
                DispatchQueue.main.async {
                    self?.isConnected = false
                    self?.handleDisconnection()
                }
            }
        }
    }
    
    private func handleDisconnection() {
        isConnecting = false
        isConnected = false
        isPaired = false
        pingTimer?.invalidate()
        pingTimer = nil
        
        guard reconnectAttempts < maxReconnectAttempts else {
            if case .error = connectionStatus {
            } else {
                connectionStatus = .error("Cannot connect to server")
            }
            return
        }
        
        connectionStatus = .disconnected
        reconnectAttempts += 1
        let delay = min(Double(reconnectAttempts) * 2.0, 10.0)
        
        reconnectTimer?.invalidate()
        reconnectTimer = Timer.scheduledTimer(withTimeInterval: delay, repeats: false) { [weak self] _ in
            self?.connect()
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
}
