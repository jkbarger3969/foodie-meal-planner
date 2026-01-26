# Scraper Manager - Quick Command Reference

**Script:** `./scraper-manager.sh`  
**All commands include safety prompts and automatic backups**

---

## 🚀 Quick Start Commands

### 1. Test First (Recommended)
```bash
# Scrape 100 recipes to test (5-10 minutes)
./scraper-manager.sh test-scraper
```

### 2. Run Full Scrape
```bash
# Option A: Run in foreground (watch progress)
./scraper-manager.sh run-scraper

# Option B: Run in background (recommended for 10K recipes)
./scraper-manager.sh run-background
```

### 3. After Scraping - Analyze Results
```bash
# See what meal types and cuisines were found
./scraper-manager.sh analyze
```

### 4. Replace Main Database
```bash
# Backup current database
./scraper-manager.sh backup-main

# Replace with scraped data (auto-backup included)
./scraper-manager.sh replace-main
```

---

## 📊 All Available Commands

### Scraper Commands

| Command | Description | Duration |
|---------|-------------|----------|
| `run-scraper` | Run bulk scraper (10,000 recipes) | 8-12 hours |
| `run-background` | Run scraper in background with logging | 8-12 hours |
| `test-scraper` | Test scraper with 100 recipes | 5-10 minutes |
| `analyze` | Analyze scraped data (meal types, cuisines) | Instant |
| `stats` | Show quick statistics for both databases | Instant |

### Database Management

| Command | Description | Safety |
|---------|-------------|--------|
| `backup-main` | Backup main database | ✅ Safe |
| `replace-main` | Replace main DB with scraped DB | ⚠️ Auto-backup |
| `merge` | Merge scraped into main (skip duplicates) | ⚠️ Auto-backup |
| `list-backups` | List all database backups | ✅ Safe |
| `restore` | Restore from a backup | ⚠️ Confirmation |

---

## 📝 Typical Workflow

### First Time Setup

```bash
# 1. Test scraper
./scraper-manager.sh test-scraper

# 2. Check results
./scraper-manager.sh stats
./scraper-manager.sh analyze

# 3. If satisfied, run full scrape
./scraper-manager.sh run-background

# 4. Monitor progress (in another terminal)
tail -f scraper-*.log

# 5. After completion, analyze
./scraper-manager.sh analyze

# 6. Replace database
./scraper-manager.sh replace-main
```

### Adding More Recipes Later

```bash
# 1. Run scraper again (skips duplicates by URL)
./scraper-manager.sh run-scraper

# 2. Merge new recipes into main database
./scraper-manager.sh merge
```

---

## 🔍 Monitoring Background Scraper

### Start Background Scraper
```bash
./scraper-manager.sh run-background
```

**Output:**
```
Log file: /Users/.../scraper-20250117-143522.log
PID file: /Users/.../scraper.pid
```

### Monitor Progress
```bash
# Real-time log viewing
tail -f scraper-20250117-143522.log

# Check recipe count (run every minute)
watch -n 60 "sqlite3 data/foodie-scraped.sqlite 'SELECT COUNT(*) FROM recipes;'"
```

### Stop Scraper
```bash
kill $(cat scraper.pid)
```

---

## 💾 Database Operations

### Check Database Status
```bash
./scraper-manager.sh stats
```

**Output:**
```
Scraped Database:
  Total Recipes: 10000
  By Source:
    AllRecipes: 2000
    Serious Eats: 1500
    ...
  By Meal Type:
    Dinner: 3456
    Dessert: 1789
    ...
```

### Backup Before Changes
```bash
./scraper-manager.sh backup-main
```

**Output:**
```
Backup created: data/backups/foodie-backup-20250117-143522.sqlite
Size: 45M
```

### Replace Main Database
```bash
./scraper-manager.sh replace-main
```

**What it does:**
1. Shows current counts (main vs scraped)
2. Asks for confirmation
3. Creates automatic backup
4. Replaces main database
5. Confirms new count

### Merge Databases (Add New Recipes)
```bash
./scraper-manager.sh merge
```

**What it does:**
1. Compares databases
2. Creates automatic backup
3. Adds only NEW recipes (skips duplicates by URL)
4. Shows how many added

