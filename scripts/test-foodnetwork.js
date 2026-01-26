#!/usr/bin/env node

/**
 * Test Food Network scraper against real pages
 */

const FoodNetworkScraper = require('./foodnetwork-scraper.js');
const path = require('path');

async function test() {
  console.log('🧪 Testing Food Network Scraper\n');

  const scraper = new FoodNetworkScraper({
    outputDb: path.resolve(__dirname, '../data/foodie-scraped.sqlite'),
    baseUrl: 'https://www.foodnetwork.com',
    listingUrls: ['/recipes/breakfast'], // Just test one page
    delayBetweenRequests: 2000,
    delayBetweenPages: 3000,
    randomDelayVariance: 1000,
    maxRecipes: 5, // Just scrape 5 recipes for testing
    maxRetriesPerUrl: 3,
    requestTimeout: 30000,
  });

  // Test 1: Fetch category page
  console.log('Test 1: Fetching category page...');
  try {
    const html = await scraper.fetchHtml('https://www.foodnetwork.com/recipes/breakfast');
    
    if (html.includes('Access Denied')) {
      console.log('❌ FAILED: Still getting Access Denied');
      console.log('   The anti-bot measures may need further refinement');
      return;
    }
    
    if (html.includes('recipe')) {
      console.log('✅ PASSED: Successfully fetched page HTML');
      console.log(`   Page length: ${html.length} bytes`);
    } else {
      console.log('⚠️  WARNING: Got response but no recipe content found');
    }

    // Test 2: Extract recipe URLs
    console.log('\nTest 2: Extracting recipe URLs...');
    const urls = scraper.extractRecipeUrls(html, 'https://www.foodnetwork.com');
    console.log(`✅ PASSED: Found ${urls.length} recipe URLs`);
    
    if (urls.length > 0) {
      console.log(`   First URL: ${urls[0]}`);
      
      // Test 3: Fetch a recipe page
      console.log('\nTest 3: Fetching recipe page...');
      const recipeHtml = await scraper.fetchHtml(urls[0]);
      
      if (recipeHtml.includes('Access Denied')) {
        console.log('❌ FAILED: Recipe page blocked');
        return;
      }
      
      console.log('✅ PASSED: Successfully fetched recipe page');
      
      // Test 4: Extract JSON-LD
      console.log('\nTest 4: Extracting JSON-LD data...');
      const jsonLd = scraper.extractJsonLd(recipeHtml);
      
      if (jsonLd.length === 0) {
        console.log('❌ FAILED: No JSON-LD data found');
        return;
      }
      
      console.log(`✅ PASSED: Found ${jsonLd.length} JSON-LD block(s)`);
      
      // Test 5: Parse recipe
      console.log('\nTest 5: Parsing recipe data...');
      const recipe = scraper.parseRecipe(jsonLd[0], urls[0]);
      
      if (!recipe) {
        console.log('❌ FAILED: Could not parse recipe');
        return;
      }
      
      console.log('✅ PASSED: Successfully parsed recipe');
      console.log(`   Name: ${recipe.name}`);
      console.log(`   Cuisine: ${recipe.cuisine}`);
      console.log(`   Meal type: ${recipe.meal_type}`);
      console.log(`   Servings: ${recipe.servings}`);
      console.log(`   Total time: ${recipe.total_time} minutes`);
      console.log(`   Ingredients: ${recipe.ingredients.split('\n').length} items`);
      console.log(`   Instructions: ${recipe.instructions.split('\n').length} steps`);
      
      console.log('\n🎉 ALL TESTS PASSED!');
      console.log('\nThe scraper is ready to run. Execute:');
      console.log('  node scripts/foodnetwork-scraper.js');
      
    } else {
      console.log('⚠️  No recipe URLs found - may need to adjust URL pattern');
    }

  } catch (error) {
    console.log(`❌ FAILED: ${error.message}`);
    console.log('\nTroubleshooting:');
    console.log('1. Check if Food Network changed their site structure');
    console.log('2. Verify network connectivity');
    console.log('3. Try adding more realistic headers or using a proxy');
  }
}

test().catch(console.error);
