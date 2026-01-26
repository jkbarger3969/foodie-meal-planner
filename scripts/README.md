# Bulk Recipe Scraper

## Overview

The bulk recipe scraper automatically extracts recipe data from authorized websites with proper attribution. Features include:

- ✅ **Enhanced ingredient parsing** - Separates quantity, unit, ingredient name, and notes
- ✅ **Auto-categorization** - Detects cuisine and meal type automatically
- ✅ **Proper attribution** - Includes source, author, and original URL
- ✅ **Rate limiting** - Respectful scraping with configurable delays
- ✅ **JSON-LD extraction** - Works with modern recipe websites using structured data
- ✅ **Duplicate prevention** - Skips recipes already in database
- ✅ **7 Popular websites pre-configured** - AllRecipes, Serious Eats, BBC Good Food, Bon Appétit, Food Network, Epicurious, Delish
- ✅ **Target-based scraping** - Automatically stops when target recipe count is reached

## Quick Start

### Run the scraper (pre-configured with 7 sites)

```bash
node scripts/bulk-recipe-scraper.js
```

**This will scrape approximately 5,000 recipes** from 7 popular recipe websites. The scraper will:
- Visit each website in order
- Extract recipes using JSON-LD structured data
- Parse ingredients with enhanced parser
- Auto-detect cuisine and meal type
- Stop when 5,000 recipes are reached
- Show detailed progress and statistics

### Configuration

The scraper is **pre-configured** with 7 popular recipe websites:

1. **AllRecipes** (1,000 recipes max)
   - Quick & easy recipes, desserts, dinners, breakfasts, salads
   - Rate limit: 2500ms
   
2. **Serious Eats** (800 recipes max)
   - Science-based cooking, detailed techniques
   - Rate limit: 3000ms
   
3. **BBC Good Food** (800 recipes max)
   - British and international recipes
   - Rate limit: 3000ms
   
4. **Bon Appétit** (800 recipes max)
   - Professional culinary content
   - Rate limit: 3000ms
   
5. **Food Network** (600 recipes max)
   - Celebrity chef recipes
   - Rate limit: 3000ms
   
6. **Epicurious** (600 recipes max)
   - High-end culinary recipes
   - Rate limit: 3000ms
   
7. **Delish** (600 recipes max)
   - Trendy, social media-friendly recipes
   - Rate limit: 3000ms

**Total target: 5,000 recipes**

The scraper will automatically stop when 5,000 recipes are reached, even if not all sites have been scraped.

### Customize Configuration

Edit `SCRAPE_CONFIG` in `bulk-recipe-scraper.js`:

```javascript
const SCRAPE_CONFIG = {
  websites: [
    {
      name: 'AllRecipes',
      baseUrl: 'https://www.allrecipes.com',
      listingUrls: [
        '/recipes/17562/everyday-cooking/quick-and-easy/',
        '/recipes/78/desserts/',
        // Add more listing URLs
      ],
      rateLimit: 2500,  // ms between requests
      maxRecipes: 1000  // max per site
    }
  ],
  outputDb: './data/foodie-scraped.sqlite',
  attribution: true,
  totalTargetRecipes: 5000  // Stop when reached
};
```

### Add more websites

You can add more compatible websites:

```javascript
{
  name: 'Simply Recipes',
  baseUrl: 'https://www.simplyrecipes.com',
  listingUrls: ['/recipes/'],
  rateLimit: 3000,
  maxRecipes: 500
}
```

**Compatible sites** (use JSON-LD structured data):
- simplyrecipes.com
- cookieandkate.com
- minimalistbaker.com
- skinnytaste.com
- thepioneerwoman.com

## Expected Output

