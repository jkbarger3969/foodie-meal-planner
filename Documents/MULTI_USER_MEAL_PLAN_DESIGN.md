# Multi-User Meal Plan Architecture Design

## Overview
Redesign the meal planning system to support:
1. **Separate meal plans per user** - Each user has their own independent meal plan
2. **Multiple meals per slot** - Support 2+ breakfasts/lunches/dinners on the same date
3. **Backward compatibility** - "Whole Family" view shows all meals aggregated
4. **Fallback behavior** - If no user-specific meal exists, show "Whole Family" meal

---

## Database Schema Changes

### NEW: `user_plan_meals` Table (Replaces column-based `plans` table)

```sql
CREATE TABLE user_plan_meals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  date TEXT NOT NULL,
  slot TEXT NOT NULL,  -- 'Breakfast', 'Lunch', 'Dinner'
  recipe_id TEXT,
  title TEXT NOT NULL,
  use_leftovers INTEGER DEFAULT 0,
  from_meal TEXT,  -- Reference to source meal (date + slot)
  apple_event_id TEXT,
  google_event_id TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
  FOREIGN KEY (recipe_id) REFERENCES recipes(RecipeId) ON DELETE SET NULL
);

-- Indexes for fast lookups
CREATE INDEX idx_user_plan_meals_user_date ON user_plan_meals(user_id, date);
CREATE INDEX idx_user_plan_meals_date_slot ON user_plan_meals(date, slot);
CREATE INDEX idx_user_plan_meals_recipe ON user_plan_meals(recipe_id);

-- Unique constraint: prevent exact duplicates for same user/date/slot/recipe
CREATE UNIQUE INDEX idx_user_plan_meals_unique 
  ON user_plan_meals(user_id, date, slot, recipe_id) 
  WHERE recipe_id IS NOT NULL;
```

**Key Design Decisions**:
- **Multiple rows per date/slot** - Allows John and Sarah to both have Breakfast on Monday
- **UserId foreign key** - Enforces referential integrity
- **sort_order** - Controls display order when multiple meals exist in same slot
- **Separate event IDs** - Each meal has its own calendar event
- **Nullable recipe_id** - Supports custom/manual meal entries

---

### KEEP: `plan_meal_assignments` Table (Now links to user_plan_meals)

```sql
-- Keep existing table, add foreign key to new table
ALTER TABLE plan_meal_assignments 
  ADD COLUMN meal_id INTEGER REFERENCES user_plan_meals(id) ON DELETE CASCADE;

-- New index
CREATE INDEX idx_plan_meal_assignments_meal ON plan_meal_assignments(meal_id);
```

**Purpose**: Tracks which household members a specific meal is intended for (e.g., "Mom's salad is for Mom only")

---

### KEEP: `plan_additional_items` Table (Update foreign key)

```sql
-- Add reference to new user_plan_meals table
ALTER TABLE plan_additional_items 
  ADD COLUMN meal_id INTEGER REFERENCES user_plan_meals(id) ON DELETE CASCADE;

-- Keep existing Date/Slot columns for backward compatibility during migration
CREATE INDEX idx_additional_items_meal ON plan_additional_items(meal_id);
```

**Purpose**: Sides/desserts attached to a specific meal

---

### DEPRECATED: `plans` Table (Keep for backward compatibility, read-only after migration)

```sql
-- Keep table but stop writing to it
-- Migration will copy data to user_plan_meals
-- Old code can continue reading during transition
```

---

## Migration Strategy

### Phase 1: Schema Migration (Additive Changes)

