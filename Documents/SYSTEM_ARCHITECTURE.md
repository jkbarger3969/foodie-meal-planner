# System Architecture Summary - Multi-User Meal Planning

**Date:** 2026-01-21  
**Status:** ✅ All User Isolation Complete

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                     Desktop App                          │
├─────────────────────────────────────────────────────────┤
│                                                           │
│  User Views:                                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │ Whole Family │  │    Keith     │  │    Sarah     │  │
│  │   (Aggr.)    │  │  (Isolated)  │  │  (Isolated)  │  │
│  └──────────────┘  └──────────────┘  └──────────────┘  │
│         │                 │                 │            │
│         └─────────────────┴─────────────────┘            │
│                           │                              │
│                           ▼                              │
│              ┌─────────────────────────┐                 │
│              │   user_plan_meals       │                 │
│              │  (Multi-User Storage)   │                 │
│              └─────────────────────────┘                 │
│                           │                              │
│         ┌─────────────────┼─────────────────┐            │
│         ▼                 ▼                 ▼            │
│  ┌────────────┐    ┌────────────┐   ┌────────────┐     │
│  │  Shopping  │    │  Shopping  │   │  Shopping  │     │
│  │    List    │    │    List    │   │    List    │     │
│  │ (Whole Fam)│    │  (Keith)   │   │  (Sarah)   │     │
│  └────────────┘    └────────────┘   └────────────┘     │
│         │                 │                 │            │
│         └─────────────────┴─────────────────┘            │
│                           │                              │
│                           ▼                              │
│              ┌─────────────────────────┐                 │
│              │     Pantry (Shared)     │                 │
│              │   Family-Wide Stock     │                 │
│              └─────────────────────────┘                 │
└─────────────────────────────────────────────────────────┘
```

---

## Data Flow

### 1. Meal Plan Queries

#### Whole Family View
```sql
SELECT * FROM user_plan_meals
WHERE date >= ? AND date <= ?
-- Returns ALL users' meals
```

#### Individual User View (e.g., Keith)
```sql
SELECT * FROM user_plan_meals
WHERE date >= ? AND date <= ?
  AND user_id = 'keith-uuid'
-- Returns ONLY Keith's meals (no fallback)
```

---

### 2. Shopping List Generation

#### Whole Family Shopping List
```sql
SELECT DISTINCT recipe_id FROM user_plan_meals
WHERE date >= ? AND date <= ? AND recipe_id IS NOT NULL
-- Collects recipes from ALL users
```

#### Individual User Shopping List (e.g., Keith)
```sql
SELECT DISTINCT recipe_id FROM user_plan_meals
WHERE date >= ? AND date <= ? AND recipe_id IS NOT NULL
  AND user_id = 'keith-uuid'
-- Collects recipes from ONLY Keith's meals
```

---

### 3. Pantry Deduction

```javascript
// Pantry is shared (no user_id column)
function _deductFromPantry_(ingredientLower, requiredQty, baseUnit) {
  // Query pantry (family-wide)
  SELECT * FROM pantry WHERE NameLower = ?
  
  // Deduct from available stock
  UPDATE pantry SET QtyNum = QtyNum - deducted WHERE ItemId = ?
  
  // Returns amount deducted
}
```

**Key Point:** Pantry deduction is cumulative:
- Whole Family list: Deducts for ALL recipes (all users combined)
- Keith's list: Deducts for ONLY Keith's recipes
- Sarah's list: Deducts from REMAINING pantry after Keith's deductions

---

## User Isolation Rules

### ✅ ISOLATED (User-Specific)

| Feature | Whole Family | Keith | Sarah |
|---------|--------------|-------|-------|
| **Meal Plan View** | ALL users | ONLY Keith | ONLY Sarah |
| **Shopping List** | ALL recipes | ONLY Keith's recipes | ONLY Sarah's recipes |
| **Clear All Meals** | ONLY Whole Family meals | ONLY Keith's meals | ONLY Sarah's meals |
| **Add Meal** | Assigns to Whole Family | Assigns to Keith | Assigns to Sarah |
| **Delete Meal** | Deletes from Whole Family | Deletes from Keith | Deletes from Sarah |
| **Swap Meals** | Swaps within Whole Family | Swaps within Keith | Swaps within Sarah |

### ✅ SHARED (Family-Wide)

| Feature | Behavior |
|---------|----------|
| **Pantry Inventory** | Same for ALL users (physical home inventory) |
| **Pantry Deduction** | Deducts from shared stock regardless of user |
| **Recipes** | Same recipe library for all users |
| **Stores** | Same store list for all users |
| **Collections** | Same collections for all users |

---

## Database Schema

### user_plan_meals (Multi-User Meals)
```sql
CREATE TABLE user_plan_meals (
  id INTEGER PRIMARY KEY,
  user_id TEXT NOT NULL,      -- Links to users.user_id
  date TEXT NOT NULL,          -- YYYY-MM-DD
  slot TEXT NOT NULL,          -- 'Breakfast', 'Lunch', 'Dinner'
  recipe_id TEXT,
  title TEXT,
  use_leftovers INTEGER,
  from_meal TEXT,
  apple_event_id TEXT,
  google_event_id TEXT,
  sort_order INTEGER,
  created_at TEXT,
  updated_at TEXT
);
```

### pantry (Shared Family Inventory)
```sql
CREATE TABLE pantry (
  ItemId TEXT PRIMARY KEY,
  Name TEXT,
  NameLower TEXT,
  QtyText TEXT,                -- Display text (e.g., "2 cups")
  QtyNum REAL,                 -- Numeric quantity
  Unit TEXT,                   -- Unit (e.g., "cup", "lb")
  StoreId TEXT,
  Notes TEXT,
  UpdatedAt TEXT
  -- ❌ NO user_id - shared across all users
);
```

### users (User Accounts)
```sql
CREATE TABLE users (
  user_id TEXT PRIMARY KEY,    -- UUID
  name TEXT NOT NULL,           -- 'Whole Family', 'Keith', 'Sarah'
  email TEXT,
  avatar_emoji TEXT,
  is_active INTEGER,
  created_at TEXT,
  updated_at TEXT
);
```

---

## Key Functions

### getUserPlanMeals(payload)
**Purpose:** Get meals for a specific user in a date range

**Logic:**
```javascript
if (isWholeFamilyView) {
  // Return ALL users' meals
  SELECT * FROM user_plan_meals WHERE date >= ? AND date <= ?
} else {
  // Return ONLY this user's meals (NO FALLBACK)
  SELECT * FROM user_plan_meals 
  WHERE date >= ? AND date <= ? AND user_id = ?
}
```

---

### buildShoppingList(payload)
**Purpose:** Generate shopping list for a specific user

**Logic:**
```javascript
if (isWholeFamilyView) {
  // Collect recipes from ALL users
  SELECT DISTINCT recipe_id FROM user_plan_meals 
  WHERE date >= ? AND date <= ?
} else {
  // Collect recipes from ONLY this user (NO FALLBACK)
  SELECT DISTINCT recipe_id FROM user_plan_meals 
  WHERE date >= ? AND date <= ? AND user_id = ?
}

