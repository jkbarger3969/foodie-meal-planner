# Google Calendar Sync - Layout Fix & Duplicate Prevention

## Layout Fix Applied ✅

### Problem
The date fields and calendar dropdown were not properly aligned - they looked misaligned and horrible.

### Solution
Changed the layout to use proper column sizing with `align-items: flex-end` to align all fields at the bottom:

**New Layout:**
```
┌────────────┬────────────┬─────────────────────────┬──────────────────────┐
│ Start Date │ End Date   │ Target Google Calendar  │                      │
│ [Date ▼]   │ [Date ▼]   │ [Primary ▼]            │ [🌐 Sync to Google]  │
└────────────┴────────────┴─────────────────────────┴──────────────────────┘
│ [Refresh Calendar List]                                                  │
│ Status: ...                                                              │
└──────────────────────────────────────────────────────────────────────────┘
```

**Column Distribution:**
- Start Date: 2 columns (col-2)
- End Date: 2 columns (col-2)
- Target Calendar: 5 columns (col-5)
- Sync Button: 3 columns (col-3)

All fields now align perfectly on the same baseline thanks to `align-items: flex-end` on the row.

---

## Duplicate Prevention - Already Built In! ✅

### Your Question: "If I sync the calendar more than once will duplicates be created?"

**Answer: NO! Duplicates will NOT be created.**

The system is designed to prevent duplicates using event ID tracking.

### How It Works

#### First Sync (Creates Events)

**Step 1:** You have meals in your planner
```
Date: 2026-01-14
- Breakfast: "Pancakes"          (BreakfastGoogleEventId: empty)
- Lunch: "Salad"                 (LunchGoogleEventId: empty)
- Dinner: "Spaghetti Bolognese"  (DinnerGoogleEventId: empty)
```

**Step 2:** You click "🌐 Sync to Google Calendar"

**Step 3:** System creates events in Google Calendar
```javascript
// For each meal:
if (!existingEventId) {
  // No event ID stored → CREATE new event
  result = await calendar.events.insert({
    calendarId: 'primary',
    requestBody: {
      summary: 'Dinner: Spaghetti Bolognese',
      start: { dateTime: '2026-01-14T18:00:00' },
      end: { dateTime: '2026-01-14T19:00:00' }
    }
  });
  
  // Google returns: eventId = 'abc123xyz'
}
```

**Step 4:** System stores event IDs in database
```sql
UPDATE plans 
SET DinnerGoogleEventId = 'abc123xyz',
    UpdatedAt = datetime('now')
WHERE Date = '2026-01-14';
```

**Result in Database:**
```
Date: 2026-01-14
- DinnerGoogleEventId: "abc123xyz"  ← Stored for future updates
```

#### Second Sync (Updates Same Events)

**Step 1:** You edit the meal title
```
Date: 2026-01-14
- Dinner: "Spaghetti with Meatballs"  (changed title)
  DinnerGoogleEventId: "abc123xyz"
```

**Step 2:** You click "🌐 Sync to Google Calendar" again

**Step 3:** System UPDATES the existing event (no duplicate)
```javascript
// For each meal:
if (existingEventId) {
  // Event ID found → UPDATE existing event
  result = await calendar.events.update({
    calendarId: 'primary',
    eventId: 'abc123xyz',  // ← Uses stored ID
    requestBody: {
      summary: 'Dinner: Spaghetti with Meatballs',  // ← Updated title
      start: { dateTime: '2026-01-14T18:00:00' },
      end: { dateTime: '2026-01-14T19:00:00' }
    }
  });
}
```

**Result:** Same event updated, no duplicate created!

### Code Implementation

**Backend: `src/main/api.js` (lines 2049-2098)**
```javascript
for (const s of slots) {
  const mealTitle = String(p[s.titleCol] || '').trim();
  const existingEventId = String(p[s.evCol] || '').trim();  // ← Get stored event ID
  
  // ... create event data ...
  
  const result = await googleCal.upsertGoogleEvent({
    calendarId,
    eventId: existingEventId || null,  // ← Pass stored ID (or null for new)
    title,
    description,
    startDateTime,
    endDateTime
  });
  
  // Store event ID for next sync
  db().prepare(`UPDATE plans SET ${s.evCol}=?, UpdatedAt=datetime('now') WHERE Date=?`)
    .run(result.eventId, dateId);
}
```

