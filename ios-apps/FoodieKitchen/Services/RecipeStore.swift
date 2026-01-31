import Foundation
import Combine

// Helper struct for encoding/decoding recipe state
private struct RecipeState: Codable {
    let step: Int
    let checked: [String]
}

class RecipeStore: ObservableObject {
    @Published var currentRecipe: Recipe?
    @Published var availableRecipes: [Recipe] = []
    @Published var availableMealSlots: [MealSlot] = []  // NEW: Meal slots with additional items
    @Published var sentRecipes: [Recipe] = []  // Recipes sent individually from desktop
    @Published var collections: [RecipeCollection] = []  // Collections sent from desktop
    @Published var currentInstructionStep = 0
    @Published var checkedIngredients: Set<String> = []
    @Published var shouldShowMealList = false  // NEW: Trigger to show meal list
    
    weak var connection: ConnectionManager?
    
    private let storageKey = "FoodieKitchen_CurrentRecipe"
    private let availableRecipesKey = "FoodieKitchen_AvailableRecipes"
    private let availableMealSlotsKey = "FoodieKitchen_AvailableMealSlots"
    private let sentRecipesKey = "FoodieKitchen_SentRecipes"
    private let collectionsKey = "FoodieKitchen_Collections"
    
    private let maxSentRecipes = 10
    private let maxCollections = 5
    
    init() {
        loadFromLocalStorage()
    }
    
    func setCurrentRecipe(_ recipe: Recipe) {
        currentRecipe = recipe
        currentInstructionStep = 0
        checkedIngredients.removeAll()
        saveToLocalStorage()
    }
    
    func setAvailableRecipes(_ recipes: [Recipe]) {
        availableRecipes = recipes
        saveAvailableRecipes()
    }
    
    // NEW: Set available meal slots
    func setAvailableMealSlots(_ slots: [MealSlot]) {
        availableMealSlots = slots
        saveMealSlots()
    }
    
    // MARK: - Sent Recipes Management
    
    func addSentRecipe(_ recipe: Recipe) {
        sentRecipes.insert(recipe, at: 0)
        if sentRecipes.count > maxSentRecipes {
            sentRecipes.removeLast()
        }
        saveSentRecipes()
        print("📱 Added sent recipe: \(recipe.title), total: \(sentRecipes.count)")
    }
    
    func clearSentRecipes() {
        sentRecipes.removeAll()
        saveSentRecipes()
        print("📱 Cleared all sent recipes")
    }
    
    func removeSentRecipe(_ recipeId: String) {
        sentRecipes.removeAll { $0.id == recipeId }
        saveSentRecipes()
        print("📱 Removed sent recipe: \(recipeId)")
    }
    
    // MARK: - Collections Management
    
    func addCollection(_ collection: RecipeCollection) {
        if let existingIndex = collections.firstIndex(where: { $0.id == collection.id }) {
            collections.remove(at: existingIndex)
        }
        collections.insert(collection, at: 0)
        if collections.count > maxCollections {
            collections.removeLast()
        }
        saveCollections()
        print("📱 Added collection: \(collection.name) with \(collection.recipes.count) recipes")
    }
    
    func clearCollections() {
        collections.removeAll()
        saveCollections()
        print("📱 Cleared all collections")
    }
    
    func removeCollection(_ collectionId: String) {
        collections.removeAll { $0.id == collectionId }
        saveCollections()
        print("📱 Removed collection: \(collectionId)")
    }
    
    // NEW: Load a recipe by ID from desktop
    func loadRecipeById(_ recipeId: String) {
        print("📱 loadRecipeById called: \(recipeId)")
        guard let conn = connection else {
            print("❌ connection is nil!")
            return
        }
        print("📱 isConnected=\(conn.isConnected), isPaired=\(conn.isPaired)")
        let message = Message(type: "load_recipe", data: ["recipeId": recipeId])
        conn.sendMessage(message)
        print("📱 sendMessage called")
    }
    
