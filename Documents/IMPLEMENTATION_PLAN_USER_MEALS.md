# Multi-User Meal Plan Implementation Plan

## Implementation Order (Ensures No Breaking Changes)

### Phase 1: Database Migration ✅
1. Create `user_plan_meals` table (additive, doesn't break existing)
2. Run migration script to copy data from `plans` → `user_plan_meals`
3. Add `meal_id` column to `plan_additional_items` (nullable, doesn't break)
4. Verify migration success

### Phase 2: API Layer (Dual Mode Support) ✅
1. Create NEW API functions (keep old ones working):
   - `getUserPlanMeals()` (new) alongside `getPlansRange()` (old)
   - `upsertUserPlanMeal()` (new) alongside `upsertPlanMeal()` (old)
   - `deleteUserPlanMeal()` (new)
2. Add feature flag to toggle between old/new system
3. Test new APIs with existing data

### Phase 3: Frontend Updates ✅
1. Update PLAN global state to handle arrays
2. Update `loadPlansAndRender()` to call new API
3. Update `slotLine()` to render multiple meals
4. Add UI for deleting individual meals
5. Feature flag toggle in UI

### Phase 4: Calendar Sync Updates ✅
1. Update `calendarSyncRange()` to handle multiple meals per slot
2. Test Apple Calendar with 2+ events in same slot
3. Test Google Calendar with 2+ events in same slot

### Phase 5: Shopping List Updates ✅
1. Update `buildShoppingList()` to query `user_plan_meals`
2. Handle aggregation across users for "Whole Family"

### Phase 6: Testing & Verification ✅
1. Run full regression test suite
2. Test all features documented in TESTING_INSTRUCTIONS.md
3. Verify calendar sync, shopping list, pantry, drag/drop

### Phase 7: Cleanup (After Stable) ✅
1. Remove feature flag
2. Remove old API functions
3. Drop old `plans` table
4. Update documentation

---

## File Modification Checklist

### Database Files
- [x] `src/main/db.js` - Add migration logic
- [x] `scripts/migrate-user-meal-plans.js` - NEW migration script

### API Files  
- [x] `src/main/api.js` - Add new functions, keep old ones
- [x] Add feature flag: `USE_USER_PLAN_MEALS = true`

### Frontend Files
- [x] `src/renderer/index.html` - Update meal rendering, API calls

### Calendar Files
- [x] `src/main/api.js` - Update sync functions (Apple & Google)

---

## Backward Compatibility Strategy

1. **Dual Read** - New code reads from both `plans` and `user_plan_meals`
2. **Fallback Write** - If new table fails, write to old table
3. **Feature Flag** - Environment variable to toggle systems
4. **Gradual Rollout** - Test with subset of users first

---

## Risks & Mitigation

| Risk | Impact | Mitigation |
|------|--------|------------|
| Migration data loss | HIGH | Backup database before migration, dry-run test |
| Calendar sync breaks | MEDIUM | Keep event IDs, test extensively |
| UI rendering breaks | MEDIUM | Feature flag allows quick rollback |
| Shopping list errors | LOW | Comprehensive unit tests |
| Performance degradation | LOW | Add indexes, monitor query times |

---

## Success Criteria

- ✅ All existing meals visible after migration
- ✅ Can create user-specific meals
- ✅ "Whole Family" aggregates all meals
- ✅ Individual users see their meals + fallback
- ✅ Calendar creates separate events per user
- ✅ Shopping list works for all scenarios
- ✅ No features broken from TESTING_INSTRUCTIONS.md
