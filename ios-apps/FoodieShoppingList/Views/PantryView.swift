import SwiftUI
import Combine

// MARK: - Pantry Item Model

struct PantryItem: Identifiable, Codable {
    let id: String
    let name: String
    let quantity: Double
    let unit: String
    let category: String
    let expirationDate: Date?
    let isLowStock: Bool
    let lowStockThreshold: Double
    
    var isExpiringSoon: Bool {
        guard let expDate = expirationDate else { return false }
        let sevenDaysFromNow = Calendar.current.date(byAdding: .day, value: 7, to: Date()) ?? Date()
        return expDate <= sevenDaysFromNow
    }
    
    var isExpired: Bool {
        guard let expDate = expirationDate else { return false }
        return expDate < Date()
    }
    
    var displayQuantity: String {
        if unit.isEmpty {
            return String(format: quantity == floor(quantity) ? "%.0f" : "%.1f", quantity)
        }
        return "\(String(format: quantity == floor(quantity) ? "%.0f" : "%.1f", quantity)) \(unit)"
    }
    
    var categoryColor: Color {
        switch category.lowercased() {
        case "produce": return AppColors.categoryProduce
        case "dairy": return AppColors.categoryDairy
        case "meat": return AppColors.categoryMeat
        case "seafood": return AppColors.categorySeafood
        case "bakery": return AppColors.categoryBakery
        case "pantry": return AppColors.categoryPantry
        case "frozen": return AppColors.categoryFrozen
        case "beverage": return AppColors.categoryBeverage
        case "spice", "spices": return AppColors.categorySpice
        default: return AppColors.textMuted
        }
    }
}

// MARK: - Pantry Store

class PantryStore: ObservableObject {
    @Published var items: [PantryItem] = []
    @Published var isLoading = false
    @Published var lastSyncDate: Date?
    
    var lowStockItems: [PantryItem] {
        items.filter { $0.isLowStock }
    }
    
    var expiringSoonItems: [PantryItem] {
        items.filter { $0.isExpiringSoon && !$0.isExpired }
    }
    
    var expiredItems: [PantryItem] {
        items.filter { $0.isExpired }
    }
    
    func updateItems(_ newItems: [PantryItem]) {
        DispatchQueue.main.async {
            self.items = newItems
            self.lastSyncDate = Date()
        }
    }
}

// MARK: - Pantry View

struct PantryView: View {
    @EnvironmentObject var connection: ConnectionManager
    @StateObject private var pantryStore = PantryStore()
    @State private var selectedFilter: PantryFilter = .all
    @State private var searchText = ""
    
    enum PantryFilter: String, CaseIterable {
        case all = "All"
        case lowStock = "Low Stock"
        case expiringSoon = "Expiring Soon"
    }
    
    private var filteredItems: [PantryItem] {
        var result = pantryStore.items
        
        // Apply filter
        switch selectedFilter {
        case .lowStock:
            result = pantryStore.lowStockItems
        case .expiringSoon:
            result = pantryStore.expiringSoonItems + pantryStore.expiredItems
        case .all:
            break
        }
        
        // Apply search
        if !searchText.isEmpty {
            result = result.filter { $0.name.localizedCaseInsensitiveContains(searchText) }
        }
        
        return result
    }
    
    var body: some View {
        NavigationView {
            VStack(spacing: 0) {
                // Quick Stats Bar
                if !pantryStore.items.isEmpty {
                    HStack(spacing: AppSpacing.xl) {
                        StatPill(
                            icon: "exclamationmark.triangle.fill",
                            count: pantryStore.lowStockItems.count,
                            label: "Low Stock",
                            color: AppColors.warning,
                            isSelected: selectedFilter == .lowStock
                        ) {
                            selectedFilter = selectedFilter == .lowStock ? .all : .lowStock
                        }
                        
                        StatPill(
                            icon: "clock.fill",
                            count: pantryStore.expiringSoonItems.count + pantryStore.expiredItems.count,
                            label: "Expiring",
                            color: AppColors.danger,
                            isSelected: selectedFilter == .expiringSoon
                        ) {
                            selectedFilter = selectedFilter == .expiringSoon ? .all : .expiringSoon
                        }
                    }
                    .padding()
                    .background(Color(.secondarySystemBackground))
                }
                
                // Search bar
                if !pantryStore.items.isEmpty {
                    HStack(spacing: AppSpacing.md) {
                        Image(systemName: "magnifyingglass")
                            .foregroundColor(AppColors.textMuted)
                        TextField("Search pantry...", text: $searchText)
                            .textFieldStyle(.plain)
                        if !searchText.isEmpty {
                            Button(action: { searchText = "" }) {
                                Image(systemName: "xmark.circle.fill")
                                    .foregroundColor(AppColors.textMuted)
                            }
                        }
                    }
                    .padding(AppSpacing.md)
                    .background(Color(.systemGray6))
                    .cornerRadius(AppRadius.md)
                    .padding(.horizontal)
                    .padding(.vertical, AppSpacing.sm)
                }
                
                // Content
                if pantryStore.isLoading {
                    ProgressView("Loading pantry...")
                        .frame(maxHeight: .infinity)
                } else if pantryStore.items.isEmpty {
                    EmptyStateView(
                        icon: "cabinet.fill",
                        title: "Pantry Not Synced",
                        message: "Connect to your Mac to view pantry items"
                    )
                } else if filteredItems.isEmpty {
                    EmptyStateView(
                        icon: "magnifyingglass",
                        title: "No Items Found",
                        message: searchText.isEmpty ? "No items match the selected filter" : "No items match \"\(searchText)\""
                    )
                } else {
                    List {
                        ForEach(filteredItems) { item in
                            PantryItemRow(item: item) {
                                addToShoppingList(item)
                            }
                        }
                    }
                    .listStyle(.plain)
                }
            }
            .navigationTitle("Pantry")
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    if connection.isConnected {
                        Button(action: requestPantrySync) {
                            Image(systemName: "arrow.triangle.2.circlepath")
                        }
                    }
                }
            }
        }
        .onAppear {
            requestPantrySync()
        }
    }
    
    private func requestPantrySync() {
        guard connection.isConnected else { return }
        pantryStore.isLoading = true
        connection.requestPantryItems()
    }
    
    private func addToShoppingList(_ item: PantryItem) {
        connection.addToShoppingList(name: item.name, quantity: "", category: item.category)
    }
}