    func scaleRecipe(by factor: Double) {
        guard var recipe = currentRecipe else { return }
        recipe.currentScale = factor
        currentRecipe = recipe
        saveToLocalStorage()
    }
    
    func toggleIngredientChecked(_ ingredientId: String) {
        if checkedIngredients.contains(ingredientId) {
            checkedIngredients.remove(ingredientId)
        } else {
            checkedIngredients.insert(ingredientId)
        }
        saveToLocalStorage()
    }
    
    func nextStep() {
        guard let recipe = currentRecipe else { return }
        let steps = recipe.instructions.components(separatedBy: "\n").filter { !$0.isEmpty }
        if currentInstructionStep < steps.count - 1 {
            currentInstructionStep += 1
            saveToLocalStorage()
        }
    }
    
    func previousStep() {
        if currentInstructionStep > 0 {
            currentInstructionStep -= 1
            saveToLocalStorage()
        }
    }
    
    // NEW: Go home to meal list (for voice command)
    func goHome() {
        currentRecipe = nil
        currentInstructionStep = 0
        shouldShowMealList = true
    }
    
    var instructionSteps: [String] {
        guard let recipe = currentRecipe else { return [] }
        return recipe.instructions
            .components(separatedBy: "\n")
            .filter { !$0.trimmingCharacters(in: .whitespaces).isEmpty }
    }
    
    private func saveToLocalStorage() {
        if let recipe = currentRecipe,
           let encoded = try? JSONEncoder().encode(recipe) {
            UserDefaults.standard.set(encoded, forKey: storageKey)
        }
        
        let stepData = RecipeState(step: currentInstructionStep, checked: Array(checkedIngredients))
        if let encoded = try? JSONEncoder().encode(stepData) {
            UserDefaults.standard.set(encoded, forKey: "\(storageKey)_state")
        }
    }
    
    private func saveAvailableRecipes() {
        if let encoded = try? JSONEncoder().encode(availableRecipes) {
            UserDefaults.standard.set(encoded, forKey: availableRecipesKey)
        }
    }
    
    private func saveMealSlots() {
        if let encoded = try? JSONEncoder().encode(availableMealSlots) {
            UserDefaults.standard.set(encoded, forKey: availableMealSlotsKey)
        }
    }
    
    func saveSentRecipes() {
        if let encoded = try? JSONEncoder().encode(sentRecipes) {
            UserDefaults.standard.set(encoded, forKey: sentRecipesKey)
        }
    }
    
    private func saveCollections() {
        if let encoded = try? JSONEncoder().encode(collections) {
            UserDefaults.standard.set(encoded, forKey: collectionsKey)
        }
    }
    
    private func loadFromLocalStorage() {
        if let data = UserDefaults.standard.data(forKey: storageKey),
           let recipe = try? JSONDecoder().decode(Recipe.self, from: data) {
            currentRecipe = recipe
        }
        
        if let data = UserDefaults.standard.data(forKey: "\(storageKey)_state"),
           let stepData = try? JSONDecoder().decode(RecipeState.self, from: data) {
            currentInstructionStep = stepData.step
            checkedIngredients = Set(stepData.checked)
        }
        
        if let data = UserDefaults.standard.data(forKey: availableRecipesKey),
           let recipes = try? JSONDecoder().decode([Recipe].self, from: data) {
            availableRecipes = recipes
        }
        
        if let data = UserDefaults.standard.data(forKey: availableMealSlotsKey),
           let slots = try? JSONDecoder().decode([MealSlot].self, from: data) {
            availableMealSlots = slots
        }
        
        if let data = UserDefaults.standard.data(forKey: sentRecipesKey),
           let recipes = try? JSONDecoder().decode([Recipe].self, from: data) {
            sentRecipes = recipes
        }
        
        if let data = UserDefaults.standard.data(forKey: collectionsKey),
           let cols = try? JSONDecoder().decode([RecipeCollection].self, from: data) {
            collections = cols
        }
    }
}
