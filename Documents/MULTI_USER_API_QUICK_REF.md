# Multi-User Meal Plans API - Quick Reference

## Frontend Usage Examples

### Get User's Meal Plans

```javascript
// Get current user's meals for a week
const result = await window.api.getUserPlanMeals({
  start: '2025-01-01',
  end: '2025-01-07'
  // userId is optional - defaults to active user
});

if (result.ok) {
  result.plans.forEach(plan => {
    console.log(`Date: ${plan.Date}`);
    
    // Each slot is now an ARRAY of meals
    plan.Breakfast.forEach(meal => {
      console.log(`  Breakfast: ${meal.Title}`);
      console.log(`    User: ${meal.userId}`);
      console.log(`    Fallback: ${meal.IsFallback}`);
    });
  });
}

// Get specific user's meals
const johnsResult = await window.api.getUserPlanMeals({
  userId: 'john-user-id',
  start: '2025-01-01',
  end: '2025-01-07'
});

// Get Whole Family view (all users aggregated)
const wholeFamilyResult = await window.api.getUserPlanMeals({
  userId: 'whole-family-user-id',
  start: '2025-01-01',
  end: '2025-01-07'
});
```

### Create a New Meal

```javascript
// Add a meal for current active user
const result = await window.api.upsertUserPlanMeal({
  userId: activeUserId,
  date: '2025-01-15',
  slot: 'Breakfast',
  meal: {
    RecipeId: 'pancakes-recipe-id',  // or null for custom meal
    Title: 'Pancakes',
    UseLeftovers: 0,
    From: '',
    SortOrder: 0  // order when multiple meals in same slot
  }
});

if (result.ok) {
  console.log(`Created meal with ID: ${result.id}`);
}
```

### Update an Existing Meal

```javascript
// Update meal title
const result = await window.api.upsertUserPlanMeal({
  userId: activeUserId,
  date: '2025-01-15',
  slot: 'Breakfast',
  meal: {
    id: 123,  // Include ID to update instead of create
    RecipeId: 'pancakes-recipe-id',
    Title: 'Blueberry Pancakes',  // Updated title
    UseLeftovers: 0,
    From: '',
    SortOrder: 0
  }
});
```

### Delete a Meal

```javascript
// Delete specific meal by ID
const result = await window.api.deleteUserPlanMeal({
  mealId: 123,
  userId: activeUserId  // optional security check
});

if (result.ok && result.deleted) {
  console.log(`Deleted meal for ${result.meal.date} ${result.meal.slot}`);
  
  // Cleanup calendar events if needed
  if (result.meal.appleEventId) {
    // Delete Apple Calendar event
  }
  if (result.meal.googleEventId) {
    // Delete Google Calendar event
  }
}
```

### Clear All Meals for a Slot

```javascript
// Delete all user meals for a specific date/slot
const result = await window.api.upsertUserPlanMeal({
  userId: activeUserId,
  date: '2025-01-15',
  slot: 'Breakfast',
  meal: null  // null = delete all
});
```

### Generate Shopping List

```javascript
// Shopping list for current active user
const result = await window.api.buildShoppingList({
  start: '2025-01-15',
  end: '2025-01-21'
  // userId optional - defaults to active user
});

// Shopping list for specific user
const johnsResult = await window.api.buildShoppingList({
  userId: 'john-user-id',
  start: '2025-01-15',
  end: '2025-01-21'
});

// Shopping list for whole family (all users)
const familyResult = await window.api.buildShoppingList({
  userId: 'whole-family-user-id',
  start: '2025-01-15',
  end: '2025-01-21'
});
```

## Common Patterns

### Display Meals with User Badges

```javascript
function renderMealSlot(meals, slotName) {
  if (meals.length === 0) {
    return `<div class="empty-slot">${slotName}: No meals planned</div>`;
  }
  
  let html = `<div class="meal-slot"><h3>${slotName}</h3>`;
  
  meals.forEach(meal => {
    const userBadge = meal.IsFallback 
      ? '<span class="fallback-badge">👨‍👩‍👧‍👦 Whole Family</span>'
      : '<span class="user-badge">👤 Personal</span>';
    
    html += `
      <div class="meal-card ${meal.IsFallback ? 'fallback' : ''}">
        ${userBadge}
        <div class="meal-title">${meal.Title}</div>
        <button onclick="editMeal(${meal.id})">Edit</button>
        ${!meal.IsFallback ? `<button onclick="deleteMeal(${meal.id})">Delete</button>` : ''}
      </div>
    `;
  });
  
  html += `<button onclick="addMeal('${slotName}')">+ Add Meal</button></div>`;
  return html;
}
```

### Handle Multiple Meals per Slot

