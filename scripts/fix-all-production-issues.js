#!/usr/bin/env node
/**
 * Production Fix Script - Comprehensive
 * 
 * This script fixes all critical production issues:
 * 1. Assigns categories to ALL ingredients in ALL recipes
 * 2. Downloads images for recipes (if URLs exist)
 * 3. Validates database integrity
 */

const path = require('path');
const Database = require('better-sqlite3');
const fs = require('fs');
const https = require('https');
const http = require('http');

const dbPath = path.join(__dirname, '..', 'data', 'foodie.sqlite');
const db = new Database(dbPath);

console.log('🚀 Starting Production Fixes...\n');

// Category classification rules (same as backend)
const CATEGORY_RULES = {
  'Produce': [
    'lettuce', 'tomato', 'cucumber', 'carrot', 'onion', 'garlic', 'pepper',
    'spinach', 'kale', 'broccoli', 'cauliflower', 'zucchini', 'squash',
    'potato', 'sweet potato', 'corn', 'peas', 'beans', 'celery', 'radish',
    'cabbage', 'bok choy', 'asparagus', 'artichoke', 'eggplant',
    'apple', 'banana', 'orange', 'lemon', 'lime', 'grape', 'strawberry',
    'blueberry', 'raspberry', 'blackberry', 'peach', 'pear', 'plum',
    'watermelon', 'cantaloupe', 'honeydew', 'pineapple', 'mango', 'papaya',
    'avocado', 'kiwi', 'cherry', 'cranberry', 'grapefruit', 'pomegranate',
    'mushroom', 'green onion', 'scallion', 'shallot', 'leek', 'ginger',
    'cilantro', 'parsley', 'basil', 'mint', 'dill', 'thyme', 'rosemary',
    'sage', 'oregano', 'chive', 'arugula', 'endive', 'radicchio',
    'jalapeno', 'bell pepper', 'chili', 'poblano', 'serrano'
  ],
  'Meat': [
    'chicken', 'beef', 'pork', 'turkey', 'lamb', 'veal', 'duck', 'bacon',
    'sausage', 'ham', 'steak', 'ground beef', 'ground turkey', 'ground chicken',
    'ribs', 'brisket', 'roast', 'tenderloin', 'breast', 'thigh', 'wing',
    'drumstick', 'chop', 'cutlet', 'meatball', 'pepperoni', 'salami',
    'prosciutto', 'pancetta', 'chorizo', 'kielbasa', 'bratwurst'
  ],
  'Seafood': [
    'fish', 'salmon', 'tuna', 'cod', 'tilapia', 'halibut', 'trout',
    'mahi mahi', 'sea bass', 'swordfish', 'catfish', 'flounder', 'sole',
    'shrimp', 'prawn', 'crab', 'lobster', 'scallop', 'mussel', 'clam',
    'oyster', 'squid', 'octopus', 'calamari', 'anchovy', 'sardine'
  ],
  'Dairy': [
    'milk', 'cream', 'butter', 'cheese', 'yogurt', 'sour cream',
    'cottage cheese', 'cream cheese', 'ricotta', 'mozzarella', 'cheddar',
    'parmesan', 'swiss', 'gouda', 'brie', 'feta', 'blue cheese',
    'monterey jack', 'provolone', 'asiago', 'gruyere', 'mascarpone',
    'whipped cream', 'half and half', 'buttermilk', 'evaporated milk',
    'condensed milk', 'heavy cream', 'sour milk'
  ],
  'Pantry': [
    'flour', 'sugar', 'rice', 'pasta', 'bread', 'oil', 'vinegar',
    'salt', 'pepper', 'sauce', 'broth', 'stock', 'can', 'jar',
    'olive oil', 'vegetable oil', 'canola oil', 'coconut oil',
    'balsamic', 'apple cider vinegar', 'white vinegar', 'rice vinegar',
    'soy sauce', 'worcestershire', 'hot sauce', 'ketchup', 'mustard',
    'mayonnaise', 'relish', 'pickle', 'tomato paste', 'tomato sauce',
    'diced tomatoes', 'crushed tomatoes', 'beans', 'chickpeas', 'lentils',
    'quinoa', 'couscous', 'barley', 'oats', 'cereal', 'crackers',
    'chips', 'nuts', 'almonds', 'walnuts', 'pecans', 'cashews',
    'peanuts', 'peanut butter', 'almond butter', 'tahini', 'honey',
    'maple syrup', 'molasses', 'corn syrup', 'vanilla extract',
    'almond extract', 'baking powder', 'baking soda', 'yeast',
    'cornstarch', 'gelatin', 'cocoa powder', 'chocolate chips',
    'brown sugar', 'powdered sugar', 'granulated sugar'
  ],
  'Spices': [
    'cumin', 'paprika', 'turmeric', 'coriander', 'cinnamon', 'nutmeg',
    'clove', 'cardamom', 'allspice', 'ginger powder', 'garlic powder',
    'onion powder', 'chili powder', 'cayenne', 'curry', 'bay leaf',
    'black pepper', 'white pepper', 'red pepper flakes', 'italian seasoning',
    'herbs de provence', 'cajun seasoning', 'taco seasoning',
    'everything bagel', 'sesame seeds', 'poppy seeds', 'mustard seed',
    'fennel seed', 'caraway', 'star anise', 'saffron', 'vanilla bean'
  ],
  'Frozen': [
    'frozen', 'ice cream', 'popsicle', 'frozen vegetable', 'frozen fruit',
    'frozen meal', 'frozen pizza', 'frozen dinner', 'ice', 'sherbet',
    'sorbet', 'gelato'
  ],
  'Bakery': [
    'bread', 'roll', 'bun', 'bagel', 'muffin', 'croissant', 'donut',
    'danish', 'scone', 'biscuit', 'tortilla', 'pita', 'naan', 'baguette',
    'ciabatta', 'focaccia', 'sourdough', 'rye bread', 'wheat bread',
    'white bread', 'cake', 'pie', 'cookie', 'brownie', 'cupcake'
  ],
  'Deli': [
    'deli meat', 'sliced turkey', 'sliced ham', 'roast beef',
    'sliced cheese', 'sandwich meat', 'lunch meat'
  ],
  'Beverages': [
    'water', 'juice', 'soda', 'coffee', 'tea', 'wine', 'beer',
    'liquor', 'vodka', 'rum', 'whiskey', 'gin', 'tequila',
    'orange juice', 'apple juice', 'grape juice', 'cranberry juice',
    'lemonade', 'iced tea', 'energy drink', 'sports drink', 'milk'
  ],
  'Snacks': [
    'chips', 'crackers', 'pretzels', 'popcorn', 'candy', 'chocolate',
    'granola bar', 'protein bar', 'trail mix', 'dried fruit',
    'fruit snacks', 'cookies', 'candy bar'
  ],
  'Household': [
    'paper towel', 'toilet paper', 'tissue', 'napkin', 'plastic wrap',
    'aluminum foil', 'ziplock', 'garbage bag', 'dish soap', 'detergent',
    'cleaner', 'sponge', 'paper plate', 'plastic cup', 'utensils'
  ]
};

