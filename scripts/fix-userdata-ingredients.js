#!/usr/bin/env node
const path = require('path');
const os = require('os');
const Database = require('better-sqlite3');
const api = require(path.join(__dirname, '..', 'src', 'main', 'api.js'));

// Determine which database to fix based on command line argument
const args = process.argv.slice(2);
let dbPath;

if (args.includes('--seed')) {
  dbPath = path.join(__dirname, '..', 'data', 'foodie.sqlite');
  console.log('🔧 Fixing SEED database:', dbPath);
} else if (args.includes('--userdata') || args.length === 0) {
  dbPath = path.join(os.homedir(), 'Library', 'Application Support', 'Foodie Meal Planner', 'foodie.sqlite');
  console.log('🔧 Fixing USERDATA database:', dbPath);
} else {
  console.error('Usage: node fix-userdata-ingredients.js [--seed | --userdata]');
  process.exit(1);
}
console.log();

const db = new Database(dbPath);

const problematic = db.prepare(`SELECT RecipeId, idx, IngredientRaw FROM ingredients ORDER BY RecipeId, idx`).all();

console.log(`Found ${problematic.length} ingredients to process\n`);

const updateStmt = db.prepare(`UPDATE ingredients SET IngredientNorm = ?, IngredientName = ?, QtyText = ?, QtyNum = ?, Unit = ?, Notes = ? WHERE RecipeId = ? AND idx = ?`);

let fixed = 0;
let failed = 0;

console.log('🔧 Re-parsing all ingredients...\n');

db.transaction(() => {
  for (const ing of problematic) {
    try {
      const parsed = api.parseIngredientLine(ing.IngredientRaw);
      if (!parsed || !parsed.IngredientNorm) { failed++; continue; }
      updateStmt.run(parsed.IngredientNorm, parsed.IngredientName, parsed.QtyText, parsed.QtyNum, parsed.Unit, parsed.Notes, ing.RecipeId, ing.idx);
      fixed++;
      if (fixed % 1000 === 0) console.log(`  ✓ ${fixed}/${problematic.length}...`);
    } catch (err) { failed++; }
  }
})();

console.log(`\n✅ Fixed: ${fixed}, ❌ Failed: ${failed}\n`);

const cleanupResult = db.prepare(`UPDATE ingredients SET IngredientNorm = TRIM(REPLACE(REPLACE(REPLACE(IngredientNorm, '(', ''), ')', ''), '  ', ' ')) WHERE IngredientNorm GLOB '*[()]*'`).run();
console.log(`Cleaned ${cleanupResult.changes} with parentheses\n`);

const stats = db.prepare(`SELECT COUNT(*) as total, COUNT(CASE WHEN IngredientNorm GLOB '*[()]*' THEN 1 END) as with_parens, COUNT(CASE WHEN substr(IngredientNorm, 1, 1) NOT GLOB '[a-z0-9]' AND IngredientNorm != '' THEN 1 END) as bad_start FROM ingredients`).get();
console.log(`Final: ${stats.total} total, ${stats.with_parens} with parens, ${stats.bad_start} bad start`);

db.close();
