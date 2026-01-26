# iPad Companion App Implementation - Phase 5-6 Complete

## Summary

Successfully updated the iPad app to support additional items (sides, desserts, appetizers, beverages) with expandable DisclosureGroups.

---

## ✅ Phase 5: Backend WebSocket Data Format

### Desktop Already Sending Correct Format

The desktop (`src/main/main.js` lines 237-295) already sends the correct data structure:

```javascript
{
  type: 'meal_plan',
  date: '2026-01-19',
  data: [
    {
      slot: 'breakfast',
      recipeId: 'recipe-123',
      title: 'Pancakes',
      additionalItems: [
        { recipeId: 'recipe-456', title: 'Fruit Salad', itemType: 'side' },
        { recipeId: 'recipe-789', title: 'Coffee', itemType: 'beverage' }
      ]
    },
    ...
  ]
}
```

✅ **No backend changes needed** - Desktop is ready!

---

## ✅ Phase 6: iPad Data Models & Services

### Files Modified:

#### 1. **ios-apps/FoodieKitchen/Models/Recipe.swift**

**Added:**
- `MealSlot` struct with `slot`, `recipeId`, `title`, and `additionalItems`
- `AdditionalItem` struct with `recipeId`, `title`, and `itemType`
- Both structs conform to `Identifiable`, `Codable`, `Equatable`
- Proper initializers from `[String: Any]` dictionaries

#### 2. **ios-apps/FoodieKitchen/Services/RecipeStore.swift**

**Added:**
- `@Published var availableMealSlots: [MealSlot]` - New property for meal slots
- `setAvailableMealSlots(_ slots: [MealSlot])` - Store meal slots
- `loadRecipeById(_ recipeId: String)` - Load recipe from desktop by ID
- `connection: ConnectionManager?` - Weak reference for loading recipes
- Local storage for meal slots

**Keeps:**
- Backwards compatible with `availableRecipes` for old todays_meals format

#### 3. **ios-apps/FoodieKitchen/Services/ConnectionManager.swift**

**Added:**
- Handler for `meal_plan` message type
- Parses meal slots and calls `recipeStore?.setAvailableMealSlots(mealSlots)`
- Console logging for debugging

**Keeps:**
- Handler for old `todays_meals` format (backwards compatible)

---

## 🎨 Phase 6.5: UI Updates Needed

### Next Step: Update ContentView.swift

The RecipeListView needs to be updated to show DisclosureGroups. Here's the implementation:

```swift
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
```

---

## 🔄 How It Works

### Data Flow:

1. **Desktop sends meal plan:**
   ```
   Desktop → WebSocket → iPad ConnectionManager
   ```

2. **ConnectionManager parses data:**
   ```swift
   case "meal_plan":
     let mealSlots = dataArray.compactMap { MealSlot(from: $0) }
     recipeStore?.setAvailableMealSlots(mealSlots)
   ```

3. **RecipeStore stores & persists:**
   ```swift
   @Published var availableMealSlots: [MealSlot] = []
   // Saved to UserDefaults for persistence
   ```

4. **UI displays with DisclosureGroups:**
   ```swift
   ForEach(recipeStore.availableMealSlots) { mealSlot in
     // Main dish button
     // DisclosureGroup for additional items
   }
   ```

5. **User taps item:**
   ```swift
   recipeStore.loadRecipeById(recipeId)
   // Sends message to desktop to load full recipe
   ```

---

## 📱 UI Features

### Main Dish Display
- Shows meal slot name (Breakfast, Lunch, Dinner)
- Main dish title in headline font
- "Main Dish" label in caption
- Chevron icon for navigation

### DisclosureGroup for Additional Items
- Collapsed by default
- Shows "+ X additional item(s)"
- Expands to show list of sides/desserts/etc.
- Each item shows:
  - Title
  - Item type badge (Side, Dessert, Appetizer, Beverage)
  - Tap to load full recipe

### State Management
- `expandedSlots: Set<String>` tracks which meals are expanded
- Persists across view reloads (if needed)

---

## 🧪 Testing Checklist

### Backend (Already Works ✅)
- [x] Desktop sends `meal_plan` messages
- [x] Additional items included in data
- [x] WebSocket connection stable

### iPad Models & Services ✅
- [x] `MealSlot` struct parses correctly
- [x] `AdditionalItem` struct parses correctly
- [x] `RecipeStore` stores meal slots
- [x] `ConnectionManager` handles `meal_plan` type

### iPad UI (Needs Manual Testing)
- [ ] Update ContentView.swift with new RecipeListView
- [ ] Test DisclosureGroups expand/collapse
- [ ] Test tapping main dish loads recipe
- [ ] Test tapping additional item loads recipe
- [ ] Test with 0, 1, and multiple additional items
- [ ] Test backwards compatibility with old format

---

## 🚀 Next Steps

### Immediate:
1. Update `ContentView.swift` with the new RecipeListView code above
2. Wire up `RecipeStore.connection` reference in FoodieKitchenApp.swift
3. Handle `load_recipe` message type on desktop (if not already)
4. Test end-to-end with desktop + iPad

### Phase 7: Voice Commands (Future)
- Add voice commands for "show dessert", "show side dish"
- Implement "Foodie" keyword activation
- Add timer voice commands

---

## 📄 Files Changed

1. ✅ `ios-apps/FoodieKitchen/Models/Recipe.swift`
2. ✅ `ios-apps/FoodieKitchen/Services/RecipeStore.swift`
3. ✅ `ios-apps/FoodieKitchen/Services/ConnectionManager.swift`
4. ⏳ `ios-apps/FoodieKitchen/Views/ContentView.swift` (need to apply code above)
5. ⏳ `ios-apps/FoodieKitchen/FoodieKitchenApp.swift` (wire up connection reference)

---

## 💡 Key Design Decisions

1. **Backwards Compatible:** Old `todays_meals` format still works
2. **Lazy Loading:** Recipes loaded on-demand when user taps
3. **Persistent:** Meal slots saved to UserDefaults
4. **Expandable:** DisclosureGroups provide clean UI for 0-many additional items
5. **Type-Safe:** Strongly typed Swift structs with proper Codable support

---

Generated: 2026-01-19  
Status: ✅ Models & Services Complete, 🎨 UI Update Needed
