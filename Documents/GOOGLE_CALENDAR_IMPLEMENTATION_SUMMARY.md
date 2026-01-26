# Google Calendar Direct Integration - Implementation Summary

## What Was Implemented

Direct Google Calendar API integration so meals sync to YOUR Google Calendar account from any computer, bypassing Apple Calendar entirely.

## Files Created

### 1. src/main/google-calendar.js (NEW)
Complete Google Calendar API integration module with:
- OAuth2 authentication
- Token management (access + refresh tokens)
- Calendar listing
- Event creation/update/deletion
- Credential storage
- Token persistence

### 2. GOOGLE_CALENDAR_DIRECT_SYNC_SETUP.md (NEW)
Comprehensive setup guide with:
- Google Cloud project creation
- OAuth consent screen configuration
- Credential file download
- App installation
- Authorization flow
- Troubleshooting

## Files Modified

### 1. package.json
**Added dependency:**
```json
"googleapis": "^126.0.0"
```

### 2. src/main/db.js
**Added columns to `plans` table:**
- `BreakfastGoogleEventId TEXT`
- `LunchGoogleEventId TEXT`
- `DinnerGoogleEventId TEXT`

### 3. src/main/api.js
**Added imports:**
```javascript
const googleCal = require('./google-calendar');
```

**Added API functions:**
- `googleCalendarSyncRange()` - Syncs meal plan range to Google Calendar
- `initGoogleCalendar()` - Initializes with credentials
- `getGoogleAuthUrl()` - Gets OAuth URL for user authorization
- `setGoogleAuthCode()` - Exchanges auth code for tokens
- `listGoogleCalendars()` - Lists user's calendars
- `getGoogleCalendarStatus()` - Checks auth status
- `revokeGoogleCalendar()` - Revokes access

**Added to handleApiCall:**
```javascript
case 'googleCalendarSyncRange': return googleCalendarSyncRange(payload, store);
case 'initGoogleCalendar': return initGoogleCalendar(payload);
case 'getGoogleAuthUrl': return getGoogleAuthUrl();
case 'setGoogleAuthCode': return setGoogleAuthCode(payload);
case 'listGoogleCalendars': return listGoogleCalendars();
case 'getGoogleCalendarStatus': return getGoogleCalendarStatus();
case 'revokeGoogleCalendar': return revokeGoogleCalendar();
```

### 4. src/main/main.js
**Added to store defaults:**
```javascript
googleCalendarId: 'primary'
```

**Added IPC handler:**
```javascript
ipcMain.handle('foodie-set-google-calendar-id', async (_evt, { calendarId }) => {
  const v = String(calendarId || '').trim() || 'primary';
  store.set('googleCalendarId', v);
  return { ok: true, calendarId: v };
});
```

**Updated getSettings:**
```javascript
googleCalendarId: store.get('googleCalendarId') || 'primary'
```

### 5. src/main/preload.js
**Added function:**
```javascript
setGoogleCalendarId: (calendarId) => ipcRenderer.invoke('foodie-set-google-calendar-id', { calendarId })
```

### 6. src/renderer/index.html
**Added Google Calendar Sync UI section** (lines 843-930):
- Upload credentials file input
- Authorization button
- Auth code input
- Calendar selection dropdown
- Sync button
- Status displays
- Revoke access button

## JavaScript Functions Still Needed

The UI is in place but needs JavaScript event handlers. Add these functions:

### Required Functions (to add to index.html):

