#!/usr/bin/env node

/**
 * Migration Script: Fix Unicode Fractions in Database
 * 
 * Problem: ~100 ingredients with unicode fractions (½, ¼, ⅓) were imported
 * before unicode handling was added to parseIngredientLine(). These show
 * QtyNum=1.0 instead of the correct decimal value.
 * 
 * Solution: Re-parse affected ingredients and update the database.
 */

const path = require('path');
const Database = require('better-sqlite3');

const dbPath = path.join(__dirname, '..', 'data', 'foodie.sqlite');
const db = new Database(dbPath);

console.log('🔍 Scanning for ingredients with unicode fractions...\n');

// Find affected ingredients
const affected = db.prepare(`
  SELECT idx, RecipeId, IngredientRaw, QtyNum, QtyText, Unit
  FROM ingredients
  WHERE (IngredientRaw LIKE '%½%' 
     OR IngredientRaw LIKE '%¼%' 
     OR IngredientRaw LIKE '%⅓%'
     OR IngredientRaw LIKE '%⅔%'
     OR IngredientRaw LIKE '%¾%'
     OR IngredientRaw LIKE '%⅛%'
     OR IngredientRaw LIKE '%⅜%'
     OR IngredientRaw LIKE '%⅝%'
     OR IngredientRaw LIKE '%⅞%')
    AND (QtyNum IS NULL OR QtyNum = 1.0)
`).all();

console.log(`Found ${affected.length} ingredients with potential unicode fraction issues\n`);

if (affected.length === 0) {
  console.log('✅ No ingredients need fixing!');
  db.close();
  process.exit(0);
}

// Show sample
console.log('Sample of affected ingredients:');
affected.slice(0, 5).forEach(ing => {
  console.log(`  - "${ing.IngredientRaw}" → QtyNum=${ing.QtyNum}, Unit=${ing.Unit}`);
});
console.log('');

// Import parsing function (simplified version)
function parseFraction(str) {
  const parts = str.split(/\s+/);
  let value = 0;
  
  for (const part of parts) {
    if (part.match(/^\d+$/)) {
      value += parseInt(part, 10);
    } else if (part.match(/^(\d+)\/(\d+)$/)) {
      const [, num, denom] = part.match(/^(\d+)\/(\d+)$/);
      value += parseFloat(num) / parseFloat(denom);
    }
  }
  
  return value || null;
}

function parseIngredientSimple(raw) {
  let text = raw
    .replace(/½/g, '1/2')
    .replace(/¼/g, '1/4')
    .replace(/¾/g, '3/4')
    .replace(/⅓/g, '1/3')
    .replace(/⅔/g, '2/3')
    .replace(/⅛/g, '1/8')
    .replace(/⅜/g, '3/8')
    .replace(/⅝/g, '5/8')
    .replace(/⅞/g, '7/8')
    .trim();
  
  // Try to match quantity at start
  const qtyMatch = text.match(/^(\d+\s+\d+\/\d+|\d+\/\d+|\d+(?:\.\d+)?)/);
  if (!qtyMatch) return null;
  
  const qtyStr = qtyMatch[1];
  const qtyNum = parseFraction(qtyStr);
  
  // Extract unit
  const remainder = text.substring(qtyMatch[0].length).trim();
  const unitMatch = remainder.match(/^(teaspoons?|tablespoons?|cups?|ounces?|pounds?|grams?|kilograms?|milliliters?|liters?|tsps?|tbsps?|oz|lbs?|g|kg|ml|l)\b/i);
  
  let unit = '';
  if (unitMatch) {
    const unitRaw = unitMatch[1].toLowerCase();
    // Simple canonicalization
    if (unitRaw.startsWith('tsp') || unitRaw === 'teaspoon' || unitRaw === 'teaspoons') unit = 'tsp';
    else if (unitRaw.startsWith('tbsp') || unitRaw === 'tablespoon' || unitRaw === 'tablespoons') unit = 'tbsp';
    else if (unitRaw.startsWith('cup')) unit = 'cup';
    else if (unitRaw === 'ounce' || unitRaw === 'ounces' || unitRaw === 'oz') unit = 'oz';
    else if (unitRaw === 'pound' || unitRaw === 'pounds' || unitRaw === 'lb' || unitRaw === 'lbs') unit = 'lb';
    else if (unitRaw === 'gram' || unitRaw === 'grams' || unitRaw === 'g') unit = 'g';
    else if (unitRaw === 'kilogram' || unitRaw === 'kilograms' || unitRaw === 'kg') unit = 'kg';
    else if (unitRaw === 'milliliter' || unitRaw === 'milliliters' || unitRaw === 'ml') unit = 'ml';
    else if (unitRaw === 'liter' || unitRaw === 'liters' || unitRaw === 'l') unit = 'l';
  }
  
  return { qtyNum, qtyText: qtyStr + (unitMatch ? ' ' + unitMatch[1] : ''), unit };
}

// Ask for confirmation
const readline = require('readline');
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

rl.question('Do you want to fix these ingredients? (y/n): ', (answer) => {
  rl.close();
  
  if (answer.toLowerCase() !== 'y') {
    console.log('❌ Migration cancelled');
    db.close();
    process.exit(0);
  }
  
  console.log('\n🔧 Fixing ingredients...\n');
  
  const updateStmt = db.prepare(`
    UPDATE ingredients
    SET QtyNum = ?, QtyText = ?, Unit = ?
    WHERE RecipeId = ? AND idx = ?
  `);
  
  let fixed = 0;
  let skipped = 0;
  
  const transaction = db.transaction(() => {
    for (const ing of affected) {
      const parsed = parseIngredientSimple(ing.IngredientRaw);
      
      if (parsed && parsed.qtyNum !== null && parsed.qtyNum !== 1.0) {
        updateStmt.run(
          parsed.qtyNum,
          parsed.qtyText,
          parsed.unit || ing.Unit,
          ing.RecipeId,
          ing.idx
        );
        fixed++;
        
        if (fixed <= 10) {
          console.log(`  ✓ "${ing.IngredientRaw}"`);
          console.log(`    Before: QtyNum=${ing.QtyNum}, QtyText="${ing.QtyText}", Unit=${ing.Unit}`);
          console.log(`    After:  QtyNum=${parsed.qtyNum}, QtyText="${parsed.qtyText}", Unit=${parsed.unit || ing.Unit}`);
        }
      } else {
        skipped++;
      }
    }
  });
  
  transaction();
  
  console.log(`\n✅ Migration complete!`);
  console.log(`   Fixed: ${fixed} ingredients`);
  console.log(`   Skipped: ${skipped} ingredients (already correct or couldn't parse)`);
  
  db.close();
});
