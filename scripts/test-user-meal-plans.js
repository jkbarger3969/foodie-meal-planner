#!/usr/bin/env node

/**
 * Test script for multi-user meal plan API functions
 * Tests: getUserPlanMeals, upsertUserPlanMeal, deleteUserPlanMeal
 */

const path = require('path');
const Database = require('better-sqlite3');

const dbPath = path.join(__dirname, '..', 'data', 'foodie.sqlite');
const db = new Database(dbPath);

// Import API functions
const { handleApiCall } = require('../src/main/api.js');

console.log('=== Multi-User Meal Plans API Test ===\n');

async function runTests() {
  try {
    // Check if user_plan_meals table exists
    const tableCheck = db.prepare(`
      SELECT name FROM sqlite_master WHERE type='table' AND name='user_plan_meals'
    `).get();
    
    if (!tableCheck) {
      console.log('❌ user_plan_meals table does not exist yet.');
      console.log('   Please run migration script first: node scripts/migrate-user-meal-plans.js\n');
      process.exit(1);
    }
    
    console.log('✅ user_plan_meals table exists\n');
    
    // Get Whole Family user
    const wholeFamilyUser = db.prepare("SELECT user_id, name FROM users WHERE name = 'Whole Family'").get();
    if (!wholeFamilyUser) {
      console.log('❌ Whole Family user not found in database\n');
      process.exit(1);
    }
    
    console.log(`✅ Whole Family user found: ${wholeFamilyUser.user_id}\n`);
    
    // Get another user (if exists)
    const otherUser = db.prepare("SELECT user_id, name FROM users WHERE name != 'Whole Family' LIMIT 1").get();
    const testUserId = otherUser ? otherUser.user_id : wholeFamilyUser.user_id;
    console.log(`Using test user: ${otherUser ? otherUser.name : 'Whole Family'} (${testUserId})\n`);
    
    // Test 1: getUserPlanMeals - empty result
    console.log('Test 1: getUserPlanMeals with no meals');
    const emptyResult = await handleApiCall({
      fn: 'getUserPlanMeals',
      payload: {
        userId: testUserId,
        start: '2025-01-01',
        end: '2025-01-07'
      }
    });
    
    if (emptyResult.ok) {
      console.log(`✅ Success: Returned ${emptyResult.plans.length} days`);
      console.log(`   Whole Family View: ${emptyResult.isWholeFamilyView}`);
    } else {
      console.log(`❌ Failed: ${emptyResult.error}`);
    }
    console.log('');
    
    // Test 2: upsertUserPlanMeal - create new meal
    console.log('Test 2: Create a test meal for tomorrow');
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const testDate = tomorrow.toISOString().split('T')[0];
    
    const createResult = await handleApiCall({
      fn: 'upsertUserPlanMeal',
      payload: {
        userId: testUserId,
        date: testDate,
        slot: 'Breakfast',
        meal: {
          Title: 'Test Breakfast',
          RecipeId: null,
          UseLeftovers: 0,
          From: '',
          SortOrder: 0
        }
      }
    });
    
    if (createResult.ok) {
      console.log(`✅ Success: Created meal with ID ${createResult.id}`);
      const mealId = createResult.id;
      
      // Test 3: getUserPlanMeals - should now return the meal
      console.log('');
      console.log('Test 3: Retrieve the created meal');
      const retrieveResult = await handleApiCall({
        fn: 'getUserPlanMeals',
        payload: {
          userId: testUserId,
          start: testDate,
          end: testDate
        }
      });
      
      if (retrieveResult.ok && retrieveResult.plans.length > 0) {
        const plan = retrieveResult.plans[0];
        if (plan.Breakfast.length > 0 && plan.Breakfast[0].Title === 'Test Breakfast') {
          console.log(`✅ Success: Retrieved meal "${plan.Breakfast[0].Title}"`);
          console.log(`   Meal ID: ${plan.Breakfast[0].id}`);
          console.log(`   User ID: ${plan.Breakfast[0].userId}`);
          console.log(`   Is Fallback: ${plan.Breakfast[0].IsFallback}`);
        } else {
          console.log(`❌ Failed: Meal not found in results`);
        }
      } else {
        console.log(`❌ Failed: ${retrieveResult.error || 'No plans returned'}`);
      }
      console.log('');
      
      // Test 4: Update the meal
      console.log('Test 4: Update the meal title');
      const updateResult = await handleApiCall({
        fn: 'upsertUserPlanMeal',
        payload: {
          userId: testUserId,
          date: testDate,
          slot: 'Breakfast',
          meal: {
            id: mealId,
            Title: 'Updated Test Breakfast',
            RecipeId: null,
            UseLeftovers: 0,
            From: '',
            SortOrder: 0
          }
        }
      });
      
      if (updateResult.ok) {
        console.log(`✅ Success: Updated meal ID ${updateResult.id}`);
      } else {
        console.log(`❌ Failed: ${updateResult.error}`);
      }
      console.log('');
      
      // Test 5: Delete the meal
      console.log('Test 5: Delete the test meal');
      const deleteResult = await handleApiCall({
        fn: 'deleteUserPlanMeal',
        payload: {
          mealId: mealId,
          userId: testUserId
        }
      });
      
      if (deleteResult.ok && deleteResult.deleted) {
        console.log(`✅ Success: Deleted meal`);
        console.log(`   Deleted meal date: ${deleteResult.meal.date}`);
        console.log(`   Deleted meal slot: ${deleteResult.meal.slot}`);
      } else {
        console.log(`❌ Failed: ${deleteResult.error || 'Delete returned false'}`);
      }
      console.log('');
      
      // Test 6: Verify deletion
      console.log('Test 6: Verify meal was deleted');
      const verifyResult = await handleApiCall({
        fn: 'getUserPlanMeals',
        payload: {
          userId: testUserId,
          start: testDate,
          end: testDate
        }
      });
      
      if (verifyResult.ok) {
        const plan = verifyResult.plans[0];
        if (plan.Breakfast.length === 0) {
          console.log(`✅ Success: Meal successfully deleted`);
        } else {
          console.log(`❌ Failed: Meal still exists after deletion`);
        }
      } else {
        console.log(`❌ Failed: ${verifyResult.error}`);
      }
      console.log('');
      
    } else {
      console.log(`❌ Failed: ${createResult.error}`);
      console.log('');
    }
    
    // Test 7: buildShoppingList with user_plan_meals
    console.log('Test 7: Test buildShoppingList with user_plan_meals');
    const shoppingResult = await handleApiCall({
      fn: 'buildShoppingList',
      payload: {
        userId: testUserId,
        start: '2025-01-01',
        end: '2025-01-07'
      }
    });
    
    if (shoppingResult.ok) {
      console.log(`✅ Success: Generated shopping list`);
      console.log(`   Store groups: ${shoppingResult.groups.length}`);
    } else {
      console.log(`❌ Failed: ${shoppingResult.error}`);
    }
    console.log('');
    
    console.log('=== All Tests Complete ===\n');
    
  } catch (error) {
    console.error('❌ Test error:', error);
    console.error(error.stack);
  } finally {
    db.close();
  }
}

runTests();
