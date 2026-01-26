#!/usr/bin/env node

/**
 * Bulk Recipe Scraper with Puppeteer
 * 
 * Scrapes recipe data from authorized websites and saves to SQLite database.
 * Features:
 * - Puppeteer-based infinite scroll handling
 * - Enhanced ingredient parsing with IngredientName field
 * - Auto-categorization of cuisine and meal type
 * - Proper attribution to authors and sources
 * - Rate limiting for respectful scraping
 * - JSON-LD structured data extraction
 */

const https = require('https');
const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

// ========== Configuration ==========

const SCRAPE_CONFIG = {
  websites: [
    {
      name: 'AllRecipes',
      baseUrl: 'https://www.allrecipes.com',
      listingUrls: [
        // Dinners (10 URLs)
        '/recipes/17562/dinner/',
        '/recipes/17057/everyday-cooking/more-meal-ideas/5-ingredients/main-dishes/',
        '/recipes/15436/everyday-cooking/one-pot-meals/',
        '/recipes/1947/everyday-cooking/quick-and-easy/',
        '/recipes/455/everyday-cooking/more-meal-ideas/30-minute-meals/',
        '/recipes/17889/everyday-cooking/family-friendly/family-dinners/',
        '/recipes/94/soups-stews-and-chili/',
        '/recipes/16099/everyday-cooking/comfort-food/',
        '/recipes/80/main-dish/',
        '/recipes/22992/everyday-cooking/sheet-pan-dinners/',
        
        // Meals (9 URLs)
        '/recipes/78/breakfast-and-brunch/',
        '/recipes/17561/lunch/',
        '/recipes/76/appetizers-and-snacks/',
        '/recipes/96/salad/',
        '/recipes/81/side-dish/',
        '/recipes/16369/soups-stews-and-chili/soup/',
        '/recipes/156/bread/',
        '/recipes/77/drinks/',
        '/recipes/79/desserts/',
        
        // Asian Cuisines (6 URLs)
        '/recipes/695/world-cuisine/asian/chinese/',
        '/recipes/233/world-cuisine/asian/indian/',
        '/recipes/699/world-cuisine/asian/japanese/',
        '/recipes/700/world-cuisine/asian/korean/',
        '/recipes/702/world-cuisine/asian/thai/',
        '/recipes/696/world-cuisine/asian/filipino/',
        
        // European Cuisines (4 URLs)
        '/recipes/721/world-cuisine/european/french/',
        '/recipes/723/world-cuisine/european/italian/',
        '/recipes/722/world-cuisine/european/german/',
        '/recipes/731/world-cuisine/european/greek/',
        
        // Other Cuisines (5 URLs)
        '/recipes/728/world-cuisine/latin-american/mexican/',
        '/recipes/226/world-cuisine/african/',
        '/recipes/228/world-cuisine/australian-and-new-zealander/',
        '/recipes/235/world-cuisine/middle-eastern/',
        '/recipes/733/world-cuisine/canadian/',
        '/recipes/236/us-recipes/',
        
        // Chicken (8 URLs)
        '/recipes/201/meat-and-poultry/chicken/',
        '/recipes/659/meat-and-poultry/chicken/chicken-breasts/',
        '/recipes/660/meat-and-poultry/chicken/chicken-legs/',
        '/recipes/661/meat-and-poultry/chicken/chicken-thighs/',
        '/recipes/663/meat-and-poultry/chicken/chicken-wings/',
        '/recipes/14908/meat-and-poultry/chicken/cornish-hens/',
        '/recipes/665/meat-and-poultry/game-meats/duck/',
        '/recipes/17022/meat-and-poultry/chicken/ground-chicken/',
        
        // Beef & Other Meats (8 URLs)
        '/recipes/200/meat-and-poultry/beef/',
        '/recipes/462/meat-and-poultry/beef/chuck/',
        '/recipes/17234/meat-and-poultry/beef/ribs/',
        '/recipes/469/meat-and-poultry/beef/tenderloin/',
        '/recipes/461/meat-and-poultry/beef/brisket/',
        '/recipes/205/meat-and-poultry/pork/',
        '/recipes/93/seafood/',
        '/recipes/95/pasta-and-noodles/',
        
        // Cooking Methods (5 URLs)
        '/recipes/22882/everyday-cooking/instant-pot/',
        '/recipes/23070/everyday-cooking/cookware-and-equipment/air-fryer/',
        '/recipes/253/everyday-cooking/slow-cooker/',
        '/recipes/88/bbq-grilling/',
        '/recipes/17583/everyday-cooking/cookware-and-equipment/',
        
        // Dietary & Healthy (14 URLs)
        '/recipes/16705/healthy-recipes/paleo-diet/',
        '/recipes/22959/healthy-recipes/keto-diet/',
        '/recipes/742/healthy-recipes/low-carb/',
        '/recipes/741/healthy-recipes/gluten-free/',
        '/recipes/738/healthy-recipes/dairy-free/',
        '/recipes/739/healthy-recipes/diabetic/',
        '/recipes/22485/healthy-recipes/heart-healthy-recipes/',
        '/recipes/1231/healthy-recipes/low-fat/',
        '/recipes/1232/healthy-recipes/low-calorie/',
        '/recipes/1788/healthy-recipes/low-sodium/',
        '/recipes/737/healthy-recipes/low-cholesterol/',
        '/recipes/16704/healthy-recipes/mediterranean-diet/',
        '/recipes/22590/healthy-recipes/whole30/',
        '/recipes/22607/healthy-recipes/weight-loss/',
        
        // Vegetarian & Vegan (10 URLs)
        '/recipes/87/everyday-cooking/vegetarian/',
        '/recipes/129/everyday-cooking/vegetarian/bbq-grilling/',
        '/recipes/155/everyday-cooking/vegetarian/breakfast-and-brunch/',
        '/recipes/263/everyday-cooking/vegetarian/appetizers/',
        '/recipes/264/everyday-cooking/vegetarian/side-dishes/',
        '/recipes/265/everyday-cooking/vegetarian/main-dishes/',
        '/recipes/266/everyday-cooking/vegetarian/soups-and-stews/',
        '/recipes/1205/everyday-cooking/slow-cooker/vegetarian/',
        '/recipes/1227/everyday-cooking/vegan/',
        '/recipes/16800/main-dish/pasta/lasagna/vegetarian-lasagna/',
        
        // Desserts (10 URLs)
        '/recipes/1557/desserts/chocolate/',
        '/recipes/15840/desserts/crisps-and-crumbles/',
        '/recipes/17140/desserts/fruit-desserts/',
        '/recipes/17203/desserts/specialty-desserts/',
        '/recipes/22935/desserts/caramel/',
        '/recipes/276/desserts/cakes/',
        '/recipes/361/desserts/cobbler/',
        '/recipes/362/desserts/cookies/',
        '/recipes/364/desserts/frozen-desserts/',
        '/recipes/363/desserts/pies/',
      ],
      rateLimit: 2500,
      maxRecipes: 5000 // Increased target
    },
    // FOOD NETWORK REMOVED - Access Denied (403) errors due to anti-bot protection
    // Even with accepted privacy agreement in browser, automated requests are blocked
    {
      name: 'Serious Eats',
      baseUrl: 'https://www.seriouseats.com',
      listingUrls: [
        // Main recipe collections
        '/all-recipes-5117985',
        '/recipes-by-course-5117906',
        '/recipes-by-ingredient-5117908',
        '/recipes-by-cuisine-5117899',
        '/recipes-by-method-5117911',
        '/recipes-by-diet-5117779',
        
        // Cuisines (8 regions)
        '/african-cuisine-guides-5117176',
        '/asian-cuisine-guides-5117164',
        '/european-cuisine-guides-5117182',
        '/latin-american-cuisine-guides-5117189',
        '/north-american-cuisine-guides-5117195',
        '/middle-eastern-cuisine-guides-5117192',
        '/caribbean-cuisine-guides-5117179',
        '/oceanian-cuisine-guides-5117198',
        
        // Course types
        '/appetizer-recipes-5117830',
        '/breakfast-recipes-5117839',
        '/dessert-recipes-5117853',
        '/dinner-recipes-5117856',
        '/lunch-recipes-5117878',
        '/side-dish-recipes-5117891',
        '/snack-recipes-5117894',
        
        // Popular ingredients
        '/chicken-recipes-5117845',
        '/beef-recipes-5117836',
        '/pork-recipes-5117885',
        '/seafood-recipes-5117888',
        '/pasta-recipes-5117882',
        '/rice-recipes-5117887',
        '/vegetable-recipes-5117903',
        
        // Cooking methods
        '/grilling-recipes-5117862',
        '/baking-recipes-5117833',
        '/slow-cooker-recipes-5117892',
        '/instant-pot-recipes-5117870',
        '/air-fryer-recipes-5117826',
        '/one-pot-recipes-5117881',
        
        // Holiday/Seasonal (from previous config if accessible)
        '/holiday-and-seasonal-recipes-5117865',
      ],
      rateLimit: 3000,
      maxRecipes: 2500
    },
    {
      name: 'BBC Good Food',
      baseUrl: 'https://www.bbcgoodfood.com',
      listingUrls: [
        // Cooking methods (8)
        '/recipes/collection/quick-and-easy-family-recipes',
        '/recipes/collection/one-pot-recipes',
        '/recipes/collection/slow-cooker-recipes',
        '/recipes/collection/instant-pot-recipes',
        '/recipes/collection/air-fryer-recipes',
        '/recipes/collection/batch-cooking-recipes',
        '/recipes/collection/30-minute-meals',
        '/recipes/collection/5-ingredient-recipes',
        
        // Meal types (8)
        '/recipes/collection/breakfast-recipes',
        '/recipes/collection/brunch-recipes',
        '/recipes/collection/lunch-recipes',
        '/recipes/collection/quick-lunch-recipes',
        '/recipes/collection/dinner-recipes',
        '/recipes/collection/quick-dinner-recipes',
        '/recipes/collection/easy-dinner-recipes',
        '/recipes/collection/dessert-recipes',
        
        // Popular cuisines (20)
        '/recipes/collection/american-recipes',
        '/recipes/collection/chinese-recipes',
        '/recipes/collection/indian-recipes',
        '/recipes/collection/italian-recipes',
        '/recipes/collection/mexican-recipes',
        '/recipes/collection/thai-recipes',
        '/recipes/collection/japanese-recipes',
        '/recipes/collection/french-recipes',
        '/recipes/collection/greek-recipes',
        '/recipes/collection/spanish-recipes',
        '/recipes/collection/middle-eastern-recipes',
        '/recipes/collection/moroccan-recipes',
        '/recipes/collection/turkish-recipes',
        '/recipes/collection/vietnamese-recipes',
        '/recipes/collection/korean-recipes',
        '/recipes/collection/caribbean-recipes',
        '/recipes/collection/british-recipes',
        '/recipes/collection/irish-recipes',
        '/recipes/collection/scottish-recipes',
        '/recipes/collection/mediterranean-recipes',
        
        // Dietary (5)
        '/recipes/collection/vegetarian-recipes',
        '/recipes/collection/vegan-recipes',
        '/recipes/collection/gluten-free-recipes',
        '/recipes/collection/dairy-free-recipes',
        '/recipes/collection/low-calorie-recipes',
        
        // Seasonal (4)
        '/recipes/collection/spring-recipes',
        '/recipes/collection/summer-recipes',
        '/recipes/collection/autumn-recipes',
        '/recipes/collection/winter-recipes',
        
        // Health (8)
        '/recipes/collection/healthy-recipes',
        '/recipes/collection/low-fat-recipes',
        '/recipes/collection/high-protein-recipes',
        '/recipes/collection/low-carb-recipes',
        '/recipes/collection/high-fibre-recipes',
        '/recipes/collection/heart-healthy-recipes',
        '/recipes/collection/diabetic-recipes',
        '/recipes/collection/weight-loss-recipes',
        
        // Ingredients (15)
        '/recipes/collection/chicken-recipes',
        '/recipes/collection/beef-recipes',
        '/recipes/collection/pork-recipes',
        '/recipes/collection/lamb-recipes',
        '/recipes/collection/fish-recipes',
        '/recipes/collection/salmon-recipes',
        '/recipes/collection/prawn-recipes',
        '/recipes/collection/pasta-recipes',
        '/recipes/collection/rice-recipes',
        '/recipes/collection/potato-recipes',
        '/recipes/collection/curry-recipes',
        '/recipes/collection/salad-recipes',
        '/recipes/collection/soup-recipes',
        '/recipes/collection/cake-recipes',
        '/recipes/collection/bread-recipes',
      ],
      rateLimit: 3000,
      maxRecipes: 3000
    },
    {
      name: 'Bon Appetit',
      baseUrl: 'https://www.bonappetit.com',
      listingUrls: [
        '/recipes',
        '/recipes/quick-recipes',
        '/recipes/chicken',
        '/recipes/pasta',
        '/recipes/vegetarian',
        '/recipes/desserts',
        '/recipes/seafood',
      ],
      rateLimit: 3500,
      maxRecipes: 1500
    },
    {
      name: 'Epicurious',
      baseUrl: 'https://www.epicurious.com',
      listingUrls: [
        '/search?meal=breakfast',
        '/search?meal=lunch',
        '/search?meal=dinner',
        '/search?content=recipe',
        '/search?protein=chicken',
        '/search?protein=beef',
        '/search?protein=seafood',
        '/search?diet=vegetarian',
        '/search?diet=vegan',
      ],
      rateLimit: 4000,
      maxRecipes: 1500
    },
    {
      name: 'Delish',
      baseUrl: 'https://www.delish.com',
      listingUrls: [
        // Main navigation
        '/cooking/recipe-ideas/',
        '/weeknight-dinners/',
        '/healthy-food/',
        
        // Meal types (5)
        '/cooking/g1000/dinners/',
        '/cooking/menus/g1562/breakfast-ideas/',
        '/cooking/g1200/easy-lunch-ideas/',
        '/cooking/menus/g2164/appetizer-ideas/',
        '/cooking/g755/easy-desserts/',
        
        // Holiday/Seasonal (8)
        '/holiday-recipes/',
        '/winter-recipes/',
        '/summer-recipes/',
        '/fall-recipes/',
        '/holiday-recipes/christmas/',
        '/holiday-recipes/thanksgiving/',
        '/holiday-recipes/valentines-day/',
        '/holiday-recipes/easter/',
        
        // Cooking methods (6)
        '/cooking/g877/slow-cooker-recipes/',
        '/cooking/g1066/instant-pot-recipes/',
        '/cooking/g32091263/air-fryer-recipes/',
        '/cooking/g1178/one-pot-dinners/',
        '/cooking/g1253/sheet-pan-dinners/',
        '/cooking/g1428/30-minute-meals/',
        
        // Ingredients (10)
        '/cooking/g750/chicken-dinners/',
        '/cooking/g1075/beef-recipes/',
        '/cooking/g882/pasta-recipes/',
        '/cooking/g2386/fish-recipes/',
        '/cooking/g1172/shrimp-recipes/',
        '/cooking/g1226/pork-recipes/',
        '/cooking/g1302/potato-recipes/',
        '/cooking/g1517/ground-beef-recipes/',
        '/cooking/menus/g1575/rice-recipes/',
        '/cooking/g2089/salmon-recipes/',
        
        // Dietary (3)
        '/cooking/g34299884/vegetarian-recipes/',
        '/cooking/g2079/vegan-recipes/',
        '/cooking/g1227/gluten-free-recipes/',
        
        // Specific topics (8)
        '/cooking/menus/g30008948/potluck-desserts/',
        '/cooking/menus/g69649115/30-minute-winter-dinners/',
        '/cooking/g2142/comfort-food/',
        '/cooking/g2310/mexican-food/',
        '/cooking/g2425/italian-food/',
        '/cooking/g2556/asian-recipes/',
        '/cooking/menus/g1654/casserole-recipes/',
        '/cooking/menus/g1749/soup-recipes/',
      ],
      rateLimit: 3500,
      maxRecipes: 2000
    }
  ],
  outputDb: path.resolve(__dirname, '../data/foodie-scraped.sqlite'),
  attribution: true,
  totalTargetRecipes: 10000 // Target: 10,000 recipes with 100+ AllRecipes URLs
};

