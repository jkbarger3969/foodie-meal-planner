#!/usr/bin/env node
const path = require('path');
const Database = require('better-sqlite3');
const os = require('os');

const dbPath = path.join(os.homedir(), 'Library/Application Support/Foodie Meal Planner/foodie.sqlite');
console.log('Using database:', dbPath);

const db = new Database(dbPath);

const CATEGORY_KEYWORDS = {
  'Produce': ['apple', 'banana', 'orange', 'lemon', 'lime', 'tomato', 'potato', 'onion', 'garlic', 'carrot', 'celery', 'lettuce', 'spinach', 'kale', 'broccoli', 'cauliflower', 'pepper', 'cucumber', 'zucchini', 'squash', 'mushroom', 'avocado', 'berry', 'grape', 'melon', 'peach', 'pear', 'plum', 'mango', 'pineapple', 'coconut', 'ginger', 'herb', 'basil', 'cilantro', 'parsley', 'mint', 'rosemary', 'thyme', 'oregano', 'dill', 'chive', 'scallion', 'shallot', 'leek', 'cabbage', 'corn', 'pea', 'bean', 'asparagus', 'artichoke', 'beet', 'radish', 'turnip', 'eggplant', 'okra', 'jalapeño', 'serrano', 'habanero', 'chile', 'chili'],
  'Dairy': ['milk', 'cream', 'butter', 'cheese', 'yogurt', 'sour cream', 'cottage cheese', 'ricotta', 'mozzarella', 'parmesan', 'cheddar', 'feta', 'goat cheese', 'brie', 'cream cheese', 'half and half', 'whipping cream', 'heavy cream', 'buttermilk', 'egg', 'eggs'],
  'Meat': ['beef', 'steak', 'ground beef', 'pork', 'bacon', 'ham', 'sausage', 'chicken', 'turkey', 'lamb', 'veal', 'duck', 'goose', 'brisket', 'ribs', 'roast', 'chop', 'loin', 'tenderloin', 'drumstick', 'thigh', 'wing', 'breast', 'ground turkey', 'ground pork', 'prosciutto', 'pancetta', 'pepperoni', 'salami', 'hot dog', 'meatball'],
  'Seafood': ['fish', 'salmon', 'tuna', 'cod', 'tilapia', 'halibut', 'trout', 'bass', 'shrimp', 'prawn', 'crab', 'lobster', 'scallop', 'clam', 'mussel', 'oyster', 'squid', 'calamari', 'octopus', 'anchovy', 'sardine', 'mackerel', 'swordfish', 'mahi', 'snapper', 'grouper', 'catfish'],
  'Bakery': ['bread', 'roll', 'bun', 'bagel', 'croissant', 'muffin', 'biscuit', 'tortilla', 'pita', 'naan', 'flatbread', 'ciabatta', 'sourdough', 'baguette', 'brioche', 'english muffin', 'hamburger bun', 'hot dog bun', 'dinner roll', 'crouton'],
  'Pantry': ['flour', 'sugar', 'salt', 'oil', 'vinegar', 'rice', 'pasta', 'noodle', 'oat', 'cereal', 'can', 'canned', 'tomato sauce', 'tomato paste', 'broth', 'stock', 'soup', 'bean', 'lentil', 'chickpea', 'nut', 'almond', 'walnut', 'pecan', 'cashew', 'peanut', 'seed', 'honey', 'syrup', 'molasses', 'jam', 'jelly', 'peanut butter', 'chocolate', 'cocoa', 'vanilla', 'baking powder', 'baking soda', 'yeast', 'cornstarch', 'breadcrumb', 'cracker', 'chip', 'pretzel', 'popcorn', 'dried', 'raisin', 'cranberry', 'date', 'fig', 'apricot', 'coconut milk', 'soy sauce', 'worcestershire', 'hot sauce', 'mustard', 'ketchup', 'mayonnaise', 'relish', 'pickle', 'olive', 'caper', 'anchovy paste', 'tahini', 'hummus', 'salsa', 'marinara', 'alfredo', 'pesto'],
  'Spice': ['spice', 'seasoning', 'pepper', 'paprika', 'cumin', 'coriander', 'turmeric', 'cinnamon', 'nutmeg', 'clove', 'allspice', 'cardamom', 'ginger powder', 'garlic powder', 'onion powder', 'chili powder', 'cayenne', 'red pepper flake', 'black pepper', 'white pepper', 'salt', 'kosher salt', 'sea salt', 'bay leaf', 'oregano', 'basil', 'thyme', 'rosemary', 'sage', 'marjoram', 'tarragon', 'dill', 'fennel seed', 'mustard seed', 'celery seed', 'sesame seed', 'poppy seed', 'caraway', 'anise', 'star anise', 'saffron', 'curry', 'garam masala', 'five spice', 'italian seasoning', 'herbs de provence', 'old bay', 'cajun', 'creole', 'taco seasoning', 'ranch seasoning', 'everything bagel'],
  'Beverage': ['water', 'juice', 'soda', 'cola', 'sprite', 'beer', 'wine', 'vodka', 'rum', 'whiskey', 'bourbon', 'gin', 'tequila', 'brandy', 'cognac', 'liqueur', 'vermouth', 'champagne', 'prosecco', 'coffee', 'tea', 'espresso', 'latte', 'cappuccino', 'mocha', 'hot chocolate', 'smoothie', 'milkshake', 'lemonade', 'iced tea', 'sparkling water', 'tonic', 'club soda', 'ginger ale', 'energy drink', 'sports drink']
};

