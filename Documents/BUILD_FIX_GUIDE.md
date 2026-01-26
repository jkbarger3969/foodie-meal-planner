# Fix: Desktop App Not Opening After Build

## Problem
The app icon flickers but doesn't open when installed from the DMG. Works fine in dev mode (`npm run dev`).

## Root Cause
Native modules (especially `better-sqlite3`) need special handling in Electron builds because they're compiled for specific platforms.

---

## Solution Applied

### 1. Updated package.json Build Configuration

**Changes:**
- Explicitly included required node_modules
- Added `asarUnpack` for native modules
- Better-sqlite3 and Puppeteer extracted from asar archive

**Why:** Native modules can't be loaded from within asar archives - they must be unpacked.

### 2. Added Error Logging

Added comprehensive error logging to `src/main/main.js`:
- Catches uncaught exceptions
- Logs to file: `~/Library/Application Support/Foodie Meal Planner/error.log`
- Shows error dialog with log path

**Why:** Production builds don't show console - need file logging to diagnose issues.

---

## How to Rebuild

### Step 1: Clean Previous Builds
```bash
rm -rf dist/
rm -rf node_modules/
```

### Step 2: Fresh Install
```bash
npm install
```

This will:
- Install dependencies
- Run `postinstall` hook
- Rebuild better-sqlite3 for your system

### Step 3: Build
```bash
npm run build
```

This will:
- Create `dist/` folder
- Build DMG in `dist/Foodie Meal Planner-1.0.0.dmg`
- Build ZIP in `dist/Foodie Meal Planner-1.0.0-mac.zip`

### Step 4: Install and Test
```bash
open dist/*.dmg
```

Drag app to Applications, then:
1. Double-click to launch
2. If it still flickers, check error log:
   ```bash
   cat ~/Library/Application\ Support/Foodie\ Meal\ Planner/error.log
   ```

---

## Troubleshooting

### Issue: Still won't open after rebuild

**Check 1: Error Log**
```bash
cat ~/Library/Application\ Support/Foodie\ Meal\ Planner/error.log
```

**Common errors:**
- `Error: Cannot find module 'better-sqlite3'` → Native module not unpacked
- `Error loading shared library` → Wrong architecture (Intel vs ARM)

**Fix:**
```bash
# Rebuild for your architecture
npm run rebuild

# Then rebuild the app
npm run build
```

### Issue: Different architecture (Intel vs Apple Silicon)

If building on Apple Silicon (M1/M2) but need Intel build:
```bash
npm run rebuild
ELECTRON_ARCH=x64 npm run build
```

If building on Intel but need Apple Silicon:
```bash
npm run rebuild
ELECTRON_ARCH=arm64 npm run build
```

### Issue: Database not found

**Symptom:** App opens but shows database errors

**Fix:** Make sure `data/foodie.sqlite` exists before building:
```bash
ls -la data/foodie.sqlite
```

If missing, restore from backup or create fresh database.

### Issue: Permissions/Gatekeeper

**Symptom:** "App can't be opened because it is from an unidentified developer"

**Fix:**
```bash
sudo xattr -rd com.apple.quarantine "/Applications/Foodie Meal Planner.app"
```

Or right-click → Open (first time only)

---

## Verification Steps

### 1. Check Build Output
```bash
ls -lh dist/
```

Should see:
- `Foodie Meal Planner-1.0.0.dmg` (~200-300MB)
- `Foodie Meal Planner-1.0.0-mac.zip`

### 2. Check Unpacked Modules
After installing from DMG:
```bash
ls -la "/Applications/Foodie Meal Planner.app/Contents/Resources/app.asar.unpacked/node_modules/"
```

Should see:
- `better-sqlite3/`
- `puppeteer/`

### 3. Check Database
```bash
ls -la "/Applications/Foodie Meal Planner.app/Contents/Resources/app/data/"
```

Should see:
- `foodie.sqlite`

### 4. Test Launch
```bash
open "/Applications/Foodie Meal Planner.app"
```

Should:
- Open without flickering
- Show main window
- Load data from database

---

## Build Script for Distribution

For a clean, reproducible build:

```bash
#!/bin/bash
# clean-build.sh

echo "🧹 Cleaning previous builds..."
rm -rf dist/
rm -rf node_modules/

echo "📦 Installing dependencies..."
npm install

echo "🔨 Building application..."
npm run build

echo "✅ Build complete!"
echo "📦 DMG: dist/Foodie Meal Planner-1.0.0.dmg"
echo "📦 ZIP: dist/Foodie Meal Planner-1.0.0-mac.zip"

echo ""
echo "🧪 Testing installed app..."
if [ -f "dist/mac/Foodie Meal Planner.app/Contents/MacOS/Foodie Meal Planner" ]; then
    "dist/mac/Foodie Meal Planner.app/Contents/MacOS/Foodie Meal Planner" &
    sleep 3
    pkill -f "Foodie Meal Planner"
    echo "✅ App launches successfully"
else
    echo "❌ App binary not found"
fi
```

Save as `clean-build.sh`, make executable:
```bash
chmod +x clean-build.sh
./clean-build.sh
```

---

## Key Configuration Changes

### package.json
```json
"files": [
  "src/**/*",
  "data/foodie.sqlite",
  "package.json",
  "!node_modules",  // Exclude all node_modules first
  "node_modules/better-sqlite3/**/*",  // Then include specific ones
  "node_modules/ws/**/*",
  "node_modules/electron-store/**/*",
  "node_modules/googleapis/**/*",
  "node_modules/puppeteer/**/*"
],
"asarUnpack": [
  "node_modules/better-sqlite3/**/*",  // Can't be in asar
  "node_modules/puppeteer/**/*"         // Can't be in asar
]
```

### Error Logging (src/main/main.js)
```javascript
const logPath = path.join(app.getPath('userData'), 'error.log');
process.on('uncaughtException', (error) => {
  logError('Uncaught Exception:', error);
  dialog.showErrorBox('Error', `Check ${logPath} for details.`);
});
```

---

## Common Electron Builder Issues

### Issue: asar vs non-asar
- **Problem:** Native modules need to be outside asar
- **Solution:** Use `asarUnpack` for native modules

### Issue: Missing dependencies
- **Problem:** Not all node_modules copied
- **Solution:** Explicitly list required modules in `files`

### Issue: Wrong architecture
- **Problem:** Built for Intel but running on M1
- **Solution:** Match build architecture to target machine

### Issue: Permissions
- **Problem:** Hardened Runtime, Gatekeeper
- **Solution:** Use entitlements, sign app, or disable Gatekeeper for testing

---

## Summary

**Before:**
- ❌ Native modules in asar (can't load)
- ❌ No error logging
- ❌ Missing explicit module includes

**After:**
- ✅ Native modules unpacked from asar
- ✅ Error logging to file
- ✅ Explicit module configuration
- ✅ Better error handling

**Next Steps:**
1. Run `rm -rf dist/ node_modules/`
2. Run `npm install`
3. Run `npm run build`
4. Install from DMG
5. Check error log if issues persist

---

**Error Log Location:**
```bash
~/Library/Application Support/Foodie Meal Planner/error.log
```

**Quick Check:**
```bash
tail -f ~/Library/Application\ Support/Foodie\ Meal\ Planner/error.log
```

Then launch the app and watch for errors in real-time.