// MARK: - Stat Pill

struct StatPill: View {
    let icon: String
    let count: Int
    let label: String
    let color: Color
    let isSelected: Bool
    let action: () -> Void
    
    var body: some View {
        Button(action: action) {
            HStack(spacing: AppSpacing.sm) {
                Image(systemName: icon)
                    .foregroundColor(color)
                
                VStack(alignment: .leading, spacing: 0) {
                    Text("\(count)")
                        .font(AppTypography.titleSmall)
                        .foregroundColor(isSelected ? color : AppColors.textPrimary)
                    Text(label)
                        .font(AppTypography.caption)
                        .foregroundColor(AppColors.textMuted)
                }
            }
            .padding(.horizontal, AppSpacing.md)
            .padding(.vertical, AppSpacing.sm)
            .background(isSelected ? color.opacity(0.15) : Color.clear)
            .cornerRadius(AppRadius.md)
            .overlay(
                RoundedRectangle(cornerRadius: AppRadius.md)
                    .stroke(isSelected ? color : Color.clear, lineWidth: 1)
            )
        }
        .buttonStyle(.plain)
    }
}

// MARK: - Pantry Item Row

struct PantryItemRow: View {
    let item: PantryItem
    let onAddToList: () -> Void
    
    var body: some View {
        HStack(spacing: AppSpacing.md) {
            // Category indicator
            Circle()
                .fill(item.categoryColor)
                .frame(width: 8, height: 8)
            
            VStack(alignment: .leading, spacing: AppSpacing.xs) {
                HStack(spacing: AppSpacing.sm) {
                    Text(item.name)
                        .font(AppTypography.bodyLarge)
                        .foregroundColor(AppColors.textPrimary)
                    
                    if item.isLowStock {
                        Image(systemName: "exclamationmark.triangle.fill")
                            .font(.caption)
                            .foregroundColor(AppColors.warning)
                    }
                    
                    if item.isExpired {
                        Text("EXPIRED")
                            .font(.system(size: 10, weight: .bold))
                            .foregroundColor(.white)
                            .padding(.horizontal, 6)
                            .padding(.vertical, 2)
                            .background(AppColors.danger)
                            .cornerRadius(4)
                    } else if item.isExpiringSoon {
                        Text("EXPIRING")
                            .font(.system(size: 10, weight: .bold))
                            .foregroundColor(AppColors.warning)
                            .padding(.horizontal, 6)
                            .padding(.vertical, 2)
                            .background(AppColors.warningMuted)
                            .cornerRadius(4)
                    }
                }
                
                HStack(spacing: AppSpacing.sm) {
                    Text(item.displayQuantity)
                        .font(AppTypography.caption)
                        .foregroundColor(item.isLowStock ? AppColors.warning : AppColors.textMuted)
                    
                    if let expDate = item.expirationDate {
                        Text("•")
                            .font(AppTypography.caption)
                            .foregroundColor(AppColors.textMuted)
                        
                        Text("Exp: \(expDate.formatted(date: .abbreviated, time: .omitted))")
                            .font(AppTypography.caption)
                            .foregroundColor(item.isExpired ? AppColors.danger : item.isExpiringSoon ? AppColors.warning : AppColors.textMuted)
                    }
                }
            }
            
            Spacer()
            
            // Add to shopping list button
            Button(action: onAddToList) {
                Image(systemName: "cart.badge.plus")
                    .font(.title3)
                    .foregroundColor(AppColors.accent)
            }
            .buttonStyle(.plain)
        }
        .padding(.vertical, AppSpacing.sm)
    }
}