function categorizeIngredient(ingredientRaw, ingredientNorm) {
  const text = (ingredientNorm || ingredientRaw || '').toLowerCase();
  
  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    for (const keyword of keywords) {
      if (text.includes(keyword)) {
        return category;
      }
    }
  }
  
  return 'Other';
}

console.log('\n=== Checking current state ===');
const stats = db.prepare(`
  SELECT 
    COUNT(*) as total,
    COUNT(CASE WHEN Category IS NOT NULL AND Category != '' THEN 1 END) as with_category
  FROM ingredients
`).get();
console.log(`Total ingredients: ${stats.total}`);
console.log(`With category: ${stats.with_category} (${(stats.with_category / stats.total * 100).toFixed(1)}%)`);
console.log(`Without category: ${stats.total - stats.with_category}`);

console.log('\n=== Categorizing ingredients ===');

const uncategorized = db.prepare(`
  SELECT rowid, IngredientRaw, IngredientNorm, Category
  FROM ingredients 
  WHERE Category IS NULL OR Category = ''
`).all();

console.log(`Found ${uncategorized.length} ingredients to categorize`);

const updateStmt = db.prepare('UPDATE ingredients SET Category = ? WHERE rowid = ?');
const categoryCount = {};

const tx = db.transaction(() => {
  for (const row of uncategorized) {
    const category = categorizeIngredient(row.IngredientRaw, row.IngredientNorm);
    updateStmt.run(category, row.rowid);
    categoryCount[category] = (categoryCount[category] || 0) + 1;
  }
});

tx();

console.log('\n=== Categories assigned ===');
for (const [cat, count] of Object.entries(categoryCount).sort((a, b) => b[1] - a[1])) {
  console.log(`  ${cat}: ${count}`);
}

console.log('\n=== Checking recipes without URLs ===');
const noUrl = db.prepare(`
  SELECT RecipeId, Title 
  FROM recipes 
  WHERE URL IS NULL OR URL = ''
  LIMIT 20
`).all();

console.log(`Found ${noUrl.length} recipes without URLs:`);
for (const r of noUrl) {
  console.log(`  - ${r.Title}`);
}

console.log('\n=== Final stats ===');
const finalStats = db.prepare(`
  SELECT 
    COUNT(*) as total,
    COUNT(CASE WHEN Category IS NOT NULL AND Category != '' THEN 1 END) as with_category
  FROM ingredients
`).get();
console.log(`Total ingredients: ${finalStats.total}`);
console.log(`With category: ${finalStats.with_category} (${(finalStats.with_category / finalStats.total * 100).toFixed(1)}%)`);

db.close();
console.log('\nDone!');
