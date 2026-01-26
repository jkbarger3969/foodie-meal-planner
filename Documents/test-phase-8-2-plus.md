# Phase 8.2+ Enhancements - Testing Guide

## Quick Manual Test Checklist

### Test 1: Contextual Help Button Visibility

1. **Start the app**
   ```bash
   npm start
   ```

2. **Check initial state:**
   - [ ] Button visible in bottom-right corner (on Planner tab by default)
   - [ ] Button has gradient blue styling
   - [ ] Button shows "?" character

3. **Test tab switching:**
   - [ ] Click Recipes tab → Button stays visible
   - [ ] Click Collections tab → Button stays visible
   - [ ] Click Shop tab → Button stays visible
   - [ ] Click Pantry tab → Button stays visible
   - [ ] Click Admin tab → **Button disappears** (fades out)
   - [ ] Click Planner tab → Button reappears (fades in)

4. **Test button functionality:**
   - [ ] Click button from any tab → Switches to Admin tab
   - [ ] Page scrolls to FAQ section
   - [ ] Search box pre-filled based on previous tab

### Test 2: Inline Help Text - Multi-User

1. **Open Manage Users modal:**
   - [ ] Click user switcher in header
   - [ ] Click "⚙️ Manage Users"

2. **Verify help text:**
   - [ ] Blue help box appears below header
   - [ ] Icon (ℹ️) visible
   - [ ] Text: "Create profiles for family members..."
   - [ ] Readable in dark mode

### Test 3: Inline Help Text - Additional Items

1. **Open Add Side/Dessert modal:**
   - [ ] Go to Planner tab
   - [ ] Load a week's plan
   - [ ] Click "+ Add Side/Dessert" on any meal slot

2. **Verify help text:**
   - [ ] Blue help box appears below date/slot header
   - [ ] Icon (ℹ️) visible
   - [ ] Text: "Add complementary items like sides..."
   - [ ] Doesn't overlap with search input

### Test 4: Inline Help Text - Pantry

1. **Navigate to Pantry tab:**
   - [ ] Click Pantry tab

2. **Verify help text:**
   - [ ] Blue help box appears below header
   - [ ] Icon (ℹ️) visible
   - [ ] Text: "Track your pantry inventory..."
   - [ ] Positioned above Pantry Insights toggle

### Test 5: Warning Help - Backup/Restore

1. **Navigate to Admin tab:**
   - [ ] Click Admin tab
   - [ ] Scroll to "Data sync" section

2. **Verify warning help:**
   - [ ] Orange warning box appears above Export/Import buttons
   - [ ] Icon (⚠️) visible
   - [ ] Text: "**⚠️ Important:** Importing data will replace..."
   - [ ] Stands out from other help text
   - [ ] Cannot miss it before clicking Import

### Test 6: Dark/Light Mode Compatibility

1. **Test dark mode (default):**
   - [ ] All help text readable
   - [ ] Borders visible
   - [ ] Icons clear

2. **Test light mode:**
   - [ ] Click theme toggle in header
   - [ ] All help text readable
   - [ ] Colors adapt correctly
   - [ ] Icons still visible

### Test 7: Tooltips (from Phase 8.2)

Verify existing tooltips still work:

1. **Meal Planner:**
   - [ ] Hover "Select" button → "Pick a recipe for this meal"
   - [ ] Hover "View" button → "View recipe details"
   - [ ] Hover "Edit" button → "Edit this recipe"

2. **Shopping List:**
   - [ ] Hover "Generate" button → "Generate shopping list from meal plan"
   - [ ] Hover "Clear list" button → "Remove all items from shopping list"

3. **User Switcher:**
   - [ ] Hover user switcher → "Switch between family members or view all meals"

### Test 8: Keyboard Shortcuts (from Phase 8.2)

1. **Press `?` key:**
   - [ ] Keyboard shortcuts modal opens
   - [ ] All shortcuts listed
   - [ ] Modal closes with Esc

2. **Press `Cmd+1` through `Cmd+6`:**
   - [ ] Switches between tabs
   - [ ] Contextual help button shows/hides correctly

### Expected Results

✅ **All tests pass** - Phase 8.2+ enhancements working correctly

❌ **Any test fails** - Check console for errors, verify file saved correctly

## Common Issues

### Button doesn't hide on Admin tab
- **Cause:** `updateContextualHelpButton()` not called in `setTab()`
- **Fix:** Verify line 6630 has the function call

### Inline help not visible
- **Cause:** CSS not loading or z-index issue
- **Fix:** Check `.help-text` class exists in CSS (line 1893)

### Help text wrong color
- **Cause:** CSS variable not defined or wrong class
- **Fix:** Verify `--accent` and `--warning` colors in `:root`

---

**Total Test Time:** ~10 minutes

**Pass Criteria:** All checkboxes checked ✅