// ========== Comprehensive Cuisines List ==========

const COMPREHENSIVE_CUISINES = [
  'Afghan','African','Albanian','American','Argentinian','Armenian','Asian','Australian','Austrian',
  'Bangladeshi','Barbecue','Belgian','Bolivian','Brazilian','British','Bulgarian','Cajun/Creole',
  'Cambodian','Caribbean','Chilean','Chinese','Colombian','Cuban','Czech',
  'Danish','Dominican','Dutch',
  'Ecuadorian','Egyptian','English','Ethiopian','European',
  'Filipino','Finnish','French',
  'Georgian','German','Greek','Guatemalan',
  'Haitian','Hawaiian','Hungarian',
  'Icelandic','Indian','Indonesian','Iranian','Iraqi','Irish','Israeli','Italian',
  'Jamaican','Japanese','Jewish','Jordanian',
  'Korean','Kosher',
  'Latin American','Lebanese',
  'Malaysian','Mediterranean','Mexican','Middle Eastern','Mongolian','Moroccan',
  'Nepalese','New Zealand','Nigerian','Norwegian',
  'Pakistani','Persian','Peruvian','Polish','Portuguese','Puerto Rican',
  'Romanian','Russian',
  'Salvadoran','Scandinavian','Scottish','Seafood','Serbian','Singaporean','Slovak','South African','South American','Spanish','Sri Lankan','Swedish','Swiss',
  'Taiwanese','Thai','Tibetan','Turkish',
  'Ukrainian',
  'Vegan','Vegetarian','Vietnamese',
  'Welsh'
];

