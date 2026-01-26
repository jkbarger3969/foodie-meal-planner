# Development & Testing Workflow

## The Two Databases

Your app uses **two separate databases** that need to stay in sync:

### 1. Seed Database (for packaging)
**Location:** `data/foodie.sqlite`
**Purpose:** Bundled into DMG packages for distribution
**When used:** Fresh installs, when userData DB is missing

### 2. UserData Database (for development)
**Location:** `~/Library/Application Support/Foodie Meal Planner/foodie.sqlite`
**Purpose:** Used by your running app during development
**When used:** Every time you run `npm start`

## Quick Commands

### Testing Changes Locally
```bash
# 1. Fix only the userData database (for quick testing)
npx electron scripts/fix-userdata-ingredients.js --userdata

# 2. Restart the app to see changes
npm start
```

### Preparing for Distribution
```bash
# 1. Fix BOTH databases before building
npx electron scripts/fix-userdata-ingredients.js --seed
npx electron scripts/fix-userdata-ingredients.js --userdata

# Or use the helper script:
./scripts/fix-both-databases.sh

# 2. Build the package
npm run build
```

### Start Fresh (Reset to Seed Database)
```bash
# Delete userData database to force fresh copy from seed
rm ~/Library/Application\ Support/Foodie\ Meal\ Planner/foodie.sqlite

# Restart app - it will copy from seed database
npm start
```

## Development Workflow

### Scenario 1: Testing Code Changes
```
1. Make changes to src/main/api.js (or other code)
2. Fix userData database:
   npx electron scripts/fix-userdata-ingredients.js --userdata
3. Restart app: npm start
4. Test changes
```

### Scenario 2: Testing Seed Database Changes
```
1. Fix seed database:
   npx electron scripts/fix-userdata-ingredients.js --seed
2. Delete userData DB:
   rm ~/Library/Application\ Support/Foodie\ Meal\ Planner/foodie.sqlite
3. Restart app (will copy from seed)
4. Test with fresh data
```

### Scenario 3: Preparing Release
```
1. Ensure all code changes are complete
2. Fix BOTH databases:
   ./scripts/fix-both-databases.sh
3. Test with userData database:
   npm start
4. Test with fresh seed (delete userData, restart)
5. Build package:
   npm run build
6. Test installed DMG
```

## Common Issues

### "I see old/wrong data after code changes"
**Problem:** UserData database hasn't been updated with parser fixes
**Solution:** 
```bash
npx electron scripts/fix-userdata-ingredients.js --userdata
```

### "My DMG install has wrong data"
**Problem:** Seed database hasn't been updated
**Solution:**
```bash
npx electron scripts/fix-userdata-ingredients.js --seed
npm run build
```

### "I want to test from scratch"
**Solution:**
```bash
# Fix seed database
npx electron scripts/fix-userdata-ingredients.js --seed

# Delete userData to force fresh copy
rm ~/Library/Application\ Support/Foodie\ Meal\ Planner/foodie.sqlite

# Restart app
npm start
```

## Automated Sync

### Option 1: Pre-Build Hook (Recommended)
Add to `package.json`:
```json
{
  "scripts": {
    "prebuild": "npx electron scripts/fix-userdata-ingredients.js --seed",
    "build": "electron-builder"
  }
}
```

### Option 2: Manual Checklist
Before every release:
- [ ] Run `npx electron scripts/fix-userdata-ingredients.js --seed`
- [ ] Run `npx electron scripts/fix-userdata-ingredients.js --userdata`
- [ ] Test app locally
- [ ] Test fresh install (delete userData, restart)
- [ ] Run `npm run build`
- [ ] Test installed DMG

## Verifying Database State

```bash
# Check seed database
sqlite3 data/foodie.sqlite "SELECT COUNT(*) as total, COUNT(CASE WHEN IngredientNorm GLOB '*[()]*' THEN 1 END) as with_parens, COUNT(CASE WHEN substr(IngredientNorm, 1, 1) NOT GLOB '[a-z0-9]' AND IngredientNorm != '' THEN 1 END) as bad_start FROM ingredients;"

# Check userData database
sqlite3 ~/Library/Application\ Support/Foodie\ Meal\ Planner/foodie.sqlite "SELECT COUNT(*) as total, COUNT(CASE WHEN IngredientNorm GLOB '*[()]*' THEN 1 END) as with_parens, COUNT(CASE WHEN substr(IngredientNorm, 1, 1) NOT GLOB '[a-z0-9]' AND IngredientNorm != '' THEN 1 END) as bad_start FROM ingredients;"
```

**Expected output (both databases):**
```
40145|0|0
```
(total | with_parens | bad_start)

## Summary

**For daily development:** Only fix userData database
**Before releases:** Fix BOTH databases

This keeps your development fast while ensuring distributions are clean.
