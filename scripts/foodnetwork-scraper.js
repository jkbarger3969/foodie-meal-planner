#!/usr/bin/env node

/**
 * Food Network Recipe Scraper
 * 
 * Specialized scraper for Food Network that bypasses anti-bot protection by:
 * 1. Using realistic browser headers (User-Agent, Accept-Encoding, etc.)
 * 2. Supporting gzip/deflate compression
 * 3. Adding human-like delays between requests
 * 4. Extracting JSON-LD structured data (Schema.org Recipe)
 * 5. Integrating with existing foodie-scraped.sqlite database
 */

const https = require('https');
const { URL } = require('url');
const zlib = require('zlib');
const path = require('path');
const Database = require('better-sqlite3');
const crypto = require('crypto');

// Import shared functions from bulk scraper
const { parseIngredientLine, detectCuisine, detectMealType } = require('./bulk-recipe-scraper.js');

// ========================================
// CONFIGURATION
// ========================================

const CONFIG = {
  // Database
  outputDb: path.resolve(__dirname, '../data/foodie-scraped.sqlite'),
  
  // Food Network URLs
  baseUrl: 'https://www.foodnetwork.com',
  listingUrls: [
    // Meal types (7)
    '/recipes/breakfast',
    '/recipes/brunch',
    '/recipes/lunch',
    '/recipes/dinner',
    '/recipes/appetizers',
    '/recipes/side-dishes',
    '/recipes/main-dish',
    
    // Ingredients - Poultry (5)
    '/recipes/ingredients/poultry/chicken',
    '/recipes/ingredients/poultry/turkey',
    '/recipes/ingredients/poultry/duck',
    '/recipes/ingredients/poultry/game-birds',
    '/recipes/ingredients/poultry/cornish-hen',
    
    // Ingredients - Meat (6)
    '/recipes/ingredients/meat/beef',
    '/recipes/ingredients/meat/pork',
    '/recipes/ingredients/meat/lamb',
    '/recipes/ingredients/meat/veal',
    '/recipes/ingredients/meat/game',
    '/recipes/ingredients/meat/sausage',
    
    // Ingredients - Seafood (4)
    '/recipes/ingredients/seafood/fish',
    '/recipes/ingredients/seafood/shellfish',
    '/recipes/ingredients/seafood/salmon',
    '/recipes/ingredients/seafood/shrimp',
    
    // Ingredients - Other (5)
    '/recipes/ingredients/pasta',
    '/recipes/ingredients/rice',
    '/recipes/ingredients/vegetables',
    '/recipes/ingredients/cheese',
    '/recipes/ingredients/eggs',
    
    // Cooking methods (8)
    '/recipes/main-dish/quick-and-easy-dinners',
    '/recipes/main-dish/slow-cooker-main-dishes',
    '/recipes/main-dish/instant-pot-recipes',
    '/recipes/main-dish/one-pot-meals',
    '/recipes/main-dish/sheet-pan-dinners',
    '/recipes/main-dish/air-fryer-recipes',
    '/recipes/grilling',
    '/recipes/baking',
    
    // Cuisines (10)
    '/recipes/cuisines/american',
    '/recipes/cuisines/italian',
    '/recipes/cuisines/mexican',
    '/recipes/cuisines/asian',
    '/recipes/cuisines/french',
    '/recipes/cuisines/mediterranean',
    '/recipes/cuisines/southern',
    '/recipes/cuisines/tex-mex',
    '/recipes/cuisines/greek',
    '/recipes/cuisines/indian',
    
    // Dietary (3)
    '/recipes/healthy/vegetarian',
    '/recipes/healthy/vegan',
    '/recipes/healthy/gluten-free',
    
    // Desserts (4)
    '/recipes/desserts',
    '/recipes/desserts/cakes',
    '/recipes/desserts/cookies',
    '/recipes/desserts/pies',
    
    // Seasonal/Holiday (4)
    '/recipes/holidays-and-events/thanksgiving',
    '/recipes/holidays-and-events/christmas',
    '/recipes/holidays-and-events/summer',
    '/recipes/holidays-and-events/fall',
  ],
  
  // Timing (human-like behavior)
  delayBetweenRequests: 3000,  // 3 seconds between requests
  delayBetweenPages: 5000,      // 5 seconds between category pages
  randomDelayVariance: 2000,    // ±2 seconds random variation
  
  // Limits
  maxRecipes: 2500,
  maxRetriesPerUrl: 3,
  requestTimeout: 30000,  // 30 second timeout
};

// ========================================
// REALISTIC BROWSER HEADERS
// ========================================

