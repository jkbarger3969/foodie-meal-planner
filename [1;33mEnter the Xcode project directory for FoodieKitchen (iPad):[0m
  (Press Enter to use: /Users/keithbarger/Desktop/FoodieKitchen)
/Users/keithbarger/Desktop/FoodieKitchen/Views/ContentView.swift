import SwiftUI

struct ContentView: View {
    @EnvironmentObject var connection: ConnectionManager
    @EnvironmentObject var recipeStore: RecipeStore
    @EnvironmentObject var timerManager: TimerManager
    @EnvironmentObject var voiceCommand: VoiceCommandManager
    
    @State private var showSettings = false
    @State private var showRecipeList = false
    
    var body: some View {
        NavigationView {
            GeometryReader { geometry in
                if recipeStore.currentRecipe != nil {
                    ZStack(alignment: .bottom) {
                        HStack(spacing: 0) {
                            IngredientListView()
                                .frame(width: geometry.size.width * 0.4)
                            
                            Divider()
                            
                            InstructionsView()
                                .frame(width: geometry.size.width * 0.6)
                        }
                        
                        if !timerManager.timers.isEmpty {
                            TimerBar()
                                .frame(height: 120)
                        }
                    }
                    .toolbar {
                        ToolbarItem(placement: .navigationBarLeading) {
                            Button(action: {
                                recipeStore.currentRecipe = nil
                                recipeStore.currentInstructionStep = 0
                            }) {
                                HStack(spacing: 8) {
                                    Image(systemName: "house.fill")
                                    Text("Home")
                                }
                                .font(.headline)
                                .padding(.horizontal, 12)
                                .padding(.vertical, 8)
                                .background(Color.blue)
                                .foregroundColor(.white)
                                .cornerRadius(8)
                            }
                        }
                        
                        ToolbarItem(placement: .principal) {
                            Button("Today's Meals") { 
                                showRecipeList = true 
                            }
                            .font(.headline)
                        }
                        
                        ToolbarItem(placement: .navigationBarTrailing) {
                            Button(action: { showSettings = true }) {
                                Image(systemName: "gear")
                                    .font(.title3)
                            }
                        }
                    }
                } else {
                    VStack(spacing: 24) {
                        Spacer()
                        
                        Image(systemName: "fork.knife")
                            .font(.system(size: 80))
                            .foregroundColor(.secondary)
                        
                        Text("Foodie Kitchen")
                            .font(.largeTitle)
                            .bold()
                        
                        Text(connectionStatusMessage)
                            .font(.body)
                            .foregroundColor(.secondary)
                            .multilineTextAlignment(.center)
                            .padding(.horizontal)
                        
                        if !connection.isConnected {
                            Button("Settings") {
                                showSettings = true
                            }
                            .buttonStyle(.borderedProminent)
                            .controlSize(.large)
                        } else if !recipeStore.availableMealSlots.isEmpty || !recipeStore.availableRecipes.isEmpty {
                            Button("View Today's Meals") {
                                showRecipeList = true
                            }
                            .buttonStyle(.borderedProminent)
                            .controlSize(.large)
                        }
                        
                        Spacer()
                    }
                    .padding()
                }
            }
            .navigationBarTitleDisplayMode(.inline)
        }
        .navigationViewStyle(StackNavigationViewStyle())
        .sheet(isPresented: $showSettings) {
            SettingsView()
        }
        .sheet(isPresented: $showRecipeList) {
            RecipeListView()
        }
        .onChange(of: recipeStore.shouldShowMealList) { oldValue, newValue in
            if newValue {
                showRecipeList = true
                recipeStore.shouldShowMealList = false  // Reset trigger
            }
        }
    }
    
    private var connectionStatusMessage: String {
        if connection.isConnected {
            let totalMeals = recipeStore.availableMealSlots.count + recipeStore.availableRecipes.count
            if totalMeals == 0 {
                return "Connected! Send a recipe from your Mac to start cooking."
            } else {
                return "Connected! \(totalMeals) meal(s) available."
            }
        } else {
            return "Not connected. Configure server address in settings."
        }
    }
}

struct RecipeListView: View {
    @EnvironmentObject var recipeStore: RecipeStore
    @Environment(\.dismiss) var dismiss
    
    @State private var expandedSlots: Set<String> = []
    
    var body: some View {
        NavigationView {
            List {
                // Show meal slots if available (new format)
                if !recipeStore.availableMealSlots.isEmpty {
                    ForEach(recipeStore.availableMealSlots) { mealSlot in
                        Section(header: Text(mealSlot.slot.capitalized)
                            .font(.headline)
                            .foregroundColor(.primary)) {
                            
                            // Main dish button
                            Button(action: {
                                recipeStore.loadRecipeById(mealSlot.recipeId)
                                dismiss()
                            }) {
                                HStack {
                                    VStack(alignment: .leading, spacing: 4) {
                                        Text(mealSlot.title)
                                            .font(.headline)
                                            .foregroundColor(.primary)
                                        Text("Main Dish")
                                            .font(.caption)
                                            .foregroundColor(.secondary)
                                        
                                        // PHASE 4.5.7: Show meal assignments
                                        if !mealSlot.assignedUsers.isEmpty {
                                            HStack(spacing: 4) {
                                                Text("For:")
                                                    .font(.caption)
                                                    .foregroundColor(.secondary)
                                                
                                                ForEach(mealSlot.assignedUsers) { user in
                                                    Text(user.avatarEmoji)
                                                        .font(.caption)
                                                }
                                                
                                                Text(mealSlot.assignedUsers.map { $0.name }.joined(separator: ", "))
                                                    .font(.caption)
                                                    .foregroundColor(.blue)
                                            }
                                            .padding(.top, 2)
                                        }
                                    }
                                    Spacer()
                                    Image(systemName: "chevron.right")
                                        .foregroundColor(.secondary)
                                }
                            }
                            
                            // Additional items with DisclosureGroup
                            if !mealSlot.additionalItems.isEmpty {
                                DisclosureGroup(
                                    isExpanded: Binding(
                                        get: { expandedSlots.contains(mealSlot.id) },
                                        set: { isExpanded in
                                            if isExpanded {
                                                expandedSlots.insert(mealSlot.id)
                                            } else {
                                                expandedSlots.remove(mealSlot.id)
                                            }
                                        }
                                    )
                                ) {
                                    ForEach(mealSlot.additionalItems) { item in
                                        Button(action: {
                                            recipeStore.loadRecipeById(item.recipeId)
                                            dismiss()
                                        }) {
                                            HStack {
                                                VStack(alignment: .leading, spacing: 4) {
                                                    Text(item.title)
                                                        .font(.subheadline)
                                                        .foregroundColor(.primary)
                                                    Text(item.itemType.capitalized)
                                                        .font(.caption)
                                                        .foregroundColor(.blue)
                                                }
                                                Spacer()
                                                Image(systemName: "chevron.right")
                                                    .font(.caption)
                                                    .foregroundColor(.secondary)
                                            }
                                        }
                                        .padding(.leading, 16)
                                    }
                                } label: {
                                    Text("+ \(mealSlot.additionalItems.count) additional item(s)")
                                        .font(.caption)
                                        .foregroundColor(.secondary)
                                }
                            }
                        }
                    }
                }
                // Fallback to old format
                else if !recipeStore.availableRecipes.isEmpty {
                    ForEach(recipeStore.availableRecipes) { recipe in
                        Button(action: {
                            recipeStore.setCurrentRecipe(recipe)
                            dismiss()
                        }) {
                            VStack(alignment: .leading, spacing: 4) {
                                Text(recipe.title)
                                    .font(.headline)
                                
                                HStack {
                                    Text(recipe.mealType)
                                        .font(.caption)
                                        .foregroundColor(.secondary)
                                    
                                    if !recipe.cuisine.isEmpty {
                                        Text("•")
                                            .foregroundColor(.secondary)
                                        Text(recipe.cuisine)
                                            .font(.caption)
                                            .foregroundColor(.secondary)
                                    }
                                }
                            }
                            .padding(.vertical, 4)
                        }
                    }
                }
            }
            .navigationTitle("Today's Meals")
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button("Done") { dismiss() }
                }
            }
        }
    }
}
