#!/usr/bin/env node

/**
 * Fix ingredient normalization issues
 * Re-parses ingredients with empty or invalid IngredientNorm values
 */

const path = require('path');
const Database = require('better-sqlite3');

// Load the API module to use parseIngredientLine
const apiPath = path.join(__dirname, '..', 'src', 'main', 'api.js');
const api = require(apiPath);

const dbPath = path.join(__dirname, '..', 'data', 'foodie.sqlite');
const db = new Database(dbPath);

console.log('🔍 Finding problematic ingredients...\n');

// Find ingredients with issues
const problematic = db.prepare(`
  SELECT RecipeId, idx, IngredientRaw, IngredientNorm, IngredientName
  FROM ingredients
  WHERE IngredientNorm IS NULL 
     OR IngredientNorm = ''
     OR LENGTH(IngredientNorm) < 2
     OR IngredientNorm LIKE ')%'
     OR IngredientNorm LIKE '.%'
     OR IngredientNorm LIKE '/%'
     OR IngredientNorm LIKE '-%'
     OR IngredientNorm LIKE '&%'
     OR IngredientNorm LIKE ';%'
     OR IngredientNorm LIKE '+%'
     OR IngredientNorm LIKE '*%'
     OR IngredientNorm LIKE ':%'
     OR IngredientNorm LIKE ',%'
     OR IngredientNorm LIKE '|%'
     OR IngredientNorm LIKE '%&nbsp;%'
     OR IngredientNorm LIKE '%&amp;%'
     OR IngredientNorm GLOB '*[)]'
     OR substr(IngredientNorm, 1, 1) NOT GLOB '[a-z0-9]'
  ORDER BY RecipeId, idx
`).all();

console.log(`Found ${problematic.length} ingredients with normalization issues\n`);

if (problematic.length === 0) {
  console.log('✅ No issues found!');
  db.close();
  process.exit(0);
}

// Show sample before fixing
console.log('Sample issues (first 10):');
console.log('─'.repeat(100));
for (const ing of problematic.slice(0, 10)) {
  console.log(`Raw: "${ing.IngredientRaw}"`);
  console.log(`  → Norm: "${ing.IngredientNorm}" (INVALID)`);
  console.log(`  → Name: "${ing.IngredientName}"`);
  console.log();
}

// Ask for confirmation
const readline = require('readline').createInterface({
  input: process.stdin,
  output: process.stdout
});

readline.question(`\n⚠️  Fix ${problematic.length} ingredients? (y/n): `, (answer) => {
  readline.close();
  
  if (answer.toLowerCase() !== 'y') {
    console.log('Cancelled.');
    db.close();
    process.exit(0);
  }
  
  console.log('\n🔧 Fixing ingredients...\n');
  
  const updateStmt = db.prepare(`
    UPDATE ingredients 
    SET IngredientNorm = ?,
        IngredientName = ?,
        QtyText = ?,
        QtyNum = ?,
        Unit = ?,
        Notes = ?
    WHERE RecipeId = ? AND idx = ?
  `);
  
  let fixed = 0;
  let failed = 0;
  const failures = [];
  
  db.transaction(() => {
    for (const ing of problematic) {
      try {
        // Re-parse the ingredient using the fixed parser
        const parsed = api.parseIngredientLine(ing.IngredientRaw);
        
        if (!parsed || !parsed.IngredientNorm) {
          failed++;
          failures.push({ raw: ing.IngredientRaw, reason: 'Parser returned null/invalid' });
          continue;
        }
        
        // Update the database
        updateStmt.run(
          parsed.IngredientNorm,
          parsed.IngredientName,
          parsed.QtyText,
          parsed.QtyNum,
          parsed.Unit,
          parsed.Notes,
          ing.RecipeId,
          ing.idx
        );
        
        fixed++;
        
        if (fixed % 100 === 0) {
          console.log(`  ✓ Fixed ${fixed}/${problematic.length}...`);
        }
      } catch (err) {
        failed++;
        failures.push({ raw: ing.IngredientRaw, error: err.message });
      }
    }
  })();
  
  console.log('\n' + '═'.repeat(100));
  console.log(`✅ Fixed: ${fixed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log('═'.repeat(100));
  
  if (failures.length > 0 && failures.length <= 20) {
    console.log('\nFailures:');
    for (const f of failures) {
      console.log(`  - "${f.raw}": ${f.reason || f.error}`);
    }
  }
  
  // Verify the fixes
  console.log('\n🔍 Verifying fixes...\n');
  
  const stillProblematic = db.prepare(`
    SELECT COUNT(*) as count
    FROM ingredients
    WHERE IngredientNorm IS NULL 
       OR IngredientNorm = ''
       OR LENGTH(IngredientNorm) < 2
       OR IngredientNorm LIKE ')%'
       OR IngredientNorm LIKE '.%'
       OR IngredientNorm LIKE '/%'
       OR IngredientNorm LIKE '-%'
       OR IngredientNorm LIKE '&%'
       OR IngredientNorm LIKE '%&nbsp;%'
       OR IngredientNorm LIKE '%&amp;%'
       OR substr(IngredientNorm, 1, 1) NOT GLOB '[a-z0-9]'
  `).get();
  
  console.log(`Remaining issues: ${stillProblematic.count}`);
  
  if (stillProblematic.count === 0) {
    console.log('\n✨ All ingredient normalization issues fixed!\n');
  } else {
    console.log(`\n⚠️  ${stillProblematic.count} issues remain. Manual review may be needed.\n`);
  }
  
  // Show sample after fixing
  const samples = db.prepare(`
    SELECT IngredientRaw, IngredientNorm, IngredientName
    FROM ingredients
    WHERE IngredientRaw IN (
      SELECT IngredientRaw FROM ingredients 
      WHERE IngredientRaw LIKE '%(%ounce%)%'
         OR IngredientRaw LIKE '%(%oz%)%'
      LIMIT 5
    )
  `).all();
  
  if (samples.length > 0) {
    console.log('Sample fixed ingredients:');
    console.log('─'.repeat(100));
    for (const s of samples) {
      console.log(`Raw: "${s.IngredientRaw}"`);
      console.log(`  → Norm: "${s.IngredientNorm}"`);
      console.log(`  → Name: "${s.IngredientName}"`);
      console.log();
    }
  }
  
  db.close();
});