// ========== Helper Functions ==========

function parseFraction(str) {
  const s = String(str || '').trim();
  
  // Mixed fraction: "1 1/2"
  const mixedMatch = s.match(/^(\d+)\s+(\d+)\/(\d+)$/);
  if (mixedMatch) {
    const whole = parseFloat(mixedMatch[1]);
    const num = parseFloat(mixedMatch[2]);
    const denom = parseFloat(mixedMatch[3]);
    if (denom !== 0) return whole + (num / denom);
  }
  
  // Simple fraction: "1/2"
  const fracMatch = s.match(/^(\d+)\/(\d+)$/);
  if (fracMatch) {
    const denom = parseFloat(fracMatch[2]);
    if (denom !== 0) return parseFloat(fracMatch[1]) / denom;
  }
  
  // Decimal or whole number
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : null;
}

function canonicalizeUnit(u) {
  const lower = String(u || '').toLowerCase().trim();
  if (!lower) return '';
  
  const map = {
    'teaspoon': 'tsp', 'teaspoons': 'tsp',
    'tablespoon': 'tbsp', 'tablespoons': 'tbsp',
    'cup': 'cup', 'cups': 'cup',
    'ounce': 'oz', 'ounces': 'oz',
    'pound': 'lb', 'pounds': 'lb', 'lbs': 'lb',
    'gram': 'g', 'grams': 'g',
    'kilogram': 'kg', 'kilograms': 'kg',
    'milliliter': 'ml', 'milliliters': 'ml', 'millilitre': 'ml', 'millilitres': 'ml',
    'liter': 'l', 'liters': 'l', 'litre': 'l', 'litres': 'l',
    'pinch': 'pinch', 'dash': 'dash',
    'clove': 'clove', 'cloves': 'clove',
    'can': 'can', 'cans': 'can',
    'jar': 'jar', 'jars': 'jar',
    'package': 'pkg', 'packages': 'pkg', 'pkgs': 'pkg',
    'bunch': 'bunch', 'bunches': 'bunch',
    'slice': 'slice', 'slices': 'slice',
    'piece': 'piece', 'pieces': 'piece',
    'whole': 'whole', 'medium': 'medium', 'large': 'large', 'small': 'small'
  };
  return map[lower] || lower;
}

