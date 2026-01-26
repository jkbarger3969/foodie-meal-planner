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

function getDbPathDefault(app) {
  // SIMPLIFIED: Always use the project-local ./data/foodie.sqlite as both seed and user database.
  // This eliminates the need to maintain separate databases.
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
  // No seeding needed - we use the same database directly
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
      QtyText TEXT,
      StoreId TEXT,
      Notes TEXT,
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

  // Add Google Calendar event ID columns to plans table
  const googleEventCols = [
    ['BreakfastGoogleEventId', 'TEXT'],
    ['LunchGoogleEventId', 'TEXT'],
    ['DinnerGoogleEventId', 'TEXT']
  ];
  for (const [colName, colDef] of googleEventCols) {
    if (!hasColumn(conn, 'plans', colName)) {
      conn.exec(`ALTER TABLE plans ADD COLUMN ${colName} ${colDef};`);
    }
  }

  // Add Category column to ingredients table for older databases
  if (!hasColumn(conn, 'ingredients', 'Category')) {
    conn.exec('ALTER TABLE ingredients ADD COLUMN Category TEXT;');
  }

  // Add IngredientName column to ingredients table for better printing/formatting
  if (!hasColumn(conn, 'ingredients', 'IngredientName')) {
    conn.exec('ALTER TABLE ingredients ADD COLUMN IngredientName TEXT;');
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

  

  // Pantry inventory columns for persistent depletion (added if missing)
  if (!hasColumn(conn, 'pantry', 'Category')) {
    conn.exec('ALTER TABLE pantry ADD COLUMN Category TEXT;');
  }
  if (!hasColumn(conn, 'pantry', 'QtyNum')) {
    // REAL is used for numeric quantities to support fractional units.
    conn.exec('ALTER TABLE pantry ADD COLUMN QtyNum REAL;');
  }
  if (!hasColumn(conn, 'pantry', 'Unit')) {
    conn.exec('ALTER TABLE pantry ADD COLUMN Unit TEXT;');
  }

  // Ledger table to track per-plan, per-ingredient pantry deductions (enables persistent inventory depletion)
  try {
    conn.exec(`
      CREATE TABLE IF NOT EXISTS plan_meal_ingredients (
        PlanDate TEXT NOT NULL,
        Slot TEXT NOT NULL,
        RecipeId TEXT NOT NULL,
        IngredientNorm TEXT NOT NULL,
        RequiredBase REAL NOT NULL DEFAULT 0,
        DeductedBase REAL NOT NULL DEFAULT 0,
        BaseUnit TEXT NOT NULL,
        UpdatedAt TEXT,
        PRIMARY KEY (PlanDate, Slot, IngredientNorm)
      );

      CREATE INDEX IF NOT EXISTS idx_pmi_plandate_slot ON plan_meal_ingredients(PlanDate, Slot);
      CREATE INDEX IF NOT EXISTS idx_pmi_recipeid ON plan_meal_ingredients(RecipeId);
      CREATE INDEX IF NOT EXISTS idx_pmi_ingredientnorm ON plan_meal_ingredients(IngredientNorm);
    `);
  } catch (e) {
    console.warn('plan_meal_ingredients table creation warning:', e && e.message ? e.message : e);
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
        is_main_dish INTEGER DEFAULT 0,
        PRIMARY KEY (recipe_id, collection_id),
        FOREIGN KEY (recipe_id) REFERENCES recipes(RecipeId) ON DELETE CASCADE,
        FOREIGN KEY (collection_id) REFERENCES recipe_collections(collection_id) ON DELETE CASCADE
      );
    `);
  } catch (e) {
    console.warn('recipe_collections table creation warning:', e && e.message ? e.message : e);
  }

  // Add is_main_dish column to existing recipe_collection_map tables
  if (!hasColumn(conn, 'recipe_collection_map', 'is_main_dish')) {
    conn.exec('ALTER TABLE recipe_collection_map ADD COLUMN is_main_dish INTEGER DEFAULT 0;');
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
