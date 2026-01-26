# Phase 6.2: Selective Export - COMPLETE ✅

**Implementation Date:** January 20, 2026  
**Status:** Complete  
**Estimated Time:** 2 hours | **Actual Time:** ~2 hours

---

## Overview

Implemented selective export functionality allowing users to export recipes, collections, and meal plans to JSON format for data portability and backup purposes.

---

## Features Implemented

### 1. Recipe Selection & Export
- **Checkboxes on recipe cards** - Each recipe in the Recipes tab now has a selection checkbox
- **Export controls bar** - Sticky bar appears when recipes are selected, showing count and actions
- **Select All / Deselect All** - Quick selection controls for bulk operations
- **Export Selected** - Exports chosen recipes to JSON file with ingredients included

**UI Location:** Recipes tab (`src/renderer/index.html` lines 1997-2005)

### 2. Collection Export
- **Export button on collection cards** - Both card and list views have "📥 Export" buttons
- **Full collection export** - Includes all recipes in the collection with complete ingredient data
- **Sanitized filenames** - Collection names are cleaned for file system compatibility

**UI Location:** Collections tab (card view: lines 6510-6512, list view: lines 6537)

### 3. Meal Plan Export
- **Date range export** - Exports meal plans using current planner date range
- **Export button in planner** - Located in Bulk Meal Operations section
- **Status feedback** - Shows export progress and success/failure messages

**UI Location:** Planner tab, Bulk Meal Operations section (lines 1697-1706)

---

## Technical Implementation

### Backend (Electron Main Process)

**File:** `src/main/main.js` (lines 1391-1548)

#### IPC Handlers Added:

1. **`foodie-export-recipes`** (lines 1394-1436)
   - Accepts array of recipe IDs
   - Fetches each recipe with ingredients
   - Shows save dialog with date-stamped filename
   - Exports to structured JSON format

2. **`foodie-export-collection`** (lines 1439-1485)
   - Fetches collection details and all recipes
   - Includes collection metadata (name, description, recipe count)
   - Filename includes sanitized collection name

3. **`foodie-export-meal-plan`** (lines 1488-1546)
   - Exports meal plan for given date range
   - Organized by day with all meals (breakfast, lunch, dinner)
   - Includes all recipes + ingredients for each meal
   - Only includes days with meals (skips empty days)

### Preload Bridge

**File:** `src/main/preload.js` (lines 22-25)

```javascript
exportRecipes: (recipeIds) => ipcRenderer.invoke('foodie-export-recipes', { recipeIds }),
exportCollection: (collectionId) => ipcRenderer.invoke('foodie-export-collection', { collectionId }),
exportMealPlan: (startDate, endDate) => ipcRenderer.invoke('foodie-export-meal-plan', { startDate, endDate }),
```

### Frontend (Renderer Process)

**File:** `src/renderer/index.html`

#### CSS Styles (lines 1487-1554)
- `.recipe-select-checkbox` - Positioned checkbox styling
- `.export-controls` - Sticky bar with gradient background
- `.export-btn` - Primary export button with gradient and hover effects

#### UI Components:

1. **Recipe Export Controls** (lines 1997-2005)
   ```html
   <div class="export-controls" id="recipeExportControls">
     <div class="export-controls-text">
       <span class="export-controls-count" id="selectedRecipeCount">0</span> recipe(s) selected
     </div>
     <button class="ghost mini" id="btnSelectAllRecipes">Select All</button>
     <button class="ghost mini" id="btnDeselectAllRecipes">Deselect All</button>
     <button class="export-btn" id="btnExportSelectedRecipes">📥 Export Selected</button>
   </div>
   ```

2. **Recipe Card Checkboxes** (line 3235)
   ```html
   <input type="checkbox" class="recipe-select-checkbox" data-recipe-id="${recipeId}" />
   ```

3. **Collection Export Buttons**
   - Card view (line 6510-6512)
   - List view (line 6537)

4. **Meal Plan Export Section** (lines 1697-1706)

#### JavaScript Functions (lines 9454-9584):

- `updateRecipeExportControls()` - Updates export bar visibility and count
- `handleRecipeCheckboxChange(e)` - Tracks checkbox state changes
- `selectAllRecipes()` - Selects all visible recipes
- `deselectAllRecipes()` - Clears all selections
- `exportSelectedRecipes()` - Exports selected recipes via IPC
- `exportCollectionHandler(collectionId)` - Exports collection via IPC
- `exportMealPlan()` - Exports meal plan via IPC

#### Event Listeners (lines 9451-9462):

```javascript
document.getElementById('btnSelectAllRecipes').addEventListener('click', selectAllRecipes);
document.getElementById('btnDeselectAllRecipes').addEventListener('click', deselectAllRecipes);
document.getElementById('btnExportSelectedRecipes').addEventListener('click', exportSelectedRecipes);
document.getElementById('recipesList').addEventListener('change', handleRecipeCheckboxChange);
document.getElementById('btnExportMealPlan').addEventListener('click', exportMealPlan);
```

#### Click Handler for Collection Export (lines 3969-3977):
```javascript
const exportCollection = e.target.closest('[data-action="export-collection"]');
if (exportCollection) {
  const collectionId = exportCollection.getAttribute('data-cid');
  if (collectionId) {
    await exportCollectionHandler(collectionId);
  }
  return;
}
```

