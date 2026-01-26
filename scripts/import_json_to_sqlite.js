const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const Database = require('better-sqlite3');

/**
 * Electron-safe Firestore JSON → SQLite importer (robust against export shape differences)
 * Must be executed using Electron's Node runtime (via: `npm run import`)
 */

function ensureDir(p) {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
}

function openDb(dbPath) {
  ensureDir(path.dirname(dbPath));
  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  return db;
}

function createSchema(db) {
  db.exec(`
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS stores (
      StoreId TEXT PRIMARY KEY,
      Name TEXT,
      Priority INTEGER
    );

    CREATE TABLE IF NOT EXISTS recipes (
      RecipeId TEXT PRIMARY KEY,
      Title TEXT,
      TitleLower TEXT,
      URL TEXT,
      Cuisine TEXT,
      MealType TEXT,
      Notes TEXT,
      Instructions TEXT
    );

    CREATE TABLE IF NOT EXISTS ingredients (
      RecipeId TEXT,
      idx INTEGER,
      IngredientRaw TEXT,
      IngredientNorm TEXT,
      QtyText TEXT,
      QtyNum REAL,
      Unit TEXT,
      StoreId TEXT,
      Notes TEXT,
      PRIMARY KEY (RecipeId, idx),
      FOREIGN KEY (RecipeId) REFERENCES recipes(RecipeId) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS plans (
      Date TEXT PRIMARY KEY,
      Breakfast TEXT,
      Lunch TEXT,
      Dinner TEXT
    );

    CREATE TABLE IF NOT EXISTS pantry (
      ItemId TEXT PRIMARY KEY,
      Name TEXT,
      QtyText TEXT,
      StoreId TEXT,
      Notes TEXT
    );
  `);
}

// ---------- Normalizers (accept a variety of export formats) ----------
function asArray(v) {
  if (!v) return [];
  if (Array.isArray(v)) return v;
  // common wrapper: { items: [...] } or { documents: [...] }
  if (typeof v === 'object') {
    if (Array.isArray(v.items)) return v.items;
    if (Array.isArray(v.documents)) return v.documents;
  }
  return [];
}

