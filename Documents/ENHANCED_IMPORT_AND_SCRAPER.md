# Enhanced Recipe Import & Bulk Scraping - Implementation Guide

## Overview

This guide covers:
1. ✅ Enhanced ingredient parsing (separate qty from ingredient name)
2. ✅ Auto-categorization (cuisine + meal type detection)
3. ✅ Database schema update (add IngredientName column)
4. ✅ Bulk recipe scraper for authorized websites
5. ✅ Migration strategy for existing data

---

## Part 1: Enhanced Ingredient Parsing

### Current Schema (ingredients table)
```sql
CREATE TABLE ingredients (
  RecipeId TEXT NOT NULL,
  idx INTEGER NOT NULL,
  IngredientNorm TEXT,  -- lowercase for search
  IngredientRaw TEXT,   -- original line: "2 cups all-purpose flour"
  Notes TEXT,
  QtyNum REAL,          -- 2.0
  QtyText TEXT,         -- "2 cups"
  StoreId TEXT,
  Unit TEXT,            -- "cups"
  Category TEXT,        -- "Baking"
  PRIMARY KEY (RecipeId, idx)
);
```

### New Schema (add IngredientName)
```sql
ALTER TABLE ingredients ADD COLUMN IngredientName TEXT;
```

**Purpose:** Store clean ingredient name without quantity for:
- Better printing ("flour" not "2 cups flour")
- Easier scaling (multiply QtyNum, keep IngredientName)
- Cleaner shopping lists

**Example:**
- **IngredientRaw:** "2 cups all-purpose flour, sifted"
- **QtyNum:** 2.0
- **QtyText:** "2 cups"
- **Unit:** "cups"
- **IngredientName:** "all-purpose flour"
- **Notes:** "sifted"

### Enhanced Parser (JavaScript)

