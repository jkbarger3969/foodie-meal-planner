const crypto = require('crypto');
const { db } = require('./db');
const { upsertEvent, deleteEvent } = require('./calendar');

function ok_(obj){ return Object.assign({ ok: true }, obj || {}); }
function err_(msg){ return { ok: false, error: String(msg || 'Unknown error') }; }

function normLower_(s){ return String(s||'').trim().toLowerCase(); }
function clamp_(n, lo, hi){ n = Number(n||0); return Math.max(lo, Math.min(hi, n)); }


function parseQtyText_(s){
  // Best-effort quantity parser for pantry QtyText.
  // Supports: "1", "1.5", "1/2", "1 1/2", optionally followed by a unit word (e.g. "lb", "cups").
  const raw = String(s || '').trim();
  if (!raw) return { qtyNum: null, unit: '', raw };
  const m = raw.match(/^\s*(\d+\s+\d+\/\d+|\d+\/\d+|\d+(?:\.\d+)?)\s*([^\d].*)?$/);
  if (!m) return { qtyNum: null, unit: '', raw };
  const qtyPart = String(m[1] || '').trim();
  const rest = String(m[2] || '').trim();
  let qtyNum = null;

  const parseFraction = (t) => {
    const mm = t.match(/^(\d+)\/(\d+)$/);
    if (!mm) return null;
    const a = Number(mm[1]), b = Number(mm[2]);
    if (!Number.isFinite(a) || !Number.isFinite(b) || b === 0) return null;
    return a / b;
  };

  if (/^\d+\s+\d+\/\d+$/.test(qtyPart)) {
    const parts = qtyPart.split(/\s+/);
    const whole = Number(parts[0]);
    const frac = parseFraction(parts[1]);
    if (Number.isFinite(whole) && frac !== null) qtyNum = whole + frac;
  } else if (/^\d+\/\d+$/.test(qtyPart)) {
    const frac = parseFraction(qtyPart);
    if (frac !== null) qtyNum = frac;
  } else {
    const n = Number(qtyPart);
    if (Number.isFinite(n)) qtyNum = n;
  }

  let unit = '';
  if (rest) {
    unit = rest.split(/\s+/)[0] || '';
    unit = unit.replace(/[.,;:()\[\]{}]/g, '').trim();
  }

  return { qtyNum: (qtyNum !== null && Number.isFinite(qtyNum)) ? qtyNum : null, unit, raw };
}

let _pantryColsCache = null;
function pantryCols_(){
  if (_pantryColsCache) return _pantryColsCache;
  try {
    const cols = db().prepare("PRAGMA table_info(pantry)").all().map(r => r.name);
    _pantryColsCache = new Set(cols);
  } catch (_) {
    _pantryColsCache = new Set();
  }
  return _pantryColsCache;
}
function pantryHasCol_(name){
  return pantryCols_().has(name);
}

function ymd_(d){
  const dt = (d instanceof Date) ? d : new Date(d);
  const y = dt.getFullYear();
  const m = String(dt.getMonth()+1).padStart(2,'0');
  const da = String(dt.getDate()).padStart(2,'0');
  return `${y}-${m}-${da}`;
}
function addDays_(dateYmd, days){
  const [y,m,d] = String(dateYmd).split('-').map(Number);
  const dt = new Date(y, m-1, d);
  dt.setDate(dt.getDate() + Number(days||0));
  return ymd_(dt);
}
function uuidShort_(prefix){
  const id = crypto.randomUUID().replace(/-/g,'').slice(0, 12);
  return `${prefix}_${id}`;
}

// --- helpers to map DB rows to UI objects ---
function recipeRowToObj(r){
  return {
    RecipeId: r.RecipeId,
    Title: r.Title,
    TitleLower: r.TitleLower,
    URL: r.URL || '',
    Cuisine: r.Cuisine || '',
    MealType: r.MealType || 'Any',
    Notes: r.Notes || '',
    Instructions: r.Instructions || '',
    Image_Name: r.Image_Name || ''
  };
}
function planRowToObj(p){
  const schema = plansSchema_();

  if (schema.hasNew) {
    return {
      PlanId: p.Date,
      Date: p.Date,
      Breakfast: p.BreakfastTitle ? { 
        RecipeId: p.BreakfastRecipeId || '', 
        Title: p.BreakfastTitle,
        UseLeftovers: p.BreakfastUseLeftovers ? true : false,
        From: p.BreakfastFrom || ''
      } : null,
      Lunch: p.LunchTitle ? { 
        RecipeId: p.LunchRecipeId || '', 
        Title: p.LunchTitle,
        UseLeftovers: p.LunchUseLeftovers ? true : false,
        From: p.LunchFrom || ''
      } : null,
      Dinner: p.DinnerTitle ? { 
        RecipeId: p.DinnerRecipeId || '', 
        Title: p.DinnerTitle,
        UseLeftovers: p.DinnerUseLeftovers ? true : false,
        From: p.DinnerFrom || ''
      } : null,
      Calendar: {
        BreakfastEventId: p.BreakfastEventId || '',
        LunchEventId: p.LunchEventId || '',
        DinnerEventId: p.DinnerEventId || ''
      }
    };
  }

  // Legacy plans schema: Breakfast/Lunch/Dinner columns contain JSON strings
  if (schema.hasLegacy) {
    let cal = {};
    try { cal = p.Calendar ? JSON.parse(String(p.Calendar)) : {}; } catch (_) { cal = {}; }
    return {
      PlanId: p.Date,
      Date: p.Date,
      Breakfast: parseMealJson_(p.Breakfast),
      Lunch: parseMealJson_(p.Lunch),
      Dinner: parseMealJson_(p.Dinner),
      Calendar: {
        BreakfastEventId: String((cal && cal.BreakfastEventId) || ''),
        LunchEventId: String((cal && cal.LunchEventId) || ''),
        DinnerEventId: String((cal && cal.DinnerEventId) || '')
      }
    };
  }

  // Fallback: return minimal structure
  return { PlanId: p.Date, Date: p.Date, Breakfast:null, Lunch:null, Dinner:null, Calendar:{} };
}


// ---- plans schema compatibility ----
let _plansSchemaCache = null;
function plansSchema_(){
  if (_plansSchemaCache) return _plansSchemaCache;
  const cols = db().prepare("PRAGMA table_info(plans)").all().map(r => r.name);
  const hasNew = cols.includes('BreakfastRecipeId') && cols.includes('BreakfastTitle');
  const hasLegacy = cols.includes('Breakfast') && cols.includes('Lunch') && cols.includes('Dinner');
  _plansSchemaCache = { hasNew, hasLegacy };
  return _plansSchemaCache;
}
function parseMealJson_(s){
  if (!s) return null;
  try {
    const obj = JSON.parse(String(s));
    if (obj && (obj.RecipeId || obj.Title)) {
      return { 
        RecipeId: String(obj.RecipeId||''),
        Title: String(obj.Title||''),
        UseLeftovers: obj.UseLeftovers || false,
        From: obj.From || ''
      };
    }
  } catch (_) {}
  return null;
}
function mealToJson_(meal){
  if (!meal) return null;
  const rid = String(meal.RecipeId || '');
  const title = String(meal.Title || '');
  if (!rid && !title) return null;
  return JSON.stringify({ 
    RecipeId: rid, 
    Title: title,
    UseLeftovers: meal.UseLeftovers || false,
    From: meal.From || ''
  });
}

async function handleApiCall({ fn, payload, store }) {
  try {
    switch (fn) {
      case 'listStores': return listStores();
      case 'addStore': return addStore(payload);
      case 'deleteStore': return deleteStore(payload);

      case 'listRecipesPage': return listRecipesPage(payload);
      case 'listRecipesAll': return listRecipesAll(payload);
      case 'getRecipe': return getRecipe(payload);
      case 'listRecipeIngredients': return listRecipeIngredients(payload);
      case 'upsertRecipeWithIngredients': return upsertRecipeWithIngredients(payload);
      case 'deleteRecipeCascade': return deleteRecipeCascade(payload);
      case 'toggleRecipeFavorite': return toggleRecipeFavorite(payload);
      case 'searchRecipesFuzzy': return searchRecipesFuzzy(payload);
      case 'getRecipeSuggestionsFromPantry': return getRecipeSuggestionsFromPantry(payload);

      case 'getPlansRange': return getPlansRange(payload);
      case 'upsertPlanMeal': return upsertPlanMeal(payload);
      case 'swapPlanMeals': return swapPlanMeals(payload);

      case 'buildShoppingList': return buildShoppingList(payload);

      // Shopping list: assign/reassign store for items in the selected plan range
      case 'assignShoppingItemStore': return assignShoppingItemStore(payload);

      case 'listPantry': return listPantry(payload);
      case 'upsertPantryItem': return upsertPantryItem(payload);
      case 'deletePantryItem': return deletePantryItem(payload);
      case 'getExpiringPantryItems': return getExpiringPantryItems(payload);
      case 'getLowStockPantryItems': return getLowStockPantryItems(payload);

      case 'calendarSyncRange': return calendarSyncRange(payload, store);

      // Categorization API
      case 'getCategoryOverrides': return getCategoryOverrides();
      case 'saveCategoryOverride': return saveCategoryOverride(payload);
      case 'deleteCategoryOverride': return deleteCategoryOverride(payload);
      case 'getIngredientCategories': return getIngredientCategories();
      case 'setIngredientCategories': return setIngredientCategories(payload);
      case 'getUnitConversions': return getUnitConversions(payload);
      case 'convertQty': return convertQty(payload);
      case 'classifyIngredient': return classifyIngredient(payload);
      case 'trainIngredientCategory': return trainIngredientCategory(payload);

      default:
        return err_('Unknown function: ' + fn);
    }
  } catch (e) {
    return err_(e && e.message ? e.message : e);
  }
}

