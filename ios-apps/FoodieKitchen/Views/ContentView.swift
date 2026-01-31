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
            RoundedRectangle(cornerRadius: AppRadius.md)
                .fill(
                    LinearGradient(
                        colors: [AppColors.accent.opacity(0.3), AppColors.cardBg],
                        startPoint: .topLeading,
                        endPoint: .bottomTrailing
                    )
                )
            Image(systemName: "fork.knife")
                .font(.system(size: size * 0.4))
                .foregroundColor(AppColors.accent)
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
                                .background(AppColors.accent)
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
                    // MARK: - Home Screen (No Recipe Selected)
                    VStack(spacing: AppSpacing.xl) {
                        Spacer()
                        
                        // App Icon with gradient
                        ZStack {
                            Circle()
                                .fill(
                                    LinearGradient(
                                        colors: [AppColors.accent.opacity(0.3), AppColors.accent.opacity(0.1)],
                                        startPoint: .topLeading,
                                        endPoint: .bottomTrailing
                                    )
                                )
                                .frame(width: 140, height: 140)
                            
                            Image(systemName: "fork.knife")
                                .font(.system(size: 60))
                                .foregroundColor(AppColors.accent)
                        }
                        
                        Text("Foodie Kitchen")
                            .font(AppTypography.titleLarge)
                            .foregroundColor(AppColors.textPrimary)
                        
                        // Connection status indicator
                        ConnectionStatusView(
                            isConnected: connection.isConnected,
                            isConnecting: connection.isSearching
                        )
                        
                        // Content summary
                        if hasAnyContent {
                            VStack(spacing: AppSpacing.md) {
                                // Stats row
                                HStack(spacing: AppSpacing.xl) {
                                    StatBadge(
                                        icon: "calendar",
                                        count: recipeStore.availableMealSlots.count + recipeStore.availableRecipes.count,
                                        label: "Meals",
                                        color: AppColors.accent
                                    )
                                    StatBadge(
                                        icon: "tray.full",
                                        count: recipeStore.sentRecipes.count,
                                        label: "Sent",
                                        color: AppColors.info
                                    )
                                    StatBadge(
                                        icon: "folder.fill",
                                        count: recipeStore.collections.count,
                                        label: "Collections",
                                        color: AppColors.warning
                                    )
                                }
                                .padding(.top, AppSpacing.md)
                                
                                // Quick action buttons
                                Button(action: { showRecipeList = true }) {
                                    HStack(spacing: AppSpacing.md) {
                                        Image(systemName: "book.fill")
                                        Text("View All Recipes")
                                            .fontWeight(.semibold)
                                    }
                                    .frame(maxWidth: 280)
                                }
                                .buttonStyle(AccentButtonStyle())
                                .padding(.top, AppSpacing.lg)
                            }
                        } else if connection.isConnected {
                            Text("Send a recipe from your Mac to start cooking")
                                .font(AppTypography.bodyMedium)
                                .foregroundColor(AppColors.textMuted)
                                .multilineTextAlignment(.center)
                                .padding(.horizontal, AppSpacing.xl)
                        } else {
                            Text("Connect to your Mac to get started")
                                .font(AppTypography.bodyMedium)
                                .foregroundColor(AppColors.textMuted)
                                .multilineTextAlignment(.center)
                                .padding(.horizontal, AppSpacing.xl)
                        }
                        
                        Spacer()
                        
                        // Settings button at bottom
                        Button(action: { showSettings = true }) {
                            HStack(spacing: AppSpacing.sm) {
                                Image(systemName: "gear")
                                Text("Settings")
                            }
                            .font(AppTypography.bodyMedium)
                            .foregroundColor(AppColors.textMuted)
                        }
                        .padding(.bottom, AppSpacing.xl)
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
            if hasAnyContent {
                var parts: [String] = []
                let mealCount = recipeStore.availableMealSlots.count + recipeStore.availableRecipes.count
                if mealCount > 0 { parts.append("\(mealCount) meal(s)") }
                if recipeStore.sentRecipes.count > 0 { parts.append("\(recipeStore.sentRecipes.count) sent") }
                if recipeStore.collections.count > 0 { parts.append("\(recipeStore.collections.count) collection(s)") }
                return "Connected! " + parts.joined(separator: ", ") + " available."
            } else {
                return "Connected! Send a recipe from your Mac to start cooking."
            }
        } else {
            return "Waiting for connection..."
        }
    }
    
    private var hasAnyContent: Bool {
        !recipeStore.availableMealSlots.isEmpty ||
        !recipeStore.availableRecipes.isEmpty ||
        !recipeStore.sentRecipes.isEmpty ||
        !recipeStore.collections.isEmpty
    }
}

