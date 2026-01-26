import SwiftUI

struct ContentView: View {
    @EnvironmentObject var connection: ConnectionManager
    @EnvironmentObject var store: ShoppingListStore
    @EnvironmentObject var voiceInput: VoiceInputManager
    @EnvironmentObject var voiceCommand: VoiceCommandManager
    
    @State private var showSettings = false
    @State private var showAddItem = false
    @State private var showBarcodeScanner = false
    @State private var groupBy: GroupBy = .category
    
    enum GroupBy: String, CaseIterable {
        case category = "Category"
        case none = "No Grouping"
    }
    
    var body: some View {
        NavigationView {
            VStack(spacing: 0) {
                // Remote Timer Bar (Wow Factor: Phase 3)
                if !connection.remoteTimers.isEmpty {
                    RemoteTimerBar(timers: connection.remoteTimers)
                }
                
                // Smart Store Senses Banner
                if let storeName = connection.atStore {
                    HStack {
                        Image(systemName: "location.fill")
                            .foregroundColor(.white)
                        Text("You've arrived at \(storeName)")
                            .font(.headline)
                            .foregroundColor(.white)
                        Spacer()
                        Button("Open List") {
                            withAnimation(.spring()) {
                                store.selectedStore = storeName
                            }
                        }
                        .buttonStyle(.borderedProminent)
                        .tint(.white.opacity(0.3))
                        .controlSize(.small)
                    }
                    .padding()
                    .background(LinearGradient(colors: [.blue, .purple], startPoint: .leading, endPoint: .trailing))
                    .transition(.move(edge: .top).combined(with: .opacity))
                }
                
                // Sync status banner
                if case .syncing = connection.syncStatus {
                    SyncStatusBanner(status: connection.syncStatus)
                } else if case .success = connection.syncStatus {
                    SyncStatusBanner(status: connection.syncStatus)
                } else if case .failed = connection.syncStatus {
                    SyncStatusBanner(status: connection.syncStatus)
                }
                
                // Progress bar
                if !store.items.isEmpty {
                    VStack(spacing: 8) {
                        ProgressView(value: store.progress)
                            .tint(.green)
                        
                        HStack {
                            Text(store.progressText)
                                .font(.caption)
                                .foregroundColor(.secondary)
                            
                            Spacer()
                            
                            // Connection status
                            HStack(spacing: 4) {
                                Circle()
                                    .fill(connection.isConnected ? Color.green : Color.gray)
                                    .frame(width: 8, height: 8)
                                
                                Text(connection.isConnected ? "Connected" : "Offline")
                                    .font(.caption)
                                    .foregroundColor(.secondary)
                            }
                            
                            if let lastSync = store.lastSyncDate {
                                Text("•")
                                    .font(.caption)
                                    .foregroundColor(.secondary)
                                
                                Text(lastSync.formatted(.relative(presentation: .named)))
                                    .font(.caption)
                                    .foregroundColor(.secondary)
                            }
                        }
                    }
                    .padding(.horizontal)
                    .padding(.vertical, 12)
                    .background(Color(.systemBackground))
                }
                
                // Store tabs (if more than one store)
                if store.availableStores.count > 1 {
                    ScrollView(.horizontal, showsIndicators: false) {
                        HStack(spacing: 12) {
                            ForEach(store.availableStores, id: \.self) { storeName in
                                storeTab(storeName)
                            }
                        }
                        .padding(.horizontal)
                        .padding(.vertical, 12)
                    }
                    .background(Color(.secondarySystemBackground))
                }
                
                // Search bar
                if !store.items.isEmpty {
                    searchBar
                }
                
                // Shopping list
                if store.items.isEmpty {
                    emptyStateView
                } else if store.filteredItems.isEmpty {
                    emptySearchView
                } else {
                    shoppingListView
                }
            }
            .navigationTitle("Shopping List")
            .navigationBarTitleDisplayMode(.large)
            .toolbar {
                ToolbarItem(placement: .navigationBarLeading) {
                    Menu {
                        Picker("Group By", selection: $groupBy) {
                            ForEach(GroupBy.allCases, id: \.self) { option in
                                Text(option.rawValue).tag(option)
                            }
                        }
                        
                        if !store.items.filter(\.isPurchased).isEmpty {
                            Divider()
                            
                            Button(role: .destructive, action: store.clearPurchased) {
                                Label("Clear Purchased", systemImage: "trash")
                            }
                        }
                        
                        if !store.items.isEmpty {
                            Divider()
                            
                            Button(role: .destructive, action: store.clearAll) {
                                Label("Clear All Items", systemImage: "trash.fill")
                            }
                        }
                    } label: {
                        Image(systemName: "ellipsis.circle")
                            .imageScale(.large)
                    }
                }
                
                ToolbarItem(placement: .navigationBarTrailing) {
                    HStack(spacing: 16) {
                        // Sync button
                        Button(action: connection.syncNow) {
                            Image(systemName: "arrow.triangle.2.circlepath")
                                .imageScale(.large)
                                .symbolEffect(.rotate, value: connection.syncStatus)
                        }
                        .disabled(!connection.isConnected || !store.hasPendingChanges)
                        .opacity((connection.isConnected && store.hasPendingChanges) ? 1.0 : 0.3)
                        
                        // Barcode scanner button
                        Button(action: { showBarcodeScanner = true }) {
                            Image(systemName: "barcode.viewfinder")
                                .imageScale(.large)
                        }
                        
                        // Add item button
                        Button(action: { showAddItem = true }) {
                            Image(systemName: "plus.circle.fill")
                                .imageScale(.large)
                        }
                        
                        // Settings button
                        Button(action: { showSettings = true }) {
                            Image(systemName: "gearshape.fill")
                                .imageScale(.large)
                        }
                    }
                }
            }
            .sheet(isPresented: $showSettings) {
                SettingsView()
                    .environmentObject(connection)
            }
            .sheet(isPresented: $showAddItem) {
                AddItemView()
                    .environmentObject(store)
                    .environmentObject(voiceInput)
            }
            .sheet(isPresented: $showBarcodeScanner) {
                BarcodeScannerView()
                    .environmentObject(connection)
            }
            .onChange(of: connection.atStore) { oldValue, newValue in
                if let newStore = newValue {
                    // Auto-switch to the store tab for a "Wow" experience
                    withAnimation(.spring()) {
                        store.selectedStore = newStore
                    }
                }
            }
        }
    }
    