```javascript
// Google Calendar Setup Functions
async function uploadGoogleCredentials() {
  const fileInput = document.getElementById('googleCredentialsFile');
  const file = fileInput.files[0];
  if (!file) {
    document.getElementById('googleCredsStatus').textContent = 'No file selected';
    return;
  }

  const reader = new FileReader();
  reader.onload = async (e) => {
    try {
      const credentials = JSON.parse(e.target.result);
      const res = await api('initGoogleCalendar', { credentials });
      
      if (res.ok) {
        document.getElementById('googleCredsStatus').textContent = '✓ Credentials loaded';
        document.getElementById('btnGoogleAuthorize').disabled = false;
        await checkGoogleCalendarStatus();
      } else {
        document.getElementById('googleCredsStatus').textContent = `Error: ${res.error}`;
      }
    } catch (err) {
      document.getElementById('googleCredsStatus').textContent = `Error: Invalid JSON file`;
    }
  };
  reader.readAsText(file);
}

async function authorizeGoogleCalendar() {
  const res = await api('getGoogleAuthUrl', {});
  if (!res.ok) {
    document.getElementById('googleAuthStatus').textContent = `Error: ${res.error}`;
    return;
  }

  // Open authorization URL in browser
  window.open(res.authUrl, '_blank');
  
  // Show code input
  document.getElementById('googleAuthCodeRow').style.display = 'block';
  document.getElementById('googleAuthLink').href = res.authUrl;
  document.getElementById('googleAuthLink').style.display = 'inline';
  document.getElementById('googleAuthStatus').textContent = 'Sign in with Google and paste the authorization code below';
}

async function submitGoogleAuthCode() {
  const code = document.getElementById('googleAuthCode').value.trim();
  if (!code) {
    document.getElementById('googleAuthStatus').textContent = 'Please enter the authorization code';
    return;
  }

  document.getElementById('googleAuthStatus').textContent = 'Authorizing...';
  const res = await api('setGoogleAuthCode', { code });
  
  if (res.ok) {
    document.getElementById('googleAuthStatus').textContent = '✓ Authorized! Google Calendar is ready.';
    document.getElementById('googleAuthCodeRow').style.display = 'none';
    document.getElementById('googleAuthCode').value = '';
    await checkGoogleCalendarStatus();
    await listGoogleCalendars();
  } else {
    document.getElementById('googleAuthStatus').textContent = `Error: ${res.error}`;
  }
}

async function listGoogleCalendars() {
  const res = await api('listGoogleCalendars', {});
  if (!res.ok) {
    document.getElementById('googleSyncStatus').textContent = `Error: ${res.error}`;
    return;
  }

  const select = document.getElementById('googleCalendarSelect');
  select.innerHTML = '<option value="">-- Select calendar --</option>';
  
  for (const cal of res.calendars) {
    const option = document.createElement('option');
    option.value = cal.id;
    option.textContent = cal.name + (cal.primary ? ' (Primary)' : '');
    select.appendChild(option);
  }
  
  select.disabled = false;
  document.getElementById('btnGoogleCalSync').disabled = false;
}

async function syncToGoogleCalendar() {
  const start = document.getElementById('planStart').value;
  const endInput = document.getElementById('planEnd').value;
  const calendarId = document.getElementById('googleCalendarSelect').value;
  
  if (!start || !endInput) {
    document.getElementById('googleSyncStatus').textContent = 'Please set a date range in the planner';
    return;
  }
  
  if (!calendarId) {
    document.getElementById('googleSyncStatus').textContent = 'Please select a calendar';
    return;
  }

  // Save selected calendar
  await window.Foodie.setGoogleCalendarId(calendarId);

  const [sy, sm, sd] = start.split('-').map(Number);
  const [ey, em, ed] = endInput.split('-').map(Number);
  const startDate = new Date(sy, sm - 1, sd);
  const endDate = new Date(ey, em - 1, ed);
  const diffTime = endDate.getTime() - startDate.getTime();
  const days = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
  const end = addDays(start, days - 1);

  document.getElementById('googleSyncStatus').textContent = 'Syncing...';
  const res = await api('googleCalendarSyncRange', { start, end, calendarId });
  
  if (!res.ok) {
    document.getElementById('googleSyncStatus').textContent = `Error: ${res.error}`;
    return;
  }
  
  document.getElementById('googleSyncStatus').textContent = `Synced. Created: ${res.created||0}, Updated: ${res.updated||0}`;
}

async function revokeGoogleCalendar() {
  if (!confirm('This will remove Foodie\'s access to your Google Calendar. You\'ll need to re-authorize. Continue?')) {
    return;
  }

  const res = await api('revokeGoogleCalendar', {});
  if (res.ok) {
    document.getElementById('googleAuthStatus').textContent = 'Access revoked. Re-authorize to sync again.';
    document.getElementById('btnGoogleCalSync').disabled = true;
    document.getElementById('googleCalendarSelect').disabled = true;
    await checkGoogleCalendarStatus();
  }
}

async function checkGoogleCalendarStatus() {
  const res = await api('getGoogleCalendarStatus', {});
  if (res.ok) {
    if (res.authenticated) {
      document.getElementById('googleCredsStatus').textContent = '✓ Configured & Authorized';
      document.getElementById('btnListGoogleCals').disabled = false;
      document.getElementById('googleCalendarSelect').disabled = false;
      await listGoogleCalendars();
    } else if (res.hasCredentials) {
      document.getElementById('googleCredsStatus').textContent = 'Credentials loaded. Please authorize.';
      document.getElementById('btnGoogleAuthorize').disabled = false;
    }
  }
}

// Call on init
async function init() {
  // ... existing init code ...
  
  // Check Google Calendar status on startup
  await checkGoogleCalendarStatus();
}
```

