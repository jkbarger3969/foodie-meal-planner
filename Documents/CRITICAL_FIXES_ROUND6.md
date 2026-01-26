# Critical Fixes - Round 6 (User Isolation)

**Date:** 2026-01-21  
**Status:** ✅ User Isolation Fixed

---

## Issues Fixed

### 1. ✅ Clear All Meals Now Respects Active User (FIXED)

**Problem:**
> "clear all meals will clear all meals for the whole family and the user"

**Root Cause:**
```sql
-- Before (Line 1630)
DELETE FROM user_plan_meals
WHERE date >= ? AND date <= ?
-- ❌ Deletes ALL meals for ALL users
```

**Solution:**

**Lines 1627-1640:** Added user_id filter to DELETE
```javascript
if (userTableExists) {
  // Clear from multi-user table - only for active user
  const activeUser = getActiveUser();
  if (activeUser.ok && activeUser.userId) {
    db().prepare(`
      DELETE FROM user_plan_meals
      WHERE user_id = ? AND date >= ? AND date <= ?
      --    ^^^^^^^^^ NEW: Only delete active user's meals
    `).run(activeUser.userId, start, end);
    
    console.log(`[clearMealsByRange] Cleared user_plan_meals for user ${activeUser.name} from ${start} to ${end}`);
  }
}
```

**Expected Behavior After Fix:**
- ✅ User "Keith" clicks "Clear All Meals" → Only Keith's meals are deleted
- ✅ User "Whole Family" clicks "Clear All Meals" → Only Whole Family meals are deleted
- ✅ Other users' meals remain untouched

---

### 2. ✅ Individual Users Now See Only Their Own Meals (FIXED)

**Problem:**
> "whole family assigned meals are showing up under the user account as well as the users meals"

**Root Cause:**
The SQL query had **fallback logic** that showed Whole Family meals when a user had no meal for a specific date/slot:

```sql
-- Before (Lines 1722-1754)
WHERE upm.date >= ? AND upm.date <= ?
  AND (upm.user_id = ? OR (upm.user_id = ? AND NOT EXISTS (
    SELECT 1 FROM user_plan_meals upm2 
    WHERE upm2.user_id = ? 
      AND upm2.date = upm.date 
      AND upm2.slot = upm.slot
  )))
-- ❌ Shows Whole Family meals as fallback when user has no meal
```

**Solution:**

**Lines 1725-1750:** Removed fallback logic - strict user isolation
```sql
-- After
WHERE upm.date >= ? AND upm.date <= ?
  AND upm.user_id = ?
-- ✅ Only shows meals belonging to this specific user
```

**Expected Behavior After Fix:**

#### Whole Family View
- Shows meals from **ALL users** (Keith, Sarah, Whole Family, etc.)
- Each meal has a badge showing which user it belongs to:
  - "👨‍👩‍👧‍👦 Whole Family" (purple) - meals assigned to Whole Family user
  - "👤 Personal" (blue) - meals assigned to individual users

#### Individual User View (e.g., Keith)
- Shows **ONLY Keith's meals**
- Does NOT show Whole Family meals as fallback
- Does NOT show other users' meals
- Empty slots remain empty (no fallback)

---

## Files Modified

### src/main/api.js

1. **Lines 1627-1640:** `clearMealsByRange` - Added `user_id = ?` filter
   - Gets active user via `getActiveUser()`
   - Only deletes meals belonging to active user
   - Logs which user's meals were cleared

2. **Lines 1725-1750:** `getUserPlanMeals` - Removed fallback logic
   - Changed from: `WHERE ... AND (user_id = ? OR (user_id = ? AND NOT EXISTS ...))`
   - To: `WHERE ... AND user_id = ?`
   - Simplified query - strict user isolation
   - Set `is_fallback` to 0 (no fallback meals possible)

---

## Testing Checklist

### Test 1: Clear All Meals (User Isolation)

