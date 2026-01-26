# ✅ APP IS WORKING - Installation Instructions

## Issue Resolved

The `afterPack.js` script was causing the build to fail. It has been removed and the app now builds and runs correctly.

**Build completed**: January 19, 2026 at 4:15 PM  
**Status**: ✅ Tested and working  

---

## Installation Steps

### 1. Stop Any Running Instances

Before installing, quit all running instances of Foodie:

```bash
# Kill any running instances
pkill -f "Foodie Meal Planner"

# Or use Activity Monitor:
# - Open Activity Monitor
# - Search for "Foodie"
# - Quit all instances
```

### 2. Remove Old Installation (if exists)

```bash
# Remove from Applications
rm -rf "/Applications/Foodie Meal Planner.app"

# Clear app data (OPTIONAL - only if you want fresh start)
rm -rf ~/Library/Application\ Support/Foodie\ Meal\ Planner/
```

### 3. Install from DMG

```bash
# Open the DMG
open "dist/Foodie Meal Planner-1.0.0-arm64.dmg"
```

Then:
1. Drag "Foodie Meal Planner" to Applications folder
2. Eject the DMG
3. Launch from Applications folder

### 4. Handle Gatekeeper (if needed)

If macOS blocks the app:
1. System Settings → Privacy & Security
2. Scroll down to "Security"
3. Click "Open Anyway" next to Foodie Meal Planner

---

## Verification

After installation, the app should:
- ✅ Launch without flickering
- ✅ Load your meal planner data
- ✅ Show companion server started on port 8080
- ✅ Display recipes, pantry, collections, etc.

---

## What Was Fixed

### Problem
The build had an `afterPack.js` script that tried to rebuild better-sqlite3 AFTER packaging, which corrupted the native module.

### Solution
1. Removed `scripts/afterPack.js` (backed up to `afterPack.js.backup`)
2. Rebuilt the app with clean electron-builder configuration
3. App now uses properly pre-built better-sqlite3 binary

### Build Output (Confirmed Working)
```
• rebuilding native dependencies  dependencies=better-sqlite3@11.10.0 platform=darwin arch=arm64
• install prebuilt binary  name=better-sqlite3 version=11.10.0 platform=darwin arch=arm64
• packaging       platform=darwin arch=arm64 electron=28.3.3 appOutDir=dist/mac-arm64
• signing         file=dist/mac-arm64/Foodie Meal Planner.app
✓ Build complete
```

### Test Results
App launched successfully from command line:
- ✅ Companion server started on port 8080
- ✅ Google Calendar API initialized
- ✅ Database loaded correctly
- ✅ All API functions working (getPlansRange, listRecipes, etc.)

---

## Troubleshooting

### Port 8080 Already in Use

If you see this error:
```
WebSocket server error: Error: listen EADDRINUSE: address already in use :::8080
```

**This is harmless** - it just means you have multiple instances running.

**Fix**: Quit all instances and launch only one:
```bash
pkill -f "Foodie Meal Planner"
open -a "Foodie Meal Planner"
```

### App Still Won't Open

1. **Check Console.app**:
   - Open Console.app
   - Filter for "Foodie"
   - Look for actual error messages

2. **Check error log**:
   ```bash
   cat ~/Library/Application\ Support/Foodie\ Meal\ Planner/error.log
   ```

3. **Verify installation**:
   ```bash
   ls -la "/Applications/Foodie Meal Planner.app/Contents/MacOS/"
   ```
   Should show the executable file.

---

## Next Steps

Once installed on this Mac:

1. **Test all features** using `READY_FOR_TESTING.md` checklist
2. **Copy DMG to your other Mac** via AirDrop/USB
3. **Build iOS apps** in Xcode (instructions in `READY_FOR_TESTING.md`)

---

## Files Modified in This Fix

- ❌ Removed: `scripts/afterPack.js` (caused build failure)
- ✅ Rebuilt: `dist/Foodie Meal Planner-1.0.0-arm64.dmg` (working version)
- 📝 Updated: `READY_FOR_TESTING.md` (comprehensive testing guide)
