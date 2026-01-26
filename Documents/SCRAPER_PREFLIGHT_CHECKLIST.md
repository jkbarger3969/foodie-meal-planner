# Pre-Flight Checklist: Bulk Recipe Scraper

**Ready to scrape 10,000 recipes?** Use this checklist before starting.

---

## ✅ Prerequisites

- [x] **Node.js v25.2.1** installed and working
- [x] **better-sqlite3** rebuilt for current Node version
- [x] **Scripts directory** exists with `bulk-recipe-scraper.js`
- [x] **Data directory** exists at `data/`
- [x] **All dependencies** installed (`npm install`)

**Verify:**
```bash
node --version  # Should show v25.2.1
ls -la scripts/bulk-recipe-scraper.js  # Should exist
ls -la data/  # Directory should exist
```

---

## ✅ Configuration Review

Open `scripts/bulk-recipe-scraper.js` and verify:

### Line 107: Target Recipes
```javascript
totalTargetRecipes: 10000  // ✅ Set to 10000 for full scrape
```

**Options:**
- `100` - Quick test (5-10 minutes)
- `1000` - Medium test (1-2 hours)
- `10000` - Full scrape (8-12 hours)

### Lines 22-103: Website Configuration
```javascript
websites: [
  { name: 'AllRecipes', maxRecipes: 2000, rateLimit: 2500 },
  { name: 'Serious Eats', maxRecipes: 1500, rateLimit: 3000 },
  { name: 'BBC Good Food', maxRecipes: 1500, rateLimit: 3000 },
  { name: 'Bon Appetit', maxRecipes: 1500, rateLimit: 3500 },
  { name: 'Food Network', maxRecipes: 1200, rateLimit: 3500 },
  { name: 'Epicurious', maxRecipes: 1200, rateLimit: 4000 },
  { name: 'Delish', maxRecipes: 1100, rateLimit: 3500 }
]
```

**All URLs verified working:** ✅

---

## ✅ Environment Check

### Disk Space
```bash
df -h /Users/keithbarger/Projects/foodie-meal-planner-desktop/
```

**Required:**
- Minimum: 500 MB
- Recommended: 2 GB (for logs + database)

### Network Connection
```bash
ping -c 3 www.allrecipes.com
ping -c 3 www.seriouseats.com
```

**Status:** Should show successful responses

### Database Access
```bash
sqlite3 data/foodie-scraped.sqlite "SELECT COUNT(*) FROM recipes;"
```

**Expected:** Number (might be 0 for fresh start, or 13 if test data exists)

---

## ✅ Test Run (Recommended)

Before full 10K scrape, run a quick test:

### 1. Edit Config
```javascript
// Line 107 in scripts/bulk-recipe-scraper.js
totalTargetRecipes: 50  // Test with 50 recipes
```

### 2. Run Test
```bash
node scripts/bulk-recipe-scraper.js
```

### 3. Verify Results
```bash
sqlite3 data/foodie-scraped.sqlite << EOF
SELECT COUNT(*) FROM recipes;
SELECT MealType, COUNT(*) FROM recipes GROUP BY MealType;
SELECT Cuisine, COUNT(*) FROM recipes WHERE Cuisine != '' GROUP BY Cuisine;
SELECT Title FROM recipes LIMIT 5;
EOF
```

**Expected:**
- Total count: ~50
- Mix of meal types (Breakfast, Dinner, Dessert, etc.)
- Mix of cuisines (American, Italian, etc.)
- Recipe titles displayed

### 4. Check for Errors
```bash
# Look for ❌ errors in output
# High failure rate (>20%) = problem
# Low failure rate (<10%) = normal
```

### 5. Reset for Full Scrape
```javascript
// Line 107 in scripts/bulk-recipe-scraper.js
totalTargetRecipes: 10000  // Back to 10000
```

**OR** keep test data:
```bash
# The scraper will skip duplicates automatically
# Just increase the target and run again
```

---

## ✅ Production Run Setup

### Option A: Foreground (Monitor in Terminal)
```bash
node scripts/bulk-recipe-scraper.js
```

**Pros:**
- See real-time progress
- Catch errors immediately

**Cons:**
- Terminal must stay open
- Session ends if disconnected

### Option B: Background (Recommended)
```bash
nohup node scripts/bulk-recipe-scraper.js > scraper.log 2>&1 &
echo $! > scraper.pid  # Save process ID
```

**Pros:**
- Runs even if you disconnect
- Log saved to file
- Can monitor with `tail -f scraper.log`

**Cons:**
- Need to check log file for errors

### Option C: Screen/Tmux (Advanced)
```bash
screen -S scraper
node scripts/bulk-recipe-scraper.js
# Press Ctrl+A, D to detach
# screen -r scraper to reattach
```

---

## ✅ Monitoring