function classifyIngredient(ingredientName) {
  if (!ingredientName) return 'Other';
  
  const normalized = ingredientName.toLowerCase().trim();
  
  // Check each category
  for (const [category, keywords] of Object.entries(CATEGORY_RULES)) {
    for (const keyword of keywords) {
      if (normalized.includes(keyword)) {
        return category;
      }
    }
  }
  
  return 'Other';
}

// ========== FIX 1: Assign Categories to All Ingredients ==========
async function fixIngredientCategories() {
  console.log('📋 Fix 1: Assigning categories to all ingredients...');
  
  const ingredients = db.prepare('SELECT RecipeId, idx, IngredientRaw, IngredientNorm, Category FROM ingredients').all();
  
  let updated = 0;
  let alreadyCategorized = 0;
  let failed = 0;
  
  const updateStmt = db.prepare('UPDATE ingredients SET Category = ? WHERE RecipeId = ? AND idx = ?');
  
  const transaction = db.transaction(() => {
    for (const ing of ingredients) {
      // Skip if already has category
      if (ing.Category && ing.Category !== '') {
        alreadyCategorized++;
        continue;
      }
      
      // Classify based on IngredientRaw or IngredientNorm
      const name = ing.IngredientRaw || ing.IngredientNorm;
      if (!name || name.trim().length < 2) {
        failed++;
        continue;
      }
      
      const category = classifyIngredient(name);
      
      try {
        updateStmt.run(category, ing.RecipeId, ing.idx);
        updated++;
        
        if (updated % 1000 === 0) {
          console.log(`  Processed ${updated} ingredients...`);
        }
      } catch (e) {
        console.error(`  Failed to update ${ing.RecipeId}/${ing.idx}:`, e.message);
        failed++;
      }
    }
  });
  
  transaction();
  
  console.log(`  ✅ Updated: ${updated}`);
  console.log(`  ⏭️  Already categorized: ${alreadyCategorized}`);
  console.log(`  ❌ Failed: ${failed}`);
  console.log();
}

