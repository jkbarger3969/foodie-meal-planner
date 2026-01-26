# Google Calendar Sync Fixes - Summary

## Issues Fixed

### 1. ❌ Meals Not Syncing (Created: 0, Updated: 0)
**Problem:** Sync function couldn't find any meals to sync.

**Root Cause:** The function was reading from `planStart` and `planEnd` fields in the Planner tab, which might not match the meals you want to sync.

**Solution:** 
- Added dedicated date range inputs in the Google Calendar Sync section
- `googleSyncStart` and `googleSyncEnd` fields
- Default to current week (today + 6 days)
- Now you can control exactly which date range to sync

**Debug Logging Added:**
- Backend logs show which plans were found
- Shows meal titles, recipe IDs, and event IDs for each slot
- Helps diagnose why meals aren't syncing

### 2. ❌ No Date Range Selection
**Problem:** Could only sync whatever was in the main planner view.

**Solution:**
- Added two date input fields: "Sync Start Date" and "Sync End Date"
- Pre-filled with current week
- Independent from planner view dates
- You can sync any range (past, future, custom)

### 3. ❌ UI Layout Issues
**Problem:** Sync button was in a separate column from the calendar dropdown.

**Solution:**
- Moved sync button inline with calendar dropdown
- Button now appears to the right of the dropdown
- Cleaner, more compact layout
- Changed button text to "🌐 Sync" (shorter)

## File Changes

### src/renderer/index.html

**UI Changes (lines 899-920):**
```html
<div class="col-3">
  <label>Sync Start Date</label>
  <input type="date" id="googleSyncStart">
</div>
<div class="col-3">
  <label>Sync End Date</label>
  <input type="date" id="googleSyncEnd">
</div>
<div class="col-6">
  <label>Target Google Calendar</label>
  <div style="display: flex; gap: 8px; align-items: flex-start;">
    <select id="googleCalendarSelect" disabled style="flex: 1;">
      <option value="">-- Select calendar --</option>
      <option value="primary">Primary</option>
    </select>
    <button class="primary" id="btnGoogleCalSync" disabled>🌐 Sync</button>
  </div>
  ...
</div>
```

**JavaScript Changes (lines 5110-5143):**
```javascript
async function syncToGoogleCalendar() {
  const start = document.getElementById('googleSyncStart').value;  // NEW
  const end = document.getElementById('googleSyncEnd').value;      // NEW
  const calendarId = document.getElementById('googleCalendarSelect').value;
  
  // Validation...
  
  console.log('[Google Calendar Sync] Start:', start, 'End:', end, 'CalendarId:', calendarId);
  
  const res = await api('googleCalendarSyncRange', { start, end, calendarId });
  
  console.log('[Google Calendar Sync] Result:', res);
  
  // Show result with checkmark and auto-clear after 5 seconds
  document.getElementById('googleSyncStatus').textContent = `✓ Synced. Created: ${res.created||0}, Updated: ${res.updated||0}`;
  setTimeout(() => {
    document.getElementById('googleSyncStatus').textContent = '';
  }, 5000);
}
```

**Init Changes (lines 6348-6350):**
```javascript
// Set default dates for Google Calendar sync
document.getElementById('googleSyncStart').value = today;
document.getElementById('googleSyncEnd').value = weekEnd;
```

### src/main/api.js

**Debug Logging (lines 2026-2103):**
```javascript
console.log('[googleCalendarSyncRange] Start:', start, 'End:', end, 'CalendarId:', calendarId);
console.log('[googleCalendarSyncRange] Found plans:', plans.length);
console.log('[googleCalendarSyncRange] Processing date:', dateId, 'Plan:', JSON.stringify(p, null, 2));
console.log(`[googleCalendarSyncRange] ${dateId} ${s.slot}: Title="${mealTitle}", RecipeId="${mealRid}", EventId="${existingEventId}"`);
console.log(`[googleCalendarSyncRange] Creating/updating event: "${title}" from ${startDateTime} to ${endDateTime}`);
console.log(`[googleCalendarSyncRange] Event result:`, result);
console.log('[googleCalendarSyncRange] Final counts - Created:', created, 'Updated:', updated);
```

## How to Test

### 1. Restart the App
```bash
npm run dev
```

### 2. Add Some Meals
- Go to **Planner** tab
- Add meals for today and the next few days
- Example: 
  - Today Dinner: "Spaghetti Bolognese"
  - Tomorrow Breakfast: "Pancakes"
  - Tomorrow Dinner: "Grilled Chicken"

