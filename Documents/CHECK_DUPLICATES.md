# Google Calendar Duplicate Events - Diagnostic Steps

## Quick Check (2 minutes)

### Step 1: Verify on Google Calendar Web
1. Open https://calendar.google.com in your browser
2. Find one of the meal events (e.g., "Breakfast: Tortillas de Harina")
3. Click on the event
4. **Question: Do you see ONE event or TWO separate events?**

**If ONE event:** This is a calendar overlay issue (see Step 2)  
**If TWO events:** This is a sync bug (see Step 3)

---

### Step 2: Calendar Overlay Issue (Most Likely)

If you see only ONE event on Google Calendar web, the duplicate on your device is caused by multiple calendar views.

**On your secondary device:**

#### iOS/iPhone/iPad:
1. Open **Settings** → **Calendar** → **Accounts**
2. Check how many Google accounts are listed
3. For each account, tap it and check which calendars are synced
4. **Fix:** Turn off duplicate calendar subscriptions

OR:

1. Open **Calendar app** on device
2. Tap **Calendars** at the bottom
3. Look for duplicate entries (e.g., two "Primary" calendars from different accounts)
4. **Fix:** Uncheck one of the duplicate calendars

#### Android:
1. Open **Calendar app**
2. Tap **Menu (☰)** → **Settings**
3. Check each Google account and see which calendars are synced
4. **Fix:** Uncheck the duplicate calendar

---

### Step 3: Actual Duplicate Events (Less Likely)

If you see TWO separate events on Google Calendar web:

**Check the event details:**
1. Click the first event → Note the time and description
2. Click the second event → Note the time and description
3. Check if both have `RecipeId: xxx` in the description

**Report back with:**
- Event 1 time: _______________
- Event 1 description: _______________
- Event 2 time: _______________  
- Event 2 description: _______________

This information will help diagnose if Foodie is creating duplicates.

---

## Expected Behavior

✅ **Correct:** ONE event per meal slot per day  
❌ **Wrong:** TWO events per meal slot per day

## Current Sync Stats

After the last sync, you should see:
- 6 days × 3 meals = 18 events total
- Each event appears once in Google Calendar
- Same event visible across all your devices

## Need Help?

Reply with:
1. Result from Step 1 (ONE or TWO events on web?)
2. Device type showing duplicates (iOS/Android/other)
3. Screenshot if possible
