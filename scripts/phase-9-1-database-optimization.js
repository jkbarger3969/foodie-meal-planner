#!/usr/bin/env node

/**
 * Phase 9.1: Database Optimization
 * 
 * Adds missing indexes for frequently queried columns to improve performance.
 * Target improvements:
 * - Recipe list: 2s → 500ms
 * - Meal plan: 1s → 300ms  
 * - Shopping list: 3s → 1s
 */

const path = require('path');
const Database = require('better-sqlite3');

const dbPath = path.join(__dirname, '..', 'data', 'foodie.sqlite');
const db = new Database(dbPath);

console.log('🔧 Phase 9.1: Database Optimization\n');

// Check existing indexes
console.log('📊 Analyzing existing indexes...');
const existingIndexes = db.prepare(`
  SELECT name, tbl_name, sql 
  FROM sqlite_master 
  WHERE type = 'index' AND sql IS NOT NULL
  ORDER BY tbl_name, name
`).all();

console.log(`Found ${existingIndexes.length} existing indexes\n`);

// Indexes to add
const newIndexes = [
  {
    name: 'idx_plans_date',
    table: 'plans',
    sql: 'CREATE INDEX IF NOT EXISTS idx_plans_date ON plans(Date)',
    reason: 'Speed up meal planner date range queries'
  },
  {
    name: 'idx_ingredients_recipeid',
    table: 'ingredients',
    sql: 'CREATE INDEX IF NOT EXISTS idx_ingredients_recipeid ON ingredients(RecipeId)',
    reason: 'Speed up ingredient lookups by recipe'
  },
  {
    name: 'idx_ingredients_category',
    table: 'ingredients',
    sql: 'CREATE INDEX IF NOT EXISTS idx_ingredients_category ON ingredients(Category)',
    reason: 'Speed up shopping list grouping by category'
  },
  {
    name: 'idx_recipes_favorite',
    table: 'recipes',
    sql: 'CREATE INDEX IF NOT EXISTS idx_recipes_favorite ON recipes(Favorite)',
    reason: 'Speed up favorite recipe filtering'
  },
  {
    name: 'idx_pantry_category',
    table: 'pantry',
    sql: 'CREATE INDEX IF NOT EXISTS idx_pantry_category ON pantry(Category)',
    reason: 'Speed up pantry category grouping'
  },
  {
    name: 'idx_pantry_lowstock',
    table: 'pantry',
    sql: 'CREATE INDEX IF NOT EXISTS idx_pantry_lowstock ON pantry(QtyNum, LowStockThreshold)',
    reason: 'Speed up low stock item queries'
  },
  {
    name: 'idx_pantry_expiration',
    table: 'pantry',
    sql: 'CREATE INDEX IF NOT EXISTS idx_pantry_expiration ON pantry(ExpirationDate)',
    reason: 'Speed up expiring items queries'
  },
  {
    name: 'idx_recipe_collection_map_recipe',
    table: 'recipe_collection_map',
    sql: 'CREATE INDEX IF NOT EXISTS idx_recipe_collection_map_recipe ON recipe_collection_map(recipeId)',
    reason: 'Speed up collection membership lookups'
  },
  {
    name: 'idx_recipe_collection_map_collection',
    table: 'recipe_collection_map',
    sql: 'CREATE INDEX IF NOT EXISTS idx_recipe_collection_map_collection ON recipe_collection_map(collectionId)',
    reason: 'Speed up recipes-in-collection queries'
  }
];

console.log('📝 Adding performance indexes...\n');

let addedCount = 0;
let skippedCount = 0;

for (const index of newIndexes) {
  const exists = existingIndexes.some(ei => ei.name === index.name);
  
  if (exists) {
    console.log(`⏭️  Skipped: ${index.name} (already exists)`);
    skippedCount++;
  } else {
    try {
      db.exec(index.sql);
      console.log(`✅ Created: ${index.name}`);
      console.log(`   Table: ${index.table}`);
      console.log(`   Reason: ${index.reason}\n`);
      addedCount++;
    } catch (error) {
      console.error(`❌ Failed to create ${index.name}:`, error.message);
    }
  }
}

// Analyze tables for query optimizer
console.log('\n📈 Running ANALYZE to update query planner statistics...');
try {
  db.exec('ANALYZE');
  console.log('✅ ANALYZE complete\n');
} catch (error) {
  console.error('❌ ANALYZE failed:', error.message);
}

// Vacuum to reclaim space and reorganize
console.log('🧹 Running VACUUM to optimize database file...');
try {
  db.exec('VACUUM');
  console.log('✅ VACUUM complete\n');
} catch (error) {
  console.error('❌ VACUUM failed:', error.message);
}

console.log('═══════════════════════════════════════');
console.log('📊 Summary:');
console.log(`   ✅ Indexes added: ${addedCount}`);
console.log(`   ⏭️  Indexes skipped: ${skippedCount}`);
console.log(`   📚 Total indexes: ${existingIndexes.length + addedCount}`);
console.log('═══════════════════════════════════════\n');

console.log('🎉 Database optimization complete!\n');
console.log('Expected improvements:');
console.log('  • Recipe list loading: ~60% faster');
console.log('  • Meal plan rendering: ~70% faster');
console.log('  • Shopping list generation: ~65% faster');
console.log('  • Pantry insights: ~50% faster\n');

db.close();
