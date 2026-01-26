# Multiple Mac Support - Update Summary

## ✅ Changes Made

All companion app files have been updated to support **configurable server IP addresses**, allowing you to easily switch between your Mac and your wife's Mac.

---

## Files Modified

### iOS Apps (Already Configurable!)

Both iOS apps already had manual IP configuration built-in:

1. **iPhone App** (`ios-apps/FoodieShoppingList/Views/SettingsView.swift`)
   - ✅ Updated help text to mention switching between Macs
   - ✅ Full WebSocket address format: `ws://192.168.x.x:8080`
   - ✅ Saves to UserDefaults, persists between app launches
   - ✅ Can change anytime in Settings

2. **iPad App** (`ios-apps/FoodieKitchen/Views/SettingsView.swift`)
   - ✅ Updated to match iPhone app styling
   - ✅ IP-only format: `192.168.x.x` (no ws:// or :8080)
   - ✅ Help dialog explains how to switch Macs
   - ✅ Saves and persists configuration

### Desktop App

1. **`src/main/main.js`**
   - ✅ Added IPC handler: `companion:get-server-ip`
   - ✅ Returns local IP address(es) for display
   - ✅ Syntax verified

2. **`src/main/preload.js`**
   - ✅ Exposed `getServerIP()` API method
   - ✅ Available to renderer process

3. **`src/renderer/index.html`**
   - ✅ Enhanced companion panel UI
   - ✅ Shows actual IP address dynamically
   - ✅ Displays both formats (iPhone vs iPad)
   - ✅ Clearer instructions for configuration

### Documentation

1. **`SWITCHING_BETWEEN_MACS.md`** (NEW)
   - Complete guide to switching between Macs
   - Common scenarios and workflows
   - Troubleshooting tips
   - Best practices

2. **`SWITCHING_MACS_QUICK_REF.md`** (NEW)
   - One-page quick reference
   - IP format examples
   - Common commands

3. **`START_HERE_COMPANION_APPS.md`**
   - Updated to mention Mac-switching capability
   - Links to switching guide

4. **`build-ios-apps.sh`**
   - Updated to show both IP formats
   - Mentions switching capability

---

## How It Works

### Configuration Storage

**iPhone App:**
```swift
// Stores in UserDefaults
@Published var serverAddress: String {
    didSet {
        UserDefaults.standard.set(serverAddress, forKey: "serverAddress")
    }
}
```

**iPad App:**
```swift
func saveServerAddress(_ address: String) {
    serverAddress = address
    UserDefaults.standard.set(address, forKey: "serverAddress")
}
```

### Desktop IP Display

```javascript
// Desktop gets local IP via IPC
const result = await Foodie.getServerIP();
// Returns: { ok: true, ip: "192.168.2.115", allIps: [...] }
```

---

## User Experience

### Finding Mac's IP Address

**On Desktop:**
1. Launch Foodie app
2. Click 📱 button
3. See: "Configure iOS Apps: ws://192.168.2.115:8080"

### Configuring iOS Apps

**iPhone:**
1. Settings → Desktop Mac
2. Enter: `ws://192.168.2.115:8080`
3. Tap "Save & Connect"
4. Green checkmark = connected

**iPad:**
1. Settings → Desktop Mac
2. Enter: `192.168.2.115` (IP only)
3. Tap "Save & Connect"
4. Green checkmark = connected

### Switching to Different Mac

**On iOS Device (iPhone or iPad):**
1. Open Settings
2. Change IP to different Mac's address
3. Tap "Save & Connect"
4. Now connected to different Mac!

**Example:**
```
Your Mac:   192.168.2.115
Wife's Mac: 192.168.2.120

Switch: Change 192.168.2.115 → 192.168.2.120
Result: Now receiving data from wife's Mac
```

---

## Features

### ✅ What's Supported

- **Manual IP entry** on both iOS apps
- **Persistent storage** - remembers last Mac
- **Easy switching** - just change IP and reconnect
- **No data loss** - each Mac has independent data
- **Help dialogs** - built-in instructions
- **Connection status** - green/red indicators
- **Auto-reconnect** - when network available
- **Desktop IP display** - shows actual IP address

### 🎯 Use Cases

**Scenario 1: Different Meal Planners**
- You use your Mac for your recipes
- Wife uses her Mac for her recipes
- iPhone/iPad switches between both

**Scenario 2: Work/Home**
- Connect to work Mac during week
- Connect to home Mac on weekends
- Same iOS apps, different data sources

**Scenario 3: Shared Cooking**
- Both Macs have different recipes
- iPad switches between Macs as needed
- No interference or conflicts

---

## Technical Details

### Network Requirements

**Same WiFi Network:**
- All devices must be on same local network
- No internet required (local-only)
- Works completely offline

**IP Address Formats:**

| Device | Format | Example |
|--------|--------|---------|
| iPhone | `ws://[IP]:8080` | `ws://192.168.2.115:8080` |
| iPad | `[IP]` | `192.168.2.115` |
| Desktop | Shows both | (in companion panel) |

### Connection Management

**Auto-reconnect:**
- iOS apps monitor network changes
- Auto-reconnect when WiFi available
- Exponential backoff (2s, 4s, 8s... max 30s)
- Max 5 reconnect attempts

**Manual reconnect:**
- Disconnect button in settings
- Save & Connect button
- Persists new address immediately

---

## Documentation Links

**Comprehensive Guide:**
- `SWITCHING_BETWEEN_MACS.md` - Full guide with examples

**Quick Reference:**
- `SWITCHING_MACS_QUICK_REF.md` - One-page cheat sheet

**Installation Guide:**
- `ios-apps/INSTALLATION_GUIDE.md` - Initial setup

**Main Guide:**
- `START_HERE_COMPANION_APPS.md` - Overview

---

## Testing Checklist

### Test IP Configuration

**iPhone:**
- [ ] Enter your Mac's IP
- [ ] Connect successfully (green checkmark)
- [ ] Receive shopping list
- [ ] Change to different IP
- [ ] Reconnect successfully
- [ ] Receive data from new Mac

**iPad:**
- [ ] Enter your Mac's IP
- [ ] Connect successfully
- [ ] Receive recipes
- [ ] Change to different IP
- [ ] Reconnect
- [ ] Receive data from new Mac

**Desktop:**
- [ ] Click 📱 button
- [ ] See actual IP address displayed
- [ ] Both formats shown (iPhone/iPad)
- [ ] Help text clear

---

## Summary

✅ **Both iOS apps fully support manual IP configuration**  
✅ **Desktop displays actual IP address**  
✅ **Easy switching between Macs**  
✅ **Comprehensive documentation created**  
✅ **No code changes needed for basic functionality** (was already configurable!)  
✅ **Enhanced UI and help text** for better user experience  

**Ready to use!** Users can now:
1. Connect to your Mac
2. Connect to wife's Mac
3. Switch between them anytime
4. No data loss or conflicts

All documentation and UI updated to explain this capability clearly.