```
========================================
🍳 BULK RECIPE SCRAPER
========================================
Output: ./data/foodie-scraped.sqlite
Target: 5000 recipes
Websites: 7 sites
  • AllRecipes (max 1000)
  • Serious Eats (max 800)
  • BBC Good Food (max 800)
  • Bon Appétit (max 800)
  • Food Network (max 600)
  • Epicurious (max 600)
  • Delish (max 600)
========================================

========== [AllRecipes] Starting scrape ==========

[LISTING] Fetching: https://www.allrecipes.com/recipes/...
[LISTING] Found 50 recipe URLs

    🔍 Scraping: https://...
    ✅ Chocolate Chip Cookies [American] [Dessert]
    
    📊 Progress: 10 new recipes scraped | Total in DB: 10
    📊 Progress: 20 new recipes scraped | Total in DB: 20
    ...

[AllRecipes] Complete: 423 recipes scraped

========== [Serious Eats] Starting scrape ==========
...

✅ Target of 5000 recipes reached! Stopping early.

========================================
📊 SCRAPING COMPLETE
========================================
⏱️  Duration: 347 minutes (~6 hours)
✅ Success: 5000
❌ Failed: 143
⏭️  Skipped (duplicates): 0
📝 Total new recipes: 5000
💾 Total in database: 5000
💾 Database: ./data/foodie-scraped.sqlite

📚 Recipes by Source:
   AllRecipes: 1000
   Serious Eats: 800
   BBC Good Food: 800
   Bon Appétit: 800
   Food Network: 600
   Epicurious: 600
   Delish: 400

🌍 Top 15 Cuisines:
   American: 1234
   Italian: 876
   Mexican: 543
   Asian: 432
   French: 321
   ...

🍽️  Recipes by Meal Type:
   Dinner: 2345
   Dessert: 1234
   Any: 876
   Breakfast: 345
   Lunch: 123
   Side Dish: 77

📈 Success Rate: 97%
========================================
```

## Usage

### 1. Run scraper (one command - scrapes all 7 sites)

```bash
node scripts/bulk-recipe-scraper.js
```

**Estimated time:** 6-8 hours for 5,000 recipes (with respectful rate limiting)

### 2. Validate scraped data

```bash
sqlite3 data/foodie-scraped.sqlite
```

```sql
-- Check recipe count
SELECT COUNT(*) FROM recipes;

-- Check cuisine distribution
SELECT Cuisine, COUNT(*) as count 
FROM recipes 
GROUP BY Cuisine 
ORDER BY count DESC;

-- Sample recipes
SELECT Title, Cuisine, MealType, Author 
FROM recipes 
LIMIT 10;

-- Check ingredient parsing
SELECT IngredientRaw, IngredientName, QtyNum, Unit
FROM ingredients 
LIMIT 20;
```

### 3. Replace seed database

```bash
# Backup current database
cp data/foodie.sqlite data/foodie.sqlite.backup

# Replace with scraped data
cp data/foodie-scraped.sqlite data/foodie.sqlite

# Restart app
npm run dev
```

## Features in Detail

### Enhanced Ingredient Parsing

Automatically extracts:
- **QtyNum**: Numeric quantity (2.5)
- **QtyText**: Original quantity text ("2 1/2 cups")
- **Unit**: Canonicalized unit ("cup")
- **IngredientName**: Clean ingredient name ("all-purpose flour")
- **Notes**: Preparation notes ("sifted")

**Example:**

```
Input:  "2 1/2 cups all-purpose flour, sifted"

Output: {
  IngredientRaw: "2 1/2 cups all-purpose flour, sifted",
  IngredientName: "all-purpose flour",
  QtyNum: 2.5,
  QtyText: "2 1/2 cups",
  Unit: "cup",
  Notes: "sifted"
}
```

### Auto-Categorization

**Cuisine Detection (3-tier priority):**
1. JSON-LD `recipeCuisine` field
2. Keywords in title/description/category
3. Ingredient analysis (e.g., "soy sauce" + "ginger" = Asian)

**Meal Type Detection:**
- Pattern matching on keywords
- Checks: name, description, keywords, category
- Types: Breakfast, Lunch, Dinner, Side Dish, Dessert, Any

### Attribution

Every recipe includes:
```
Source: AllRecipes
Author: John Doe
Original URL: https://www.allrecipes.com/recipe/...
```

## Database Schema

