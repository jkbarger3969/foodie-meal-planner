#!/usr/bin/env node

/**
 * Analyze scraped recipes to see what meal types were detected
 * 
 * Usage:
 *   node scripts/analyze-meal-types.js
 */

const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.resolve(__dirname, '../data/foodie-scraped.sqlite');

console.log('========================================');
console.log('📊 MEAL TYPE ANALYSIS');
console.log('========================================');
console.log(`Database: ${dbPath}\n`);

try {
  const db = new Database(dbPath, { readonly: true });
  
  // Total recipes
  const total = db.prepare('SELECT COUNT(*) as count FROM recipes').get();
  console.log(`Total Recipes: ${total.count}\n`);
  
  // Meal types distribution
  console.log('Meal Type Distribution:');
  console.log('─────────────────────────────────────');
  const mealTypes = db.prepare(`
    SELECT MealType, COUNT(*) as count 
    FROM recipes 
    GROUP BY MealType 
    ORDER BY count DESC
  `).all();
  
  mealTypes.forEach(mt => {
    const percentage = ((mt.count / total.count) * 100).toFixed(1);
    const bar = '█'.repeat(Math.floor(percentage / 2));
    console.log(`${mt.MealType.padEnd(15)} ${mt.count.toString().padStart(5)} (${percentage.toString().padStart(5)}%) ${bar}`);
  });
  
  console.log('\n');
  
  // Sample recipes per meal type
  console.log('Sample Recipes by Meal Type:');
  console.log('─────────────────────────────────────');
  
  for (const mt of mealTypes) {
    console.log(`\n${mt.MealType} (${mt.count} recipes):`);
    const samples = db.prepare(`
      SELECT Title, Cuisine, Source 
      FROM recipes 
      WHERE MealType = ? 
      LIMIT 3
    `).all(mt.MealType);
    
    samples.forEach((s, i) => {
      console.log(`  ${i+1}. ${s.Title} [${s.Cuisine || 'Unknown'}] - ${s.Source}`);
    });
  }
  
  console.log('\n');
  
  // Recommendations
  console.log('========================================');
  console.log('📝 RECOMMENDATIONS');
  console.log('========================================');
  
  const uniqueMealTypes = mealTypes.map(mt => mt.MealType);
  const appMealTypes = ['Any', 'Breakfast', 'Lunch', 'Dinner', 'Side Dish', 'Dessert'];
  const newMealTypes = uniqueMealTypes.filter(mt => !appMealTypes.includes(mt));
  
  if (newMealTypes.length > 0) {
    console.log('\n🆕 New meal types found that are NOT in the app UI:');
    newMealTypes.forEach(mt => {
      const count = mealTypes.find(m => m.MealType === mt).count;
      console.log(`   - ${mt} (${count} recipes)`);
    });
    console.log('\nTo add these to your app, update:');
    console.log('   1. src/renderer/index.html - Recipe editor dropdown (#rMealType)');
    console.log('   2. src/renderer/index.html - Import preview dropdown (#importPreviewMealType)');
    console.log('   3. Consider: Meal planner slots (currently only Breakfast/Lunch/Dinner)');
  } else {
    console.log('\n✅ All meal types are already supported in the app UI.');
  }
  
  // Check for 'Any' category
  const anyCount = mealTypes.find(mt => mt.MealType === 'Any');
  if (anyCount && anyCount.count > 0) {
    const percentage = ((anyCount.count / total.count) * 100).toFixed(1);
    console.log(`\n⚠️  ${anyCount.count} recipes (${percentage}%) are categorized as "Any"`);
    console.log('   These recipes did not match any meal type pattern.');
    console.log('   You may want to:');
    console.log('   1. Review sample "Any" recipes and add more keywords to detectMealType()');
    console.log('   2. Manually categorize these recipes in the app');
    console.log('   3. Add more specific detection patterns');
  }
  
  console.log('\n========================================\n');
  
  db.close();
  
} catch (err) {
  console.error('Error:', err.message);
  console.error('\nMake sure you have run the scraper first!');
  process.exit(1);
}
