# Google Calendar Showing Duplicate Events

## Issue
Events show once on one device but twice on another device.

## Possible Causes

### 1. Actual Duplicate Events in Google Calendar

**Symptoms:**
- Event appears twice on calendar.google.com (web)
- Both copies have different event IDs
- Clicking on them shows they are separate events

**How to Check:**
1. Go to https://calendar.google.com on your computer
2. Click on the duplicated event
3. Check if there are actually TWO events at the same time
4. Click on each one - do they have different details?

**Cause:**
This would mean the Foodie app created duplicates (bug in our code).

**Fix:**
Delete the duplicate events manually, then we'll investigate why duplicates were created.

---

### 2. Calendar Overlay (Multiple Calendars Showing Same Event)

**Symptoms:**
- Only ONE event exists in Google Calendar
- But it appears twice because two calendars are subscribed/overlaid
- Common with shared calendars

**How to Check:**
1. Go to https://calendar.google.com
2. Look at the left sidebar under "My calendars"
3. Check if you have multiple calendars checked:
   - Your primary calendar
   - A shared calendar (e.g., "Family Calendar")
   - Someone else's calendar
4. Click on the duplicate event
5. Look at which calendar it belongs to

**Cause:**
The event is in one calendar, but you're viewing multiple calendars that include it.

**Example:**
```
☑ My Calendar (keithbarger@gmail.com)
☑ Family Calendar (shared)
```

If the event is in "Family Calendar" but you ALSO subscribe to that calendar on your main account, it might show twice.

**Fix:**
On the device showing duplicates:
1. Open Calendar app
2. Go to Settings/Calendars
3. Uncheck one of the duplicate calendars
4. Or check which calendar the event is actually in and only view that one

---

### 3. Device Sync Lag (Temporary)

**Symptoms:**
- Shows duplicate right after syncing
- Disappears after a few minutes
- Only affects one device

**How to Check:**
1. Wait 5-10 minutes
2. Refresh the calendar app on the affected device
3. Check if duplicates are gone

**Cause:**
Google Calendar sync delay between devices.

**Fix:**
Just wait - should resolve itself.

---

### 4. Multiple Google Accounts Syncing Same Calendar

**Symptoms:**
- You have two Google accounts on the device
- Both accounts have access to the same calendar
- Device is syncing both

**How to Check:**
On the device showing duplicates:
1. Open Calendar app
2. Go to Settings → Accounts
3. Check if you have multiple Google accounts signed in
4. Check if both accounts are syncing the same calendar

**Cause:**
Device is pulling the same calendar from two different accounts.

**Fix:**
Disable calendar sync for one of the accounts, or remove one account from the device.

---

## Diagnostic Steps

### Step 1: Check Google Calendar Web
1. Go to https://calendar.google.com
2. Find one of the "duplicate" events
3. Click on it
4. **How many events are at that exact time and date?**
   - **ONE event** → Not actual duplicates, see Step 2
   - **TWO events** → Actual duplicates, see Step 3

### Step 2: Check Calendar Sidebar
1. On calendar.google.com, look at left sidebar
2. Under "My calendars", how many are checked?
3. **Which calendar is the event in?**
   - Click the event
   - Look for the calendar name (usually under the title)
4. **Try unchecking calendars one by one** to see which one makes the duplicate disappear

### Step 3: Check for Actual Duplicates
If there are truly TWO separate events:

1. **Click on the first event:**
   - Note the event ID (if visible)
   - Note the calendar it's in
   - Note the description (should say `RecipeId: rec_...`)

2. **Click on the second event:**
   - Is it identical?
   - Same calendar or different?
   - Same description?

3. **Delete one of them manually**

4. **Let me know so I can investigate why duplicates were created**

---

## Quick Test

Run this to check what was actually created:

**On your computer (where you synced):**
1. Open DevTools (Cmd + Option + I)
2. Go to Console tab
3. Run:
```javascript
api('googleCalendarSyncRange', { 
  start: '2026-01-14', 
  end: '2026-01-14', 
  calendarId: 'YOUR_CALENDAR_ID' 
}).then(res => console.log('Sync result:', res))
```

**Expected output:**
```
Sync result: { ok: true, created: 0, updated: 18 }
```

If it says `created: 0`, that means it UPDATED existing events (no duplicates created).
If it says `created: 18`, that means it created NEW events (possible duplicates).

---

## Most Likely Cause

Based on typical Google Calendar behavior:

**Hypothesis: Calendar Overlay**

You probably have:
1. A personal calendar: `keithbarger@gmail.com`
2. A shared calendar: `8a3c0eba74a209269b8d50b1b74d73d650c82a691c918a766f4e548871dbf8bb@group.calendar.google.com`

The events are in the shared calendar, but:
- On your computer: Only the shared calendar is visible (shows once)
- On your other device: Both calendars are synced (shows twice - once from each calendar subscription)

**Test this:**
On the device showing duplicates:
1. Open Calendar settings
2. Look for the long calendar ID: `8a3c0eba74a209269b8d50b1b74d73d650c82a691c918a766f4e548871dbf8bb@group.calendar.google.com`
3. Try unchecking it or your main calendar
4. See if duplicates disappear

---

## What to Share

Please check and share:

1. **On calendar.google.com (web):**
   - How many events show at the same time? (1 or 2?)
   - Which calendar is it in? (name/ID)

2. **On the device showing duplicates:**
   - What device is it? (iPhone, iPad, Mac, etc.)
   - How many Google accounts are signed in?
   - How many calendars are checked/synced?

3. **When you click one of the duplicates:**
   - Can you share a screenshot or tell me what calendar it says it belongs to?

This will help me determine if it's:
- A bug in the Foodie app (actual duplicates)
- A calendar configuration issue (overlay)
- A device sync issue
