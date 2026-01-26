# Phase 1.3: Undo/Redo System Implementation Plan

## Objective
Implement a comprehensive undo/redo system for critical user actions to prevent accidental data loss and improve confidence.

## Architecture

### Core Components

1. **Undo Stack** - Array of action objects
2. **Redo Stack** - Array of undone actions
3. **Action Types** - Standardized action format
4. **Restore Functions** - Action-specific restore logic

### Action Object Structure
```javascript
{
  type: 'delete_recipe' | 'delete_meal' | 'clear_range' | 'edit_recipe' | 'edit_meal',
  timestamp: Date,
  data: {
    // Action-specific state data
  },
  description: 'Human-readable action description'
}
```

## Critical Actions to Support

### High Priority (Destructive Actions)
1. **Delete Recipe** - Store full recipe + ingredients before deletion
2. **Delete Meal** - Store meal plan entry before deletion
3. **Clear Meal Range** - Store all meals in date range before clearing
4. **Delete Additional Item** - Store additional item before removal

### Medium Priority (Edit Actions)
5. **Edit Recipe** - Store previous recipe state
6. **Edit Meal** - Store previous meal assignment

## Implementation Strategy

### 1. Global Undo State
```javascript
const UNDO = {
  stack: [],        // Array of actions (max 50)
  redoStack: [],    // Array of undone actions
  maxSize: 50       // Limit stack size
};
```

### 2. Core Functions

#### Add Action to Undo Stack
```javascript
function pushUndo(type, data, description) {
  UNDO.stack.push({ type, data, description, timestamp: new Date() });
  if (UNDO.stack.length > UNDO.maxSize) {
    UNDO.stack.shift(); // Remove oldest
  }
  UNDO.redoStack = []; // Clear redo stack
  updateUndoUI();
}
```

#### Undo Last Action
```javascript
async function undo() {
  if (UNDO.stack.length === 0) return;
  const action = UNDO.stack.pop();
  
  // Perform undo based on action type
  await restoreAction(action);
  
  // Move to redo stack
  UNDO.redoStack.push(action);
  updateUndoUI();
  
  showToast(`Undone: ${action.description}`, 'info');
}
```

#### Redo Last Undone Action
```javascript
async function redo() {
  if (UNDO.redoStack.length === 0) return;
  const action = UNDO.redoStack.pop();
  
  // Re-apply the action
  await reapplyAction(action);
  
  // Move back to undo stack
  UNDO.stack.push(action);
  updateUndoUI();
  
  showToast(`Redone: ${action.description}`, 'success');
}
```

### 3. Restore Functions

#### Restore Deleted Recipe
```javascript
async function restoreDeletedRecipe(data) {
  const { recipe, ingredients } = data;
  await api('upsertRecipeWithIngredients', { recipe, items: ingredients });
  await resetAndLoadRecipes();
}
```

#### Restore Deleted Meal
```javascript
async function restoreDeletedMeal(data) {
  const { date, slot, meal } = data;
  await api('upsertPlanMeal', { date, slot, meal });
  await loadPlansIntoUi(PLAN.start, PLAN.days);
}
```

#### Restore Cleared Range
```javascript
async function restoreClearedRange(data) {
  const { meals } = data; // Array of { date, slot, meal }
  for (const entry of meals) {
    await api('upsertPlanMeal', entry);
  }
  await loadPlansIntoUi(PLAN.start, PLAN.days);
}
```

## UI Integration

### 1. Keyboard Shortcuts
- **Cmd/Ctrl + Z** - Undo
- **Cmd/Ctrl + Shift + Z** - Redo

### 2. Toast Integration
Add "Undo" button to destructive action toasts:
```javascript
showToast('Recipe deleted', 'warning', 5000, {
  action: {
    text: 'Undo',
    onClick: () => undo()
  }
});
```

### 3. Optional: Undo/Redo Buttons
Add buttons to toolbar (Phase 2 enhancement)

## Modified Functions

### deleteRecipeUi()
```javascript
async function deleteRecipeUi() {
  // Capture state BEFORE deletion
  const recipeRes = await api('getRecipe', { recipeId: CURRENT_RECIPE_ID });
  const ingredientsRes = await api('listRecipeIngredients', { recipeId: CURRENT_RECIPE_ID });
  
  // Perform deletion
  const res = await api('deleteRecipeCascade', { recipeId: CURRENT_RECIPE_ID });
  
  if (res.ok) {
    // Push to undo stack
    pushUndo('delete_recipe', {
      recipe: recipeRes.recipe,
      ingredients: ingredientsRes.items
    }, `Delete recipe: ${recipeRes.recipe.Title}`);
  }
}
```

### Clear Meal Range
```javascript
async function clearMealRange() {
  // Capture ALL meals in range BEFORE clearing
  const meals = [];
  for (const dateKey in PLAN.plansByDate) {
    const plan = PLAN.plansByDate[dateKey];
    for (const slot of ['Breakfast', 'Lunch', 'Dinner']) {
      if (plan[slot]) {
        meals.push({ date: dateKey, slot, meal: plan[slot] });
      }
    }
  }
  
  // Perform clear
  const res = await api('clearMealsByRange', { start, end });
  
  if (res.ok) {
    pushUndo('clear_range', { meals }, `Clear ${meals.length} meals`);
  }
}
```

## Storage Strategy

### Memory Only (Phase 1)
- Keep undo stack in memory (lost on page reload)
- Acceptable for MVP - most undo actions happen immediately

### LocalStorage (Phase 2 - Future)
- Persist undo stack to localStorage
- Restore on page load
- Add size limits and expiration

## Testing Checklist

- [ ] Delete recipe → Undo → Recipe restored with ingredients
- [ ] Delete meal → Undo → Meal restored
- [ ] Clear range → Undo → All meals restored
- [ ] Cmd+Z triggers undo
- [ ] Cmd+Shift+Z triggers redo
- [ ] Undo stack limited to 50 items
- [ ] Redo stack clears after new action
- [ ] Toast shows undo confirmation
- [ ] Multiple undo/redo operations work in sequence

## Notes

- Start with 3 critical actions (delete recipe, delete meal, clear range)
- Keep implementation simple and focused
- Avoid undo for non-destructive actions (they add noise)
- Consider adding "Undo" button to confirmation toasts
- Future: Add undo for pantry operations, ingredient edits