// ================= STORES =================
function listStores(){
  const rows = db().prepare("SELECT StoreId, Name, Priority FROM stores ORDER BY Priority ASC, StoreId ASC").all();
  const seen = new Set();
  const out = [];

  // Prefer human-readable IDs (e.g. 'costco') over generated ones (e.g. 'store_xxx') when names match.
  // Dedupe by normalized name.
  const preferred = (a, b) => {
    const aGen = /^store[_-]/i.test(String(a.StoreId||''));
    const bGen = /^store[_-]/i.test(String(b.StoreId||''));
    if (aGen !== bGen) return aGen ? b : a;
    // tie-breaker: lower StoreId
    return String(a.StoreId||'') <= String(b.StoreId||'') ? a : b;
  };

  const byName = new Map();
  for (const r of rows) {
    const name = String(r.Name || '').trim();
    if (!name) continue;
    const key = name.toLowerCase();
    const cur = byName.get(key);
    const cand = { StoreId: r.StoreId, Name: name, Priority: r.Priority };
    byName.set(key, cur ? preferred(cur, cand) : cand);
  }

  // Keep stable ordering by Priority then Name
  out.push(...Array.from(byName.values()).sort((a,b) => {
    const pa = Number(a.Priority ?? 9999), pb = Number(b.Priority ?? 9999);
    if (pa !== pb) return pa - pb;
    return String(a.Name).localeCompare(String(b.Name));
  }));

  return ok_({ stores: out });
}

function addStore(payload){
  const name = String(payload && payload.name || '').trim();
  if (!name) return err_('Store name is required.');
  const priority = Number(payload && payload.priority || 999);

  const storeId = normLower_(name).replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || uuidShort_('store');
  db().prepare("INSERT INTO stores(StoreId, Name, Priority, UpdatedAt) VALUES(?,?,?,datetime('now')) ON CONFLICT(StoreId) DO UPDATE SET Name=excluded.Name, Priority=excluded.Priority, UpdatedAt=excluded.UpdatedAt")
    .run(storeId, name, priority);
  return ok_({ StoreId: storeId });
}

function deleteStore(payload){
  const storeId = String(payload && payload.storeId || '').trim();
  if (!storeId) return err_('Missing storeId.');
  db().prepare("DELETE FROM stores WHERE StoreId=?").run(storeId);
  return ok_({});
}

// ================= RECIPES =================
function listRecipesPage(payload){
  const q = normLower_((payload && payload.q) || '');
  const limit = clamp_(payload && payload.limit || 50, 10, 250);
  const pageToken = (payload && payload.pageToken) ? String(payload.pageToken) : '';

  let startAfterTitle = '';
  let startAfterDocId = '';
  if (pageToken) {
    const t = JSON.parse(pageToken);
    startAfterTitle = String(t.title || '');
    startAfterDocId = String(t.docId || '');
  }

  // Use (TitleLower, RecipeId) as cursor. Keep the exact semantics of Firestore ordering.
  const params = {};
  let where = "1=1";
  if (q) {
    where += " AND TitleLower >= @q AND TitleLower < @q2";
    params.q = q;
    params.q2 = q + '\uf8ff';
  }

  if (startAfterTitle && startAfterDocId) {
    where += " AND (TitleLower > @st OR (TitleLower = @st AND RecipeId > @sid))";
    params.st = startAfterTitle;
    params.sid = startAfterDocId;
  }

  const rows = db().prepare(`
    SELECT RecipeId, Title, TitleLower, URL, Cuisine, MealType, Notes, Instructions, Image_Name
    FROM recipes
    WHERE ${where}
    ORDER BY TitleLower ASC, RecipeId ASC
    LIMIT @limit
  `).all({ ...params, limit });

  const recipes = rows.map(recipeRowToObj);

  let nextPageToken = '';
  if (recipes.length === limit) {
    const last = recipes[recipes.length - 1];
    nextPageToken = JSON.stringify({ title: last.TitleLower || normLower_(last.Title), docId: last.RecipeId });
  }

  return ok_({ recipes, nextPageToken });
}

function listRecipesAll(payload){
  const q = normLower_((payload && payload.q) || '');
  // Local mode: return all matching recipes (no pagination)
  let rows;
  if (q) {
    // prefix match on TitleLower
    rows = db().prepare(
      "SELECT RecipeId, Title, TitleLower, URL, Cuisine, MealType, Notes, Instructions, Image_Name " +
      "FROM recipes WHERE TitleLower >= ? AND TitleLower < ? " +
      "ORDER BY TitleLower ASC, RecipeId ASC"
    ).all(q, q + '\uf8ff');
  } else {
    rows = db().prepare(
      "SELECT RecipeId, Title, TitleLower, URL, Cuisine, MealType, Notes, Instructions, Image_Name " +
      "FROM recipes ORDER BY TitleLower ASC, RecipeId ASC"
    ).all();
  }
  return ok_({ recipes: rows });
}

function getRecipe(payload){
  const recipeId = String(payload && payload.recipeId || '').trim();
  if (!recipeId) return err_('Missing recipeId.');
  const r = db().prepare("SELECT * FROM recipes WHERE RecipeId=?").get(recipeId);
  if (!r) return err_('Recipe not found.');
  return ok_({ recipe: recipeRowToObj(r) });
}

function listRecipeIngredients(payload){
  const recipeId = String(payload && payload.recipeId || '').trim();
  if (!recipeId) return err_('Missing recipeId.');
  const rows = db().prepare("SELECT IngredientNorm, IngredientRaw, Notes, QtyNum, QtyText, StoreId, Unit, Category, idx FROM ingredients WHERE RecipeId=? ORDER BY idx ASC").all(recipeId);
  return ok_({ items: rows.map(r => ({
    IngredientNorm: r.IngredientNorm || '',
    IngredientRaw: r.IngredientRaw || '',
    Notes: r.Notes || '',
    QtyNum: (r.QtyNum === null || r.QtyNum === undefined) ? '' : r.QtyNum,
    QtyText: r.QtyText || '',
    StoreId: r.StoreId || '',
    Unit: r.Unit || '',
    Category: r.Category || '',
    idx: r.idx
  }))});
}

function upsertRecipeWithIngredients(payload){
  const recipe = (payload && payload.recipe) || {};
  const items = Array.isArray(payload && payload.items) ? payload.items : [];

  const nowIso = new Date().toISOString();
  const recipeId = String(recipe.RecipeId || '').trim() || uuidShort_('rec');

  const title = String(recipe.Title || '').trim();
  if (!title) return err_('Title is required.');

  const docPatch = {
    RecipeId: recipeId,
    Title: title,
    TitleLower: normLower_(title),
    URL: String(recipe.URL || '').trim(),
    Cuisine: String(recipe.Cuisine || '').trim(),
    MealType: String(recipe.MealType || 'Any').trim() || 'Any',
    Notes: String(recipe.Notes || ''),
    Instructions: String(recipe.Instructions || ''),
    Image_Name: String(recipe.Image_Name || '').trim(),
    UpdatedAt: nowIso
  };

  const existing = db().prepare("SELECT CreatedAt FROM recipes WHERE RecipeId=?").get(recipeId);
  const createdAt = existing && existing.CreatedAt ? existing.CreatedAt : nowIso;

  db().prepare(`
    INSERT INTO recipes(RecipeId, Title, TitleLower, URL, Cuisine, MealType, Notes, Instructions, Image_Name, CreatedAt, UpdatedAt)
    VALUES(@RecipeId,@Title,@TitleLower,@URL,@Cuisine,@MealType,@Notes,@Instructions,@Image_Name,@CreatedAt,@UpdatedAt)
    ON CONFLICT(RecipeId) DO UPDATE SET
      Title=excluded.Title,
      TitleLower=excluded.TitleLower,
      URL=excluded.URL,
      Cuisine=excluded.Cuisine,
      MealType=excluded.MealType,
      Notes=excluded.Notes,
      Instructions=excluded.Instructions,
      Image_Name=excluded.Image_Name,
      UpdatedAt=excluded.UpdatedAt
  `).run({ ...docPatch, CreatedAt: createdAt });

  // Replace ingredients
  db().prepare("DELETE FROM ingredients WHERE RecipeId=?").run(recipeId);

  const cleaned = items
    .map(x => ({
      IngredientNorm: String(x.IngredientNorm || '').trim(),
      IngredientRaw: String(x.IngredientRaw || '').trim(),
      Notes: String(x.Notes || '').trim(),
      QtyNum: (x.QtyNum === '' || x.QtyNum === null || x.QtyNum === undefined) ? null : Number(x.QtyNum),
      QtyText: String(x.QtyText || '').trim(),
      StoreId: String(x.StoreId || '').trim(),
      Unit: String(x.Unit || '').trim(),
      Category: String(x.Category || '').trim()
    }))
    .filter(x => x.IngredientRaw);

  const ins = db().prepare("INSERT INTO ingredients(RecipeId, idx, IngredientNorm, IngredientRaw, Notes, QtyNum, QtyText, StoreId, Unit, Category) VALUES(?,?,?,?,?,?,?,?,?,?)");
  const tx = db().transaction(() => {
    cleaned.forEach((x, i) => {
      const norm = x.IngredientNorm || normLower_(x.IngredientRaw);
      ins.run(recipeId, i, norm, x.IngredientRaw, x.Notes, x.QtyNum, x.QtyText, x.StoreId, x.Unit, x.Category);
    });
  });
  tx();

  return ok_({ RecipeId: recipeId, ingredientCount: cleaned.length });
}