---

## 🔄 Restore from Backup

### List Available Backups
```bash
./scraper-manager.sh list-backups
```

### Restore a Backup
```bash
./scraper-manager.sh restore
```

**Interactive menu:**
```
1) foodie-backup-20250117-143522.sqlite
2) foodie-backup-before-replace-20250117-145000.sqlite
Select backup: 2

Selected: data/backups/foodie-backup-before-replace-20250117-145000.sqlite
Size: 45M
Recipes: 8734

Restore this backup? (y/N)
```

---

## ⚙️ Advanced Usage

### Run Scraper with Custom Settings

Edit `scripts/bulk-recipe-scraper.js` before running:

```javascript
// Line 107: Change total target
totalTargetRecipes: 5000  // Instead of 10000

// Lines 36-102: Adjust per-site limits
maxRecipes: 1000  // Instead of 2000 for AllRecipes
```

Then run:
```bash
./scraper-manager.sh run-scraper
```

### Manual Database Operations

```bash
# Check scraped database
sqlite3 data/foodie-scraped.sqlite

# Check main database
sqlite3 data/foodie.sqlite
```

**Useful queries:**
```sql
-- Count recipes
SELECT COUNT(*) FROM recipes;

-- Distribution by meal type
SELECT MealType, COUNT(*) FROM recipes GROUP BY MealType ORDER BY COUNT(*) DESC;

-- Sample recipes
SELECT Title, Cuisine, MealType FROM recipes LIMIT 10;

-- Search for specific meal type
SELECT Title FROM recipes WHERE MealType = 'Appetizer' LIMIT 10;
```

---

## 📊 Analysis Script

### Run Meal Type Analysis
```bash
./scraper-manager.sh analyze
```

**Output:**
```
========================================
📊 MEAL TYPE ANALYSIS
========================================

Total Recipes: 10000

Meal Type Distribution:
─────────────────────────────────────
Dinner          3456 ( 34.6%) █████████████████
Dessert         1789 ( 17.9%) ████████
Breakfast       1234 ( 12.3%) ██████
Appetizer        543 (  5.4%) ██
Snack            321 (  3.2%) █
Brunch           167 (  1.7%) 
Beverage         198 (  2.0%) █

Sample Recipes by Meal Type:
─────────────────────────────────────
Appetizer (543 recipes):
  1. Spinach Artichoke Dip [American] - AllRecipes
  2. Buffalo Wings [American] - Food Network
  3. Bruschetta [Italian] - Serious Eats

🆕 New meal types found:
   - Appetizer (543 recipes)
   - Snack (321 recipes)
   - Brunch (167 recipes)
   - Beverage (198 recipes)
```

---

## ✅ Safety Features

All destructive operations include:
- ✅ **Confirmation prompts** - Must type 'y' to proceed
- ✅ **Automatic backups** - Created before replace/merge
- ✅ **Status displays** - Show counts before/after
- ✅ **Error checking** - Validates files exist
- ✅ **Backup timestamps** - Easy to identify when created

---

## 🆘 Troubleshooting

### Scraper fails with module error
```bash
npm rebuild better-sqlite3
```

### Can't find scraper-manager.sh
```bash
chmod +x scraper-manager.sh
./scraper-manager.sh stats
```

### Want to start over
```bash
# Remove scraped database
rm data/foodie-scraped.sqlite

# Run scraper again
./scraper-manager.sh run-scraper
```

### Restore previous database
```bash
./scraper-manager.sh list-backups
./scraper-manager.sh restore
```

---

## 📚 Documentation

- **Full Guide:** `SCRAPER_URLS_UPDATED.md`
- **Meal Types:** `MEAL_TYPE_STRATEGY.md`
- **Quick Start:** `SCRAPER_QUICK_START_UPDATED.md`
- **Checklist:** `SCRAPER_PREFLIGHT_CHECKLIST.md`

---

## 🎯 Summary

**Most Common Commands:**

```bash
# Test first
./scraper-manager.sh test-scraper

# Run full scrape
./scraper-manager.sh run-background

# Analyze results
./scraper-manager.sh analyze

# Replace database
./scraper-manager.sh replace-main
```

**That's it!** 🚀
