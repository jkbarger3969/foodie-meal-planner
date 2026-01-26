# Google Calendar Authorization Persistence - Complete Fix

## Problem
Google Calendar authorization was **NOT persistent** in dev mode (`npm run dev`). Users had to re-authorize every time they restarted the app.

## Root Causes (Two Issues Fixed)

### Issue 1: Wrong userData Folder Path
**File:** `src/main/google-calendar.js` (lines 18-19 originally)

**Problem:** Paths were calculated at module load time (before `app.setName()`)
- Dev mode used: `~/Library/Application Support/foodie-meal-planner-desktop/`
- Production used: `~/Library/Application Support/Foodie Meal Planner/`

**Fix:** Changed to lazy-loaded functions
```javascript
function getCredentialsPath() {
  const credPath = path.join(app.getPath('userData'), 'google-credentials.json');
  console.log('[google-calendar] Credentials path:', credPath);
  return credPath;
}

function getTokenPath() {
  const tokenPath = path.join(app.getPath('userData'), 'google-token.json');
  console.log('[google-calendar] Token path:', tokenPath);
  return tokenPath;
}
```

### Issue 2: Credentials Never Loaded on Startup
**File:** `src/main/api.js` (function `getGoogleCalendarStatus`)

**Problem:** The app checked for credentials but **never initialized the Google Calendar API** with them.

**Before:**
```javascript
function getGoogleCalendarStatus() {
  const authenticated = googleCal.isAuthenticated();  // Always false - oauth2Client is null!
  const credentialsResult = googleCal.loadCredentials();  // Loads but doesn't use them!
  
  return ok_({
    authenticated,
    hasCredentials: credentialsResult.ok
  });
}
```

**After:**
```javascript
async function getGoogleCalendarStatus() {
  // Auto-initialize if credentials exist but not yet loaded
  if (!googleCal.isAuthenticated()) {
    const credentialsResult = googleCal.loadCredentials();
    if (credentialsResult.ok && credentialsResult.credentials) {
      // Initialize Google Calendar API with stored credentials
      await googleCal.initializeGoogleCalendar(credentialsResult.credentials);
    }
  }
  
  const authenticated = googleCal.isAuthenticated();
  const credentialsResult = googleCal.loadCredentials();
  
  return ok_({
    authenticated,
    hasCredentials: credentialsResult.ok
  });
}
```

## Complete Fix Summary

### Files Modified

1. **src/main/google-calendar.js**
   - Lines 17-28: Changed path constants to lazy-loaded functions
   - Lines 33-69: Added debug logging to initialization
   - Updated 5 function calls to use new path functions

2. **src/main/api.js**
   - Lines 2166-2193: Made `getGoogleCalendarStatus()` async
   - Added auto-initialization logic
   - Added debug logging

## How It Works Now

### App Startup Flow (Fixed)
1. User starts app with `npm run dev`
2. Frontend calls `checkGoogleCalendarStatus()` on load
3. Backend `getGoogleCalendarStatus()` executes:
   - Checks if authenticated (initially `false` - `oauth2Client` is `null`)
   - Loads credentials from disk (`google-credentials.json`)
   - **Calls `initializeGoogleCalendar(credentials)`**
   - Loads token from disk (`google-token.json`)
   - Sets credentials on `oauth2Client`
   - Creates Google Calendar API client
4. Returns `{ authenticated: true, hasCredentials: true }`
5. UI shows: `✓ Configured & Authorized`

### Re-launch Flow (Fixed)
1. User quits and restarts app
2. Same startup flow executes
3. Credentials and token loaded from **same folder** (`Foodie Meal Planner`)
4. User remains authenticated - **no re-authorization needed!**

## Testing Instructions

### Terminal 1: Watch Logs
```bash
npm run dev
```

**Look for these log messages:**
```
[getGoogleCalendarStatus] Checking Google Calendar status...
[getGoogleCalendarStatus] Not authenticated, checking for stored credentials...
[getGoogleCalendarStatus] Credentials found, initializing Google Calendar...
[google-calendar] Initializing Google Calendar API...
[google-calendar] Credentials path: /Users/.../Foodie Meal Planner/google-credentials.json
[google-calendar] OAuth2 client created
[google-calendar] Token path: /Users/.../Foodie Meal Planner/google-token.json
[google-calendar] Loading existing token from: /Users/.../Foodie Meal Planner/google-token.json
[google-calendar] Token loaded successfully
[google-calendar] Calendar API initialized
[getGoogleCalendarStatus] Result: authenticated = true , hasCredentials = true
```

### In App: Verify Persistence
1. **First Launch:**
   - Go to Settings → Google Calendar Sync
   - Should show: `✓ Configured & Authorized`
   - Sync buttons should be enabled

2. **Restart Test:**
   - Quit app (Cmd+Q)
   - Start again: `npm run dev`
   - Go to Settings → Google Calendar Sync
   - Should **STILL** show: `✓ Configured & Authorized`
   - No re-authorization needed!

3. **Sync Test:**
   - Click "🌐 Sync to Google Calendar"
   - Should work immediately without auth prompts

## Debug Logging

All key operations now log to terminal:
- Path resolution (credentials and token paths)
- Initialization status
- Token loading
- Authentication status

**To check paths manually:**
```bash
./check-google-auth-persistence.sh
```

## Production Build

When you build the app:
```bash
npm run package
```

The packaged app will:
- Use same `Foodie Meal Planner` userData folder
- Load credentials on startup automatically
- Persist authorization across:
  - App restarts
  - macOS reboots
  - App updates/upgrades

## Result

✅ **Dev mode:** Authorization persists across restarts
✅ **Production:** Authorization persists across restarts
✅ **Same userData folder:** Dev and production share credentials
✅ **Auto-initialization:** Credentials loaded on startup
✅ **One-time auth:** Authorize once, works forever

## Files Changed
- `src/main/google-calendar.js` (35 lines modified)
- `src/main/api.js` (27 lines modified)
- `check-google-auth-persistence.sh` (diagnostic script)
- `GOOGLE_CALENDAR_PERSISTENCE_FIX.md` (this document)
