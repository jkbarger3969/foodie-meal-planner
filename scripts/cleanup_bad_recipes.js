#!/usr/bin/env node
/**
 * cleanup_bad_recipes.js
 * Deletes recipes that are missing Title or Instructions or have zero ingredients.
 * Safe to run repeatedly.
 */
const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');

function die(msg) {
  console.error(msg);
  process.exit(1);
}

function main() {
  const dbArg = process.argv.find(a => a.startsWith('--db='));
  const dbPath = dbArg ? dbArg.slice('--db='.length) : path.resolve(process.cwd(), 'data', 'foodie.sqlite');

  if (!fs.existsSync(dbPath)) die(`DB not found: ${dbPath}`);

  const db = new Database(dbPath);
  db.pragma('foreign_keys = ON');

  // Ensure TitleLower exists and is backfilled for consistency.
  try {
    db.exec(`ALTER TABLE recipes ADD COLUMN TitleLower TEXT;`);
  } catch (_) {}

  const before = db.prepare(`SELECT COUNT(*) AS c FROM recipes`).get().c;

  const tx = db.transaction(() => {
    // 1) Missing/blank Title or Instructions
    const del1 = db.prepare(`
      DELETE FROM recipes
      WHERE Title IS NULL OR trim(Title) = ''
         OR Instructions IS NULL OR trim(Instructions) = ''
    `).run().changes;

    // 2) No ingredients
    const del2 = db.prepare(`
      DELETE FROM recipes
      WHERE RecipeId IN (
        SELECT r.RecipeId
        FROM recipes r
        LEFT JOIN ingredients i ON i.RecipeId = r.RecipeId
        WHERE i.RecipeId IS NULL
      )
    `).run().changes;

    // Re-backfill TitleLower for remaining rows
    db.exec(`
      UPDATE recipes
      SET TitleLower = lower(trim(Title))
      WHERE (TitleLower IS NULL OR TitleLower = '') AND Title IS NOT NULL AND trim(Title) <> '';
    `);

    return { del1, del2 };
  });

  const res = tx();
  const after = db.prepare(`SELECT COUNT(*) AS c FROM recipes`).get().c;

  console.log('✅ Cleanup complete');
  console.log(`DB: ${dbPath}`);
  console.log(`Recipes before: ${before}`);
  console.log(`Deleted (missing Title/Instructions): ${res.del1}`);
  console.log(`Deleted (no ingredients): ${res.del2}`);
  console.log(`Recipes after: ${after}`);

  db.close();
}

main();
