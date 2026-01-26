import Foundation

// MARK: - Assigned User (Phase 4.5.7)

struct AssignedUser: Identifiable, Codable, Equatable {
    let id: String
    let userId: String
    let name: String
    let avatarEmoji: String
    let email: String?
    
    init?(from dict: [String: Any]) {
        guard let userId = dict["userId"] as? String,
              let name = dict["name"] as? String else {
            return nil
        }
        
        self.id = userId
        self.userId = userId
        self.name = name
        self.avatarEmoji = dict["avatarEmoji"] as? String ?? "👤"
        self.email = dict["email"] as? String
    }
}

// MARK: - Meal Slot (for Today's Meals with Additional Items)

struct MealSlot: Identifiable, Codable, Equatable {
    let id: String
    let slot: String  // "breakfast", "lunch", "dinner"
    let recipeId: String
    let title: String
    var additionalItems: [AdditionalItem]
    var assignedUsers: [AssignedUser]  // PHASE 4.5.7: Who this meal is for
    
    init?(from dict: [String: Any]) {
        guard let slot = dict["slot"] as? String,
              let recipeId = dict["recipeId"] as? String,
              let title = dict["title"] as? String else {
            return nil
        }
        
        self.id = "\(slot)-\(recipeId)"
        self.slot = slot
        self.recipeId = recipeId
        self.title = title
        
        // Parse additional items
        if let itemsData = dict["additionalItems"] as? [[String: Any]] {
            self.additionalItems = itemsData.compactMap { AdditionalItem(from: $0) }
        } else {
            self.additionalItems = []
        }
        
        // PHASE 4.5.7: Parse assigned users
        if let usersData = dict["assignedUsers"] as? [[String: Any]] {
            self.assignedUsers = usersData.compactMap { AssignedUser(from: $0) }
        } else {
            self.assignedUsers = []
        }
    }
}

struct AdditionalItem: Identifiable, Codable, Equatable {
    let id: String
    let recipeId: String
    let title: String
    let itemType: String  // "side", "dessert", "appetizer", "beverage", etc.
    
    init?(from dict: [String: Any]) {
        guard let recipeId = dict["recipeId"] as? String,
              let title = dict["title"] as? String else {
            return nil
        }
        
        self.id = recipeId
        self.recipeId = recipeId
        self.title = title
        self.itemType = dict["itemType"] as? String ?? "side"
    }
}

// MARK: - Recipe

struct Recipe: Identifiable, Codable, Equatable {
    let id: String
    var title: String
    var mealType: String
    var cuisine: String
    var instructions: String
    var notes: String
    var url: String?
    var servings: Int
    var ingredients: [Ingredient]
    let receivedAt: Date
    
    var currentScale: Double = 1.0
    
    init?(from dict: [String: Any]) {
        guard let id = dict["RecipeId"] as? String,
              let title = dict["Title"] as? String else {
            return nil
        }
        
        self.id = id
        self.title = title
        self.mealType = dict["MealType"] as? String ?? "Any"
        self.cuisine = dict["Cuisine"] as? String ?? ""
        self.instructions = dict["Instructions"] as? String ?? ""
        self.notes = dict["Notes"] as? String ?? ""
        self.url = dict["URL"] as? String
        self.servings = dict["Servings"] as? Int ?? 4
        
        // Parse ingredients array
        if let ingredientsData = dict["ingredients"] as? [[String: Any]] {
            self.ingredients = ingredientsData.compactMap { Ingredient(from: $0) }
        } else {
            self.ingredients = []
        }
        
        self.receivedAt = Date()
    }
    
    func scaledIngredients() -> [Ingredient] {
        return ingredients.map { ingredient in
            var scaled = ingredient
            scaled.scale(by: currentScale)
            return scaled
        }
    }
}

struct Ingredient: Identifiable, Codable, Equatable {
    let id: String
    var name: String
    var quantity: String
    var unit: String
    var category: String
    var isChecked: Bool = false
    
    private var numericQuantity: Double?
    
    init?(from dict: [String: Any]) {
        guard let name = dict["IngredientName"] as? String else {
            return nil
        }
        
        self.id = (dict["IngredientId"] as? String) ?? UUID().uuidString
        self.name = name
        self.quantity = dict["QtyText"] as? String ?? ""
        self.unit = dict["Unit"] as? String ?? ""
        self.category = dict["Category"] as? String ?? "Other"
        
        // Try to parse numeric quantity
        if let qtyNum = dict["QtyNum"] as? Double {
            self.numericQuantity = qtyNum
        } else if let qtyText = dict["QtyText"] as? String {
            self.numericQuantity = parseQuantity(qtyText)
        }
    }
    
    mutating func scale(by factor: Double) {
        guard let numeric = numericQuantity else { return }
        let scaled = numeric * factor
        quantity = formatQuantity(scaled)
    }
    
    private func parseQuantity(_ text: String) -> Double? {
        let trimmed = text.trimmingCharacters(in: .whitespaces)
        
        // Handle fractions
        let fractionMap: [String: Double] = [
            "½": 0.5, "1/2": 0.5,
            "⅓": 0.33, "1/3": 0.33,
            "⅔": 0.67, "2/3": 0.67,
            "¼": 0.25, "1/4": 0.25,
            "¾": 0.75, "3/4": 0.75,
            "⅛": 0.125, "1/8": 0.125,
            "⅜": 0.375, "3/8": 0.375,
            "⅝": 0.625, "5/8": 0.625,
            "⅞": 0.875, "7/8": 0.875
        ]
        
        for (fraction, value) in fractionMap {
            if trimmed.contains(fraction) {
                let withoutFraction = trimmed.replacingOccurrences(of: fraction, with: "")
                let whole = Double(withoutFraction.trimmingCharacters(in: .whitespaces)) ?? 0
                return whole + value
            }
        }
        
        return Double(trimmed.components(separatedBy: .whitespaces).first ?? "")
    }
    
    private func formatQuantity(_ value: Double) -> String {
        let whole = Int(value)
        let fractional = value - Double(whole)
        
        if fractional < 0.01 {
            return "\(whole)"
        }
        
        // Find closest fraction
        let fractions: [(Double, String)] = [
            (0.125, "⅛"), (0.25, "¼"), (0.33, "⅓"),
            (0.375, "⅜"), (0.5, "½"), (0.625, "⅝"),
            (0.67, "⅔"), (0.75, "¾"), (0.875, "⅞")
        ]
        
        for (frac, symbol) in fractions {
            if abs(fractional - frac) < 0.05 {
                return whole > 0 ? "\(whole) \(symbol)" : symbol
            }
        }
        
        return String(format: "%.2f", value)
    }
}
