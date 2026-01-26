const fs = require('fs');
const path = require('path');

let BetterSqlite3 = null;
function _betterSqlite3() {
  if (BetterSqlite3) return BetterSqlite3;
  // better-sqlite3 is a native addon; must be rebuilt for Electron.
  BetterSqlite3 = require('better-sqlite3');
  return BetterSqlite3;
}

let DB_PATH = '';
let DB = null;

function ensureDirForFile(filePath) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function getSeedDbPath_() {
  // Seed DB shipped with the project in development (and optionally alongside packaged app resources).
  // Primary expected location per your repo layout: ./data/foodie.sqlite
  return path.resolve(process.cwd(), 'data', 'foodie.sqlite');
}

function countRecipesSafe_(dbPath) {
  try {
    if (!fs.existsSync(dbPath)) return null;
    const Ctor = _betterSqlite3();
    const tmp = new Ctor(dbPath, { readonly: true });
    try {
      // If table doesn't exist, treat as 0
      const has = tmp.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='recipes'").get();
      if (!has) return 0;
      const row = tmp.prepare("SELECT COUNT(1) AS n FROM recipes").get();
      return Number(row && row.n || 0);
    } finally {
      try { tmp.close(); } catch (_) {}
    }
  } catch (_) {
    return null;
  }
}

function seedUserDataDbIfNeeded_(liveDbPath) {
  // liveDbPath is expected to be userData/foodie.sqlite when Electron is available.
  const seedPath = getSeedDbPath_();
  if (!fs.existsSync(seedPath)) return;

  // If live DB doesn't exist, copy seed.
  if (!fs.existsSync(liveDbPath)) {
    ensureDirForFile(liveDbPath);
    fs.copyFileSync(seedPath, liveDbPath);
    return;
  }

  // If live DB exists but contains no recipes, and seed contains recipes, replace with backup.
  const liveCount = countRecipesSafe_(liveDbPath);
  const seedCount = countRecipesSafe_(seedPath);
  if (liveCount === 0 && seedCount && seedCount > 0) {
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const bak = liveDbPath + `.bak.${stamp}`;
    try { fs.copyFileSync(liveDbPath, bak); } catch (_) {}
    fs.copyFileSync(seedPath, liveDbPath);
  }
}


function getDbPathDefault(app) {
  // Always use Electron's writable userData location as the live database when available.
  // The project-local ./data/foodie.sqlite is treated as a seed that can be copied into userData on first run (or if userData DB is empty).
  let electronApp = app;
  try {
    if (!electronApp) {
      const electron = require('electron');
      if (electron && electron.app) electronApp = electron.app;
    }
  } catch (_) {}

  try {
    if (electronApp && typeof electronApp.getPath === 'function') {
      return path.join(electronApp.getPath('userData'), 'foodie.sqlite');
    }
  } catch (_) {}

  // Fallback (non-Electron contexts): project-local DB
  return path.resolve(process.cwd(), 'data', 'foodie.sqlite');
}

function setDbPath(p) {
  DB_PATH = String(p || '').trim();
  if (DB) {
    try { DB.close(); } catch (_) {}
    DB = null;
  }
}

function _openDb() {
  if (DB) return DB;
  const p = DB_PATH || getDbPathDefault();
  // Seed userData DB from ./data/foodie.sqlite when appropriate.
  try { seedUserDataDbIfNeeded_(p); } catch (_) {}
  ensureDirForFile(p);
  const Ctor = _betterSqlite3();
  DB = new Ctor(p);
  DB.pragma('journal_mode = WAL');
  DB.pragma('foreign_keys = ON');
  migrate(DB);
  return DB;
}

function db() {
  return _openDb();
}

function createDb() {
  _openDb();
  return { ok: true, dbPath: DB_PATH || getDbPathDefault() };
}

function hasColumn(conn, table, column) {
  const rows = conn.prepare(`PRAGMA table_info(${table})`).all();
  return rows.some(r => String(r.name).toLowerCase() === String(column).toLowerCase());
}