---

## Export Data Structure

### Recipe Export Format:
```json
{
  "exportDate": "2026-01-20T12:00:00.000Z",
  "version": "1.0",
  "type": "recipes",
  "count": 5,
  "data": [
    {
      "recipe": {
        "RecipeId": "...",
        "Title": "...",
        "URL": "...",
        "Cuisine": "...",
        "MealType": "...",
        "Notes": "...",
        "Instructions": "..."
      },
      "ingredients": [
        {
          "idx": 0,
          "IngredientNorm": "chicken breast",
          "IngredientRaw": "chicken breast",
          "QtyText": "1 lb",
          "QtyNum": 1,
          "Unit": "lb",
          "Category": "Meat",
          "StoreId": "kroger"
        }
      ]
    }
  ]
}
```

### Collection Export Format:
```json
{
  "exportDate": "2026-01-20T12:00:00.000Z",
  "version": "1.0",
  "type": "collection",
  "collection": {
    "CollectionId": "...",
    "Name": "Quick Weeknight Dinners",
    "Description": "Fast and easy meals",
    "RecipeCount": 8
  },
  "recipeCount": 8,
  "data": [ /* same as recipe export */ ]
}
```

### Meal Plan Export Format:
```json
{
  "exportDate": "2026-01-20T12:00:00.000Z",
  "version": "1.0",
  "type": "meal_plan",
  "dateRange": {
    "start": "2026-01-20",
    "end": "2026-01-27"
  },
  "dayCount": 7,
  "data": [
    {
      "date": "2026-01-20",
      "meals": [
        {
          "slot": "Breakfast",
          "recipe": { /* full recipe data */ },
          "ingredients": [ /* all ingredients */ ]
        },
        {
          "slot": "Lunch",
          "recipe": { /* full recipe data */ },
          "ingredients": [ /* all ingredients */ ]
        },
        {
          "slot": "Dinner",
          "recipe": { /* full recipe data */ },
          "ingredients": [ /* all ingredients */ ]
        }
      ]
    }
  ]
}
```

---

## User Workflow

### Export Selected Recipes:
1. Navigate to Recipes tab
2. Check boxes next to desired recipes
3. Click "Export Selected" in the sticky control bar
4. Choose save location in file dialog
5. Toast notification confirms success with file path

### Export Collection:
1. Navigate to Collections tab
2. Find desired collection (card or list view)
3. Click "📥 Export" button
4. Choose save location in file dialog
5. Toast notification confirms success

### Export Meal Plan:
1. Navigate to Planner tab
2. Set desired date range using start/end date pickers
3. Scroll to "Export Meal Plan" section in Bulk Meal Operations
4. Click "Export Current Date Range"
5. Choose save location in file dialog
6. Toast notification confirms success

---

## Files Modified

1. **`src/main/main.js`** - Added 3 IPC handlers (lines 1391-1548)
2. **`src/main/preload.js`** - Exposed export API (lines 22-25)
3. **`src/renderer/index.html`** - Added UI, styles, and logic:
   - CSS styles (lines 1487-1554)
   - Recipe export controls UI (lines 1997-2005)
   - Recipe checkboxes (line 3235)
   - Collection export buttons (lines 6510-6512, 6537)
   - Meal plan export UI (lines 1697-1706)
   - Export functions (lines 9454-9584)
   - Event listeners (lines 9451-9462, 3969-3977)

---

## Testing Checklist

- [x] Recipe selection checkboxes appear on all recipe cards
- [x] Export controls bar appears when recipes selected
- [x] Select All / Deselect All work correctly
- [x] Export Selected recipes creates valid JSON file
- [x] Collection export button visible in both views
- [x] Collection export includes all recipes with ingredients
- [x] Meal plan export uses current date range
- [x] Meal plan export includes all meals and ingredients
- [x] File save dialogs open with appropriate default filenames
- [x] Toast notifications show success/failure messages
- [x] Exported files are valid JSON and parseable

---

## Known Limitations

- Only JSON export format (no PDF/CSV)
- No import functionality (Phase 6.3 future enhancement)
- Large exports (100+ recipes) may take a few seconds
- Filenames are date-stamped but not customizable in UI

---

## Next Steps

**Phase 6.3 Candidates:**
- Import from JSON
- Recipe versioning/history
- Bulk delete/archive

**Phase 3-9 Remaining:**
- Phase 3: Quality of Life (14 hours)
- Phase 4: Visual/UI Polish (4 hours)
- Phase 5: Companion Integration (5 hours)
- Phase 7: Help & Onboarding (5 hours)
- Phase 8: Analytics (9 hours)
- Phase 9: Performance (6 hours)

---

## Summary

Phase 6.2 successfully implements selective export functionality with a clean, user-friendly interface. Users can now export recipes, collections, and meal plans to JSON files for backup, portability, and data analysis purposes. All exports include complete data with ingredients, making them suitable for archival or migration to other systems.

**Total Lines Added:** ~250  
**Total Lines Modified:** ~50  
**Files Touched:** 3  
**Backend Complete:** ✅  
**Frontend Complete:** ✅  
**Documentation Complete:** ✅