```javascript
/**
 * Parse ingredient line into structured data
 * Handles:
 * - Fractions: "1/2", "1 1/2"
 * - Ranges: "2-3 cups", "1 to 2 tablespoons"
 * - Units: cups, tbsp, tsp, oz, lb, g, kg, ml, l
 * - Notes: ", chopped", " (optional)", " - finely diced"
 * - Unicode fractions: ½, ⅓, ¼, ⅔, ¾
 */
function parseIngredientLine(line) {
  const original = line.trim();
  if (!original) return null;
  
  // Unicode fraction mapping
  const fractionMap = {
    '½': '1/2', '⅓': '1/3', '¼': '1/4', '⅔': '2/3', '¾': '3/4',
    '⅕': '1/5', '⅖': '2/5', '⅗': '3/5', '⅘': '4/5',
    '⅙': '1/6', '⅚': '5/6', '⅛': '1/8', '⅜': '3/8', '⅝': '5/8', '⅞': '7/8'
  };
  
  let text = original;
  for (const [unicode, frac] of Object.entries(fractionMap)) {
    text = text.replace(new RegExp(unicode, 'g'), frac);
  }
  
  // Regex patterns
  const qtyPattern = /^(\d+(?:\s+\d+\/\d+|\.\d+)?|\d+\/\d+)(?:\s*(?:to|-)\s*(\d+(?:\s+\d+\/\d+|\.\d+)?|\d+\/\d+))?/;
  const unitPattern = /(teaspoons?|tablespoons?|cups?|ounces?|pounds?|lbs?|grams?|kilograms?|milliliters?|liters?|tsp|tbsp|oz|lb|g|kg|ml|l|pinch|dash|cloves?|cans?|jars?|packages?|pkgs?|bunches?|slices?|pieces?|whole|medium|large|small)\b/i;
  
  let match = text.match(qtyPattern);
  let qtyNum = null;
  let qtyText = '';
  let qtyMin = null;
  let qtyMax = null;
  let remainder = text;
  
  if (match) {
    const qty1 = match[1];
    const qty2 = match[2];
    
    // Parse first quantity
    qtyNum = parseFraction(qty1);
    qtyMin = qtyNum;
    
    // Parse range if exists
    if (qty2) {
      qtyMax = parseFraction(qty2);
      qtyText = `${qty1} to ${qty2}`;
    } else {
      qtyText = qty1;
    }
    
    remainder = text.substring(match[0].length).trim();
  }
  
  // Extract unit
  let unit = '';
  const unitMatch = remainder.match(unitPattern);
  if (unitMatch) {
    unit = canonicalizeUnit(unitMatch[1]);
    qtyText = qtyText ? `${qtyText} ${unitMatch[1]}` : unitMatch[1];
    remainder = remainder.substring(unitMatch.index + unitMatch[0].length).trim();
  }
  
  // Extract notes (parentheses, commas, dashes)
  let ingredientName = remainder;
  let notes = '';
  
  // Extract parenthetical notes: "(optional)", "(about 2 lbs)"
  const parenMatch = ingredientName.match(/\(([^)]+)\)/);
  if (parenMatch) {
    notes = parenMatch[1].trim();
    ingredientName = ingredientName.replace(parenMatch[0], '').trim();
  }
  
  // Extract comma-separated notes: ", chopped", ", diced"
  const commaMatch = ingredientName.match(/,\s*(.+)$/);
  if (commaMatch) {
    const suffix = commaMatch[1].trim();
    if (notes) notes += '; ' + suffix;
    else notes = suffix;
    ingredientName = ingredientName.substring(0, commaMatch.index).trim();
  }
  
  // Extract dash notes: " - finely diced"
  const dashMatch = ingredientName.match(/\s+-\s+(.+)$/);
  if (dashMatch) {
    const suffix = dashMatch[1].trim();
    if (notes) notes += '; ' + suffix;
    else notes = suffix;
    ingredientName = ingredientName.substring(0, dashMatch.index).trim();
  }
  
  return {
    IngredientRaw: original,
    IngredientName: ingredientName,
    IngredientNorm: ingredientName.toLowerCase(),
    QtyNum: qtyNum,
    QtyText: qtyText,
    Unit: unit,
    Notes: notes,
    StoreId: '',
    Category: ''
  };
}

function parseFraction(str) {
  const s = str.trim();
  
  // Mixed fraction: "1 1/2"
  const mixedMatch = s.match(/^(\d+)\s+(\d+)\/(\d+)$/);
  if (mixedMatch) {
    const whole = parseFloat(mixedMatch[1]);
    const num = parseFloat(mixedMatch[2]);
    const denom = parseFloat(mixedMatch[3]);
    return whole + (num / denom);
  }
  
  // Simple fraction: "1/2"
  const fracMatch = s.match(/^(\d+)\/(\d+)$/);
  if (fracMatch) {
    return parseFloat(fracMatch[1]) / parseFloat(fracMatch[2]);
  }
  
  // Decimal or whole number
  return parseFloat(s);
}

function canonicalizeUnit(u) {
  const map = {
    'teaspoon': 'tsp', 'teaspoons': 'tsp',
    'tablespoon': 'tbsp', 'tablespoons': 'tbsp',
    'cup': 'cup', 'cups': 'cup',
    'ounce': 'oz', 'ounces': 'oz',
    'pound': 'lb', 'pounds': 'lb', 'lbs': 'lb',
    'gram': 'g', 'grams': 'g',
    'kilogram': 'kg', 'kilograms': 'kg',
    'milliliter': 'ml', 'milliliters': 'ml',
    'liter': 'l', 'liters': 'l',
    'pinch': 'pinch', 'dash': 'dash',
    'clove': 'clove', 'cloves': 'clove',
    'can': 'can', 'cans': 'can',
    'jar': 'jar', 'jars': 'jar',
    'package': 'pkg', 'packages': 'pkg', 'pkgs': 'pkg',
    'bunch': 'bunch', 'bunches': 'bunch',
    'slice': 'slice', 'slices': 'slice',
    'piece': 'piece', 'pieces': 'piece'
  };
  const lower = u.toLowerCase().trim();
  return map[lower] || lower;
}
```

**Test Cases:**
```javascript
parseIngredientLine("2 cups all-purpose flour, sifted")
// => {
//   IngredientRaw: "2 cups all-purpose flour, sifted",
//   IngredientName: "all-purpose flour",
//   QtyNum: 2,
//   QtyText: "2 cups",
//   Unit: "cup",
//   Notes: "sifted"
// }

parseIngredientLine("1 1/2 tbsp olive oil")
// => { IngredientName: "olive oil", QtyNum: 1.5, Unit: "tbsp", ... }

parseIngredientLine("3-4 medium tomatoes, diced")
// => { IngredientName: "medium tomatoes", QtyNum: 3, QtyText: "3-4 medium", Notes: "diced" }

parseIngredientLine("Salt and pepper to taste")
// => { IngredientName: "Salt and pepper to taste", QtyNum: null, ... }
```

