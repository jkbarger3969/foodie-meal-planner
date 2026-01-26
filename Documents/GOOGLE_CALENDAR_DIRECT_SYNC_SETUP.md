# Google Calendar Direct Sync - Complete Setup Guide

## Overview

This guide shows you how to set up **direct Google Calendar synchronization** in Foodie Meal Planner. Meals will sync directly to your shared Google Calendar under your Google account, even when running on your wife's computer.

**Key Benefits:**
- ✅ Direct sync to Google Calendar (no Apple Calendar needed)
- ✅ Syncs to YOUR Google account from any computer
- ✅ Instant synchronization (no 15-minute delay)
- ✅ Works on shared/family calendars
- ✅ Can be a different Google account than the one logged into macOS

---

## Part 1: Create Google Cloud Project & Get Credentials

### Step 1: Create Google Cloud Project (5 minutes)

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Sign in with YOUR Google account (the one with the calendar)
3. Click **Select a project** (top left, next to "Google Cloud")
4. Click **NEW PROJECT**
5. Enter project name: `Foodie Meal Planner`
6. Click **CREATE**
7. Wait for project to be created (~30 seconds)
8. Select the new project from the dropdown

### Step 2: Enable Google Calendar API (2 minutes)

1. In the left sidebar, go to **APIs & Services → Library**
2. Search for: `Google Calendar API`
3. Click on **Google Calendar API**
4. Click **ENABLE**
5. Wait for API to be enabled

### Step 3: Configure OAuth Consent Screen (5 minutes)

1. Go to **APIs & Services → OAuth consent screen**
2. Choose **External** user type
3. Click **CREATE**
4. Fill in required fields:
   - **App name**: `Foodie Meal Planner`
   - **User support email**: Your email
   - **Developer contact**: Your email
5. Click **SAVE AND CONTINUE**
6. On **Scopes** screen:
   - Click **ADD OR REMOVE SCOPES**
   - Search for: `calendar`
   - Check: **Google Calendar API** → `https://www.googleapis.com/auth/calendar`
   - Click **UPDATE**
   - Click **SAVE AND CONTINUE**
7. On **Test users** screen:
   - Click **+ ADD USERS**
   - Add YOUR email address (the Google account you want to sync to)
   - Add your wife's email if she has a different Google account
   - Click **ADD**
   - Click **SAVE AND CONTINUE**
8. Click **BACK TO DASHBOARD**

### Step 4: Create OAuth Credentials (3 minutes)

1. Go to **APIs & Services → Credentials**
2. Click **+ CREATE CREDENTIALS** (top)
3. Select **OAuth client ID**
4. Application type: **Desktop app**
5. Name: `Foodie Desktop`
6. Click **CREATE**
7. You'll see "OAuth client created" dialog
8. Click **DOWNLOAD JSON**
9. Save the file as: `google-credentials.json`
10. Keep this file safe - you'll need it shortly

**Important:** This credentials file is needed to authenticate. Keep it secure!

---

## Part 2: Install & Configure Foodie App

### Step 1: Install Updated Foodie (10 minutes)

The Google Calendar integration requires the latest version with new dependencies.

#### On Your Computer:

```bash
cd /Users/keithbarger/Projects/foodie-meal-planner-desktop

# Install googleapis package (if not already installed)
npm install

# Build the app
npm run build
```

This creates: `dist/Foodie Meal Planner-1.0.0.dmg`

#### On Wife's Computer:

1. Transfer the DMG file (AirDrop, USB, etc.)
2. Double-click to mount
3. Drag to Applications
4. Open from Applications folder
5. Grant permissions when prompted

### Step 2: Set Up Google Calendar Credentials (First Time)

#### On Wife's Computer (or yours, depending on who will use it):

1. **Open Foodie app**
2. Go to **Planner** tab
3. Scroll down to find **Google Calendar Setup** section
4. Click **"Setup Google Calendar"** button
5. A file picker dialog opens
6. Select the `google-credentials.json` file you downloaded earlier
7. Click **Open**
8. Status shows: "Credentials loaded. Ready to authorize."

### Step 3: Authorize Google Account (One Time)

1. Still in **Google Calendar Setup** section
2. Click **"Authorize Google Calendar"** button
3. Your default browser opens with Google sign-in
4. Sign in with YOUR Google account (the calendar owner)
5. You'll see a warning: "Google hasn't verified this app"
   - This is expected for personal projects
   - Click **Advanced**
   - Click **Go to Foodie Meal Planner (unsafe)**
6. Review permissions:
   - "See, edit, share, and permanently delete all the calendars you can access using Google Calendar"
   - This is required to create/update events
