# Google Calendar Time Zone Fix

## Issue
Calendar events were showing incorrect times:
- Breakfast: 11am-12pm (should be 8am-9am)
- Lunch: 3pm-4pm (should be 12pm-1pm)
- Dinner: 9:30pm-10:30pm (should be 6:30pm-7:30pm)

## Root Cause
The timezone was hardcoded to `'America/Los_Angeles'` (Pacific Time, UTC-8), but the user's system is in `'America/New_York'` (Eastern Time, UTC-5).

This caused a 3-hour offset:
- 8am PT → 11am ET
- 12pm PT → 3pm ET
- 6:30pm PT → 9:30pm ET

## Fix
Changed timezone in `src/main/google-calendar.js` line 168 and 172:
- **Before:** `timeZone: 'America/Los_Angeles'`
- **After:** `timeZone: 'America/New_York'`

## Test
1. Re-sync your meals to Google Calendar
2. Events should now show correct times:
   - Breakfast: 8:00am - 9:00am
   - Lunch: 12:00pm - 1:00pm
   - Dinner: 6:30pm - 7:30pm

## File Modified
- `src/main/google-calendar.js` (lines 168, 172)
