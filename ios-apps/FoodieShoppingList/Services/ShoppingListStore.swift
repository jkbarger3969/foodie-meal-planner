import Foundation
import SwiftUI
import Combine

class ShoppingListStore: ObservableObject {
    @Published var items: [ShoppingItem] = []
    @Published var pendingSync: Set<String> = [] // IDs of items that need syncing
    @Published var selectedStore: String = "All Stores" // For voice commands and UI
    @Published var searchText: String = "" // For voice commands and search
    
    // Connection manager for WebSocket communication with desktop
    weak var connectionManager: ConnectionManager?
    
    private let storageKey = "savedShoppingList"
    private let pendingSyncKey = "pendingSync"
    private let lastSyncKey = "lastSyncDate"
    private let listVersionKey = "listVersion"
    
    @Published var listVersion: String = "" // Tracks which version of the list we have
    
    init() {
        loadFromLocalStorage()
        loadPendingSync()
        listVersion = UserDefaults.standard.string(forKey: listVersionKey) ?? ""
    }
    
    // MARK: - Local Storage
    
    func saveToLocalStorage() {
        if let encoded = try? JSONEncoder().encode(items) {
            UserDefaults.standard.set(encoded, forKey: storageKey)
        }
        savePendingSync()
    }
    
    func loadFromLocalStorage() {
        if let data = UserDefaults.standard.data(forKey: storageKey),
           let decoded = try? JSONDecoder().decode([ShoppingItem].self, from: data) {
            items = decoded
        }
    }
    
    private func savePendingSync() {
        let array = Array(pendingSync)
        UserDefaults.standard.set(array, forKey: pendingSyncKey)
    }
    
    private func loadPendingSync() {
        if let array = UserDefaults.standard.array(forKey: pendingSyncKey) as? [String] {
            pendingSync = Set(array)
        }
    }
    
    func markLastSync() {
        UserDefaults.standard.set(Date(), forKey: lastSyncKey)
    }
    
    var lastSyncDate: Date? {
        UserDefaults.standard.object(forKey: lastSyncKey) as? Date
    }
    
    // MARK: - Server Updates
    
    /// Update from server with version tracking
    /// - Parameters:
    ///   - newItems: Items received from server
    ///   - version: Version identifier from server (timestamp or unique ID)
    ///   - forceReplace: If true, completely replace local list (used when user explicitly requests fresh list)
    func updateFromServer(_ newItems: [ShoppingItem], version: String? = nil, forceReplace: Bool = false) {
        // CRITICAL: Never clear existing items just because server sends empty list
        // The list should persist until user explicitly clears it or marks items as purchased
        
        // If server sends empty list and we have items, keep our items (offline resilience)
        if newItems.isEmpty && !items.isEmpty && !forceReplace {
            print("📱 Server sent empty list but we have \(items.count) local items - keeping local data")
            return
        }
        
        // If forceReplace is set (user explicitly requested new list), replace everything
        if forceReplace {
            print("📱 Force replacing list with \(newItems.count) items (version: \(version ?? "none"))")
            items = newItems
            if let v = version {
                listVersion = v
                UserDefaults.standard.set(v, forKey: listVersionKey)
            }
            pendingSync.removeAll()
            saveToLocalStorage()
            return
        }
        
        // If we have a version and it matches, this is the same list - just merge changes
        if let v = version, !v.isEmpty, v == listVersion {
            print("📱 Same list version (\(v)) - merging \(newItems.count) items")
            mergeServerItems(newItems)
            return
        }
        
        // New version or no version tracking - smart merge
        if let v = version, !v.isEmpty {
            print("📱 New list version: \(v) (was: \(listVersion)) - updating with \(newItems.count) items")
            listVersion = v
            UserDefaults.standard.set(v, forKey: listVersionKey)
        }
        
        mergeServerItems(newItems)
    }
    