struct RecipeListView: View {
    @EnvironmentObject var recipeStore: RecipeStore
    @Environment(\.dismiss) var dismiss
    
    @State private var selectedTab = 0
    @State private var expandedSlots: Set<String> = []
    @State private var expandedCollections: Set<String> = []
    @State private var showClearConfirmation = false
    @State private var clearTarget: ClearTarget = .meals
    @State private var searchText = ""
    
    enum ClearTarget {
        case meals, sentRecipes, collections
    }
    
    private var mealsCount: Int {
        recipeStore.availableMealSlots.count + recipeStore.availableRecipes.count
    }
    
    var body: some View {
        NavigationView {
            VStack(spacing: 0) {
                // Enhanced segmented picker with badges
                HStack(spacing: AppSpacing.sm) {
                    TabButton(
                        title: "Today",
                        icon: "calendar",
                        count: mealsCount,
                        isSelected: selectedTab == 0,
                        color: AppColors.accent
                    ) { selectedTab = 0 }
                    
                    TabButton(
                        title: "Sent",
                        icon: "tray.full",
                        count: recipeStore.sentRecipes.count,
                        isSelected: selectedTab == 1,
                        color: AppColors.info
                    ) { selectedTab = 1 }
                    
                    TabButton(
                        title: "Collections",
                        icon: "folder.fill",
                        count: recipeStore.collections.count,
                        isSelected: selectedTab == 2,
                        color: AppColors.warning
                    ) { selectedTab = 2 }
                }
                .padding(.horizontal, AppSpacing.lg)
                .padding(.vertical, AppSpacing.md)
                
                // Search bar
                HStack(spacing: AppSpacing.md) {
                    Image(systemName: "magnifyingglass")
                        .foregroundColor(AppColors.textMuted)
                    TextField("Search recipes...", text: $searchText)
                        .textFieldStyle(.plain)
                    if !searchText.isEmpty {
                        Button(action: { searchText = "" }) {
                            Image(systemName: "xmark.circle.fill")
                                .foregroundColor(AppColors.textMuted)
                        }
                    }
                }
                .padding(AppSpacing.md)
                .background(AppColors.glassBg)
                .cornerRadius(AppRadius.md)
                .padding(.horizontal, AppSpacing.lg)
                .padding(.bottom, AppSpacing.md)
                
                switch selectedTab {
                case 0:
                    TodaysMealsSection(expandedSlots: $expandedSlots, searchText: searchText, dismiss: dismiss)
                case 1:
                    SentRecipesSection(searchText: searchText, dismiss: dismiss)
                case 2:
                    CollectionsSection(expandedCollections: $expandedCollections, searchText: searchText, dismiss: dismiss)
                default:
                    EmptyView()
                }
            }
            .navigationTitle(navigationTitle)
            .toolbar {
                ToolbarItem(placement: .navigationBarLeading) {
                    if showClearButton {
                        Button(role: .destructive, action: {
                            clearTarget = currentClearTarget
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
                clearDialogTitle,
                isPresented: $showClearConfirmation,
                titleVisibility: .visible
            ) {
                Button(clearDialogButtonText, role: .destructive) {
                    performClear()
                }
                Button("Cancel", role: .cancel) {}
            } message: {
                Text(clearDialogMessage)
            }
        }
    }
    
    private var navigationTitle: String {
        switch selectedTab {
        case 0: return "Today's Meals"
        case 1: return "Sent Recipes"
        case 2: return "Collections"
        default: return "Recipes"
        }
    }
    
    private var showClearButton: Bool {
        switch selectedTab {
        case 0: return !recipeStore.availableMealSlots.isEmpty || !recipeStore.availableRecipes.isEmpty
        case 1: return !recipeStore.sentRecipes.isEmpty
        case 2: return !recipeStore.collections.isEmpty
        default: return false
        }
    }
    
    private var currentClearTarget: ClearTarget {
        switch selectedTab {
        case 0: return .meals
        case 1: return .sentRecipes
        case 2: return .collections
        default: return .meals
        }
    }
    
    private var clearDialogTitle: String {
        switch clearTarget {
        case .meals: return "Clear Today's Meals?"
        case .sentRecipes: return "Clear Sent Recipes?"
        case .collections: return "Clear Collections?"
        }
    }
    
    private var clearDialogButtonText: String {
        switch clearTarget {
        case .meals: return "Clear All Meals"
        case .sentRecipes: return "Clear Sent Recipes"
        case .collections: return "Clear Collections"
        }
    }
    
    private var clearDialogMessage: String {
        switch clearTarget {
        case .meals: return "This will remove all of today's meals from the iPad."
        case .sentRecipes: return "This will remove all recipes sent to you from the desktop app."
        case .collections: return "This will remove all collections sent from the desktop app."
        }
    }
    
    private func performClear() {
        switch clearTarget {
        case .meals:
            recipeStore.availableMealSlots.removeAll()
            recipeStore.availableRecipes.removeAll()
            recipeStore.currentRecipe = nil
            recipeStore.currentInstructionStep = 0
        case .sentRecipes:
            recipeStore.clearSentRecipes()
        case .collections:
            recipeStore.clearCollections()
        }
    }
}

// MARK: - Today's Meals Section

struct TodaysMealsSection: View {
    @EnvironmentObject var recipeStore: RecipeStore
    @Binding var expandedSlots: Set<String>
    var searchText: String = ""
    var dismiss: DismissAction
    
    private var filteredMealSlots: [MealSlot] {
        if searchText.isEmpty {
            return recipeStore.availableMealSlots
        }
        return recipeStore.availableMealSlots.filter { slot in
            slot.title.localizedCaseInsensitiveContains(searchText) ||
            slot.additionalItems.contains { $0.title.localizedCaseInsensitiveContains(searchText) }
        }
    }
    
    var body: some View {
        if recipeStore.availableMealSlots.isEmpty && recipeStore.availableRecipes.isEmpty {
            EmptyStateView(
                icon: "calendar",
                title: "No Meals Today",
                message: "Send today's meal plan from your Mac to see meals here"
            )
        } else if !searchText.isEmpty && filteredMealSlots.isEmpty {
            EmptyStateView(
                icon: "magnifyingglass",
                title: "No Results",
                message: "No meals match \"\(searchText)\""
            )
        } else {
            List {
                if !filteredMealSlots.isEmpty {
                    ForEach(filteredMealSlots) { mealSlot in
                        Section(header: MealSlotHeader(slot: mealSlot.slot)) {
                            
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
                } else if !recipeStore.availableRecipes.isEmpty {
                    ForEach(recipeStore.availableRecipes) { recipe in
                        Button(action: {
                            recipeStore.setCurrentRecipe(recipe)
                            dismiss()
                        }) {
                            RecipeRowView(recipe: recipe)
                        }
                    }
                }
            }
        }
    }
}

// MARK: - Sent Recipes Section

struct SentRecipesSection: View {
    @EnvironmentObject var recipeStore: RecipeStore
    var searchText: String = ""
    var dismiss: DismissAction
    
    private var filteredRecipes: [Recipe] {
        if searchText.isEmpty {
            return recipeStore.sentRecipes
        }
        return recipeStore.sentRecipes.filter { recipe in
            recipe.title.localizedCaseInsensitiveContains(searchText) ||
            recipe.cuisine.localizedCaseInsensitiveContains(searchText) ||
            recipe.mealType.localizedCaseInsensitiveContains(searchText)
        }
    }
    
    var body: some View {
        if recipeStore.sentRecipes.isEmpty {
            EmptyStateView(
                icon: "tray",
                title: "No Sent Recipes",
                message: "Recipes sent from your Mac will appear here"
            )
        } else if !searchText.isEmpty && filteredRecipes.isEmpty {
            EmptyStateView(
                icon: "magnifyingglass",
                title: "No Results",
                message: "No recipes match \"\(searchText)\""
            )
        } else {
            List {
                ForEach(filteredRecipes) { recipe in
                    Button(action: {
                        recipeStore.setCurrentRecipe(recipe)
                        dismiss()
                    }) {
                        RecipeRowView(recipe: recipe)
                    }
                    .swipeActions(edge: .leading) {
                        Button {
                            recipeStore.setCurrentRecipe(recipe)
                            dismiss()
                        } label: {
                            Label("Cook", systemImage: "flame")
                        }
                        .tint(AppColors.accent)
                    }
                }
                .onDelete { indexSet in
                    indexSet.forEach { idx in
                        let recipe = filteredRecipes[idx]
                        recipeStore.removeSentRecipe(recipe.id)
                    }
                }
            }
        }
    }
}

// MARK: - Collections Section

struct CollectionsSection: View {
    @EnvironmentObject var recipeStore: RecipeStore
    @Binding var expandedCollections: Set<String>
    var searchText: String = ""
    var dismiss: DismissAction
    
    private var filteredCollections: [RecipeCollection] {
        if searchText.isEmpty {
            return recipeStore.collections
        }
        return recipeStore.collections.filter { collection in
            collection.name.localizedCaseInsensitiveContains(searchText) ||
            collection.recipes.contains { $0.title.localizedCaseInsensitiveContains(searchText) }
        }
    }
    
    var body: some View {
        if recipeStore.collections.isEmpty {
            EmptyStateView(
                icon: "folder",
                title: "No Collections",
                message: "Collections sent from your Mac will appear here"
            )
        } else if !searchText.isEmpty && filteredCollections.isEmpty {
            EmptyStateView(
                icon: "magnifyingglass",
                title: "No Results",
                message: "No collections match \"\(searchText)\""
            )
        } else {
            List {
                ForEach(filteredCollections) { collection in
                    DisclosureGroup(
                        isExpanded: Binding(
                            get: { expandedCollections.contains(collection.id) },
                            set: { isExpanded in
                                if isExpanded {
                                    expandedCollections.insert(collection.id)
                                } else {
                                    expandedCollections.remove(collection.id)
                                }
                            }
                        )
                    ) {
                        ForEach(collection.recipes) { recipe in
                            Button(action: {
                                recipeStore.setCurrentRecipe(recipe)
                                dismiss()
                            }) {
                                RecipeRowView(recipe: recipe)
                            }
                            .padding(.leading, AppSpacing.sm)
                            .swipeActions(edge: .leading) {
                                Button {
                                    recipeStore.setCurrentRecipe(recipe)
                                    dismiss()
                                } label: {
                                    Label("Cook", systemImage: "flame")
                                }
                                .tint(AppColors.accent)
                            }
                        }
                    } label: {
                        HStack(spacing: AppSpacing.md) {
                            ZStack {
                                Circle()
                                    .fill(AppColors.warning.opacity(0.15))
                                    .frame(width: 40, height: 40)
                                Image(systemName: "folder.fill")
                                    .foregroundColor(AppColors.warning)
                            }
                            VStack(alignment: .leading, spacing: AppSpacing.xs) {
                                Text(collection.name)
                                    .font(AppTypography.bodyLarge.weight(.semibold))
                                    .foregroundColor(AppColors.textPrimary)
                                Text("\(collection.recipes.count) recipes")
                                    .font(AppTypography.caption)
                                    .foregroundColor(AppColors.textMuted)
                            }
                        }
                    }
                }
                .onDelete { indexSet in
                    indexSet.forEach { idx in
                        let collection = filteredCollections[idx]
                        recipeStore.removeCollection(collection.id)
                    }
                }
            }
        }
    }
}

// MARK: - Reusable Recipe Row

struct RecipeRowView: View {
    let recipe: Recipe
    
    var body: some View {
        HStack(spacing: AppSpacing.md) {
            RecipeImageView(url: recipe.imageURL, size: 60)
            
            VStack(alignment: .leading, spacing: AppSpacing.xs) {
                Text(recipe.title)
                    .font(AppTypography.bodyLarge.weight(.semibold))
                    .foregroundColor(AppColors.textPrimary)
                
                HStack(spacing: AppSpacing.sm) {
                    MealTypeBadge(mealType: recipe.mealType)
                    
                    if !recipe.cuisine.isEmpty {
                        Text(recipe.cuisine)
                            .font(AppTypography.caption)
                            .foregroundColor(AppColors.textMuted)
                    }
                }
            }
            
            Spacer()
            
            Image(systemName: "chevron.right")
                .foregroundColor(AppColors.textMuted)
        }
        .padding(.vertical, AppSpacing.sm)
    }
}

// MARK: - Stat Badge for Home Screen

struct StatBadge: View {
    let icon: String
    let count: Int
    let label: String
    var color: Color = AppColors.accent
    
    var body: some View {
        VStack(spacing: AppSpacing.sm) {
            ZStack {
                Circle()
                    .fill(color.opacity(0.15))
                    .frame(width: 50, height: 50)
                
                Image(systemName: icon)
                    .font(.system(size: 22))
                    .foregroundColor(color)
            }
            
            Text("\(count)")
                .font(AppTypography.titleSmall)
                .foregroundColor(AppColors.textPrimary)
            
            Text(label)
                .font(AppTypography.caption)
                .foregroundColor(AppColors.textMuted)
        }
    }
}

// MARK: - Tab Button for Recipe List

struct TabButton: View {
    let title: String
    let icon: String
    let count: Int
    let isSelected: Bool
    var color: Color = AppColors.accent
    let action: () -> Void
    
    var body: some View {
        Button(action: action) {
            VStack(spacing: AppSpacing.xs) {
                ZStack(alignment: .topTrailing) {
                    Image(systemName: icon)
                        .font(.system(size: 20))
                        .foregroundColor(isSelected ? color : AppColors.textMuted)
                        .frame(width: 32, height: 32)
                    
                    if count > 0 {
                        Text("\(count)")
                            .font(.system(size: 10, weight: .bold))
                            .foregroundColor(.white)
                            .padding(.horizontal, 5)
                            .padding(.vertical, 2)
                            .background(color)
                            .clipShape(Capsule())
                            .offset(x: 8, y: -4)
                    }
                }
                
                Text(title)
                    .font(AppTypography.caption)
                    .foregroundColor(isSelected ? color : AppColors.textMuted)
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, AppSpacing.sm)
            .background(isSelected ? color.opacity(0.1) : Color.clear)
            .cornerRadius(AppRadius.md)
        }
        .buttonStyle(.plain)
    }
}

// MARK: - Meal Slot Header

struct MealSlotHeader: View {
    let slot: String
    
    private var color: Color {
        switch slot.lowercased() {
        case "breakfast": return AppColors.breakfast
        case "lunch": return AppColors.lunch
        case "dinner": return AppColors.dinner
        case "snack": return AppColors.snack
        default: return AppColors.textMuted
        }
    }
    
    private var icon: String {
        switch slot.lowercased() {
        case "breakfast": return "sunrise.fill"
        case "lunch": return "sun.max.fill"
        case "dinner": return "moon.stars.fill"
        case "snack": return "carrot.fill"
        default: return "fork.knife"
        }
    }
    
    var body: some View {
        HStack(spacing: AppSpacing.sm) {
            Image(systemName: icon)
                .foregroundColor(color)
            Text(slot.capitalized)
                .font(AppTypography.bodyLarge.weight(.semibold))
                .foregroundColor(AppColors.textPrimary)
        }
    }
}
