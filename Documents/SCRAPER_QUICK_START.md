# Bulk Recipe Scraper - Quick Start Guide

## Ready to Run - No Configuration Needed!

The scraper is **pre-configured** with 7 popular recipe websites and will automatically:
- Scrape ~5,000 high-quality recipes
- Parse ingredients with quantities, units, and names
- Auto-detect cuisine and meal type
- Include proper attribution
- Stop when target is reached

## One-Command Execution

```bash
node scripts/bulk-recipe-scraper.js
```

**That's it!** The scraper will run for approximately 6-8 hours.

## What Happens

### Phase 1: AllRecipes (Target: 1,000 recipes)
- Quick & easy recipes
- Desserts
- Dinners
- Breakfasts
- Salads

### Phase 2: Serious Eats (Target: 800 recipes)
- Science-based cooking
- Detailed techniques
- Professional recipes

### Phase 3: BBC Good Food (Target: 800 recipes)
- British cuisine
- International recipes
- Healthy options

### Phase 4: Bon Appétit (Target: 800 recipes)
- Professional culinary content
- Trendy recipes
- High-quality photography

### Phase 5: Food Network (Target: 600 recipes)
- Celebrity chef recipes
- TV show favorites

### Phase 6: Epicurious (Target: 600 recipes)
- High-end culinary
- Gourmet recipes

### Phase 7: Delish (Target: 600 recipes)
- Social media favorites
- Trendy dishes

**Total Target: 5,000 recipes**

The scraper automatically stops when 5,000 recipes are reached, even if not all phases are complete.

## Output

You'll see real-time progress:

```
========================================
🍳 BULK RECIPE SCRAPER
========================================
Output: ./data/foodie-scraped.sqlite
Target: 5000 recipes
Websites: 7 sites
========================================

========== [AllRecipes] Starting scrape ==========

[LISTING] Fetching: https://www.allrecipes.com/recipes/...
[LISTING] Found 50 recipe URLs

    🔍 Scraping: https://...
    ✅ Chocolate Chip Cookies [American] [Dessert]
    
    📊 Progress: 10 new recipes scraped | Total in DB: 10
    📊 Progress: 20 new recipes scraped | Total in DB: 20
    ...
```

## After Completion

### 1. Check Statistics

The scraper shows detailed statistics at the end:

```
========================================
📊 SCRAPING COMPLETE
========================================
⏱️  Duration: 347 minutes
✅ Success: 5000
❌ Failed: 143
⏭️  Skipped (duplicates): 0

📚 Recipes by Source:
   AllRecipes: 1000
   Serious Eats: 800
   ...

🌍 Top 15 Cuisines:
   American: 1234
   Italian: 876
   ...

🍽️  Recipes by Meal Type:
   Dinner: 2345
   Dessert: 1234
   ...
```

### 2. Validate Data

```bash
sqlite3 data/foodie-scraped.sqlite
```

```sql
-- Check total count
SELECT COUNT(*) FROM recipes;

-- Sample recipes
SELECT Title, Cuisine, MealType, Source FROM recipes LIMIT 10;

-- Check ingredient parsing
SELECT IngredientRaw, IngredientName, QtyNum, Unit
FROM ingredients LIMIT 20;
```

### 3. Replace Seed Database

```bash
# Backup current database
cp data/foodie.sqlite data/foodie.sqlite.backup

# Replace with scraped data
cp data/foodie-scraped.sqlite data/foodie.sqlite

# Restart app
npm run dev
```

## Resuming After Interruption

If the scraper is interrupted (Ctrl+C, computer restart, etc.):

1. **Restart the scraper** - It will automatically skip duplicates:
   ```bash
   node scripts/bulk-recipe-scraper.js
   ```

2. **Check progress:**
   ```bash
   sqlite3 data/foodie-scraped.sqlite "SELECT COUNT(*) FROM recipes;"
   ```

3. The scraper continues from where it left off by skipping already-scraped recipes

## Rate Limiting & Ethics

The scraper is configured with respectful rate limits:
- AllRecipes: 2.5 seconds between requests
- All other sites: 3 seconds between requests

**Why this matters:**
- ✅ Doesn't overload website servers
- ✅ Follows web scraping best practices
- ✅ Maintains good relationship with recipe sites
- ✅ Ensures long-term sustainability

**Total estimated time: 6-8 hours**

This is intentional - we're being respectful to the websites providing the recipes.

## Troubleshooting

### No recipes scraped from a site

**Possible causes:**
1. Website changed structure (no longer uses JSON-LD)
2. Network connectivity issues
3. Website blocking the scraper

**Solution:** Check the error messages. The scraper will continue with other sites.

### Scraper seems stuck

**Check:**
1. Network connection
2. Console output for errors
3. Progress updates (every 10 recipes)

**Solution:** Wait at least 5 minutes before interrupting. Rate limiting means there are delays between requests.

### Want faster scraping

**Not recommended**, but you can reduce rate limits in `bulk-recipe-scraper.js`:

```javascript
rateLimit: 1500,  // Faster but less respectful (not recommended)
```

⚠️ **Warning:** Too-fast scraping may:
- Get your IP blocked
- Violate terms of service
- Harm website servers

## Advanced Usage

### Scrape fewer recipes (testing)

Edit `totalTargetRecipes` in the scraper:

```javascript
totalTargetRecipes: 100  // Test with 100 recipes
```

### Add more sites

See `scripts/README.md` for detailed instructions on adding more compatible websites.

### Customize which sites to scrape

Comment out sites you don't want in `SCRAPE_CONFIG.websites`:

```javascript
websites: [
  { name: 'AllRecipes', ... },
  // { name: 'Serious Eats', ... },  // Commented out - will skip
  { name: 'BBC Good Food', ... },
]
```

## Final Notes

- **Time:** Plan for 6-8 hours of uninterrupted running
- **Output:** `data/foodie-scraped.sqlite` (separate from main database)
- **Safety:** Original database not touched until you manually replace it
- **Attribution:** All recipes include source, author, and URL
- **Legal:** Only scrape sites you have authorization to scrape

---

**Questions?** See `scripts/README.md` for full documentation.