### 3. Sync to Google Calendar
- Go to **Settings** tab
- Scroll to **Google Calendar Sync** section
- Verify the date range is set (should default to this week)
  - Sync Start Date: Today
  - Sync End Date: 6 days from today
- Click **🌐 Sync** button
- **Open the browser DevTools** to see debug logs (View → Developer → Developer Tools)

### 4. Check Console Logs
You should see logs like:
```
[Google Calendar Sync] Start: 2026-01-14 End: 2026-01-20 CalendarId: primary
[googleCalendarSyncRange] Start: 2026-01-14 End: 2026-01-20 CalendarId: primary
[googleCalendarSyncRange] Found plans: 2
[googleCalendarSyncRange] Processing date: 2026-01-14 Plan: { Date: '2026-01-14', DinnerTitle: 'Spaghetti Bolognese', ... }
[googleCalendarSyncRange] 2026-01-14 Dinner: Title="Spaghetti Bolognese", RecipeId="rec_123", EventId=""
[googleCalendarSyncRange] Creating/updating event: "Dinner: Spaghetti Bolognese" from 2026-01-14T18:00:00 to 2026-01-14T19:00:00
[googleCalendarSyncRange] Event result: { ok: true, eventId: 'abc123', action: 'created' }
[googleCalendarSyncRange] Final counts - Created: 1 Updated: 0
[Google Calendar Sync] Result: { ok: true, created: 1, updated: 0 }
```

### 5. Verify in Google Calendar
- Open https://calendar.google.com
- Look for events at:
  - Today 6:00 PM: "Dinner: Spaghetti Bolognese"
  - Tomorrow 8:00 AM: "Breakfast: Pancakes"
  - Tomorrow 6:00 PM: "Dinner: Grilled Chicken"

## Troubleshooting

### Still Shows "Created: 0, Updated: 0"

Check the console logs to see:

**If logs show "Found plans: 0":**
- No meal plans exist in the database for that date range
- Go to Planner tab and add some meals first
- Make sure the dates match the sync range

**If logs show "Found plans: X" but meals have no titles:**
- The meals might be stored incorrectly
- Check logs for: `Title="", RecipeId=""`
- This means the database has empty values
- Try adding meals again through the Planner UI

**If logs show titles but no events created:**
- Check for error messages in the logs
- Look for `Failed to sync` messages
- Common issues:
  - Not authenticated (run through OAuth flow again)
  - Invalid calendar ID (try "primary")
  - Network error (check internet connection)
  - Google API error (check Cloud Console quotas)

### How to Debug Further

**1. Check Database Directly:**
```bash
# Open the SQLite database
sqlite3 ~/Library/Application\ Support/foodie-meal-planner-desktop/foodie.sqlite

# Check plans table
SELECT Date, DinnerTitle, DinnerRecipeId FROM plans WHERE Date >= '2026-01-14' LIMIT 10;
```

You should see meal titles populated.

**2. Check Console for Errors:**
- Open DevTools (View → Developer → Developer Tools)
- Click Console tab
- Look for red error messages
- Look for `[googleCalendarSyncRange]` logs

**3. Test with Specific Date:**
- Set Sync Start Date to a date you KNOW has meals
- Set Sync End Date to the same date
- Click Sync
- Should sync just that one day

## UI Preview

**Before:**
```
┌─────────────────────────────────────────────┐
│ Target Google Calendar                      │
│ [Primary ▼]                                 │
│ [Refresh Calendar List]                     │
├─────────────────────────────────────────────┤
│ Actions                                     │
│ [🌐 Sync to Google Calendar]                │
│ Status: ...                                 │
└─────────────────────────────────────────────┘
```

**After:**
```
┌───────────────┬──────────────┬────────────────────────────┐
│ Sync Start    │ Sync End     │ Target Google Calendar     │
│ [2026-01-14]  │ [2026-01-20] │ [Primary ▼] [🌐 Sync]    │
│               │              │ [Refresh Calendar List]    │
│               │              │ Status: ...                │
└───────────────┴──────────────┴────────────────────────────┘
```

## Summary

✅ **Fixed:** Sync uses dedicated date range inputs  
✅ **Fixed:** Button is inline with calendar selector  
✅ **Added:** Debug logging to diagnose sync issues  
✅ **Added:** Auto-populated date range (current week)  
✅ **Added:** Status message clears after 5 seconds  
✅ **Improved:** Console logs show exactly what's being synced

**Test it now and check the console logs to see if meals are being found!**