function parseIngredientLine(line) {
  const original = String(line || '').trim();
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
  
  const qtyPattern = /^(\d+(?:\s+\d+\/\d+|\.\d+)?|\d+\/\d+)(?:\s*(?:to|-)\s*(\d+(?:\s+\d+\/\d+|\.\d+)?|\d+\/\d+))?/;
  const unitPattern = /(teaspoons?|tablespoons?|cups?|ounces?|pounds?|lbs?|grams?|kilograms?|milliliters?|liters?|tsp|tbsp|oz|lb|g|kg|ml|l|pinch|dash|cloves?|cans?|jars?|packages?|pkgs?|bunches?|slices?|pieces?|whole|medium|large|small)\b/i;
  
  let match = text.match(qtyPattern);
  let qtyNum = null;
  let qtyText = '';
  let remainder = text;
  
  if (match) {
    const qty1 = match[1];
    const qty2 = match[2];
    
    qtyNum = parseFraction(qty1);
    
    if (qty2) {
      qtyText = `${qty1} to ${qty2}`;
    } else {
      qtyText = qty1;
    }
    
    remainder = text.substring(match[0].length).trim();
  }
  
  let unit = '';
  const unitMatch = remainder.match(unitPattern);
  if (unitMatch) {
    unit = canonicalizeUnit(unitMatch[1]);
    qtyText = qtyText ? `${qtyText} ${unitMatch[1]}` : unitMatch[1];
    remainder = remainder.substring(unitMatch.index + unitMatch[0].length).trim();
  }
  
  let ingredientName = remainder;
  let notes = '';
  
  const parenMatch = ingredientName.match(/\(([^)]+)\)/);
  if (parenMatch) {
    notes = parenMatch[1].trim();
    ingredientName = ingredientName.replace(parenMatch[0], '').trim();
  }
  
  const commaMatch = ingredientName.match(/,\s*(.+)$/);
  if (commaMatch) {
    const suffix = commaMatch[1].trim();
    if (notes) notes += '; ' + suffix;
    else notes = suffix;
    ingredientName = ingredientName.substring(0, commaMatch.index).trim();
  }
  
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