```javascript
// Grid view: show count badge
function renderGridCell(date, slot, meals) {
  if (meals.length === 0) {
    return `<div class="grid-cell empty">${slot.charAt(0)}</div>`;
  }
  
  if (meals.length === 1) {
    return `
      <div class="grid-cell">
        <div class="slot-label">${slot.charAt(0)}</div>
        <div class="meal-title">${meals[0].Title}</div>
      </div>
    `;
  }
  
  // Multiple meals: show count and expandable
  return `
    <div class="grid-cell has-multiple" data-date="${date}" data-slot="${slot}">
      <div class="slot-label">${slot.charAt(0)} (${meals.length})</div>
      <button class="expand-btn" onclick="expandCell('${date}', '${slot}')">▼</button>
    </div>
  `;
}
```

### Add Meal with User Selection

```javascript
async function addMealForUser(date, slot, userId) {
  // Show recipe picker modal
  const recipe = await showRecipePicker();
  
  if (!recipe) return;
  
  const result = await window.api.upsertUserPlanMeal({
    userId: userId,
    date: date,
    slot: slot,
    meal: {
      RecipeId: recipe.RecipeId,
      Title: recipe.Title,
      UseLeftovers: 0,
      From: '',
      SortOrder: 0
    }
  });
  
  if (result.ok) {
    // Sync to calendar
    await syncMealToCalendar(result.id, date, slot, recipe.Title);
    
    // Reload meal planner
    await refreshMealPlanner();
  }
}
```

### Fallback Indicator

```javascript
function getMealDescription(meal) {
  if (meal.IsFallback) {
    return `${meal.Title} (from Whole Family meal plan)`;
  } else {
    return meal.Title;
  }
}
```

## Migration from Old System

### Before (Single Meal per Slot)

```javascript
// Old API
const result = await window.api.getPlansRange({
  start: '2025-01-01',
  end: '2025-01-07'
});

result.plans.forEach(plan => {
  // Breakfast was a single object
  if (plan.Breakfast && plan.Breakfast.Title) {
    console.log(plan.Breakfast.Title);
  }
});
```

### After (Multiple Meals per Slot)

```javascript
// New API
const result = await window.api.getUserPlanMeals({
  start: '2025-01-01',
  end: '2025-01-07'
});

result.plans.forEach(plan => {
  // Breakfast is now an array
  plan.Breakfast.forEach(meal => {
    console.log(meal.Title);
  });
});
```

### Backward Compatible Rendering

```javascript
function renderMeal(slot) {
  // Support both old (object) and new (array) formats
  const meals = Array.isArray(slot) ? slot : (slot && slot.Title ? [slot] : []);
  
  return meals.map(meal => `
    <div class="meal">${meal.Title}</div>
  `).join('');
}
```

## Error Handling

```javascript
async function safeGetUserPlanMeals(userId, start, end) {
  try {
    const result = await window.api.getUserPlanMeals({ userId, start, end });
    
    if (!result.ok) {
      console.error('API error:', result.error);
      
      // Show user-friendly error
      if (result.error.includes('not found')) {
        showToast('User not found', 'error');
      } else if (result.error.includes('table not found')) {
        showToast('Please update the app', 'warning');
      } else {
        showToast('Failed to load meal plans', 'error');
      }
      
      return { ok: true, plans: [], userId, isWholeFamilyView: false };
    }
    
    return result;
  } catch (error) {
    console.error('Unexpected error:', error);
    showToast('Something went wrong', 'error');
    return { ok: true, plans: [], userId, isWholeFamilyView: false };
  }
}
```

## Tips & Best Practices

1. **Always check `result.ok`** before accessing data
2. **Use arrays** even for single meals to future-proof code
3. **Show fallback indicators** so users know which meals are inherited
4. **Allow deleting only non-fallback meals** (user's own meals)
5. **Sync to calendar** after creating/updating meals
6. **Pass userId explicitly** when working with specific users (don't rely on active user state)
7. **Handle empty slots gracefully** - show "Add Meal" button
8. **Use sort_order** when you want custom ordering of multiple meals

## Debugging

### Check Active User

```javascript
const user = await window.api.getActiveUser();
console.log('Active user:', user.userId, user.name);
```

### Inspect Meal Details

```javascript
const result = await window.api.getUserPlanMeals({
  start: '2025-01-15',
  end: '2025-01-15'
});

console.log('Whole Family view?', result.isWholeFamilyView);
console.log('Returned for user:', result.userId);
console.log('Breakfast meals:', result.plans[0].Breakfast);
```

### Test Database State

```javascript
// Check if new table exists (will auto-fallback to old table if not)
const result = await window.api.getUserPlanMeals({
  start: '2025-01-01',
  end: '2025-01-01'
});

// If it returns old format (single object instead of array), table doesn't exist yet
console.log('Using new table?', Array.isArray(result.plans[0].Breakfast));
```