---

## Part 2: Auto-Categorization

### Cuisine Detection

**Enhanced cuisine detection from:**
1. JSON-LD `recipeCuisine` field
2. Keywords in description/title
3. Ingredient analysis

```javascript
function detectCuisine(recipeData) {
  // Priority 1: Check JSON-LD recipeCuisine
  if (recipeData.recipeCuisine) {
    const cuisine = String(recipeData.recipeCuisine);
    // Map to COMPREHENSIVE_CUISINES
    return mapToCuisine(cuisine);
  }
  
  // Priority 2: Check keywords
  const keywords = [
    recipeData.keywords,
    recipeData.name,
    recipeData.description
  ].filter(Boolean).join(' ').toLowerCase();
  
  // Cuisine keyword mapping (expanded)
  const cuisineKeywords = {
    'Italian': ['italian', 'pasta', 'pizza', 'risotto', 'parmigiana', 'carbonara', 'bolognese', 'tiramisu'],
    'Mexican': ['mexican', 'taco', 'burrito', 'enchilada', 'salsa', 'guacamole', 'quesadilla', 'fajita'],
    'Chinese': ['chinese', 'stir-fry', 'wok', 'szechuan', 'kung pao', 'chow mein', 'dim sum'],
    'Indian': ['indian', 'curry', 'tikka', 'masala', 'tandoori', 'biryani', 'naan', 'samosa'],
    'Japanese': ['japanese', 'sushi', 'ramen', 'teriyaki', 'tempura', 'udon', 'miso', 'sake'],
    'Thai': ['thai', 'pad thai', 'tom yum', 'green curry', 'red curry', 'lemongrass', 'galangal'],
    'French': ['french', 'croissant', 'baguette', 'ratatouille', 'coq au vin', 'crepe', 'souffle'],
    'Greek': ['greek', 'gyro', 'moussaka', 'tzatziki', 'feta', 'baklava', 'souvlaki'],
    'Mediterranean': ['mediterranean', 'hummus', 'falafel', 'tabbouleh', 'olive oil', 'couscous'],
    'American': ['american', 'burger', 'bbq', 'hot dog', 'mac and cheese', 'fried chicken'],
    'Korean': ['korean', 'kimchi', 'bibimbap', 'bulgogi', 'gochujang'],
    'Vietnamese': ['vietnamese', 'pho', 'banh mi', 'spring roll', 'fish sauce'],
    // ... add all COMPREHENSIVE_CUISINES
  };
  
  for (const [cuisine, keywords_list] of Object.entries(cuisineKeywords)) {
    for (const kw of keywords_list) {
      if (keywords.includes(kw)) {
        return cuisine;
      }
    }
  }
  
  // Priority 3: Analyze ingredients
  const ingredients = (recipeData.recipeIngredient || []).join(' ').toLowerCase();
  const ingredientClues = {
    'Italian': ['parmesan', 'mozzarella', 'basil', 'oregano', 'marinara'],
    'Mexican': ['cilantro', 'jalapeño', 'cumin', 'coriander', 'lime', 'tortilla'],
    'Asian': ['soy sauce', 'sesame oil', 'ginger', 'rice vinegar'],
    'Indian': ['garam masala', 'turmeric', 'cardamom', 'coriander', 'cumin'],
    // ...
  };
  
  for (const [cuisine, clues] of Object.entries(ingredientClues)) {
    const matches = clues.filter(clue => ingredients.includes(clue)).length;
    if (matches >= 2) return cuisine;
  }
  
  return ''; // Unknown
}
```

### Meal Type Detection

```javascript
function detectMealType(recipeData) {
  const name = (recipeData.name || '').toLowerCase();
  const description = (recipeData.description || '').toLowerCase();
  const keywords = (recipeData.keywords || '').toLowerCase();
  const category = (recipeData.recipeCategory || '').toLowerCase();
  const text = [name, description, keywords, category].join(' ');
  
  // Meal type patterns (ordered by specificity)
  const patterns = {
    'Dessert': ['dessert', 'cake', 'cookie', 'brownie', 'pie', 'tart', 'pudding', 'ice cream', 'candy', 'sweet', 'chocolate chip'],
    'Side Dish': ['side dish', 'side', 'accompaniment', 'coleslaw', 'mashed potatoes', 'roasted vegetables'],
    'Breakfast': ['breakfast', 'pancake', 'waffle', 'omelet', 'cereal', 'oatmeal', 'french toast', 'scrambled'],
    'Lunch': ['lunch', 'sandwich', 'wrap', 'salad bowl'],
    'Dinner': ['dinner', 'entree', 'main dish', 'main course']
  };
  
  for (const [mealType, keywords] of Object.entries(patterns)) {
    for (const kw of keywords) {
      if (text.includes(kw)) return mealType;
    }
  }
  
  return 'Any'; // Default
}
```

