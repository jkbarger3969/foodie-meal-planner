# Google Calendar Sync Troubleshooting - "Created: 0, Updated: 0"

## Issue: Sync Shows "Created: 0, Updated: 0"

This means the system couldn't find any meals to sync in the database for the selected date range.

## Root Cause Identified

**The database has plans BUT the meal titles are empty.**

### What I Found

```sql
-- Your database currently has:
Date: 2026-01-07
- All meal titles are EMPTY (no Breakfast, Lunch, or Dinner)

Date: 2026-01-14 (I added a test meal)
- Dinner: "Test Spaghetti" ← This WILL sync
```

**This is why sync shows 0/0** - the meals you see in the UI might not be saved to the database correctly.

---

## Quick Fix - Add a Test Meal Manually

I've already added a test meal to your database:

```sql
Date: 2026-01-14
Dinner: "Test Spaghetti"
```

**Try syncing NOW:**

1. Open the app
2. Go to Settings → Google Calendar Sync
3. Set date range:
   - Start: 2026-01-14
   - End: 2026-01-14
4. Click "🌐 Sync to Google Calendar"
5. Should show: **"Created: 1, Updated: 0"**
6. Check Google Calendar → Event at 6:00 PM: "Dinner: Test Spaghetti"

---

## How to Check What's in Your Database

Run this command in Terminal:

```bash
sqlite3 ~/Library/Application\ Support/foodie-meal-planner-desktop/foodie.sqlite "
SELECT Date, 
       BreakfastTitle, 
       LunchTitle, 
       DinnerTitle
FROM plans 
WHERE Date >= '2026-01-14' AND Date <= '2026-01-20'
ORDER BY Date;
"
```

**Expected output:**
```
2026-01-14||| Test Spaghetti
2026-01-15|Pancakes|Salad|Chicken
```

**If you see:**
```
2026-01-14|||
2026-01-15|||
```

→ Meals are NOT being saved to the database (all empty)

---

## Why Are Meals Not Being Saved?

There might be an issue with how meals are being added through the Planner UI.

### Step-by-Step: Add a Meal Properly

1. **Go to Planner tab**
2. **Click "Select" button** for a meal slot (e.g., Today Dinner)
3. **Select a recipe** from the picker
4. **Verify it appears** in the planner with the recipe title
5. **Go back to Terminal** and check database:

```bash
sqlite3 ~/Library/Application\ Support/foodie-meal-planner-desktop/foodie.sqlite "
SELECT Date, DinnerTitle, DinnerRecipeId 
FROM plans 
WHERE Date = '$(date +%Y-%m-%d)';
"
```

**Should show:**
```
2026-01-14|Your Recipe Name|rec_abc123
```

**If it shows empty:**
```
2026-01-14||
```

→ The meal is not being saved to the database (bug in the save logic)

---

## Debug Logs to Check

When you click "Sync", open DevTools (Cmd + Option + I) and look for these logs:

### Console Tab Should Show:

```
[Google Calendar Sync] Start: 2026-01-14 End: 2026-01-20 CalendarId: primary
[googleCalendarSyncRange] Start: 2026-01-14 End: 2026-01-20 CalendarId: primary
[googleCalendarSyncRange] Found plans: 1
[googleCalendarSyncRange] Processing date: 2026-01-14 Plan: {
  "Date": "2026-01-14",
  "DinnerTitle": "Test Spaghetti",
  "DinnerRecipeId": "rec_test_123",
  ...
}
[googleCalendarSyncRange] 2026-01-14 Dinner: Title="Test Spaghetti", RecipeId="rec_test_123", EventId=""
[googleCalendarSyncRange] Creating/updating event: "Dinner: Test Spaghetti" from 2026-01-14T18:00:00 to 2026-01-14T19:00:00
[googleCalendarSyncRange] Event result: { ok: true, eventId: 'abc123', action: 'created' }
[googleCalendarSyncRange] Final counts - Created: 1 Updated: 0
[Google Calendar Sync] Result: { ok: true, created: 1, updated: 0 }
```

### If You See:

**"Found plans: 0"**  
→ No plans in database for that date range  
→ Check your date range matches when you added meals

**"Found plans: 3" but all titles are empty**  
→ Plans exist but meals weren't saved properly  
→ Bug in the meal save logic

**"Title="" for all meals"**  
→ Database has empty values  
→ Need to fix how meals are being saved

---

## Manual Database Fix (Temporary)

If you want to add meals manually for testing:

```bash
sqlite3 ~/Library/Application\ Support/foodie-meal-planner-desktop/foodie.sqlite "
-- Add breakfast
UPDATE plans 
SET BreakfastTitle = 'Pancakes',
    BreakfastRecipeId = 'rec_pancakes',
    UpdatedAt = datetime('now')
WHERE Date = '2026-01-14';

-- Add lunch
UPDATE plans 
SET LunchTitle = 'Salad',
    LunchRecipeId = 'rec_salad',
    UpdatedAt = datetime('now')
WHERE Date = '2026-01-14';

-- Add dinner (already done)
UPDATE plans 
SET DinnerTitle = 'Spaghetti',
    DinnerRecipeId = 'rec_spaghetti',
    UpdatedAt = datetime('now')
WHERE Date = '2026-01-14';
"
```

Then sync again → Should show "Created: 3, Updated: 0"

---

## Real Fix - Add Meals Through the App

The proper way is to add meals through the Planner UI:

### Method 1: Meal Picker

1. Go to **Planner** tab
2. Click **"Select"** button for a meal slot
3. Search for a recipe
4. Click the recipe to select it
5. Meal should appear in the planner
6. **Verify in database** (command above)

### Method 2: Import/Generate

1. Go to **Planner** tab
2. Use **"Generate Meal Plan"** feature
3. Select recipes for each slot
4. Generate for the week
5. **Verify in database**

---

## Next Steps

1. **Test the manual meal I added:**
   - Sync date range: 2026-01-14 to 2026-01-14
   - Should create 1 event in Google Calendar

2. **Add meals through the UI:**
   - Use the Planner tab to add meals
   - Check database to verify they're saved
   - Then try syncing again

3. **Check DevTools console:**
   - Open DevTools (Cmd + Option + I)
   - Click Console tab
   - Sync again
   - Share the logs with me if still showing 0/0

4. **If meals aren't saving through the UI:**
   - There might be a bug in the meal save function
   - Check the console for error messages
   - Try adding different types of meals (regular vs leftovers)

---

## Summary

✅ **I added a test meal** to your database (2026-01-14 Dinner: "Test Spaghetti")  
✅ **Sync should now work** for that one meal  
⚠️ **Your other meals (2026-01-07) have empty titles** - that's why they don't sync  
❓ **Need to figure out why** meals added through the UI aren't being saved

**Try syncing the test meal now and let me know if it works!**

Then we can debug why your actual meals aren't saving properly.
