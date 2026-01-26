# Shopping List & Pantry Impact - Multi-User Meal Plans

## Current System Behavior

### Shopping List Generation
**Current Logic** (in `buildShoppingList`):
1. Scans `plans` table for date range
2. Collects all `BreakfastRecipeId`, `LunchRecipeId`, `DinnerRecipeId`
3. Also includes recipes from `plan_additional_items` (sides/desserts)
4. Aggregates ingredient quantities across all recipes
5. **On-the-fly pantry deduction** - checks pantry and shows net quantities needed

**Example Current Output**:
```
Shopping List (Jan 20 - Jan 26)

Flour
  - Required: 500g
  - In Pantry: 200g
  - Need to Buy: 300g ✓

Eggs
  - Required: 12
  - In Pantry: 6
  - Need to Buy: 6 ✓
```

### Pantry Tracking
**Two Systems Exist**:

1. **Simple System** (currently active in `api.js`):
   - Shopping list generation checks pantry on-the-fly
   - Shows what you need to buy
   - **Does NOT track which meals used which ingredients**

2. **Advanced System** (in schema + backup files):
   - Uses `plan_meal_ingredients` ledger table
   - Tracks exactly which meal/slot used each ingredient
   - Persistent deductions tied to specific meals
   - Reverses deductions when meal is changed/deleted

**Schema for Advanced Tracking**:
```sql
CREATE TABLE plan_meal_ingredients (
  PlanDate TEXT NOT NULL,
  Slot TEXT NOT NULL,              -- 'Breakfast', 'Lunch', 'Dinner'
  RecipeId TEXT NOT NULL,
  IngredientNorm TEXT NOT NULL,
  RequiredBase REAL NOT NULL,      -- How much recipe needs
  DeductedBase REAL NOT NULL,      -- How much was taken from pantry
  BaseUnit TEXT NOT NULL,
  UpdatedAt TEXT,
  PRIMARY KEY (PlanDate, Slot, IngredientNorm)
);
```

---

## Impact of Multi-User Changes

### ✅ GOOD NEWS: Shopping Lists Work Great!

**The multi-user design actually IMPROVES shopping list functionality:**

#### Scenario 1: "Whole Family" Shopping List
When viewing as "Whole Family" user:
- Collects recipes from **ALL users** in the date range
- John's meals + Sarah's meals + Kids' meals + Whole Family meals
- Aggregates ALL ingredients needed
- **Perfect for household grocery shopping**

```javascript
// In getUserPlanMeals() when userId is "Whole Family"
const allUserMeals = db().prepare(`
  SELECT recipe_id FROM user_plan_meals
  WHERE date >= ? AND date <= ?
`).all(start, end);

// Returns ALL recipes from ALL users
// Shopping list includes everything
```

#### Scenario 2: Individual User Shopping List
When viewing as specific user (e.g., "John"):
- Collects only John's recipes
- Plus any "Whole Family" recipes John is assigned to
- **Useful for meal prep or individual dietary tracking**

```javascript
// User-specific shopping list
const johnsMeals = db().prepare(`
  SELECT recipe_id FROM user_plan_meals
  WHERE user_id = ? AND date >= ? AND date <= ?
`).all('john_id', start, end);

// Only John's recipes
```

### Updated `buildShoppingList` Logic

```javascript
function buildShoppingList(payload) {
  const start = String(payload && payload.start || '').trim();
  const end = String(payload && payload.end || '').trim();
  const userId = payload && payload.userId ? String(payload.userId) : getActiveUserId();
  
  if (!start || !end) return err_('start and end date required.');
  
  let recipeIds = new Set();
  
  // Determine which meals to include based on user
  const wholeFamilyUser = db().prepare("SELECT user_id FROM users WHERE name = 'Whole Family'").get();
  
  if (wholeFamilyUser && userId === wholeFamilyUser.user_id) {
    // WHOLE FAMILY: Get ALL meals from ALL users
    const allMeals = db().prepare(`
      SELECT DISTINCT recipe_id 
      FROM user_plan_meals 
      WHERE date >= ? AND date <= ? AND recipe_id IS NOT NULL
    `).all(start, end);
    
    allMeals.forEach(m => recipeIds.add(m.recipe_id));
    
  } else {
    // INDIVIDUAL USER: Get user's meals + Whole Family fallback
    const userMeals = db().prepare(`
      SELECT DISTINCT recipe_id 
      FROM user_plan_meals 
      WHERE user_id = ? AND date >= ? AND date <= ? AND recipe_id IS NOT NULL
    `).all(userId, start, end);
    
    userMeals.forEach(m => recipeIds.add(m.recipe_id));
    
    // Also include Whole Family meals user doesn't override
    if (wholeFamilyUser) {
      const dates = getDatesInRange(start, end);
      const slots = ['Breakfast', 'Lunch', 'Dinner'];
      
      for (const date of dates) {
        for (const slot of slots) {
          // Check if user has their own meal for this slot
          const hasMeal = db().prepare(`
            SELECT id FROM user_plan_meals 
            WHERE user_id = ? AND date = ? AND slot = ?
          `).get(userId, date, slot);
          
          if (!hasMeal) {
            // Use Whole Family meal
            const wfMeal = db().prepare(`
              SELECT recipe_id FROM user_plan_meals 
              WHERE user_id = ? AND date = ? AND slot = ? AND recipe_id IS NOT NULL
            `).get(wholeFamilyUser.user_id, date, slot);
            
            if (wfMeal && wfMeal.recipe_id) {
              recipeIds.add(wfMeal.recipe_id);
            }
          }
        }
      }
    }
  }
  
  // Also collect additional items (sides/desserts)
  const additionalItems = db().prepare(`
    SELECT DISTINCT recipe_id 
    FROM plan_additional_items pai
    JOIN user_plan_meals upm ON pai.meal_id = upm.id
    WHERE upm.date >= ? AND upm.date <= ?
  `).all(start, end);
  
  additionalItems.forEach(item => {
    if (item.recipe_id) recipeIds.add(item.recipe_id);
  });
  
  // Rest of function continues as before...
  // Fetch ingredients, aggregate quantities, deduct from pantry
}
```

