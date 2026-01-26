#!/usr/bin/env node

/**
 * Fix ingredient quantities that were incorrectly parsed
 * Specifically fixes fractions like "2/3" that were parsed as "2"
 */

const path = require('path');
const Database = require('better-sqlite3');

const dbPath = process.argv[2] || path.join(__dirname, '..', 'data', 'foodie.sqlite');
const db = new Database(dbPath);

console.log('Fixing ingredient quantities in:', dbPath);

// Copy the parseFraction_ function from api.js
function parseFraction(str) {
  const s = String(str || '').trim();
  
  // Mixed fraction: "1 1/2"
  const mixedMatch = s.match(/^(\d+)\s+(\d+)\/(\d+)$/);
  if (mixedMatch) {
    const whole = parseFloat(mixedMatch[1]);
    const num = parseFloat(mixedMatch[2]);
    const denom = parseFloat(mixedMatch[3]);
    if (denom !== 0) return whole + (num / denom);
  }
  
  // Simple fraction: "1/2"
  const fracMatch = s.match(/^(\d+)\/(\d+)$/);
  if (fracMatch) {
    const denom = parseFloat(fracMatch[2]);
    if (denom !== 0) return parseFloat(fracMatch[1]) / denom;
  }
  
  // Decimal or whole number
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : null;
}

// Re-parse IngredientRaw to extract correct QtyText and QtyNum
function reParseIngredient(ingredientRaw) {
  const text = String(ingredientRaw || '').trim();
  if (!text) return null;
  
  // Use the FIXED regex pattern - fraction patterns FIRST
  const qtyPattern = /^(\d+\s+\d+\/\d+|\d+\/\d+|\d+(?:\.\d+)?)(?:\s*(?:to|-)\s*(\d+\s+\d+\/\d+|\d+\/\d+|\d+(?:\.\d+)?))?/;
  const unitPattern = /(teaspoons?|tablespoons?|cups?|ounces?|pounds?|lbs?|grams?|kilograms?|milliliters?|liters?|tsp|tbsp|oz|lb|g|kg|ml|l|pinch|dash|cloves?|cans?|jars?|packages?|pkgs?|bunches?|slices?|pieces?|whole|medium|large|small)\b/i;
  
  const match = text.match(qtyPattern);
  if (!match) return null;
  
  const qty1 = match[1];
  const qty2 = match[2];
  
  // Parse first quantity
  const qtyNum = parseFraction(qty1);
  
  // Build qtyText
  let qtyText = qty2 ? `${qty1} to ${qty2}` : qty1;
  
  // Extract unit
  const remainder = text.substring(match[0].length).trim();
  const unitMatch = remainder.match(unitPattern);
  if (unitMatch) {
    qtyText = `${qtyText} ${unitMatch[1]}`;
  }
  
  return { qtyNum, qtyText };
}

// Get all ingredients
const ingredients = db.prepare('SELECT RecipeId, idx, IngredientRaw, QtyText, QtyNum FROM ingredients').all();

console.log(`Found ${ingredients.length} ingredients to check`);

let fixed = 0;
let skipped = 0;

for (const ing of ingredients) {
  const parsed = reParseIngredient(ing.IngredientRaw);
  
  if (!parsed) {
    skipped++;
    continue;
  }
  
  // Check if the current values are wrong
  const currentQtyNum = Number(ing.QtyNum);
  const currentQtyText = String(ing.QtyText || '').trim();
  
  const needsUpdate = (
    parsed.qtyNum !== null && 
    Math.abs(currentQtyNum - parsed.qtyNum) > 0.01
  ) || (
    parsed.qtyText && 
    currentQtyText !== parsed.qtyText
  );
  
  if (needsUpdate) {
    console.log(`\nFixing: ${ing.IngredientRaw}`);
    console.log(`  Old QtyNum: ${currentQtyNum} -> New: ${parsed.qtyNum}`);
    console.log(`  Old QtyText: "${currentQtyText}" -> New: "${parsed.qtyText}"`);
    
    db.prepare(`
      UPDATE ingredients 
      SET QtyNum = ?, QtyText = ?
      WHERE RecipeId = ? AND idx = ?
    `).run(parsed.qtyNum, parsed.qtyText, ing.RecipeId, ing.idx);
    
    fixed++;
  }
}

console.log(`\n✅ Fixed ${fixed} ingredients`);
console.log(`   Skipped ${skipped} (no quantity info)`);
console.log(`   Checked ${ingredients.length} total`);

db.close();