function slugify(s) {
  return String(s || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

function stableIdFromName(prefix, name) {
  const base = slugify(name);
  if (base) return base;
  const h = crypto.createHash('sha1').update(String(name || '')).digest('hex').slice(0, 10);
  return `${prefix}_${h}`;
}

function pick(obj, keys, fallback = '') {
  for (const k of keys) {
    if (obj && Object.prototype.hasOwnProperty.call(obj, k) && obj[k] !== undefined && obj[k] !== null && obj[k] !== '') {
      return obj[k];
    }
  }
  return fallback;
}

function normalizeStore(raw) {
  const StoreId = String(pick(raw, ['StoreId','storeId','storeID','id','Id','docId'], '') || '').trim();
  const Name = String(pick(raw, ['Name','name','storeName','title'], '') || '').trim();
  const PriorityRaw = pick(raw, ['Priority','priority'], null);
  const Priority = (PriorityRaw === null || PriorityRaw === '' || PriorityRaw === undefined) ? null : Number(PriorityRaw);

  // If StoreId missing, derive from name (stable)
  const finalId = StoreId || stableIdFromName('store', Name || 'store');

  return { StoreId: finalId, Name, Priority: Number.isFinite(Priority) ? Priority : null };
}

function normalizeRecipe(raw) {
  const RecipeId = String(pick(raw, ['RecipeId','recipeId','id','Id','docId'], '') || '').trim();
  const Title = String(pick(raw, ['Title','title','name'], '') || '').trim();
  const TitleLower = String(pick(raw, ['TitleLower','titleLower'], '') || '').trim() || (Title ? Title.toLowerCase() : '');
  const URL = String(pick(raw, ['URL','Url','url'], '') || '').trim();
  const Cuisine = String(pick(raw, ['Cuisine','cuisine'], '') || '').trim();
  const MealType = String(pick(raw, ['MealType','mealType'], 'Any') || 'Any').trim() || 'Any';
  const Notes = String(pick(raw, ['Notes','notes'], '') || '');
  const Instructions = String(pick(raw, ['Instructions','instructions'], '') || '');

  const finalId = RecipeId || stableIdFromName('rec', Title || 'recipe');
  return { RecipeId: finalId, Title, TitleLower, URL, Cuisine, MealType, Notes, Instructions };
}

function normalizeIngredient(raw) {
  const RecipeId = String(pick(raw, ['RecipeId','recipeId','rid'], '') || '').trim();
  const idxRaw = pick(raw, ['idx','Idx','index'], 0);
  const idx = Number.isFinite(Number(idxRaw)) ? Number(idxRaw) : 0;

  const IngredientRaw = String(pick(raw, ['IngredientRaw','ingredientRaw','raw','Ingredient'], '') || '').trim();
  const IngredientNorm = String(pick(raw, ['IngredientNorm','ingredientNorm','norm'], '') || '').trim() || (IngredientRaw ? IngredientRaw.toLowerCase() : '');
  const QtyText = String(pick(raw, ['QtyText','qtyText'], '') || '').trim();
  const QtyNumRaw = pick(raw, ['QtyNum','qtyNum'], null);
  const QtyNum = (QtyNumRaw === null || QtyNumRaw === '' || QtyNumRaw === undefined) ? null : Number(QtyNumRaw);
  const Unit = String(pick(raw, ['Unit','unit'], '') || '').trim();
  const StoreId = String(pick(raw, ['StoreId','storeId'], '') || '').trim();
  const Notes = String(pick(raw, ['Notes','notes'], '') || '').trim();

  return {
    RecipeId,
    idx,
    IngredientRaw,
    IngredientNorm,
    QtyText,
    QtyNum: Number.isFinite(QtyNum) ? QtyNum : null,
    Unit,
    StoreId,
    Notes
  };
}

function normalizePlan(raw) {
  const Date = String(pick(raw, ['Date','date','id'], '') || '').trim();
  const Breakfast = raw && raw.Breakfast !== undefined ? JSON.stringify(raw.Breakfast || null) : JSON.stringify(null);
  const Lunch = raw && raw.Lunch !== undefined ? JSON.stringify(raw.Lunch || null) : JSON.stringify(null);
  const Dinner = raw && raw.Dinner !== undefined ? JSON.stringify(raw.Dinner || null) : JSON.stringify(null);
  return { Date, Breakfast, Lunch, Dinner };
}

function normalizePantry(raw) {
  const ItemId = String(pick(raw, ['ItemId','itemId','id','Id','docId'], '') || '').trim();
  const Name = String(pick(raw, ['Name','name'], '') || '').trim();
  const QtyText = String(pick(raw, ['QtyText','qtyText'], '') || '').trim();
  const StoreId = String(pick(raw, ['StoreId','storeId'], '') || '').trim();
  const Notes = String(pick(raw, ['Notes','notes'], '') || '').trim();

  const finalId = ItemId || stableIdFromName('pan', Name || 'item');
  return { ItemId: finalId, Name, QtyText, StoreId, Notes };
}

function detectTopLevel(raw) {
  // Accept either:
  // - { stores: [...], recipes: [...], ingredients: [...], plans: [...], pantry: [...] }
  // - { data: { ... } }
  // - { export: { ... } }
  if (!raw || typeof raw !== 'object') return {};
  if (raw.stores || raw.recipes || raw.ingredients || raw.plans || raw.pantry) return raw;
  if (raw.data && (raw.data.stores || raw.data.recipes)) return raw.data;
  if (raw.export && (raw.export.stores || raw.export.recipes)) return raw.export;
  return raw;
}

async function run({ input, db }) {
  console.log('📥 Import starting');
  console.log('   JSON:', input);
  console.log('   DB  :', db);

  if (!fs.existsSync(input)) {
    throw new Error(`Input file not found: ${input}`);
  }

  const rawFile = JSON.parse(fs.readFileSync(input, 'utf8'));
  const raw = detectTopLevel(rawFile);

  const dbh = openDb(db);
  createSchema(dbh);

  const insertStore = dbh.prepare(`
    INSERT OR REPLACE INTO stores (StoreId, Name, Priority)
    VALUES (@StoreId, @Name, @Priority)
  `);

  const insertRecipe = dbh.prepare(`
    INSERT OR REPLACE INTO recipes
    (RecipeId, Title, TitleLower, URL, Cuisine, MealType, Notes, Instructions)
    VALUES (@RecipeId, @Title, @TitleLower, @URL, @Cuisine, @MealType, @Notes, @Instructions)
  `);

  const insertIngredient = dbh.prepare(`
    INSERT OR REPLACE INTO ingredients
    (RecipeId, idx, IngredientRaw, IngredientNorm, QtyText, QtyNum, Unit, StoreId, Notes)
    VALUES (@RecipeId, @idx, @IngredientRaw, @IngredientNorm, @QtyText, @QtyNum, @Unit, @StoreId, @Notes)
  `);

  const insertPlan = dbh.prepare(`
    INSERT OR REPLACE INTO plans
    (Date, Breakfast, Lunch, Dinner)
    VALUES (@Date, @Breakfast, @Lunch, @Dinner)
  `);

  const insertPantry = dbh.prepare(`
    INSERT OR REPLACE INTO pantry
    (ItemId, Name, QtyText, StoreId, Notes)
    VALUES (@ItemId, @Name, @QtyText, @StoreId, @Notes)
  `);

  const stores = asArray(raw.stores).map(normalizeStore).filter(s => s && s.StoreId);
  const recipes = asArray(raw.recipes).map(normalizeRecipe).filter(r => r && r.RecipeId);
  const ingredients = asArray(raw.ingredients).map(normalizeIngredient).filter(i => i && i.RecipeId && i.IngredientRaw);
  const plans = asArray(raw.plans).map(normalizePlan).filter(p => p && p.Date);
  const pantry = asArray(raw.pantry).map(normalizePantry).filter(p => p && p.ItemId);

  // Helpful counts
  console.log(`   Parsed: stores=${stores.length}, recipes=${recipes.length}, ingredients=${ingredients.length}, plans=${plans.length}, pantry=${pantry.length}`);

  const tx = dbh.transaction(() => {
    for (const s of stores) insertStore.run(s);
    for (const r of recipes) insertRecipe.run(r);
    for (const i of ingredients) insertIngredient.run(i);
    for (const p of plans) insertPlan.run(p);
    for (const it of pantry) insertPantry.run(it);
  });

  tx();
  dbh.close();

  console.log('✅ Import completed successfully');
}

module.exports = { run };