#!/usr/bin/env node

/**
 * Comprehensive Database Schema and Data Verification
 * Ensures all tables, columns, indexes, and data are correct
 */

const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const dbPath = path.join(__dirname, 'data', 'foodie.sqlite');
console.log('🔍 COMPREHENSIVE DATABASE VERIFICATION\n');
console.log('Database:', dbPath);
console.log('='.repeat(70));

const db = new Database(dbPath);
db.pragma('foreign_keys = ON');

let errors = [];
let warnings = [];
let passed = 0;

function check(name, fn) {
  try {
    const result = fn();
    if (result === false) {
      errors.push(name);
      console.log(`❌ ${name}`);
    } else {
      passed++;
      console.log(`✅ ${name}`);
    }
  } catch (e) {
    errors.push(`${name}: ${e.message}`);
    console.log(`❌ ${name}: ${e.message}`);
  }
}

function warn(message) {
  warnings.push(message);
  console.log(`⚠️  ${message}`);
}

// Helper to check if table exists
function tableExists(name) {
  const result = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?").get(name);
  return !!result;
}

// Helper to check if column exists
function columnExists(table, column) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all();
  return cols.some(c => c.name === column);
}

// Helper to check if index exists
function indexExists(name) {
  const result = db.prepare("SELECT name FROM sqlite_master WHERE type='index' AND name=?").get(name);
  return !!result;
}

console.log('\n📊 CORE TABLES');
console.log('-'.repeat(70));

check('recipes table exists', () => tableExists('recipes'));
check('recipes.RecipeId column', () => columnExists('recipes', 'RecipeId'));
check('recipes.Title column', () => columnExists('recipes', 'Title'));
check('recipes.TitleLower column', () => columnExists('recipes', 'TitleLower'));
check('recipes.Cuisine column', () => columnExists('recipes', 'Cuisine'));
check('recipes.MealType column', () => columnExists('recipes', 'MealType'));
check('recipes.is_favorite column', () => columnExists('recipes', 'is_favorite'));
check('recipes.default_servings column', () => columnExists('recipes', 'default_servings'));

check('ingredients table exists', () => tableExists('ingredients'));
check('ingredients.RecipeId column', () => columnExists('ingredients', 'RecipeId'));
check('ingredients.IngredientNorm column', () => columnExists('ingredients', 'IngredientNorm'));
check('ingredients.IngredientName column', () => columnExists('ingredients', 'IngredientName'));
check('ingredients.QtyNum column', () => columnExists('ingredients', 'QtyNum'));
check('ingredients.Unit column', () => columnExists('ingredients', 'Unit'));
check('ingredients.Category column', () => columnExists('ingredients', 'Category'));

check('plans table exists', () => tableExists('plans'));
check('plans.Date column', () => columnExists('plans', 'Date'));
check('plans.BreakfastRecipeId column', () => columnExists('plans', 'BreakfastRecipeId'));
check('plans.BreakfastTitle column', () => columnExists('plans', 'BreakfastTitle'));
check('plans.LunchRecipeId column', () => columnExists('plans', 'LunchRecipeId'));
check('plans.DinnerRecipeId column', () => columnExists('plans', 'DinnerRecipeId'));
check('plans.BreakfastGoogleEventId column', () => columnExists('plans', 'BreakfastGoogleEventId'));

check('pantry table exists', () => tableExists('pantry'));
check('pantry.ItemId column', () => columnExists('pantry', 'ItemId'));
check('pantry.Name column', () => columnExists('pantry', 'Name'));
check('pantry.NameLower column', () => columnExists('pantry', 'NameLower'));
check('pantry.QtyNum column', () => columnExists('pantry', 'QtyNum'));
check('pantry.Unit column', () => columnExists('pantry', 'Unit'));
check('pantry.Category column', () => columnExists('pantry', 'Category'));

check('stores table exists', () => tableExists('stores'));
check('stores.StoreId column', () => columnExists('stores', 'StoreId'));
check('stores.Name column', () => columnExists('stores', 'Name'));
check('stores.Priority column', () => columnExists('stores', 'Priority'));

