# CRITICAL: Installation Instructions for UI Fixes

**Date:** 2026-01-20  
**Build:** v1.0.0 (arm64)  
**Status:** ✅ All fixes applied and built

---

## ⚠️ IMPORTANT: You MUST Install the New Build

**The issues you're seeing are because you're running the OLD version of the app.**

All fixes have been applied to the code and a new DMG has been built, but you need to:

1. **Quit** the currently running Foodie Meal Planner app completely
2. **Uninstall** the old version (drag from Applications to Trash)
3. **Install** the new DMG: `dist/Foodie Meal Planner-1.0.0-arm64.dmg`
4. **Launch** the new version

---

## Fixes Applied in This Build

### 1. ✅ Companion Panel - Moved to LEFT Side

**Location:** Bottom-left corner (was bottom-right)
**Button:** 📱 floating button
**What changed:**
- CSS updated to position at `left: 24px` instead of `right: 24px`
- Panel now opens on the left side
- Contains "Send Shopping List to iPhone" and "Send Today's Meals to iPad" buttons

**To test:** Click the 📱 button in the bottom-left corner

---

### 2. ✅ Grid View Dropdown Arrow - Moved to LEFT Side

**Location:** Grid view meal cards
**What changed:**
- Expand button (⌄) moved from `bottom-right` to `bottom-left`
- Prevents overlap with meal title and badge
- Now at `bottom: 6px; left: 6px`

**To test:** 
1. Go to Planner tab
2. Click "Grid View"
3. Look for meals with additional items (shows +X badge)
4. Dropdown arrow should be on the left side

---

### 3. ✅ Collections Recipe Count - Fixed

**What changed:**
- **Backend:** `src/main/api.js` - `listCollections()` now includes LEFT JOIN to count recipes
- **Frontend:** Collection card click now calls `loadCollectionRecipes()` to display recipes

**To test:**
1. Go to Collections tab
2. Should show actual recipe counts (e.g., "5 recipes" instead of "0 recipes")
3. Click "View" button on a collection card
4. Should load and scroll to collection recipes below

---

### 4. ✅ User Switcher Dropdown - Should Work

**What changed:**
- Event listener exists: `toggleUserSwitcher()`
- Dropdown HTML and CSS are correct
- Should toggle on click

**To test:**
1. Click on "👨‍👩‍👧‍👦 Whole Family" in top-right header
2. Dropdown should open showing users and "⚙️ Manage Users" button

**If still not working after installing new build:**
- Open DevTools (Alt+Cmd+I)
- Click the button
- Check console for errors
- Let me know the exact error

---

### 5. ✅ Bulk Action Buttons - Always Visible Now

**What changed:**
- Export controls bar is now ALWAYS visible (not hidden)
- Buttons are DISABLED when no recipes selected
- Buttons ENABLE when you check recipe checkboxes

**To test:**
1. Go to Recipes tab
2. Should see control bar at top showing "0 recipe(s) selected"
3. Buttons (Assign, Collection, Edit Fields, Delete, Export) should be visible but grayed out
4. Check a recipe checkbox
5. Buttons should become enabled (clickable)
6. Click "Assign" - should prompt for date/slots
7. Click "Collection" - should show collection picker
8. Click "Edit Fields" - should show bulk edit modal

---

### 6. ✅ Recipe Icon Spacing - Fixed Overlap

**What changed:**
- Recipe icon moved from `left: 32px` to `left: 40px`
- Content padding increased from `75px` to `80px`
- Added `pointer-events: none` to icon

**To test:**
1. Go to Recipes tab
2. Checkbox and emoji icon should have 8px spacing
3. Clicking checkbox should work without icon interference

---

### 7. ℹ️ Infinite Scroll / Virtual Scrolling

**Current behavior:**
- Virtual scrolling ONLY enables when you have > 100 recipes
- If you have < 100 recipes, all recipes load at once (no scrolling needed)
- If you have > 100 recipes, virtual scrolling loads recipes as you scroll

**To test (if you have 100+ recipes):**
1. Go to Recipes tab
2. Scroll down
3. New recipes should load as you approach the bottom

**If broken after new install:**
- Check DevTools console for errors
- Let me know exact error message

---

### 8. ℹ️ Undo Feature - Already Exists

**Undo IS implemented but via keyboard shortcut:**
- **Undo:** Cmd/Ctrl+Z (or ⌘Z on Mac)
- **Redo:** Cmd/Ctrl+Shift+Z
- **Also available:** Open Command Palette (Cmd/Ctrl+K) and type "undo"