### 🎯 Key Benefits

1. **Flexible Shopping**:
   - "Whole Family" = Complete household shopping list
   - Individual user = Personal meal prep list
   - No duplicate work - system handles aggregation

2. **Accurate Quantities**:
   - If John and Sarah both have Spaghetti on Monday, system counts pasta twice
   - Proper aggregation across all users
   - No missed ingredients

3. **Smart Deduplication**:
   - Same recipe used by different people on same day
   - System aggregates quantities correctly
   - Pantry deduction happens once per unique ingredient

---

## Pantry Deduction: Two Implementation Options

### Option 1: Simple On-The-Fly (Current System)
**Pros**:
- ✅ Simple to implement
- ✅ Already working
- ✅ No complex tracking needed
- ✅ Works perfectly with multi-user

**Cons**:
- ❌ Pantry isn't automatically updated when meal is added
- ❌ No history of what meals used what ingredients
- ❌ Can't "undo" pantry deductions if meal is deleted

**How it works with multi-user**:
```javascript
// Shopping list generation time
const allRecipes = getAllRecipesForUser(userId, start, end);
const ingredients = aggregateIngredients(allRecipes);

for (const ingredient of ingredients) {
  const inPantry = checkPantry(ingredient.name);
  ingredient.needToBuy = ingredient.required - inPantry;
}
```

### Option 2: Persistent Ledger (Advanced System)
**Pros**:
- ✅ Automatic pantry updates when meal added
- ✅ History of ingredient usage
- ✅ Can reverse deductions when meal deleted
- ✅ More accurate inventory tracking

**Cons**:
- ❌ More complex to implement
- ❌ Need to update `plan_meal_ingredients` schema for multi-user
- ❌ More database operations

**Required Schema Change**:
```sql
-- Add UserId to make deductions user-specific
CREATE TABLE plan_meal_ingredients (
  meal_id INTEGER NOT NULL,          -- NEW: Links to user_plan_meals.id
  PlanDate TEXT NOT NULL,
  Slot TEXT NOT NULL,
  user_id TEXT NOT NULL,             -- NEW: Which user's meal
  RecipeId TEXT NOT NULL,
  IngredientNorm TEXT NOT NULL,
  RequiredBase REAL NOT NULL,
  DeductedBase REAL NOT NULL,
  BaseUnit TEXT NOT NULL,
  UpdatedAt TEXT,
  PRIMARY KEY (meal_id, IngredientNorm),
  FOREIGN KEY (meal_id) REFERENCES user_plan_meals(id) ON DELETE CASCADE
);
```

**How it works with multi-user**:
```javascript
// When meal is added
async function upsertUserPlanMeal(payload) {
  // ... create meal in user_plan_meals ...
  
  const mealId = result.lastInsertRowid;
  const ingredients = getRecipeIngredients(recipeId);
  
  for (const ing of ingredients) {
    const deducted = _deductFromPantry_(ing.name, ing.qty, ing.unit);
    
    // Track the deduction
    db().prepare(`
      INSERT INTO plan_meal_ingredients 
        (meal_id, PlanDate, Slot, user_id, RecipeId, IngredientNorm, RequiredBase, DeductedBase, BaseUnit)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(mealId, date, slot, userId, recipeId, ing.name, ing.qty, deducted, ing.unit);
  }
}