function detectCuisine(recipeData) {
  if (recipeData.recipeCuisine) {
    const cuisine = Array.isArray(recipeData.recipeCuisine)
      ? recipeData.recipeCuisine[0]
      : String(recipeData.recipeCuisine);
    const cuisineStr = String(cuisine).trim();
    const exactMatch = COMPREHENSIVE_CUISINES.find(c => c.toLowerCase() === cuisineStr.toLowerCase());
    if (exactMatch) return exactMatch;
    
    const partialMatch = COMPREHENSIVE_CUISINES.find(c => 
      cuisineStr.toLowerCase().includes(c.toLowerCase()) || c.toLowerCase().includes(cuisineStr.toLowerCase())
    );
    if (partialMatch) return partialMatch;
  }
  
  const keywords = [
    Array.isArray(recipeData.keywords) ? recipeData.keywords.join(' ') : recipeData.keywords,
    recipeData.name,
    recipeData.description,
    Array.isArray(recipeData.recipeCategory) ? recipeData.recipeCategory.join(' ') : recipeData.recipeCategory
  ].filter(Boolean).join(' ').toLowerCase();
  
  const cuisineKeywords = {
    'Italian': ['italian', 'pasta', 'pizza', 'risotto', 'parmigiana', 'carbonara', 'bolognese', 'tiramisu', 'lasagna', 'ravioli', 'gnocchi'],
    'Mexican': ['mexican', 'taco', 'burrito', 'enchilada', 'salsa', 'guacamole', 'quesadilla', 'fajita', 'tortilla', 'tamale', 'chile'],
    'Chinese': ['chinese', 'stir-fry', 'wok', 'szechuan', 'kung pao', 'chow mein', 'dim sum', 'fried rice', 'lo mein'],
    'Indian': ['indian', 'curry', 'tikka', 'masala', 'tandoori', 'biryani', 'naan', 'samosa', 'dal', 'paneer'],
    'Japanese': ['japanese', 'sushi', 'ramen', 'teriyaki', 'tempura', 'udon', 'miso', 'sake', 'sashimi', 'bento'],
    'Thai': ['thai', 'pad thai', 'tom yum', 'green curry', 'red curry', 'lemongrass', 'galangal', 'coconut milk'],
    'French': ['french', 'croissant', 'baguette', 'ratatouille', 'coq au vin', 'crepe', 'souffle', 'boeuf bourguignon'],
    'Greek': ['greek', 'gyro', 'moussaka', 'tzatziki', 'feta', 'baklava', 'souvlaki', 'spanakopita'],
    'Mediterranean': ['mediterranean', 'hummus', 'falafel', 'tabbouleh', 'olive oil', 'couscous', 'tahini'],
    'American': ['american', 'burger', 'bbq', 'hot dog', 'mac and cheese', 'fried chicken', 'apple pie'],
    'Korean': ['korean', 'kimchi', 'bibimbap', 'bulgogi', 'gochujang', 'banchan'],
    'Vietnamese': ['vietnamese', 'pho', 'banh mi', 'spring roll', 'fish sauce', 'bun']
  };
  
  for (const [cuisine, keywords_list] of Object.entries(cuisineKeywords)) {
    for (const kw of keywords_list) {
      if (keywords.includes(kw)) return cuisine;
    }
  }
  
  const ingredients = (recipeData.recipeIngredient || []).join(' ').toLowerCase();
  const ingredientClues = {
    'Italian': ['parmesan', 'mozzarella', 'basil', 'oregano', 'marinara', 'pecorino', 'prosciutto'],
    'Mexican': ['cilantro', 'jalapeño', 'jalapeno', 'cumin', 'lime', 'tortilla', 'chipotle', 'cotija'],
    'Asian': ['soy sauce', 'sesame oil', 'ginger', 'rice vinegar', 'fish sauce'],
    'Indian': ['garam masala', 'turmeric', 'cardamom', 'coriander', 'ghee', 'curry powder'],
    'Thai': ['lemongrass', 'galangal', 'thai basil', 'fish sauce', 'coconut milk'],
    'Chinese': ['soy sauce', 'sesame oil', 'oyster sauce', 'hoisin', 'shaoxing'],
    'Japanese': ['miso', 'dashi', 'mirin', 'sake', 'nori', 'wasabi'],
    'Mediterranean': ['olive oil', 'lemon', 'garlic', 'chickpea', 'tahini', 'za\'atar']
  };
  
  for (const [cuisine, clues] of Object.entries(ingredientClues)) {
    const matches = clues.filter(clue => ingredients.includes(clue)).length;
    if (matches >= 2) return cuisine;
  }
  
  return '';
}