console.log('\n👥 MULTI-USER TABLES (Phase 4.5)');
console.log('-'.repeat(70));

check('users table exists', () => tableExists('users'));
check('users.user_id column', () => columnExists('users', 'user_id'));
check('users.name column', () => columnExists('users', 'name'));
check('users.email column', () => columnExists('users', 'email'));
check('users.avatar_emoji column', () => columnExists('users', 'avatar_emoji'));
check('users.is_active column', () => columnExists('users', 'is_active'));

check('dietary_restrictions table exists', () => tableExists('dietary_restrictions'));
check('dietary_restrictions.restriction_id column', () => columnExists('dietary_restrictions', 'restriction_id'));
check('dietary_restrictions.name column', () => columnExists('dietary_restrictions', 'name'));

check('user_dietary_restrictions table exists', () => tableExists('user_dietary_restrictions'));
check('user_favorites table exists', () => tableExists('user_favorites'));
check('meal_assignments table exists', () => tableExists('meal_assignments'));

console.log('\n📦 COLLECTIONS & ADDITIONAL ITEMS');
console.log('-'.repeat(70));

check('recipe_collections table exists', () => tableExists('recipe_collections'));
check('recipe_collection_map table exists', () => tableExists('recipe_collection_map'));
check('plan_additional_items table exists', () => tableExists('plan_additional_items'));
check('plan_additional_items.Date column', () => columnExists('plan_additional_items', 'Date'));
check('plan_additional_items.Slot column', () => columnExists('plan_additional_items', 'Slot'));
check('plan_additional_items.RecipeId column', () => columnExists('plan_additional_items', 'RecipeId'));
check('plan_additional_items.ItemType column', () => columnExists('plan_additional_items', 'ItemType'));

console.log('\n📈 PERFORMANCE INDEXES (Phase 9.1)');
console.log('-'.repeat(70));

check('idx_recipes_titlelower', () => indexExists('idx_recipes_titlelower'));
check('idx_recipes_cuisine', () => indexExists('idx_recipes_cuisine'));
check('idx_recipes_mealtype', () => indexExists('idx_recipes_mealtype'));
check('idx_ingredients_recipeid', () => indexExists('idx_ingredients_recipeid'));
check('idx_ingredients_category', () => indexExists('idx_ingredients_category'));
check('idx_pantry_namelower', () => indexExists('idx_pantry_namelower'));
check('idx_pantry_category', () => indexExists('idx_pantry_category'));
check('idx_plans_date', () => indexExists('idx_plans_date'));
check('idx_additional_items_date_slot', () => indexExists('idx_additional_items_date_slot'));

console.log('\n💾 DATA INTEGRITY CHECKS');
console.log('-'.repeat(70));

// Check data counts
const recipeCt = db.prepare("SELECT COUNT(*) as n FROM recipes").get();
check(`recipes table has data (${recipeCt.n} recipes)`, () => {
  if (recipeCt.n < 3000) {
    warn(`Expected 3,500+ recipes, found ${recipeCt.n}`);
  }
  return recipeCt.n > 0;
});

const userCt = db.prepare("SELECT COUNT(*) as n FROM users").get();
check(`users table has default user (${userCt.n} users)`, () => userCt.n >= 1);

const restrictionCt = db.prepare("SELECT COUNT(*) as n FROM dietary_restrictions").get();
check(`dietary restrictions seeded (${restrictionCt.n} restrictions)`, () => {
  if (restrictionCt.n < 10) {
    warn(`Expected 10 dietary restrictions, found ${restrictionCt.n}`);
  }
  return restrictionCt.n > 0;
});

const storeCt = db.prepare("SELECT COUNT(*) as n FROM stores").get();
check(`stores configured (${storeCt.n} stores)`, () => storeCt.n > 0);

