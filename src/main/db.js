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
  try {
    // Attempt to require electron.app dynamically
    const { app } = require('electron');
    if (app) {
      // Production: resources are usually next to app.asar
      const appPath = app.getAppPath(); // .../Contents/Resources/app.asar
      const unpackedPath = path.join(path.dirname(appPath), 'app.asar.unpacked', 'data', 'foodie.sqlite');

      console.log('[db] Checking unpacked path:', unpackedPath);
      if (fs.existsSync(unpackedPath)) return unpackedPath;
    }
  } catch (e) {
    console.warn('[db] Electron app path check failed:', e);
  }

  // Fallback to resourcesPath (standard Electron property)
  if (process.resourcesPath) {
    const p = path.join(process.resourcesPath, 'app.asar.unpacked', 'data', 'foodie.sqlite');
    console.log('[db] Checking resourcesPath:', p);
    if (fs.existsSync(p)) return p;
  }

  // Development fallback
  const devPath = path.resolve(process.cwd(), 'data', 'foodie.sqlite');
  console.log('[db] Checking dev path:', devPath);
  return devPath;
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
      try { tmp.close(); } catch (_) { }
    }
  } catch (_) {
    return null;
  }
}

function copyFolderSync(from, to) {
  if (!fs.existsSync(to)) fs.mkdirSync(to, { recursive: true });
  const entries = fs.readdirSync(from, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(from, entry.name);
    const destPath = path.join(to, entry.name);

    if (entry.isDirectory()) {
      copyFolderSync(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

function seedUserDataDbIfNeeded_(liveDbPath) {
  // liveDbPath is expected to be userData/foodie.sqlite when Electron is available.
  const seedPath = getSeedDbPath_();
  if (!fs.existsSync(seedPath)) {
    console.warn('[db] Seed database not found at:', seedPath);
    return;
  }

  const liveDir = path.dirname(liveDbPath);
  const seedDir = path.dirname(seedPath);
  const seedImagesDir = path.join(seedDir, 'images');
  const liveImagesDir = path.join(liveDir, 'images');

  // If live DB doesn't exist, copy seed AND images.
  if (!fs.existsSync(liveDbPath)) {
    console.log('[db] Copying seed database...');
    ensureDirForFile(liveDbPath);
    fs.copyFileSync(seedPath, liveDbPath);

    // Also copy images if available
    if (fs.existsSync(seedImagesDir)) {
      console.log('[db] Copying seed images...');
      try {
        copyFolderSync(seedImagesDir, liveImagesDir);
      } catch (err) {
        console.error('[db] Failed to copy images:', err);
      }
    }
    return;
  }

  // If live DB exists but contains no recipes, and seed contains recipes, replace with backup.
  const liveCount = countRecipesSafe_(liveDbPath);
  const seedCount = countRecipesSafe_(seedPath);
  if (liveCount === 0 && seedCount && seedCount > 0) {
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const bak = liveDbPath + `.bak.${stamp}`;
    try { fs.copyFileSync(liveDbPath, bak); } catch (_) { }
    fs.copyFileSync(seedPath, liveDbPath);

    // Also copy images in this scenario
    if (fs.existsSync(seedImagesDir)) {
      try {
        console.log('[db] Copying seed images (overwrite)...');
        copyFolderSync(seedImagesDir, liveImagesDir);
      } catch (err) {
        console.error('[db] Failed to copy images:', err);
      }
    }
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
  } catch (_) { }

  try {
    if (electronApp && typeof electronApp.getPath === 'function') {
      return path.join(electronApp.getPath('userData'), 'foodie.sqlite');
    }
  } catch (_) { }

  // Fallback (non-Electron contexts): project-local DB
  return path.resolve(process.cwd(), 'data', 'foodie.sqlite');
}

function setDbPath(p) {
  DB_PATH = String(p || '').trim();
  if (DB) {
    try { DB.close(); } catch (_) { }
    DB = null;
  }
}

function _openDb() {
  if (DB) return DB;
  const p = DB_PATH || getDbPathDefault();
  // Seed userData DB from ./data/foodie.sqlite when appropriate.
  try { seedUserDataDbIfNeeded_(p); } catch (_) { }
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
    
    -- Users table for multi-user support
    CREATE TABLE IF NOT EXISTS users (
      user_id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      email TEXT,
      avatar_emoji TEXT,
      is_active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    -- User Plan Meals for per-user meal planning
    CREATE TABLE IF NOT EXISTS user_plan_meals (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      date TEXT NOT NULL,
      slot TEXT NOT NULL, -- 'breakfast', 'lunch', 'dinner'
      recipe_id TEXT, -- NULL if custom/note
      title TEXT,
      is_main_dish INTEGER DEFAULT 0,
      notes TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(user_id) REFERENCES users(user_id) ON DELETE CASCADE,
      FOREIGN KEY(recipe_id) REFERENCES recipes(RecipeId) ON DELETE SET NULL
    );
    
    -- Additional Items (Sides/Desserts)
    CREATE TABLE IF NOT EXISTS plan_additional_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL,
      slot TEXT NOT NULL,
      recipe_id TEXT NOT NULL,
      title TEXT,
      item_type TEXT,
      sort_order INTEGER DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      meal_id INTEGER,
      FOREIGN KEY(recipe_id) REFERENCES recipes(RecipeId) ON DELETE CASCADE,
      FOREIGN KEY(meal_id) REFERENCES user_plan_meals(id) ON DELETE CASCADE
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
    CREATE INDEX IF NOT EXISTS idx_user_plan_meals_date ON user_plan_meals(date, user_id);
    CREATE INDEX IF NOT EXISTS idx_additional_items_date_slot ON plan_additional_items(date, slot);
    CREATE INDEX IF NOT EXISTS idx_additional_items_meal ON plan_additional_items(meal_id);
  `);

  // Seed default user 'Whole Family' if users table is empty
  const userCount = conn.prepare("SELECT COUNT(*) as c FROM users").get();
  if (userCount && userCount.c === 0) {
    console.log('[db] Seeding default "Whole Family" user...');
    conn.prepare("INSERT INTO users (name, avatar_emoji) VALUES (?, ?)").run('Whole Family', '👨‍👩‍👧‍👦');
  }

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
      const defaults = ['Produce', 'Dairy', 'Meat', 'Seafood', 'Pantry', 'Snacks', 'Frozen', 'Bakery', 'Deli', 'Beverages', 'Household', 'Spice', 'Other'];
      const ins = conn.prepare("INSERT OR IGNORE INTO ingredient_categories(category, sort_order) VALUES(?, ?)");
      const tx = conn.transaction(() => {
        defaults.forEach((c, i) => ins.run(c, i + 1));
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
