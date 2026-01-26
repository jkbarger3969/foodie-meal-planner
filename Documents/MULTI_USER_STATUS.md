# Multi-User Meal Plans - Implementation Status

## Current Progress

### ✅ Completed

1. **Analysis Phase**
   - Analyzed complete database schema (`plans`, `plan_meal_assignments`, `plan_additional_items`)
   - Mapped all API functions that read/write meal plans
   - Documented calendar integration (Apple & Google)
   - Documented frontend rendering logic
   - Identified all dependencies and relationships

2. **Design Phase**
   - Created comprehensive architecture design (MULTI_USER_MEAL_PLAN_DESIGN.md)
   - Designed new `user_plan_meals` table schema
   - Planned migration strategy with zero data loss
   - Designed API function changes with backward compatibility
   - Planned frontend updates for multiple meals per slot
   - Designed calendar sync strategy for multiple events

3. **Migration Script**
   - Created `scripts/migrate-user-meal-plans.js`
   - Includes automatic backup creation
   - Migrates all existing plans to "Whole Family" user
   - Updates `plan_additional_items` references
   - Comprehensive validation and error handling
   - Made executable and dependency-free

### 🚧 In Progress

4. **Database Schema Update**
   - Need to add new table creation to `src/main/db.js migrate()` function
   - This ensures new installs get the schema automatically

### 📋 Pending

5. **API Layer Implementation**
   - Create `getUserPlanMeals()` function
   - Create `upsertUserPlanMeal()` function
   - Create `deleteUserPlanMeal()` function
   - Update `buildShoppingList()` to query new table
   - Update `calendarSyncRange()` for multiple events
   - Add feature flag for gradual rollout

6. **Frontend Updates**
   - Update `PLAN` global state to handle arrays
   - Update `loadPlansAndRender()` to call new API
   - Update `slotLine()` to render multiple meals
   - Add UI for deleting individual meals
   - Update meal picker to support user selection

7. **Testing**
   - Run migration script on test database
   - Verify all existing meals preserved
   - Test creating user-specific meals
   - Test "Whole Family" aggregation view
   - Test calendar sync with multiple events
   - Verify shopping list works
   - Run full feature regression test

8. **Documentation**
   - Update user guide with new functionality
   - Document migration process
   - Create rollback procedure

---

## Files Created

1. `MULTI_USER_MEAL_PLAN_DESIGN.md` - Complete architecture design
2. `IMPLEMENTATION_PLAN_USER_MEALS.md` - Implementation roadmap
3. `scripts/migrate-user-meal-plans.js` - Migration script

---

## Files to Modify

### High Priority (Core Functionality)

1. **`src/main/db.js`**
   - Add `user_plan_meals` table to `migrate()` function
   - ~20 lines of code

2. **`src/main/api.js`**
   - Add 3 new API functions (~300 lines total)
   - Update `buildShoppingList()` (~50 lines)
   - Update `calendarSyncRange()` (~50 lines)
   - Update `googleCalendarSyncRange()` (~50 lines)

3. **`src/renderer/index.html`**
   - Update `PLAN` state object (~5 lines)
   - Update `loadPlansAndRender()` (~30 lines)
   - Update `slotLine()` (~50 lines)
   - Add delete meal functions (~50 lines)

### Medium Priority (Enhanced Features)

4. **`src/main/main.js`**
   - Export new API functions to renderer

5. **`package.json`**
   - Update version number after stable

---

## Key Design Decisions

### 1. Backward Compatibility Strategy
- Keep old `plans` table (read-only after migration)
- New code reads from `user_plan_meals` first, falls back to `plans`
- Allows gradual migration and easy rollback

### 2. Multiple Meals Per Slot
- Each user can have multiple breakfasts/lunches/dinners per day
- "Whole Family" view shows ALL meals from ALL users
- Individual users see only their meals + "Whole Family" fallback

### 3. Calendar Event Differentiation
```
08:00 - Breakfast: Pancakes (Whole Family)
08:00 - Breakfast (John): Oatmeal
08:00 - Breakfast (Sarah): Yogurt
```
- Each meal gets its own calendar event
- User name in title differentiates events
- Event IDs stored per-meal in `user_plan_meals` table

