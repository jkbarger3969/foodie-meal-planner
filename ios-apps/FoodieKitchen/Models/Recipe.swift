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
    let imageName: String?
    var additionalItems: [AdditionalItem]
    var assignedUsers: [AssignedUser]  // PHASE 4.5.7: Who this meal is for
    
    var imageURL: URL? {
        guard let imageName = imageName, !imageName.isEmpty else { return nil }
        
        if imageName.hasPrefix("http://") || imageName.hasPrefix("https://") {
            return URL(string: imageName)
        }
        return nil
    }
    
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
        self.imageName = dict["imageName"] as? String
        
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
    var imageName: String?
    var servings: Int
    var ingredients: [Ingredient]
    let receivedAt: Date
    
    var currentScale: Double = 1.0
    
    var imageURL: URL? {
        guard let imageName = imageName, !imageName.isEmpty else { return nil }
        
        if imageName.hasPrefix("http://") || imageName.hasPrefix("https://") {
            return URL(string: imageName)
        }
        return nil
    }
    
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
        self.imageName = dict["Image_Name"] as? String
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
    
    // MARK: - Navigation
    
    mutating func nextStep() -> Bool {
        // This logic is usually in RecipeStore, but good to have here too
        return false
    }
}

// MARK: - Ingredient

struct Ingredient: Identifiable, Codable, Equatable {
    let id: String
    var name: String
    var quantity: String
    var unit: String
    var category: String
    var isChecked: Bool = false
    var hasInPantry: Bool = false
    
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
        self.hasInPantry = dict["hasInPantry"] as? Bool ?? false
        
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
        let trimmed = text.trimmingCharacters(in: .whitespaces).lowercased()
        if trimmed.isEmpty { return nil }
        
        let components = trimmed.components(separatedBy: .whitespaces)
        var total: Double = 0
        var foundValue = false
        
        for component in components {
            // Handle fractions first
            if component.contains("/") {
                let parts = component.components(separatedBy: "/")
                if parts.count == 2,
                   let num = Double(parts[0]),
                   let den = Double(parts[1]), den != 0 {
                    total += num / den
                    foundValue = true
                }
            } else if let val = Double(component) {
                total += val
                foundValue = true
            } else {
                // Unicode fractions
                let unicodeMap: [String: Double] = [
                    "½": 0.5, "⅓": 0.33, "⅔": 0.67, "¼": 0.25, "¾": 0.75,
                    "⅛": 0.125, "⅜": 0.375, "⅝": 0.625, "⅞": 0.875
                ]
                for (symbol, value) in unicodeMap {
                    if component.contains(symbol) {
                        total += value
                        foundValue = true
                        // Also check if there's a whole number before it (e.g. "1½")
                        let withoutSymbol = component.replacingOccurrences(of: symbol, with: "")
                        if let whole = Double(withoutSymbol) {
                            total += whole
                        }
                    }
                }
            }
        }
        
        return foundValue ? total : Double(trimmed.components(separatedBy: .whitespaces).first ?? "")
    }
    
    private func formatQuantity(_ value: Double) -> String {
        if value <= 0 { return "" }
        
        let whole = Int(floor(value + 0.001))
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
        
        var bestFrac = ""
        var minDiff = 0.05
        
        for (frac, symbol) in fractions {
            let diff = abs(fractional - frac)
            if diff < minDiff {
                minDiff = diff
                bestFrac = symbol
            }
        }
        
        if !bestFrac.isEmpty {
            return whole > 0 ? "\(whole) \(bestFrac)" : bestFrac
        }
        
        // If no clean fraction, show 1 decimal place
        let formatted = String(format: "%.1f", value)
        return formatted.hasSuffix(".0") ? String(formatted.dropLast(2)) : formatted
    }
}