function detectMealType(recipeData) {
  const name = (recipeData.name || '').toLowerCase();
  const description = (recipeData.description || '').toLowerCase();
  const keywords = Array.isArray(recipeData.keywords) 
    ? recipeData.keywords.join(' ').toLowerCase() 
    : (recipeData.keywords || '').toLowerCase();
  const category = Array.isArray(recipeData.recipeCategory)
    ? recipeData.recipeCategory.join(' ').toLowerCase()
    : (recipeData.recipeCategory || '').toLowerCase();
  const text = [name, description, keywords, category].join(' ');
  
  // Priority order: Most specific first
  const patterns = {
    'Dessert': ['dessert', 'cake', 'cookie', 'brownie', 'pie', 'tart', 'pudding', 'ice cream', 'candy', 'sweet', 'chocolate chip', 'cupcake', 'mousse', 'cheesecake', 'fudge'],
    'Appetizer': ['appetizer', 'starter', 'hors d\'oeuvre', 'canape', 'finger food', 'dip'],
    'Snack': ['snack', 'nibbles', 'munchies', 'trail mix', 'energy bar'],
    'Brunch': ['brunch'],
    'Breakfast': ['breakfast', 'pancake', 'waffle', 'omelet', 'omelette', 'cereal', 'oatmeal', 'french toast', 'scrambled', 'eggs benedict', 'frittata', 'bagel', 'croissant'],
    'Lunch': ['lunch', 'sandwich', 'wrap', 'salad bowl', 'panini', 'club sandwich'],
    'Dinner': ['dinner', 'entree', 'entrée', 'main dish', 'main course', 'roast', 'steak', 'casserole'],
    'Side Dish': ['side dish', 'side', 'accompaniment', 'coleslaw', 'mashed potatoes', 'roasted vegetables', 'garlic bread', 'rice pilaf'],
    'Beverage': ['beverage', 'drink', 'cocktail', 'smoothie', 'juice', 'lemonade', 'tea', 'coffee']
  };
  
  for (const [mealType, keywords_list] of Object.entries(patterns)) {
    for (const kw of keywords_list) {
      if (text.includes(kw)) return mealType;
    }
  }
  
  return 'Any';
}

// ========== RecipeScraper Class ==========

class RecipeScraper {
  constructor(config) {
    this.config = config;
    this.db = new Database(config.outputDb);
    this.initDb();
    this.stats = { total: 0, success: 0, failed: 0, skipped: 0 };
  }
  