function migrate(conn) {
  // Core tables
  conn.exec(`
    CREATE TABLE IF NOT EXISTS recipes (
      RecipeId TEXT PRIMARY KEY,
      Title TEXT,
      TitleLower TEXT,
      URL TEXT,
      Cuisine TEXT,
      MealType TEXT,
      Notes TEXT,
      Instructions TEXT,
      Image_Name TEXT,
      CreatedAt TEXT,
      UpdatedAt TEXT
    );

    CREATE TABLE IF NOT EXISTS ingredients (
      RecipeId TEXT NOT NULL,
      idx INTEGER NOT NULL,
      IngredientNorm TEXT,
      IngredientRaw TEXT,
      Notes TEXT,
      QtyNum REAL,
      QtyText TEXT,
      StoreId TEXT,
      Unit TEXT,
            Category TEXT,
PRIMARY KEY (RecipeId, idx),
      FOREIGN KEY (RecipeId) REFERENCES recipes(RecipeId) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS stores (
      StoreId TEXT PRIMARY KEY,
      Name TEXT,
      Priority INTEGER,
      UpdatedAt TEXT
    );

    CREATE TABLE IF NOT EXISTS plans (
      Date TEXT PRIMARY KEY,
      BreakfastRecipeId TEXT,
      BreakfastTitle TEXT,
      BreakfastUseLeftovers INTEGER DEFAULT 0,
      BreakfastFrom TEXT,
      LunchRecipeId TEXT,
      LunchTitle TEXT,
      LunchUseLeftovers INTEGER DEFAULT 0,
      LunchFrom TEXT,
      DinnerRecipeId TEXT,
      DinnerTitle TEXT,
      DinnerUseLeftovers INTEGER DEFAULT 0,
      DinnerFrom TEXT,
      BreakfastEventId TEXT,
      LunchEventId TEXT,
      DinnerEventId TEXT,
      UpdatedAt TEXT
    );

    CREATE TABLE IF NOT EXISTS pantry (
      ItemId TEXT PRIMARY KEY,
      Name TEXT,
      NameLower TEXT,
      Category TEXT,
      QtyText TEXT,
      QtyNum REAL,
      Unit TEXT,
      StoreId TEXT,
      Notes TEXT,
      expiration_date TEXT,
      low_stock_threshold INTEGER DEFAULT 0,
      is_favorite INTEGER DEFAULT 0,
      UpdatedAt TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_recipes_titlelower ON recipes(TitleLower, RecipeId);
    CREATE INDEX IF NOT EXISTS idx_pantry_namelower ON pantry(NameLower, ItemId);
    CREATE INDEX IF NOT EXISTS idx_ingredients_store_norm ON ingredients(StoreId, IngredientNorm);
  `);
  // Ensure store names are unique (case/whitespace-insensitive) before creating a unique index.
  // Older DBs may contain duplicates like "Costco" vs " costco ".
  try {
    // De-duplicate store rows
    const dups = conn
      .prepare(`
        SELECT lower(trim(Name)) AS k,
               MIN(StoreId)      AS keepId,
               GROUP_CONCAT(StoreId) AS allIds,
               COUNT(*)          AS c
          FROM stores
         WHERE Name IS NOT NULL AND trim(Name) <> ''
         GROUP BY lower(trim(Name))
        HAVING COUNT(*) > 1
      `)
      .all();

    for (const row of dups) {
      const ids = String(row.allIds || '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);

      const keepId = row.keepId;
      const removeIds = ids.filter((id) => id !== keepId);
      if (!removeIds.length) continue;

      // Re-point references
      conn
        .prepare(`UPDATE ingredients SET StoreId = ? WHERE StoreId IN (${removeIds.map(() => '?').join(',')})`)
        .run(keepId, ...removeIds);
      conn
        .prepare(`UPDATE pantry SET StoreId = ? WHERE StoreId IN (${removeIds.map(() => '?').join(',')})`)
        .run(keepId, ...removeIds);

      // Remove duplicates
      conn
        .prepare(`DELETE FROM stores WHERE StoreId IN (${removeIds.map(() => '?').join(',')})`)
        .run(...removeIds);
    }

    // Now enforce uniqueness going forward
    conn.exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_stores_name_lower ON stores(lower(trim(Name)));`);
  } catch (e) {
    // If anything goes wrong here, do not fail bootstrap; the app can still run.
    // Logging is helpful during development.
    // eslint-disable-next-line no-console
    console.warn('Store de-duplication / unique-index migration warning:', e && e.message ? e.message : e);
  }


  // Backfill / ensure columns that older DBs might not have
  if (!hasColumn(conn, 'pantry', 'NameLower')) {
    conn.exec('ALTER TABLE pantry ADD COLUMN NameLower TEXT;');
  }


  if (!hasColumn(conn, 'pantry', 'QtyNum')) {
    // Structured quantity support (numeric + unit) used by shopping-list pantry subtraction
    conn.exec('ALTER TABLE pantry ADD COLUMN QtyNum REAL;');
  }
  if (!hasColumn(conn, 'pantry', 'Unit')) {
    conn.exec('ALTER TABLE pantry ADD COLUMN Unit TEXT;');
  }

  if (!hasColumn(conn, 'pantry', 'Category')) {
    conn.exec('ALTER TABLE pantry ADD COLUMN Category TEXT;');
  }

  // Backfill NameLower if blank
  conn.exec(`UPDATE pantry SET NameLower = lower(trim(Name)) WHERE (NameLower IS NULL OR trim(NameLower)='') AND Name IS NOT NULL;`);

  if (!hasColumn(conn, 'recipes', 'TitleLower')) {
    conn.exec('ALTER TABLE recipes ADD COLUMN TitleLower TEXT;');
  }
  conn.exec(`UPDATE recipes SET TitleLower = lower(trim(Title)) WHERE (TitleLower IS NULL OR trim(TitleLower)='') AND Title IS NOT NULL;`);

  // Add leftovers columns to plans table for older databases
  const leftoverCols = [
    ['BreakfastUseLeftovers', 'INTEGER DEFAULT 0'],
    ['BreakfastFrom', 'TEXT'],
    ['LunchUseLeftovers', 'INTEGER DEFAULT 0'],
    ['LunchFrom', 'TEXT'],
    ['DinnerUseLeftovers', 'INTEGER DEFAULT 0'],
    ['DinnerFrom', 'TEXT']
  ];
  for (const [colName, colDef] of leftoverCols) {
    if (!hasColumn(conn, 'plans', colName)) {
      conn.exec(`ALTER TABLE plans ADD COLUMN ${colName} ${colDef};`);
    }
  }

  // Add Category column to ingredients table for older databases
  if (!hasColumn(conn, 'ingredients', 'Category')) {
    conn.exec('ALTER TABLE ingredients ADD COLUMN Category TEXT;');
  }

  // Add user preferences table for learned category overrides
  try {
    conn.exec(`
      CREATE TABLE IF NOT EXISTS category_overrides (
        keyword TEXT PRIMARY KEY,
        category TEXT NOT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      );
    `);
  } catch (e) {
    console.warn('category_overrides table creation warning:', e && e.message ? e.message : e);
  }

  // Add user ingredient category learning table for self-improving classification
  try {
    conn.exec(`
      CREATE TABLE IF NOT EXISTS user_ingredient_category (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        name_lower TEXT NOT NULL,
        category TEXT NOT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(name_lower)
      );
      
      -- Index for faster lookups
      CREATE INDEX IF NOT EXISTS idx_user_ingredient_category_name_lower ON user_ingredient_category(name_lower);
    `);
  } catch (e) {
    console.warn('user_ingredient_category table creation warning:', e && e.message ? e.message : e);
  }

  // Ingredient categories list (drives ingredient dropdown + shopping list grouping order)
  try {
    conn.exec(`
      CREATE TABLE IF NOT EXISTS ingredient_categories (
        category TEXT PRIMARY KEY,
        sort_order INTEGER DEFAULT 0,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Seed defaults if empty
    const nRow = conn.prepare("SELECT COUNT(1) AS n FROM ingredient_categories").get();
    const n = (nRow && typeof nRow.n === 'number') ? nRow.n : 0;
    if (n === 0) {
      const defaults = ['Produce','Dairy','Meat','Seafood','Pantry','Snacks','Frozen','Bakery','Deli','Beverages','Household','Spice','Other'];
      const ins = conn.prepare("INSERT OR IGNORE INTO ingredient_categories(category, sort_order) VALUES(?, ?)");
      const tx = conn.transaction(() => {
        defaults.forEach((c, i) => ins.run(c, i+1));
      });
      tx();
    }

  } catch (e) {
    console.warn('ingredient_categories table creation warning:', e && e.message ? e.message : e);
  }


  // Unit conversions (seeded from Baking conversions CSV). Stored as directed multipliers:
  // to_qty = from_qty * factor
  try {
    conn.exec(`
      CREATE TABLE IF NOT EXISTS unit_conversions (
        FromUnit TEXT NOT NULL,
        ToUnit TEXT NOT NULL,
        Factor REAL NOT NULL,
        Kind TEXT,
        IsApprox INTEGER DEFAULT 0,
        Source TEXT,
        UpdatedAt TEXT,
        PRIMARY KEY (FromUnit, ToUnit, Source)
      );
      CREATE INDEX IF NOT EXISTS idx_unit_conversions_from ON unit_conversions(FromUnit);
      CREATE INDEX IF NOT EXISTS idx_unit_conversions_to ON unit_conversions(ToUnit);
    `);

// Ensure a minimal set of builtin, exact conversions exist so core mass/volume math works even if not present in CSV seed.
// These are exact unit definitions (not ingredient-specific density conversions).
const nowBuiltin = new Date().toISOString();
const builtin = [
  // Mass
  { from_unit: 'oz', to_unit: 'lb', factor: 1/16, kind: 'mass' },
  { from_unit: 'lb', to_unit: 'oz', factor: 16, kind: 'mass' },
  { from_unit: 'ounce', to_unit: 'pound', factor: 1/16, kind: 'mass' },
  { from_unit: 'pound', to_unit: 'ounce', factor: 16, kind: 'mass' },

  // Volume
  { from_unit: 'tbsp', to_unit: 'tsp', factor: 3, kind: 'volume' },
  { from_unit: 'tsp', to_unit: 'tbsp', factor: 1/3, kind: 'volume' },
  { from_unit: 'cup', to_unit: 'tbsp', factor: 16, kind: 'volume' },
  { from_unit: 'tbsp', to_unit: 'cup', factor: 1/16, kind: 'volume' },
  { from_unit: 'cup', to_unit: 'tsp', factor: 48, kind: 'volume' },
  { from_unit: 'tsp', to_unit: 'cup', factor: 1/48, kind: 'volume' },
  { from_unit: 'pint', to_unit: 'cup', factor: 2, kind: 'volume' },
  { from_unit: 'cup', to_unit: 'pint', factor: 1/2, kind: 'volume' },
  { from_unit: 'quart', to_unit: 'pint', factor: 2, kind: 'volume' },
  { from_unit: 'pint', to_unit: 'quart', factor: 1/2, kind: 'volume' },
  { from_unit: 'gallon', to_unit: 'quart', factor: 4, kind: 'volume' },
  { from_unit: 'quart', to_unit: 'gallon', factor: 1/4, kind: 'volume' }
];
const insBuiltin = conn.prepare(`
  INSERT OR IGNORE INTO unit_conversions
    (FromUnit, ToUnit, Factor, Kind, IsApprox, Source, UpdatedAt)
  VALUES (?, ?, ?, ?, 0, 'builtin', ?)
`);
const txBuiltin = conn.transaction(() => {
  builtin.forEach(r => insBuiltin.run(r.from_unit, r.to_unit, r.factor, r.kind || null, nowBuiltin));
});
txBuiltin();


    const countRow = conn.prepare("SELECT COUNT(1) AS n FROM unit_conversions").get();
    const n = countRow && typeof countRow.n === 'number' ? countRow.n : 0;
    const now = new Date().toISOString();
    if (n === 0) {
      const seed = [{"from_unit":"cup","to_unit":"pint","factor":0.5,"kind":"volume","is_approx":false,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"cup","to_unit":"quart","factor":0.25,"kind":"volume","is_approx":false,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"cup","to_unit":"gallon","factor":0.0625,"kind":"volume","is_approx":false,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"cup","to_unit":"fl_oz","factor":8.0,"kind":"volume","is_approx":false,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"cup","to_unit":"ml","factor":236.0,"kind":"volume","is_approx":false,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"pint","to_unit":"cup","factor":2.0,"kind":"volume","is_approx":false,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"pint","to_unit":"quart","factor":0.5,"kind":"volume","is_approx":false,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"pint","to_unit":"gallon","factor":0.125,"kind":"volume","is_approx":false,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"pint","to_unit":"fl_oz","factor":16.0,"kind":"volume","is_approx":false,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"pint","to_unit":"ml","factor":472.0,"kind":"volume","is_approx":false,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"quart","to_unit":"cup","factor":4.0,"kind":"volume","is_approx":false,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"quart","to_unit":"pint","factor":2.0,"kind":"volume","is_approx":false,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"quart","to_unit":"gallon","factor":0.25,"kind":"volume","is_approx":false,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"quart","to_unit":"fl_oz","factor":32.0,"kind":"volume","is_approx":false,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"quart","to_unit":"ml","factor":944.0,"kind":"volume","is_approx":false,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"gallon","to_unit":"cup","factor":16.0,"kind":"volume","is_approx":false,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"gallon","to_unit":"pint","factor":8.0,"kind":"volume","is_approx":false,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"gallon","to_unit":"quart","factor":4.0,"kind":"volume","is_approx":false,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"gallon","to_unit":"fl_oz","factor":128.0,"kind":"volume","is_approx":false,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"gallon","to_unit":"ml","factor":3776.0,"kind":"volume","is_approx":false,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"fl_oz","to_unit":"cup","factor":0.125,"kind":"volume","is_approx":false,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"fl_oz","to_unit":"pint","factor":0.0625,"kind":"volume","is_approx":false,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"fl_oz","to_unit":"quart","factor":0.03125,"kind":"volume","is_approx":false,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"fl_oz","to_unit":"gallon","factor":0.0078125,"kind":"volume","is_approx":false,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"fl_oz","to_unit":"ml","factor":29.5,"kind":"volume","is_approx":false,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"ml","to_unit":"cup","factor":0.00423728813559322,"kind":"volume","is_approx":false,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"ml","to_unit":"pint","factor":0.00211864406779661,"kind":"volume","is_approx":false,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"ml","to_unit":"quart","factor":0.001059322033898305,"kind":"volume","is_approx":false,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"ml","to_unit":"gallon","factor":0.00026483050847457627,"kind":"volume","is_approx":false,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"ml","to_unit":"fl_oz","factor":0.03389830508474576,"kind":"volume","is_approx":false,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"cup","to_unit":"pint","factor":0.5,"kind":"volume","is_approx":false,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"cup","to_unit":"quart","factor":0.25,"kind":"volume","is_approx":false,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"cup","to_unit":"gallon","factor":0.0625,"kind":"volume","is_approx":false,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"cup","to_unit":"fl_oz","factor":8.0,"kind":"volume","is_approx":false,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"cup","to_unit":"ml","factor":236.0,"kind":"volume","is_approx":false,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"pint","to_unit":"cup","factor":2.0,"kind":"volume","is_approx":false,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"pint","to_unit":"quart","factor":0.5,"kind":"volume","is_approx":false,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"pint","to_unit":"gallon","factor":0.125,"kind":"volume","is_approx":false,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"pint","to_unit":"fl_oz","factor":16.0,"kind":"volume","is_approx":false,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"pint","to_unit":"ml","factor":472.0,"kind":"volume","is_approx":false,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"quart","to_unit":"cup","factor":4.0,"kind":"volume","is_approx":false,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"quart","to_unit":"pint","factor":2.0,"kind":"volume","is_approx":false,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"quart","to_unit":"gallon","factor":0.25,"kind":"volume","is_approx":false,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"quart","to_unit":"fl_oz","factor":32.0,"kind":"volume","is_approx":false,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"quart","to_unit":"ml","factor":944.0,"kind":"volume","is_approx":false,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"gallon","to_unit":"cup","factor":16.0,"kind":"volume","is_approx":false,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"gallon","to_unit":"pint","factor":8.0,"kind":"volume","is_approx":false,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"gallon","to_unit":"quart","factor":4.0,"kind":"volume","is_approx":false,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"gallon","to_unit":"fl_oz","factor":128.0,"kind":"volume","is_approx":false,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"gallon","to_unit":"ml","factor":3776.0,"kind":"volume","is_approx":false,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"fl_oz","to_unit":"cup","factor":0.125,"kind":"volume","is_approx":false,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"fl_oz","to_unit":"pint","factor":0.0625,"kind":"volume","is_approx":false,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"fl_oz","to_unit":"quart","factor":0.03125,"kind":"volume","is_approx":false,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"fl_oz","to_unit":"gallon","factor":0.0078125,"kind":"volume","is_approx":false,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"fl_oz","to_unit":"ml","factor":29.5,"kind":"volume","is_approx":false,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"ml","to_unit":"cup","factor":0.00423728813559322,"kind":"volume","is_approx":false,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"ml","to_unit":"pint","factor":0.00211864406779661,"kind":"volume","is_approx":false,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"ml","to_unit":"quart","factor":0.001059322033898305,"kind":"volume","is_approx":false,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"ml","to_unit":"gallon","factor":0.00026483050847457627,"kind":"volume","is_approx":false,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"ml","to_unit":"fl_oz","factor":0.03389830508474576,"kind":"volume","is_approx":false,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"cup","to_unit":"pint","factor":0.5,"kind":"volume","is_approx":false,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"cup","to_unit":"quart","factor":0.25,"kind":"volume","is_approx":false,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"cup","to_unit":"gallon","factor":0.0625,"kind":"volume","is_approx":false,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"cup","to_unit":"fl_oz","factor":8.0,"kind":"volume","is_approx":false,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"cup","to_unit":"ml","factor":236.0,"kind":"volume","is_approx":false,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"pint","to_unit":"cup","factor":2.0,"kind":"volume","is_approx":false,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"pint","to_unit":"quart","factor":0.5,"kind":"volume","is_approx":false,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"pint","to_unit":"gallon","factor":0.125,"kind":"volume","is_approx":false,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"pint","to_unit":"fl_oz","factor":16.0,"kind":"volume","is_approx":false,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"pint","to_unit":"ml","factor":472.0,"kind":"volume","is_approx":false,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"quart","to_unit":"cup","factor":4.0,"kind":"volume","is_approx":false,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"quart","to_unit":"pint","factor":2.0,"kind":"volume","is_approx":false,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"quart","to_unit":"gallon","factor":0.25,"kind":"volume","is_approx":false,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"quart","to_unit":"fl_oz","factor":32.0,"kind":"volume","is_approx":false,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"quart","to_unit":"ml","factor":944.0,"kind":"volume","is_approx":false,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"gallon","to_unit":"cup","factor":16.0,"kind":"volume","is_approx":false,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"gallon","to_unit":"pint","factor":8.0,"kind":"volume","is_approx":false,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"gallon","to_unit":"quart","factor":4.0,"kind":"volume","is_approx":false,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"gallon","to_unit":"fl_oz","factor":128.0,"kind":"volume","is_approx":false,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"gallon","to_unit":"ml","factor":3776.0,"kind":"volume","is_approx":false,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"fl_oz","to_unit":"cup","factor":0.125,"kind":"volume","is_approx":false,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"fl_oz","to_unit":"pint","factor":0.0625,"kind":"volume","is_approx":false,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"fl_oz","to_unit":"quart","factor":0.03125,"kind":"volume","is_approx":false,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"fl_oz","to_unit":"gallon","factor":0.0078125,"kind":"volume","is_approx":false,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"fl_oz","to_unit":"ml","factor":29.5,"kind":"volume","is_approx":false,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"ml","to_unit":"cup","factor":0.00423728813559322,"kind":"volume","is_approx":false,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"ml","to_unit":"pint","factor":0.00211864406779661,"kind":"volume","is_approx":false,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"ml","to_unit":"quart","factor":0.001059322033898305,"kind":"volume","is_approx":false,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"ml","to_unit":"gallon","factor":0.00026483050847457627,"kind":"volume","is_approx":false,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"ml","to_unit":"fl_oz","factor":0.03389830508474576,"kind":"volume","is_approx":false,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"cup","to_unit":"pint","factor":0.5,"kind":"volume","is_approx":false,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"cup","to_unit":"quart","factor":0.25,"kind":"volume","is_approx":false,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"cup","to_unit":"gallon","factor":0.0625,"kind":"volume","is_approx":false,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"cup","to_unit":"fl_oz","factor":8.0,"kind":"volume","is_approx":false,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"cup","to_unit":"ml","factor":237.0,"kind":"volume","is_approx":false,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"pint","to_unit":"cup","factor":2.0,"kind":"volume","is_approx":false,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"pint","to_unit":"quart","factor":0.5,"kind":"volume","is_approx":false,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"pint","to_unit":"gallon","factor":0.125,"kind":"volume","is_approx":false,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"pint","to_unit":"fl_oz","factor":16.0,"kind":"volume","is_approx":false,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"pint","to_unit":"ml","factor":474.0,"kind":"volume","is_approx":false,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"quart","to_unit":"cup","factor":4.0,"kind":"volume","is_approx":false,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"quart","to_unit":"pint","factor":2.0,"kind":"volume","is_approx":false,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"quart","to_unit":"gallon","factor":0.25,"kind":"volume","is_approx":false,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"quart","to_unit":"fl_oz","factor":32.0,"kind":"volume","is_approx":false,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"quart","to_unit":"ml","factor":948.0,"kind":"volume","is_approx":false,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"gallon","to_unit":"cup","factor":16.0,"kind":"volume","is_approx":false,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"gallon","to_unit":"pint","factor":8.0,"kind":"volume","is_approx":false,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"gallon","to_unit":"quart","factor":4.0,"kind":"volume","is_approx":false,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"gallon","to_unit":"fl_oz","factor":128.0,"kind":"volume","is_approx":false,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"gallon","to_unit":"ml","factor":3792.0,"kind":"volume","is_approx":false,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"fl_oz","to_unit":"cup","factor":0.125,"kind":"volume","is_approx":false,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"fl_oz","to_unit":"pint","factor":0.0625,"kind":"volume","is_approx":false,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"fl_oz","to_unit":"quart","factor":0.03125,"kind":"volume","is_approx":false,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"fl_oz","to_unit":"gallon","factor":0.0078125,"kind":"volume","is_approx":false,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"fl_oz","to_unit":"ml","factor":29.625,"kind":"volume","is_approx":false,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"ml","to_unit":"cup","factor":0.004219409282700422,"kind":"volume","is_approx":false,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"ml","to_unit":"pint","factor":0.002109704641350211,"kind":"volume","is_approx":false,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"ml","to_unit":"quart","factor":0.0010548523206751054,"kind":"volume","is_approx":false,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"ml","to_unit":"gallon","factor":0.00026371308016877635,"kind":"volume","is_approx":false,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"ml","to_unit":"fl_oz","factor":0.03375527426160337,"kind":"volume","is_approx":false,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"cup","to_unit":"pint","factor":0.5,"kind":"volume","is_approx":false,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"cup","to_unit":"quart","factor":0.25,"kind":"volume","is_approx":false,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"cup","to_unit":"gallon","factor":0.0625,"kind":"volume","is_approx":false,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"cup","to_unit":"fl_oz","factor":8.0,"kind":"volume","is_approx":false,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"cup","to_unit":"ml","factor":236.5,"kind":"volume","is_approx":false,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"pint","to_unit":"cup","factor":2.0,"kind":"volume","is_approx":false,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"pint","to_unit":"quart","factor":0.5,"kind":"volume","is_approx":false,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"pint","to_unit":"gallon","factor":0.125,"kind":"volume","is_approx":false,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"pint","to_unit":"fl_oz","factor":16.0,"kind":"volume","is_approx":false,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"pint","to_unit":"ml","factor":473.0,"kind":"volume","is_approx":false,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"quart","to_unit":"cup","factor":4.0,"kind":"volume","is_approx":false,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"quart","to_unit":"pint","factor":2.0,"kind":"volume","is_approx":false,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"quart","to_unit":"gallon","factor":0.25,"kind":"volume","is_approx":false,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"quart","to_unit":"fl_oz","factor":32.0,"kind":"volume","is_approx":false,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"quart","to_unit":"ml","factor":946.0,"kind":"volume","is_approx":false,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"gallon","to_unit":"cup","factor":16.0,"kind":"volume","is_approx":false,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"gallon","to_unit":"pint","factor":8.0,"kind":"volume","is_approx":false,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"gallon","to_unit":"quart","factor":4.0,"kind":"volume","is_approx":false,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"gallon","to_unit":"fl_oz","factor":128.0,"kind":"volume","is_approx":false,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"gallon","to_unit":"ml","factor":3784.0,"kind":"volume","is_approx":false,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"fl_oz","to_unit":"cup","factor":0.125,"kind":"volume","is_approx":false,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"fl_oz","to_unit":"pint","factor":0.0625,"kind":"volume","is_approx":false,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"fl_oz","to_unit":"quart","factor":0.03125,"kind":"volume","is_approx":false,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"fl_oz","to_unit":"gallon","factor":0.0078125,"kind":"volume","is_approx":false,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"fl_oz","to_unit":"ml","factor":29.5625,"kind":"volume","is_approx":false,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"ml","to_unit":"cup","factor":0.004228329809725159,"kind":"volume","is_approx":false,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"ml","to_unit":"pint","factor":0.0021141649048625794,"kind":"volume","is_approx":false,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"ml","to_unit":"quart","factor":0.0010570824524312897,"kind":"volume","is_approx":false,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"ml","to_unit":"gallon","factor":0.0002642706131078224,"kind":"volume","is_approx":false,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"ml","to_unit":"fl_oz","factor":0.03382663847780127,"kind":"volume","is_approx":false,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"cup","to_unit":"pint","factor":0.5,"kind":"volume","is_approx":false,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"cup","to_unit":"quart","factor":0.25,"kind":"volume","is_approx":false,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"cup","to_unit":"gallon","factor":0.0625,"kind":"volume","is_approx":false,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"cup","to_unit":"fl_oz","factor":8.0,"kind":"volume","is_approx":false,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"cup","to_unit":"ml","factor":236.5,"kind":"volume","is_approx":false,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"pint","to_unit":"cup","factor":2.0,"kind":"volume","is_approx":false,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"pint","to_unit":"quart","factor":0.5,"kind":"volume","is_approx":false,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"pint","to_unit":"gallon","factor":0.125,"kind":"volume","is_approx":false,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"pint","to_unit":"fl_oz","factor":16.0,"kind":"volume","is_approx":false,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"pint","to_unit":"ml","factor":473.0,"kind":"volume","is_approx":false,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"quart","to_unit":"cup","factor":4.0,"kind":"volume","is_approx":false,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"quart","to_unit":"pint","factor":2.0,"kind":"volume","is_approx":false,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"quart","to_unit":"gallon","factor":0.25,"kind":"volume","is_approx":false,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"quart","to_unit":"fl_oz","factor":32.0,"kind":"volume","is_approx":false,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"quart","to_unit":"ml","factor":946.0,"kind":"volume","is_approx":false,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"gallon","to_unit":"cup","factor":16.0,"kind":"volume","is_approx":false,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"gallon","to_unit":"pint","factor":8.0,"kind":"volume","is_approx":false,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"gallon","to_unit":"quart","factor":4.0,"kind":"volume","is_approx":false,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"gallon","to_unit":"fl_oz","factor":128.0,"kind":"volume","is_approx":false,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"gallon","to_unit":"ml","factor":3784.0,"kind":"volume","is_approx":false,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"fl_oz","to_unit":"cup","factor":0.125,"kind":"volume","is_approx":false,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"fl_oz","to_unit":"pint","factor":0.0625,"kind":"volume","is_approx":false,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"fl_oz","to_unit":"quart","factor":0.03125,"kind":"volume","is_approx":false,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"fl_oz","to_unit":"gallon","factor":0.0078125,"kind":"volume","is_approx":false,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"fl_oz","to_unit":"ml","factor":29.5625,"kind":"volume","is_approx":false,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"ml","to_unit":"cup","factor":0.004228329809725159,"kind":"volume","is_approx":false,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"ml","to_unit":"pint","factor":0.0021141649048625794,"kind":"volume","is_approx":false,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"ml","to_unit":"quart","factor":0.0010570824524312897,"kind":"volume","is_approx":false,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"ml","to_unit":"gallon","factor":0.0002642706131078224,"kind":"volume","is_approx":false,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"ml","to_unit":"fl_oz","factor":0.03382663847780127,"kind":"volume","is_approx":false,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"cup","to_unit":"pint","factor":0.5,"kind":"volume","is_approx":false,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"cup","to_unit":"quart","factor":0.25,"kind":"volume","is_approx":false,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"cup","to_unit":"gallon","factor":0.0625,"kind":"volume","is_approx":false,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"cup","to_unit":"fl_oz","factor":8.0,"kind":"volume","is_approx":false,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"cup","to_unit":"ml","factor":236.625,"kind":"volume","is_approx":false,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"pint","to_unit":"cup","factor":2.0,"kind":"volume","is_approx":false,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"pint","to_unit":"quart","factor":0.5,"kind":"volume","is_approx":false,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"pint","to_unit":"gallon","factor":0.125,"kind":"volume","is_approx":false,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"pint","to_unit":"fl_oz","factor":16.0,"kind":"volume","is_approx":false,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"pint","to_unit":"ml","factor":473.25,"kind":"volume","is_approx":false,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"quart","to_unit":"cup","factor":4.0,"kind":"volume","is_approx":false,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"quart","to_unit":"pint","factor":2.0,"kind":"volume","is_approx":false,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"quart","to_unit":"gallon","factor":0.25,"kind":"volume","is_approx":false,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"quart","to_unit":"fl_oz","factor":32.0,"kind":"volume","is_approx":false,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"quart","to_unit":"ml","factor":946.5,"kind":"volume","is_approx":false,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"gallon","to_unit":"cup","factor":16.0,"kind":"volume","is_approx":false,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"gallon","to_unit":"pint","factor":8.0,"kind":"volume","is_approx":false,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"gallon","to_unit":"quart","factor":4.0,"kind":"volume","is_approx":false,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"gallon","to_unit":"fl_oz","factor":128.0,"kind":"volume","is_approx":false,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"gallon","to_unit":"ml","factor":3786.0,"kind":"volume","is_approx":false,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"fl_oz","to_unit":"cup","factor":0.125,"kind":"volume","is_approx":false,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"fl_oz","to_unit":"pint","factor":0.0625,"kind":"volume","is_approx":false,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"fl_oz","to_unit":"quart","factor":0.03125,"kind":"volume","is_approx":false,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"fl_oz","to_unit":"gallon","factor":0.0078125,"kind":"volume","is_approx":false,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"fl_oz","to_unit":"ml","factor":29.578125,"kind":"volume","is_approx":false,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"ml","to_unit":"cup","factor":0.004226096143687269,"kind":"volume","is_approx":false,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"ml","to_unit":"pint","factor":0.0021130480718436345,"kind":"volume","is_approx":false,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"ml","to_unit":"quart","factor":0.0010565240359218173,"kind":"volume","is_approx":false,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"ml","to_unit":"gallon","factor":0.0002641310089804543,"kind":"volume","is_approx":false,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"ml","to_unit":"fl_oz","factor":0.03380876914949815,"kind":"volume","is_approx":false,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"cup","to_unit":"pint","factor":0.5,"kind":"volume","is_approx":false,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"cup","to_unit":"quart","factor":0.25,"kind":"volume","is_approx":false,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"cup","to_unit":"gallon","factor":0.0625,"kind":"volume","is_approx":false,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"cup","to_unit":"fl_oz","factor":8.0,"kind":"volume","is_approx":false,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"cup","to_unit":"ml","factor":236.5625,"kind":"volume","is_approx":false,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"pint","to_unit":"cup","factor":2.0,"kind":"volume","is_approx":false,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"pint","to_unit":"quart","factor":0.5,"kind":"volume","is_approx":false,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"pint","to_unit":"gallon","factor":0.125,"kind":"volume","is_approx":false,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"pint","to_unit":"fl_oz","factor":16.0,"kind":"volume","is_approx":false,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"pint","to_unit":"ml","factor":473.125,"kind":"volume","is_approx":false,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"quart","to_unit":"cup","factor":4.0,"kind":"volume","is_approx":false,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"quart","to_unit":"pint","factor":2.0,"kind":"volume","is_approx":false,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"quart","to_unit":"gallon","factor":0.25,"kind":"volume","is_approx":false,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"quart","to_unit":"fl_oz","factor":32.0,"kind":"volume","is_approx":false,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"quart","to_unit":"ml","factor":946.25,"kind":"volume","is_approx":false,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"gallon","to_unit":"cup","factor":16.0,"kind":"volume","is_approx":false,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"gallon","to_unit":"pint","factor":8.0,"kind":"volume","is_approx":false,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"gallon","to_unit":"quart","factor":4.0,"kind":"volume","is_approx":false,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"gallon","to_unit":"fl_oz","factor":128.0,"kind":"volume","is_approx":false,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"gallon","to_unit":"ml","factor":3785.0,"kind":"volume","is_approx":false,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"fl_oz","to_unit":"cup","factor":0.125,"kind":"volume","is_approx":false,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"fl_oz","to_unit":"pint","factor":0.0625,"kind":"volume","is_approx":false,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"fl_oz","to_unit":"quart","factor":0.03125,"kind":"volume","is_approx":false,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"fl_oz","to_unit":"gallon","factor":0.0078125,"kind":"volume","is_approx":false,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"fl_oz","to_unit":"ml","factor":29.5703125,"kind":"volume","is_approx":false,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"ml","to_unit":"cup","factor":0.004227212681638045,"kind":"volume","is_approx":false,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"ml","to_unit":"pint","factor":0.0021136063408190224,"kind":"volume","is_approx":false,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"ml","to_unit":"quart","factor":0.0010568031704095112,"kind":"volume","is_approx":false,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"ml","to_unit":"gallon","factor":0.0002642007926023778,"kind":"volume","is_approx":false,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"ml","to_unit":"fl_oz","factor":0.03381770145310436,"kind":"volume","is_approx":false,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"tsp","to_unit":"tbsp","factor":0.3333333333333333,"kind":"volume","is_approx":false,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"tsp","to_unit":"cup","factor":0.020833333333333332,"kind":"volume","is_approx":false,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"tsp","to_unit":"oz","factor":0.16666666666666666,"kind":"mixed","is_approx":true,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"tsp","to_unit":"g","factor":4.766666666666667,"kind":"mixed","is_approx":false,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"tbsp","to_unit":"tsp","factor":3.0,"kind":"volume","is_approx":false,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"tbsp","to_unit":"cup","factor":0.0625,"kind":"volume","is_approx":false,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"tbsp","to_unit":"oz","factor":0.5,"kind":"mixed","is_approx":true,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"tbsp","to_unit":"g","factor":14.3,"kind":"mixed","is_approx":false,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"cup","to_unit":"tsp","factor":48.0,"kind":"volume","is_approx":false,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"cup","to_unit":"tbsp","factor":16.0,"kind":"volume","is_approx":false,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"cup","to_unit":"oz","factor":8.0,"kind":"mixed","is_approx":true,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"cup","to_unit":"g","factor":228.8,"kind":"mixed","is_approx":false,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"oz","to_unit":"tsp","factor":6.0,"kind":"mixed","is_approx":true,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"oz","to_unit":"tbsp","factor":2.0,"kind":"mixed","is_approx":true,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"oz","to_unit":"cup","factor":0.125,"kind":"mixed","is_approx":true,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"oz","to_unit":"g","factor":28.6,"kind":"mass","is_approx":true,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"g","to_unit":"tsp","factor":0.2097902097902098,"kind":"mixed","is_approx":false,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"g","to_unit":"tbsp","factor":0.06993006993006992,"kind":"mixed","is_approx":false,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"g","to_unit":"cup","factor":0.00437062937062937,"kind":"mixed","is_approx":false,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"g","to_unit":"oz","factor":0.03496503496503496,"kind":"mass","is_approx":true,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"tsp","to_unit":"tbsp","factor":0.3333333333333333,"kind":"volume","is_approx":false,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"tsp","to_unit":"cup","factor":0.020833333333333332,"kind":"volume","is_approx":false,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"tsp","to_unit":"oz","factor":0.16666666666666666,"kind":"mixed","is_approx":true,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"tsp","to_unit":"g","factor":4.716666666666667,"kind":"mixed","is_approx":false,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"tbsp","to_unit":"tsp","factor":3.0,"kind":"volume","is_approx":false,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"tbsp","to_unit":"cup","factor":0.0625,"kind":"volume","is_approx":false,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"tbsp","to_unit":"oz","factor":0.5,"kind":"mixed","is_approx":true,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"tbsp","to_unit":"g","factor":14.15,"kind":"mixed","is_approx":false,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"cup","to_unit":"tsp","factor":48.0,"kind":"volume","is_approx":false,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"cup","to_unit":"tbsp","factor":16.0,"kind":"volume","is_approx":false,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"cup","to_unit":"oz","factor":8.0,"kind":"mixed","is_approx":true,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"cup","to_unit":"g","factor":226.4,"kind":"mixed","is_approx":false,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"oz","to_unit":"tsp","factor":6.0,"kind":"mixed","is_approx":true,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"oz","to_unit":"tbsp","factor":2.0,"kind":"mixed","is_approx":true,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"oz","to_unit":"cup","factor":0.125,"kind":"mixed","is_approx":true,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"oz","to_unit":"g","factor":28.3,"kind":"mass","is_approx":true,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"g","to_unit":"tsp","factor":0.21201413427561838,"kind":"mixed","is_approx":false,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"g","to_unit":"tbsp","factor":0.0706713780918728,"kind":"mixed","is_approx":false,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"g","to_unit":"cup","factor":0.00441696113074205,"kind":"mixed","is_approx":false,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"g","to_unit":"oz","factor":0.0353356890459364,"kind":"mass","is_approx":true,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"tsp","to_unit":"tbsp","factor":0.3333333333333333,"kind":"volume","is_approx":false,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"tsp","to_unit":"cup","factor":0.020833333333333332,"kind":"volume","is_approx":false,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"tsp","to_unit":"oz","factor":0.16666666666666666,"kind":"mixed","is_approx":true,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"tsp","to_unit":"g","factor":4.7250000000000005,"kind":"mixed","is_approx":false,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"tbsp","to_unit":"tsp","factor":3.0,"kind":"volume","is_approx":false,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"tbsp","to_unit":"cup","factor":0.0625,"kind":"volume","is_approx":false,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"tbsp","to_unit":"oz","factor":0.5,"kind":"mixed","is_approx":true,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"tbsp","to_unit":"g","factor":14.175,"kind":"mixed","is_approx":false,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"cup","to_unit":"tsp","factor":48.0,"kind":"volume","is_approx":false,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"cup","to_unit":"tbsp","factor":16.0,"kind":"volume","is_approx":false,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"cup","to_unit":"oz","factor":8.0,"kind":"mixed","is_approx":true,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"cup","to_unit":"g","factor":226.8,"kind":"mixed","is_approx":false,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"oz","to_unit":"tsp","factor":6.0,"kind":"mixed","is_approx":true,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"oz","to_unit":"tbsp","factor":2.0,"kind":"mixed","is_approx":true,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"oz","to_unit":"cup","factor":0.125,"kind":"mixed","is_approx":true,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"oz","to_unit":"g","factor":28.35,"kind":"mass","is_approx":true,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"g","to_unit":"tsp","factor":0.21164021164021163,"kind":"mixed","is_approx":false,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"g","to_unit":"tbsp","factor":0.07054673721340388,"kind":"mixed","is_approx":false,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"g","to_unit":"cup","factor":0.004409171075837742,"kind":"mixed","is_approx":false,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"g","to_unit":"oz","factor":0.03527336860670194,"kind":"mass","is_approx":true,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"tsp","to_unit":"tbsp","factor":0.3333333333333333,"kind":"volume","is_approx":false,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"tsp","to_unit":"cup","factor":0.020833333333333332,"kind":"volume","is_approx":false,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"tsp","to_unit":"oz","factor":0.1625,"kind":"mixed","is_approx":true,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"tsp","to_unit":"g","factor":4.725,"kind":"mixed","is_approx":false,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"tbsp","to_unit":"tsp","factor":3.0,"kind":"volume","is_approx":false,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"tbsp","to_unit":"cup","factor":0.0625,"kind":"volume","is_approx":false,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"tbsp","to_unit":"oz","factor":0.48750000000000004,"kind":"mixed","is_approx":true,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"tbsp","to_unit":"g","factor":14.174999999999999,"kind":"mixed","is_approx":false,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"cup","to_unit":"tsp","factor":48.0,"kind":"volume","is_approx":false,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"cup","to_unit":"tbsp","factor":16.0,"kind":"volume","is_approx":false,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"cup","to_unit":"oz","factor":7.800000000000001,"kind":"mixed","is_approx":true,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"cup","to_unit":"g","factor":226.79999999999998,"kind":"mixed","is_approx":false,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"oz","to_unit":"tsp","factor":6.153846153846153,"kind":"mixed","is_approx":true,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"oz","to_unit":"tbsp","factor":2.051282051282051,"kind":"mixed","is_approx":true,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"oz","to_unit":"cup","factor":0.1282051282051282,"kind":"mixed","is_approx":true,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"oz","to_unit":"g","factor":29.076923076923073,"kind":"mass","is_approx":true,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"g","to_unit":"tsp","factor":0.21164021164021166,"kind":"mixed","is_approx":false,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"g","to_unit":"tbsp","factor":0.07054673721340388,"kind":"mixed","is_approx":false,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"g","to_unit":"cup","factor":0.004409171075837742,"kind":"mixed","is_approx":false,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"g","to_unit":"oz","factor":0.0343915343915344,"kind":"mass","is_approx":true,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"tsp","to_unit":"tbsp","factor":0.3333333333333333,"kind":"volume","is_approx":false,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"tsp","to_unit":"cup","factor":0.020833333333333332,"kind":"volume","is_approx":false,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"tsp","to_unit":"oz","factor":0.16666666666666666,"kind":"mixed","is_approx":true,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"tsp","to_unit":"lb","factor":0.010416666666666666,"kind":"mixed","is_approx":false,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"tsp","to_unit":"g","factor":4.7250000000000005,"kind":"mixed","is_approx":false,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"tbsp","to_unit":"tsp","factor":3.0,"kind":"volume","is_approx":false,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"tbsp","to_unit":"cup","factor":0.0625,"kind":"volume","is_approx":false,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"tbsp","to_unit":"oz","factor":0.5,"kind":"mixed","is_approx":true,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"tbsp","to_unit":"lb","factor":0.03125,"kind":"mixed","is_approx":false,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"tbsp","to_unit":"g","factor":14.175,"kind":"mixed","is_approx":false,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"cup","to_unit":"tsp","factor":48.0,"kind":"volume","is_approx":false,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"cup","to_unit":"tbsp","factor":16.0,"kind":"volume","is_approx":false,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"cup","to_unit":"oz","factor":8.0,"kind":"mixed","is_approx":true,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"cup","to_unit":"lb","factor":0.5,"kind":"mixed","is_approx":false,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"cup","to_unit":"g","factor":226.8,"kind":"mixed","is_approx":false,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"oz","to_unit":"tsp","factor":6.0,"kind":"mixed","is_approx":true,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"oz","to_unit":"tbsp","factor":2.0,"kind":"mixed","is_approx":true,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"oz","to_unit":"cup","factor":0.125,"kind":"mixed","is_approx":true,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"oz","to_unit":"lb","factor":0.0625,"kind":"mass","is_approx":true,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"oz","to_unit":"g","factor":28.35,"kind":"mass","is_approx":true,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"lb","to_unit":"tsp","factor":96.0,"kind":"mixed","is_approx":false,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"lb","to_unit":"tbsp","factor":32.0,"kind":"mixed","is_approx":false,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"lb","to_unit":"cup","factor":2.0,"kind":"mixed","is_approx":false,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"lb","to_unit":"oz","factor":16.0,"kind":"mass","is_approx":true,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"lb","to_unit":"g","factor":453.6,"kind":"mass","is_approx":false,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"g","to_unit":"tsp","factor":0.21164021164021163,"kind":"mixed","is_approx":false,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"g","to_unit":"tbsp","factor":0.07054673721340388,"kind":"mixed","is_approx":false,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"g","to_unit":"cup","factor":0.004409171075837742,"kind":"mixed","is_approx":false,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"g","to_unit":"oz","factor":0.03527336860670194,"kind":"mass","is_approx":true,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"g","to_unit":"lb","factor":0.002204585537918871,"kind":"mass","is_approx":false,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"tsp","to_unit":"tbsp","factor":0.3333333333333333,"kind":"volume","is_approx":false,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"tsp","to_unit":"cup","factor":0.020833333333333332,"kind":"volume","is_approx":false,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"tsp","to_unit":"oz","factor":0.16666666666666666,"kind":"mixed","is_approx":true,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"tsp","to_unit":"lb","factor":0.010416666666666666,"kind":"mixed","is_approx":false,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"tsp","to_unit":"g","factor":4.722222222222222,"kind":"mixed","is_approx":false,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"tbsp","to_unit":"tsp","factor":3.0,"kind":"volume","is_approx":false,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"tbsp","to_unit":"cup","factor":0.0625,"kind":"volume","is_approx":false,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"tbsp","to_unit":"oz","factor":0.5,"kind":"mixed","is_approx":true,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"tbsp","to_unit":"lb","factor":0.03125,"kind":"mixed","is_approx":false,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"tbsp","to_unit":"g","factor":14.166666666666666,"kind":"mixed","is_approx":false,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"cup","to_unit":"tsp","factor":48.0,"kind":"volume","is_approx":false,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"cup","to_unit":"tbsp","factor":16.0,"kind":"volume","is_approx":false,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"cup","to_unit":"oz","factor":8.0,"kind":"mixed","is_approx":true,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"cup","to_unit":"lb","factor":0.5,"kind":"mixed","is_approx":false,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"cup","to_unit":"g","factor":226.66666666666666,"kind":"mixed","is_approx":false,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"oz","to_unit":"tsp","factor":6.0,"kind":"mixed","is_approx":true,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"oz","to_unit":"tbsp","factor":2.0,"kind":"mixed","is_approx":true,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"oz","to_unit":"cup","factor":0.125,"kind":"mixed","is_approx":true,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"oz","to_unit":"lb","factor":0.0625,"kind":"mass","is_approx":true,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"oz","to_unit":"g","factor":28.333333333333332,"kind":"mass","is_approx":true,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"lb","to_unit":"tsp","factor":96.0,"kind":"mixed","is_approx":false,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"lb","to_unit":"tbsp","factor":32.0,"kind":"mixed","is_approx":false,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"lb","to_unit":"cup","factor":2.0,"kind":"mixed","is_approx":false,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"lb","to_unit":"oz","factor":16.0,"kind":"mass","is_approx":true,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"lb","to_unit":"g","factor":453.3333333333333,"kind":"mass","is_approx":false,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"g","to_unit":"tsp","factor":0.21176470588235294,"kind":"mixed","is_approx":false,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"g","to_unit":"tbsp","factor":0.07058823529411765,"kind":"mixed","is_approx":false,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"g","to_unit":"cup","factor":0.004411764705882353,"kind":"mixed","is_approx":false,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"g","to_unit":"oz","factor":0.03529411764705882,"kind":"mass","is_approx":true,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"g","to_unit":"lb","factor":0.0022058823529411764,"kind":"mass","is_approx":false,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"tsp","to_unit":"tbsp","factor":0.3333333333333333,"kind":"volume","is_approx":false,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"tsp","to_unit":"cup","factor":0.020833333333333332,"kind":"volume","is_approx":false,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"tsp","to_unit":"oz","factor":0.16666666666666666,"kind":"mixed","is_approx":true,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"tsp","to_unit":"lb","factor":0.010416666666666666,"kind":"mixed","is_approx":false,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"tsp","to_unit":"g","factor":4.729166666666667,"kind":"mixed","is_approx":false,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"tbsp","to_unit":"tsp","factor":3.0,"kind":"volume","is_approx":false,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"tbsp","to_unit":"cup","factor":0.0625,"kind":"volume","is_approx":false,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"tbsp","to_unit":"oz","factor":0.5,"kind":"mixed","is_approx":true,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"tbsp","to_unit":"lb","factor":0.03125,"kind":"mixed","is_approx":false,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"tbsp","to_unit":"g","factor":14.1875,"kind":"mixed","is_approx":false,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"cup","to_unit":"tsp","factor":48.0,"kind":"volume","is_approx":false,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"cup","to_unit":"tbsp","factor":16.0,"kind":"volume","is_approx":false,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"cup","to_unit":"oz","factor":8.0,"kind":"mixed","is_approx":true,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"cup","to_unit":"lb","factor":0.5,"kind":"mixed","is_approx":false,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"cup","to_unit":"g","factor":227.0,"kind":"mixed","is_approx":false,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"oz","to_unit":"tsp","factor":6.0,"kind":"mixed","is_approx":true,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"oz","to_unit":"tbsp","factor":2.0,"kind":"mixed","is_approx":true,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"oz","to_unit":"cup","factor":0.125,"kind":"mixed","is_approx":true,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"oz","to_unit":"lb","factor":0.0625,"kind":"mass","is_approx":true,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"oz","to_unit":"g","factor":28.375,"kind":"mass","is_approx":true,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"lb","to_unit":"tsp","factor":96.0,"kind":"mixed","is_approx":false,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"lb","to_unit":"tbsp","factor":32.0,"kind":"mixed","is_approx":false,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"lb","to_unit":"cup","factor":2.0,"kind":"mixed","is_approx":false,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"lb","to_unit":"oz","factor":16.0,"kind":"mass","is_approx":true,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"lb","to_unit":"g","factor":454.0,"kind":"mass","is_approx":false,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"g","to_unit":"tsp","factor":0.21145374449339208,"kind":"mixed","is_approx":false,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"g","to_unit":"tbsp","factor":0.07048458149779736,"kind":"mixed","is_approx":false,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"g","to_unit":"cup","factor":0.004405286343612335,"kind":"mixed","is_approx":false,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"g","to_unit":"oz","factor":0.03524229074889868,"kind":"mass","is_approx":true,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"g","to_unit":"lb","factor":0.0022026431718061676,"kind":"mass","is_approx":false,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"tsp","to_unit":"tbsp","factor":0.3333333333333333,"kind":"volume","is_approx":false,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"tsp","to_unit":"cup","factor":0.020833333333333332,"kind":"volume","is_approx":false,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"tsp","to_unit":"oz","factor":0.16666666666666666,"kind":"mixed","is_approx":true,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"tsp","to_unit":"lb","factor":0.010416666666666666,"kind":"mixed","is_approx":false,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"tsp","to_unit":"g","factor":4.7250000000000005,"kind":"mixed","is_approx":false,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"tbsp","to_unit":"tsp","factor":3.0,"kind":"volume","is_approx":false,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"tbsp","to_unit":"cup","factor":0.0625,"kind":"volume","is_approx":false,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"tbsp","to_unit":"oz","factor":0.5,"kind":"mixed","is_approx":true,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"tbsp","to_unit":"lb","factor":0.03125,"kind":"mixed","is_approx":false,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"tbsp","to_unit":"g","factor":14.175,"kind":"mixed","is_approx":false,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"cup","to_unit":"tsp","factor":48.0,"kind":"volume","is_approx":false,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"cup","to_unit":"tbsp","factor":16.0,"kind":"volume","is_approx":false,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"cup","to_unit":"oz","factor":8.0,"kind":"mixed","is_approx":true,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"cup","to_unit":"lb","factor":0.5,"kind":"mixed","is_approx":false,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"cup","to_unit":"g","factor":226.8,"kind":"mixed","is_approx":false,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"oz","to_unit":"tsp","factor":6.0,"kind":"mixed","is_approx":true,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"oz","to_unit":"tbsp","factor":2.0,"kind":"mixed","is_approx":true,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"oz","to_unit":"cup","factor":0.125,"kind":"mixed","is_approx":true,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"oz","to_unit":"lb","factor":0.0625,"kind":"mass","is_approx":true,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"oz","to_unit":"g","factor":28.35,"kind":"mass","is_approx":true,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"lb","to_unit":"tsp","factor":96.0,"kind":"mixed","is_approx":false,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"lb","to_unit":"tbsp","factor":32.0,"kind":"mixed","is_approx":false,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"lb","to_unit":"cup","factor":2.0,"kind":"mixed","is_approx":false,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"lb","to_unit":"oz","factor":16.0,"kind":"mass","is_approx":true,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"lb","to_unit":"g","factor":453.6,"kind":"mass","is_approx":false,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"g","to_unit":"tsp","factor":0.21164021164021163,"kind":"mixed","is_approx":false,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"g","to_unit":"tbsp","factor":0.07054673721340388,"kind":"mixed","is_approx":false,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"g","to_unit":"cup","factor":0.004409171075837742,"kind":"mixed","is_approx":false,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"g","to_unit":"oz","factor":0.03527336860670194,"kind":"mass","is_approx":true,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"g","to_unit":"lb","factor":0.002204585537918871,"kind":"mass","is_approx":false,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"tsp","to_unit":"tbsp","factor":0.3333333333333333,"kind":"volume","is_approx":false,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"tsp","to_unit":"cup","factor":0.020833333333333332,"kind":"volume","is_approx":false,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"tsp","to_unit":"oz","factor":0.16666666666666666,"kind":"mixed","is_approx":true,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"tsp","to_unit":"lb","factor":0.010416666666666666,"kind":"mixed","is_approx":false,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"tsp","to_unit":"g","factor":4.723958333333333,"kind":"mixed","is_approx":false,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"tbsp","to_unit":"tsp","factor":3.0,"kind":"volume","is_approx":false,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"tbsp","to_unit":"cup","factor":0.0625,"kind":"volume","is_approx":false,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"tbsp","to_unit":"oz","factor":0.5,"kind":"mixed","is_approx":true,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"tbsp","to_unit":"lb","factor":0.03125,"kind":"mixed","is_approx":false,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"tbsp","to_unit":"g","factor":14.171875,"kind":"mixed","is_approx":false,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"cup","to_unit":"tsp","factor":48.0,"kind":"volume","is_approx":false,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"cup","to_unit":"tbsp","factor":16.0,"kind":"volume","is_approx":false,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"cup","to_unit":"oz","factor":8.0,"kind":"mixed","is_approx":true,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"cup","to_unit":"lb","factor":0.5,"kind":"mixed","is_approx":false,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"cup","to_unit":"g","factor":226.75,"kind":"mixed","is_approx":false,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"oz","to_unit":"tsp","factor":6.0,"kind":"mixed","is_approx":true,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"oz","to_unit":"tbsp","factor":2.0,"kind":"mixed","is_approx":true,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"oz","to_unit":"cup","factor":0.125,"kind":"mixed","is_approx":true,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"oz","to_unit":"lb","factor":0.0625,"kind":"mass","is_approx":true,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"oz","to_unit":"g","factor":28.34375,"kind":"mass","is_approx":true,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"lb","to_unit":"tsp","factor":96.0,"kind":"mixed","is_approx":false,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"lb","to_unit":"tbsp","factor":32.0,"kind":"mixed","is_approx":false,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"lb","to_unit":"cup","factor":2.0,"kind":"mixed","is_approx":false,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"lb","to_unit":"oz","factor":16.0,"kind":"mass","is_approx":true,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"lb","to_unit":"g","factor":453.5,"kind":"mass","is_approx":false,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"g","to_unit":"tsp","factor":0.21168687982359427,"kind":"mixed","is_approx":false,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"g","to_unit":"tbsp","factor":0.07056229327453142,"kind":"mixed","is_approx":false,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"g","to_unit":"cup","factor":0.004410143329658214,"kind":"mixed","is_approx":false,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"g","to_unit":"oz","factor":0.03528114663726571,"kind":"mass","is_approx":true,"source":"Baking conversions - Sheet1.csv"},{"from_unit":"g","to_unit":"lb","factor":0.002205071664829107,"kind":"mass","is_approx":false,"source":"Baking conversions - Sheet1.csv"}];
      const ins = conn.prepare(`
        INSERT OR REPLACE INTO unit_conversions
          (FromUnit, ToUnit, Factor, Kind, IsApprox, Source, UpdatedAt)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);
      const tx = conn.transaction(() => {
        seed.forEach(r => {
          ins.run(r.from_unit, r.to_unit, r.factor, r.kind || null, r.is_approx ? 1 : 0, r.source || null, now);
        });
      });
      tx();
    }
  } catch (e) {
    console.warn('unit_conversions table creation warning:', e && e.message ? e.message : e);
  }



  // Enhance pantry for expiration tracking and thresholds
  if (!hasColumn(conn, 'pantry', 'expiration_date')) {
    conn.exec('ALTER TABLE pantry ADD COLUMN expiration_date TEXT;');
  }
  if (!hasColumn(conn, 'pantry', 'low_stock_threshold')) {
    conn.exec('ALTER TABLE pantry ADD COLUMN low_stock_threshold INTEGER DEFAULT 0;');
  }
  if (!hasColumn(conn, 'pantry', 'is_favorite')) {
    conn.exec('ALTER TABLE pantry ADD COLUMN is_favorite INTEGER DEFAULT 0;');
  }

  // Recipe collections for favorites and organization
  try {
    conn.exec(`
      CREATE TABLE IF NOT EXISTS recipe_collections (
        collection_id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        description TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      );
    `);

    conn.exec(`
      CREATE TABLE IF NOT EXISTS recipe_collection_map (
        recipe_id TEXT NOT NULL,
        collection_id INTEGER NOT NULL,
        PRIMARY KEY (recipe_id, collection_id),
        FOREIGN KEY (recipe_id) REFERENCES recipes(RecipeId) ON DELETE CASCADE,
        FOREIGN KEY (collection_id) REFERENCES recipe_collections(collection_id) ON DELETE CASCADE
      );
    `);
  } catch (e) {
    console.warn('recipe_collections table creation warning:', e && e.message ? e.message : e);
  }

  // Add default servings and favorite to recipes for scaling
  if (!hasColumn(conn, 'recipes', 'default_servings')) {
    conn.exec('ALTER TABLE recipes ADD COLUMN default_servings INTEGER DEFAULT 4;');
  }
  if (!hasColumn(conn, 'recipes', 'is_favorite')) {
    conn.exec('ALTER TABLE recipes ADD COLUMN is_favorite INTEGER DEFAULT 0;');
  }
}

module.exports = {
  db,
  createDb,
  getDbPathDefault,
  setDbPath,
};