// Then for each recipe, get ingredients
// Deduct from shared pantry
// Return net shopping list
```

---

### clearMealsByRange(payload)
**Purpose:** Clear meals for a date range

**Logic:**
```javascript
const activeUser = getActiveUser();

// Clear ONLY active user's meals
DELETE FROM user_plan_meals
WHERE user_id = activeUser.userId 
  AND date >= ? AND date <= ?
```

---

## Use Cases

### Use Case 1: Keith's Weekly Meal Prep
1. Keith switches to his user account
2. Plans his meals for the week (Mon-Fri lunches for work)
3. Generates shopping list
   - ✅ Shows ONLY ingredients for Keith's meals
   - ✅ Deducts from family pantry
4. Keith's meals are isolated - doesn't see family dinners

---

### Use Case 2: Family Dinner Planning
1. Switch to "Whole Family" user
2. Plan family dinners for the week (Mon-Sun)
3. Generate shopping list
   - ✅ Shows ingredients for family dinners
   - ✅ Plus Keith's work lunches
   - ✅ Plus Sarah's breakfast meal prep
   - ✅ Aggregates everything
4. Whole Family view shows all meals from everyone

---

### Use Case 3: Pantry Management
1. Sarah checks pantry inventory
   - ✅ Sees same inventory as Keith and Whole Family
2. Keith generates shopping list for his lunches
   - ✅ Deducts 3 eggs from pantry (9 remaining)
3. Whole Family generates shopping list for dinners
   - ✅ Deducts from REMAINING 9 eggs (not original 12)
4. Everyone sees updated pantry: 9 eggs → 2 eggs after both deductions

---

## Benefits of This Architecture

1. **User Privacy:** Each user's personal meal plans are isolated
2. **Family Coordination:** "Whole Family" view aggregates everything
3. **Shared Resources:** One pantry inventory reflects physical reality
4. **Flexible Planning:** Mix family meals and personal meals
5. **Accurate Shopping:** Whole Family list includes everyone's needs
6. **No Duplication:** Pantry deduction prevents buying items already in stock

---

## Migration Notes

### Old System → New System
- **Old:** Single `plans` table, one meal per slot per day
- **New:** `user_plan_meals` table, multiple meals per slot, multiple users

**Backward Compatibility:**
- All functions check if `user_plan_meals` table exists
- Fall back to `plans` table if not
- Gradual migration supported

---

## Testing Strategy

### Unit Tests (Manual)
1. ✅ Add user → verify meals isolated
2. ✅ Shopping list → verify user-specific
3. ✅ Pantry deduction → verify shared stock
4. ✅ Clear meals → verify only active user
5. ✅ Whole Family view → verify aggregation

### Integration Tests
1. ✅ Multi-user workflow → add meals for 3 users, verify each view
2. ✅ Shopping list aggregate → verify Whole Family includes all users
3. ✅ Pantry deduction cascade → verify sequential deductions work
4. ✅ User isolation → verify users can't see/modify each other's meals

---

## Next Steps

1. ✅ All user isolation complete
2. ✅ Shopping list fixed
3. ✅ Pantry verified (shared, correct behavior)
4. 🚀 **Ready for companion apps!**

---

**Status:** System architecture complete and verified. All user isolation working correctly. Pantry shared family-wide as designed. Ready to move forward with iPad/iPhone companion apps.