function deleteRecipeCascade(payload){
  const recipeId = String(payload && payload.recipeId || '').trim();
  if (!recipeId) return err_('Missing recipeId.');
  db().prepare("DELETE FROM recipes WHERE RecipeId=?").run(recipeId); // cascades to ingredients
  return ok_({});
}

function toggleRecipeFavorite(payload){
  const recipeId = String(payload && payload.recipeId || '').trim();
  if (!recipeId) return err_('Missing recipeId.');
  
  const current = db().prepare("SELECT is_favorite FROM recipes WHERE RecipeId=?").get(recipeId);
  if (!current) return err_('Recipe not found.');
  
  const newValue = current.is_favorite ? 0 : 1;
  db().prepare("UPDATE recipes SET is_favorite = ?, UpdatedAt = datetime('now') WHERE RecipeId=?").run(newValue, recipeId);
  return ok_({ isFavorite: newValue === 1 });
}

function searchRecipesFuzzy(payload){
  const q = normLower_((payload && payload.q) || '');
  if (!q) return ok_({ recipes: [] });
  
  // Fuzzy search using LIKE with wildcard matching
  const searchTerm = '%' + q.split(/\s+/).join('%') + '%';
  
  const rows = db().prepare(`
    SELECT RecipeId, Title, TitleLower, URL, Cuisine, MealType, Notes, Instructions, 
           Image_Name, is_favorite, default_servings
    FROM recipes 
    WHERE TitleLower LIKE ? 
       OR Title LIKE ?
       OR Cuisine LIKE ?
       OR Notes LIKE ?
    ORDER BY TitleLower ASC
    LIMIT 100
  `).all(searchTerm, searchTerm, searchTerm, searchTerm);
  
  return ok_({ recipes: rows.map(r => ({
    RecipeId: r.RecipeId,
    Title: r.Title,
    TitleLower: r.TitleLower,
    URL: r.URL || '',
    Cuisine: r.Cuisine || '',
    MealType: r.MealType || 'Any',
    Notes: r.Notes || '',
    Instructions: r.Instructions || '',
    Image_Name: r.Image_Name || '',
    is_favorite: !!r.is_favorite,
    default_servings: r.default_servings || 4
  }))});
}

function getRecipeSuggestionsFromPantry(payload){
  const pantryItems = db().prepare(`
    SELECT NameLower, Name FROM pantry WHERE QtyNum > 0 OR QtyText != ''
  `).all();
  
  if (!pantryItems.length) return ok_({ recipes: [] });
  
  // Build search patterns from pantry items
  const terms = pantryItems.slice(0, 10).map(p => {
    const name = p.NameLower || p.Name || '';
    return '%' + name.split(/\s+/)[0] + '%'; // First word of pantry item
  }).filter(Boolean);
  
  if (!terms.length) return ok_({ recipes: [] });
  
  const placeholders = terms.map(() => 'TitleLower LIKE ?').join(' OR ');
  const rows = db().prepare(`
    SELECT DISTINCT RecipeId, Title, TitleLower, URL, Cuisine, MealType, 
           Instructions, Image_Name, is_favorite, default_servings
    FROM recipes 
    WHERE ${placeholders}
    ORDER BY TitleLower ASC
    LIMIT 50
  `).all(...terms);
  
  return ok_({ recipes: rows.map(r => ({
    RecipeId: r.RecipeId,
    Title: r.Title,
    TitleLower: r.TitleLower,
    URL: r.URL || '',
    Cuisine: r.Cuisine || '',
    MealType: r.MealType || 'Any',
    Instructions: r.Instructions || '',
    Image_Name: r.Image_Name || '',
    is_favorite: !!r.is_favorite,
    default_servings: r.default_servings || 4
  })), matchedIngredients: pantryItems.map(p => p.Name).slice(0, 10) });
}

// ================= CATEGORIZATION =================

function getIngredientCategories(){
  try {
    const rows = db().prepare("SELECT category, sort_order FROM ingredient_categories ORDER BY sort_order ASC, category ASC").all();
    return ok_({ categories: rows.map(r => String(r.category || '')).filter(Boolean) });
  } catch (e) {
    return ok_({ categories: [] });
  }
}

function setIngredientCategories(payload){
  const catsRaw = (payload && payload.categories) ? payload.categories : [];
  if (!Array.isArray(catsRaw)) return err_('categories must be an array');

  const seen = new Set();
  const cats = [];
  for (const c0 of catsRaw) {
    const c = String(c0 ?? '').trim();
    if (!c) continue;
    const key = c.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    cats.push(c);
  }

  try {
    const conn = db();
    conn.prepare("CREATE TABLE IF NOT EXISTS ingredient_categories (category TEXT PRIMARY KEY, sort_order INTEGER DEFAULT 0, updated_at TEXT DEFAULT CURRENT_TIMESTAMP)").run();

    const del = conn.prepare("DELETE FROM ingredient_categories");
    const ins = conn.prepare("INSERT OR REPLACE INTO ingredient_categories(category, sort_order, updated_at) VALUES(?, ?, CURRENT_TIMESTAMP)");
    const tx = conn.transaction(() => {
      del.run();
      cats.forEach((c, i) => ins.run(c, i+1));
    });
    tx();

    return ok_({ categories: cats });
  } catch (e) {
    return err_(e && e.message ? e.message : e);
  }
}


function getUnitConversions(payload = {}) {
  try {
    const { fromUnit, toUnit, kind, limit } = payload || {};
    // If the table doesn't exist yet, return empty list (backward-compatible)
    const exists = db().prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='unit_conversions'").get();
    if (!exists) return ok_({ conversions: [] });

    const where = [];
    const args = [];
    if (fromUnit) { where.push("FromUnit = ?"); args.push(String(fromUnit).trim().toLowerCase()); }
    if (toUnit) { where.push("ToUnit = ?"); args.push(String(toUnit).trim().toLowerCase()); }
    if (kind) { where.push("Kind = ?"); args.push(String(kind)); }

    const sql = `
      SELECT FromUnit, ToUnit, Factor, Kind, IsApprox, Source
      FROM unit_conversions
      ${where.length ? "WHERE " + where.join(" AND ") : ""}
      ORDER BY FromUnit ASC, ToUnit ASC
      ${limit ? "LIMIT " + Math.max(1, Math.min(5000, Number(limit) || 0)) : ""}
    `;
    const rows = db().prepare(sql).all(...args).map(r => ({
      FromUnit: r.FromUnit,
      ToUnit: r.ToUnit,
      Factor: r.Factor,
      Kind: r.Kind || null,
      IsApprox: !!r.IsApprox,
      Source: r.Source || null
    }));
    return ok_({ conversions: rows });
  } catch (e) {
    return err_(e);
  }
}





// Unit conversion helpers (storage + retrieval + resolution)
// Note: This intentionally supports volume<->volume and mass<->mass conversion paths.
// It does not attempt volume<->mass conversions without ingredient-specific density rules.

const _UNIT_ALIASES = Object.freeze({
  // volume
  'teaspoon': 'tsp', 'teaspoons': 'tsp', 'tsp': 'tsp',
  'tablespoon': 'tbsp', 'tablespoons': 'tbsp', 'tbsp': 'tbsp', 'tbs': 'tbsp',
  'cup': 'cup', 'cups': 'cup',
  'pint': 'pint', 'pt': 'pint', 'pints': 'pint',
  'quart': 'quart', 'qt': 'quart', 'quarts': 'quart',
  'gallon': 'gallon', 'gal': 'gallon', 'gallons': 'gallon',
  'milliliter': 'ml', 'milliliters': 'ml', 'ml': 'ml',
  'liter': 'l', 'liters': 'l', 'l': 'l',
  'fluid ounce': 'fl_oz', 'fluid ounces': 'fl_oz', 'fl oz': 'fl_oz', 'floz': 'fl_oz', 'fl_oz': 'fl_oz',
  // mass
  'ounce': 'oz', 'ounces': 'oz', 'oz': 'oz',
  'pound': 'lb', 'pounds': 'lb', 'lb': 'lb', 'lbs': 'lb',
  'gram': 'g', 'grams': 'g', 'g': 'g',
  'kilogram': 'kg', 'kilograms': 'kg', 'kg': 'kg'
});

function canonicalUnit(u) {
  if (u == null) return '';
  let s = String(u).trim().toLowerCase();
  if (!s) return '';
  // normalize punctuation and whitespace
  s = s.replace(/\./g, '').replace(/\s+/g, ' ').trim();
  // common patterns
  if (s === 'fl. oz' || s === 'fl.oz') s = 'fl oz';
  // apply alias
  return _UNIT_ALIASES[s] || s.replace(/\s/g, '_');
}