```sql
CREATE TABLE recipes (
  RecipeId TEXT PRIMARY KEY,
  Title TEXT,
  URL TEXT,
  Cuisine TEXT,              -- Auto-detected
  MealType TEXT,             -- Auto-detected
  Notes TEXT,                -- Includes attribution
  Instructions TEXT,
  Source TEXT,               -- Website name
  Author TEXT,               -- Recipe author
  default_servings INTEGER
);

CREATE TABLE ingredients (
  RecipeId TEXT,
  idx INTEGER,
  IngredientRaw TEXT,        -- Original line
  IngredientName TEXT,       -- Clean name
  IngredientNorm TEXT,       -- Lowercase for search
  QtyNum REAL,               -- Numeric quantity
  QtyText TEXT,              -- Original quantity text
  Unit TEXT,                 -- Canonicalized unit
  Notes TEXT,                -- Preparation notes
  Category TEXT,             -- (populated later)
  PRIMARY KEY (RecipeId, idx)
);
```

## Rate Limiting

Respectful scraping practices:
- Default: 2500ms between requests (2.5 seconds)
- Configurable per website
- Prevents server overload
- Complies with best practices

**Time estimates:**
- 100 recipes × 2.5s = ~4 minutes
- 500 recipes × 2.5s = ~21 minutes
- 1000 recipes × 2.5s = ~42 minutes

## Troubleshooting

### No recipes scraped

**Check:**
1. Website uses JSON-LD structured data
2. Recipe URLs match pattern in `extractRecipeUrls()`
3. Network connectivity
4. Rate limit not too aggressive

**Debug:**
```javascript
// Add logging in scrapeRecipe()
console.log('HTML length:', html.length);
console.log('JSON-LD match:', jsonLdMatch ? 'found' : 'not found');
```

### Incorrect cuisine/meal type

**Solution:**
- Add keywords to detection functions
- Check JSON-LD fields for website-specific naming

**Example:**
```javascript
const cuisineKeywords = {
  'Italian': [...existing, 'minestrone', 'focaccia'],
  ...
};
```

### Parsing errors

**Common issues:**
- Ingredient format varies by website
- Unicode fractions not handled
- Complex quantity ranges

**Solution:**
- Test with sample ingredients
- Update regex patterns in `parseIngredientLine()`

## Advanced Usage

### Website-Specific Extractors

For sites with non-standard structure:

```javascript
async extractRecipeUrls(listingUrl, siteConfig) {
  const html = await this.fetchHtml(listingUrl);
  
  // Site-specific extraction
  if (siteConfig.name === 'Food Network') {
    const pattern = /<a[^>]+href=["'](\/recipes\/[^"']+)["']/gi;
    // ... custom logic
  }
  
  // Default extraction
  return this.defaultExtraction(html, siteConfig);
}
```

### Custom Parsers

For specialized ingredient formats:

```javascript
parseRecipe(data, url, siteConfig) {
  // Site-specific parsing
  if (siteConfig.name === 'MyCustomSite') {
    return this.parseCustomFormat(data, url, siteConfig);
  }
  
  // Default parsing
  return this.parseStandardFormat(data, url, siteConfig);
}
```

## Legal & Ethical Considerations

✅ **Allowed:**
- Scraping websites you have legal authorization to scrape
- Proper attribution to authors and sources
- Respectful rate limiting
- Structured data extraction (JSON-LD is designed for this)

❌ **Not allowed:**
- Scraping without authorization
- Removing attribution
- Aggressive scraping that harms websites
- Violating terms of service

**Always:**
1. Verify you have legal right to scrape
2. Include proper attribution
3. Respect rate limits
4. Follow robots.txt
5. Comply with terms of service

## Next Steps

1. **Configure websites** - Add your authorized sources
2. **Run scraper** - Test with small `maxRecipes` first
3. **Validate data** - Check cuisine/meal type accuracy
4. **Adjust parsers** - Fine-tune for your sources
5. **Replace database** - Deploy scraped recipes
6. **Schedule updates** - Optional: cron job for fresh content

---

**Questions?** Check the implementation guide in `ENHANCED_IMPORT_AND_SCRAPER.md`