### 4. Shopping List Aggregation
- "Whole Family" shopping list includes ALL users' meals
- Individual user shopping lists include only their meals
- Proper quantity aggregation across multiple users

---

## Risks & Mitigation

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Data loss during migration | LOW | CRITICAL | Automatic backup, dry-run testing, validation |
| Calendar sync breaks | MEDIUM | HIGH | Extensive testing, keep event IDs, rollback plan |
| Performance degradation | LOW | MEDIUM | Proper indexes, query optimization |
| UI rendering bugs | MEDIUM | MEDIUM | Feature flag, gradual rollout, comprehensive testing |

---

## Next Steps

1. **Add schema to db.js** (15 minutes)
   - Copy table creation from migration script
   - Add to `migrate()` function

2. **Implement API functions** (2 hours)
   - `getUserPlanMeals()` with fallback logic
   - `upsertUserPlanMeal()` with user context
   - `deleteUserPlanMeal()` with security check

3. **Update frontend** (2 hours)
   - Handle meal arrays in rendering
   - Add delete buttons for individual meals
   - Update meal picker UI

4. **Test migration** (1 hour)
   - Run script on copy of database
   - Verify data integrity
   - Test all features

5. **Update calendar sync** (1 hour)
   - Handle multiple events per slot
   - Test with Apple Calendar
   - Test with Google Calendar

**Estimated Total Time**: 6-7 hours of focused development

---

## Testing Checklist

### Migration Testing
- [ ] Backup created successfully
- [ ] All existing meals migrated
- [ ] No data loss
- [ ] Additional items linked correctly
- [ ] Validation passes

### Functional Testing
- [ ] View existing meals in "Whole Family"
- [ ] Create meal for specific user
- [ ] Switch users and see different plans
- [ ] Delete individual meals
- [ ] Multiple meals per slot display correctly

### Integration Testing
- [ ] Calendar sync creates separate events
- [ ] Shopping list aggregates correctly
- [ ] Pantry deductions work
- [ ] Drag/drop still works
- [ ] Additional items (sides) still attached

### Regression Testing
- [ ] All features from TESTING_INSTRUCTIONS.md work
- [ ] User switcher works
- [ ] Collection cards work
- [ ] Virtual scrolling works
- [ ] Print shopping list works
- [ ] Bulk assign works

---

## Rollback Plan

If critical issues are discovered:

1. **Stop using new system**
   ```javascript
   // In api.js
   const USE_USER_PLAN_MEALS = false;  // Set to false
   ```

2. **Restore from backup**
   ```bash
   cp data/foodie-backup-[timestamp].sqlite data/foodie.sqlite
   ```

3. **Hard refresh app**
   - Cmd+Shift+R to clear cache

4. **Report issues**
   - Document what went wrong
   - Include console errors
   - Note steps to reproduce

---

## Success Criteria

The implementation is successful when:

✅ All existing meal plans are visible and unchanged  
✅ Can create separate meal plans for different users  
✅ "Whole Family" view shows all meals from all users  
✅ Individual users see their meals + fallback to "Whole Family"  
✅ Calendar sync creates separate events with user names  
✅ Shopping list works for all scenarios  
✅ No features broken from original app  
✅ Performance is acceptable (< 100ms for meal plan load)  
✅ All calendar events maintain correct times and dates  

---

## Questions to Resolve

1. **Should "Whole Family" meals be editable by individual users?**
   - Current design: No, only "Whole Family" user can edit those meals
   - Alternative: Any user can edit shared meals

2. **When user creates a meal, should it default to "Whole Family" or the individual user?**
   - Current design: Defaults to active user
   - Can be changed via UI

3. **Should there be a limit on meals per slot?**
   - Current design: No limit (database allows unlimited)
   - Could add UI warning if > 5 meals in one slot

---

**Status**: Ready to proceed with implementation
**Next Action**: Update `src/main/db.js` to include new schema
**Estimated Time to Complete**: 6-7 hours