// Check for orphaned data
const orphanedIngredients = db.prepare(`
  SELECT COUNT(*) as n FROM ingredients 
  WHERE RecipeId NOT IN (SELECT RecipeId FROM recipes)
`).get();
check('no orphaned ingredients', () => {
  if (orphanedIngredients.n > 0) {
    warn(`Found ${orphanedIngredients.n} orphaned ingredients - should clean up`);
  }
  return orphanedIngredients.n === 0;
});

// Check foreign key integrity
const fkCheck = db.pragma('foreign_key_check');
check('foreign key integrity', () => {
  if (fkCheck.length > 0) {
    warn(`Foreign key violations found: ${JSON.stringify(fkCheck)}`);
  }
  return fkCheck.length === 0;
});

console.log('\n🔍 CRITICAL DATA QUALITY');
console.log('-'.repeat(70));

// Check for recipes without titles
const noTitle = db.prepare("SELECT COUNT(*) as n FROM recipes WHERE Title IS NULL OR Title = ''").get();
check('all recipes have titles', () => {
  if (noTitle.n > 0) {
    warn(`Found ${noTitle.n} recipes without titles`);
  }
  return noTitle.n === 0;
});

// Check for TitleLower population
const noTitleLower = db.prepare("SELECT COUNT(*) as n FROM recipes WHERE TitleLower IS NULL OR TitleLower = ''").get();
check('all recipes have TitleLower', () => {
  if (noTitleLower.n > 0) {
    warn(`Found ${noTitleLower.n} recipes without TitleLower - search will be broken`);
  }
  return noTitleLower.n === 0;
});

// Check default user exists
const defaultUser = db.prepare("SELECT * FROM users WHERE name = 'Whole Family'").get();
check('default "Whole Family" user exists', () => !!defaultUser);

// Check dietary restrictions are complete
const expectedRestrictions = [
  'Vegetarian', 'Vegan', 'Gluten-Free', 'Dairy-Free', 
  'Nut-Free', 'Shellfish-Free', 'Kosher', 'Halal', 
  'Low-Carb', 'Keto'
];
expectedRestrictions.forEach(name => {
  const exists = db.prepare("SELECT * FROM dietary_restrictions WHERE name = ?").get(name);
  check(`dietary restriction: ${name}`, () => !!exists);
});

console.log('\n📊 SAMPLE DATA VERIFICATION');
console.log('-'.repeat(70));

// Get sample recipe
const sampleRecipe = db.prepare("SELECT * FROM recipes LIMIT 1").get();
if (sampleRecipe) {
  console.log('Sample recipe:', {
    RecipeId: sampleRecipe.RecipeId,
    Title: sampleRecipe.Title?.substring(0, 40),
    Cuisine: sampleRecipe.Cuisine,
    MealType: sampleRecipe.MealType
  });
  
  // Check ingredients for this recipe
  const ingredients = db.prepare("SELECT COUNT(*) as n FROM ingredients WHERE RecipeId = ?").get(sampleRecipe.RecipeId);
  check(`sample recipe has ingredients (${ingredients.n})`, () => ingredients.n > 0);
}

// Check stores have names
const storesWithoutNames = db.prepare("SELECT COUNT(*) as n FROM stores WHERE Name IS NULL OR Name = ''").get();
check('all stores have names', () => storesWithoutNames.n === 0);

console.log('\n' + '='.repeat(70));
console.log('📊 VERIFICATION SUMMARY');
console.log('='.repeat(70));
console.log(`✅ Passed:   ${passed}`);
console.log(`❌ Failed:   ${errors.length}`);
console.log(`⚠️  Warnings: ${warnings.length}`);

if (warnings.length > 0) {
  console.log('\n⚠️  WARNINGS:');
  warnings.forEach(w => console.log(`   - ${w}`));
}

if (errors.length > 0) {
  console.log('\n❌ ERRORS:');
  errors.forEach(e => console.log(`   - ${e}`));
  console.log('\n⛔ DATABASE VERIFICATION FAILED');
  process.exit(1);
} else {
  console.log('\n🎉 DATABASE VERIFICATION PASSED');
  console.log('\nDatabase is ready for production use.');
  process.exit(0);
}