```javascript
// scripts/migrate-user-meal-plans.js

const Database = require('better-sqlite3');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const dbPath = path.join(__dirname, '..', 'data', 'foodie.sqlite');
const db = new Database(dbPath);

function migrateToUserMealPlans() {
  console.log('Starting migration to user_plan_meals...');
  
  // 1. Create new table
  db.exec(`
    CREATE TABLE IF NOT EXISTS user_plan_meals (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      date TEXT NOT NULL,
      slot TEXT NOT NULL,
      recipe_id TEXT,
      title TEXT NOT NULL,
      use_leftovers INTEGER DEFAULT 0,
      from_meal TEXT,
      apple_event_id TEXT,
      google_event_id TEXT,
      sort_order INTEGER DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
      FOREIGN KEY (recipe_id) REFERENCES recipes(RecipeId) ON DELETE SET NULL
    );
    
    CREATE INDEX IF NOT EXISTS idx_user_plan_meals_user_date 
      ON user_plan_meals(user_id, date);
    CREATE INDEX IF NOT EXISTS idx_user_plan_meals_date_slot 
      ON user_plan_meals(date, slot);
    CREATE INDEX IF NOT EXISTS idx_user_plan_meals_recipe 
      ON user_plan_meals(recipe_id);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_user_plan_meals_unique 
      ON user_plan_meals(user_id, date, slot, recipe_id) 
      WHERE recipe_id IS NOT NULL;
  `);
  
  // 2. Get "Whole Family" user ID
  const wholeFamilyUser = db.prepare(`
    SELECT user_id FROM users WHERE name = 'Whole Family' LIMIT 1
  `).get();
  
  if (!wholeFamilyUser) {
    console.error('ERROR: "Whole Family" user not found. Please create it first.');
    process.exit(1);
  }
  
  const wholeFamilyUserId = wholeFamilyUser.user_id;
  console.log(`Using "Whole Family" user_id: ${wholeFamilyUserId}`);
  
  // 3. Migrate existing plans
  const existingPlans = db.prepare(`
    SELECT Date, 
           BreakfastRecipeId, BreakfastTitle, BreakfastUseLeftovers, BreakfastFrom, BreakfastEventId,
           LunchRecipeId, LunchTitle, LunchUseLeftovers, LunchFrom, LunchEventId,
           DinnerRecipeId, DinnerTitle, DinnerUseLeftovers, DinnerFrom, DinnerEventId
    FROM plans
    WHERE BreakfastTitle IS NOT NULL 
       OR LunchTitle IS NOT NULL 
       OR DinnerTitle IS NOT NULL
    ORDER BY Date ASC
  `).all();
  
  console.log(`Found ${existingPlans.length} plan rows to migrate`);
  
  const insertStmt = db.prepare(`
    INSERT INTO user_plan_meals 
      (user_id, date, slot, recipe_id, title, use_leftovers, from_meal, apple_event_id, sort_order)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  
  let migratedCount = 0;
  
  db.transaction(() => {
    for (const plan of existingPlans) {
      const slots = [
        {
          slot: 'Breakfast',
          recipeId: plan.BreakfastRecipeId,
          title: plan.BreakfastTitle,
          useLeftovers: plan.BreakfastUseLeftovers || 0,
          from: plan.BreakfastFrom,
          eventId: plan.BreakfastEventId
        },
        {
          slot: 'Lunch',
          recipeId: plan.LunchRecipeId,
          title: plan.LunchTitle,
          useLeftovers: plan.LunchUseLeftovers || 0,
          from: plan.LunchFrom,
          eventId: plan.LunchEventId
        },
        {
          slot: 'Dinner',
          recipeId: plan.DinnerRecipeId,
          title: plan.DinnerTitle,
          useLeftovers: plan.DinnerUseLeftovers || 0,
          from: plan.DinnerFrom,
          eventId: plan.DinnerEventId
        }
      ];
      
      for (const s of slots) {
        if (s.title) {
          insertStmt.run(
            wholeFamilyUserId,
            plan.Date,
            s.slot,
            s.recipeId || null,
            s.title,
            s.useLeftovers,
            s.from || null,
            s.eventId || null,
            0  // sort_order
          );
          migratedCount++;
        }
      }
    }
  })();
  
  console.log(`✅ Migrated ${migratedCount} meals to user_plan_meals`);
  
  // 4. Update plan_additional_items with meal_id references
  console.log('Updating plan_additional_items...');
  
  db.exec(`
    ALTER TABLE plan_additional_items 
      ADD COLUMN meal_id INTEGER REFERENCES user_plan_meals(id) ON DELETE CASCADE;
  `);
  
  // Link additional items to their meals
  db.exec(`
    UPDATE plan_additional_items
    SET meal_id = (
      SELECT id FROM user_plan_meals 
      WHERE user_plan_meals.date = plan_additional_items.Date
        AND user_plan_meals.slot = plan_additional_items.Slot
      LIMIT 1
    )
  `);
  
  console.log('✅ Migration complete!');
  console.log('\nNext steps:');
  console.log('1. Restart the app');
  console.log('2. Test meal plan viewing/editing');
  console.log('3. Verify calendar sync still works');
  console.log('4. Once verified, the old `plans` table can be dropped');
}

