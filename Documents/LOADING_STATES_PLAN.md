# Phase 1.2: Loading States Implementation Plan

## Functions Updated So Far
1. ✅ `setLoading()` - Enhanced with `loadingText` parameter
2. ✅ `saveRecipeAndIngredients()` - Added loading state with try/finally

## Next Priority Functions to Update

### High Priority (User-facing, 1+ second operations)
1. `buildShop()` - Shopping list generation (multiple API calls)
2. `syncToGoogleCalendar()` - Google Calendar sync
3. `loadPlan()` / `loadPlansIntoUi()` - Meal plan loading
4. `resetAndLoadRecipes()` - Recipe list refresh
5. `categorizeAllIngredients()` - Bulk categorization
6. `btnCopyWeekForward/Back` event handlers
7. `btnAutoFillBreakfast` event handler
8. `btnFixCategories` event handler

### Medium Priority (Common operations)
9. `deleteRecipeUi()` - Recipe deletion
10. `clearMealsByRange` - Bulk meal deletion
11. Collection assignment modals
12. Export/Import operations

## Implementation Strategy

For each function:
1. Identify the button element (if exists)
2. Wrap async operation in try/finally
3. Call `setLoading(button, true, 'ActionText...')` at start
4. Call `setLoading(button, false)` in finally block
5. Keep existing status text updates

## Notes
- Some functions are called from multiple places (buildShop, loadPlan)
- For functions without direct button reference, use event delegation
- Maintain existing error handling
- Don't break existing functionality
