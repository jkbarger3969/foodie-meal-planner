# Duplicate Events Prevention - Implementation Summary

## Issue
User reported seeing duplicate meal events on a secondary device after syncing to Google Calendar. Events appeared once on the primary device (computer) but twice on another device.

## Root Cause Analysis

### Most Likely Cause: Calendar Overlay (Not App Bug)
The duplicate events are **most likely** caused by the device showing multiple calendar subscriptions (e.g., personal calendar + work calendar that also syncs the same events). This is a calendar display issue, not a sync bug.

**Evidence:**
1. The `upsertGoogleEvent` function properly checks for existing events before creating new ones
2. Event IDs are stored in the database to ensure updates instead of duplicates
3. Only one API call is made per meal slot per sync

### Less Likely: Actual Duplicate Events
If actual duplicates exist in Google Calendar (visible on google.com), this would indicate a sync bug that needs further investigation.

---

## Implemented Solution

### 1. Enhanced Duplicate Prevention (Code Safety)

**File: `src/main/google-calendar.js`**

Added `findDuplicateEvents()` function (lines 129-152):
- Searches Google Calendar for events matching title and time range
- Returns array of matching events

Enhanced `upsertGoogleEvent()` function (lines 199-220):
- Before creating a new event, checks for existing duplicates
- If duplicate found, updates it instead of creating new
- Prevents any possibility of app-created duplicates

**File: `src/main/api.js`**

Added `checkGoogleCalendarDuplicates()` function (lines 2179-2248):
- Scans all synced events in a date range
- Identifies events with 2+ copies in Google Calendar
- Returns detailed duplicate report

Added to API handler (line 527):
- Exposes duplicate check to frontend

### 2. User-Facing Diagnostic Tool

**File: `src/renderer/index.html`**

Added UI elements (lines 923-925):
- "🔍 Check for Duplicates" button next to sync controls
- Status area for duplicate check results

Added `checkForDuplicates()` function (lines 5180-5220):
- Calls backend duplicate check API
- Displays results to user:
  - If duplicates found: Shows which events and dates
  - If no duplicates: Confirms all events are unique

Button enabled when authenticated (line 5228)

Event listener bound (line 6358)

---

## How to Use

### For User: Diagnose Duplicate Events

1. **Check Google Calendar Web:**
   - Open https://calendar.google.com
   - Look for a meal event (e.g., "Breakfast: Tortillas")
   - **If ONE event:** Calendar overlay issue (see Step 2)
   - **If TWO events:** Use diagnostic tool (see Step 3)

2. **Fix Calendar Overlay (iOS/Android):**
   - Check Settings → Calendar → Accounts
   - Look for duplicate calendar subscriptions
   - Uncheck one of the duplicate calendars

3. **Use Diagnostic Tool:**
   - Open Foodie app → Settings tab
   - Click "🔍 Check for Duplicates" button
   - Review results:
     - ✓ No duplicates = Calendar overlay issue on device
     - ⚠️ Duplicates found = Use the report to investigate

### For Developer: Verify Fix

1. Sync meals to Google Calendar
2. Click "🔍 Check for Duplicates"
3. Should report: "✓ No duplicates found. Checked X events."
4. If duplicates found, investigate the reported event IDs

---

## Technical Details

### Duplicate Prevention Logic

```javascript
// Before creating event, search for existing
const dupCheck = await findDuplicateEvents({ 
  calendarId, 
  title, 
  startDateTime, 
  endDateTime 
});

// If found, update instead of create
if (dupCheck.ok && dupCheck.events.length > 0) {
  console.log(`Found ${dupCheck.events.length} existing event(s)`);
  const existingEvent = dupCheck.events[0];
  result = await calendar.events.update({
    calendarId,
    eventId: existingEvent.id,
    requestBody: event,
  });
  return { ok: true, eventId: result.data.id, action: 'updated' };
}
```

### Database Event ID Tracking

The `plans` table stores event IDs:
- `BreakfastGoogleEventId`
- `LunchGoogleEventId`
- `DinnerGoogleEventId`

These IDs ensure each meal slot syncs to exactly one Google Calendar event. On re-sync, the app updates the existing event instead of creating duplicates.

---

## Files Modified

1. **src/main/google-calendar.js** (47 lines changed)
   - Added `findDuplicateEvents()` function
   - Enhanced `upsertGoogleEvent()` with duplicate check
   - Exported new function

2. **src/main/api.js** (70 lines added)
   - Added `checkGoogleCalendarDuplicates()` function
   - Added to API handler switch

3. **src/renderer/index.html** (46 lines changed)
   - Added duplicate check button
   - Added status display area
   - Added `checkForDuplicates()` function
   - Bound event listener
   - Enabled button when authenticated

---

## Next Steps

### If User Confirms Calendar Overlay
- No further code changes needed
- User follows device calendar settings guide in `CHECK_DUPLICATES.md`

### If User Confirms Actual Duplicates
- Need user to provide:
  - Event IDs from duplicate check report
  - Screenshots of google.com showing both events
  - Terminal logs from sync showing event creation
- Investigate if multiple sync calls happening
- Check database for corrupted event IDs

---

## Prevention Summary

✅ **Code-level prevention:**
- Duplicate search before creation
- Event ID tracking in database
- Single API call per meal slot

✅ **User-level diagnostics:**
- Duplicate check button
- Clear status messages
- Actionable guidance

✅ **Documentation:**
- `CHECK_DUPLICATES.md` with step-by-step diagnosis
- This summary for developer reference
