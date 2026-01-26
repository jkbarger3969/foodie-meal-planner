# QUICK FIX - Rebuild Instructions

## What Was Fixed

The serialization error was caused by sending raw SQLite database objects that contained non-JSON-serializable metadata. Added explicit serialization functions to extract only the needed fields.

## On Wife's Laptop - Rebuild Desktop App

```bash
cd ~/Desktop/foodie-meal-planner-desktop
npm run build
```

Wait for build to complete (about 1-2 minutes).

The .dmg will be at:
```
dist/Foodie Meal Planner-1.0.0-arm64.dmg
```

## Install

1. Double-click the new .dmg
2. Drag to Applications (replace existing)
3. Launch the app

## Test

1. **Test Shopping List:**
   - Make sure today has meal plan with recipes
   - Click "Send Shopping List to Phones"
   - Check iPhone - should see ingredients appear
   - Desktop console should show: `📤 Pushed shopping list (X items from Y recipes)`

2. **Test Today's Meals:**
   - Make sure today has breakfast/lunch/dinner
   - Click "Send Today's Meals to iPads"
   - Check iPad - should see meals appear
   - iPad should stop flashing
   - Desktop console should show: `📤 Pushed X meals for today to all iPads`

## Expected Results

✅ No "Error: An object could not be cloned" errors
✅ Shopping list appears on iPhone
✅ Today's meals appear on iPad
✅ iPad stops flashing settings button

## If Still Issues

Check console output:
1. Desktop app: Open View → Toggle Developer Tools
2. iPad app: Check Xcode console (if connected)

Look for:
- What meal plan date is being queried
- What recipe IDs are found
- What ingredient count is returned
- Any new error messages

---

**Files Changed:** `src/main/main.js` (added serialization helpers, updated 3 send functions)
**Build Ready:** `dist/Foodie Meal Planner-1.0.0-arm64.dmg` (106 MB)