    // MARK: - Store Tab
    
    private func storeTab(_ storeName: String) -> some View {
        let isSelected = store.selectedStore == storeName
        let itemCount = storeName == "All Stores" 
            ? store.items.count 
            : store.items.filter { ($0.store ?? "No Store") == storeName }.count
        
        return Button(action: {
            withAnimation(.spring(response: 0.3)) {
                store.selectedStore = storeName
            }
        }) {
            VStack(spacing: 4) {
                HStack(spacing: 6) {
                    Image(systemName: storeIcon(for: storeName))
                        .font(.system(size: 14))
                    
                    Text(storeName)
                        .font(.system(size: 14, weight: isSelected ? .semibold : .regular))
                    
                    Text("\(itemCount)")
                        .font(.caption2)
                        .padding(.horizontal, 6)
                        .padding(.vertical, 2)
                        .background(isSelected ? Color.white.opacity(0.3) : Color.gray.opacity(0.2))
                        .clipShape(Capsule())
                }
                .foregroundColor(isSelected ? .white : .primary)
                .padding(.horizontal, 16)
                .padding(.vertical, 8)
                .background(isSelected ? Color.blue : Color(.systemGray5))
                .clipShape(Capsule())
                
                if isSelected {
                    Rectangle()
                        .fill(Color.blue)
                        .frame(height: 3)
                        .clipShape(Capsule())
                }
            }
        }
        .buttonStyle(.plain)
    }
    