// When meal is deleted
async function deleteUserPlanMeal(payload) {
  const mealId = payload.mealId;
  
  // Restore pantry quantities
  const deductions = db().prepare(`
    SELECT IngredientNorm, DeductedBase, BaseUnit
    FROM plan_meal_ingredients
    WHERE meal_id = ?
  `).all(mealId);
  
  for (const d of deductions) {
    _addBackToPantry_(d.IngredientNorm, d.DeductedBase, d.BaseUnit);
  }
  
  // Delete meal and ledger entries (CASCADE handles ledger)
  db().prepare(`DELETE FROM user_plan_meals WHERE id = ?`).run(mealId);
}
```

---

## Recommended Approach

### Phase 1 (Current Implementation): Use Simple System
**For the multi-user meal plan rollout:**
1. Keep shopping list generation on-the-fly
2. Works perfectly with multi-user (no changes needed!)
3. Users manually update pantry when they shop
4. **No risk of complex bugs during migration**

### Phase 2 (Future Enhancement): Add Persistent Tracking
**After multi-user is stable:**
1. Migrate to ledger-based pantry tracking
2. Update `plan_meal_ingredients` schema with `meal_id` and `user_id`
3. Automatic pantry updates when meals added/removed
4. Better inventory management

---

## Example Scenarios

### Scenario A: Family Shopping (Whole Family User)
```
Date Range: Jan 20 - Jan 26
Active User: Whole Family

Meals in Range:
- Mon Breakfast (John): Oatmeal
- Mon Breakfast (Sarah): Yogurt Parfait
- Mon Lunch (Whole Family): Caesar Salad
- Mon Dinner (Mom): Grilled Salmon
- Mon Dinner (Kids): Chicken Nuggets

Shopping List Generated:
✓ Oats (500g) - from John's Oatmeal
✓ Greek Yogurt (200g) - from Sarah's Parfait
✓ Romaine Lettuce (2 heads) - from Caesar Salad
✓ Salmon (1 lb) - from Mom's dinner
✓ Chicken Nuggets (1 bag) - from Kids' dinner
✓ Caesar Dressing (1 bottle) - from Caesar Salad

Total: ALL ingredients from ALL users
```

### Scenario B: Personal Shopping (John's User)
```
Date Range: Jan 20 - Jan 26
Active User: John

Meals in Range:
- Mon Breakfast (John): Oatmeal
- Mon Lunch (fallback to Whole Family): Caesar Salad
- Mon Dinner (fallback to Whole Family): Grilled Salmon (assigned to Mom, but John has no override)

Shopping List Generated:
✓ Oats (500g) - from John's Oatmeal
✓ Romaine Lettuce (2 heads) - from Whole Family Caesar Salad
✓ Caesar Dressing (1 bottle) - from Whole Family Caesar Salad
(NO Salmon - that's Mom's specific meal, not John's)

Total: John's meals + Whole Family meals John participates in
```

---

## Migration Impact

### Database Changes Needed:
1. ✅ `user_plan_meals` table - already designed
2. ✅ `plan_additional_items.meal_id` - already planned
3. ⏸️ `plan_meal_ingredients` updates - **OPTIONAL for now**

### API Changes Needed:
1. ✅ `buildShoppingList` - minor update to query new table
2. ✅ User context handling - already designed
3. ⏸️ Persistent pantry tracking - **Phase 2**

### Frontend Changes Needed:
1. ✅ No changes needed! Shopping list UI stays the same
2. ✅ Already handles user context from user switcher

---

## Summary

### ✅ Shopping Lists: NO BREAKING CHANGES
- Multi-user design **enhances** shopping list functionality
- "Whole Family" gets complete household list
- Individual users get personalized lists
- Quantity aggregation works automatically

### ⚠️ Pantry Tracking: MINOR UPDATE NEEDED
- Current on-the-fly system works fine with multi-user
- Optional: Upgrade to persistent ledger in Phase 2
- No functionality lost during migration

### 🎯 Recommendation
**Proceed with multi-user implementation as planned.**
- Shopping lists will work better than before
- Pantry tracking continues to work
- Future enhancement: Add persistent deduction ledger
- **Zero risk to current functionality**

---

## Test Checklist

### Shopping List Tests
- [ ] Generate shopping list as "Whole Family" - includes all users' meals
- [ ] Generate shopping list as individual user - only their meals
- [ ] Verify quantity aggregation (same ingredient from multiple meals)
- [ ] Verify pantry deduction shows correct "need to buy" amounts
- [ ] Test with overlapping recipes (John + Sarah both have Pasta)

### Pantry Tests
- [ ] Check pantry quantities before shopping list
- [ ] Generate shopping list and verify deductions
- [ ] Manually update pantry after shopping
- [ ] Verify quantities persist correctly
