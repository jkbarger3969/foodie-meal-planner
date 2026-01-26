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
    
    enum ConnectionStatus {
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
        request.setValue("iPad-\(UIDevice.current.identifierForVendor?.uuidString ?? UUID().uuidString)", 
                        forHTTPHeaderField: "X-Device-Id")
        request.setValue("iPad", forHTTPHeaderField: "X-Device-Type")
        
        let session = URLSession(configuration: .default)
        webSocket = session.webSocketTask(with: request)
        webSocket?.resume()
        
        receiveMessage()
        startPingTimer()
        
        // Set a timeout to detect failed connection
        DispatchQueue.main.asyncAfter(deadline: .now() + 10) { [weak self] in
            guard let self = self else { return }
            if !self.isConnected && self.isConnecting {
                // Connection attempt timed out
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
        connectionStatus = .disconnected
    }
    
    private func receiveMessage() {
        webSocket?.receive { [weak self] result in
            switch result {
            case .success(let message):
                switch message {
                case .string(let text):
                    if let data = text.data(using: .utf8) {
                        // Parse raw JSON for meal_plan type
                        if let rawJSON = Message.getRawJSON(data),
                           let type = rawJSON["type"] as? String,
                           type == "meal_plan" {
                            self?.handleMealPlan(rawJSON)
                        } else if let msg = Message.from(data) {
                            self?.handleMessage(msg)
                        }
                    }
                case .data(let data):
                    // Parse raw JSON for meal_plan type
                    if let rawJSON = Message.getRawJSON(data),
                       let type = rawJSON["type"] as? String,
                       type == "meal_plan" {
                        self?.handleMealPlan(rawJSON)
                    } else if let msg = Message.from(data) {
                        self?.handleMessage(msg)
                    }
                @unknown default:
                    break
                }
                self?.receiveMessage()
                
            case .failure(let error):
                Logger.error("WebSocket receive error: \(error)")
                DispatchQueue.main.async {
                    self?.handleDisconnection()
                }
            }
        }
    }
    
    private func handleMealPlan(_ json: [String: Any]) {
        DispatchQueue.main.async {
            if let mealsArray = json["data"] as? [[String: Any]] {
                let mealSlots = mealsArray.compactMap { MealSlot(from: $0) }
                self.recipeStore?.setAvailableMealSlots(mealSlots)
                print("📥 Received \(mealSlots.count) meal slots with additional items")
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
                // Single recipe sent to display
                if let data = message.data,
                   let recipe = Recipe(from: data) {
                    self.recipeStore?.setCurrentRecipe(recipe)
                }
                
            case "todays_meals":
                // Today's meals array with recipe objects inside
                if let data = message.data {
                    var recipesData: [[String: Any]] = []
                    
                    // New format: data["data"] is array of meals, each with recipe object
                    if let mealsArray = data["data"] as? [[String: Any]] {
                        // Extract recipe from each meal
                        for meal in mealsArray {
                            if let recipeDict = meal["recipe"] as? [String: Any] {
                                recipesData.append(recipeDict)
                            }
                        }
                    }
                    // Old format: data has recipes key
                    else if let recipesArray = data["recipes"] as? [[String: Any]] {
                        recipesData = recipesArray
                    }
                    
                    let recipes = recipesData.compactMap { Recipe(from: $0) }
                    self.recipeStore?.setAvailableRecipes(recipes)
                    print("📥 Received \(recipes.count) recipes for today's meals")
                }
                
            default:
                print("Unknown message type: \(message.type)")
            }
        }
    }
    
    func sendMessage(_ message: Message) {
        guard let data = message.toJSON(),
              let text = String(data: data, encoding: .utf8) else {
            return
        }
        
        webSocket?.send(.string(text)) { error in
            if let error = error {
                Logger.error("Send error: \(error)")
            }
        }
    }
    
    private func startPingTimer() {
        pingTimer?.invalidate()
        pingTimer = Timer.scheduledTimer(withTimeInterval: 30, repeats: true) { [weak self] _ in
            self?.sendMessage(Message(type: "ping"))
        }
    }
    
    private func handleDisconnection() {
        isConnecting = false
        isConnected = false
        pingTimer?.invalidate()
        pingTimer = nil
        
        guard reconnectAttempts < maxReconnectAttempts else {
            if case .error = connectionStatus {
                // Already in error state, don't update again
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
