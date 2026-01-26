/**
 * Firestore export (JSON) for Foodie Meal Planner.
 *
 * Usage:
 *   1) npm i
 *   2) npm i firebase-admin
 *   3) export GOOGLE_APPLICATION_CREDENTIALS="/path/to/serviceAccount.json"
 *   4) node scripts/firestore_export.js --project foodie-meal-planner --out export.json
 *
 * This script reads:
 *   - stores
 *   - recipes
 *   - recipes/{recipeId}/ingredients
 *   - plans
 *   - pantry
 *
 * Notes:
 * - Requires a Service Account with Firestore read access.
 * - If you used Firestore in Native mode (default), this works as-is.
 */
const fs = require('fs');
const path = require('path');

function arg(name, def) {
  const idx = process.argv.indexOf(name);
  if (idx === -1) return def;
  return process.argv[idx + 1] || def;
}

async function main() {
  const projectId = arg('--project', '');
  const outPath = arg('--out', path.join(process.cwd(), 'firestore_export.json'));
  if (!projectId) throw new Error('Missing --project');

  const admin = require('firebase-admin');
  admin.initializeApp({ projectId });
  const db = admin.firestore();

  async function readAll(collName) {
    const snap = await db.collection(collName).get();
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  }

  console.log('Reading stores...');
  const stores = await readAll('stores');

  console.log('Reading recipes...');
  const recipes = await readAll('recipes');

  console.log('Reading ingredients (subcollection) per recipe...');
  const ingredients = [];
  for (let i = 0; i < recipes.length; i++) {
    const rid = recipes[i].id;
    const snap = await db.collection('recipes').doc(rid).collection('ingredients').orderBy('idx', 'asc').get();
    for (const d of snap.docs) {
      ingredients.push({ recipeId: rid, ...d.data() });
    }
    if ((i + 1) % 50 === 0) console.log(`  ...${i + 1}/${recipes.length}`);
  }

  console.log('Reading plans...');
  const plans = await readAll('plans');

  console.log('Reading pantry...');
  const pantry = await readAll('pantry');

  const out = {
    exportedAt: new Date().toISOString(),
    projectId,
    stores,
    recipes,
    ingredients,
    plans,
    pantry
  };

  fs.writeFileSync(outPath, JSON.stringify(out, null, 2), 'utf-8');
  console.log('Wrote', outPath);
}

main().catch((e) => {
  console.error('Export failed:', e);
  process.exit(1);
});
