# Serialization Error Fix - Root Cause Analysis

## Problem Identified

The "Error: An object could not be cloned" error was caused by sending raw SQLite database row objects over WebSocket/IPC without proper serialization.

### Root Cause

When calling `handleApiCall({ fn: 'getRecipe' })` or `listRecipeIngredients`, the returned objects contain:
- Raw SQLite metadata
- Potentially circular references
- Non-JSON-serializable data types
- Internal SQLite `Statement` objects

These were being directly spread into JSON messages:
```javascript
// ❌ WRONG - Contains non-serializable SQLite metadata
data: {
  ...recipeResult.recipe,
  ingredients: ingredientsResult.items
}
```

## Solution Implemented

Added explicit serialization functions that extract only the JSON-serializable fields needed:

### New Helper Functions

**`serializeRecipe(recipe)`** - Extracts only these fields:
- RecipeId
- Title
- URL
- Cuisine
- MealType
- Notes
- Instructions
- Image_Name

**`serializeIngredient(ing)`** - Extracts only these fields:
- idx
- IngredientName
- IngredientRaw
- QtyText
- QtyNum
- Unit
- Category
- StoreId

### Functions Updated

All three functions that send recipe objects were updated:

1. **`sendRecipe(deviceId, recipeId)`** - Sends individual recipe to one device
2. **`pushTodaysMealsToTablets()`** - Pushes today's meals with recipes to all iPads
3. **`pushRecipeToTablet(recipeId)`** - Pushes specific recipe to all iPads

Each now uses:
```javascript
const serializedRecipe = this.serializeRecipe(recipeResult.recipe);
const serializedIngredients = items.map(ing => this.serializeIngredient(ing));
```

## Why This Fixes the Error

✅ **Eliminates SQLite metadata** - Only plain JavaScript values (strings, numbers, nulls)
✅ **No circular references** - Simple flat objects
✅ **Guaranteed JSON.stringify() success** - All values are primitives
✅ **Consistent data structure** - Always same fields, never undefined/null propagation

## Testing Steps

After rebuilding the desktop app:

1. **Test Shopping List Send:**
   - Ensure today has a meal plan with recipes
   - Send shopping list to iPhone
   - Should see ingredient list appear without errors

2. **Test Today's Meals Send:**
   - Ensure today has breakfast/lunch/dinner planned
   - Send today's meals to iPad
   - Should see recipes appear without errors
   - iPad UI should stop flashing

3. **Console Verification:**
   - Desktop console should show: `📤 Sent recipe "..." to ipad`
   - No "Error: An object could not be cloned" messages
   - Xcode console (iPad) should show: `📥 Received X recipes for today's meals`

## Files Modified

- `src/main/main.js` - Added serialization helpers and updated 3 send functions
  - Lines 45-75: New serialization helper functions
  - Lines 280-291: Updated `sendRecipe()`
  - Lines 536-537: Updated `pushTodaysMealsToTablets()`
  - Lines 572-584: Updated `pushRecipeToTablet()`

## Next Steps

1. Rebuild desktop app on **wife's laptop**:
   ```bash
   cd ~/Desktop/foodie-meal-planner-desktop
   npm run build
   ```

2. Install the new .dmg on wife's laptop

3. Test shopping list and today's meals send

4. Monitor console for any remaining errors

## Why Previous Fixes Didn't Work

The user correctly rebuilt the app multiple times, but the code itself was sending non-serializable objects. The deployment was correct; the runtime data structure was the problem.

This fix ensures that **regardless of what SQLite returns**, we only send clean, serializable JavaScript objects.
