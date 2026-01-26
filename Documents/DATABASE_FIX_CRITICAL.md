# Database Configuration and Distribution Checklist

## Architecture: Single Database

**SIMPLIFIED**: The app now uses a single database file `data/foodie.sqlite` for both development and production. This eliminates the complexity of maintaining separate seed and user databases.

### Database Location
- **Development**: `./data/foodie.sqlite` (in project root)
- **Production**: `./data/foodie.sqlite` (packaged with the app)
- **No userData copying**: The database stays in place and is used directly

## Critical: Ingredient Quantity Fix

**ALWAYS run this before packaging for distribution:**

```bash
./scripts/prepare-for-distribution.sh
```

## What This Fixes

### Bug Description
The ingredient quantity parser had a critical regex bug that truncated fractions:
- "2/3 cup" was parsed as "2 cup" (QtyNum: 2.0 instead of 0.667)
- "1/4 teaspoon" was parsed as "1 teaspoon" (QtyNum: 1.0 instead of 0.25)

This affected:
- Shopping list aggregation
- Pantry subtraction
- Recipe scaling
- Ingredient display

### The Fix
1. **Code fix** (src/main/api.js line 146): Corrected regex pattern to match fractions BEFORE whole numbers
2. **Database repair** (scripts/fix-ingredient-quantities.js): Re-parses all ingredients with corrected logic
3. **Simplified architecture** (src/main/db.js): Use single database file directly

## Database File

### `data/foodie.sqlite` (Single Authoritative Database)
- This is the ONLY database used by the app
- Used directly in development and production
- **MUST be fixed before distribution**
- Fixed by: `./scripts/prepare-for-distribution.sh`

### Removed Databases (No Longer Needed)
- ~~`foodie-scraped.sqlite`~~ - Merged into main database
- ~~`foodie-seed.sqlite`~~ - No longer needed with single-database architecture
- ~~`userData/foodie.sqlite`~~ - No longer copying to userData

## Manual Fix (if needed)

If you need to fix the database:

```bash
node scripts/run-fix-with-electron.js data/foodie.sqlite
```

## Verification

After running the fix, verify with:

```bash
# Check for correct fraction parsing
sqlite3 data/foodie.sqlite "SELECT IngredientRaw, QtyText, QtyNum FROM ingredients WHERE IngredientRaw LIKE '%2/3%' LIMIT 5"

# Should show:
# 2/3 cup pumpkin puree|2/3 cup|0.666666666666667
# (NOT: 2/3 cup pumpkin puree|2 cup|2.0)
```

## Build Process Integration

Add to your build/packaging scripts:

```json
{
  "scripts": {
    "prebuild": "npm run prepare-db",
    "prepare-db": "./scripts/prepare-for-distribution.sh",
    "build": "electron-builder"
  }
}
```

## ⚠️ CRITICAL REMINDERS

1. **NEVER distribute** without running `prepare-for-distribution.sh`
2. **ALWAYS verify** the fix completed successfully
3. **TEST** shopping list and pantry subtraction after packaging
4. **Backup** data/foodie.sqlite before making changes

## Files Modified

- `src/main/db.js` - Simplified to use single database directly
- `src/main/main.js` - Updated comments for single database
- `src/main/api.js` - Regex pattern fix (line 146)
- `src/main/api.js` - Examples duplication fix (lines 2043-2064)
- `scripts/fix-ingredient-quantities.js` - Database repair script
- `scripts/run-fix-with-electron.js` - Electron wrapper
- `scripts/prepare-for-distribution.sh` - Pre-distribution automation (simplified)

## Date Fixed
2026-01-19

## Affected Versions
All versions prior to this fix date
