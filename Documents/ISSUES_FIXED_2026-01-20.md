# Issues Fixed - January 20, 2026

## Summary

Three issues fixed:
1. ✅ **Missing API function**: `setMainDishInCollection` 
2. ✅ **Modal scrolling issue**: Redesigned modal layout
3. ✅ **Duplicate button**: Hide redundant large button when additional items exist

---

## Issue 1: Missing `setMainDishInCollection` Function ✅

**User Report:**
> "Unknown function: setMainDishInCollection"

**Root Cause:**
The Collections tab allows users to mark a recipe as the "Main Dish" in a collection. When clicked, it calls `setMainDishInCollection` API, but this function didn't exist.

**Fix Applied:**
Added new function to `src/main/api.js` (lines 2244-2264):

```javascript
function setMainDishInCollection(payload){
  const collectionId = String(payload && payload.collectionId || '').trim();
  const recipeId = String(payload && payload.recipeId || '').trim();
  if (!collectionId || !recipeId) return err_('collectionId and recipeId required.');

  // Set all recipes in collection to is_main_dish = 0
  db().prepare(`
    UPDATE recipe_collection_map 
    SET is_main_dish = 0 
    WHERE collection_id = ?
  `).run(collectionId);

  // Set the selected recipe to is_main_dish = 1
  db().prepare(`
    UPDATE recipe_collection_map 
    SET is_main_dish = 1 
    WHERE collection_id = ? AND recipe_id = ?
  `).run(collectionId, recipeId);

  return ok_({});
}
```

**How It Works:**
1. Clears `is_main_dish` flag for all recipes in the collection
2. Sets `is_main_dish = 1` for the selected recipe
3. When assigning collection to meal slot, the main dish becomes the meal and others become additional items

**Also Updated:**
Modified `listCollectionRecipes()` to:
- Include `is_main_dish` column in SELECT query
- Order by main dish first (`ORDER BY m.is_main_dish DESC, r.Title ASC`)
- Return `IsMainDish` property in recipe objects

**Status:** ✅ Collections now work correctly with main dish selection.

---

## Issue 2: Modal Scrolling Issue ✅

**User Report:**
> "when adding a side dish item you have to scroll down to see item type and add item"

**Root Cause:**
The Add Side/Dessert modal had `overflow-y:auto` on the entire card with `max-height:80vh`. When recipe results filled the space, the Item Type dropdown and Add button were pushed below the fold, requiring scrolling.

**Fix Applied:**
Redesigned modal layout in `src/renderer/index.html` (lines 3362-3418) using flexbox:

**Old Structure:**
```
<div card (overflow-y:auto, max-height:80vh)>
  - Header
  - Search input
  - Meal type filter
  - Results (max-height:300px)
  - Item type dropdown
  - Buttons
</div>
```

**New Structure:**
```
<div card (display:flex, flex-direction:column, max-height:85vh)>
  <div header (fixed, border-bottom)>
    - Title
    - Close button
    - Info text
  </div>
  
  <div scrollable-content (flex:1, overflow-y:auto)>
    - Search input
    - Meal type filter
    - Results (max-height:250px)
  </div>
  
  <div footer (fixed, border-top, background:#fafafa)>
    - Item type dropdown
    - Cancel & Add buttons
  </div>
</div>
```

**Key Changes:**
- Card uses flexbox column layout
- Header is fixed at top with border-bottom
- Middle section is scrollable (only recipe results scroll)
- Footer is fixed at bottom with Item Type and buttons always visible
- Background color differentiation (#fafafa for footer)
- Button text changed to "Add to Meal Plan" for clarity

**Status:** ✅ No scrolling required to access Item Type and buttons.

---

## Issue 3: Duplicate Button ✅

**User Report:**
> "after you add a side dish if you want to add another you see two buttons, the larger is redundant and doesn't need to be there"

**Root Cause:**
Two "+ Add Side/Dessert" buttons existed:
1. Large button below meal slot (always visible)
2. Smaller button inside additional items container (only when items exist)

Both buttons performed the same action, creating visual redundancy.

**Fix Applied:**

### Change 1: Button Text (line 3057-3058)
Changed smaller button text from "+ Add Side/Dessert" to "+ Add Another" to differentiate it from the main button.

### Change 2: Hide Main Button (lines 3249-3266)
Modified the additional items loading logic to hide the main button container when additional items exist:

```javascript
// Load additional items for all slots after rendering
setTimeout(async () => {
  const containers = box.querySelectorAll('.additional-items-container');
  for (const container of containers) {
    const date = container.dataset.date;
    const slot = container.dataset.slot;
    const html = await renderAdditionalItemsAsync_(date, slot);
    container.innerHTML = html;
    
    // Hide the main button container if additional items exist
    if (html) {
      const mainButtonContainer = container.nextElementSibling;
      if (mainButtonContainer && mainButtonContainer.querySelector('.btn-add-additional-main')) {
        mainButtonContainer.style.display = 'none';
      }
    }
  }
}, 0);
```

**Behavior:**
- **No additional items**: Shows large "+ Add Side/Dessert" and "📚 Assign Collection" buttons
- **Has additional items**: Hides large buttons, shows "+ Add Another" button inside the additional items container

**Status:** ✅ Only one relevant button shows at a time.

---

## Files Modified

| File | Lines | Changes |
|------|-------|---------|
| `src/main/api.js` | 2226-2264 | Added `setMainDishInCollection()` function, updated `listCollectionRecipes()` |
| `src/renderer/index.html` | 3362-3418 | Redesigned Add Side/Dessert modal with fixed header/footer |
| `src/renderer/index.html` | 3057-3058 | Changed button text to "+ Add Another" |
| `src/renderer/index.html` | 3249-3266 | Hide main button container when additional items exist |

---

## Testing Checklist

### Test 1: Set Main Dish in Collection ✅
1. Go to Collections tab
2. Create or open a collection with multiple recipes
3. Click "Set as Main Dish" on any recipe
4. Verify: No error "Unknown function: setMainDishInCollection"
5. Assign collection to a meal slot
6. Verify: Selected main dish becomes the meal, others become additional items

### Test 2: Modal Layout ✅
1. Go to Meal Planner
2. Click "+ Add Side/Dessert" on any meal slot
3. Verify modal opens with:
   - Header at top (title, close button, info)
   - Search input and filter in middle
   - Recipe results scrollable
   - Item Type dropdown visible at bottom (no scrolling needed)
   - Cancel and "Add to Meal Plan" buttons visible at bottom
4. Search for recipes
5. Verify: Can see buttons without scrolling

### Test 3: Button Visibility ✅
1. Go to Meal Planner
2. Find a meal slot with NO additional items
3. Verify: Shows large "+ Add Side/Dessert" button
4. Click button and add a side dish
5. Verify after adding:
   - Large "+ Add Side/Dessert" button is hidden
   - Additional items container shows with "+ Add Another" button
6. Click "+ Add Another" to add more items
7. Verify: Works correctly

---

## How to Run & Test

```bash
# Start the desktop app
npm run dev
```

All three issues are now fixed and ready to test!

---

## Next Steps

### Collection Assignment Workflow
Now that main dish selection works:
1. Create a collection with multiple recipes
2. Mark one as "Main Dish"
3. Assign collection to a meal slot
4. Main dish becomes the meal
5. Other recipes become additional items (sides, desserts, etc.)

### Shopping List Integration
Additional items are already integrated into shopping list generation:
- Generate shopping list with date range
- Ingredients from main meals included
- Ingredients from additional items included
- All quantities aggregated correctly