function _loadConversionEdges({ allowApprox = false, allowMixed = false } = {}) {
  const exists = db().prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='unit_conversions'").get();
  if (!exists) return [];

  const rows = db().prepare(`
    SELECT FromUnit, ToUnit, Factor, Kind, IsApprox, Source
    FROM unit_conversions
  `).all();

  const edges = [];
  for (const r of rows) {
    const from = canonicalUnit(r.FromUnit);
    const to = canonicalUnit(r.ToUnit);
    const factor = Number(r.Factor);
    if (!from || !to) continue;
    if (!Number.isFinite(factor) || factor <= 0) continue;

    const kind = r.Kind || null;
    const isApprox = !!r.IsApprox;
    if (!allowApprox && isApprox) continue;
    if (!allowMixed && kind === 'mixed') continue;

    edges.push({ from, to, factor, kind, isApprox, source: r.Source || null });

    // add derived inverse edge for resolution if it is not obviously invalid
    const inv = 1 / factor;
    if (Number.isFinite(inv) && inv > 0) {
      edges.push({ from: to, to: from, factor: inv, kind, isApprox, source: (r.Source || null) ? `${r.Source}:inverse` : 'inverse' });
    }
  }
  return edges;
}

function _resolveConversionPath({ fromUnit, toUnit, allowApprox = false, allowMixed = false, kind } = {}) {
  const src = canonicalUnit(fromUnit);
  const dst = canonicalUnit(toUnit);
  if (!src || !dst) return { ok: false, reason: 'Missing fromUnit/toUnit' };
  if (src === dst) return { ok: true, factor: 1, path: [], kind: null, fromUnit: src, toUnit: dst };

  const edges = _loadConversionEdges({ allowApprox, allowMixed });
  if (!edges.length) return { ok: false, reason: 'No conversions available' };

  // adjacency list
  const adj = new Map();
  for (const e of edges) {
    if (kind && e.kind && e.kind !== kind) continue; // strict filter if requested
    if (!adj.has(e.from)) adj.set(e.from, []);
    adj.get(e.from).push(e);
  }

  // BFS for smallest number of hops. Track factor multiplicatively and the path.
  const queue = [];
  const visited = new Set(); // unit + '|' + kindState
  queue.push({ unit: src, factor: 1, path: [], kindState: null });

  visited.add(`${src}|`);

  while (queue.length) {
    const cur = queue.shift();
    const nextEdges = adj.get(cur.unit) || [];
    for (const e of nextEdges) {
      // enforce kind consistency unless edge is null (unknown)
      let nextKind = cur.kindState;
      if (e.kind) {
        if (nextKind == null) nextKind = e.kind;
        else if (nextKind !== e.kind) continue;
      }

      const nextUnit = e.to;
      const key = `${nextUnit}|${nextKind || ''}`;
      if (visited.has(key)) continue;

      const nextFactor = cur.factor * e.factor;
      const nextPath = cur.path.concat([{
        FromUnit: e.from,
        ToUnit: e.to,
        Factor: e.factor,
        Kind: e.kind || null,
        IsApprox: !!e.isApprox,
        Source: e.source || null
      }]);

      if (nextUnit === dst) {
        return { ok: true, factor: nextFactor, path: nextPath, kind: nextKind, fromUnit: src, toUnit: dst };
      }

      visited.add(key);
      queue.push({ unit: nextUnit, factor: nextFactor, path: nextPath, kindState: nextKind });
    }
  }

  return { ok: false, reason: 'No conversion path found', fromUnit: src, toUnit: dst };
}

function convertQty(payload = {}) {
  try {
    const qty = Number(payload.qty);
    const fromUnit = payload.fromUnit;
    const toUnit = payload.toUnit;
    const allowApprox = !!payload.allowApprox;
    const allowMixed = !!payload.allowMixed;
    const kind = payload.kind ? String(payload.kind) : null;

    if (!Number.isFinite(qty)) return err_('qty must be a number');
    if (!fromUnit || !toUnit) return err_('fromUnit and toUnit are required');

    const resolved = _resolveConversionPath({ fromUnit, toUnit, allowApprox, allowMixed, kind });
    if (!resolved.ok) return err_(resolved.reason || 'Unable to convert');

    const outQty = qty * resolved.factor;
    return ok_({
      fromUnit: resolved.fromUnit,
      toUnit: resolved.toUnit,
      inputQty: qty,
      factor: resolved.factor,
      qty: outQty,
      kind: resolved.kind || null,
      path: resolved.path
    });
  } catch (e) {
    return err_(e);
  }
}

function getCategoryOverrides(){
  try {
    const rows = db().prepare("SELECT keyword, category, updated_at FROM category_overrides ORDER BY keyword ASC").all();
    return ok_({ overrides: rows.map(r => ({
      keyword: r.keyword,
      category: r.category,
      updatedAt: r.updated_at
    }))});
  } catch (e) {
    return ok_({ overrides: [] });
  }
}

function saveCategoryOverride(payload){
  const keyword = normLower_(String(payload && payload.keyword || '').trim());
  const category = String(payload && payload.category || '').trim();
  
  if (!keyword) return err_('Keyword is required.');
  if (!category) return err_('Category is required.');
  
  db().prepare(`
    INSERT INTO category_overrides(keyword, category, updated_at)
    VALUES(?, ?, datetime('now'))
    ON CONFLICT(keyword) DO UPDATE SET 
      category = excluded.category,
      updated_at = datetime('now')
  `).run(keyword, category);
  
  return ok_({ keyword, category });
}

function deleteCategoryOverride(payload){
  const keyword = normLower_(String(payload && payload.keyword || '').trim());
  if (!keyword) return err_('Keyword is required.');
  
  db().prepare("DELETE FROM category_overrides WHERE keyword = ?").run(keyword);
  return ok_({});
}

// --- Self-Learning Ingredient Classification ---