    private func storeIcon(for storeName: String) -> String {
        switch storeName.lowercased() {
        case "all stores": return "cart.fill"
        case "no store": return "questionmark.circle"
        case let name where name.contains("walmart"): return "building.2"
        case let name where name.contains("target"): return "target"
        case let name where name.contains("kroger"): return "cart"
        case let name where name.contains("whole foods"): return "leaf"
        case let name where name.contains("trader"): return "storefront"
        default: return "storefront.fill"
        }
    }
    
    // MARK: - Search Bar
    
    private var searchBar: some View {
        HStack {
            Image(systemName: "magnifyingglass")
                .foregroundColor(.gray)
            
            TextField("Search items...", text: $store.searchText)
                .textFieldStyle(.plain)
            
            if !store.searchText.isEmpty {
                Button(action: { store.searchText = "" }) {
                    Image(systemName: "xmark.circle.fill")
                        .foregroundColor(.gray)
                }
            }
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 8)
        .background(Color(.systemGray6))
        .cornerRadius(10)
        .padding(.horizontal)
        .padding(.vertical, 8)
    }
    
    // MARK: - Empty States
    
    private var emptyStateView: some View {
        VStack(spacing: 20) {
            Spacer()
            
            Image(systemName: "cart")
                .font(.system(size: 80))
                .foregroundColor(.gray.opacity(0.5))
            
            Text("No Shopping List")
                .font(.title2)
                .fontWeight(.semibold)
            
            if connection.isConnected {
                Text("Send a list from your desktop app")
                    .font(.callout)
                    .foregroundColor(.secondary)
                    .multilineTextAlignment(.center)
                    .padding(.horizontal)
            } else {
                VStack(spacing: 12) {
                    Text("Not connected to desktop")
                        .font(.callout)
                        .foregroundColor(.secondary)
                    
                    Button("Connect Now") {
                        connection.connect()
                    }
                    .buttonStyle(.borderedProminent)
                    .controlSize(.large)
                }
            }
            
            Spacer()
        }
    }
    
    private var emptySearchView: some View {
        VStack(spacing: 20) {
            Spacer()
            
            Image(systemName: "magnifyingglass")
                .font(.system(size: 60))
                .foregroundColor(.gray.opacity(0.5))
            
            Text("No Results")
                .font(.title3)
                .fontWeight(.semibold)
            
            Text("Try a different search or store filter")
                .font(.callout)
                .foregroundColor(.secondary)
            
            Spacer()
        }
    }
    
    // MARK: - Shopping List
    
    private var shoppingListView: some View {
        List {
            switch groupBy {
            case .category:
                ForEach(groupedByCategory(), id: \.key) { category, items in
                    Section {
                        ForEach(items) { item in
                            ShoppingItemRow(item: item) {
                                store.togglePurchased(item)
                            }
                            .swipeActions(edge: .trailing, allowsFullSwipe: true) {
                                Button(role: .destructive) {
                                    store.deleteItem(item)
                                } label: {
                                    Label("Delete", systemImage: "trash")
                                }
                            }
                            .swipeActions(edge: .leading, allowsFullSwipe: true) {
                                Button {
                                    store.togglePurchased(item)
                                } label: {
                                    Label(
                                        item.isPurchased ? "Uncheck" : "Check",
                                        systemImage: item.isPurchased ? "xmark.circle" : "checkmark.circle"
                                    )
                                }
                                .tint(item.isPurchased ? .orange : .green)
                            }
                            .contextMenu {
                                Button {
                                    store.togglePurchased(item)
                                } label: {
                                    Label(
                                        item.isPurchased ? "Mark as Needed" : "Mark as Purchased",
                                        systemImage: item.isPurchased ? "cart.badge.plus" : "checkmark.circle"
                                    )
                                }
                                
                                Divider()
                                
                                Button(role: .destructive) {
                                    store.deleteItem(item)
                                } label: {
                                    Label("Delete Item", systemImage: "trash")
                                }
                            }
                        }
                    } header: {
                        HStack {
                            Image(systemName: categoryIcon(for: category))
                                .font(.caption)
                            Text(category)
                        }
                    }
                }
                
            case .none:
                ForEach(store.filteredItems) { item in
                    ShoppingItemRow(item: item) {
                        store.togglePurchased(item)
                    }
                    .swipeActions(edge: .trailing, allowsFullSwipe: true) {
                        Button(role: .destructive) {
                            store.deleteItem(item)
                        } label: {
                            Label("Delete", systemImage: "trash")
                        }
                    }
                    .swipeActions(edge: .leading, allowsFullSwipe: true) {
                        Button {
                            store.togglePurchased(item)
                        } label: {
                            Label(
                                item.isPurchased ? "Uncheck" : "Check",
                                systemImage: item.isPurchased ? "xmark.circle" : "checkmark.circle"
                            )
                        }
                        .tint(item.isPurchased ? .orange : .green)
                    }
                    .contextMenu {
                        Button {
                            store.togglePurchased(item)
                        } label: {
                            Label(
                                item.isPurchased ? "Mark as Needed" : "Mark as Purchased",
                                systemImage: item.isPurchased ? "cart.badge.plus" : "checkmark.circle"
                            )
                        }
                        
                        Divider()
                        
                        Button(role: .destructive) {
                            store.deleteItem(item)
                        } label: {
                            Label("Delete Item", systemImage: "trash")
                        }
                    }
                }
            }
        }
        .listStyle(.insetGrouped)
    }
    