    /// Merge server items with local items, preserving local purchase state
    private func mergeServerItems(_ newItems: [ShoppingItem]) {
        var updatedItems: [ShoppingItem] = []
        var processedIds = Set<String>()
        
        // Process server items
        for var newItem in newItems {
            // Check if we have local version with changes
            if let existingItem = items.first(where: { $0.id == newItem.id }) {
                // Preserve local purchase state if item was changed locally
                if pendingSync.contains(newItem.id) {
                    newItem.isPurchased = existingItem.isPurchased
                }
            }
            updatedItems.append(newItem)
            processedIds.insert(newItem.id)
        }
        
        // Keep manually added items that aren't in server list
        let manualItems = items.filter { $0.isManuallyAdded && !processedIds.contains($0.id) }
        updatedItems.append(contentsOf: manualItems)
        
        // Keep purchased items that aren't in server list (they were purchased, don't lose them)
        let purchasedNotInServer = items.filter { $0.isPurchased && !processedIds.contains($0.id) && !$0.isManuallyAdded }
        updatedItems.append(contentsOf: purchasedNotInServer)
        
        items = updatedItems
        saveToLocalStorage()
    }
    
    /// Legacy method for backward compatibility - calls new method with defaults
    func updateFromServerLegacy(_ newItems: [ShoppingItem]) {
        updateFromServer(newItems, version: nil, forceReplace: false)
    }
    
    // MARK: - Item Management
    
    func togglePurchased(_ item: ShoppingItem) {
        if let index = items.firstIndex(where: { $0.id == item.id }) {
            let wasPurchased = items[index].isPurchased
            items[index].isPurchased.toggle()
            pendingSync.insert(item.id)
            saveToLocalStorage()
            
            // If unmarking as purchased, tell desktop to return item to pantry
            if wasPurchased && !items[index].isPurchased {
                notifyItemUnpurchased(item)
            }
            
            // Haptic feedback
            let generator = UIImpactFeedbackGenerator(style: .medium)
            generator.impactOccurred()
        }
    }
    
    func addItem(_ item: ShoppingItem) {
        items.append(item)
        pendingSync.insert(item.id)
        saveToLocalStorage()
    }
    
    func deleteItem(_ item: ShoppingItem) {
        // Notify desktop to return item to pantry before removing
        notifyItemRemoved(item)
        
        items.removeAll { $0.id == item.id }
        pendingSync.insert(item.id) // Mark for deletion sync
        saveToLocalStorage()
    }
    
    func clearPurchased() {
        let purchasedIds = items.filter { $0.isPurchased }.map { $0.id }
        items.removeAll { $0.isPurchased }
        purchasedIds.forEach { pendingSync.insert($0) }
        saveToLocalStorage()
    }
    
    func clearAll() {
        objectWillChange.send()
        items.removeAll()
        pendingSync.removeAll()
        saveToLocalStorage()
        savePendingSync()
    }
    
    // MARK: - Sync Management
    
    func confirmSync() {
        // Clear pending sync after successful sync
        pendingSync.removeAll()
        savePendingSync()
        markLastSync()
    }
    
    var hasPendingChanges: Bool {
        !pendingSync.isEmpty
    }
    
    // MARK: - Statistics
    
    var totalItems: Int {
        items.count
    }
    
    var purchasedItems: Int {
        items.filter(\.isPurchased).count
    }
    
    var remainingItems: Int {
        totalItems - purchasedItems
    }
    
    var progress: Double {
        guard totalItems > 0 else { return 0 }
        return Double(purchasedItems) / Double(totalItems)
    }
    
    var progressText: String {
        "\(purchasedItems) of \(totalItems) items"
    }
    
    // MARK: - Grouping
    
    func itemsGroupedByCategory() -> [(key: String, value: [ShoppingItem])] {
        let grouped = Dictionary(grouping: items) { $0.category }
        return grouped.sorted { item1, item2 in
            let index1 = ShoppingItem.categoryOrder.firstIndex(of: item1.key) ?? 999
            let index2 = ShoppingItem.categoryOrder.firstIndex(of: item2.key) ?? 999
            return index1 < index2
        }
    }
    
    func itemsGroupedByStore() -> [(key: String, value: [ShoppingItem])] {
        let grouped = Dictionary(grouping: items) { $0.store ?? "Other" }
        return grouped.sorted { $0.key < $1.key }
    }
    