  initDb() {
    console.log(`[DB] Initializing database: ${this.config.outputDb}`);
    
    // Create tables matching foodie schema with IngredientName column
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
        UpdatedAt TEXT,
        default_servings INTEGER DEFAULT 4,
        is_favorite INTEGER DEFAULT 0
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
      CREATE INDEX IF NOT EXISTS idx_recipes_titlelower ON recipes(TitleLower);
    `);
  }
  
  async scrapeWebsite(siteConfig) {
    console.log(`\n========== [${siteConfig.name}] Starting scrape ==========`);
    
    let siteSuccessCount = 0;
    
    for (const listingUrl of siteConfig.listingUrls) {
      // Check if we've reached the target
      if (this.config.totalTargetRecipes && this.stats.success >= this.config.totalTargetRecipes) {
        console.log(`\n[TARGET REACHED] Scraped ${this.stats.success} recipes (target: ${this.config.totalTargetRecipes})`);
        break;
      }
      
      const fullUrl = siteConfig.baseUrl + listingUrl;
      console.log(`\n[LISTING] Fetching: ${fullUrl}`);
      
      try {
        const recipeUrls = await this.extractRecipeUrls(fullUrl, siteConfig);
        console.log(`[LISTING] Found ${recipeUrls.length} recipe URLs`);
        
        const remainingForSite = siteConfig.maxRecipes - siteSuccessCount;
        const limit = Math.min(recipeUrls.length, remainingForSite);
        
        for (let i = 0; i < limit; i++) {
          // Check target again
          if (this.config.totalTargetRecipes && this.stats.success >= this.config.totalTargetRecipes) {
            break;
          }
          
          const prevSuccess = this.stats.success;
          await this.scrapeRecipe(recipeUrls[i], siteConfig);
          
          // Track site-specific success
          if (this.stats.success > prevSuccess) {
            siteSuccessCount++;
          }
          
          // Progress update every 10 recipes
          if (this.stats.success % 10 === 0 && this.stats.success > 0) {
            const totalCount = this.db.prepare('SELECT COUNT(*) as count FROM recipes').get();
            console.log(`    📊 Progress: ${this.stats.success} new recipes scraped | Total in DB: ${totalCount.count}`);
          }
          
          await this.sleep(siteConfig.rateLimit);
        }
      } catch (e) {
        console.error(`[LISTING] Error fetching ${fullUrl}: ${e.message}`);
      }
    }
    
    console.log(`\n[${siteConfig.name}] Complete: ${siteSuccessCount} recipes scraped`);
  }
  
  async extractRecipeUrls(listingUrl, siteConfig) {
    const html = await this.fetchHtml(listingUrl);
    const urls = [];
    
    // Site-specific patterns for recipe detail pages
    const patterns = {
      'AllRecipes': /-recipe-\d+/,
      'Serious Eats': /-\d{8}$/,
      'BBC Good Food': /\/recipes\/[a-z0-9-]+$/,
      'Bon Appetit': /\/recipe\//,
      'Epicurious': /\/recipes\/food\/views\//,
      'Delish': /\/cooking\/[^/]+\/a\d+\//
    };
    
    const recipePattern = patterns[siteConfig.name] || /-recipe-|\/recipe\//i;
    
    // Extract all links
    const linkPattern = /<a[^>]+href=["']([^"']+)["']/gi;
    let match;
    while ((match = linkPattern.exec(html)) !== null) {
      let url = match[1];
      
      // Skip anchors, javascript, external links
      if (url.startsWith('#') || url.startsWith('javascript:') || url.includes('mailto:')) {
        continue;
      }
      
      // Make absolute URL
      if (url.startsWith('/')) {
        url = siteConfig.baseUrl + url;
      } else if (!url.startsWith('http')) {
        continue;
      }
      
      // Only include URLs from the same site that match recipe pattern
      if (url.startsWith(siteConfig.baseUrl) && recipePattern.test(url)) {
        // Exclude category/collection pages
        if (url.includes('/collection/') || url.includes('/recipes/78/') || 
            url.includes('/recipes/79/') || url.includes('/recipes/80/') ||
            url.includes('/recipes/76/') || url.includes('/recipes/77/') ||
            url.match(/\/recipes\/\d+\/[^/]+\/$/) ||
            url.includes('authentication')) {
          continue;
        }
        
        if (!urls.includes(url)) {
          urls.push(url);
        }
      }
    }
    
    return urls;
  }
  
  async scrapeRecipe(url, siteConfig) {
    try {
      // Check if already scraped
      const existing = this.db.prepare('SELECT RecipeId FROM recipes WHERE URL = ?').get(url);
      if (existing) {
        console.log(`    ⏭️  Skipping (already exists): ${url}`);
        this.stats.skipped++;
        return;
      }
      
      console.log(`    🔍 Scraping: ${url}`);
      const html = await this.fetchHtml(url);
      
      // Extract JSON-LD data
      const jsonLdMatch = html.match(/<script[^>]*type=["']application\/ld\+json["'][^>]*>(.*?)<\/script>/is);
      if (!jsonLdMatch) {
        console.log(`    ❌ No JSON-LD found`);
        this.stats.failed++;
        return;
      }
      
      const jsonData = JSON.parse(jsonLdMatch[1]);
      const recipes = Array.isArray(jsonData) ? jsonData : (jsonData['@graph'] ? jsonData['@graph'] : [jsonData]);
      const recipeData = recipes.find(item => 
        item['@type'] === 'Recipe' || (Array.isArray(item['@type']) && item['@type'].includes('Recipe'))
      );
      
      if (!recipeData) {
        console.log(`    ❌ No recipe data found in JSON-LD`);
        this.stats.failed++;
        return;
      }
      
      // Parse recipe
      const recipe = this.parseRecipe(recipeData, url, siteConfig);
      
      // Save to database
      this.saveRecipe(recipe);
      
      console.log(`    ✅ ${recipe.Title} [${recipe.Cuisine}] [${recipe.MealType}]`);
      this.stats.success++;
      this.stats.total++;
      
    } catch (e) {
      console.log(`    ❌ Error: ${e.message}`);
      this.stats.failed++;
    }
  }
  
  parseRecipe(data, url, siteConfig) {
    const recipeId = `rec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const title = String(data.name || 'Untitled').trim();
    
    // Extract instructions
    let instructions = '';
    if (Array.isArray(data.recipeInstructions)) {
      instructions = data.recipeInstructions.map((step, i) => {
        const text = typeof step === 'string' ? step : (step.text || '');
        return `${i + 1}. ${text}`;
      }).join('\n\n');
    } else {
      instructions = String(data.recipeInstructions || '');
    }
    
    // Parse ingredients
    const ingredientLines = Array.isArray(data.recipeIngredient) ? data.recipeIngredient : [];
    const ingredients = ingredientLines.map((line, idx) => {
      const parsed = parseIngredientLine(line);
      return parsed ? { ...parsed, idx } : {
        idx,
        IngredientRaw: line,
        IngredientName: line,
        IngredientNorm: line.toLowerCase(),
        QtyNum: null,
        QtyText: '',
        Unit: '',
        Notes: '',
        StoreId: '',
        Category: ''
      };
    });
    
    // Detect cuisine and meal type
    const cuisine = detectCuisine(data);
    const mealType = detectMealType(data);
    
    // Extract servings
    const servings = data.recipeYield 
      ? (typeof data.recipeYield === 'number' ? data.recipeYield : parseInt(String(data.recipeYield).replace(/\D/g, '')) || 4)
      : 4;
    
    // Attribution
    const author = data.author 
      ? (typeof data.author === 'object' ? data.author.name : data.author)
      : siteConfig.name;
    
    const notes = this.config.attribution 
      ? `Source: ${siteConfig.name}\nAuthor: ${author}\nOriginal URL: ${url}`
      : '';
    
    return {
      RecipeId: recipeId,
      Title: title,
      TitleLower: title.toLowerCase(),
      URL: url,
      Cuisine: cuisine,
      MealType: mealType,
      Notes: notes,
      Instructions: instructions,
      Image_Name: '',
      Source: siteConfig.name,
      Author: author,
      default_servings: servings,
      ingredients
    };
  }
  