// Keyword-based classification rules (fallback when no user learning exists)
const CATEGORY_RULES = {
  produce: ['apple','banana','orange','lemon','lime','tomato','onion','garlic','pepper','carrot','celery','lettuce','spinach','kale','broccoli','cauliflower','cabbage','cucumber','zucchini','squash','potato','sweet potato','mushroom','avocado','corn','green bean','pea','asparagus','artichoke','beet','radish','turnip','eggplant','scallion','shallot','leek','ginger','basil','cilantro','parsley','mint','thyme','rosemary','sage','dill','chive','oregano','tarragon','watercress','arugula','endive','fennel','jicama','kohlrabi','lemongrass','bok choy','napa cabbage','shiitake','enoki','oyster mushroom','truffle','seaweed','nori','wakame','kelp','banana pepper','jalapeno','habanero','poblano','serrano','cherry tomato','grape tomato','plum tomato','baby spinach','baby arugula','mixed greens','spring mix','butter lettuce','romaine','iceberg','bibb lettuce','red onion','yellow onion','white onion','shallot','celery root','parsnip','rutabaga','yucca','plantain','taro','lotus root','burdock root','galangal','daikon','mooli','enoki','shimeji','porcini','morel','chanterelle',' maitake','oyster','cremini','baby bella','portobello'],
  dairy: ['milk','cream','butter','cheese','yogurt','sour cream','cottage cheese','cream cheese','half and half','evaporated milk','condensed milk','whipping cream','heavy cream','parmesan','mozzarella','cheddar','swiss','gouda','brie','feta','ricotta','goat cheese','blue cheese','gruyere','havarti','monterey jack','pepper jack','colby','muenster','provolone','american cheese','nacho cheese','queso fresco','cotija','mascarpone','clotted cream','crème fraîche','egg','eggs','butter','margarine','ghee','half & half','light cream','sour milk','buttermilk','kefir','sweetened condensed milk','dried milk powder','whey','casein','cheese curd','paneer','halloumi','manchego','romano','asiago','fontina','gorgonzola','roquefort','stilton','limburger','cheese spread','cheese sauce','alfredo sauce','bechamel sauce','queso dip','cheese ball','cheese log'],
  meat: ['chicken','beef','pork','lamb','turkey','duck','goose','bacon','ham','sausage','ground beef','ground pork','ground turkey','steak','roast','ribs','chop','tenderloin','liver','heart','kidney','tripe','tongue','corned beef','pastrami','prosciutto','salami','pepperoni','chorizo','andouille','hot dog','frankfurter','meatball','meatloaf','mincemeat','chicken breast','chicken thigh','chicken leg','chicken wing','chicken drumstick','ground chicken','chicken tender','chicken satay','beefsteak','beef roast','ground lamb','lamb chop','lamb shank','leg of lamb','pork chop','pork loin','pork belly','pork tenderloin','ground pork','pork sausage','bacon bits','bacon grease','ham hock','ham steak','turkey breast','turkey thigh','ground turkey','turkey sausage','venison','rabbit','pheasant','quail','squab','goose liver','duck breast','duck leg','cornish hen','capon','meat drippings','lard','tallow','suet'],
  seafood: ['fish','salmon','tuna','cod','halibut','tilapia','trout','mackerel','sardine','anchovy','herring','mahi','snapper','sea bass','flounder','sole','pike','perch','walleye','crab','lobster','shrimp','prawn','clam','mussel','oyster','scallop','squid','octopus','crawfish','crayfish','eel','sea urchin','sea cucumber','salmon fillet','salmon steak','smoked salmon','lox','tuna steak','canned tuna','cod fillet','cod steak','crab meat','crab leg','lobster tail','lobster meat','shrimp tail','shrimp peeled','shrimp deveined','clams in shell','mussels in shell','fresh oyster','smoked oyster','bay scallop','sea scallop','calamari','squid ring','octopus tentacle','tilapia fillet','trout fillet','mackerel fillet','anchovy fillet','sardine in oil','fish stick','fish fillet','fish steak','fish cake','fish ball','fish sauce','fish paste','fish stock'],
  pantry: ['flour','sugar','salt','pepper','oil','olive oil','vegetable oil','coconut oil','vinegar','rice','pasta','noodle','bread','breadcrumb','cornstarch','baking powder','baking soda','yeast','oat','cereal','granola','honey','maple syrup','molasses','corn syrup','jam','jelly','peanut butter','almond butter','nutella','chocolate','cocoa','vanilla','almond extract','cinnamon','nutmeg','clove','cardamom','cumin','coriander','turmeric','paprika','chili powder','curry powder','garam masala','soy sauce','fish sauce','oyster sauce','hoisin sauce','sriracha','tabasco','mustard','ketchup','mayonnaise','relish','salsa','hot sauce','barbecue sauce','teriyaki sauce','worcestershire sauce','broth','stock','coconut milk','tomato paste','tomato sauce','diced tomato','crushed tomato','bean','lentil','chickpea','kidney bean','black bean','pinto bean','navy bean','cannellini bean','baked bean','hummus','tahini','caper','olive','pickle','relish','sauerkraut','kimchi','pasta sauce','alfredo sauce','pesto','marinara','tomato soup','cream of mushroom','cream of chicken','vegetable soup','noodle soup','ramen','udon','soba','egg noodle','spaghetti','penne','fusilli','rotini','macaroni','rigatoni','farfalle','linguine','fettuccine','angel hair','lasagna','rice noodle','glass noodle','mung bean','adzuki bean','black eyed pea','split pea','lentil soup','dal','tvp','textured vegetable protein','seitan','mock duck','jackfruit','artificial crab','imitation lobster','yeast extract','miso','dashi','bouillon','gelatin','agar','pectin','guar gum','xanthan gum','carrageenan'],
  frozen: ['ice cream','frozen yogurt','sorbet','gelato','popsicle','frozen fruit','frozen vegetable','frozen pizza','frozen dinner','frozen meal','frozen fish stick','frozen chicken nugget','frozen waffle','frozen pie','frozen tart','frozen cookie dough','frozen berries','frozen strawberries','frozen blueberries','frozen cherries','frozen mango','frozen pineapple','frozen banana','frozen spinach','frozen peas','frozen corn','frozen mixed vegetables','frozen broccoli','frozen french fry','frozen hash brown','frozen potato wedge','frozen bread','frozen dough','frozen phyllo','frozen puff pastry','frozen pie crust','frozen pizza crust','frozen garlic bread','frozen taquito','frozen egg roll','frozen dumpling','frozen gyoza','frozen potsticker','frozen spring roll','frozen samosa','frozen pakora'],
  bakery: ['bread','roll','bun','bagel','croissant','danish','muffin','cupcake','cake','pie','tart','cookie','brownie','blondie','scone','biscuit','cracker','pita','naan','tortilla','lavash','focaccia','ciabatta','baguette','sourdough','rye','pumpernickel','wheat bread','white bread','whole wheat','multigrain','seven grain','twelve grain','cranberry bread','banana bread','pumpkin bread','zucchini bread','apple bread','cheesecake','tiramisu','pavlova','meringue','ladyfinger','angel food cake','devil food cake','red velvet','cheesecake','flan','creme brulee','pouding','mousse','parfait','trifle','brownie','blondie','bar cookie','energy bar','granola bar','protein bar','rice crispy treat','marshmallow','jelly bean','gummy candy','candy bar','chocolate bar','toffee','caramel','nougat','marzipan','fondant','royal icing','buttercream','cream cheese frosting','whipped cream','cool whip','dream whip'],
  deli: ['sliced cheese','sliced meat','turkey breast','roast beef','ham slice','prosciutto','capicola','salami','pepperoni','mortadella','bologna','pastrami','corned beef','hot dog','bratwurst','kielbasa','chicken salad','tuna salad','egg salad','potato salad','macaroni salad','coleslaw','potato chip','tortilla chip','pretzel','nut mix','olive bar','lunch meat','lunch box','sliced turkey','sliced chicken','sliced ham','sliced roast beef','sliced corned beef','sliced pastrami','sliced salami','sliced pepperoni','sliced bologna','sliced mortadella','sliced liverwurst','sliced head cheese','sliced blood pudding','cheese slice','swiss slice','cheddar slice','american slice','mozzarella slice','pepper jack slice','cole slaw','potato salad','macaroni salad','pasta salad','chicken salad','tuna salad','egg salad','shrimp salad','crab salad','lobster salad','seafood salad','tortellini salad','couscous salad','quinoa salad','bean salad','marinated bean','three bean','pasta fagiole','minestrone','split pea','lentil soup','chili','stew','goulash','cabbage roll','stuffed pepper','stuffed cabbage','meatloaf','meatball','sausage','bratwurst','bockwurst','knockwurst','weisswurst','merguez','chorizo','andouille','linguiça','morcilla','blood sausage','haggis','head cheese','braunschweiger','liverwurst'],
  beverage: ['water','juice','soda','coffee','tea','beer','wine','spirits','liquor','milk','smoothie','shake','lemonade','iced tea','kombucha','kefir','coconut water','energy drink','sports drink','orange juice','apple juice','grape juice','cranberry juice','tomato juice','vegetable juice','lemon juice','lime juice','ginger juice','coffee grounds','coffee beans','espresso','cappuccino','latte','mocha',' Americano','iced coffee','cold brew','green tea','black tea','herbal tea','chai','matcha','oolong','white tea','rose tea','hibiscus tea','peppermint tea','chamomile tea','earl grey','english breakfast','assam','ceylon','darjeeling','keemun','pu-erh','wine','red wine','white wine','rose wine','sparkling wine','champagne','prosecco','cava','sherry','port','madeira','marsala','vermouth','beer','lager','pilsner','ale','stout','porter','ipa','pale ale','amber','bock','weizen','weissbier','witbier','saison','farmhouse','sour','lambic','gueuze','fruit beer','wheat beer','radler','shandy','soda','cola','root beer','ginger ale','7-up','sprite','mountain dew','pepsi','coke','fanta','dr pepper','mello yello','club soda','seltzer','tonic','sparkling water','mineral water','perrier','san Pellegrino','evian','voss','smartwater','vitaminwater','powerade','gatorade','pedialyte'],
  household: ['paper towel','toilet paper','napkin','tissue','trash bag','aluminum foil','plastic wrap','ziploc bag','sponge','dish soap','laundry detergent','cleaner','disinfectant','battery','light bulb','candle','air freshener','bug spray','sunscreen','paper plate','plastic fork','plastic spoon','plastic knife','plastic cup','plastic bowl','paper cup','paper bowl','styrofoam cup','styrofoam plate','plastic wrap','aluminum foil','parchment paper','wax paper','freezer bag','storage bag','sandwich bag','snack bag','gallon bag','quart bag','sandwich wrap','foil wrap','cling wrap','plastic container','glass container','rubber band','twine','string','clip','clothespin','clothespin','clothes pin','clothes peg','clothes peg','clothespin','clothespin','clothes peg','clothes pin','clothespin'],
  spice: ['salt','pepper','cinnamon','nutmeg','clove','cardamom','cumin','coriander','turmeric','paprika','chili powder','curry powder','garam masala','allspice','ginger powder','onion powder','garlic powder','mustard seed','fennel seed','celery seed','cayenne','white pepper','black pepper','pink pepper','saffron','sumac','za\'atar','taco seasoning','italian seasoning','herbes de provence','cajun seasoning','creole seasoning','jerk seasoning','five spice','mace','cinnamon stick','bay leaf','star anise','vanilla bean','vanilla extract','pure vanilla','artificial vanilla','almond extract','lemon extract','orange extract','mint extract','peppermint extract','rum extract','banana extract','coconut extract','coffee extract','espresso powder','instant coffee','freeze dried coffee','dried herbs','dried basil','dried oregano','dried thyme','dried rosemary','dried sage','dried parsley','dried cilantro','dried dill','dried mint','dried marjoram','dried tarragon','dried chervil','dried bay leaf','dried lemongrass','dried ginger','garlic salt','onion salt','celery salt','seasoned salt','salt substitute','msg','accent','vegetable salt','yeast extract','miso powder','dashi powder','shrimp powder','fish powder','soup base','broth base','stock base','marinade','rub','paste','sauce','dip','salsa','chutney','relish','pickle','olives','caper','mustard seed','yellow mustard','brown mustard','dijon mustard','whole grain mustard','honey mustard','beer mustard','spicy mustard','sweet mustard'],
  other: []
};

function classifyIngredient(payload){
  const name = String(payload && payload.name || payload && payload.IngredientRaw || '').trim();
  if (!name) return ok_({ category: '' });
  
  const nameLower = normLower_(name);
  
  // Step 1: Check user learned categories (user_ingredient_category table)
  try {
    // Try to find exact match first
    let row = db().prepare("SELECT category FROM user_ingredient_category WHERE LOWER(TRIM(name)) = LOWER(TRIM(?)) LIMIT 1").get(name);
    if (row && row.category && String(row.category).trim() !== '') {
      return ok_({ category: String(row.category).trim(), source: 'user' });
    }
    
    // Try prefix match for learned patterns
    row = db().prepare("SELECT category FROM user_ingredient_category WHERE ? LIKE (name || '%') OR ? LIKE ('% ' || name || '%') LIMIT 1").get(nameLower, nameLower);
    if (row && row.category && String(row.category).trim() !== '') {
      return ok_({ category: String(row.category).trim(), source: 'user' });
    }
  } catch (e) {
    // Table might not exist, continue with rules - ignore error
  }
  
  // Step 2: Check category_overrides table
  try {
    // Build pattern manually to avoid SQLite parameter binding issues
    const rows = db().prepare("SELECT keyword, category FROM category_overrides ORDER BY LENGTH(keyword) DESC").all();
    for (const r of rows) {
      const keyword = String(r.keyword || '').toLowerCase();
      const category = String(r.category || '');
      if (keyword && category && nameLower.includes(keyword)) {
        return ok_({ category: category, source: 'override' });
      }
    }
  } catch (e) {
    // Continue with rules - ignore error
  }
  
  // Step 3: Apply keyword-based rules (always available)
  for (const [category, keywords] of Object.entries(CATEGORY_RULES)) {
    if (category === 'other') continue;
    // Convert category to Title Case for consistency with frontend dropdown
    const titleCaseCategory = category.charAt(0).toUpperCase() + category.slice(1);
    for (const keyword of keywords) {
      if (keyword && nameLower.includes(keyword.toLowerCase())) {
        return ok_({ category: titleCaseCategory, source: 'rule' });
      }
    }
  }
  
  // Step 4: Fallback to "Other"
  return ok_({ category: 'Other', source: 'default' });
}

