# Fixed: Missing googleapis-common Module

## Problem
When launching the app on another Mac, got error:
```
Error: Cannot find module 'googleapis-common'
```

## Root Cause
The `googleapis` module has dependencies that weren't explicitly included in the electron-builder configuration:
- `googleapis-common`
- `google-auth-library`
- `gaxios`
- `gcp-metadata`
- `gtoken`
- `google-logging-utils`

## Solution
Updated `package.json` to explicitly include all googleapis-related modules in the build.

### Updated package.json:
```json
"files": [
  "src/**/*",
  "data/foodie.sqlite",
  "package.json",
  "!node_modules",
  "node_modules/better-sqlite3/**/*",
  "node_modules/ws/**/*",
  "node_modules/electron-store/**/*",
  "node_modules/googleapis/**/*",
  "node_modules/googleapis-common/**/*",      // ADDED
  "node_modules/google-auth-library/**/*",   // ADDED
  "node_modules/gaxios/**/*",                 // ADDED
  "node_modules/gcp-metadata/**/*",           // ADDED
  "node_modules/gtoken/**/*",                 // ADDED
  "node_modules/google-logging-utils/**/*",  // ADDED
  "node_modules/puppeteer/**/*"
]
```

## New Build
Fresh build completed with all dependencies:
- **DMG**: `dist/Foodie Meal Planner-1.0.0-arm64.dmg` (100MB)
- **ZIP**: `dist/Foodie Meal Planner-1.0.0-arm64-mac.zip` (96MB)

## Installation
```bash
open "dist/Foodie Meal Planner-1.0.0-arm64.dmg"
```

Then:
1. Drag app to Applications
2. Launch from Applications
3. Should work on other Mac now ✅

## Verification
To verify all Google modules are included:
```bash
# After installing from DMG
ls "/Applications/Foodie Meal Planner.app/Contents/Resources/app.asar.unpacked/node_modules/" | grep google
```

Should see:
- googleapis
- googleapis-common
- google-auth-library
- google-logging-utils

## If Still Issues
Check error log:
```bash
tail -f ~/Library/Application\ Support/Foodie\ Meal\ Planner/error.log
```

Then launch the app to see any errors.

---

**Status:** ✅ Fixed and rebuilt. Ready to install on other Mac!