  saveRecipe(recipe) {
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
      const fetchWithRedirect = (targetUrl, redirectCount = 0) => {
        if (redirectCount > 5) {
          reject(new Error('Too many redirects'));
          return;
        }
        
        https.get(targetUrl, { 
          headers: { 
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.5'
          } 
        }, (res) => {
          // Handle redirects
          if (res.statusCode === 301 || res.statusCode === 302 || res.statusCode === 307 || res.statusCode === 308) {
            const redirectUrl = res.headers.location;
            if (!redirectUrl) {
              reject(new Error(`Redirect without location header: ${res.statusCode}`));
              return;
            }
            // Make absolute URL if relative
            const newUrl = redirectUrl.startsWith('http') ? redirectUrl : new URL(redirectUrl, targetUrl).href;
            console.log(`    Following redirect: ${targetUrl} -> ${newUrl}`);
            fetchWithRedirect(newUrl, redirectCount + 1);
            return;
          }
          
          if (res.statusCode !== 200) {
            reject(new Error(`HTTP ${res.statusCode}`));
            return;
          }
          
          let data = '';
          res.on('data', chunk => data += chunk);
          res.on('end', () => resolve(data));
        }).on('error', reject).setTimeout(15000, function() {
          this.destroy();
          reject(new Error('Timeout'));
        });
      };
      
      fetchWithRedirect(url);
    });
  }
  
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
  
  async run() {
    console.log('========================================');
    console.log('🍳 BULK RECIPE SCRAPER');
    console.log('========================================');
    console.log(`Output: ${this.config.outputDb}`);
    console.log(`Target: ${this.config.totalTargetRecipes || 'No limit'} recipes`);
    console.log(`Websites: ${this.config.websites.length} sites`);
    this.config.websites.forEach(site => {
      console.log(`  • ${site.name} (${site.listingUrls.length} URLs, max ${site.maxRecipes})`);
    });
    console.log('========================================\n');
    
    const startTime = Date.now();
    
    for (const site of this.config.websites) {
      // Check if target reached
      if (this.config.totalTargetRecipes && this.stats.success >= this.config.totalTargetRecipes) {
        console.log(`\n✅ Target of ${this.config.totalTargetRecipes} recipes reached! Stopping early.`);
        break;
      }
      
      await this.scrapeWebsite(site);
    }
    
    const endTime = Date.now();
    const durationMinutes = Math.round((endTime - startTime) / 1000 / 60);
    
    console.log('\n========================================');
    console.log('📊 SCRAPING COMPLETE');
    console.log('========================================');
    console.log(`⏱️  Duration: ${durationMinutes} minutes`);
    console.log(`✅ Success: ${this.stats.success}`);
    console.log(`❌ Failed: ${this.stats.failed}`);
    console.log(`⏭️  Skipped (duplicates): ${this.stats.skipped}`);
    console.log(`📝 Total new recipes: ${this.stats.success}`);
    
    // Get total recipe count in database
    const totalCount = this.db.prepare('SELECT COUNT(*) as count FROM recipes').get();
    console.log(`💾 Total in database: ${totalCount.count}`);
    console.log(`💾 Database: ${this.config.outputDb}`);
    
    // Show statistics by source
    const sourceStats = this.db.prepare('SELECT Source, COUNT(*) as count FROM recipes GROUP BY Source ORDER BY count DESC').all();
    console.log('\n📚 Recipes by Source:');
    sourceStats.forEach(stat => {
      console.log(`   ${stat.Source}: ${stat.count}`);
    });
    
    // Show statistics by cuisine
    const cuisineStats = this.db.prepare("SELECT Cuisine, COUNT(*) as count FROM recipes WHERE Cuisine != '' GROUP BY Cuisine ORDER BY count DESC LIMIT 15").all();
    console.log('\n🌍 Top 15 Cuisines:');
    cuisineStats.forEach(stat => {
      console.log(`   ${stat.Cuisine}: ${stat.count}`);
    });
    
    // Show statistics by meal type
    const mealTypeStats = this.db.prepare('SELECT MealType, COUNT(*) as count FROM recipes GROUP BY MealType ORDER BY count DESC').all();
    console.log('\n🍽️  Recipes by Meal Type:');
    mealTypeStats.forEach(stat => {
      console.log(`   ${stat.MealType}: ${stat.count}`);
    });
    
    // Success rate
    const totalAttempts = this.stats.success + this.stats.failed;
    const successRate = totalAttempts > 0 ? Math.round((this.stats.success / totalAttempts) * 100) : 0;
    console.log(`\n📈 Success Rate: ${successRate}%`);
    
    console.log('========================================\n');
    
    this.db.close();
  }
}

// ========== Main Execution ==========

if (require.main === module) {
  const scraper = new RecipeScraper(SCRAPE_CONFIG);
  scraper.run().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
  });
}

module.exports = { RecipeScraper, parseIngredientLine, detectCuisine, detectMealType };
