import SwiftUI

// MARK: - Recipe Image View (Async Loading)

struct RecipeImageView: View {
    let url: URL?
    let size: CGFloat
    
    var body: some View {
        if let url = url {
            AsyncImage(url: url) { phase in
                switch phase {
                case .empty:
                    ProgressView()
                        .frame(width: size, height: size)
                case .success(let image):
                    image
                        .resizable()
                        .aspectRatio(contentMode: .fill)
                        .frame(width: size, height: size)
                        .clipped()
                        .cornerRadius(8)
                case .failure:
                    RecipePlaceholderImage(size: size)
                @unknown default:
                    RecipePlaceholderImage(size: size)
                }
            }
        } else {
            RecipePlaceholderImage(size: size)
        }
    }
}

struct RecipePlaceholderImage: View {
    let size: CGFloat
    
    var body: some View {
        ZStack {
            RoundedRectangle(cornerRadius: 8)
                .fill(Color.gray.opacity(0.2))
            Image(systemName: "fork.knife")
                .font(.system(size: size * 0.4))
                .foregroundColor(.gray)
        }
        .frame(width: size, height: size)
    }
}

// MARK: - Content View

struct ContentView: View {
    @EnvironmentObject var connection: ConnectionManager
    @EnvironmentObject var recipeStore: RecipeStore
    @EnvironmentObject var timerManager: TimerManager
    @EnvironmentObject var voiceCommand: VoiceCommandManager
    
    @State private var showSettings = false
    @State private var showRecipeList = false
    @State private var showCookMode = false
    
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
                                .background(Color.blue.opacity(0.1))
                                .foregroundColor(.blue)
                                .cornerRadius(8)
                            }
                        }
                        
                        ToolbarItem(placement: .principal) {
                            Button(action: { showCookMode = true }) {
                                HStack(spacing: 8) {
                                    Image(systemName: "hand.raised.fill")
                                    Text("Start Cooking")
                                        .bold()
                                }
                                .padding(.horizontal, 16)
                                .padding(.vertical, 8)
                                .background(Color.blue)
                                .foregroundColor(.white)
                                .cornerRadius(20)
                                .shadow(radius: 4)
                            }
                        }
                        
                        ToolbarItem(placement: .navigationBarTrailing) {
                            HStack(spacing: 16) {
                                Button(action: { showRecipeList = true }) {
                                    Label("Meals", systemImage: "calendar")
                                }
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
                             Text("Waiting for connection...")
                                .font(.caption)
                                .foregroundColor(.secondary)
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
        .fullScreenCover(isPresented: $showCookMode) {
            CookModeView()
        }
        .fullScreenCover(isPresented: $connection.requiresPairing) {
            PairingView(connectionManager: connection)
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
            return "Waiting for connection..."
        }
    }
}

struct RecipeListView: View {
    @EnvironmentObject var recipeStore: RecipeStore
    @Environment(\.dismiss) var dismiss
    
    @State private var expandedSlots: Set<String> = []
    @State private var showClearConfirmation = false
    
    var body: some View {
        NavigationView {
            List {
                // Show meal slots if available (new format)
                if !recipeStore.availableMealSlots.isEmpty {
                    ForEach(recipeStore.availableMealSlots) { mealSlot in
                        Section(header: Text(mealSlot.slot.capitalized)
                            .font(.headline)
                            .foregroundColor(.primary)) {
                            
                            // Main dish button with image
                            Button(action: {
                                if let recipe = mealSlot.recipe {
                                    recipeStore.setCurrentRecipe(recipe)
                                } else {
                                    recipeStore.loadRecipeById(mealSlot.recipeId)
                                }
                                dismiss()
                            }) {
                                HStack(spacing: 12) {
                                    RecipeImageView(url: mealSlot.imageURL, size: 60)
                                    
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
                            HStack(spacing: 12) {
                                RecipeImageView(url: recipe.imageURL, size: 60)
                                
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
                                
                                Spacer()
                                
                                Image(systemName: "chevron.right")
                                    .foregroundColor(.secondary)
                            }
                            .padding(.vertical, 4)
                        }
                    }
                }
            }
            .navigationTitle("Today's Meals")
            .toolbar {
                ToolbarItem(placement: .navigationBarLeading) {
                    if hasMeals {
                        Button(role: .destructive, action: {
                            showClearConfirmation = true
                        }) {
                            Label("Clear All", systemImage: "trash")
                                .foregroundColor(.red)
                        }
                    }
                }
                
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button("Done") { dismiss() }
                }
            }
            .confirmationDialog(
                "Clear Today's Meals?",
                isPresented: $showClearConfirmation,
                titleVisibility: .visible
            ) {
                Button("Clear All Meals", role: .destructive) {
                    clearAllMeals()
                }
                Button("Cancel", role: .cancel) {}
            } message: {
                Text("This will remove all of today's meals from the iPad. You can reload them from the desktop app.")
            }
        }
    }
    
    private var hasMeals: Bool {
        !recipeStore.availableMealSlots.isEmpty || !recipeStore.availableRecipes.isEmpty
    }
    
    private func clearAllMeals() {
        recipeStore.availableMealSlots.removeAll()
        recipeStore.availableRecipes.removeAll()
        recipeStore.currentRecipe = nil
        recipeStore.currentInstructionStep = 0
        dismiss()
    }
}
