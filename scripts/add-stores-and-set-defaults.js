#!/usr/bin/env node

/**
 * Add Stores and Set Default Store for Ingredients
 * 
 * This script:
 * 1. Creates stores table if needed
 * 2. Adds Kroger, Costco, and Publix stores
 * 3. Sets all ingredients without a store to Kroger (default)
 * 4. Updates both seed database and user data database
 */

const Database = require('better-sqlite3');
const path = require('path');
const os = require('os');

const SEED_DB_PATH = path.join(__dirname, '../data/foodie.sqlite');
const USER_DB_PATH = path.join(
  os.homedir(),
  'Library/Application Support/Foodie Meal Planner/foodie.sqlite'
);

function addStoresAndSetDefaults(dbPath) {
  console.log(`\n📦 Processing: ${dbPath}`);
  
  const db = new Database(dbPath);
  
  try {
    db.exec('BEGIN TRANSACTION');
    
    // 1. Ensure stores table exists
    db.exec(`
      CREATE TABLE IF NOT EXISTS stores (
        StoreId TEXT PRIMARY KEY,
        Name TEXT NOT NULL,
        Priority INTEGER DEFAULT 0,
        UpdatedAt TEXT DEFAULT CURRENT_TIMESTAMP
      );
    `);
    
    // 2. Clear existing stores
    db.exec('DELETE FROM stores');
    
    // 3. Insert new stores (Kroger = priority 1 = default)
    const insertStore = db.prepare(`
      INSERT INTO stores (StoreId, Name, Priority, UpdatedAt)
      VALUES (?, ?, ?, datetime('now'))
    `);
    
    insertStore.run('kroger', 'Kroger', 1);
    insertStore.run('costco', 'Costco', 2);
    insertStore.run('publix', 'Publix', 3);
    
    console.log('   ✅ Added 3 stores: Kroger (default), Costco, Publix');
    
    // 4. Count ingredients without store
    const countNoStore = db.prepare(`
      SELECT COUNT(*) as count FROM ingredients WHERE StoreId IS NULL OR StoreId = ''
    `).get();
    
    if (countNoStore.count > 0) {
      // 5. Set all ingredients without store to Kroger
      const updateStmt = db.prepare(`
        UPDATE ingredients 
        SET StoreId = 'kroger' 
        WHERE StoreId IS NULL OR StoreId = ''
      `);
      
      const result = updateStmt.run();
      console.log(`   ✅ Set ${result.changes} ingredients to default store (Kroger)`);
    } else {
      console.log('   ℹ️  All ingredients already have stores assigned');
    }
    
    // 6. Show summary
    const storeCounts = db.prepare(`
      SELECT 
        COALESCE(s.Name, 'Unknown') as StoreName,
        COUNT(i.IngredientNorm) as IngredientCount
      FROM ingredients i
      LEFT JOIN stores s ON i.StoreId = s.StoreId
      GROUP BY i.StoreId
      ORDER BY IngredientCount DESC
    `).all();
    
    console.log('\n   📊 Ingredient distribution by store:');
    storeCounts.forEach(row => {
      console.log(`      ${row.StoreName}: ${row.IngredientCount.toLocaleString()}`);
    });
    
    db.exec('COMMIT');
    console.log('   ✅ Changes committed successfully');
    
  } catch (error) {
    db.exec('ROLLBACK');
    console.error(`   ❌ Error: ${error.message}`);
    throw error;
  } finally {
    db.close();
  }
}

// Main execution
console.log('🏪 Adding Stores and Setting Default Store for Ingredients\n');
console.log('=' .repeat(60));

try {
  // Process seed database
  addStoresAndSetDefaults(SEED_DB_PATH);
  
  // Process user data database if it exists
  const fs = require('fs');
  if (fs.existsSync(USER_DB_PATH)) {
    addStoresAndSetDefaults(USER_DB_PATH);
  } else {
    console.log('\nℹ️  User database not found, skipping');
  }
  
  console.log('\n' + '='.repeat(60));
  console.log('✅ SUCCESS! Stores added and default store set for all ingredients');
  console.log('\nStores added:');
  console.log('  1. Kroger (default) - All existing ingredients assigned here');
  console.log('  2. Costco');
  console.log('  3. Publix');
  console.log('\nRestart the desktop app to see changes.');
  
} catch (error) {
  console.error('\n❌ FAILED:', error.message);
  process.exit(1);
}