function trainIngredientCategory(payload){
  const name = String(payload && payload.name || payload && payload.IngredientRaw || '').trim();
  const category = String(payload && payload.category || '').trim();
  
  if (!name) return err_('Ingredient name is required.');
  if (!category) return err_('Category is required.');
  
  const nameLower = normLower_(name);
  
  // Upsert into user_ingredient_category table
  db().prepare(`
    INSERT INTO user_ingredient_category(name, name_lower, category, created_at, updated_at)
    VALUES(?, ?, ?, datetime('now'), datetime('now'))
    ON CONFLICT(name_lower) DO UPDATE SET
      category = excluded.category,
      updated_at = datetime('now')
  `).run(name, nameLower, category);
  
  return ok_({ name, category, trained: true });
}

// ================= PLANS =================
function getPlansRange(payload){
  const start = String(payload && payload.start || '').trim();
  const end = String(payload && payload.end || '').trim();
  if (!start || !end) return err_('Missing start/end.');

  const rows = db().prepare("SELECT * FROM plans WHERE Date >= ? AND Date <= ? ORDER BY Date ASC LIMIT 400").all(start, end);
  const plans = rows.map(planRowToObj);
  return ok_({ plans });
}


function upsertPlanMeal(payload){
  const dateId = String(payload && (payload.dateId || payload.date) || '').trim();
  const slot = String(payload && payload.slot || '').trim();

  // Accept both payload shapes:
  // 1) { date, slot, meal: {RecipeId, Title, UseLeftovers, From} }
  // 2) { dateId, slot, recipeId, title, useLeftovers, from }
  let meal = null;
  if (payload && Object.prototype.hasOwnProperty.call(payload, 'meal')) {
    meal = payload.meal;
  } else if (payload && (payload.recipeId || payload.title)) {
    meal = { 
      RecipeId: payload.recipeId, 
      Title: payload.title,
      UseLeftovers: payload.useLeftovers,
      From: payload.from
    };
  }

  if (!dateId) return err_('Missing date.');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateId)) return err_('Date must be YYYY-MM-DD.');
  if (!['Breakfast','Lunch','Dinner'].includes(slot)) return err_('Invalid slot.');

  // Ensure plan row exists
  db().prepare("INSERT INTO plans(Date, UpdatedAt) VALUES(?, datetime('now')) ON CONFLICT(Date) DO NOTHING").run(dateId);

  const schema = plansSchema_();

  if (schema.hasNew) {
    const cols = {
      Breakfast: ['BreakfastRecipeId','BreakfastTitle','BreakfastUseLeftovers','BreakfastFrom'],
      Lunch: ['LunchRecipeId','LunchTitle','LunchUseLeftovers','LunchFrom'],
      Dinner: ['DinnerRecipeId','DinnerTitle','DinnerUseLeftovers','DinnerFrom']
    }[slot];

    const rid = meal ? String(meal.RecipeId || '') : null;
    const title = meal ? String(meal.Title || '') : null;
    const useLeftovers = meal && meal.UseLeftovers ? 1 : 0;
    const from = meal ? String(meal.From || '') : null;

    db().prepare(`UPDATE plans SET ${cols[0]}=?, ${cols[1]}=?, ${cols[2]}=?, ${cols[3]}=?, UpdatedAt=datetime('now') WHERE Date=?`).run(rid, title, useLeftovers, from, dateId);
    return ok_({});
  }

  if (schema.hasLegacy) {
    const col = slot; // Breakfast/Lunch/Dinner columns store JSON
    const json = mealToJson_(meal);
    db().prepare(`UPDATE plans SET ${col}=?, UpdatedAt=datetime('now') WHERE Date=?`).run(json, dateId);
    return ok_({});
  }

  return err_('Unsupported plans schema.');
}


function swapPlanMeals(payload){
  const dateId = String(payload && payload.date || '').trim();
  const a = String(payload && payload.a || '').trim();
  const b = String(payload && payload.b || '').trim();
  if (!dateId) return err_('Missing date.');
  if (!['Breakfast','Lunch','Dinner'].includes(a)) return err_('Invalid a.');
  if (!['Breakfast','Lunch','Dinner'].includes(b)) return err_('Invalid b.');

  const row = db().prepare("SELECT * FROM plans WHERE Date=?").get(dateId);
  if (!row) return ok_({});

  const schema = plansSchema_();
  if (schema.hasNew) {
    const map = {
      Breakfast: ['BreakfastRecipeId','BreakfastTitle','BreakfastUseLeftovers','BreakfastFrom'],
      Lunch: ['LunchRecipeId','LunchTitle','LunchUseLeftovers','LunchFrom'],
      Dinner: ['DinnerRecipeId','DinnerTitle','DinnerUseLeftovers','DinnerFrom']
    };
    const aCols = map[a], bCols = map[b];
    const aRid = row[aCols[0]], aTitle = row[aCols[1]], aUseLeftovers = row[aCols[2]], aFrom = row[aCols[3]];
    const bRid = row[bCols[0]], bTitle = row[bCols[1]], bUseLeftovers = row[bCols[2]], bFrom = row[bCols[3]];
    db().prepare(`UPDATE plans SET ${aCols[0]}=?, ${aCols[1]}=?, ${aCols[2]}=?, ${aCols[3]}=?, ${bCols[0]}=?, ${bCols[1]}=?, ${bCols[2]}=?, ${bCols[3]}=?, UpdatedAt=datetime('now') WHERE Date=?`)
      .run(bRid, bTitle, bUseLeftovers, bFrom, aRid, aTitle, aUseLeftovers, aFrom, dateId);
    return ok_({});
  }

  if (schema.hasLegacy) {
    const aVal = row[a] || null;
    const bVal = row[b] || null;
    db().prepare(`UPDATE plans SET ${a}=?, ${b}=?, UpdatedAt=datetime('now') WHERE Date=?`).run(bVal, aVal, dateId);
    return ok_({});
  }

  return err_('Unsupported plans schema.');
}


// ================= SHOPPING LIST =================

function defaultStoreIdKroger_(){
  const row = db().prepare("SELECT StoreId FROM stores WHERE lower(Name)='kroger' LIMIT 1").get();
  return row && row.StoreId ? String(row.StoreId) : '';
}

