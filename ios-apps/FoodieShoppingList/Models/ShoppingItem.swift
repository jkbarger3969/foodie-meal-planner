import Foundation

// MARK: - Shopping Item Model
struct ShoppingItem: Identifiable, Codable, Equatable {
    let id: String
    var name: String
    var quantity: String
    var category: String
    var store: String?
    var isPurchased: Bool
    let receivedAt: Date
    var isManuallyAdded: Bool // Items added while shopping
    var forUsers: [String] // PHASE 4.5.7: User assignments (names)
    
    // For Codable
    enum CodingKeys: String, CodingKey {
        case id, name, quantity, category, store, isPurchased, receivedAt, isManuallyAdded, forUsers
    }
    
    // Initialize from server data
    init?(from dict: [String: Any]) {
        guard let id = dict["ItemId"] as? String,
              let name = dict["IngredientName"] as? String else {
            return nil
        }
        
        self.id = id
        self.name = name
        self.quantity = dict["QtyText"] as? String ?? ""
        self.category = dict["Category"] as? String ?? "Other"
        self.store = dict["StoreName"] as? String
        self.isPurchased = (dict["is_purchased"] as? Int ?? 0) == 1
        self.receivedAt = Date()
        self.isManuallyAdded = false
        
        // PHASE 4.5.7: Parse user assignments (array of names)
        if let userNames = dict["forUsers"] as? [String] {
            self.forUsers = userNames
        } else {
            self.forUsers = []
        }
    }
    
    // Initialize for manual entry
    init(name: String, quantity: String = "", category: String = "Other") {
        self.id = UUID().uuidString
        self.name = name
        self.quantity = quantity
        self.category = category
        self.store = nil
        self.isPurchased = false
        self.receivedAt = Date()
        self.isManuallyAdded = true
        self.forUsers = [] // PHASE 4.5.7: Default to empty
    }
    
    // Full initializer (for voice commands with store)
    init(id: String, name: String, quantity: String, category: String, store: String?, isPurchased: Bool, receivedAt: Date, isManuallyAdded: Bool, forUsers: [String] = []) {
        self.id = id
        self.name = name
        self.quantity = quantity
        self.category = category
        self.store = store
        self.isPurchased = isPurchased
        self.receivedAt = receivedAt
        self.isManuallyAdded = isManuallyAdded
        self.forUsers = forUsers // PHASE 4.5.7
    }
    
    // For Codable decoding
    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        id = try container.decode(String.self, forKey: .id)
        name = try container.decode(String.self, forKey: .name)
        quantity = try container.decode(String.self, forKey: .quantity)
        category = try container.decode(String.self, forKey: .category)
        store = try container.decodeIfPresent(String.self, forKey: .store)
        isPurchased = try container.decode(Bool.self, forKey: .isPurchased)
        receivedAt = try container.decode(Date.self, forKey: .receivedAt)
        isManuallyAdded = try container.decodeIfPresent(Bool.self, forKey: .isManuallyAdded) ?? false
        forUsers = try container.decodeIfPresent([String].self, forKey: .forUsers) ?? [] // PHASE 4.5.7
    }
}

// MARK: - Category Extension
extension ShoppingItem {
    static let categoryOrder = [
        "Produce",
        "Dairy",
        "Meat",
        "Seafood",
        "Bakery",
        "Frozen",
        "Pantry",
        "Beverages",
        "Snacks",
        "Other"
    ]
    
    var categoryIndex: Int {
        ShoppingItem.categoryOrder.firstIndex(of: category) ?? 999
    }
}
