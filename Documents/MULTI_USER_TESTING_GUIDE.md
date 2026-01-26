# Multi-User Meal Plans - Quick Start & Testing Guide

## Prerequisites

### 1. Database Setup

The `user_plan_meals` table will be created automatically when you start the app (via `db.js` migrate function).

**To verify table exists**:
```bash
sqlite3 data/foodie.sqlite "SELECT name FROM sqlite_master WHERE type='table' AND name='user_plan_meals';"
```

Should output: `user_plan_meals`

### 2. Check Users Exist

```bash
sqlite3 data/foodie.sqlite "SELECT user_id, name FROM users;"
```

You should see at least "Whole Family" user.

## Testing the New Features

### Test 1: View Existing Meals

1. Start the app
2. Open Meal Planner tab
3. **Expected**: Meals display with arrays per slot (even if empty arrays)
4. **Check console**: Should see logs like:
   ```
   [loadPlansIntoUi] API returned plans: 7
   [loadPlansIntoUi] Whole Family view: true
   Loaded 2025-01-15 Breakfast: 1 meal(s)
     [0] Pancakes (User: whole-family-id, Fallback: false)
   ```

### Test 2: Add a Meal (Creates User Meal)

1. Click **Select** button on any meal slot
2. Search for a recipe
3. Click **Select** on a recipe
4. **Expected**: Meal appears with badge
   - If you're logged in as an individual user: "👤 Personal" badge
   - If you're Whole Family user: No badge or "👨‍👩‍👧‍👦 Whole Family" badge
5. **Check database**:
   ```bash
   sqlite3 data/foodie.sqlite "SELECT id, user_id, date, slot, title FROM user_plan_meals ORDER BY date DESC LIMIT 5;"
   ```

### Test 3: Add Multiple Meals to Same Slot

1. Add a meal to Breakfast (Test 2)
2. Click **+ Add Another Breakfast** button (appears below the meal)
3. Select a different recipe
4. **Expected**:
   - Both meals show with "#1" and "#2" badges
   - First meal has standard styling
   - Second meal has green left border
   - Delete button appears on second meal

### Test 4: Delete a Meal from Multi-Meal Slot

