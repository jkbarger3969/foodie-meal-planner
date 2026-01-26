# Quick Start: Bulk Recipe Scraper

**Status:** ✅ Ready to run (URLs updated and tested)  
**Last Updated:** January 17, 2025

---

## One-Command Start

```bash
node scripts/bulk-recipe-scraper.js
```

---

## Background Mode (Recommended for 10K recipes)

```bash
# Start in background
nohup node scripts/bulk-recipe-scraper.js > scraper.log 2>&1 &

# Monitor progress (real-time)
tail -f scraper.log

# Check database count
sqlite3 data/foodie-scraped.sqlite "SELECT COUNT(*) FROM recipes;"

# Stop if needed
pkill -f bulk-recipe-scraper
```

---

## What to Expect

### Console Output
```
========================================
🍳 BULK RECIPE SCRAPER
========================================
Target: 10000 recipes
Websites: 7 sites
========================================

[AllRecipes] Starting scrape
[LISTING] Found 51 recipe URLs
    ✅ Peanut Butter and Jelly French Toast Casserole [American] [Dessert]
    ✅ Banana Bread Baked Oatmeal [American] [Breakfast]
    📊 Progress: 10 new recipes scraped | Total in DB: 10
```

### Duration
- **10,000 recipes:** 8-12 hours
- **1,000 recipes (test):** 1-2 hours
- **100 recipes (quick test):** 5-10 minutes

### Success Indicators
- ✅ Recipe name, cuisine, and meal type displayed
- 📊 Progress updates every 10 recipes
- No ❌ errors or repeated failures

---

## Testing First (Recommended)

Edit `scripts/bulk-recipe-scraper.js` line 107:

```javascript
// Change from 10000 to 100 for testing
totalTargetRecipes: 100  // Test with 100 recipes first
```

Then run:
```bash
node scripts/bulk-recipe-scraper.js
```

Check results:
```bash
sqlite3 data/foodie-scraped.sqlite << EOF
SELECT MealType, COUNT(*) FROM recipes GROUP BY MealType;
SELECT Cuisine, COUNT(*) FROM recipes WHERE Cuisine != '' GROUP BY Cuisine LIMIT 10;
EOF
```

If satisfied, change back to `10000` and run full scrape.

---

## Troubleshooting

### Error: HTTP 404
- **Cause:** Website changed URL structure
- **Fix:** Check `SCRAPER_URLS_UPDATED.md` for latest working URLs

### Error: HTTP 429 (Rate Limited)
- **Cause:** Too many requests too quickly
- **Fix:** Increase rate limits in config (lines 36, 46, 62, 70, 81, 93, 102)

### Error: Module version mismatch
- **Cause:** Node.js version changed
- **Fix:** Run `npm rebuild better-sqlite3`

### Low success rate
- **Cause:** Site blocking or wrong URL patterns
- **Solution:** Check individual site in browser, update regex patterns

---

## Quick Database Checks

```bash
# Total recipes
sqlite3 data/foodie-scraped.sqlite "SELECT COUNT(*) FROM recipes;"

# By source
sqlite3 data/foodie-scraped.sqlite "SELECT Source, COUNT(*) FROM recipes GROUP BY Source;"

# By meal type
sqlite3 data/foodie-scraped.sqlite "SELECT MealType, COUNT(*) FROM recipes GROUP BY MealType;"

# By cuisine
sqlite3 data/foodie-scraped.sqlite "SELECT Cuisine, COUNT(*) FROM recipes WHERE Cuisine != '' GROUP BY Cuisine ORDER BY COUNT(*) DESC LIMIT 15;"

# Sample recipes
sqlite3 data/foodie-scraped.sqlite "SELECT Title, Cuisine, MealType FROM recipes LIMIT 10;"
```

---

## Configuration Summary

| Site | Max Recipes | Rate Limit | Listing URLs |
|------|-------------|------------|--------------|
| AllRecipes | 2,000 | 2500ms | 7 |
| Serious Eats | 1,500 | 3000ms | 2 |
| BBC Good Food | 1,500 | 3000ms | 7 |
| Bon Appétit | 1,500 | 3500ms | 1 |
| Food Network | 1,200 | 3500ms | 2 |
| Epicurious | 1,200 | 4000ms | 4 |
| Delish | 1,100 | 3500ms | 1 |
| **Total** | **10,000** | - | **24** |

---

## After Scraping Complete

### 1. Review Statistics
The scraper prints a final report:
```
========================================
📊 SCRAPING COMPLETE
========================================
⏱️  Duration: 480 minutes
✅ Success: 9847
❌ Failed: 523
⏭️  Skipped (duplicates): 234
💾 Total in database: 9847

📚 Recipes by Source:
   AllRecipes: 1998
   Serious Eats: 1487
   ...

🌍 Top 15 Cuisines:
   American: 3421
   Italian: 1234
   ...

🍽️  Recipes by Meal Type:
   Dinner: 3456
   Breakfast: 1234
   ...
```

### 2. Check Data Quality
```sql
-- Missing titles
SELECT COUNT(*) FROM recipes WHERE Title = '';

-- Missing instructions
SELECT COUNT(*) FROM recipes WHERE Instructions = '';

-- Missing ingredients
SELECT COUNT(*) FROM recipes WHERE RecipeId NOT IN (SELECT RecipeId FROM ingredients);
```

### 3. Import to Main Database
```bash
# Merge scraped data into main app database
# (Manual step - depends on your merge strategy)
```

---

## Getting Help

- **Full documentation:** `SCRAPER_URLS_UPDATED.md`
- **Implementation details:** `ENHANCED_IMPORT_AND_SCRAPER.md`
- **Configuration guide:** `SCRAPER_CONFIG_10K.md`

---

**Ready to start!** Just run `node scripts/bulk-recipe-scraper.js` 🚀