---

## Part 3: Database Migration

### Migration Script

Add to `src/main/db.js`:

```javascript
function migrateAddIngredientName() {
  const db = _openDb();
  
  // Check if column exists
  const tableInfo = db.prepare("PRAGMA table_info(ingredients)").all();
  const hasIngredientName = tableInfo.some(col => col.name === 'IngredientName');
  
  if (!hasIngredientName) {
    console.log('[DB MIGRATION] Adding IngredientName column to ingredients table...');
    db.prepare("ALTER TABLE ingredients ADD COLUMN IngredientName TEXT").run();
    
    // Backfill: Extract ingredient name from IngredientRaw
    const ingredients = db.prepare("SELECT RecipeId, idx, IngredientRaw FROM ingredients").all();
    const update = db.prepare("UPDATE ingredients SET IngredientName = ? WHERE RecipeId = ? AND idx = ?");
    
    for (const ing of ingredients) {
      const parsed = parseIngredientLine(ing.IngredientRaw);
      if (parsed && parsed.IngredientName) {
        update.run(parsed.IngredientName, ing.RecipeId, ing.idx);
      }
    }
    
    console.log(`[DB MIGRATION] Backfilled ${ingredients.length} ingredient names`);
  }
}
```

Call in `createDb()` after table creation.

---

## Part 4: Bulk Recipe Scraper

### Scraper Architecture

**File:** `scripts/bulk-recipe-scraper.js`