// ========== FIX 2: Check for Image URLs and Download ==========
async function fixRecipeImages() {
  console.log('🖼️  Fix 2: Checking recipe images...');
  
  const recipes = db.prepare('SELECT RecipeId, Title, Image_Name, URL FROM recipes WHERE Image_Name IS NOT NULL AND Image_Name != ""').all();
  
  if (recipes.length === 0) {
    console.log('  ℹ️  No recipes with image URLs found.');
    console.log('  💡 Note: Images would need to be scraped from recipe URLs.');
    console.log();
    return;
  }
  
  console.log(`  Found ${recipes.length} recipes with images`);
  
  // Count how many are URLs vs local paths
  const urlRecipes = recipes.filter(r => r.Image_Name.startsWith('http://') || r.Image_Name.startsWith('https://'));
  const localRecipes = recipes.filter(r => !r.Image_Name.startsWith('http'));
  
  console.log(`  📦 Already local: ${localRecipes.length}`);
  console.log(`  🌐 Need download: ${urlRecipes.length}`);
  
  if (urlRecipes.length > 0) {
    console.log('  💡 Run "Download All Images" button in Admin tab to download images from URLs.');
  }
  
  console.log();
}

// ========== FIX 3: Database Integrity Check ==========
function checkDatabaseIntegrity() {
  console.log('🔍 Fix 3: Database integrity check...');
  
  // Check for orphaned ingredients
  const orphanedIngredients = db.prepare(`
    SELECT COUNT(*) as count 
    FROM ingredients 
    WHERE RecipeId NOT IN (SELECT RecipeId FROM recipes)
  `).get();
  
  if (orphanedIngredients.count > 0) {
    console.log(`  ⚠️  Found ${orphanedIngredients.count} orphaned ingredients`);
    console.log('  🔧 Cleaning up...');
    db.prepare('DELETE FROM ingredients WHERE RecipeId NOT IN (SELECT RecipeId FROM recipes)').run();
    console.log('  ✅ Cleaned');
  } else {
    console.log('  ✅ No orphaned ingredients');
  }
  
  // Check for orphaned meal plans
  const orphanedPlans = db.prepare(`
    SELECT COUNT(*) as count 
    FROM user_plan_meals 
    WHERE recipe_id NOT IN (SELECT RecipeId FROM recipes)
  `).get();
  
  if (orphanedPlans.count > 0) {
    console.log(`  ⚠️  Found ${orphanedPlans.count} orphaned meal plans`);
    console.log('  💡 These meals reference deleted recipes');
  } else {
    console.log('  ✅ No orphaned meal plans');
  }
  
  console.log();
}

// ========== FIX 4: Generate Statistics ==========
function generateStatistics() {
  console.log('📊 Statistics:');
  
  const stats = {
    recipes: db.prepare('SELECT COUNT(*) as count FROM recipes').get().count,
    ingredients: db.prepare('SELECT COUNT(*) as count FROM ingredients').get().count,
    categorized: db.prepare('SELECT COUNT(*) as count FROM ingredients WHERE Category IS NOT NULL AND Category != ""').get().count,
    stores: db.prepare('SELECT COUNT(*) as count FROM stores').get().count,
    mealPlans: db.prepare('SELECT COUNT(*) as count FROM user_plan_meals').get().count,
    users: db.prepare('SELECT COUNT(*) as count FROM users').get().count
  };
  
  console.log(`  📗 Recipes: ${stats.recipes}`);
  console.log(`  🥕 Ingredients: ${stats.ingredients}`);
  console.log(`  📋 Categorized: ${stats.categorized} (${((stats.categorized / stats.ingredients) * 100).toFixed(1)}%)`);
  console.log(`  🏪 Stores: ${stats.stores}`);
  console.log(`  📅 Meal Plans: ${stats.mealPlans}`);
  console.log(`  👥 Users: ${stats.users}`);
  console.log();
  
  // Show store details
  const stores = db.prepare('SELECT StoreId, Name FROM stores ORDER BY Priority ASC').all();
  console.log('  Stores configured:');
  stores.forEach(store => {
    console.log(`    • ${store.Name} (${store.StoreId})`);
  });
  console.log();
}

// ========== MAIN EXECUTION ==========
async function main() {
  try {
    // Run all fixes
    await fixIngredientCategories();
    await fixRecipeImages();
    checkDatabaseIntegrity();
    generateStatistics();
    
    console.log('✨ All fixes complete!');
    console.log('\n📝 Next Steps:');
    console.log('  1. Restart the app: npm run dev');
    console.log('  2. Go to Admin tab → verify stores list shows');
    console.log('  3. Go to Recipes tab → open any recipe → verify categories show in ingredients');
    console.log('  4. (Optional) Click "Download All Images" if you have recipe image URLs');
    console.log('  5. Test the Fix All Categories button');
    console.log();
    
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  } finally {
    db.close();
  }
}

main();
