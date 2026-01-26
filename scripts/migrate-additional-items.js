#!/usr/bin/env node

/**
 * Migration: Create plan_additional_items table
 * Adds support for multiple recipes per meal slot (sides, desserts, etc.)
 */

const path = require('path');
const Database = require('better-sqlite3');

// Migrate both seed and userData databases
const databases = [
  { name: 'SEED', path: path.join(__dirname, '..', 'data', 'foodie.sqlite') },
  { 
    name: 'USERDATA', 
    path: path.join(require('os').homedir(), 'Library', 'Application Support', 'Foodie Meal Planner', 'foodie.sqlite')
  }
];

console.log('📦 Creating plan_additional_items table...\n');

for (const dbConfig of databases) {
  console.log(`\n🔧 Migrating ${dbConfig.name} database: ${dbConfig.path}`);
  
  try {
    const db = new Database(dbConfig.path);
    
    // Check if table already exists
    const tableExists = db.prepare(`
      SELECT name FROM sqlite_master 
      WHERE type='table' AND name='plan_additional_items'
    `).get();
    
    if (tableExists) {
      console.log(`   ⚠️  Table already exists, skipping`);
      db.close();
      continue;
    }
    
    // Create the table
    db.exec(`
      CREATE TABLE IF NOT EXISTS plan_additional_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        Date TEXT NOT NULL,
        Slot TEXT NOT NULL,
        RecipeId TEXT NOT NULL,
        Title TEXT,
        ItemType TEXT,
        SortOrder INTEGER DEFAULT 0,
        FOREIGN KEY (RecipeId) REFERENCES recipes(RecipeId) ON DELETE CASCADE
      );
      
      CREATE INDEX IF NOT EXISTS idx_additional_items_date_slot 
        ON plan_additional_items(Date, Slot);
      
      CREATE INDEX IF NOT EXISTS idx_additional_items_recipe
        ON plan_additional_items(RecipeId);
    `);
    
    // Verify table was created
    const verify = db.prepare(`
      SELECT name, sql FROM sqlite_master 
      WHERE type='table' AND name='plan_additional_items'
    `).get();
    
    if (verify) {
      console.log(`   ✅ Table created successfully`);
      console.log(`   ✅ Indexes created: idx_additional_items_date_slot, idx_additional_items_recipe`);
    } else {
      console.log(`   ❌ Table creation failed`);
    }
    
    db.close();
    
  } catch (err) {
    console.error(`   ❌ Error migrating ${dbConfig.name}:`, err.message);
  }
}

console.log('\n✨ Migration complete!\n');