### Real-Time Progress
```bash
# If running in background:
tail -f scraper.log

# If running in foreground:
# Just watch the terminal
```

### Database Status
```bash
# Run in a separate terminal window
watch -n 60 "sqlite3 data/foodie-scraped.sqlite 'SELECT COUNT(*) FROM recipes;'"
```

**Expected:** Count increases every minute

### Progress Indicators
Look for these in output:
- `✅` - Successful scrape
- `❌` - Failed scrape (some failures are normal)
- `📊 Progress: X new recipes scraped | Total in DB: Y` - Every 10 recipes
- `[Site] Starting scrape` - New website started

---

## ✅ During the Run

### Normal Behavior
- Some `❌` errors (5-10% failure rate is normal)
- Pauses between requests (rate limiting - this is good!)
- Different meal types and cuisines appearing
- Progress updates every 10 recipes

### Warning Signs
- **High failure rate (>50%):** Stop and investigate
- **No progress for 5+ minutes:** Check network connection
- **HTTP 429 errors:** Rate limited - increase rate limits in config
- **Out of memory errors:** Reduce `totalTargetRecipes`

### Emergency Stop
```bash
# If running in foreground:
Ctrl+C

# If running in background:
kill $(cat scraper.pid)
# OR
pkill -f bulk-recipe-scraper
```

**Your data is safe:** Database commits after each recipe

---

## ✅ After Completion

### 1. Check Final Statistics
The scraper prints a report at the end:
```
========================================
📊 SCRAPING COMPLETE
========================================
✅ Success: 9847
❌ Failed: 523
⏭️  Skipped (duplicates): 234
💾 Total in database: 9847
```

### 2. Verify Data Quality
```bash
sqlite3 data/foodie-scraped.sqlite << EOF
-- Total recipes
SELECT COUNT(*) FROM recipes;

-- Distribution by source
SELECT Source, COUNT(*) FROM recipes GROUP BY Source ORDER BY COUNT(*) DESC;

-- Distribution by meal type
SELECT MealType, COUNT(*) FROM recipes GROUP BY MealType ORDER BY COUNT(*) DESC;

-- Distribution by cuisine
SELECT Cuisine, COUNT(*) FROM recipes WHERE Cuisine != '' GROUP BY Cuisine ORDER BY COUNT(*) DESC LIMIT 20;

-- Check for missing data
SELECT COUNT(*) FROM recipes WHERE Title = '';
SELECT COUNT(*) FROM recipes WHERE Instructions = '';
SELECT COUNT(*) FROM recipes WHERE RecipeId NOT IN (SELECT DISTINCT RecipeId FROM ingredients);
EOF
```

### 3. Backup Database
```bash
cp data/foodie-scraped.sqlite data/foodie-scraped-backup-$(date +%Y%m%d).sqlite
```

### 4. Review Sample Recipes
```bash
sqlite3 data/foodie-scraped.sqlite << EOF
SELECT Title, Cuisine, MealType, Source FROM recipes ORDER BY RANDOM() LIMIT 10;
EOF
```

---

## ✅ Troubleshooting Common Issues

### Module Version Mismatch
```
Error: NODE_MODULE_VERSION 119 vs 141
```

**Fix:**
```bash
npm rebuild better-sqlite3
```

### HTTP 404 Errors
```
[LISTING] Error fetching ...: HTTP 404
```

**Fix:** URLs changed - check for updates in `SCRAPER_URLS_UPDATED.md`

### HTTP 429 Rate Limited
```
[LISTING] Error fetching ...: HTTP 429
```

**Fix:** Increase rate limits in config (add 500-1000ms to each)

### Memory Issues
```
JavaScript heap out of memory
```

**Fix:** Reduce `totalTargetRecipes` or run in multiple sessions

### No Recipe URLs Found
```
[LISTING] Found 0 recipe URLs
```

**Fix:** Site may have changed structure - review URL patterns

---

## 📋 Final Checklist Before Starting

- [ ] `totalTargetRecipes` set to desired value (10000)
- [ ] Network connection verified
- [ ] Disk space sufficient (>500 MB free)
- [ ] Test run completed successfully (optional but recommended)
- [ ] Monitoring method chosen (foreground/background/screen)
- [ ] Backup plan for existing data (if any)

**All checked?** You're ready to start! 🚀

```bash
# Let's go!
node scripts/bulk-recipe-scraper.js
```

---

## 📚 Documentation References

- **Quick Start:** `SCRAPER_QUICK_START_UPDATED.md`
- **Technical Details:** `SCRAPER_URLS_UPDATED.md`
- **Ready Summary:** `SCRAPER_READY_SUMMARY.md`
- **Original Config:** `SCRAPER_CONFIG_10K.md`

---

**Good luck with your scrape!** 🎉