const BROWSER_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
  'Accept-Encoding': 'gzip, deflate, br',  // CRITICAL for Food Network
  'DNT': '1',
  'Connection': 'keep-alive',
  'Upgrade-Insecure-Requests': '1',
  'Sec-Fetch-Dest': 'document',
  'Sec-Fetch-Mode': 'navigate',
  'Sec-Fetch-Site': 'none',
  'Sec-Fetch-User': '?1',
  'Cache-Control': 'max-age=0',
};

// ========================================
// FOOD NETWORK SCRAPER CLASS
// ========================================

class FoodNetworkScraper {
  constructor(config) {
    this.config = config;
    this.db = new Database(config.outputDb);
    this.stats = {
      pagesProcessed: 0,
      recipesFound: 0,
      recipesScraped: 0,
      recipesFailed: 0,
      recipesSkipped: 0,
    };
    this.processedUrls = new Set();
    this.initDb();
  }

  initDb() {
    // Database schema should already exist from bulk scraper
    // Just verify the table exists
    const tableExists = this.db.prepare(`
      SELECT name FROM sqlite_master WHERE type='table' AND name='recipes'
    `).get();

    if (!tableExists) {
      console.error('❌ Error: recipes table does not exist in database!');
      console.error('Please run the main bulk-recipe-scraper.js first to create the schema.');
      process.exit(1);
    }

    // Load already-scraped URLs to avoid duplicates
    const existing = this.db.prepare('SELECT URL FROM recipes WHERE URL LIKE ?').all('%foodnetwork.com%');
    existing.forEach(row => this.processedUrls.add(row.URL));
    console.log(`[DB] Loaded ${this.processedUrls.size} existing Food Network recipes`);
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  randomDelay(baseMs, varianceMs) {
    const variance = Math.random() * varianceMs * 2 - varianceMs;
    return baseMs + variance;
  }

  async humanDelay() {
    const delay = this.randomDelay(this.config.delayBetweenRequests, this.config.randomDelayVariance);
    await this.sleep(delay);
  }

  async pageDelay() {
    const delay = this.randomDelay(this.config.delayBetweenPages, this.config.randomDelayVariance);
    console.log(`[DELAY] Waiting ${Math.round(delay / 1000)}s before next page...`);
    await this.sleep(delay);
  }

  /**
   * Fetch HTML with realistic browser headers and gzip support
   */
  async fetchHtml(url, retries = 0) {
    return new Promise((resolve, reject) => {
      const urlObj = new URL(url);
      
      const options = {
        hostname: urlObj.hostname,
        path: urlObj.pathname + urlObj.search,
        method: 'GET',
        headers: {
          ...BROWSER_HEADERS,
          'Host': urlObj.hostname,
          'Referer': this.config.baseUrl,
        },
        timeout: this.config.requestTimeout,
      };

      const req = https.request(options, (res) => {
        const chunks = [];
        const encoding = res.headers['content-encoding'];

        // Handle different encodings
        let stream = res;
        if (encoding === 'gzip') {
          stream = res.pipe(zlib.createGunzip());
        } else if (encoding === 'deflate') {
          stream = res.pipe(zlib.createInflate());
        } else if (encoding === 'br') {
          stream = res.pipe(zlib.createBrotliDecompress());
        }

        stream.on('data', chunk => chunks.push(chunk));
        stream.on('end', () => {
          const html = Buffer.concat(chunks).toString('utf-8');
          
          // Check for 403/access denied
          if (res.statusCode === 403 || html.includes('Access Denied')) {
            if (retries < this.config.maxRetriesPerUrl) {
              console.log(`[RETRY] 403 error, retrying (${retries + 1}/${this.config.maxRetriesPerUrl})...`);
              setTimeout(() => {
                this.fetchHtml(url, retries + 1).then(resolve).catch(reject);
              }, 5000 * (retries + 1)); // Exponential backoff
              return;
            }
            reject(new Error(`403 Access Denied after ${retries} retries`));
            return;
          }

          if (res.statusCode !== 200) {
            reject(new Error(`HTTP ${res.statusCode}`));
            return;
          }

          resolve(html);
        });

        stream.on('error', reject);
      });

      req.on('error', reject);
      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Request timeout'));
      });

      req.end();
    });
  }

  /**
   * Extract recipe URLs from category listing page
   */
  extractRecipeUrls(html, baseUrl) {
    const urls = [];
    const recipePattern = /\/recipes\/[a-z0-9-]+-\d+/gi;
    
    // Extract all potential recipe URLs
    const matches = html.match(recipePattern);
    if (matches) {
      matches.forEach(path => {
        const fullUrl = baseUrl + path;
        if (!urls.includes(fullUrl)) {
          urls.push(fullUrl);
        }
      });
    }

    return urls;
  }

  /**
   * Extract JSON-LD structured data from recipe page
   */
  extractJsonLd(html) {
    const jsonLdPattern = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
    const matches = [];
    let match;

    while ((match = jsonLdPattern.exec(html)) !== null) {
      try {
        const json = JSON.parse(match[1]);
        if (json['@type'] === 'Recipe' || (Array.isArray(json['@graph']) && json['@graph'].some(item => item['@type'] === 'Recipe'))) {
          matches.push(json);
        }
      } catch (e) {
        // Invalid JSON, skip
      }
    }

    return matches;
  }

  /**
   * Parse JSON-LD recipe data into database format
   */
  parseRecipe(jsonLd, sourceUrl) {
    // Handle @graph format
    let recipe = jsonLd;
    if (jsonLd['@graph']) {
      recipe = jsonLd['@graph'].find(item => item['@type'] === 'Recipe');
      if (!recipe) return null;
    }

    if (recipe['@type'] !== 'Recipe') return null;

    // Generate RecipeId
    const recipeId = crypto.randomBytes(8).toString('hex');

    // Extract basic fields
    const title = (recipe.name || '').trim();
    if (!title) return null;

    // Extract ingredients as array
    let ingredientLines = [];
    if (Array.isArray(recipe.recipeIngredient)) {
      ingredientLines = recipe.recipeIngredient;
    } else if (typeof recipe.recipeIngredient === 'string') {
      ingredientLines = recipe.recipeIngredient.split('\n');
    }

    // Parse ingredients using bulk scraper function
    const ingredients = [];
    ingredientLines.forEach((line, idx) => {
      const parsed = parseIngredientLine(line);
      if (parsed) {
        ingredients.push({
          idx: idx + 1,
          IngredientRaw: line.trim(),
          IngredientName: parsed.name,
          IngredientNorm: parsed.normalized,
          QtyNum: parsed.qtyNum,
          QtyText: parsed.qtyText,
          Unit: parsed.unit,
          Notes: parsed.notes,
          Category: '',
          StoreId: ''
        });
      }
    });

    // Extract instructions
    let instructions = '';
    if (Array.isArray(recipe.recipeInstructions)) {
      instructions = recipe.recipeInstructions
        .map((step, i) => {
          if (typeof step === 'string') return `${i + 1}. ${step}`;
          if (step.text) return `${i + 1}. ${step.text}`;
          if (step['@type'] === 'HowToStep') return `${i + 1}. ${step.text || ''}`;
          return '';
        })
        .filter(s => s)
        .join('\n');
    } else if (typeof recipe.recipeInstructions === 'string') {
      instructions = recipe.recipeInstructions;
    }

    // Extract servings
    const servings = this.parseServings(recipe.recipeYield);

    // Detect cuisine and meal type
    const keywords = recipe.keywords || '';
    const category = Array.isArray(recipe.recipeCategory) ? recipe.recipeCategory.join(' ') : (recipe.recipeCategory || '');
    const cuisine = detectCuisine(title, ingredientLines.join(' '), keywords, category) || 'American';
    const mealType = detectMealType(title, ingredientLines.join(' '), keywords, category) || 'Dinner';

    // Attribution
    const author = recipe.author
      ? (typeof recipe.author === 'object' ? recipe.author.name : recipe.author)
      : 'Food Network';

    const notes = `Source: Food Network\nAuthor: ${author}\nOriginal URL: ${sourceUrl}`;

    return {
      RecipeId: recipeId,
      Title: title,
      TitleLower: title.toLowerCase(),
      URL: sourceUrl,
      Cuisine: cuisine,
      MealType: mealType,
      Notes: notes,
      Instructions: instructions.trim(),
      Image_Name: '',
      Source: 'Food Network',
      Author: author,
      default_servings: servings,
      ingredients: ingredients
    };
  }

  parseServings(recipeYield) {
    if (!recipeYield) return 4;
    
    if (typeof recipeYield === 'number') return recipeYield;
    
    if (typeof recipeYield === 'string') {
      const match = recipeYield.match(/(\d+)/);
      if (match) return parseInt(match[1]);
    }
    
    if (Array.isArray(recipeYield)) {
      const first = recipeYield[0];
      if (typeof first === 'number') return first;
      const match = String(first).match(/(\d+)/);
      if (match) return parseInt(match[1]);
    }
    
    return 4;
  }

  /**
   * Scrape a single recipe page
   */
  async scrapeRecipe(url) {
    try {
      // Skip if already processed
      if (this.processedUrls.has(url)) {
        this.stats.recipesSkipped++;
        return null;
      }

      console.log(`[RECIPE] Fetching ${url}`);
      const html = await this.fetchHtml(url);

      // Extract JSON-LD data
      const jsonLdBlocks = this.extractJsonLd(html);
      if (jsonLdBlocks.length === 0) {
        console.log(`[RECIPE] ⚠️  No JSON-LD data found`);
        this.stats.recipesFailed++;
        return null;
      }

      // Parse first recipe block
      const recipe = this.parseRecipe(jsonLdBlocks[0], url);
      if (!recipe || !recipe.Title) {
        console.log(`[RECIPE] ⚠️  Failed to parse recipe data`);
        this.stats.recipesFailed++;
        return null;
      }

      // Save to database
      const now = new Date().toISOString();
      
      this.db.prepare(`
        INSERT INTO recipes (RecipeId, Title, TitleLower, URL, Cuisine, MealType, Notes, Instructions, Image_Name, Source, Author, default_servings, CreatedAt, UpdatedAt)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        recipe.RecipeId, recipe.Title, recipe.TitleLower, recipe.URL,
        recipe.Cuisine, recipe.MealType, recipe.Notes, recipe.Instructions,
        recipe.Image_Name, recipe.Source, recipe.Author, recipe.default_servings,
        now, now
      );
      
      // Save ingredients
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

      this.processedUrls.add(url);
      this.stats.recipesScraped++;
      
      console.log(`[RECIPE] ✅ Saved: ${recipe.Title} [${recipe.Cuisine}/${recipe.MealType}]`);
      return recipe;

    } catch (error) {
      console.log(`[RECIPE] ❌ Error: ${error.message}`);
      this.stats.recipesFailed++;
      return null;
    }
  }

  /**
   * Scrape a category listing page
   */
  async scrapeCategoryPage(url) {
    try {
      console.log(`\n[PAGE] Fetching category: ${url}`);
      const html = await this.fetchHtml(url);

      // Extract recipe URLs
      const recipeUrls = this.extractRecipeUrls(html, this.config.baseUrl);
      console.log(`[PAGE] Found ${recipeUrls.length} recipe URLs`);
      
      this.stats.recipesFound += recipeUrls.length;

      // Scrape each recipe
      for (const recipeUrl of recipeUrls) {
        // Check if we've hit the limit
        if (this.stats.recipesScraped >= this.config.maxRecipes) {
          console.log(`\n✅ Reached target of ${this.config.maxRecipes} recipes!`);
          return false; // Signal to stop
        }

        await this.scrapeRecipe(recipeUrl);
        await this.humanDelay(); // Human-like delay between recipes
      }

      this.stats.pagesProcessed++;
      return true; // Continue processing

    } catch (error) {
      console.log(`[PAGE] ❌ Error: ${error.message}`);
      return true; // Continue with next page despite error
    }
  }

  /**
   * Main scraping process
   */
  async run() {
    console.log('========================================');
    console.log('🍳 FOOD NETWORK RECIPE SCRAPER');
    console.log('========================================');
    console.log(`Database: ${this.config.outputDb}`);
    console.log(`Target: ${this.config.maxRecipes} recipes`);
    console.log(`Category URLs: ${this.config.listingUrls.length}`);
    console.log(`Existing Food Network recipes: ${this.processedUrls.size}`);
    console.log('========================================\n');

    const startTime = Date.now();

    for (const listingUrl of this.config.listingUrls) {
      const fullUrl = this.config.baseUrl + listingUrl;
      const shouldContinue = await this.scrapeCategoryPage(fullUrl);
      
      if (!shouldContinue) {
        break; // Stop if target reached
      }

      // Longer delay between category pages
      if (this.stats.pagesProcessed < this.config.listingUrls.length) {
        await this.pageDelay();
      }
    }

    const endTime = Date.now();
    const duration = Math.round((endTime - startTime) / 1000 / 60);

    // Final report
    console.log('\n========================================');
    console.log('✅ SCRAPING COMPLETE');
    console.log('========================================');
    console.log(`Pages processed: ${this.stats.pagesProcessed}`);
    console.log(`Recipe URLs found: ${this.stats.recipesFound}`);
    console.log(`Recipes scraped: ${this.stats.recipesScraped}`);
    console.log(`Recipes failed: ${this.stats.recipesFailed}`);
    console.log(`Recipes skipped (duplicates): ${this.stats.recipesSkipped}`);
    console.log(`Duration: ${duration} minutes`);
    console.log('========================================\n');
  }
}

// ========================================
// RUN SCRAPER
// ========================================

if (require.main === module) {
  const scraper = new FoodNetworkScraper(CONFIG);
  scraper.run().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

module.exports = FoodNetworkScraper;