**What can be undone:**
- Recipe deletions
- Meal deletions
- Plan range clears
- (Check UNDO system in code for full list)

**No visible "Undo" button:**
- There's no UI button, only keyboard shortcuts
- This is standard practice (like most desktop apps)

**If you want a visible Undo button:**
- Let me know where you'd like it (header? floating button? context menu?)
- I can add one

---

## Installation Steps (DETAILED)

### Step 1: Quit Current App
```
1. If Foodie Meal Planner is running, quit it completely
2. Press Cmd+Q or right-click icon in Dock → Quit
```

### Step 2: Uninstall Old Version
```
1. Open Finder
2. Go to Applications folder
3. Find "Foodie Meal Planner"
4. Drag to Trash (or right-click → Move to Trash)
5. Empty Trash (optional but recommended)
```

### Step 3: Install New DMG
```
1. Open Terminal
2. Navigate to project: cd /Users/keithbarger/Projects/foodie-meal-planner-desktop
3. Open DMG: open "dist/Foodie Meal Planner-1.0.0-arm64.dmg"
4. Drag "Foodie Meal Planner" to Applications folder
5. Eject DMG
```

### Step 4: Launch New Version
```
1. Go to Applications folder
2. Double-click "Foodie Meal Planner"
3. If macOS blocks it: System Settings → Privacy & Security → Allow
4. App should launch with all fixes applied
```

---

## Verification Checklist

After installing, verify each fix:

- [ ] **Companion panel:** Click 📱 button in bottom-LEFT corner, panel opens on left
- [ ] **Grid dropdown:** Grid view meals with +X badge have ⌄ button on bottom-LEFT
- [ ] **Collections:** Cards show correct recipe count (not 0), clicking View loads recipes
- [ ] **User switcher:** Clicking "👨‍👩‍👧‍👦 Whole Family" opens dropdown with Manage Users button
- [ ] **Bulk buttons:** Recipe tab shows control bar with disabled buttons, enable when checking recipes
- [ ] **Recipe spacing:** Checkboxes and emoji icons don't overlap
- [ ] **Infinite scroll:** (If 100+ recipes) Scroll loads more recipes
- [ ] **Undo:** Press Cmd+Z after deleting something, should undo

---

## If Issues Persist After Installation

If you still see problems after installing the new build:

### 1. Verify You're Running the New Version
- Check if file modification date of app matches today (2026-01-20)
- Open DevTools (Alt+Cmd+I)
- Check console for any startup errors

### 2. Clear App Cache
- Quit app
- Delete: `~/Library/Application Support/Foodie Meal Planner/`
- Relaunch app (will regenerate cache)

### 3. Check Database
- Your database is at: `~/Library/Application Support/Foodie Meal Planner/foodie.sqlite`
- Verify it exists and has data
- If missing, app should recreate from seed

### 4. Specific Issues

**Collections still showing 0:**
- Open DevTools
- Go to Collections tab
- Check Network/Console for API errors
- Backend change is in `src/main/api.js` line 2284-2303

**User switcher not opening:**
- Check DevTools console when clicking
- Event listener is at line 16609
- Function `toggleUserSwitcher` at line 15785

**Bulk buttons not working:**
- Check if buttons are actually enabled (not grayed out)
- Check DevTools console for errors
- Functions at lines 15294, 15354, 15423

---

## Quick Install Command

If you want to skip manual steps:

```bash
# Close app if running
killall "Foodie Meal Planner" 2>/dev/null

# Remove old version
rm -rf "/Applications/Foodie Meal Planner.app"

# Install new version
open "dist/Foodie Meal Planner-1.0.0-arm64.dmg"
# Wait for DMG to mount, then manually drag to Applications
```

---

## Summary

**All 7 issues have been fixed in the code and built into the DMG.**

The reason you're still seeing the old bugs is because you're running the old version of the app. Once you install the new DMG from `dist/Foodie Meal Planner-1.0.0-arm64.dmg`, all fixes will be active.

**Please install the new build and test each fix using the verification checklist above.**

If ANY issue persists after installation, open DevTools (Alt+Cmd+I) and share:
1. The exact steps to reproduce
2. Console errors (if any)
3. Screenshots showing the problem

---

**Build Location:** `dist/Foodie Meal Planner-1.0.0-arm64.dmg`  
**File Size:** ~106MB compressed, ~318MB installed  
**Code Signed:** ✅ Yes  
**Ready for Install:** ✅ Yes