function buildShoppingList(payload){
  const start = String(payload && payload.start || '').trim();
  const end = String(payload && payload.end || '').trim();
  const excludeLeftovers = payload && payload.excludeLeftovers === true;
  if (!start || !end) return err_('Missing start/end.');

  const plans = db().prepare("SELECT * FROM plans WHERE Date >= ? AND Date <= ?").all(start, end);

  // Collect recipeIds across BOTH supported plans schemas
  const recipeIds = new Set();
  const schema = plansSchema_();

  for (const p of plans) {
    if (schema.hasNew) {
      // For new schema, check UseLeftovers columns
      const b = { RecipeId: p.BreakfastRecipeId, UseLeftovers: p.BreakfastUseLeftovers };
      const l = { RecipeId: p.LunchRecipeId, UseLeftovers: p.LunchUseLeftovers };
      const d = { RecipeId: p.DinnerRecipeId, UseLeftovers: p.DinnerUseLeftovers };
      const skip = excludeLeftovers ? (m => m.UseLeftovers) : (m => false);
      if (b.RecipeId && !skip(b)) recipeIds.add(String(b.RecipeId));
      if (l.RecipeId && !skip(l)) recipeIds.add(String(l.RecipeId));
      if (d.RecipeId && !skip(d)) recipeIds.add(String(d.RecipeId));
    } else if (schema.hasLegacy) {
      const b = parseMealJson_(p.Breakfast);
      const l = parseMealJson_(p.Lunch);
      const d = parseMealJson_(p.Dinner);
      const skip = excludeLeftovers ? (m => m && m.UseLeftovers) : (() => false);
      if (b && b.RecipeId && !skip(b)) recipeIds.add(String(b.RecipeId));
      if (l && l.RecipeId && !skip(l)) recipeIds.add(String(l.RecipeId));
      if (d && d.RecipeId && !skip(d)) recipeIds.add(String(d.RecipeId));
    }
  }

  const ids = Array.from(recipeIds).filter(Boolean);
  if (!ids.length) return ok_({ groups: [] });

  // Aggregate items by Store -> Category -> Ingredient
  // Structure: storeId -> category -> key -> { IngredientNorm, Unit, QtyNum, QtyTexts, Count, Examples, Category }
  const agg = Object.create(null);

  const ingStmt = db().prepare(
    "SELECT IngredientNorm, IngredientRaw, Notes, QtyNum, QtyText, Unit, StoreId, Category " +
    "FROM ingredients WHERE RecipeId=? ORDER BY idx ASC"
  );

  for (const rid of ids) {
    const items = ingStmt.all(rid);
    for (const it of items) {
      const storeId = String(it.StoreId || '').trim() || defaultStoreIdKroger_() || 'unassigned';
      // Normalize category to Title Case for consistent grouping
      let category = String(it.Category || '').trim();
      if (category) {
        category = category.charAt(0).toUpperCase() + category.slice(1).toLowerCase();
      }
      if (!category) category = 'Other';
      const norm = String(it.IngredientNorm || it.IngredientRaw || '').trim();
      if (!norm) continue;

      const unit = String(it.Unit || '').trim();
      const key = (norm + '|' + unit).toLowerCase();

      // Create nested structure: storeId -> category -> key -> item
      if (!agg[storeId]) agg[storeId] = Object.create(null);
      if (!agg[storeId][category]) agg[storeId][category] = Object.create(null);
      if (!agg[storeId][category][key]) {
        agg[storeId][category][key] = {
          IngredientNorm: norm,
          Category: category,
          Unit: unit,
          QtyNum: null,
          QtyTexts: new Set(),
          Count: 0,
          Examples: []
        };
      }

      const bucket = agg[storeId][category][key];
      bucket.Count += 1;

      // numeric sum when possible (same key => same unit)
      const qn = (it.QtyNum === null || it.QtyNum === undefined || it.QtyNum === '') ? null : Number(it.QtyNum);
      if (qn !== null && Number.isFinite(qn)) {
        bucket.QtyNum = (bucket.QtyNum === null) ? qn : (bucket.QtyNum + qn);
      }

      const qt = String(it.QtyText || '').trim();
      if (qt) bucket.QtyTexts.add(qt);

      // Keep a few human-friendly examples (qty + raw + notes)
      const exParts = [];
      if (qt) exParts.push(qt);
      if (qn !== null && Number.isFinite(qn) && !qt) exParts.push(String(qn));
      if (unit) exParts.push(unit);
      if (it.IngredientRaw) exParts.push(String(it.IngredientRaw));
      if (it.Notes) exParts.push(String(it.Notes));
      const ex = exParts.filter(Boolean).join(' ').trim();
      if (ex && bucket.Examples.length < 3) bucket.Examples.push(ex);
    }
  }


  // Pantry adjustment: reduce shopping quantities when pantry has the same item + unit with numeric quantities.
  try {
    const pantryRows = db().prepare("SELECT Name, NameLower, QtyNum, Unit, QtyText FROM pantry").all();

    // Build pantry availability by normalized ingredient name. We keep quantities in their native units and
    // decrement them as we satisfy shopping-list requirements (virtual subtraction only; does not persist).
    const pantryByName = new Map(); // nameLower => [{ qtyNum, unit }]
    for (const pr of pantryRows) {
      const nameLower = normLower_(pr.NameLower || pr.Name || '');
      if (!nameLower) continue;

      let qtyNum = (pr.QtyNum === null || pr.QtyNum === undefined || pr.QtyNum === '') ? null : Number(pr.QtyNum);
      let unit = String(pr.Unit || '').trim();

      if ((qtyNum === null || !Number.isFinite(qtyNum)) && pr.QtyText) {
        const parsed = parseQtyText_(pr.QtyText);
        qtyNum = parsed.qtyNum;
        if (!unit) unit = parsed.unit || '';
      }

      if (qtyNum === null || !Number.isFinite(qtyNum) || qtyNum <= 0) continue;

      const cUnit = canonicalUnit(unit);
      if (!cUnit) continue;

      const arr = pantryByName.get(nameLower) || [];
      arr.push({ qtyNum, unit: cUnit });
      pantryByName.set(nameLower, arr);
    }

    function _tryFactor(fromUnit, toUnit) {
      // Prefer exact conversions; fall back to approximate if needed.
      let r = _resolveConversionPath({ fromUnit, toUnit, allowApprox: false, allowMixed: false });
      if (r && r.ok && Number.isFinite(r.factor)) return r.factor;
      r = _resolveConversionPath({ fromUnit, toUnit, allowApprox: true, allowMixed: false });
      if (r && r.ok && Number.isFinite(r.factor)) return r.factor;
      return null;
    }

    if (pantryByName.size) {
      for (const sid of Object.keys(agg)) {
        for (const category of Object.keys(agg[sid] || {})) {
          const items = agg[sid][category];
          for (const k of Object.keys(items)) {
            const item = items[k];
            if (!item) continue;

            const ingLower = normLower_(item.IngredientNorm || '');
            if (!ingLower) continue;

            const reqQty = (item.QtyNum === null || item.QtyNum === undefined) ? null : Number(item.QtyNum);
            const reqUnit = canonicalUnit(item.Unit || '');
            if (reqQty === null || !Number.isFinite(reqQty) || reqQty <= 0 || !reqUnit) continue;

            const pantryArr = pantryByName.get(ingLower);
            if (!pantryArr || !pantryArr.length) continue;

            let remainingReq = reqQty;

            for (const p of pantryArr) {
              if (remainingReq <= 0) break;
              if (!p || !Number.isFinite(p.qtyNum) || p.qtyNum <= 0 || !p.unit) continue;

              if (p.unit === reqUnit) {
                const used = Math.min(remainingReq, p.qtyNum);
                remainingReq -= used;
                p.qtyNum -= used;
                continue;
              }

              // Try converting pantry -> required unit
              const f = _tryFactor(p.unit, reqUnit);
              if (f && Number.isFinite(f) && f > 0) {
                const pantryInReqUnits = p.qtyNum * f;
                const usedInReqUnits = Math.min(remainingReq, pantryInReqUnits);
                remainingReq -= usedInReqUnits;
                // Decrement pantry in its native units
                p.qtyNum -= (usedInReqUnits / f);
                continue;
              }

              // If we cannot convert, do not subtract from this pantry entry.
            }

            // Cleanup spent pantry entries
            pantryByName.set(ingLower, pantryArr.filter(x => x && Number.isFinite(x.qtyNum) && x.qtyNum > 1e-12));

            if (remainingReq <= 1e-12) {
              delete items[k];
            } else if (remainingReq !== reqQty) {
              item.QtyNum = remainingReq;
            }
          }
        }
      }
    }
  } catch (_) {}

  const storeIds = Object.keys(agg).sort((a,b) => {
    if (a === 'unassigned') return -1;
    if (b === 'unassigned') return 1;
    return String(a).localeCompare(String(b));
  });

  const groups = storeIds.map(storeId => {
    // Preserve category information when flattening
    const items = [];
    const categoryObjs = Object.values(agg[storeId] || {});
    for (const categoryObj of categoryObjs) {
      const categoryItems = Object.values(categoryObj);
      for (const x of categoryItems) {
        items.push({
          IngredientNorm: x.IngredientNorm,
          Unit: x.Unit,
          QtyNum: x.QtyNum,
          QtyText: Array.from(x.QtyTexts).join(' / '),
          Count: x.Count,
          Examples: x.Examples,
          Category: x.Category
        });
      }
    }
    return {
      StoreId: storeId,
      Items: items.sort((a,b) => String(a.IngredientNorm).localeCompare(String(b.IngredientNorm)))
    };
  });

  return ok_({ groups });
}

function assignShoppingItemStore(payload){
  const start = String(payload && payload.start || '').trim();
  const end = String(payload && payload.end || '').trim();
  const ingredientNorm = String(payload && payload.ingredientNorm || '').trim();
  const unit = String(payload && payload.unit || '').trim();
  const storeId = String(payload && payload.storeId || '').trim();
  if (!start || !end) return err_('Missing start/end.');
  if (!ingredientNorm) return err_('Missing ingredientNorm.');
  // storeId may be empty to "unassign".

  // Collect recipeIds across BOTH supported plans schemas
  const plans = db().prepare("SELECT * FROM plans WHERE Date >= ? AND Date <= ?").all(start, end);
  const schema = plansSchema_();
  const recipeIds = new Set();
  for (const p of plans) {
    if (schema.hasNew) {
      if (p.BreakfastRecipeId) recipeIds.add(String(p.BreakfastRecipeId));
      if (p.LunchRecipeId) recipeIds.add(String(p.LunchRecipeId));
      if (p.DinnerRecipeId) recipeIds.add(String(p.DinnerRecipeId));
    } else if (schema.hasLegacy) {
      const b = parseMealJson_(p.Breakfast);
      const l = parseMealJson_(p.Lunch);
      const d = parseMealJson_(p.Dinner);
      if (b && b.RecipeId) recipeIds.add(String(b.RecipeId));
      if (l && l.RecipeId) recipeIds.add(String(l.RecipeId));
      if (d && d.RecipeId) recipeIds.add(String(d.RecipeId));
    }
  }

  const ids = Array.from(recipeIds).filter(Boolean);
  if (!ids.length) return ok_({ updated: 0 });

  const placeholders = ids.map(() => '?').join(',');
  const sql = `
    UPDATE ingredients
    SET StoreId = ?
    WHERE RecipeId IN (${placeholders})
      AND lower(trim(COALESCE(IngredientNorm, IngredientRaw, ''))) = lower(trim(?))
      AND lower(trim(COALESCE(Unit, ''))) = lower(trim(?))
  `;

  const stmt = db().prepare(sql);
  const tx = db().transaction(() => {
    const info = stmt.run(storeId, ...ids, ingredientNorm, unit);
    return info.changes || 0;
  });

  const updated = tx();
  return ok_({ updated });
}