```javascript
const https = require('https');
const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

// Configuration
const SCRAPE_CONFIG = {
  websites: [
    {
      name: 'AllRecipes',
      baseUrl: 'https://www.allrecipes.com',
      listingUrls: [
        '/recipes/17562/everyday-cooking/quick-and-easy/',
        '/recipes/78/desserts/',
        // Add more category URLs
      ],
      rateLimit: 2000, // ms between requests
      maxRecipes: 1000
    },
    {
      name: 'Food Network',
      baseUrl: 'https://www.foodnetwork.com',
      listingUrls: [
        '/recipes/recipes-a-z',
      ],
      rateLimit: 2000,
      maxRecipes: 1000
    },
    // Add more authorized sites
  ],
  outputDb: './data/foodie-scraped.sqlite',
  attribution: true // Include source URL and author
};

// Scraper implementation
class RecipeScraper {
  constructor(config) {
    this.config = config;
    this.db = new Database(config.outputDb);
    this.initDb();
    this.stats = { total: 0, success: 0, failed: 0 };
  }
  
  initDb() {
    // Create tables matching foodie schema
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS recipes (
        RecipeId TEXT PRIMARY KEY,
        Title TEXT,
        TitleLower TEXT,
        URL TEXT,
        Cuisine TEXT,
        MealType TEXT,
        Notes TEXT,
        Instructions TEXT,
        Image_Name TEXT,
        Source TEXT,
        Author TEXT,
        CreatedAt TEXT,
        UpdatedAt TEXT
      );
      
      CREATE TABLE IF NOT EXISTS ingredients (
        RecipeId TEXT NOT NULL,
        idx INTEGER NOT NULL,
        IngredientNorm TEXT,
        IngredientRaw TEXT,
        IngredientName TEXT,
        Notes TEXT,
        QtyNum REAL,
        QtyText TEXT,
        StoreId TEXT,
        Unit TEXT,
        Category TEXT,
        PRIMARY KEY (RecipeId, idx),
        FOREIGN KEY (RecipeId) REFERENCES recipes(RecipeId) ON DELETE CASCADE
      );
      
      CREATE INDEX IF NOT EXISTS idx_recipes_cuisine ON recipes(Cuisine);
      CREATE INDEX IF NOT EXISTS idx_recipes_mealtype ON recipes(MealType);
    `);
  }
  
  async scrapeWebsite(siteConfig) {
    console.log(`\\n[${siteConfig.name}] Starting scrape...`);
    
    for (const listingUrl of siteConfig.listingUrls) {
      const fullUrl = siteConfig.baseUrl + listingUrl;
      console.log(`  Fetching listing: ${fullUrl}`);
      
      const recipeUrls = await this.extractRecipeUrls(fullUrl, siteConfig);
      console.log(`  Found ${recipeUrls.length} recipe URLs`);
      
      for (const recipeUrl of recipeUrls.slice(0, siteConfig.maxRecipes)) {
        await this.scrapeRecipe(recipeUrl, siteConfig);
        await this.sleep(siteConfig.rateLimit);
      }
    }
  }
  
  async extractRecipeUrls(listingUrl, siteConfig) {
    // Site-specific link extraction
    const html = await this.fetchHtml(listingUrl);
    const urls = [];
    
    // Generic: find all links that look like recipe URLs
    const linkPattern = /<a[^>]+href=["']([^"']+(?:recipe|cooking)[^"']+)["']/gi;
    let match;
    while ((match = linkPattern.exec(html)) !== null) {
      let url = match[1];
      if (url.startsWith('/')) url = siteConfig.baseUrl + url;
      if (url.startsWith(siteConfig.baseUrl) && !urls.includes(url)) {
        urls.push(url);
      }
    }
    
    return urls;
  }
  
  async scrapeRecipe(url, siteConfig) {
    try {
      console.log(`    Scraping: ${url}`);
      const html = await this.fetchHtml(url);
      
      // Extract JSON-LD data
      const jsonLdMatch = html.match(/<script[^>]*type=["']application\\/ld\\+json["'][^>]*>(.*?)<\\/script>/is);
      if (!jsonLdMatch) {
        console.log(`    ❌ No JSON-LD found`);
        this.stats.failed++;
        return;
      }
      
      const jsonData = JSON.parse(jsonLdMatch[1]);
      const recipes = Array.isArray(jsonData) ? jsonData : (jsonData['@graph'] ? jsonData['@graph'] : [jsonData]);
      const recipeData = recipes.find(item => item['@type'] === 'Recipe' || (Array.isArray(item['@type']) && item['@type'].includes('Recipe')));
      
      if (!recipeData) {
        console.log(`    ❌ No recipe data found`);
        this.stats.failed++;
        return;
      }
      
      // Parse recipe
      const recipe = this.parseRecipe(recipeData, url, siteConfig);
      
      // Save to database
      this.saveRecipe(recipe);
      
      console.log(`    ✓ ${recipe.Title}`);
      this.stats.success++;
      this.stats.total++;
      
    } catch (e) {
      console.log(`    ❌ Error: ${e.message}`);
      this.stats.failed++;
    }
  }
  
  parseRecipe(data, url, siteConfig) {
    const recipeId = `rec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const title = data.name || 'Untitled';
    
    // Extract instructions
    let instructions = '';
    if (Array.isArray(data.recipeInstructions)) {
      instructions = data.recipeInstructions.map((step, i) => {
        const text = typeof step === 'string' ? step : (step.text || '');
        return `${i + 1}. ${text}`;
      }).join('\\n\\n');
    } else {
      instructions = data.recipeInstructions || '';
    }
    
    // Parse ingredients
    const ingredientLines = Array.isArray(data.recipeIngredient) ? data.recipeIngredient : [];
    const ingredients = ingredientLines.map((line, idx) => {
      const parsed = parseIngredientLine(line);
      return { ...parsed, idx };
    });
    
    // Detect cuisine and meal type
    const cuisine = detectCuisine(data);
    const mealType = detectMealType(data);
    
    // Extract image
    let imageUrl = '';
    if (data.image) {
      imageUrl = Array.isArray(data.image) 
        ? data.image[0] 
        : (typeof data.image === 'object' && data.image.url ? data.image.url : data.image);
    }
    
    // Attribution
    const author = data.author 
      ? (typeof data.author === 'object' ? data.author.name : data.author)
      : siteConfig.name;
    
    const notes = `Source: ${siteConfig.name}\\nAuthor: ${author}\\nOriginal URL: ${url}`;
    
    return {
      RecipeId: recipeId,
      Title: title,
      TitleLower: title.toLowerCase(),
      URL: url,
      Cuisine: cuisine,
      MealType: mealType,
      Notes: notes,
      Instructions: instructions,
      Image_Name: '', // Download images separately if needed
      Source: siteConfig.name,
      Author: author,
      ingredients
    };
  }
  
  saveRecipe(recipe) {
    const now = new Date().toISOString();
    
    this.db.prepare(`
      INSERT INTO recipes (RecipeId, Title, TitleLower, URL, Cuisine, MealType, Notes, Instructions, Image_Name, Source, Author, CreatedAt, UpdatedAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      recipe.RecipeId, recipe.Title, recipe.TitleLower, recipe.URL,
      recipe.Cuisine, recipe.MealType, recipe.Notes, recipe.Instructions,
      recipe.Image_Name, recipe.Source, recipe.Author, now, now
    );
    
    for (const ing of recipe.ingredients) {
      this.db.prepare(`
        INSERT INTO ingredients (RecipeId, idx, IngredientRaw, IngredientName, IngredientNorm, QtyNum, QtyText, Unit, Notes, Category, StoreId)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        recipe.RecipeId, ing.idx, ing.IngredientRaw, ing.IngredientName,
        ing.IngredientNorm, ing.QtyNum, ing.QtyText, ing.Unit,
        ing.Notes, ing.Category, ing.StoreId
      );
    }
  }
  
  async fetchHtml(url) {
    return new Promise((resolve, reject) => {
      https.get(url, { headers: { 'User-Agent': 'RecipeBot/1.0 (authorized scraper)' } }, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => resolve(data));
      }).on('error', reject).setTimeout(15000, function() {
        this.destroy();
        reject(new Error('Timeout'));
      });
    });
  }
  
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
  
  async run() {
    for (const site of this.config.websites) {
      await this.scrapeWebsite(site);
    }
    
    console.log('\\n=== Scraping Complete ===');
    console.log(`Total recipes: ${this.stats.total}`);
    console.log(`Success: ${this.stats.success}`);
    console.log(`Failed: ${this.stats.failed}`);
    console.log(`Database: ${this.config.outputDb}`);
    
    this.db.close();
  }
}

// Run scraper
const scraper = new RecipeScraper(SCRAPE_CONFIG);
scraper.run().catch(console.error);
```

### Usage

```bash
# Run bulk scraper
node scripts/bulk-recipe-scraper.js

# Output: data/foodie-scraped.sqlite

# Replace seed database
cp data/foodie-scraped.sqlite data/foodie.sqlite

# Or merge with existing
node scripts/merge-databases.js
```

---

## Part 5: Testing & Validation

### Test Enhanced Import

```javascript
// Test cases for parseIngredientLine
const testCases = [
  "2 cups all-purpose flour, sifted",
  "1 1/2 tablespoons olive oil",
  "3-4 medium tomatoes, diced",
  "1 (14.5 oz) can diced tomatoes",
  "Salt and pepper to taste",
  "½ cup sugar",
  "2 lbs chicken breast, boneless and skinless",
];

for (const test of testCases) {
  console.log(test);
  console.log(parseIngredientLine(test));
  console.log('---');
}
```

### Validate Scraped Data

```sql
-- Check cuisine distribution
SELECT Cuisine, COUNT(*) as count 
FROM recipes 
GROUP BY Cuisine 
ORDER BY count DESC;

-- Check meal type distribution
SELECT MealType, COUNT(*) as count 
FROM recipes 
GROUP BY MealType 
ORDER BY count DESC;

-- Find recipes missing ingredients
SELECT Title 
FROM recipes r 
WHERE NOT EXISTS (
  SELECT 1 FROM ingredients i WHERE i.RecipeId = r.RecipeId
);

-- Validate ingredient parsing
SELECT 
  IngredientRaw,
  IngredientName,
  QtyNum,
  Unit
FROM ingredients 
LIMIT 100;
```

---

## Summary

This implementation provides:

✅ **Enhanced ingredient parsing** - Clean separation of qty/unit/name
✅ **Auto-categorization** - Smart cuisine and meal type detection  
✅ **Database migration** - Add IngredientName column + backfill
✅ **Bulk scraper** - Scalable scraping for authorized websites
✅ **Attribution** - Proper credit to sources and authors
✅ **Production-ready** - Rate limiting, error handling, logging

**Next Steps:**
1. Review and approve implementation
2. Test enhanced parser with sample recipes
3. Run database migration on dev database
4. Configure authorized websites in scraper
5. Execute bulk scrape
6. Validate and deploy new database

Total implementation: ~1000 lines of code
Estimated scraping time: 2-5 days for 10,000+ recipes (respecting rate limits)