**Google Calendar Module: `src/main/google-calendar.js` (lines 132-184)**
```javascript
async function upsertGoogleEvent({ calendarId, eventId, title, description, startDateTime, endDateTime }) {
  const event = { /* ... event data ... */ };
  
  if (eventId) {
    // ✅ Event ID provided → UPDATE existing event
    try {
      result = await calendar.events.update({
        calendarId,
        eventId,
        requestBody: event,
      });
      return { ok: true, eventId: result.data.id, action: 'updated' };
    } catch (updateError) {
      // Event was deleted from Google Calendar → create new one
      if (updateError.code === 404) {
        result = await calendar.events.insert({ /* ... */ });
        return { ok: true, eventId: result.data.id, action: 'created' };
      }
      throw updateError;
    }
  } else {
    // ✅ No event ID → CREATE new event
    result = await calendar.events.insert({
      calendarId,
      requestBody: event,
    });
    return { ok: true, eventId: result.data.id, action: 'created' };
  }
}
```

### Database Schema

The `plans` table stores event IDs for each meal slot:

```sql
CREATE TABLE plans (
  Date TEXT PRIMARY KEY,
  
  BreakfastRecipeId TEXT,
  BreakfastTitle TEXT,
  BreakfastGoogleEventId TEXT,    ← Stores Google Calendar event ID
  
  LunchRecipeId TEXT,
  LunchTitle TEXT,
  LunchGoogleEventId TEXT,        ← Stores Google Calendar event ID
  
  DinnerRecipeId TEXT,
  DinnerTitle TEXT,
  DinnerGoogleEventId TEXT,       ← Stores Google Calendar event ID
  
  -- Apple Calendar event IDs (separate)
  BreakfastEventId TEXT,
  LunchEventId TEXT,
  DinnerEventId TEXT,
  
  UpdatedAt TEXT
);
```

### Edge Cases Handled

#### Case 1: Event Deleted from Google Calendar
If you manually delete an event from Google Calendar but the database still has the event ID:

```javascript
if (eventId) {
  try {
    // Try to update
    result = await calendar.events.update({ ... });
  } catch (updateError) {
    if (updateError.code === 404) {
      // Event not found → create new one
      result = await calendar.events.insert({ ... });
      return { ok: true, eventId: result.data.id, action: 'created' };
    }
  }
}
```

**Result:** New event created with new ID, stored in database.

#### Case 2: Meal Removed from Planner
If you remove a meal from the planner but Google Calendar still has the event:

```javascript
if (!mealTitle) {
  // Delete event if it exists
  if (existingEventId) {
    await googleCal.deleteGoogleEvent({ calendarId, eventId: existingEventId });
    db().prepare(`UPDATE plans SET ${s.evCol}='', UpdatedAt=datetime('now') WHERE Date=?`).run(dateId);
  }
  continue;
}
```

**Result:** Event deleted from Google Calendar, event ID cleared from database.

#### Case 3: Multiple Syncs Without Changes
If you sync the same meals multiple times without changing anything:

**Result:** Each meal is updated in place. Google Calendar shows `Updated: X` but no duplicates. The event content stays the same.

### Verification

**To verify no duplicates are created:**

1. Add a meal (e.g., "Test Dinner" for today)
2. Sync → Check console: `Created: 1, Updated: 0`
3. Check Google Calendar → 1 event appears
4. Sync again (without changes) → Check console: `Created: 0, Updated: 1`
5. Check Google Calendar → Still only 1 event (same one, updated)
6. Change meal title to "Test Dinner v2"
7. Sync again → Check console: `Created: 0, Updated: 1`
8. Check Google Calendar → Still only 1 event (title updated)

**Database Check:**
```bash
sqlite3 ~/Library/Application\ Support/foodie-meal-planner-desktop/foodie.sqlite
SELECT Date, DinnerTitle, DinnerGoogleEventId FROM plans WHERE Date = '2026-01-14';
```

Should show:
```
2026-01-14|Test Dinner v2|abc123xyz
```

Same event ID even after multiple syncs!

---

## Summary

### Layout
✅ **Fixed:** All fields now align perfectly on one row  
✅ **Columns:** 2 + 2 + 5 + 3 = 12 (proper grid)  
✅ **Alignment:** `align-items: flex-end` keeps baselines aligned  

### Duplicate Prevention
✅ **Built-in:** Event IDs stored in database  
✅ **First sync:** Creates new events, stores IDs  
✅ **Subsequent syncs:** Updates same events using stored IDs  
✅ **No duplicates:** Guaranteed by design  
✅ **Cleanup:** Events deleted when meals removed  

**You can sync as many times as you want - duplicates will never be created!**

---

## Test It

1. Restart the app: `npm run dev`
2. Go to Settings → Google Calendar Sync
3. Notice the improved layout ✨
4. Sync once → Note the event IDs in console
5. Sync again → See "Updated" count instead of "Created"
6. Check Google Calendar → Only one event per meal!
