# Google OAuth "Blank Screen" Fix

## Problem
After signing into Google and clicking "Allow", you see:
- Blank white page
- URL says "Approved Clicked" or similar
- No authorization code displayed

## Root Cause
Google deprecated the default redirect URIs and now requires either:
1. A valid web server callback URL (not practical for desktop apps)
2. The special "out-of-band" (OOB) redirect URI: `urn:ietf:wg:oauth:2.0:oob`

## Solution Applied
Updated `src/main/google-calendar.js` to use the OOB redirect URI instead of reading from credentials file.

**Before:**
```javascript
oauth2Client = new google.auth.OAuth2(
  client_id,
  client_secret,
  redirect_uris[0]  // ❌ Uses whatever's in credentials file
);
```

**After:**
```javascript
oauth2Client = new google.auth.OAuth2(
  client_id,
  client_secret,
  'urn:ietf:wg:oauth:2.0:oob'  // ✅ Forces code display on screen
);
```

## How to Test

1. **Restart the app** (to load the updated code):
   ```bash
   npm run dev
   ```

2. **If you already uploaded credentials**, click "Revoke Access" first to reset:
   - Settings tab → Google Calendar Sync → Advanced Options → Revoke Access

3. **Upload credentials again**:
   - Settings tab → Upload `google-credentials.json`
   - Click "Load Credentials File"

4. **Click "Open Authorization Page"**:
   - Browser opens to Google sign-in
   - Sign in with your Google account
   - Click "Allow"

5. **Look for the authorization code**:
   - Page should now display: "Please copy this code, switch to your application and paste it there:"
   - Below it should be a text box with a long code like: `4/0AY0e-g7X...`
   - Copy this code

6. **Paste code back in app**:
   - Return to Foodie app
   - Paste code into "Enter Authorization Code" field
   - Click "Complete Authorization"
   - Should see: "✓ Authorized! Google Calendar is ready."

## If It Still Doesn't Work

### Option 1: Update Your Credentials File

Your existing credentials file might have the wrong redirect URI configured. Create a NEW OAuth client:

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Select your project
3. **APIs & Services** → **Credentials**
4. Click **"+ CREATE CREDENTIALS"** → **OAuth client ID**
5. Application type: **Desktop app**
6. Name: "Foodie Desktop App v2"
7. Click **CREATE**
8. Click **DOWNLOAD JSON**
9. Use this NEW credentials file in Foodie

### Option 2: Manual Redirect URI Update (Advanced)

If you want to keep your existing credentials:

1. Open `google-credentials.json` in a text editor
2. Find the `redirect_uris` section
3. Change it to:
   ```json
   "redirect_uris": ["urn:ietf:wg:oauth:2.0:oob"]
   ```
4. Save the file
5. Re-upload in Foodie app

Example of what the file should look like:

```json
{
  "installed": {
    "client_id": "YOUR_CLIENT_ID.apps.googleusercontent.com",
    "project_id": "foodie-meal-planner",
    "auth_uri": "https://accounts.google.com/o/oauth2/auth",
    "token_uri": "https://oauth2.googleapis.com/token",
    "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
    "client_secret": "YOUR_CLIENT_SECRET",
    "redirect_uris": ["urn:ietf:wg:oauth:2.0:oob"]
  }
}
```

## Expected Behavior After Fix

### Before Authorization:
- Settings tab shows: "Not configured"
- Upload credentials → "Credentials loaded. Please authorize."

### During Authorization:
- Click "Open Authorization Page" → browser opens
- Sign in with Google
- Grant permissions
- **See authorization code displayed on screen** ← This is the fix!
- Code looks like: `4/0AY0e-g7X_abc123...` (long alphanumeric string)

### After Authorization:
- Paste code → "✓ Authorized! Google Calendar is ready."
- Calendar dropdown populates
- "Sync to Google Calendar" button enabled

## Why This Happened

Google deprecated several OAuth flows for security:
- `http://localhost` redirect (requires local web server)
- Custom URI schemes (require app registration)
- Default redirect URIs in credentials file

The OOB flow (`urn:ietf:wg:oauth:2.0:oob`) is the simplest for desktop apps:
- No local web server needed
- Code displayed directly on screen
- User copies code manually
- Works reliably for desktop apps

## Future Considerations

Google has announced OOB will also be deprecated in the future. Alternative options:

**Option 1: Loopback IP (Recommended for future)**
- Use `http://127.0.0.1:PORT` as redirect URI
- Start temporary web server in app to catch redirect
- More complex but more modern

**Option 2: Custom URI Scheme**
- Register `foodie://oauth/callback` 
- Requires OS-level registration
- Works like "Open in App" on mobile

For now, OOB is the simplest and most reliable method for desktop OAuth.