### Event Listeners to Add (in bindUi function):

```javascript
// Google Calendar setup
document.getElementById('btnUploadGoogleCreds').addEventListener('click', uploadGoogleCredentials);
document.getElementById('btnGoogleAuthorize').addEventListener('click', authorizeGoogleCalendar);
document.getElementById('btnGoogleAuthSubmit').addEventListener('click', submitGoogleAuthCode);
document.getElementById('btnListGoogleCals').addEventListener('click', listGoogleCalendars);
document.getElementById('btnGoogleCalSync').addEventListener('click', syncToGoogleCalendar);
document.getElementById('btnRevokeGoogleCal').addEventListener('click', revokeGoogleCalendar);

// Calendar selection change
document.getElementById('googleCalendarSelect').addEventListener('change', async (e) => {
  const calendarId = e.target.value;
  if (calendarId) {
    await window.Foodie.setGoogleCalendarId(calendarId);
  }
});
```

## How It Works

### Authentication Flow

1. User downloads `google-credentials.json` from Google Cloud Console
2. User uploads file in Foodie app → calls `initGoogleCalendar()`
3. User clicks "Authorize" → opens Google OAuth page
4. User signs in and grants permissions
5. Google provides authorization code
6. User pastes code → calls `setGoogleAuthCode()` → exchanges for tokens
7. Tokens saved locally, refresh automatically

### Sync Flow

1. User selects target Google Calendar from dropdown
2. User clicks "Sync to Google Calendar"
3. Calls `googleCalendarSyncRange()` with date range
4. For each meal in range:
   - Creates/updates Google Calendar event
   - Stores event ID in database (`BreakfastGoogleEventId`, etc.)
   - Updates existing events (no duplicates)
5. Returns count of created/updated events

### Token Management

- **Access token**: Short-lived (1 hour), used for API calls
- **Refresh token**: Long-lived, automatically refreshes access token
- Stored in: `~/Library/Application Support/foodie-meal-planner-desktop/google-token.json`
- Auto-refresh handled by googleapis library

## Next Steps

1. **Add the JavaScript functions** above to `src/renderer/index.html`
2. **Test the full flow**:
   - Upload credentials
   - Authorize
   - List calendars
   - Sync meals
3. **Build and distribute** to wife's computer
4. **Both computers** can sync to YOUR Google Calendar

## Benefits Over Apple Calendar Method

- ✅ Direct to Google (no intermediate sync)
- ✅ Works from any computer
- ✅ Syncs to shared calendars easily
- ✅ Instant sync
- ✅ Your Google account from wife's computer
- ✅ No macOS-specific AppleScript
- ✅ Could be ported to Windows/Linux

## Installation on Wife's Computer

1. Build updated app with googleapis dependency
2. Install on her computer
3. Use SAME credentials file (from YOUR Google Cloud project)
4. Authorize with YOUR Google account
5. Select YOUR calendar (or shared calendar)
6. Sync meals → appears in YOUR calendar

Both computers can sync to the same Google Calendar!

## Files for User

- **GOOGLE_CALENDAR_DIRECT_SYNC_SETUP.md** - Complete setup guide
- **google-credentials.json** - Download from Google Cloud Console
- Updated Foodie app with Google Calendar integration

## Status

✅ Backend complete (API, database, Google integration)
✅ UI HTML complete
⚠️ JavaScript event handlers need to be added
📋 Setup guide complete
🔄 Ready for final implementation and testing