    // MARK: - Helper Methods
    
    private func groupedByCategory() -> [(key: String, value: [ShoppingItem])] {
        let grouped = Dictionary(grouping: store.filteredItems) { $0.category }
        return grouped.sorted { item1, item2 in
            let index1 = ShoppingItem.categoryOrder.firstIndex(of: item1.key) ?? 999
            let index2 = ShoppingItem.categoryOrder.firstIndex(of: item2.key) ?? 999
            return index1 < index2
        }
    }
    
    private func categoryIcon(for category: String) -> String {
        switch category.lowercased() {
        case "produce": return "leaf.fill"
        case "dairy": return "drop.fill"
        case "meat": return "hare.fill"
        case "seafood": return "fish.fill"
        case "bakery": return "birthday.cake.fill"
        case "frozen": return "snowflake"
        case "pantry": return "cabinet.fill"
        case "beverages": return "cup.and.saucer.fill"
        case "snacks": return "popcorn.fill"
        default: return "circle.fill"
        }
    }
}

struct RemoteTimerBar: View {
    let timers: [[String: Any]]
    
    var body: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 12) {
                ForEach(timers.indices, id: \.self) { index in
                    let timer = timers[index]
                    let label = timer["label"] as? String ?? "Timer"
                    let remaining = timer["remaining"] as? Double ?? 0
                    let isRunning = timer["isRunning"] as? Bool ?? false
                    
                    HStack(spacing: 8) {
                        Image(systemName: isRunning ? "timer" : "timer.circle")
                            .symbolEffect(.pulse, isActive: isRunning)
                            .foregroundColor(.orange)
                        
                        VStack(alignment: .leading, spacing: 2) {
                            Text(label)
                                .font(.caption2)
                                .fontWeight(.bold)
                                .foregroundColor(.secondary)
                            Text(formatTime(remaining))
                                .font(.system(size: 14, weight: .bold, design: .monospaced))
                                .foregroundColor(.primary)
                        }
                    }
                    .padding(.horizontal, 12)
                    .padding(.vertical, 8)
                    .background(Color.orange.opacity(0.1))
                    .cornerRadius(12)
                }
            }
            .padding(.horizontal)
            .padding(.vertical, 8)
        }
        .background(Color(.secondarySystemBackground))
        .transition(.move(edge: .top).combined(with: .opacity))
    }
    
    private func formatTime(_ time: TimeInterval) -> String {
        let mins = Int(time) / 60
        let secs = Int(time) % 60
        return String(format: "%02d:%02d", mins, secs)
    }
}

// MARK: - Preview

struct ContentView_Previews: PreviewProvider {
    static var previews: some View {
        ContentView()
            .environmentObject(ConnectionManager())
            .environmentObject(ShoppingListStore())
            .environmentObject(VoiceInputManager())
    }
}
