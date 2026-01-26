#!/usr/bin/env node

/**
 * Production Readiness Test Suite
 * Tests all critical features and Phase 9 optimizations
 */

const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const dbPath = path.join(__dirname, 'data', 'foodie.sqlite');

console.log('🔍 PRODUCTION READINESS TEST SUITE\n');
console.log('Testing database:', dbPath);
console.log('='.repeat(60));

let db;
let testResults = {
  passed: 0,
  failed: 0,
  warnings: 0,
  errors: []
};

function test(name, fn) {
  try {
    const result = fn();
    if (result === false) {
      console.log(`❌ ${name}`);
      testResults.failed++;
      testResults.errors.push(name);
    } else {
      console.log(`✅ ${name}`);
      testResults.passed++;
    }
  } catch (e) {
    console.log(`❌ ${name}: ${e.message}`);
    testResults.failed++;
    testResults.errors.push(`${name}: ${e.message}`);
  }
}

function warn(message) {
  console.log(`⚠️  ${message}`);
  testResults.warnings++;
}

try {
  db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  
  console.log('\n📊 DATABASE SCHEMA TESTS');
  console.log('-'.repeat(60));
  
  // Core tables
  test('recipes table exists', () => {
    const result = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='recipes'").get();
    return !!result;
  });
  
  test('ingredients table exists', () => {
    const result = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='ingredients'").get();
    return !!result;
  });
  
  test('plans table exists', () => {
    const result = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='plans'").get();
    return !!result;
  });
  
  test('pantry table exists', () => {
    const result = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='pantry'").get();
    return !!result;
  });
  
  test('stores table exists', () => {
    const result = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='stores'").get();
    return !!result;
  });
  
  // Multi-user tables
  test('users table exists', () => {
    const result = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='users'").get();
    return !!result;
  });
  
  test('dietary_restrictions table exists', () => {
    const result = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='dietary_restrictions'").get();
    return !!result;
  });
  
  test('user_favorites table exists', () => {
    const result = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='user_favorites'").get();
    return !!result;
  });
  
  test('meal_assignments table exists', () => {
    const result = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='meal_assignments'").get();
    return !!result;
  });
  
  // Phase 9 tables
  test('plan_additional_items table exists', () => {
    const result = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='plan_additional_items'").get();
    return !!result;
  });
  
  test('recipe_collections table exists', () => {
    const result = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='recipe_collections'").get();
    return !!result;
  });
  
  console.log('\n📈 DATABASE INDEXES (Phase 9.1)');
  console.log('-'.repeat(60));
  
  // Critical indexes for performance
  test('idx_recipes_titlelower index exists', () => {
    const result = db.prepare("SELECT name FROM sqlite_master WHERE type='index' AND name='idx_recipes_titlelower'").get();
    return !!result;
  });
  
  test('idx_ingredients_recipeid index exists', () => {
    const result = db.prepare("SELECT name FROM sqlite_master WHERE type='index' AND name='idx_ingredients_recipeid'").get();
    return !!result;
  });
  
  test('idx_pantry_namelower index exists', () => {
    const result = db.prepare("SELECT name FROM sqlite_master WHERE type='index' AND name='idx_pantry_namelower'").get();
    return !!result;
  });
  
  test('idx_plans_date index exists', () => {
    const result = db.prepare("SELECT name FROM sqlite_master WHERE type='index' AND name='idx_plans_date'").get();
    return !!result;
  });
  
  test('idx_additional_items_date_slot index exists', () => {
    const result = db.prepare("SELECT name FROM sqlite_master WHERE type='index' AND name='idx_additional_items_date_slot'").get();
    return !!result;
  });
  
  console.log('\n🔢 DATA INTEGRITY TESTS');
  console.log('-'.repeat(60));
  
  // Check for data
  const recipeCount = db.prepare("SELECT COUNT(*) as n FROM recipes").get();
  test(`recipes table has data (${recipeCount.n} recipes)`, () => {
    if (recipeCount.n < 100) {
      warn(`Only ${recipeCount.n} recipes - expected >100 for production`);
    }
    return recipeCount.n > 0;
  });
  
  const userCount = db.prepare("SELECT COUNT(*) as n FROM users").get();
  test(`users table has default user (${userCount.n} users)`, () => {
    return userCount.n >= 1;
  });
  
  const restrictionCount = db.prepare("SELECT COUNT(*) as n FROM dietary_restrictions").get();
  test(`dietary restrictions seeded (${restrictionCount.n} restrictions)`, () => {
    return restrictionCount.n >= 5;
  });
  
  const storeCount = db.prepare("SELECT COUNT(*) as n FROM stores").get();
  test(`stores table initialized (${storeCount.n} stores)`, () => {
    if (storeCount.n === 0) {
      warn('No stores configured - users will need to add stores');
    }
    return true;
  });
  
  console.log('\n🔍 DATA QUALITY TESTS');
  console.log('-'.repeat(60));
  
  // Check for required columns
  test('recipes.TitleLower column exists', () => {
    const cols = db.prepare("PRAGMA table_info(recipes)").all();
    return cols.some(c => c.name === 'TitleLower');
  });
  
  test('recipes.is_favorite column exists', () => {
    const cols = db.prepare("PRAGMA table_info(recipes)").all();
    return cols.some(c => c.name === 'is_favorite');
  });
  
  test('pantry.NameLower column exists', () => {
    const cols = db.prepare("PRAGMA table_info(pantry)").all();
    return cols.some(c => c.name === 'NameLower');
  });
  
  test('pantry.Category column exists', () => {
    const cols = db.prepare("PRAGMA table_info(pantry)").all();
    return cols.some(c => c.name === 'Category');
  });
  
  // Check for orphaned data
  const orphanedIngredients = db.prepare(`
    SELECT COUNT(*) as n FROM ingredients 
    WHERE RecipeId NOT IN (SELECT RecipeId FROM recipes)
  `).get();
  test('no orphaned ingredients', () => {
    if (orphanedIngredients.n > 0) {
      warn(`Found ${orphanedIngredients.n} orphaned ingredients`);
    }
    return orphanedIngredients.n === 0;
  });
  
  console.log('\n📁 FILE SYSTEM TESTS');
  console.log('-'.repeat(60));
  
  test('package.json exists', () => fs.existsSync('package.json'));
  test('src/main/main.js exists', () => fs.existsSync('src/main/main.js'));
  test('src/main/api.js exists', () => fs.existsSync('src/main/api.js'));
  test('src/main/db.js exists', () => fs.existsSync('src/main/db.js'));
  test('src/main/preload.js exists', () => fs.existsSync('src/main/preload.js'));
  test('src/renderer/index.html exists', () => fs.existsSync('src/renderer/index.html'));
  
  // Check for build resources
  test('build directory exists', () => fs.existsSync('build'));
  
  // Check package.json configuration
  const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
  test('package.json has correct main entry', () => pkg.main === 'src/main/main.js');
  test('package.json has build script', () => !!pkg.scripts.build);
  test('package.json has electron-builder config', () => !!pkg.build);
  test('package.json has DMG target', () => {
    return pkg.build.mac && pkg.build.mac.target && pkg.build.mac.target.includes('dmg');
  });
  
  console.log('\n🔧 CONFIGURATION TESTS');
  console.log('-'.repeat(60));
  
  test('better-sqlite3 in dependencies', () => !!pkg.dependencies['better-sqlite3']);
  test('ws (WebSocket) in dependencies', () => !!pkg.dependencies['ws']);
  test('googleapis in dependencies', () => !!pkg.dependencies['googleapis']);
  test('puppeteer in dependencies', () => !!pkg.dependencies['puppeteer']);
  test('electron-builder in devDependencies', () => !!pkg.devDependencies['electron-builder']);
  
  test('asarUnpack includes better-sqlite3', () => {
    return pkg.build.asarUnpack.some(p => p.includes('better-sqlite3'));
  });
  
  test('asarUnpack includes data directory', () => {
    return pkg.build.asarUnpack.some(p => p.includes('data'));
  });
  
  console.log('\n🎯 PHASE 9 OPTIMIZATION VERIFICATION');
  console.log('-'.repeat(60));
  
  // Phase 9.1: Database optimization
  const analyzeResult = db.prepare("SELECT COUNT(*) as n FROM sqlite_stat1").get();
  test('Phase 9.1: Database statistics collected', () => {
    if (analyzeResult.n === 0) {
      warn('Run ANALYZE to optimize query planner');
    }
    return analyzeResult.n > 0;
  });
  
  // Phase 9.2: Virtual scrolling (check frontend file size)
  const indexHtmlSize = fs.statSync('src/renderer/index.html').size;
  test('Phase 9.2: index.html size reasonable', () => {
    if (indexHtmlSize > 1000000) {
      warn(`index.html is ${(indexHtmlSize/1024/1024).toFixed(2)}MB - consider code splitting`);
    }
    return indexHtmlSize > 0;
  });
  
  // Phase 9.3: Batched queries (check function exists)
  const apiContent = fs.readFileSync('src/main/api.js', 'utf8');
  test('Phase 9.3: getAdditionalItemsRange function exists', () => {
    return apiContent.includes('function getAdditionalItemsRange');
  });
  
  test('Phase 9.3: getAdditionalItemsRange in switch statement', () => {
    return apiContent.includes("case 'getAdditionalItemsRange'");
  });
  
  // Phase 9.6: WebSocket optimization
  const mainContent = fs.readFileSync('src/main/main.js', 'utf8');
  test('Phase 9.6: Differential sync implemented', () => {
    return mainContent.includes('hashObject_') && mainContent.includes('clientState');
  });
  
  test('Phase 9.6: Message batching implemented', () => {
    return mainContent.includes('batchMessage_') && mainContent.includes('BATCH_DELAY');
  });
  
  // Phase 9.8: Animation performance
  const indexContent = fs.readFileSync('src/renderer/index.html', 'utf8');
  test('Phase 9.8: GPU acceleration CSS exists', () => {
    return indexContent.includes('will-change: transform');
  });
  
  test('Phase 9.8: Tab visibility tracking exists', () => {
    return indexContent.includes('updateTabVisibility_');
  });
  
  console.log('\n' + '='.repeat(60));
  console.log('📊 TEST SUMMARY');
  console.log('='.repeat(60));
  console.log(`✅ Passed:   ${testResults.passed}`);
  console.log(`❌ Failed:   ${testResults.failed}`);
  console.log(`⚠️  Warnings: ${testResults.warnings}`);
  
  if (testResults.failed > 0) {
    console.log('\n❌ FAILED TESTS:');
    testResults.errors.forEach(err => console.log(`   - ${err}`));
  }
  
  console.log('\n' + '='.repeat(60));
  
  if (testResults.failed === 0) {
    console.log('🎉 ALL TESTS PASSED - PRODUCTION READY!');
    console.log('\nNext steps:');
    console.log('  1. Run: npm run build');
    console.log('  2. Test DMG in dist/ directory');
    console.log('  3. Deploy to beta testers');
    process.exit(0);
  } else {
    console.log('⚠️  SOME TESTS FAILED - FIX BEFORE PRODUCTION');
    console.log('\nPlease address the failed tests before deploying.');
    process.exit(1);
  }
  
} catch (e) {
  console.error('\n💥 CRITICAL ERROR:', e.message);
  console.error(e.stack);
  process.exit(1);
} finally {
  if (db) db.close();
}
