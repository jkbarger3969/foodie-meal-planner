#!/usr/bin/env node

/**
 * Migration Script: Convert plans table to user_plan_meals
 * 
 * This script:
 * 1. Creates the new user_plan_meals table
 * 2. Migrates all existing meal plans to "Whole Family" user
 * 3. Updates plan_additional_items to reference new meals
 * 4. Creates backup before migration
 * 5. Validates migration success
 */

const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const dbPath = path.join(__dirname, '..', 'data', 'foodie.sqlite');

console.log('═══════════════════════════════════════════════════════════');
console.log('  Multi-User Meal Plans Migration');
console.log('═══════════════════════════════════════════════════════════\n');

// Check if database exists
if (!fs.existsSync(dbPath)) {
  console.error(`❌ ERROR: Database not found at ${dbPath}`);
  process.exit(1);
}

// Create backup
const backupPath = dbPath.replace('.sqlite', `-backup-${Date.now()}.sqlite`);
console.log(`📦 Creating backup: ${path.basename(backupPath)}`);
fs.copyFileSync(dbPath, backupPath);
console.log('✅ Backup created\n');

const db = new Database(dbPath);

// Enable foreign keys
db.pragma('foreign_keys = ON');

try {
  console.log('🔍 Checking current schema...');
  
  // Check if migration already ran
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='user_plan_meals'").all();
  if (tables.length > 0) {
    console.log('⚠️  user_plan_meals table already exists - skipping table creation');
    console.log('ℹ️  Will attempt to migrate any new data\n');
  } else {
    console.log('✅ Schema check passed\n');
    
    // Step 1: Create new table
    console.log('📊 Creating user_plan_meals table...');
    
    db.exec(`
      CREATE TABLE IF NOT EXISTS user_plan_meals (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT NOT NULL,
        date TEXT NOT NULL,
        slot TEXT NOT NULL,
        recipe_id TEXT,
        title TEXT NOT NULL,
        use_leftovers INTEGER DEFAULT 0,
        from_meal TEXT,
        apple_event_id TEXT,
        google_event_id TEXT,
        sort_order INTEGER DEFAULT 0,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
        FOREIGN KEY (recipe_id) REFERENCES recipes(RecipeId) ON DELETE SET NULL
      );
      
      CREATE INDEX IF NOT EXISTS idx_user_plan_meals_user_date 
        ON user_plan_meals(user_id, date);
      CREATE INDEX IF NOT EXISTS idx_user_plan_meals_date_slot 
        ON user_plan_meals(date, slot);
      CREATE INDEX IF NOT EXISTS idx_user_plan_meals_recipe 
        ON user_plan_meals(recipe_id);
      CREATE UNIQUE INDEX IF NOT EXISTS idx_user_plan_meals_unique 
        ON user_plan_meals(user_id, date, slot, recipe_id) 
        WHERE recipe_id IS NOT NULL;
    `);
    
    console.log('✅ Table created\n');
  }
  
  // Step 2: Get "Whole Family" user ID
  console.log('👨‍👩‍👧‍👦 Finding "Whole Family" user...');
  
  const wholeFamilyUser = db.prepare(`
    SELECT user_id, name FROM users WHERE name = 'Whole Family' LIMIT 1
  `).get();
  
  if (!wholeFamilyUser) {
    console.error('❌ ERROR: "Whole Family" user not found');
    console.error('Please ensure the users table has a "Whole Family" entry');
    db.close();
    process.exit(1);
  }
  
  const wholeFamilyUserId = wholeFamilyUser.user_id;
  console.log(`✅ Found: ${wholeFamilyUser.name} (${wholeFamilyUserId})\n`);
  
  // Step 3: Count existing plans
  console.log('📋 Analyzing existing plans...');
  
  const planCount = db.prepare(`
    SELECT COUNT(*) as count FROM plans
    WHERE BreakfastTitle IS NOT NULL 
       OR LunchTitle IS NOT NULL 
       OR DinnerTitle IS NOT NULL
  `).get();
  
  console.log(`Found ${planCount.count} plan rows\n`);
  
  if (planCount.count === 0) {
    console.log('ℹ️  No existing plans to migrate');
  } else {
    // Step 4: Migrate existing plans
    console.log('🔄 Migrating meals to user_plan_meals...');
    
    const existingPlans = db.prepare(`
      SELECT Date, 
             BreakfastRecipeId, BreakfastTitle, BreakfastUseLeftovers, BreakfastFrom, BreakfastEventId,
             LunchRecipeId, LunchTitle, LunchUseLeftovers, LunchFrom, LunchEventId,
             DinnerRecipeId, DinnerTitle, DinnerUseLeftovers, DinnerFrom, DinnerEventId
      FROM plans
      WHERE BreakfastTitle IS NOT NULL 
         OR LunchTitle IS NOT NULL 
         OR DinnerTitle IS NOT NULL
      ORDER BY Date ASC
    `).all();
    
    const insertStmt = db.prepare(`
      INSERT INTO user_plan_meals 
        (user_id, date, slot, recipe_id, title, use_leftovers, from_meal, apple_event_id, sort_order)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    let migratedCount = 0;
    let errorCount = 0;
    
    const migrate = db.transaction(() => {
      for (const plan of existingPlans) {
        const slots = [
          {
            slot: 'Breakfast',
            recipeId: plan.BreakfastRecipeId,
            title: plan.BreakfastTitle,
            useLeftovers: plan.BreakfastUseLeftovers || 0,
            from: plan.BreakfastFrom,
            eventId: plan.BreakfastEventId
          },
          {
            slot: 'Lunch',
            recipeId: plan.LunchRecipeId,
            title: plan.LunchTitle,
            useLeftovers: plan.LunchUseLeftovers || 0,
            from: plan.LunchFrom,
            eventId: plan.LunchEventId
          },
          {
            slot: 'Dinner',
            recipeId: plan.DinnerRecipeId,
            title: plan.DinnerTitle,
            useLeftovers: plan.DinnerUseLeftovers || 0,
            from: plan.DinnerFrom,
            eventId: plan.DinnerEventId
          }
        ];
        
        for (const s of slots) {
          if (s.title) {
            try {
              insertStmt.run(
                wholeFamilyUserId,
                plan.Date,
                s.slot,
                s.recipeId || null,
                s.title,
                s.useLeftovers,
                s.from || null,
                s.eventId || null,
                0  // sort_order
              );
              migratedCount++;
            } catch (err) {
              if (err.message.includes('UNIQUE constraint')) {
                // Duplicate - skip it
                console.log(`⚠️  Skipped duplicate: ${plan.Date} ${s.slot} - ${s.title}`);
              } else {
                console.error(`❌ Error migrating ${plan.Date} ${s.slot}:`, err.message);
                errorCount++;
              }
            }
          }
        }
      }
    });
    
    migrate();
    
    console.log(`✅ Migrated ${migratedCount} meals`);
    if (errorCount > 0) {
      console.log(`⚠️  ${errorCount} errors occurred\n`);
    } else {
      console.log('');
    }
  }
  
  // Step 5: Update plan_additional_items
  console.log('🔗 Updating plan_additional_items references...');
  
  // Check if column already exists
  const additionalItemsInfo = db.prepare("PRAGMA table_info(plan_additional_items)").all();
  const hasMealIdColumn = additionalItemsInfo.some(col => col.name === 'meal_id');
  
  if (!hasMealIdColumn) {
    db.exec(`
      ALTER TABLE plan_additional_items 
        ADD COLUMN meal_id INTEGER REFERENCES user_plan_meals(id) ON DELETE CASCADE;
    `);
    console.log('✅ Added meal_id column');
    
    // Link additional items to their meals
    const linkResult = db.prepare(`
      UPDATE plan_additional_items
      SET meal_id = (
        SELECT id FROM user_plan_meals 
        WHERE user_plan_meals.date = plan_additional_items.Date
          AND user_plan_meals.slot = plan_additional_items.Slot
        LIMIT 1
      )
      WHERE meal_id IS NULL
    `).run();
    
    console.log(`✅ Linked ${linkResult.changes} additional items\n`);
  } else {
    console.log('ℹ️  meal_id column already exists\n');
  }
  
  // Step 6: Validation
  console.log('✔️  Validating migration...');
  
  const validation = {
    originalMeals: db.prepare(`
      SELECT 
        COUNT(*) as breakfast,
        (SELECT COUNT(*) FROM plans WHERE LunchTitle IS NOT NULL) as lunch,
        (SELECT COUNT(*) FROM plans WHERE DinnerTitle IS NOT NULL) as dinner
      FROM plans WHERE BreakfastTitle IS NOT NULL
    `).get(),
    
    migratedMeals: db.prepare(`
      SELECT COUNT(*) as count FROM user_plan_meals WHERE user_id = ?
    `).get(wholeFamilyUserId),
    
    additionalItems: db.prepare(`
      SELECT 
        COUNT(*) as total,
        COUNT(meal_id) as linked
      FROM plan_additional_items
    `).get()
  };
  
  const originalTotal = validation.originalMeals.breakfast + validation.originalMeals.lunch + validation.originalMeals.dinner;
  
  console.log(`\nOriginal meals in plans table: ${originalTotal}`);
  console.log(`  - Breakfast: ${validation.originalMeals.breakfast}`);
  console.log(`  - Lunch: ${validation.originalMeals.lunch}`);
  console.log(`  - Dinner: ${validation.originalMeals.dinner}`);
  
  console.log(`\nMigrated to user_plan_meals: ${validation.migratedMeals.count}`);
  
  console.log(`\nAdditional items: ${validation.additionalItems.total} total, ${validation.additionalItems.linked} linked`);
  
  if (validation.migratedMeals.count >= originalTotal) {
    console.log('\n✅ Migration validation PASSED');
  } else {
    console.log('\n⚠️  Warning: Migrated count is less than original count');
    console.log('This may be due to duplicate meals that were skipped');
  }
  
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('  Migration Complete!');
  console.log('═══════════════════════════════════════════════════════════\n');
  
  console.log('Next steps:');
  console.log('1. Restart the application');
  console.log('2. Test viewing meal plans');
  console.log('3. Test creating new meals for different users');
  console.log('4. Verify calendar sync still works');
  console.log('5. Test shopping list generation');
  console.log(`\nBackup saved to: ${path.basename(backupPath)}`);
  console.log('Keep this backup until migration is fully verified\n');
  
} catch (error) {
  console.error('\n❌ MIGRATION FAILED:', error.message);
  console.error(error.stack);
  console.log(`\nRestore from backup: ${backupPath}`);
  process.exit(1);
} finally {
  db.close();
}
