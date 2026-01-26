#!/usr/bin/env node

/**
 * Test shopping list generation after ingredient normalization fixes
 */

const path = require('path');
const apiPath = path.join(__dirname, '..', 'src', 'main', 'api.js');
const api = require(apiPath);

(async () => {
  console.log('🧪 Testing shopping list generation...\n');

  // Test with a date range that has meal plans
  const payload = {
    start: '2026-01-20',
    end: '2026-01-24',
    excludeLeftovers: false,
    includeLowStock: false
  };

  console.log(`Date range: ${payload.start} to ${payload.end}\n`);

  const result = await api.handleApiCall({ fn: 'buildShoppingList', payload });

  if (!result.ok) {
    console.error('❌ Error:', result.error);
    process.exit(1);
  }

  const groups = result.groups || [];
  console.log(`✅ Generated shopping list with ${groups.length} store(s)\n`);

  if (groups.length === 0) {
    console.log('⚠️  No items in shopping list. This could mean:');
    console.log('   - No recipes in the date range');
    console.log('   - All ingredients subtracted by pantry');
    console.log('   - Date range has no meal plans');
    process.exit(0);
  }

  for (const group of groups) {
    console.log('═'.repeat(80));
    console.log(`Store: ${group.StoreId || 'Unassigned'}`);
    console.log('═'.repeat(80));
    
    const items = group.Items || [];
    console.log(`Items: ${items.length}\n`);
    
    // Group by category for display
    const byCategory = {};
    for (const item of items) {
      const cat = item.Category || 'Other';
      if (!byCategory[cat]) byCategory[cat] = [];
      byCategory[cat].push(item);
    }
    
    const categories = Object.keys(byCategory).sort();
    
    for (const cat of categories) {
      console.log(`\n  ${cat}:`);
      console.log('  ' + '─'.repeat(76));
      
      for (const item of byCategory[cat].slice(0, 5)) { // Show max 5 per category
        const qty = item.QtyNum !== null && item.QtyNum !== undefined && Number.isFinite(item.QtyNum)
          ? item.QtyNum.toFixed(2)
          : 'n/a';
        const unit = item.Unit || '';
        const name = item.IngredientNorm || 'unknown';
        
        console.log(`    • ${name}`);
        console.log(`      Qty: ${qty} ${unit} | Count: ${item.Count}`);
      }
      
      if (byCategory[cat].length > 5) {
        console.log(`    ... and ${byCategory[cat].length - 5} more`);
      }
    }
    
    console.log('\n');
  }

  console.log('═'.repeat(80));
  console.log('✅ Shopping list test completed successfully!');
  console.log('═'.repeat(80));

  // Verify category preservation
  let totalWithCategories = 0;
  let totalItems = 0;

  for (const group of groups) {
    for (const item of group.Items || []) {
      totalItems++;
      if (item.Category && item.Category !== 'Other') {
        totalWithCategories++;
      }
    }
  }

  console.log(`\nCategory coverage: ${totalWithCategories}/${totalItems} items (${((totalWithCategories/totalItems)*100).toFixed(1)}%)`);

  if (totalWithCategories === 0) {
    console.log('⚠️  Warning: No items have categories assigned. This may indicate a category mapping issue.');
  } else {
    console.log('✅ Categories are properly preserved in shopping list output.');
  }
})();