1. Ensure you have 2+ meals in a slot (Test 3)
2. Find the **Delete** button (only on #2, #3, etc. meals)
3. Click **Delete**
4. Confirm deletion
5. **Expected**:
   - Meal disappears
   - Remaining meal stays
   - Meal numbers re-index (if needed)

### Test 5: Fallback Meals (Individual User View)

1. Switch to "Whole Family" user
2. Add a meal to Dinner
3. Switch to an individual user (e.g., "John")
4. Navigate to the same date
5. **Expected**:
   - John sees the Whole Family meal with "👨‍👩‍👧‍👦 Whole Family" badge
   - Gray left border on fallback meal
   - No Delete button (can't delete inherited meals)

### Test 6: Override Fallback Meal

1. Continue from Test 5 (John viewing Whole Family meal)
2. Click **+ Add Another Dinner**
3. Select a different recipe
4. **Expected**:
   - John's personal meal shows with "👤 Personal" badge (#1)
   - Whole Family meal shows with "👨‍👩‍👧‍👦 Whole Family" badge (#2)
   - John's meal can be deleted
   - Whole Family meal cannot be deleted

## Debugging

### Check Console Logs

Open DevTools (Cmd+Option+I) and check Console tab:

```javascript
// Check active user
await window.api.getActiveUser()
// Returns: { ok: true, userId: '...', name: 'John', ... }

// Check meal data
PLAN.plansByDate
// Should show dates with Breakfast/Lunch/Dinner arrays

// Check current user context
PLAN.currentUserId
PLAN.isWholeFamilyView
```

### Inspect Database

```bash
# Check all user meals
sqlite3 data/foodie.sqlite "SELECT id, user_id, date, slot, title, created_at FROM user_plan_meals ORDER BY date DESC, slot;"

# Check specific date
sqlite3 data/foodie.sqlite "SELECT * FROM user_plan_meals WHERE date='2025-01-15';"

# Count meals per user
sqlite3 data/foodie.sqlite "SELECT u.name, COUNT(*) as meal_count FROM user_plan_meals upm JOIN users u ON upm.user_id = u.user_id GROUP BY u.name;"
```

### Common Issues

#### Issue: "No active user set" error

**Cause**: Active user not set in session

**Fix**:
```javascript
// In DevTools console
const users = await window.api.listUsers();
console.log(users);
// Pick a user ID
await window.api.setActiveUser({ userId: 'whole-family-user-id' });
```

#### Issue: Meals not showing

**Cause**: Table doesn't exist or API fallback to old system

**Check**:
```javascript
// In DevTools console
const result = await window.api.getUserPlanMeals({ start: '2025-01-01', end: '2025-01-31' });
console.log(result);
// Check if plans have arrays: result.plans[0].Breakfast should be []
```

If `Breakfast` is an object (not array), the API fell back to old system.

#### Issue: Delete button doesn't appear

**Check**:
1. Is it a fallback meal? (can't delete inherited meals)
2. Is it the only meal in the slot? (can't delete last meal - use Select to replace)
3. Does the meal have an ID? (might not be saved yet)

## API Testing in Console

```javascript
// Get active user
await window.api.getActiveUser()

// Get meal plans for current user
await window.api.getUserPlanMeals({ start: '2025-01-15', end: '2025-01-21' })

// Get meal plans for specific user
await window.api.getUserPlanMeals({ userId: 'user-id-here', start: '2025-01-15', end: '2025-01-21' })

// Add a meal
await window.api.upsertUserPlanMeal({
  userId: 'user-id-here',
  date: '2025-01-15',
  slot: 'Breakfast',
  meal: {
    RecipeId: 'recipe-id-here',
    Title: 'Test Meal',
    UseLeftovers: 0,
    From: '',
    SortOrder: 0
  }
})

// Delete a meal
await window.api.deleteUserPlanMeal({ mealId: 123 })

// Generate shopping list
await window.api.buildShoppingList({ start: '2025-01-15', end: '2025-01-21' })
```

## Visual Verification

### Single Meal (Personal)
```
┌────────────────────────────────────────────┐
│ Breakfast:  👤 Personal  Pancakes          │
│ [Select] [View] [Edit] [Print] [Use leftovers]  │
└────────────────────────────────────────────┘
```

### Multiple Meals
```
┌────────────────────────────────────────────┐
│ Breakfast:  #1  👤 Personal  Pancakes      │
│ ┃ [Select] [View] [Edit] [Print] [Use leftovers]  │
├────────────────────────────────────────────┤
│            #2  👤 Personal  Oatmeal       │
│ ┃ [Select] [View] [Edit] [Print] [Use leftovers] [Delete] │
├────────────────────────────────────────────┤
│ [+ Add Another Breakfast]                  │
└────────────────────────────────────────────┘
```

### Fallback Meal (Inherited)
```
┌────────────────────────────────────────────┐
│ Breakfast:  👨‍👩‍👧‍👦 Whole Family  Pancakes  │
│ ┃ [Select] [View] [Edit] [Print] [Use leftovers]  │
│ ┃ (No Delete button - inherited meal)       │
└────────────────────────────────────────────┘
```

## Next Steps After Testing

1. If basic meal adding/viewing works → proceed with remaining API updates
2. If issues found → check console logs and database
3. Run migration script to convert existing data:
   ```bash
   node scripts/migrate-user-meal-plans.js
   ```

## Support

For issues, check:
1. Console logs in DevTools
2. Database state with SQLite queries above
3. Implementation docs:
   - `PHASE_4_5_7_API_IMPLEMENTATION.md`
   - `PHASE_2_FRONTEND_IMPLEMENTATION.md`
   - `MULTI_USER_API_QUICK_REF.md`
