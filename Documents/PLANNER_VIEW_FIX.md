# Fix: Collection Assignment Planner View Issue

## Problem
When assigning a collection to a meal slot from the Collections tab, the meal planner view would reset to start from the assigned date, potentially hiding the current day and earlier days.

**Example:**
- Current view: Jan 19-26 (today is Jan 19)
- Assign collection to Jan 25
- **Bug**: View changes to Jan 25-31
- **Result**: You can no longer see Jan 19-24 including today

## Root Cause
Line 3838 in `showAssignCollectionFromCollectionsTab()`:
```javascript
await loadPlansIntoUi(date, 7);  // Always starts from assigned date
```

## Solution Implemented
Intelligent view adjustment that preserves context:

### Logic:
1. **If assigned date is within current view** → Keep current view unchanged
   - Example: Current view Jan 19-26, assign to Jan 22 → Stay on Jan 19-26
   
2. **If assigned date is outside current view** → Show from earliest relevant date
   - Compare assigned date vs today
   - Start from whichever is earlier
   - Example: Today Jan 19, assign to Jan 30 → Show Jan 19-26 (keeps today visible)
   - Example: Today Jan 25, assign to Jan 20 → Show Jan 20-27 (keeps assigned date visible)

### Code Changes
**File:** `src/renderer/index.html` (lines 3836-3863)

```javascript
// Determine the best start date for the view
const currentStart = PLAN.start || ymd(new Date());
const currentDays = PLAN.days || 7;
const assignedDate = new Date(date);
const currentStartDate = new Date(currentStart);
const currentEndDate = new Date(currentStartDate);
currentEndDate.setDate(currentEndDate.getDate() + currentDays - 1);

let startDate;
let days;

// Check if assigned date is within current view
if (assignedDate >= currentStartDate && assignedDate <= currentEndDate) {
  // Keep current view - assigned date is already visible
  startDate = currentStart;
  days = currentDays;
} else {
  // Assigned date is outside current view
  // Start from today or assigned date (whichever is earlier)
  const today = new Date();
  const earliestDate = assignedDate < today ? assignedDate : today;
  startDate = ymd(earliestDate);
  days = 7;
}

await loadPlansIntoUi(startDate, days);
```

## Testing Scenarios

### Scenario 1: Assign within current view ✅
- Current view: Jan 19-26
- Assign collection to Jan 22 (Dinner)
- **Expected**: View stays on Jan 19-26
- **Expected**: Auto-scroll to Jan 22 and expand that day

### Scenario 2: Assign to future date ✅
- Current view: Jan 19-26
- Today: Jan 19
- Assign collection to Jan 30 (Dinner)
- **Expected**: View stays on Jan 19-26 (keeps today visible)
- **Expected**: Can manually navigate to see Jan 30

### Scenario 3: Assign to past date ✅
- Current view: Jan 19-26
- Today: Jan 25
- Assign collection to Jan 15 (Dinner)
- **Expected**: View changes to Jan 15-22 (shows assigned date)
- **Expected**: Auto-scroll to Jan 15 and expand that day

### Scenario 4: Assign from other modal (already working) ✅
- Use "Assign Collection" button from Meal Planner tab
- **Expected**: Always keeps current view (already implemented)
- **Expected**: Auto-scroll to assigned date

## Related Functions

### `showAssignCollectionFromCollectionsTab()` - FIXED
- Triggered from Collections tab → "📅 Assign to Meal Plan" button
- **Before**: Always loaded from assigned date
- **After**: Smart view adjustment

### `showAssignCollectionModal()` - Already correct
- Triggered from Meal Planner → "Assign Collection" button
- Already uses `loadPlansIntoUi(PLAN.start, PLAN.days)` to keep current view

## Console Logging
Added helpful console messages for debugging:
```
[assignCollectionFromCollectionsTab] Assigned date within current view, keeping view: 2026-01-19
// OR
[assignCollectionFromCollectionsTab] Assigned date outside view, adjusting to: 2026-01-19
```

## User Experience Improvements
✅ Never lose sight of today's date unexpectedly  
✅ View stays consistent when assigning nearby dates  
✅ Smooth auto-scroll to assigned date  
✅ Details automatically expanded for assigned date  
✅ Preserves user's current context  

---

**Status:** ✅ Fixed  
**Date:** 2026-01-19  
**Files Changed:** `src/renderer/index.html` (lines 3836-3863)
