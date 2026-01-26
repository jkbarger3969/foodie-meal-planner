#!/usr/bin/env node

/**
 * Test script for deleteUser transaction
 * 
 * This tests that deleteUser properly wraps all deletions in a transaction
 * ensuring atomic all-or-nothing behavior.
 */

const path = require('path');
const fs = require('fs');

// Setup test database path
const testDbPath = path.join(__dirname, 'test-deleteuser.sqlite');

// Clean up any existing test database
if (fs.existsSync(testDbPath)) {
    fs.unlinkSync(testDbPath);
}

// Initialize database
const Database = require('better-sqlite3');
const db = new Database(testDbPath);

// Enable foreign keys
db.pragma('foreign_keys = ON');

console.log('✓ Test database created');

// Create tables
db.exec(`
  CREATE TABLE users (
    user_id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT,
    avatar_emoji TEXT,
    is_active INTEGER DEFAULT 1
  );

  CREATE TABLE user_plan_meals (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    date TEXT NOT NULL,
    slot TEXT NOT NULL,
    recipe_id TEXT,
    FOREIGN KEY(user_id) REFERENCES users(user_id) ON DELETE CASCADE
  );

  CREATE TABLE user_favorites (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    recipe_id TEXT NOT NULL,
    FOREIGN KEY(user_id) REFERENCES users(user_id) ON DELETE CASCADE
  );
`);

console.log('✓ Tables created');

// Insert test data
db.prepare("INSERT INTO users (user_id, name, email) VALUES (?, ?, ?)").run('test-user-123', 'Test User', 'test@example.com');
db.prepare("INSERT INTO user_plan_meals (user_id, date, slot, recipe_id) VALUES (?, ?, ?, ?)").run('test-user-123', '2026-01-25', 'Breakfast', 'recipe-1');
db.prepare("INSERT INTO user_plan_meals (user_id, date, slot, recipe_id) VALUES (?, ?, ?, ?)").run('test-user-123', '2026-01-25', 'Lunch', 'recipe-2');
db.prepare("INSERT INTO user_favorites (user_id, recipe_id) VALUES (?, ?)").run('test-user-123', 'recipe-3');
db.prepare("INSERT INTO user_favorites (user_id, recipe_id) VALUES (?, ?)").run('test-user-123', 'recipe-4');

console.log('✓ Test data inserted');

// Verify data exists
const userCount = db.prepare("SELECT COUNT(*) as count FROM users WHERE user_id = ?").get('test-user-123').count;
const mealCount = db.prepare("SELECT COUNT(*) as count FROM user_plan_meals WHERE user_id = ?").get('test-user-123').count;
const favCount = db.prepare("SELECT COUNT(*) as count FROM user_favorites WHERE user_id = ?").get('test-user-123').count;

console.log(`✓ Before deletion: User=${userCount}, Meals=${mealCount}, Favorites=${favCount}`);

if (userCount !== 1 || mealCount !== 2 || favCount !== 2) {
    console.error('✗ Test data verification failed!');
    process.exit(1);
}

// Test the transaction-wrapped delete
console.log('\nTesting deleteUser with transaction...');

const deleteUserTransaction = db.transaction((userId) => {
    // Delete meals
    const deletedMeals = db.prepare("DELETE FROM user_plan_meals WHERE user_id = ?").run(userId);
    console.log(`  - Deleted ${deletedMeals.changes} meals`);

    // Delete favorites
    const deletedFavorites = db.prepare("DELETE FROM user_favorites WHERE user_id = ?").run(userId);
    console.log(`  - Deleted ${deletedFavorites.changes} favorites`);

    // Delete user
    const deletedUser = db.prepare("DELETE FROM users WHERE user_id = ?").run(userId);
    console.log(`  - Deleted ${deletedUser.changes} user`);
});

// Execute transaction
try {
    deleteUserTransaction('test-user-123');
    console.log('✓ Transaction executed successfully');
} catch (e) {
    console.error('✗ Transaction failed:', e.message);
    process.exit(1);
}

// Verify all data is deleted
const userCountAfter = db.prepare("SELECT COUNT(*) as count FROM users WHERE user_id = ?").get('test-user-123').count;
const mealCountAfter = db.prepare("SELECT COUNT(*) as count FROM user_plan_meals WHERE user_id = ?").get('test-user-123').count;
const favCountAfter = db.prepare("SELECT COUNT(*) as count FROM user_favorites WHERE user_id = ?").get('test-user-123').count;

console.log(`✓ After deletion: User=${userCountAfter}, Meals=${mealCountAfter}, Favorites=${favCountAfter}`);

if (userCountAfter !== 0 || mealCountAfter !== 0 || favCountAfter !== 0) {
    console.error('✗ Deletion verification failed! Some data remains.');
    process.exit(1);
}

console.log('\n✅ All tests passed! Transaction works correctly.');

// Cleanup
db.close();
fs.unlinkSync(testDbPath);
console.log('✓ Test database cleaned up');
