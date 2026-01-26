# Force Quit Error Fix - Window Destruction Race Condition

## Error on App Quit

```
Uncaught Exception:
TypeError: Object has been destroyed
at CompanionServer.notifyDevicesChanged
```

## Root Cause

When quitting the desktop app:
1. Electron starts destroying the main window
2. WebSocket connections close (iOS devices disconnect)
3. WebSocket `close` event fires → calls `notifyDevicesChanged()`
4. Code tries to send message to `mainWindow.webContents`
5. **CRASH** - Window already destroyed

## The Fix

Added `isDestroyed()` checks before sending to window:

### Before (Lines 614-619):
```javascript
notifyDevicesChanged() {
  if (this.mainWindow) {  // ❌ Not enough - window could be destroyed
    const devices = this.getConnectedDevices();
    this.mainWindow.webContents.send('companion:devices-changed', devices);
  }
}
```

### After:
```javascript
notifyDevicesChanged() {
  if (this.mainWindow && !this.mainWindow.isDestroyed()) {  // ✅ Safe
    const devices = this.getConnectedDevices();
    this.mainWindow.webContents.send('companion:devices-changed', devices);
  }
}
```

Also fixed line 380-386 (`shopping-list-updated` sender).

## Why This Works

- `isDestroyed()` returns `true` if window is being/has been destroyed
- Prevents attempting IPC to destroyed renderer process
- WebSocket close events are silently ignored during shutdown
- App quits cleanly without force quit needed

## Testing

✅ Close desktop app normally (Cmd+Q or File → Quit)  
✅ Should quit immediately without errors  
✅ No "Object has been destroyed" exception  
✅ No need to force quit  

## Files Modified

- `src/main/main.js`
  - Line 615: Added `!this.mainWindow.isDestroyed()` check
  - Line 380: Added `!this.mainWindow.isDestroyed()` check

## Build

New .dmg ready at:
```
dist/Foodie Meal Planner-1.0.0-arm64.dmg (106 MB)
```

Install this version on wife's laptop to eliminate the force quit issue.

---

**All three issues now fixed:**
1. ✅ Serialization error ("object could not be cloned")
2. ✅ iPad settings button flashing
3. ✅ Force quit on app close