    // MARK: - Computed Properties for Voice Commands
    
    var availableStores: [String] {
        let stores = Set(items.compactMap { $0.store }).sorted()
        return ["All Stores"] + stores
    }
    
    var filteredItems: [ShoppingItem] {
        var filtered = items
        
        // Filter by store
        if selectedStore != "All Stores" {
            filtered = filtered.filter { $0.store == selectedStore }
        }
        
        // Filter by search text
        if !searchText.isEmpty {
            filtered = filtered.filter {
                $0.name.lowercased().contains(searchText.lowercased()) ||
                $0.category.lowercased().contains(searchText.lowercased())
            }
        }
        
        return filtered
    }
    
    // MARK: - Pantry Sync Helpers
    
    /// Notify desktop that item was removed - return to pantry
    private func notifyItemRemoved(_ item: ShoppingItem) {
        guard let connection = connectionManager else {
            print("⚠️ No connection manager - cannot notify item removal")
            return
        }
        
        let (qty, unit) = parseQuantityAndUnit(item.quantity)
        
        let message: [String: Any] = [
            "type": "item_removed",
            "ingredient": item.name.lowercased(),
            "qty": qty,
            "unit": unit,
            "itemId": item.id
        ]
        
        connection.send(message)
        print("📤 Sent item_removed: \(item.name) (\(qty) \(unit))")
    }
    
    /// Notify desktop that item was unmarked as purchased - return to pantry
    private func notifyItemUnpurchased(_ item: ShoppingItem) {
        guard let connection = connectionManager else {
            print("⚠️ No connection manager - cannot notify item unpurchase")
            return
        }
        
        let (qty, unit) = parseQuantityAndUnit(item.quantity)
        
        let message: [String: Any] = [
            "type": "item_unpurchased",
            "ingredient": item.name.lowercased(),
            "qty": qty,
            "unit": unit,
            "itemId": item.id
        ]
        
        connection.send(message)
        print("📤 Sent item_unpurchased: \(item.name) (\(qty) \(unit))")
    }
    
    /// Parse quantity and unit from text like "2 cups" or "1 1/2 lb"
    /// Returns (quantity: Double, unit: String)
    private func parseQuantityAndUnit(_ text: String) -> (Double, String) {
        let trimmed = text.trimmingCharacters(in: .whitespaces)
        if trimmed.isEmpty { return (0, "") }
        
        let components = trimmed.components(separatedBy: .whitespaces)
        
        var quantity: Double = 0
        var unitStartIndex = 0
        
        // Try to parse as much as possible as quantity
        // Case 1: "1 1/2 cups" -> [1, 1/2] are quantity
        // Case 2: "1/2 cup" -> [1/2] is quantity
        // Case 3: "2.5 lb" -> [2.5] is quantity
        
        if components.count >= 2 && components[1].contains("/") {
            // Mixed fraction: [1, 1/2]
            let whole = Double(components[0]) ?? 0
            let fraction = parseFraction(components[1])
            quantity = whole + fraction
            unitStartIndex = 2
        } else if let first = components.first {
            if first.contains("/") {
                quantity = parseFraction(first)
                unitStartIndex = 1
            } else if let num = Double(first) {
                quantity = num
                unitStartIndex = 1
            }
        }
        
        // Join remaining components as unit
        let unit = components.count > unitStartIndex ? components[unitStartIndex...].joined(separator: " ") : ""
        
        print("📊 Parsed '\(text)' → qty: \(quantity), unit: '\(unit)'")
        return (quantity, unit)
    }
    
    /// Parse fraction string like "1/2" to decimal
    private func parseFraction(_ text: String) -> Double {
        let trimmed = text.trimmingCharacters(in: .whitespaces)
        
        if trimmed.contains("/") {
            let parts = trimmed.components(separatedBy: "/")
            if parts.count == 2,
               let numerator = Double(parts[0]),
               let denominator = Double(parts[1]),
               denominator != 0 {
                return numerator / denominator
            }
        }
        
        return Double(trimmed) ?? 0
    }
}