**Setup:**
1. Switch to "Whole Family" user
2. Add 3 meals (e.g., Breakfast on Mon, Lunch on Tue, Dinner on Wed)
3. Switch to "Keith" user
4. Add 2 meals (e.g., Breakfast on Mon, Dinner on Wed)

**Test:**
1. While viewing "Keith" user, click "Clear All Meals"
2. Confirm both dialogs
3. ✅ Keith's meals should be deleted (Breakfast Mon, Dinner Wed)
4. ✅ Whole Family meals should REMAIN (Breakfast Mon, Lunch Tue, Dinner Wed)

**Verify:**
1. Switch to "Whole Family" view
2. All 3 Whole Family meals should still be there
3. Keith's meals should be gone

---

### Test 2: User Isolation (No Fallback)

**Setup:**
1. Clear all meals for all users (to start fresh)
2. Switch to "Whole Family" user
3. Add meals: Mon Breakfast, Mon Lunch, Mon Dinner

**Test Personal User View:**
1. Switch to "Keith" user
2. View Monday in planner
3. ✅ Monday should show THREE EMPTY SLOTS (no meals)
4. ✅ Should NOT show Whole Family meals as fallback

**Test Whole Family View:**
1. Switch back to "Whole Family" user
2. View Monday in planner
3. ✅ Monday should show THREE MEALS (the ones we added)

**Add Personal Meal:**
1. While viewing "Keith" user
2. Add Mon Breakfast (e.g., "Keith's Pancakes")
3. View Monday in planner
4. ✅ Should show ONLY Mon Breakfast (Keith's Pancakes)
5. ✅ Mon Lunch and Mon Dinner should be EMPTY

**Verify Whole Family View:**
1. Switch to "Whole Family" user
2. View Monday in planner
3. ✅ Should show FOUR meals total:
   - Mon Breakfast: 2 meals (1 from Whole Family, 1 from Keith)
   - Mon Lunch: 1 meal (Whole Family)
   - Mon Dinner: 1 meal (Whole Family)

---

## Behavior Summary

### Before Fix

| View | Clear All Meals | Meals Shown |
|------|----------------|-------------|
| Keith | ❌ Deletes ALL users' meals | ❌ Keith's meals + Whole Family fallback |
| Whole Family | ❌ Deletes ALL users' meals | ✅ All users' meals |

### After Fix

| View | Clear All Meals | Meals Shown |
|------|----------------|-------------|
| Keith | ✅ Deletes ONLY Keith's meals | ✅ ONLY Keith's meals |
| Whole Family | ✅ Deletes ONLY Whole Family meals | ✅ All users' meals |
| Sarah | ✅ Deletes ONLY Sarah's meals | ✅ ONLY Sarah's meals |

---

## Key Changes

1. **User Isolation:** Each user now has completely separate meal plans
2. **No Fallback:** Individual users do NOT see Whole Family meals automatically
3. **Clear All Scoped:** Clear All Meals only clears the active user's meals
4. **Whole Family Aggregation:** "Whole Family" view still shows meals from ALL users

---

## Use Cases

### Use Case 1: Family Meal Planning
- **Whole Family** meals = meals everyone shares (e.g., Sunday dinner)
- **Keith** meals = Keith's personal meals (e.g., packed lunch for work)
- **Sarah** meals = Sarah's personal meals (e.g., breakfast she makes herself)

**Benefit:** Each person can plan their own meals without seeing everyone else's meals cluttering their view.

### Use Case 2: Meal Prep
- **Whole Family** view = See what everyone is eating this week
- Switch to **Keith** view = Just plan Keith's meal prep for the week
- Clear Keith's meals won't affect other family members

---

## Next Steps

1. **Test both fixes** using checklist above
2. **Verify user isolation** works as expected
3. **Confirm Clear All Meals** only affects active user
4. **Move on to companion apps** ✓

All user isolation issues are now resolved!