migrateToUserMealPlans();
db.close();
```

---

## API Function Changes

### Core Principle: Active User Context

All meal plan operations now filter by `ACTIVE_USER_ID`:

```javascript
let ACTIVE_USER_ID = null;  // Set by setActiveUser()

function getActiveUserId() {
  if (!ACTIVE_USER_ID) {
    // Default to "Whole Family"
    const wf = db().prepare("SELECT user_id FROM users WHERE name = 'Whole Family'").get();
    if (wf) ACTIVE_USER_ID = wf.user_id;
  }
  return ACTIVE_USER_ID;
}
```

---

### NEW: `getUserPlanMeals` (Replaces getPlansRange)

```javascript
function getUserPlanMeals(payload) {
  const start = String(payload && payload.start || '').trim();
  const end = String(payload && payload.end || '').trim();
  const userId = payload && payload.userId ? String(payload.userId) : getActiveUserId();
  
  if (!start || !end) return err_('start and end date required');
  if (!userId) return err_('No active user');
  
  // Get meals for this user
  const userMeals = db().prepare(`
    SELECT 
      id, date, slot, recipe_id, title, use_leftovers, from_meal,
      apple_event_id, google_event_id, sort_order
    FROM user_plan_meals
    WHERE user_id = ? AND date >= ? AND date <= ?
    ORDER BY date ASC, slot ASC, sort_order ASC
  `).all(userId, start, end);
  
  // If "Whole Family" user is active, also get meals from other users
  const wholeFamilyUser = db().prepare("SELECT user_id FROM users WHERE name = 'Whole Family'").get();
  let allUserMeals = [];
  
  if (wholeFamilyUser && userId === wholeFamilyUser.user_id) {
    // Show ALL meals from ALL users
    allUserMeals = db().prepare(`
      SELECT 
        upm.id, upm.date, upm.slot, upm.recipe_id, upm.title, 
        upm.use_leftovers, upm.from_meal, upm.apple_event_id, upm.google_event_id,
        upm.sort_order, upm.user_id,
        u.name as user_name, u.avatar_emoji
      FROM user_plan_meals upm
      JOIN users u ON upm.user_id = u.user_id
      WHERE upm.date >= ? AND upm.date <= ?
      ORDER BY upm.date ASC, upm.slot ASC, upm.sort_order ASC
    `).all(start, end);
  } else {
    // Show user's meals + fallback to "Whole Family" meals if no user-specific meal exists
    allUserMeals = userMeals;
    
    // For each date/slot where user has NO meal, get "Whole Family" meal
    const dates = getDatesInRange(start, end);
    const slots = ['Breakfast', 'Lunch', 'Dinner'];
    
    for (const date of dates) {
      for (const slot of slots) {
        const hasMeal = userMeals.some(m => m.date === date && m.slot === slot);
        
        if (!hasMeal && wholeFamilyUser) {
          const wholeFamilyMeal = db().prepare(`
            SELECT 
              id, date, slot, recipe_id, title, use_leftovers, from_meal,
              apple_event_id, google_event_id, sort_order, user_id
            FROM user_plan_meals
            WHERE user_id = ? AND date = ? AND slot = ?
            LIMIT 1
          `).get(wholeFamilyUser.user_id, date, slot);
          
          if (wholeFamilyMeal) {
            allUserMeals.push({
              ...wholeFamilyMeal,
              isWholeFamilyFallback: true
            });
          }
        }
      }
    }
  }
  
  // Group by date -> slot
  const plansByDate = {};
  
  for (const meal of allUserMeals) {
    if (!plansByDate[meal.date]) {
      plansByDate[meal.date] = {
        Date: meal.date,
        Breakfast: [],
        Lunch: [],
        Dinner: []
      };
    }
    
    plansByDate[meal.date][meal.slot].push({
      id: meal.id,
      RecipeId: meal.recipe_id || '',
      Title: meal.title,
      UseLeftovers: meal.use_leftovers ? true : false,
      From: meal.from_meal || '',
      AppleEventId: meal.apple_event_id || '',
      GoogleEventId: meal.google_event_id || '',
      UserId: meal.user_id,
      UserName: meal.user_name,
      AvatarEmoji: meal.avatar_emoji,
      IsWholeFamilyFallback: meal.isWholeFamilyFallback || false
    });
  }
  
  // Convert to array
  const plans = Object.values(plansByDate);
  
  return ok_({ plans, userId });
}
```

**Key Features**:
- Filters by active user
- "Whole Family" view aggregates all user meals
- Individual users see their meals + fallback to "Whole Family"
- Returns multiple meals per slot as arrays

---

### NEW: `upsertUserPlanMeal` (Replaces upsertPlanMeal)

```javascript
function upsertUserPlanMeal(payload) {
  const date = String(payload && payload.date || '').trim();
  const slot = String(payload && payload.slot || '').trim();
  const meal = (payload && payload.meal) || null;
  let userId = payload && payload.userId ? String(payload.userId) : getActiveUserId();
  
  if (!date) return err_('date required');
  if (slot !== 'Breakfast' && slot !== 'Lunch' && slot !== 'Dinner') {
    return err_('slot must be Breakfast, Lunch, or Dinner');
  }
  if (!userId) return err_('No active user');
  
  // If meal is null, delete ALL meals for this user/date/slot
  if (meal === null) {
    db().prepare(`
      DELETE FROM user_plan_meals
      WHERE user_id = ? AND date = ? AND slot = ?
    `).run(userId, date, slot);
    return ok_({});
  }
  
  const recipeId = meal.RecipeId ? String(meal.RecipeId).trim() : null;
  const title = String(meal.Title || '').trim();
  const useLeftovers = meal.UseLeftovers ? 1 : 0;
  const from = meal.From ? String(meal.From).trim() : null;
  const mealId = meal.id || null;  // If updating existing meal
  
  if (!title) return err_('meal must have a Title');
  
  if (mealId) {
    // Update existing meal
    db().prepare(`
      UPDATE user_plan_meals
      SET recipe_id = ?, title = ?, use_leftovers = ?, from_meal = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND user_id = ?
    `).run(recipeId, title, useLeftovers, from, mealId, userId);
    
    return ok_({ id: mealId });
  } else {
    // Insert new meal
    const result = db().prepare(`
      INSERT INTO user_plan_meals (user_id, date, slot, recipe_id, title, use_leftovers, from_meal, sort_order)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(userId, date, slot, recipeId, title, useLeftovers, from, 0);
    
    return ok_({ id: result.lastInsertRowid });
  }
}
```

**Key Features**:
- Creates meals for active user
- Supports updating existing meals via `meal.id`
- Deleting sets `meal = null`
- Multiple meals per slot allowed (no unique constraint on user/date/slot)

---

### NEW: `deleteUserPlanMeal` (Delete specific meal by ID)

```javascript
function deleteUserPlanMeal(payload) {
  const mealId = payload && payload.mealId;
  const userId = getActiveUserId();
  
  if (!mealId) return err_('mealId required');
  if (!userId) return err_('No active user');
  
  // Verify meal belongs to this user (security check)
  const meal = db().prepare(`
    SELECT id FROM user_plan_meals WHERE id = ? AND user_id = ?
  `).get(mealId, userId);
  
  if (!meal) return err_('Meal not found or access denied');
  
  db().prepare(`DELETE FROM user_plan_meals WHERE id = ?`).run(mealId);
  
  return ok_({});
}
```

---

## Frontend Changes

### Global State Update

```javascript
const PLAN = {
  start: null,
  days: 7,
  plansByDate: {},  // NOW: Maps 'YYYY-MM-DD' -> { Date, Breakfast: [meal1, meal2], Lunch: [...], Dinner: [...] }
  activeUserId: null,
  loaded: false
};
```

**Key Change**: Each slot is now an **array** of meals instead of a single meal object.

---

### Loading Function Update

```javascript
async function loadPlansAndRender(start, days) {
  const end = addDays(start, days - 1);
  const userId = ACTIVE_USER ? ACTIVE_USER.userId : null;
  
  const res = await api('getUserPlanMeals', { start, end, userId });
  
  if (res.ok) {
    PLAN.start = start;
    PLAN.days = days;
    PLAN.plansByDate = {};
    PLAN.activeUserId = res.userId;
    
    for (const plan of res.plans) {
      PLAN.plansByDate[plan.Date] = plan;
    }
    
    PLAN.loaded = true;
    renderPlanner('planList', start, days, true);
  }
}
```

---

### Rendering Multiple Meals Per Slot

```javascript
function slotLine(date, slot, meals) {
  if (!meals || meals.length === 0) {
    return `
      <div class="slot-empty" data-date="${date}" data-slot="${slot}">
        <button onclick="openMealPicker('${date}','${slot}')">+ Add ${slot}</button>
      </div>
    `;
  }
  
  return meals.map((meal, index) => `
    <div class="meal-card" data-meal-id="${meal.id}">
      <div class="meal-header">
        <span class="meal-title">${escapeHtml(meal.Title)}</span>
        ${meal.UserName ? `<span class="meal-user-badge">${escapeHtml(meal.AvatarEmoji)} ${escapeHtml(meal.UserName)}</span>` : ''}
        ${meal.IsWholeFamilyFallback ? `<span class="fallback-badge">Whole Family</span>` : ''}
      </div>
      <div class="meal-actions">
        <button onclick="editMeal(${meal.id})">Edit</button>
        <button onclick="deleteMeal(${meal.id})">Delete</button>
      </div>
    </div>
  `).join('');
}
```

---

## Calendar Sync Updates

### Challenge: Multiple Events Per Slot

Previously: One event per slot (`{Slot}EventId`)  
Now: Each meal has its own event ID (`apple_event_id` in `user_plan_meals`)

### Solution: Event Title Differentiation

```javascript
async function syncMealToCalendar(mealId, meal, date, slot, calendarName) {
  const slotTimes = {
    Breakfast: { start: '08:00', end: '09:00' },
    Lunch: { start: '12:00', end: '13:00' },
    Dinner: { start: '18:00', end: '19:00' }
  };
  
  const times = slotTimes[slot];
  
  // Include user name in title if not "Whole Family"
  let title = `${slot}: ${meal.Title}`;
  if (meal.UserName && meal.UserName !== 'Whole Family') {
    title = `${slot} (${meal.UserName}): ${meal.Title}`;
  }
  
  const newEventId = await upsertEvent({
    eventId: meal.AppleEventId || '',
    title,
    date,
    startTime: times.start,
    endTime: times.end,
    calendarName
  });
  
  if (newEventId && newEventId !== meal.AppleEventId) {
    // Update event ID in database
    db().prepare(`
      UPDATE user_plan_meals
      SET apple_event_id = ?
      WHERE id = ?
    `).run(newEventId, mealId);
  }
}
```

**Calendar View Result**:
```
Monday, January 20, 2026

08:00 - Breakfast: Pancakes
08:00 - Breakfast (John): Oatmeal
12:00 - Lunch: Caesar Salad
18:00 - Dinner (Mom): Grilled Salmon
18:00 - Dinner (Kids): Chicken Nuggets
```

---

## Rollback Plan

### If Migration Fails

1. **Keep old `plans` table** - Data preserved
2. **Drop new tables**:
   ```sql
   DROP TABLE IF EXISTS user_plan_meals;
   ```
3. **Restore API functions** - Use git to revert changes
4. **Clear cache** - Hard refresh frontend

### Verification Checklist

- [ ] All existing meals visible in "Whole Family" view
- [ ] Can create new meals for specific users
- [ ] Can switch users and see different meal plans
- [ ] Calendar sync creates separate events
- [ ] Shopping list includes all users' meals
- [ ] Pantry deductions work correctly
- [ ] Additional items (sides/desserts) still attached to meals
- [ ] Drag/drop still works
- [ ] Leftover meals reference correctly

---

## Testing Strategy

### Unit Tests
1. Migration script with sample data
2. API functions with multiple users
3. Fallback logic (user meal → whole family meal)
4. Multiple meals per slot handling

### Integration Tests
1. Full workflow: Create user → Add meals → Switch users → Verify isolation
2. Calendar sync with 2+ meals in same slot
3. Shopping list aggregation across users
4. Backward compatibility reading from old `plans` table

### User Acceptance Tests
1. Existing users see their old meal plans
2. New users can create separate plans
3. "Whole Family" shows all meals
4. Individual users see only their meals (+ fallback)
5. Calendar shows differentiated events

---

## Summary

**Before**:
- One plan per date
- Three slots with one meal each
- Assignments just "tag" who meal is for

**After**:
- Separate plan per user per date
- Multiple meals per slot supported
- True user isolation with fallback
- Calendar events differentiated by user name
- Backward compatible via migration