7. Click **Continue**
8. You'll see a page: "The authentication flow has completed"
9. Copy the **authorization code** shown on the page
10. Go back to Foodie app
11. Paste the code into the **"Authorization Code"** field
12. Click **"Complete Authorization"**
13. Status shows: "✓ Authorized! Google Calendar is ready."

### Step 4: Select Target Calendar (2 minutes)

1. Still in **Google Calendar Setup** section
2. Click **"List My Calendars"** button
3. A dropdown appears showing all your Google Calendars:
   - Primary (your main calendar)
   - Work
   - Family (if you have a shared one)
   - etc.
4. Select the calendar you want meals to sync to
   - **Recommendation**: Use "Primary" or create a dedicated "Meals" calendar
5. Selected calendar is saved automatically

---

## Part 3: Sync Meals to Google Calendar

### First Sync Test (2 minutes)

1. In Foodie, go to **Planner** tab
2. Add a test meal:
   - **Today, Dinner**: "Test Spaghetti"
3. In **Google Calendar Sync** section:
   - Click **"Sync to Google Calendar"** button
4. Status shows: "Syncing..."
5. Status updates: "Synced. Created: 1, Updated: 0"
6. Go to [calendar.google.com](https://calendar.google.com)
7. Look at today, 6:00 PM
8. You should see: **"Dinner: Test Spaghetti"**

✅ **Success!** Your meals are syncing directly to Google Calendar!

### Daily Usage

**Workflow:**
1. Add/edit meals in Foodie (on either computer)
2. Click **"Sync to Google Calendar"**
3. Meals appear in Google Calendar instantly
4. View on any device (phone, tablet, web)

**Notes:**
- Sync is manual (must click button)
- Updates existing events (no duplicates)
- Deleting meals in Foodie removes them from calendar
- Both computers can sync to same Google account

---

## Part 4: Using on Wife's Computer

### Scenario: She uses her computer, but syncs to YOUR calendar

This is the power of the direct Google Calendar integration!

**Setup:**
1. Install Foodie on her computer (Part 2, Step 1)
2. Point to shared database via iCloud (see below)
3. Use the SAME `google-credentials.json` file
4. Authorize with YOUR Google account (even on her computer)
5. Select YOUR calendar

**Result:**
- She plans meals on her computer
- Meals saved to shared database (both see same meals)
- She clicks "Sync to Google Calendar"
- Meals appear in YOUR Google Calendar
- You both see the calendar on your phones

### Shared Database Setup (Required)

For both computers to see the same meals:

1. Create iCloud folder:
   ```
   ~/Library/Mobile Documents/com~apple~CloudDocs/Foodie/
   ```
2. On BOTH computers:
   - Open Foodie
   - File → Set Database Folder (or check settings)
   - Select the iCloud folder above
3. Both computers now share meal plans

---

## Part 5: Advanced Configuration

### Using a Shared/Family Calendar

If you have a Google Family Calendar or shared calendar:

1. In Google Calendar (web):
   - Create a new calendar: "Family Meals"
   - Share it with family members
2. In Foodie:
   - Click "List My Calendars"
   - Select "Family Meals" from dropdown
   - Sync
3. All family members see meals in shared calendar

### Multiple Users, Same Calendar

**Setup:**
- Your computer: Authorize with your Google account
- Wife's computer: Authorize with your Google account (not hers)
- Both sync to same calendar

**OR:**

- Your computer: Authorize with your account, sync to "Primary"
- Wife's computer: Authorize with her account, sync to shared "Family Meals"
- Both need access to the shared calendar

### Automatic Sync (Future Enhancement)

Currently, sync is manual. To auto-sync after each meal change, you would need to modify the code to call the sync function automatically.

---

## Troubleshooting

### Issue: "Credentials not found"

**Solution:**
- Make sure you uploaded the `google-credentials.json` file
- Check it's the correct file (contains `client_id`, `client_secret`)
- Re-download from Google Cloud Console if needed

### Issue: "Not authenticated"

**Solution:**
- Complete the authorization flow again
- Make sure you copied the entire authorization code
- Check that your Google account is added as a test user

### Issue: "Token expired"

**Solution:**
- Re-authorize by clicking "Authorize Google Calendar" again
- The app should automatically refresh tokens, but if it doesn't, re-auth

### Issue: Events not appearing in Google Calendar

**Solution:**
- Check you selected the correct calendar
- Look in the right Google account (calendar.google.com)
- Refresh the calendar page
- Check sync status for errors

### Issue: "Failed to sync" errors

**Solution:**
- Check internet connection
- Verify Google Calendar API is still enabled in Cloud Console
- Check API quota (shouldn't be an issue for personal use)
- Re-authorize if token is invalid

### Issue: Duplicate events

**Solution:**
- Events should update, not duplicate
- If duplicates exist, delete them manually
- Make sure you're syncing to the same calendar ID
- Check that event IDs are being stored in database

---

## Security & Privacy

### What Data is Shared?

- **With Google**: Meal titles, times, recipe IDs (in description)
- **Stored locally**: OAuth tokens, calendar ID
- **NOT shared**: Recipes, ingredients, full database

### Credentials File

- Keep `google-credentials.json` secure
- Don't share publicly
- Don't commit to git
- Each user needs same file for shared calendar sync

### OAuth Tokens

- Stored locally in:
  ```
  ~/Library/Application Support/foodie-meal-planner-desktop/google-token.json
  ```
- Include refresh token (doesn't expire)
- Can be revoked from Google Account settings

### Revoking Access

To remove Foodie's access to your Google Calendar:

**Option 1: In Foodie**
- Click "Revoke Google Calendar Access" button

**Option 2: In Google Account**
1. Go to [myaccount.google.com/permissions](https://myaccount.google.com/permissions)
2. Find "Foodie Meal Planner"
3. Click "Remove Access"

---

## Comparison: Google vs Apple Calendar

| Feature | Google Calendar (Direct) | Apple Calendar (Old Method) |
|---------|-------------------------|----------------------------|
| Setup complexity | Medium (OAuth flow) | Easy (just calendar name) |
| Sync speed | Instant | Instant to Apple, 5-15 min to Google |
| Works on any computer | ✅ Yes (with credentials) | ⚠️ Only on same Mac |
| Syncs to your account | ✅ Yes | ⚠️ Needs iCloud or Google account linked |
| Shared calendars | ✅ Full support | ⚠️ Via iCloud only |
| Permission prompts | One-time OAuth | Every first sync (macOS) |
| Cross-platform potential | ✅ Could work on Windows/Linux | ❌ macOS only |

---

## Quick Reference

### File Locations

**Credentials:**
```
google-credentials.json (you download this)
~/Library/Application Support/foodie-meal-planner-desktop/google-credentials.json (app stores here)
```

**Token:**
```
~/Library/Application Support/foodie-meal-planner-desktop/google-token.json
```

**Database (Shared):**
```
~/Library/Mobile Documents/com~apple~CloudDocs/Foodie/foodie.sqlite
```

### Important URLs

- Google Cloud Console: https://console.cloud.google.com/
- Google Calendar: https://calendar.google.com/
- Manage App Permissions: https://myaccount.google.com/permissions

### Calendar Event Format

**Title:** `Dinner: Spaghetti Bolognese`
**Time:** 6:00 PM - 7:00 PM (configurable)
**Description:** `RecipeId: 123` (if from a recipe)

### Meal Times

- Breakfast: 8:00 AM - 9:00 AM
- Lunch: 12:00 PM - 1:00 PM
- Dinner: 6:00 PM - 7:00 PM

---

## Complete Setup Checklist

### One-Time Setup (Your Computer):

- [ ] Create Google Cloud project
- [ ] Enable Calendar API
- [ ] Configure OAuth consent screen
- [ ] Create OAuth credentials
- [ ] Download credentials JSON file
- [ ] Add yourself as test user
- [ ] Add wife as test user (if needed)

### First Computer Setup (Wife's Computer):

- [ ] Install Foodie app
- [ ] Point to shared database (iCloud)
- [ ] Upload credentials file
- [ ] Authorize with Google account
- [ ] Select target calendar
- [ ] Test sync with one meal
- [ ] Verify event appears in Google Calendar

### Second Computer Setup (Your Computer, Optional):

- [ ] Install Foodie app
- [ ] Point to same shared database
- [ ] Upload same credentials file
- [ ] Authorize with same Google account
- [ ] Select same calendar
- [ ] Test sync
- [ ] Verify both computers can sync

### Daily Use:

- [ ] Add meals in Foodie
- [ ] Click "Sync to Google Calendar"
- [ ] View meals on phone/web
- [ ] Update meals as needed
- [ ] Re-sync after changes

---

## Success Criteria

✅ **Setup is complete when:**

1. Google Cloud project created with Calendar API enabled
2. OAuth credentials downloaded
3. Foodie app installed on both computers
4. Both computers point to shared database
5. Google Calendar authorized successfully
6. Target calendar selected
7. Test meal syncs successfully
8. Event appears in Google Calendar
9. Event visible on phone via Google Calendar app
10. Both computers can sync to same calendar

---

## Next Steps

1. Complete setup using this guide
2. Test with a few meals
3. Verify sync on all devices
4. Share calendar with family members if desired
5. Plan your meals for the week!

---

**Need Help?**

- Check Troubleshooting section above
- Verify each step was completed
- Check Google Cloud Console for API errors
- Look at Foodie app console logs

**Estimated Total Setup Time:** 30-40 minutes (one-time)

**Daily Usage Time:** < 1 minute to sync after planning meals