// ================= PANTRY =================
function listPantry(payload){
  const q = normLower_((payload && payload.q) || '');
  const params = {};
  let where = "1=1";
  if (q) {
    where += " AND NameLower >= @q AND NameLower < @q2";
    params.q = q;
    params.q2 = q + '\uf8ff';
  }

  const hasQtyNum = pantryHasCol_('QtyNum');
  const hasUnit = pantryHasCol_('Unit');
  const hasCategory = pantryHasCol_('Category');

  // Select only columns that exist to avoid runtime SQL errors on older DBs.
  const selectCols = (hasQtyNum && hasUnit)
    ? (hasCategory ? "ItemId, Name, Category, QtyText, QtyNum, Unit, StoreId, Notes" : "ItemId, Name, QtyText, QtyNum, Unit, StoreId, Notes")
    : (hasCategory ? "ItemId, Name, Category, QtyText, StoreId, Notes" : "ItemId, Name, QtyText, StoreId, Notes");

  const rows = db().prepare(`SELECT ${selectCols} FROM pantry WHERE ${where} ORDER BY NameLower ASC, ItemId ASC LIMIT 500`).all(params);

  return ok_({
    items: rows.map(r => ({
      ItemId: r.ItemId,
      Name: r.Name,
      Category: (hasCategory && r.Category !== null && r.Category !== undefined) ? String(r.Category || '') : '',
      QtyText: r.QtyText || '',
      QtyNum: (hasQtyNum && r.QtyNum !== null && r.QtyNum !== undefined) ? Number(r.QtyNum) : null,
      Unit: (hasUnit && r.Unit !== null && r.Unit !== undefined) ? String(r.Unit || '') : '',
      StoreId: r.StoreId || '',
      Notes: r.Notes || ''
    }))
  });
}


function upsertPantryItem(payload){
  // Support both 'item' object and direct properties (for frontend compatibility)
  const item = (payload && payload.item) || payload || {};
  const name = String(item.Name || '').trim();
  if (!name) return err_('Name required.');
  const itemId = String(item.ItemId || item.PantryId || '').trim() || uuidShort_('pan');

  const hasQtyNum = pantryHasCol_('QtyNum');
  const hasUnit = pantryHasCol_('Unit');
  const hasCategory = pantryHasCol_('Category');

  const qtyNumRaw = (item.QtyNum === null || item.QtyNum === undefined || item.QtyNum === '') ? null : Number(item.QtyNum);
  const qtyNum = (qtyNumRaw !== null && Number.isFinite(qtyNumRaw)) ? qtyNumRaw : null;
  const unit = String(item.Unit || '').trim();
  const category = String(item.Category || '').trim();

  if (hasQtyNum && hasUnit) {
    if (hasCategory) {
      db().prepare(`
        INSERT INTO pantry(ItemId, Name, NameLower, Category, QtyText, QtyNum, Unit, StoreId, Notes, UpdatedAt)
        VALUES(?,?,?,?,?,?,?,?,?,datetime('now'))
        ON CONFLICT(ItemId) DO UPDATE SET
          Name=excluded.Name,
          NameLower=excluded.NameLower,
          Category=excluded.Category,
          QtyText=excluded.QtyText,
          QtyNum=excluded.QtyNum,
          Unit=excluded.Unit,
          StoreId=excluded.StoreId,
          Notes=excluded.Notes,
          UpdatedAt=excluded.UpdatedAt
      `).run(
        itemId,
        name,
        normLower_(name),
        category,
        String(item.QtyText||'').trim(),
        qtyNum,
        unit,
        String(item.StoreId||'').trim(),
        String(item.Notes||'').trim()
      );
    } else {
      db().prepare(`
        INSERT INTO pantry(ItemId, Name, NameLower, QtyText, QtyNum, Unit, StoreId, Notes, UpdatedAt)
        VALUES(?,?,?,?,?,?,?,?,datetime('now'))
        ON CONFLICT(ItemId) DO UPDATE SET
          Name=excluded.Name,
          NameLower=excluded.NameLower,
          QtyText=excluded.QtyText,
          QtyNum=excluded.QtyNum,
          Unit=excluded.Unit,
          StoreId=excluded.StoreId,
          Notes=excluded.Notes,
          UpdatedAt=excluded.UpdatedAt
      `).run(
        itemId,
        name,
        normLower_(name),
        String(item.QtyText||'').trim(),
        qtyNum,
        unit,
        String(item.StoreId||'').trim(),
        String(item.Notes||'').trim()
      );
    }
  } else {
    // Older DB schema: persist only legacy fields (QtyText). Keep behavior working without failing.
    if (hasCategory) {
      db().prepare(`
        INSERT INTO pantry(ItemId, Name, NameLower, Category, QtyText, StoreId, Notes, UpdatedAt)
        VALUES(?,?,?,?,?,?,?,datetime('now'))
        ON CONFLICT(ItemId) DO UPDATE SET
          Name=excluded.Name,
          NameLower=excluded.NameLower,
          Category=excluded.Category,
          QtyText=excluded.QtyText,
          StoreId=excluded.StoreId,
          Notes=excluded.Notes,
          UpdatedAt=excluded.UpdatedAt
      `).run(
        itemId,
        name,
        normLower_(name),
        category,
        String(item.QtyText||'').trim(),
        String(item.StoreId||'').trim(),
        String(item.Notes||'').trim()
      );
    } else {
      db().prepare(`
        INSERT INTO pantry(ItemId, Name, NameLower, QtyText, StoreId, Notes, UpdatedAt)
        VALUES(?,?,?,?,?,?,datetime('now'))
        ON CONFLICT(ItemId) DO UPDATE SET
          Name=excluded.Name,
          NameLower=excluded.NameLower,
          QtyText=excluded.QtyText,
          StoreId=excluded.StoreId,
          Notes=excluded.Notes,
          UpdatedAt=excluded.UpdatedAt
      `).run(
        itemId,
        name,
        normLower_(name),
        String(item.QtyText||'').trim(),
        String(item.StoreId||'').trim(),
        String(item.Notes||'').trim()
      );
    }
  }

  return ok_({ ItemId: itemId });
}


function deletePantryItem(payload){
  // Support both 'itemId' and 'PantryId' for frontend compatibility
  const itemId = String(payload && (payload.itemId || payload.PantryId) || '').trim();
  if (!itemId) return err_('Missing itemId.');
  db().prepare("DELETE FROM pantry WHERE ItemId=?").run(itemId);
  return ok_({});
}

// ================= ADMIN =================

// Matches the UI's expected semantics: delete recipes missing Title OR missing Instructions.

// ================= CALENDAR (Apple Calendar via AppleScript) =================
async function calendarSyncRange(payload, store){
  const start = String(payload && payload.start || '').trim();
  const end = String(payload && payload.end || '').trim();
  if (!start || !end) return err_('Missing start/end.');

  const calendarName = String(payload && payload.calendarName || store.get('calendarName') || 'Foodie Meal Planner').trim();
  if (!calendarName) return err_('Missing calendarName.');

  const plans = db().prepare("SELECT * FROM plans WHERE Date >= ? AND Date <= ? ORDER BY Date ASC").all(start, end);

  let created = 0;
  let updated = 0;

  // Ensure Calendar app permission prompt occurs in an expected place:
  // the first AppleScript call will trigger macOS Automation permission.
  for (const p of plans) {
    const dateId = p.Date;

    const slots = [
      { slot: 'Breakfast', time: '08:00:00', ridCol: 'BreakfastRecipeId', titleCol: 'BreakfastTitle', evCol: 'BreakfastEventId' },
      { slot: 'Lunch', time: '12:00:00', ridCol: 'LunchRecipeId', titleCol: 'LunchTitle', evCol: 'LunchEventId' },
      { slot: 'Dinner', time: '18:00:00', ridCol: 'DinnerRecipeId', titleCol: 'DinnerTitle', evCol: 'DinnerEventId' }
    ];

    for (const s of slots) {
      const mealTitle = String(p[s.titleCol] || '').trim();
      const mealRid = String(p[s.ridCol] || '').trim();
      const existingUid = String(p[s.evCol] || '').trim();

      if (!mealTitle) {
        if (existingUid) {
          try { await deleteEvent({ calendarName, uid: existingUid }); } catch (_) {}
          db().prepare(`UPDATE plans SET ${s.evCol}='', UpdatedAt=datetime('now') WHERE Date=?`).run(dateId);
        }
        continue;
      }

      // AppleScript "date" parsing is finicky; use "YYYY-MM-DD HH:MM:SS" local time string.
      const startIso = `${dateId} ${s.time}`;
      // 1 hour duration
      const [hh, mm, ss] = s.time.split(':').map(Number);
      const startDt = new Date(`${dateId}T${s.time}`);
      const endDt = new Date(startDt.getTime() + 60 * 60 * 1000);
      const endIso = `${ymd_(endDt)} ${String(endDt.getHours()).padStart(2,'0')}:${String(endDt.getMinutes()).padStart(2,'0')}:${String(endDt.getSeconds()).padStart(2,'0')}`;

      const title = `${s.slot}: ${mealTitle}`;
      const desc = mealRid ? `RecipeId: ${mealRid}` : '';

      const newUid = await upsertEvent({
        calendarName,
        uid: existingUid,
        title,
        description: desc,
        startIso,
        endIso
      });

      if (existingUid && newUid === existingUid) updated += 1;
      else created += 1;

      db().prepare(`UPDATE plans SET ${s.evCol}=?, UpdatedAt=datetime('now') WHERE Date=?`).run(newUid, dateId);
    }
  }

  return ok_({ created, updated });
}

module.exports = { handleApiCall };
