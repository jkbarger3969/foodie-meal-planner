const crypto = require('crypto');
const { db } = require('./db');
const { upsertEvent, deleteEvent } = require('./calendar');
const googleCal = require('./google-calendar');

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

// ---- Enhanced ingredient parsing for recipe import ----

function parseFraction_(str) {
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

function canonicalizeUnit_(u) {
  const lower = String(u || '').toLowerCase().trim();
  if (!lower) return '';
  
  const map = {
    'teaspoon': 'tsp', 'teaspoons': 'tsp',
    'tablespoon': 'tbsp', 'tablespoons': 'tbsp',
    'cup': 'cup', 'cups': 'cup',
    'ounce': 'oz', 'ounces': 'oz',
    'pound': 'lb', 'pounds': 'lb', 'lbs': 'lb',
    'gram': 'g', 'grams': 'g',
    'kilogram': 'kg', 'kilograms': 'kg',
    'milliliter': 'ml', 'milliliters': 'ml', 'millilitre': 'ml', 'millilitres': 'ml',
    'liter': 'l', 'liters': 'l', 'litre': 'l', 'litres': 'l',
    'pinch': 'pinch', 'dash': 'dash',
    'clove': 'clove', 'cloves': 'clove',
    'can': 'can', 'cans': 'can',
    'jar': 'jar', 'jars': 'jar',
    'package': 'pkg', 'packages': 'pkg', 'pkgs': 'pkg',
    'bunch': 'bunch', 'bunches': 'bunch',
    'slice': 'slice', 'slices': 'slice',
    'piece': 'piece', 'pieces': 'piece',
    'whole': 'whole', 'medium': 'medium', 'large': 'large', 'small': 'small'
  };
  return map[lower] || lower;
}

function parseIngredientLine(line) {
  const original = String(line || '').trim();
  if (!original) return null;
  
  // Decode HTML entities first (&nbsp;, &amp;, etc.)
  let text = original
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'");
  
  // Normalize unicode characters
  text = text
    .replace(/⁄/g, '/') // Unicode fraction slash
    .replace(/–/g, '-') // En dash
    .replace(/—/g, '-') // Em dash
    .replace(/·/g, ' ') // Middle dot (bullet)
    .replace(/"/g, '"') // Smart quotes
    .replace(/"/g, '"')
    .replace(/'/g, "'") // Smart apostrophes
    .replace(/'/g, "'")
    .replace(/\s+/g, ' '); // Normalize multiple spaces
  
  // Unicode fraction mapping
  const fractionMap = {
    '½': '1/2', '⅓': '1/3', '¼': '1/4', '⅔': '2/3', '¾': '3/4',
    '⅕': '1/5', '⅖': '2/5', '⅗': '3/5', '⅘': '4/5',
    '⅙': '1/6', '⅚': '5/6', '⅛': '1/8', '⅜': '3/8', '⅝': '5/8', '⅞': '7/8'
  };
  
  for (const [unicode, frac] of Object.entries(fractionMap)) {
    text = text.replace(new RegExp(unicode, 'g'), frac);
  }
  
  // Regex patterns
  // IMPORTANT: Order matters! Try mixed fraction first, then simple fraction, then decimal/whole
  const qtyPattern = /^(\d+\s+\d+\/\d+|\d+\/\d+|\d+(?:\.\d+)?)(?:\s*(?:to|-)\s*(\d+\s+\d+\/\d+|\d+\/\d+|\d+(?:\.\d+)?))?/;
  const unitPattern = /(teaspoons?|tablespoons?|cups?|ounces?|pounds?|lbs?|grams?|kilograms?|milliliters?|liters?|tsp|tbsp|oz|lb|g|kg|ml|l|pinch|dash|cloves?|cans?|jars?|packages?|pkgs?|bunches?|slices?|pieces?|whole|medium|large|small)\b/i;
  
  let match = text.match(qtyPattern);
  let qtyNum = null;
  let qtyText = '';
  let remainder = text;
  
  if (match) {
    const qty1 = match[1];
    const qty2 = match[2];
    
    // Parse first quantity
    qtyNum = parseFraction_(qty1);
    
    // Parse range if exists
    if (qty2) {
      qtyText = `${qty1} to ${qty2}`;
    } else {
      qtyText = qty1;
    }
    
    remainder = text.substring(match[0].length).trim();
  }
  
  // Handle parenthetical quantity/size information BEFORE unit extraction
  // e.g., "1 (16 ounce) can" or "2 (10.75 oz) cans"
  // This should be included in qtyText but removed from remainder to avoid confusion
  const sizeParenMatch = remainder.match(/^\(([^)]+?(?:ounce|oz|lb|pound|gram|g|kg|ml|liter|l)s?[^)]*)\)\s*/i);
  if (sizeParenMatch) {
    const sizeInfo = sizeParenMatch[1].trim();
    if (qtyText) {
      qtyText += ` (${sizeInfo})`;
    } else {
      qtyText = `(${sizeInfo})`;
    }
    // Remove the size parenthetical from remainder
    remainder = remainder.substring(sizeParenMatch[0].length).trim();
  }
  
  // Extract unit
  let unit = '';
  const unitMatch = remainder.match(unitPattern);
  if (unitMatch) {
    unit = canonicalizeUnit_(unitMatch[1]);
    qtyText = qtyText ? `${qtyText} ${unitMatch[1]}` : unitMatch[1];
    remainder = remainder.substring(unitMatch.index + unitMatch[0].length).trim();
  }
  
  // Extract notes (parentheses, commas, dashes)
  let ingredientName = remainder;
  let notes = '';
  
  // Extract ALL parenthetical notes: "(optional)", "(about 2 lbs)", etc.
  // Keep extracting until no more parentheses remain
  while (ingredientName.match(/\(([^)]+)\)/)) {
    const parenMatch = ingredientName.match(/\(([^)]+)\)/);
    if (parenMatch) {
      const parenContent = parenMatch[1].trim();
      if (notes) notes += '; ' + parenContent;
      else notes = parenContent;
      ingredientName = ingredientName.replace(parenMatch[0], ' ').trim();
    }
  }
  
  // Extract comma-separated notes: ", chopped", ", diced"
  const commaMatch = ingredientName.match(/,\s*(.+)$/);
  if (commaMatch) {
    const suffix = commaMatch[1].trim();
    if (notes) notes += '; ' + suffix;
    else notes = suffix;
    ingredientName = ingredientName.substring(0, commaMatch.index).trim();
  }
  
  // Extract dash notes: " - finely diced"
  const dashMatch = ingredientName.match(/\s+-\s+(.+)$/);
  if (dashMatch) {
    const suffix = dashMatch[1].trim();
    if (notes) notes += '; ' + suffix;
    else notes = suffix;
    ingredientName = ingredientName.substring(0, dashMatch.index).trim();
  }
  
  // Clean and validate ingredient name
  ingredientName = ingredientName.trim();
  
  // Remove any leading/trailing special characters that shouldn't be there
  // This removes: . , ; : ) ] } - / | & * + = ! ? and any whitespace/control chars
  // But preserve apostrophes within words (don't remove leading apostrophe if it's part of contraction)
  ingredientName = ingredientName.replace(/^[\s\.\,\;\:\)\]\}\-\/\|\&\*\+\=\!\?\<\>\"\`\~\#\@\$\%\^\(\[\{]+/g, '').trim();
  ingredientName = ingredientName.replace(/[\s\.\,\;\:\)\]\}\-\/\|\&\*\+\=\!\?\<\>\"\`\~\#\@\$\%\^\(\[\{]+$/g, '').trim();
  
  // Remove leading apostrophe only if followed by 's ' (possessive fragment like "'s food")
  if (ingredientName.match(/^'s\s/)) {
    ingredientName = ingredientName.substring(2).trim();
  }
  
  // Remove wrapping quotes but keep internal quotes
  if ((ingredientName.startsWith('"') && ingredientName.endsWith('"')) ||
      (ingredientName.startsWith("'") && ingredientName.endsWith("'"))) {
    ingredientName = ingredientName.substring(1, ingredientName.length - 1).trim();
  }
  
  // Create normalized version with validation
  let ingredientNorm = ingredientName.toLowerCase().trim();
  
  // Remove ANY remaining parentheses and their content from normalized name
  ingredientNorm = ingredientNorm.replace(/\([^)]*\)/g, ' ').trim();
  
  // Remove extra spaces
  ingredientNorm = ingredientNorm.replace(/\s+/g, ' ').trim();
  
  // Validate: if empty, too short, or only special chars, fall back to cleaned raw text
  if (!ingredientNorm || ingredientNorm.length < 2 || /^[^a-z0-9]+$/.test(ingredientNorm)) {
    // Try to extract something useful from the original by removing quantity patterns and parentheticals
    let cleaned = original
      .replace(/&nbsp;/g, ' ') // Decode HTML entities
      .replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"')
      .replace(/⁄/g, '/') // Unicode fraction slash
      .replace(/–/g, '-') // En/em dashes
      .replace(/—/g, '-')
      .replace(/·/g, ' ') // Bullet point
      .replace(/"/g, '"') // Smart quotes
      .replace(/"/g, '"')
      .replace(/'/g, "'") // Smart apostrophes
      .replace(/'/g, "'")
      .replace(/½|⅓|¼|⅔|¾|⅕|⅖|⅗|⅘|⅙|⅚|⅛|⅜|⅝|⅞/g, '') // Remove unicode fractions completely
      .replace(/^\s*\d+[\d\s\/\.\-]*(?:ounce|oz|lb|pound|gram|g|kg|ml|liter|l|cup|tsp|tbsp|can|jar|pkg|package|pack)s?\s*/i, '') // Remove leading quantity+unit
      .replace(/^\s*\d+[\d\s\/\.\-]*\s*\([^)]*\)\s*/, '') // Remove leading quantity+(size)
      .replace(/\([^)]*\)/g, '') // Remove all parentheticals
      .replace(/,.*$/, '') // Remove comma and everything after
      .replace(/^[\s\.\,\;\:\)\]\}\-\/\|\&\*\+\=\!\?\<\>\"\'\`\~\#\@\$\%\^\(\[\{]+/g, '') // Remove leading special chars
      .replace(/[\s\.\,\;\:\)\]\}\-\/\|\&\*\+\=\!\?\<\>\"\'\`\~\#\@\$\%\^\(\[\{]+$/g, '') // Remove trailing special chars
      .trim()
      .toLowerCase();
    
    // If still empty or invalid, use a more aggressive extraction - keep only letters and spaces
    if (!cleaned || cleaned.length < 2) {
      cleaned = original.replace(/[^a-zA-Z\s]+/g, ' ').trim().toLowerCase();
    }
    
    ingredientNorm = cleaned || 'unknown ingredient';
    ingredientName = ingredientNorm.charAt(0).toUpperCase() + ingredientNorm.slice(1);
  }
  
  return {
    IngredientRaw: original,
    IngredientName: ingredientName,
    IngredientNorm: ingredientNorm,
    QtyNum: qtyNum,
    QtyText: qtyText,
    Unit: unit,
    Notes: notes,
    StoreId: '',
    Category: ''
  };
}

// ---- pantry depletion helpers (used when planning meals) ----
// These helpers are intentionally conservative: they only convert between well-defined unit systems.
function canonicalUnit(u){
  const s0 = String(u || '').trim().toLowerCase();
  if (!s0) return '';

  // strip punctuation like "cups," or "tbsp."
  let s = s0.replace(/[.,;:()\[\]{}]/g, '').trim();
  if (!s) return '';

  // normalize common plurals/aliases
  const map = {
    teaspoon: 'tsp', teaspoons: 'tsp', tsp: 'tsp',
    tablespoon: 'tbsp', tablespoons: 'tbsp', tbsp: 'tbsp',
    cup: 'cup', cups: 'cup',
    ounce: 'oz', ounces: 'oz', oz: 'oz',
    pound: 'lb', pounds: 'lb', lb: 'lb', lbs: 'lb',
    gram: 'g', grams: 'g', g: 'g',
    kilogram: 'kg', kilograms: 'kg', kg: 'kg',
    milliliter: 'ml', millilitre: 'ml', milliliters: 'ml', millilitres: 'ml', ml: 'ml',
    liter: 'l', litre: 'l', liters: 'l', litres: 'l', l: 'l',
    pinch: 'pinch', pinches: 'pinch',
    clove: 'clove', cloves: 'clove',
    can: 'can', cans: 'can',
    jar: 'jar', jars: 'jar',
    package: 'package', packages: 'package', pkg: 'package', pkgs: 'package',
    bunch: 'bunch', bunches: 'bunch',
    slice: 'slice', slices: 'slice',
    piece: 'piece', pieces: 'piece'
  };
  return map[s] || s;
}

function unitFamily_(u){
  const cu = canonicalUnit(u);
  if (!cu) return { fam: '', base: '' };
  if (cu === 'tsp' || cu === 'tbsp' || cu === 'cup') return { fam: 'vol', base: 'tsp' };
  if (cu === 'ml' || cu === 'l') return { fam: 'ml', base: 'ml' };
  if (cu === 'g' || cu === 'kg' || cu === 'oz' || cu === 'lb') return { fam: 'wt', base: 'g' };
  // count-like units (no conversion beyond identity)
  return { fam: 'count', base: cu };
}

function toBase_(qty, unit){
  const q = Number(qty);
  if (!Number.isFinite(q)) return { ok: false, qty: null, unit: '' };
  const u = canonicalUnit(unit);
  if (!u) return { ok: false, qty: null, unit: '' };

  const fam = unitFamily_(u);
  if (!fam.fam) return { ok: false, qty: null, unit: '' };

  if (fam.fam === 'vol') {
    const mult = (u === 'tsp') ? 1 : (u === 'tbsp') ? 3 : (u === 'cup') ? 48 : null;
    if (mult === null) return { ok: false, qty: null, unit: '' };
    return { ok: true, qty: q * mult, unit: 'tsp' };
  }
  if (fam.fam === 'ml') {
    const mult = (u === 'ml') ? 1 : (u === 'l') ? 1000 : null;
    if (mult === null) return { ok: false, qty: null, unit: '' };
    return { ok: true, qty: q * mult, unit: 'ml' };
  }
  if (fam.fam === 'wt') {
    const mult = (u === 'g') ? 1 : (u === 'kg') ? 1000 : (u === 'oz') ? 28.349523125 : (u === 'lb') ? 453.59237 : null;
    if (mult === null) return { ok: false, qty: null, unit: '' };
    return { ok: true, qty: q * mult, unit: 'g' };
  }

  // count-like
  return { ok: true, qty: q, unit: fam.base };
}

function fromBase_(baseQty, targetUnit){
  const q = Number(baseQty);
  if (!Number.isFinite(q)) return { ok: false, qty: null };
  const u = canonicalUnit(targetUnit);
  if (!u) return { ok: false, qty: null };
  const fam = unitFamily_(u);

  if (fam.fam === 'vol') {
    const div = (u === 'tsp') ? 1 : (u === 'tbsp') ? 3 : (u === 'cup') ? 48 : null;
    if (div === null) return { ok: false, qty: null };
    return { ok: true, qty: q / div };
  }
  if (fam.fam === 'ml') {
    const div = (u === 'ml') ? 1 : (u === 'l') ? 1000 : null;
    if (div === null) return { ok: false, qty: null };
    return { ok: true, qty: q / div };
  }
  if (fam.fam === 'wt') {
    const div = (u === 'g') ? 1 : (u === 'kg') ? 1000 : (u === 'oz') ? 28.349523125 : (u === 'lb') ? 453.59237 : null;
    if (div === null) return { ok: false, qty: null };
    return { ok: true, qty: q / div };
  }
  return { ok: true, qty: q };
}

function convertQty_(qty, fromUnit, toUnit){
  const fu = canonicalUnit(fromUnit);
  const tu = canonicalUnit(toUnit);
  if (!fu || !tu) return { ok: false, qty: null };
  const fFam = unitFamily_(fu);
  const tFam = unitFamily_(tu);
  if (!fFam.fam || !tFam.fam) return { ok: false, qty: null };
  if (fFam.fam !== tFam.fam) return { ok: false, qty: null };
  const b = toBase_(qty, fu);
  if (!b.ok) return { ok: false, qty: null };
  const out = fromBase_(b.qty, tu);
  if (!out.ok) return { ok: false, qty: null };
  return { ok: true, qty: out.qty };
}

function pantryQtyFromRow_(row){
  if (!row) return { qtyNum: null, unit: '' };
  let qtyNum = (row.QtyNum === null || row.QtyNum === undefined || row.QtyNum === '') ? null : Number(row.QtyNum);
  let unit = String(row.Unit || '').trim();

  if ((qtyNum === null || !Number.isFinite(qtyNum)) && row.QtyText) {
    const parsed = parseQtyText_(row.QtyText);
    if (parsed && parsed.qtyNum !== null && Number.isFinite(parsed.qtyNum)) qtyNum = parsed.qtyNum;
    if (!unit && parsed && parsed.unit) unit = parsed.unit;
  }
  return {
    qtyNum: (qtyNum !== null && Number.isFinite(qtyNum)) ? qtyNum : null,
    unit: canonicalUnit(unit)
  };
}

function _deductFromPantry_(ingredientLower, requiredQty, baseUnit){
  const ing = normLower_(ingredientLower);
  const needBase = Number(requiredQty);
  const bu = canonicalUnit(baseUnit);
  if (!ing || !Number.isFinite(needBase) || needBase <= 0 || !bu) return 0;

  const hasQtyNum = pantryHasCol_('QtyNum');
  const hasUnit = pantryHasCol_('Unit');

  // Select only columns that exist in the current DB schema.
  const cols = ['ItemId','Name','NameLower','QtyText'];
  if (hasQtyNum) cols.push('QtyNum');
  if (hasUnit) cols.push('Unit');

  // Match on NameLower when present, fall back to lower(trim(Name)) for older rows.
  const rows = db().prepare(
    `SELECT ${cols.join(', ')} FROM pantry
     WHERE (NameLower = ? OR lower(trim(Name)) = ?)
     ORDER BY COALESCE(NameLower, lower(trim(Name))) ASC, ItemId ASC`
  ).all(ing, ing);

  if (!rows || !rows.length) return 0;

  let remainingNeedBase = needBase;
  let deductedTotalBase = 0;

  for (const r of rows) {
    if (remainingNeedBase <= 0) break;

    const cur = pantryQtyFromRow_(r);
    if (cur.qtyNum === null || !Number.isFinite(cur.qtyNum) || cur.qtyNum <= 0) continue;
    if (!cur.unit) continue;

    // Convert pantry row quantity into the ingredient base unit (if compatible).
    const curBaseResult = convertQty_(cur.qtyNum, cur.unit, bu);
    if (!curBaseResult.ok) continue;
    const curBase = curBaseResult.qty;
    if (!Number.isFinite(curBase) || curBase <= 0) continue;

    const takeBase = Math.min(curBase, remainingNeedBase);
    const leftBase = curBase - takeBase;

    // Write back in the pantry row's own unit when possible (preserves user-entered unit text).
    const leftInRowUnitResult = convertQty_(leftBase, bu, cur.unit);
    const leftQtyNum = (leftInRowUnitResult.ok && Number.isFinite(leftInRowUnitResult.qty)) ? Math.max(0, leftInRowUnitResult.qty) : 0;

    console.log(`[DEDUCT] ${ing}: cur=${cur.qtyNum}${cur.unit}, need=${needBase}${bu}, curBase=${curBase}, takeBase=${takeBase}, leftBase=${leftBase}, leftQty=${leftQtyNum}${cur.unit}`);

    const parsed = parseQtyText_(r.QtyText);
    const displayUnit = (parsed && parsed.unit) ? parsed.unit : (r.Unit || cur.unit || bu);

    const qtyTextOut = displayUnit ? `${Number(leftQtyNum.toFixed(4))} ${displayUnit}`.trim()
                                   : `${Number(leftQtyNum.toFixed(4))}`;

    if (hasQtyNum && hasUnit) {
      // Newer schema supports structured quantity fields.
      db().prepare(`UPDATE pantry SET QtyNum=?, Unit=?, QtyText=?, UpdatedAt=datetime('now') WHERE ItemId=?`)
        .run(leftQtyNum, cur.unit, qtyTextOut, r.ItemId);
    } else {
      // Legacy schema: only QtyText exists.
      db().prepare(`UPDATE pantry SET QtyText=?, UpdatedAt=datetime('now') WHERE ItemId=?`)
        .run(qtyTextOut, r.ItemId);
    }

    deductedTotalBase += takeBase;
    remainingNeedBase -= takeBase;
  }

  return deductedTotalBase;
}


function _addBackToPantry_(ingredientLower, addQty, baseUnit){
  const ing = normLower_(ingredientLower);
  const addBase = Number(addQty);
  const bu = canonicalUnit(baseUnit);
  console.log(`[ADD-BACK] Called for ${ing}: adding ${addBase} ${bu}`);
  if (!ing || !Number.isFinite(addBase) || addBase <= 0 || !bu) {
    console.log(`[ADD-BACK] Skipped - invalid params: ing=${ing}, addBase=${addBase}, bu=${bu}`);
    return;
  }

  const hasQtyNum = pantryHasCol_('QtyNum');
  const hasUnit = pantryHasCol_('Unit');

  const cols = ['ItemId','Name','NameLower','QtyText','StoreId','Notes'];
  if (hasQtyNum) cols.push('QtyNum');
  if (hasUnit) cols.push('Unit');

  const rows = db().prepare(
    `SELECT ${cols.join(', ')} FROM pantry
     WHERE (NameLower = ? OR lower(trim(Name)) = ?)
     ORDER BY COALESCE(NameLower, lower(trim(Name))) ASC, ItemId ASC`
  ).all(ing, ing);

  const fmt = (n) => Number(Number(n).toFixed(4));

  if (rows && rows.length) {
    // Add back into the first matching pantry row (consistent with deduction ordering).
    const r = rows[0];
    const cur = pantryQtyFromRow_(r);

    // If unit missing, treat add-back as the base unit and write it into QtyText.
    const rowUnit = cur.unit || bu;
    let curBase = 0;
    if (cur.qtyNum !== null && Number.isFinite(cur.qtyNum) && cur.qtyNum > 0) {
      const curBaseResult = convertQty_(cur.qtyNum, rowUnit, bu);
      curBase = (curBaseResult.ok && Number.isFinite(curBaseResult.qty)) ? curBaseResult.qty : 0;
    }

    const newBase = curBase + addBase;
    const newInRowUnitResult = convertQty_(newBase, bu, rowUnit);
    const newQtyNum = (newInRowUnitResult.ok && Number.isFinite(newInRowUnitResult.qty)) ? fmt(newInRowUnitResult.qty) : fmt(addBase);

    console.log(`[ADD-BACK] ${ing}: cur=${cur.qtyNum}${cur.unit}, adding=${addBase}${bu}, curBase=${curBase}, newBase=${newBase}, newQty=${newQtyNum}${rowUnit}`);

    const parsed = parseQtyText_(r.QtyText);
    const displayUnit = (parsed && parsed.unit) ? parsed.unit : (r.Unit || rowUnit || bu);
    const qtyTextOut = displayUnit ? `${newQtyNum} ${displayUnit}`.trim() : `${newQtyNum}`;

    if (hasQtyNum && hasUnit) {
      db().prepare(`UPDATE pantry SET QtyNum=?, Unit=?, QtyText=?, UpdatedAt=datetime('now') WHERE ItemId=?`)
        .run(newQtyNum, rowUnit, qtyTextOut, r.ItemId);
    } else {
      db().prepare(`UPDATE pantry SET QtyText=?, UpdatedAt=datetime('now') WHERE ItemId=?`)
        .run(qtyTextOut, r.ItemId);
    }
    console.log(`[ADD-BACK] ${ing}: Updated pantry to ${newQtyNum} ${rowUnit}`);
    return;
  }

  // No existing pantry row: create a new one (legacy-safe).
  const itemId = uuidShort_('pan');
  const displayName = String(ingredientLower || '').trim() || ing;
  
  // Convert to display format
  const displayQtyResult = convertQty_(addBase, bu, bu);
  const displayQty = (displayQtyResult.ok && Number.isFinite(displayQtyResult.qty)) ? displayQtyResult.qty : addBase;
  const qtyTextOut = `${fmt(displayQty)} ${bu}`.trim();

  if (hasQtyNum && hasUnit) {
    db().prepare(`
      INSERT INTO pantry(ItemId, Name, NameLower, QtyText, QtyNum, Unit, StoreId, Notes, UpdatedAt)
      VALUES(?,?,?,?,?,?,?,?,datetime('now'))
    `).run(itemId, displayName, ing, qtyTextOut, fmt(addBase), bu, '', '');
  } else {
    db().prepare(`
      INSERT INTO pantry(ItemId, Name, NameLower, QtyText, StoreId, Notes, UpdatedAt)
      VALUES(?,?,?,?,?,?,datetime('now'))
    `).run(itemId, displayName, ing, qtyTextOut, '', '');
  }
}


// Reserved hook (kept no-op unless additional reconciliation logic is needed)
function _reconcileOutstandingFromDate_(_dateYmd){
  return;
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
      case 'importRecipeFromUrl': return importRecipeFromUrl(payload);

      case 'getPlansRange': return getPlansRange(payload);
      case 'upsertPlanMeal': return upsertPlanMeal(payload);
      case 'swapPlanMeals': return swapPlanMeals(payload);
      case 'clearMealsByRange': return clearMealsByRange(payload);

      case 'buildShoppingList': return buildShoppingList(payload);

      // Shopping list: assign/reassign store for items in the selected plan range
      case 'assignShoppingItemStore': return assignShoppingItemStore(payload);

      case 'listPantry': return listPantry(payload);
      case 'upsertPantryItem': return upsertPantryItem(payload);
      case 'deletePantryItem': return deletePantryItem(payload);
      case 'getExpiringPantryItems': return getExpiringPantryItems(payload);
      case 'getLowStockPantryItems': return getLowStockPantryItems(payload);

      case 'calendarSyncRange': return calendarSyncRange(payload, store);

      // Google Calendar API
      case 'googleCalendarSyncRange': return googleCalendarSyncRange(payload, store);
      case 'initGoogleCalendar': return initGoogleCalendar(payload);
      case 'getGoogleAuthUrl': return getGoogleAuthUrl();
      case 'setGoogleAuthCode': return setGoogleAuthCode(payload);
      case 'listGoogleCalendars': return listGoogleCalendars();
      case 'getGoogleCalendarStatus': return getGoogleCalendarStatus();
      case 'revokeGoogleCalendar': return revokeGoogleCalendar();
      case 'checkGoogleCalendarDuplicates': return checkGoogleCalendarDuplicates(payload);

      // Recipe Collections API
      case 'listCollections': return listCollections();
      case 'getCollection': return getCollection(payload);
      case 'upsertCollection': return upsertCollection(payload);
      case 'deleteCollection': return deleteCollection(payload);
      case 'addRecipeToCollection': return addRecipeToCollection(payload);
      case 'removeRecipeFromCollection': return removeRecipeFromCollection(payload);
      case 'listCollectionRecipes': return listCollectionRecipes(payload);
      case 'setMainDishInCollection': return setMainDishInCollection(payload);

      // Additional Items API
      case 'addAdditionalItem': return addAdditionalItem(payload);
      case 'removeAdditionalItem': return removeAdditionalItem(payload);
      case 'getAdditionalItems': return getAdditionalItems(payload);
      case 'assignCollectionToSlot': return assignCollectionToSlot(payload);
      case 'addCollectionToShoppingList': return addCollectionToShoppingList(payload);

      // Categorization API
      case 'getCategoryOverrides': return getCategoryOverrides();
      case 'saveCategoryOverride': return saveCategoryOverride(payload);
      case 'deleteCategoryOverride': return deleteCategoryOverride(payload);
      case 'getIngredientCategories': return getIngredientCategories();
      case 'setIngredientCategories': return setIngredientCategories(payload);
      case 'classifyIngredient': return classifyIngredient(payload);
      case 'trainIngredientCategory': return trainIngredientCategory(payload);
      case 'autoAssignCuisines': return autoAssignCuisines(payload);
      case 'listUniqueCuisines': return listUniqueCuisines(payload);
      case 'manageCuisine': return manageCuisine(payload);

      default:
        return err_('Unknown function: ' + fn);
    }
  } catch (e) {
    console.error('[handleApiCall] ERROR in function', fn, ':', e);
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
      "SELECT RecipeId, Title, TitleLower, URL, Cuisine, MealType, Notes, Instructions, Image_Name, is_favorite " +
      "FROM recipes WHERE TitleLower >= ? AND TitleLower < ? " +
      "ORDER BY TitleLower ASC, RecipeId ASC"
    ).all(q, q + '\uf8ff');
  } else {
    rows = db().prepare(
      "SELECT RecipeId, Title, TitleLower, URL, Cuisine, MealType, Notes, Instructions, Image_Name, is_favorite " +
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
      IngredientName: String(x.IngredientName || '').trim(),
      Notes: String(x.Notes || '').trim(),
      QtyNum: (x.QtyNum === '' || x.QtyNum === null || x.QtyNum === undefined) ? null : Number(x.QtyNum),
      QtyText: String(x.QtyText || '').trim(),
      StoreId: String(x.StoreId || '').trim(),
      Unit: String(x.Unit || '').trim(),
      Category: String(x.Category || '').trim()
    }))
    .filter(x => x.IngredientRaw);

  const ins = db().prepare("INSERT INTO ingredients(RecipeId, idx, IngredientNorm, IngredientRaw, IngredientName, Notes, QtyNum, QtyText, StoreId, Unit, Category) VALUES(?,?,?,?,?,?,?,?,?,?,?)");
  const tx = db().transaction(() => {
    cleaned.forEach((x, i) => {
      const norm = x.IngredientNorm || normLower_(x.IngredientRaw);
      const name = x.IngredientName || x.IngredientRaw;
      ins.run(recipeId, i, norm, x.IngredientRaw, name, x.Notes, x.QtyNum, x.QtyText, x.StoreId, x.Unit, x.Category);
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

// ---- Auto-categorization functions ----

const COMPREHENSIVE_CUISINES = [
  'Afghan','African','Albanian','American','Argentinian','Armenian','Asian','Australian','Austrian',
  'Bangladeshi','Barbecue','Belgian','Bolivian','Brazilian','British','Bulgarian','Cajun/Creole',
  'Cambodian','Caribbean','Chilean','Chinese','Colombian','Cuban','Czech',
  'Danish','Dominican','Dutch',
  'Ecuadorian','Egyptian','English','Ethiopian','European',
  'Filipino','Finnish','French',
  'Georgian','German','Greek','Guatemalan',
  'Haitian','Hawaiian','Hungarian',
  'Icelandic','Indian','Indonesian','Iranian','Iraqi','Irish','Israeli','Italian',
  'Jamaican','Japanese','Jewish','Jordanian',
  'Korean','Kosher',
  'Latin American','Lebanese',
  'Malaysian','Mediterranean','Mexican','Middle Eastern','Mongolian','Moroccan',
  'Nepalese','New Zealand','Nigerian','Norwegian',
  'Pakistani','Persian','Peruvian','Polish','Portuguese','Puerto Rican',
  'Romanian','Russian',
  'Salvadoran','Scandinavian','Scottish','Seafood','Serbian','Singaporean','Slovak','South African','South American','Spanish','Sri Lankan','Swedish','Swiss',
  'Taiwanese','Thai','Tibetan','Turkish',
  'Ukrainian',
  'Vegan','Vegetarian','Vietnamese',
  'Welsh'
];

function detectCuisine(recipeData) {
  // Priority 1: Check JSON-LD recipeCuisine field
  if (recipeData.recipeCuisine) {
    const cuisine = String(recipeData.recipeCuisine).trim();
    // Try exact match first
    const exactMatch = COMPREHENSIVE_CUISINES.find(c => c.toLowerCase() === cuisine.toLowerCase());
    if (exactMatch) return exactMatch;
    
    // Try partial match
    const partialMatch = COMPREHENSIVE_CUISINES.find(c => cuisine.toLowerCase().includes(c.toLowerCase()) || c.toLowerCase().includes(cuisine.toLowerCase()));
    if (partialMatch) return partialMatch;
  }
  
  // Priority 2: Check keywords in name, description, category
  const keywords = [
    recipeData.keywords,
    recipeData.name,
    recipeData.description,
    recipeData.recipeCategory
  ].filter(Boolean).join(' ').toLowerCase();
  
  // Cuisine keyword mapping (expanded)
  const cuisineKeywords = {
    'Italian': ['italian', 'pasta', 'pizza', 'risotto', 'parmigiana', 'carbonara', 'bolognese', 'tiramisu', 'lasagna', 'ravioli', 'gnocchi'],
    'Mexican': ['mexican', 'taco', 'burrito', 'enchilada', 'salsa', 'guacamole', 'quesadilla', 'fajita', 'tortilla', 'tamale', 'chile'],
    'Chinese': ['chinese', 'stir-fry', 'wok', 'szechuan', 'kung pao', 'chow mein', 'dim sum', 'fried rice', 'lo mein'],
    'Indian': ['indian', 'curry', 'tikka', 'masala', 'tandoori', 'biryani', 'naan', 'samosa', 'dal', 'paneer'],
    'Japanese': ['japanese', 'sushi', 'ramen', 'teriyaki', 'tempura', 'udon', 'miso', 'sake', 'sashimi', 'bento'],
    'Thai': ['thai', 'pad thai', 'tom yum', 'green curry', 'red curry', 'lemongrass', 'galangal', 'coconut milk'],
    'French': ['french', 'croissant', 'baguette', 'ratatouille', 'coq au vin', 'crepe', 'souffle', 'boeuf bourguignon'],
    'Greek': ['greek', 'gyro', 'moussaka', 'tzatziki', 'feta', 'baklava', 'souvlaki', 'spanakopita'],
    'Mediterranean': ['mediterranean', 'hummus', 'falafel', 'tabbouleh', 'olive oil', 'couscous', 'tahini'],
    'American': ['american', 'burger', 'bbq', 'hot dog', 'mac and cheese', 'fried chicken', 'apple pie'],
    'Korean': ['korean', 'kimchi', 'bibimbap', 'bulgogi', 'gochujang', 'banchan'],
    'Vietnamese': ['vietnamese', 'pho', 'banh mi', 'spring roll', 'fish sauce', 'bun'],
    'Caribbean': ['caribbean', 'jerk', 'plantain', 'rice and peas', 'mango'],
    'Middle Eastern': ['middle eastern', 'kebab', 'shawarma', 'falafel', 'hummus', 'pita'],
    'Spanish': ['spanish', 'paella', 'tapas', 'gazpacho', 'churro', 'tortilla espanola'],
    'British': ['british', 'fish and chips', 'shepherd\'s pie', 'bangers and mash', 'yorkshire pudding'],
    'German': ['german', 'schnitzel', 'bratwurst', 'sauerkraut', 'pretzel', 'strudel'],
    'Brazilian': ['brazilian', 'feijoada', 'churrasco', 'brigadeiro', 'pao de queijo']
  };
  
  for (const [cuisine, keywords_list] of Object.entries(cuisineKeywords)) {
    for (const kw of keywords_list) {
      if (keywords.includes(kw)) {
        return cuisine;
      }
    }
  }
  
  // Priority 3: Analyze ingredients
  const ingredients = (recipeData.recipeIngredient || []).join(' ').toLowerCase();
  const ingredientClues = {
    'Italian': ['parmesan', 'mozzarella', 'basil', 'oregano', 'marinara', 'pecorino', 'prosciutto'],
    'Mexican': ['cilantro', 'jalapeño', 'jalapeno', 'cumin', 'lime', 'tortilla', 'chipotle', 'cotija'],
    'Asian': ['soy sauce', 'sesame oil', 'ginger', 'rice vinegar', 'fish sauce'],
    'Indian': ['garam masala', 'turmeric', 'cardamom', 'coriander', 'ghee', 'curry powder'],
    'Thai': ['lemongrass', 'galangal', 'thai basil', 'fish sauce', 'coconut milk'],
    'Chinese': ['soy sauce', 'sesame oil', 'oyster sauce', 'hoisin', 'shaoxing'],
    'Japanese': ['miso', 'dashi', 'mirin', 'sake', 'nori', 'wasabi'],
    'Mediterranean': ['olive oil', 'lemon', 'garlic', 'chickpea', 'tahini', 'za\'atar']
  };
  
  for (const [cuisine, clues] of Object.entries(ingredientClues)) {
    const matches = clues.filter(clue => ingredients.includes(clue)).length;
    if (matches >= 2) return cuisine;
  }
  
  return ''; // Unknown
}

function detectMealType(recipeData) {
  const name = (recipeData.name || '').toLowerCase();
  const description = (recipeData.description || '').toLowerCase();
  const keywords = Array.isArray(recipeData.keywords) 
    ? recipeData.keywords.join(' ').toLowerCase() 
    : (recipeData.keywords || '').toLowerCase();
  const category = Array.isArray(recipeData.recipeCategory)
    ? recipeData.recipeCategory.join(' ').toLowerCase()
    : (recipeData.recipeCategory || '').toLowerCase();
  const text = [name, description, keywords, category].join(' ');
  
  // Meal type patterns (ordered by specificity - most specific first)
  const patterns = {
    'Dessert': ['dessert', 'cake', 'cookie', 'brownie', 'pie', 'tart', 'pudding', 'ice cream', 'candy', 'sweet', 'chocolate chip', 'cupcake', 'mousse', 'cheesecake', 'fudge'],
    'Appetizer': ['appetizer', 'starter', 'hors d\'oeuvre', 'canape', 'finger food', 'dip'],
    'Snack': ['snack', 'nibbles', 'munchies', 'trail mix', 'energy bar'],
    'Brunch': ['brunch'],
    'Breakfast': ['breakfast', 'pancake', 'waffle', 'omelet', 'omelette', 'cereal', 'oatmeal', 'french toast', 'scrambled', 'eggs benedict', 'frittata', 'bagel', 'croissant'],
    'Lunch': ['lunch', 'sandwich', 'wrap', 'salad bowl', 'panini', 'club sandwich'],
    'Dinner': ['dinner', 'entree', 'entrée', 'main dish', 'main course', 'roast', 'steak', 'casserole'],
    'Side Dish': ['side dish', 'side', 'accompaniment', 'coleslaw', 'mashed potatoes', 'roasted vegetables', 'garlic bread', 'rice pilaf'],
    'Beverage': ['beverage', 'drink', 'cocktail', 'smoothie', 'juice', 'lemonade', 'tea', 'coffee']
  };
  
  for (const [mealType, keywords_list] of Object.entries(patterns)) {
    for (const kw of keywords_list) {
      if (text.includes(kw)) return mealType;
    }
  }
  
  return 'Any'; // Default
}

async function importRecipeFromUrl(payload){
  const url = String(payload && payload.url || '').trim();
  if (!url) return err_('Missing URL.');
  
  // Validate URL
  let parsedUrl;
  try {
    parsedUrl = new URL(url);
  } catch (e) {
    return err_('Invalid URL format.');
  }
  
  try {
    const https = require('https');
    
    // Fetch the HTML
    const html = await new Promise((resolve, reject) => {
      const req = https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
        let data = '';
        res.on('data', (chunk) => data += chunk);
        res.on('end', () => resolve(data));
      });
      req.on('error', reject);
      req.setTimeout(15000, () => {
        req.destroy();
        reject(new Error('Request timeout'));
      });
    });
    
    // Parse recipe data using JSON-LD schema (most modern recipe sites use this)
    const jsonLdMatch = html.match(/<script[^>]*type=["']application\/ld\+json["'][^>]*>(.*?)<\/script>/is);
    let recipeData = null;
    
    if (jsonLdMatch) {
      try {
        const jsonData = JSON.parse(jsonLdMatch[1]);
        // Handle both single recipe and array of items
        const recipes = Array.isArray(jsonData) ? jsonData : (jsonData['@graph'] ? jsonData['@graph'] : [jsonData]);
        recipeData = recipes.find(item => item['@type'] === 'Recipe' || (Array.isArray(item['@type']) && item['@type'].includes('Recipe')));
      } catch (e) {
        console.log('[IMPORT] JSON-LD parse error:', e.message);
      }
    }
    
    if (recipeData) {
      // Extract from structured data
      const title = recipeData.name || '';
      const instructions = Array.isArray(recipeData.recipeInstructions) 
        ? recipeData.recipeInstructions.map(step => {
            if (typeof step === 'string') return step;
            if (step.text) return step.text;
            return '';
          }).filter(Boolean).join('\n\n')
        : (recipeData.recipeInstructions || '');
      
      const ingredientLines = Array.isArray(recipeData.recipeIngredient) 
        ? recipeData.recipeIngredient 
        : [];
      
      // Parse ingredients using enhanced parser
      const ingredients = ingredientLines.map(line => {
        const parsed = parseIngredientLine(line);
        return parsed || { IngredientRaw: line, IngredientName: line, IngredientNorm: line.toLowerCase(), QtyNum: null, QtyText: '', Unit: '', Notes: '', StoreId: '', Category: '' };
      });
      
      const servings = recipeData.recipeYield 
        ? (typeof recipeData.recipeYield === 'number' ? recipeData.recipeYield : parseInt(String(recipeData.recipeYield).replace(/\D/g, '')) || 4)
        : 4;
      
      const imageUrl = recipeData.image 
        ? (Array.isArray(recipeData.image) ? recipeData.image[0] : (typeof recipeData.image === 'object' && recipeData.image.url ? recipeData.image.url : recipeData.image))
        : '';
      
      // Auto-detect cuisine and meal type
      const cuisine = detectCuisine(recipeData);
      const mealType = detectMealType(recipeData);
      
      return ok_({
        title,
        ingredients,
        instructions,
        servings,
        cuisine,
        mealType,
        imageUrl,
        url
      });
    }
    
    // Fallback: Try to parse basic HTML structure
    const titleMatch = html.match(/<h1[^>]*>([^<]+)<\/h1>/i) || html.match(/<title>([^<]+)<\/title>/i);
    const title = titleMatch ? titleMatch[1].replace(/\s*[-|].*$/, '').trim() : 'Imported Recipe';
    
    // Try to find ingredients section
    const ingredientsMatch = html.match(/<ul[^>]*class="[^"]*ingredient[^"]*"[^>]*>(.*?)<\/ul>/is) 
      || html.match(/<div[^>]*class="[^"]*ingredient[^"]*"[^>]*>(.*?)<\/div>/is);
    
    const ingredients = [];
    if (ingredientsMatch) {
      const liMatches = ingredientsMatch[1].matchAll(/<li[^>]*>([^<]+)<\/li>/gi);
      for (const match of liMatches) {
        const ingredient = match[1].trim().replace(/<[^>]+>/g, '');
        if (ingredient) ingredients.push(ingredient);
      }
    }
    
    return ok_({
      title,
      ingredients,
      instructions: 'Instructions not found. Please copy from the source URL.',
      servings: 4,
      cuisine: '',
      imageUrl: '',
      url
    });
    
  } catch (e) {
    return err_(`Failed to fetch recipe: ${e.message}`);
  }
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

  const runTx = db().transaction(() => {
    // Ensure plan row exists
    db().prepare("INSERT INTO plans(Date, UpdatedAt) VALUES(?, datetime('now')) ON CONFLICT(Date) DO NOTHING").run(dateId);

    // Revert any prior pantry deductions for this slot before changing the plan
    const priorRows = db().prepare(`
      SELECT IngredientNorm, DeductedBase, BaseUnit
      FROM plan_meal_ingredients
      WHERE PlanDate=? AND Slot=?
    `).all(dateId, slot);

    console.log(`[REVERT] Found ${priorRows.length} prior deductions for ${dateId} ${slot}`);
    for (const r of priorRows) {
      if (r && Number(r.DeductedBase) > 0) {
        console.log(`[REVERT] Adding back ${r.IngredientNorm}: ${r.DeductedBase} ${r.BaseUnit}`);
        _addBackToPantry_(r.IngredientNorm, Number(r.DeductedBase), r.BaseUnit);
      }
    }
    db().prepare(`DELETE FROM plan_meal_ingredients WHERE PlanDate=? AND Slot=?`).run(dateId, slot);

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
    } else if (schema.hasLegacy) {
      const col = slot; // Breakfast/Lunch/Dinner columns store JSON
      const json = mealToJson_(meal);
      db().prepare(`UPDATE plans SET ${col}=?, UpdatedAt=datetime('now') WHERE Date=?`).run(json, dateId);
    } else {
      throw new Error('Unsupported plans schema.');
    }

    // Apply pantry deductions for the newly set meal (persistent depletion on planning)
    const ridNow = meal && meal.RecipeId ? String(meal.RecipeId) : '';
    const useLeftNow = !!(meal && meal.UseLeftovers);

    console.log(`[PANTRY] Planning meal - RecipeId: ${ridNow}, UseLeftovers: ${useLeftNow}`);

    if (ridNow && !useLeftNow) {
      // Use IngredientNorm when present, otherwise fall back to IngredientRaw (new recipes may not yet have normalized values).
      const ings = db().prepare(`SELECT IngredientNorm, IngredientRaw, QtyNum, Unit FROM ingredients WHERE RecipeId=?`).all(ridNow);
      console.log(`[PANTRY] Found ${ings.length} ingredients for recipe ${ridNow}`);
      const reqMap = new Map(); // key: norm|unit -> required qty in that unit

      for (const ing of ings) {
        if (!ing) continue;
        const norm = normLower_(ing.IngredientNorm || ing.IngredientRaw);
        if (!norm) continue;
        let q = Number(ing.QtyNum);
        let u = canonicalUnit(ing.Unit);
        console.log(`[PANTRY] Processing ingredient: ${norm}, qty=${q}, unit=${u}`);

        // Support older/legacy ingredient rows that only have QtyText populated.
        if ((!Number.isFinite(q) || q <= 0) && ing.QtyText) {
          const parsed = parseQtyText_(ing.QtyText);
          if (parsed && parsed.qtyNum !== null && Number.isFinite(parsed.qtyNum)) q = parsed.qtyNum;
          if (!u && parsed && parsed.unit) u = canonicalUnit(parsed.unit);
        }

        if (!Number.isFinite(q) || q <= 0) continue;
        if (!u) continue;
        const k = `${norm}|${u}`;
        reqMap.set(k, (reqMap.get(k) || 0) + q);
      }

      const now = new Date().toISOString();
      console.log(`[PANTRY] About to deduct ${reqMap.size} unique ingredients`);
      for (const [k, requiredBase] of reqMap.entries()) {
        const [norm, baseUnit] = k.split('|');
        console.log(`[PANTRY] Deducting ${norm}: ${requiredBase} ${baseUnit}`);
        const deducted = _deductFromPantry_(norm, requiredBase, baseUnit);
        console.log(`[PANTRY] Deducted ${deducted} ${baseUnit} of ${norm}`);
        db().prepare(`
          INSERT INTO plan_meal_ingredients(PlanDate, Slot, RecipeId, IngredientNorm, RequiredBase, DeductedBase, BaseUnit, UpdatedAt)
          VALUES(?,?,?,?,?,?,?,?)
        `).run(dateId, slot, ridNow, norm, requiredBase, deducted, baseUnit, now);
      }
    }
  });

  try {
    runTx();
    try { _reconcileOutstandingFromDate_(dateId); } catch (_) {}
    return ok_({});
  } catch (e) {
    return err_(e && e.message ? e.message : String(e));
  }
}


function swapPlanMeals(payload){
  // Support both same-day swap (legacy) and cross-date swap (new)
  const date1 = String(payload && (payload.date || payload.date1) || '').trim();
  const slot1 = String(payload && (payload.a || payload.slot1) || '').trim();
  const date2 = String(payload && payload.date2 || date1).trim();
  const slot2 = String(payload && (payload.b || payload.slot2) || '').trim();
  
  if (!date1) return err_('Missing date1.');
  if (!['Breakfast','Lunch','Dinner'].includes(slot1)) return err_('Invalid slot1.');
  if (!['Breakfast','Lunch','Dinner'].includes(slot2)) return err_('Invalid slot2.');

  const schema = plansSchema_();
  
  // Get both plan rows
  const row1 = db().prepare("SELECT * FROM plans WHERE Date=?").get(date1);
  const row2 = date1 === date2 ? row1 : db().prepare("SELECT * FROM plans WHERE Date=?").get(date2);
  
  if (!row1 && !row2) return ok_({}); // Nothing to swap

  if (schema.hasNew) {
    const map = {
      Breakfast: ['BreakfastRecipeId','BreakfastTitle','BreakfastUseLeftovers','BreakfastFrom'],
      Lunch: ['LunchRecipeId','LunchTitle','LunchUseLeftovers','LunchFrom'],
      Dinner: ['DinnerRecipeId','DinnerTitle','DinnerUseLeftovers','DinnerFrom']
    };
    
    const cols1 = map[slot1];
    const cols2 = map[slot2];
    
    // Get values from row1/slot1
    const meal1 = row1 ? {
      rid: row1[cols1[0]],
      title: row1[cols1[1]],
      useLeftovers: row1[cols1[2]],
      from: row1[cols1[3]]
    } : { rid: null, title: null, useLeftovers: 0, from: null };
    
    // Get values from row2/slot2
    const meal2 = row2 ? {
      rid: row2[cols2[0]],
      title: row2[cols2[1]],
      useLeftovers: row2[cols2[2]],
      from: row2[cols2[3]]
    } : { rid: null, title: null, useLeftovers: 0, from: null };
    
    // Ensure both plan rows exist
    if (!row1) {
      db().prepare("INSERT INTO plans(Date, UpdatedAt) VALUES(?, datetime('now'))").run(date1);
    }
    if (!row2 && date1 !== date2) {
      db().prepare("INSERT INTO plans(Date, UpdatedAt) VALUES(?, datetime('now'))").run(date2);
    }
    
    // Swap: set row1/slot1 to meal2, row2/slot2 to meal1
    db().prepare(`UPDATE plans SET ${cols1[0]}=?, ${cols1[1]}=?, ${cols1[2]}=?, ${cols1[3]}=?, UpdatedAt=datetime('now') WHERE Date=?`)
      .run(meal2.rid, meal2.title, meal2.useLeftovers, meal2.from, date1);
    
    if (date1 !== date2) {
      db().prepare(`UPDATE plans SET ${cols2[0]}=?, ${cols2[1]}=?, ${cols2[2]}=?, ${cols2[3]}=?, UpdatedAt=datetime('now') WHERE Date=?`)
        .run(meal1.rid, meal1.title, meal1.useLeftovers, meal1.from, date2);
    } else {
      // Same date - update both slots in one query
      db().prepare(`UPDATE plans SET ${cols2[0]}=?, ${cols2[1]}=?, ${cols2[2]}=?, ${cols2[3]}=?, UpdatedAt=datetime('now') WHERE Date=?`)
        .run(meal1.rid, meal1.title, meal1.useLeftovers, meal1.from, date2);
    }
    
    return ok_({});
  }

  if (schema.hasLegacy) {
    const meal1 = row1 ? (row1[slot1] || null) : null;
    const meal2 = row2 ? (row2[slot2] || null) : null;
    
    if (!row1) {
      db().prepare("INSERT INTO plans(Date, UpdatedAt) VALUES(?, datetime('now'))").run(date1);
    }
    if (!row2 && date1 !== date2) {
      db().prepare("INSERT INTO plans(Date, UpdatedAt) VALUES(?, datetime('now'))").run(date2);
    }
    
    db().prepare(`UPDATE plans SET ${slot1}=?, UpdatedAt=datetime('now') WHERE Date=?`).run(meal2, date1);
    
    if (date1 !== date2) {
      db().prepare(`UPDATE plans SET ${slot2}=?, UpdatedAt=datetime('now') WHERE Date=?`).run(meal1, date2);
    } else {
      db().prepare(`UPDATE plans SET ${slot2}=?, UpdatedAt=datetime('now') WHERE Date=?`).run(meal1, date2);
    }
    
    return ok_({});
  }

  return err_('Unsupported plans schema.');
}


function clearMealsByRange(payload){
  const start = String(payload && payload.start || '').trim();
  const end = String(payload && payload.end || '').trim();
  const clearAll = payload && payload.clearAll === true;
  
  if (!clearAll && (!start || !end)) {
    return err_('Missing start/end dates for range clear.');
  }
  
  try {
    const schema = plansSchema_();
    
    if (clearAll) {
      // Clear all meals from the entire plans table
      if (schema.hasNew) {
        db().prepare(`
          UPDATE plans SET 
            BreakfastRecipeId=NULL, BreakfastTitle=NULL, BreakfastUseLeftovers=0, BreakfastFrom=NULL,
            LunchRecipeId=NULL, LunchTitle=NULL, LunchUseLeftovers=0, LunchFrom=NULL,
            DinnerRecipeId=NULL, DinnerTitle=NULL, DinnerUseLeftovers=0, DinnerFrom=NULL,
            UpdatedAt=datetime('now')
        `).run();
      } else if (schema.hasLegacy) {
        db().prepare(`
          UPDATE plans SET 
            Breakfast=NULL, Lunch=NULL, Dinner=NULL,
            UpdatedAt=datetime('now')
        `).run();
      }
      
      // Clear all pantry deduction ledger entries
      db().prepare(`DELETE FROM plan_meal_ingredients`).run();
      
      const count = db().prepare('SELECT COUNT(*) as count FROM plans').get();
      return ok_({ message: `Cleared all meals from ${count.count} plan entries.`, count: count.count });
    } else {
      // Clear meals within the specified date range
      if (schema.hasNew) {
        db().prepare(`
          UPDATE plans SET 
            BreakfastRecipeId=NULL, BreakfastTitle=NULL, BreakfastUseLeftovers=0, BreakfastFrom=NULL,
            LunchRecipeId=NULL, LunchTitle=NULL, LunchUseLeftovers=0, LunchFrom=NULL,
            DinnerRecipeId=NULL, DinnerTitle=NULL, DinnerUseLeftovers=0, DinnerFrom=NULL,
            UpdatedAt=datetime('now')
          WHERE Date >= ? AND Date <= ?
        `).run(start, end);
      } else if (schema.hasLegacy) {
        db().prepare(`
          UPDATE plans SET 
            Breakfast=NULL, Lunch=NULL, Dinner=NULL,
            UpdatedAt=datetime('now')
          WHERE Date >= ? AND Date <= ?
        `).run(start, end);
      }
      
      // Clear pantry deduction ledger entries for the date range
      db().prepare(`DELETE FROM plan_meal_ingredients WHERE PlanDate >= ? AND PlanDate <= ?`).run(start, end);
      
      const count = db().prepare('SELECT COUNT(*) as count FROM plans WHERE Date >= ? AND Date <= ?').get(start, end);
      return ok_({ message: `Cleared meals from ${start} to ${end} (${count.count} days).`, count: count.count });
    }
  } catch (e) {
    return err_(e && e.message ? e.message : String(e));
  }
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
  const includeLowStock = payload && payload.includeLowStock === true;
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

  // Collect additional items from plan_additional_items table
  try {
    const additionalStmt = db().prepare(`
      SELECT DISTINCT RecipeId 
      FROM plan_additional_items 
      WHERE Date >= ? AND Date <= ?
    `);
    const additionalRows = additionalStmt.all(start, end);
    for (const row of additionalRows) {
      if (row.RecipeId) recipeIds.add(String(row.RecipeId));
    }
  } catch (e) {
    // Table might not exist in older databases, just skip
    console.warn('[buildShoppingList] Could not query plan_additional_items:', e.message);
  }

  const ids = Array.from(recipeIds).filter(Boolean);
  
  // Aggregate items by Store -> Category -> Ingredient
  // Structure: storeId -> category -> key -> { IngredientNorm, Unit, QtyNum, QtyTexts, Count, Examples, Category }
  const agg = Object.create(null);

  // Add low-stock pantry items if requested
  if (includeLowStock) {
    const lowStockRes = getLowStockPantryItems({});
    console.log('[SHOPPING-LIST] Low stock items:', lowStockRes);
    if (lowStockRes.ok && lowStockRes.items && lowStockRes.items.length) {
      for (const item of lowStockRes.items) {
        const storeId = String(item.StoreId || '').trim() || defaultStoreIdKroger_() || 'unassigned';
        let category = String(item.Category || '').trim();
        if (category) {
          category = category.charAt(0).toUpperCase() + category.slice(1).toLowerCase();
        }
        if (!category) category = 'Pantry Restock';
        
        const norm = String(item.NameLower || item.Name || '').trim().toLowerCase();
        if (!norm) continue;
        
        const unit = String(item.Unit || '').trim();
        const key = (norm + '|' + unit).toLowerCase();
        
        const threshold = Number(item.low_stock_threshold);
        const current = Number(item.QtyNum);
        
        // Calculate how much to buy
        // Goal: bring pantry back up to threshold level (or slightly above if already at threshold)
        let needQty;
        if (Number.isFinite(threshold) && Number.isFinite(current)) {
          if (current < threshold) {
            // Buy enough to reach threshold
            needQty = threshold - current;
          } else if (current === threshold) {
            // Already at threshold - buy threshold amount to restock
            needQty = threshold;
          } else {
            needQty = 0; // Above threshold, don't buy
          }
        } else {
          needQty = threshold || 1; // Fallback
        }
        
        console.log(`[SHOPPING-LIST] ${item.Name}: current=${current}, threshold=${threshold}, needQty=${needQty}`);
        
        // Skip if no quantity needed
        if (!Number.isFinite(needQty) || needQty <= 0) {
          console.log(`[SHOPPING-LIST] Skipping ${item.Name} - no quantity needed`);
          continue;
        }
        
        if (!agg[storeId]) agg[storeId] = Object.create(null);
        if (!agg[storeId][category]) agg[storeId][category] = Object.create(null);
        
        // Use same aggregation logic as recipes - may already exist in list from recipes
        if (!agg[storeId][category][key]) {
          agg[storeId][category][key] = {
            IngredientNorm: item.Name,
            Category: category,
            Unit: unit,
            QtyNum: needQty,
            QtyTexts: new Set(),
            Count: 1,
            Examples: [`${item.Name} (low stock)`]
          };
        } else {
          // If already in list from recipes, add to the quantity
          const existing = agg[storeId][category][key];
          if (existing.QtyNum !== null && Number.isFinite(existing.QtyNum)) {
            existing.QtyNum += needQty;
          }
          existing.Count += 1;
          existing.Examples.push(`${item.Name} (low stock)`);
        }
        
        console.log(`[SHOPPING-LIST] Added ${item.Name} to shopping list: ${needQty} ${unit}`);
      }
    }
  }

  if (!ids.length && !includeLowStock) return ok_({ groups: [] });

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

      // Keep a few human-friendly examples
      // If IngredientRaw exists, use it directly (it already contains qty + unit + name)
      // Otherwise, build from parts
      let ex = '';
      if (it.IngredientRaw && String(it.IngredientRaw).trim()) {
        // IngredientRaw already contains everything, just add notes if present
        const exParts = [String(it.IngredientRaw).trim()];
        if (it.Notes) exParts.push(String(it.Notes));
        ex = exParts.filter(Boolean).join(' - ').trim();
      } else {
        // Build from parts when IngredientRaw is not available
        const exParts = [];
        if (qt) exParts.push(qt);
        if (qn !== null && Number.isFinite(qn) && !qt) exParts.push(String(qn));
        if (unit) exParts.push(unit);
        if (it.IngredientNorm) exParts.push(String(it.IngredientNorm));
        if (it.Notes) exParts.push(String(it.Notes));
        ex = exParts.filter(Boolean).join(' ').trim();
      }
      
      if (ex && bucket.Examples.length < 3) bucket.Examples.push(ex);
    }
  }


  // Pantry adjustment: reduce shopping quantities when pantry has the same item + unit with numeric quantities.
  try {
    const pantryRows = db().prepare("SELECT Name, NameLower, QtyNum, Unit, QtyText FROM pantry").all();
    const pantryMap = new Map(); // key => qty (sum)
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

      if (qtyNum === null || !Number.isFinite(qtyNum)) continue;

      const key = nameLower + '|' + normLower_(unit);
      pantryMap.set(key, (pantryMap.get(key) || 0) + qtyNum);
    }

    if (pantryMap.size) {
      for (const sid of Object.keys(agg)) {
        for (const category of Object.keys(agg[sid] || {})) {
          const items = agg[sid][category];
          for (const k of Object.keys(items)) {
            const item = items[k];
            if (!item) continue;

            const ingLower = normLower_(item.IngredientNorm || '');
            const unitLower = normLower_(item.Unit || '');
            if (!ingLower) continue;

            const pKey = ingLower + '|' + unitLower;
            const pantryQty = pantryMap.get(pKey);
            if (!pantryQty) continue;

            if (item.QtyNum === null || item.QtyNum === undefined || !Number.isFinite(Number(item.QtyNum))) continue;

            const newQty = Number(item.QtyNum) - Number(pantryQty);
            if (newQty <= 0) delete items[k];
            else item.QtyNum = newQty;
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

  // Select only columns that exist to avoid runtime SQL errors on older DBs.
  const cols = ['ItemId','Name','QtyText','StoreId','Notes'];
  const hasQtyNum = pantryHasCol_('QtyNum');
  const hasUnit = pantryHasCol_('Unit');
  const hasCategory = pantryHasCol_('Category');
  const hasExpiration = pantryHasCol_('expiration_date');
  const hasThreshold = pantryHasCol_('low_stock_threshold');
  const hasFavorite = pantryHasCol_('is_favorite');

  if (hasQtyNum) cols.push('QtyNum');
  if (hasUnit) cols.push('Unit');
  if (hasCategory) cols.push('Category');
  if (hasExpiration) cols.push('expiration_date');
  if (hasThreshold) cols.push('low_stock_threshold');
  if (hasFavorite) cols.push('is_favorite');

  const rows = db().prepare(`SELECT ${cols.join(', ')} FROM pantry WHERE ${where} ORDER BY NameLower ASC, ItemId ASC LIMIT 500`).all(params);

  return ok_({
    items: rows.map(r => ({
      ItemId: r.ItemId,
      Name: r.Name,
      QtyText: r.QtyText || '',
      QtyNum: (hasQtyNum && r.QtyNum !== null && r.QtyNum !== undefined && r.QtyNum !== '') ? Number(r.QtyNum) : null,
      Unit: (hasUnit && r.Unit !== null && r.Unit !== undefined) ? String(r.Unit || '') : '',
      StoreId: r.StoreId || '',
      Notes: r.Notes || '',
      Category: (hasCategory && r.Category !== null && r.Category !== undefined) ? String(r.Category || '') : '',
      expiration_date: (hasExpiration && r.expiration_date !== null && r.expiration_date !== undefined) ? String(r.expiration_date || '') : '',
      low_stock_threshold: (hasThreshold && r.low_stock_threshold !== null && r.low_stock_threshold !== undefined && r.low_stock_threshold !== '') ? Number(r.low_stock_threshold) : 0,
      is_favorite: (hasFavorite && r.is_favorite !== null && r.is_favorite !== undefined && r.is_favorite !== '') ? Number(r.is_favorite) : 0
    }))
  });
}

function upsertPantryItem(payload){
  // Support both 'item' object and direct properties (for frontend compatibility)
  const item = (payload && payload.item) || payload || {};
  const name = String(item.Name || '').trim();
  if (!name) return err_('Name required.');
  const itemId = String(item.ItemId || item.PantryId || '').trim() || uuidShort_('pan');

  // Columns are added via migrations; detect at runtime to remain compatible with older DBs.
  const hasQtyNum = pantryHasCol_('QtyNum');
  const hasUnit = pantryHasCol_('Unit');
  const hasCategory = pantryHasCol_('Category');
  const hasExpiration = pantryHasCol_('expiration_date');
  const hasThreshold = pantryHasCol_('low_stock_threshold');
  const hasFavorite = pantryHasCol_('is_favorite');

  const qtyTextIn = String(item.QtyText||'').trim();

  let qtyNumRaw = (item.QtyNum === null || item.QtyNum === undefined || item.QtyNum === '') ? null : Number(item.QtyNum);
  let qtyNum = (qtyNumRaw !== null && Number.isFinite(qtyNumRaw)) ? qtyNumRaw : null;
  let unit = String(item.Unit || '').trim();

  // Frontend primarily sends QtyText. If structured fields exist, derive QtyNum/Unit from QtyText when absent.
  if ((qtyNum === null || !Number.isFinite(qtyNum) || !unit) && qtyTextIn) {
    const parsed = parseQtyText_(qtyTextIn);
    if (qtyNum === null && parsed && parsed.qtyNum !== null && Number.isFinite(parsed.qtyNum)) qtyNum = parsed.qtyNum;
    if (!unit && parsed && parsed.unit) unit = parsed.unit;
  }

  const category = String(item.Category || item.category || '').trim();
  const expiration_date = String(item.expiration_date || item.ExpirationDate || '').trim();

  // Threshold / favorite are stored as integers.
  const tRaw = (item.low_stock_threshold === null || item.low_stock_threshold === undefined || item.low_stock_threshold === '') ? null : Number(item.low_stock_threshold);
  const low_stock_threshold = (tRaw !== null && Number.isFinite(tRaw) && tRaw >= 0) ? Math.floor(tRaw) : 0;

  const fRaw = (item.is_favorite === null || item.is_favorite === undefined || item.is_favorite === '') ? null : Number(item.is_favorite);
  const is_favorite = (fRaw !== null && Number.isFinite(fRaw)) ? (fRaw ? 1 : 0) : 0;

  // Build SQL dynamically so we only reference columns that exist.
  const cols = ['ItemId','Name','NameLower','QtyText','StoreId','Notes'];
  const vals = [itemId, name, normLower_(name), qtyTextIn, String(item.StoreId||'').trim(), String(item.Notes||'').trim()];

  if (hasCategory) { cols.push('Category'); vals.push(category); }
  if (hasExpiration) { cols.push('expiration_date'); vals.push(expiration_date); }
  if (hasThreshold) { cols.push('low_stock_threshold'); vals.push(low_stock_threshold); }
  if (hasFavorite) { cols.push('is_favorite'); vals.push(is_favorite); }
  if (hasQtyNum) { cols.push('QtyNum'); vals.push(qtyNum); }
  if (hasUnit) { cols.push('Unit'); vals.push(String(unit||'').trim()); }

  const placeholders = cols.map(() => '?').join(', ');
  const updates = cols.filter(c => c !== 'ItemId').map(c => `${c}=excluded.${c}`).join(', ');

  db().prepare(`
    INSERT INTO pantry(${cols.join(', ')}, UpdatedAt)
    VALUES(${placeholders}, datetime('now'))
    ON CONFLICT(ItemId) DO UPDATE SET
      ${updates},
      UpdatedAt=excluded.UpdatedAt
  `).run(...vals);

  return ok_({ ItemId: itemId });
}


function deletePantryItem(payload){
  // Support both 'itemId' and 'PantryId' for frontend compatibility
  const itemId = String(payload && (payload.itemId || payload.PantryId) || '').trim();
  if (!itemId) return err_('Missing itemId.');
  db().prepare("DELETE FROM pantry WHERE ItemId=?").run(itemId);
  return ok_({});
}

function getLowStockPantryItems(payload){
  try {
    const hasThreshold = pantryHasCol_('low_stock_threshold');
    if (!hasThreshold) return ok_({ items: [] });

    const cols = ['ItemId','Name','NameLower','QtyNum','Unit','QtyText','Category','StoreId','Notes','low_stock_threshold'];
    const rows = db().prepare(`SELECT ${cols.join(', ')} FROM pantry WHERE QtyNum IS NOT NULL AND low_stock_threshold IS NOT NULL AND low_stock_threshold != '' ORDER BY NameLower ASC`).all();
    
    const lowStockItems = rows.filter(r => {
      const qty = Number(r.QtyNum);
      const threshold = Number(r.low_stock_threshold);
      return Number.isFinite(qty) && Number.isFinite(threshold) && qty <= threshold;
    });

    return ok_({ items: lowStockItems });
  } catch (e) {
    return err_(e && e.message ? e.message : e);
  }
}

function getExpiringPantryItems(payload){
  try {
    const hasExpiration = pantryHasCol_('expiration_date');
    if (!hasExpiration) return ok_({ items: [] });

    const daysAhead = Number(payload && payload.daysAhead || 7);
    const today = new Date();
    const future = new Date(today);
    future.setDate(future.getDate() + daysAhead);
    
    const todayStr = ymd_(today);
    const futureStr = ymd_(future);

    const cols = ['ItemId','Name','NameLower','QtyNum','Unit','QtyText','Category','StoreId','Notes','expiration_date'];
    const rows = db().prepare(`SELECT ${cols.join(', ')} FROM pantry WHERE expiration_date IS NOT NULL AND expiration_date != '' AND expiration_date <= ? AND expiration_date >= ? ORDER BY expiration_date ASC`).all(futureStr, todayStr);
    
    return ok_({ items: rows });
  } catch (e) {
    return err_(e && e.message ? e.message : e);
  }
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

// ================= GOOGLE CALENDAR INTEGRATION =================

async function googleCalendarSyncRange(payload, store) {
  const start = String(payload && payload.start || '').trim();
  const end = String(payload && payload.end || '').trim();
  if (!start || !end) return err_('Missing start/end.');

  const calendarId = String(payload && payload.calendarId || store.get('googleCalendarId') || 'primary').trim();

  console.log('[googleCalendarSyncRange] Start:', start, 'End:', end, 'CalendarId:', calendarId);

  // Check if authenticated
  if (!googleCal.isAuthenticated()) {
    return err_('Not authenticated with Google Calendar. Please set up Google Calendar sync first.');
  }

  const plans = db().prepare("SELECT * FROM plans WHERE Date >= ? AND Date <= ? ORDER BY Date ASC").all(start, end);
  console.log('[googleCalendarSyncRange] Found plans:', plans.length);

  let created = 0;
  let updated = 0;

  for (const p of plans) {
    const dateId = p.Date;
    console.log('[googleCalendarSyncRange] Processing date:', dateId, 'Plan:', JSON.stringify(p, null, 2));

    const slots = [
      { slot: 'Breakfast', time: '08:00', ridCol: 'BreakfastRecipeId', titleCol: 'BreakfastTitle', jsonCol: 'Breakfast', evCol: 'BreakfastGoogleEventId' },
      { slot: 'Lunch', time: '12:00', ridCol: 'LunchRecipeId', titleCol: 'LunchTitle', jsonCol: 'Lunch', evCol: 'LunchGoogleEventId' },
      { slot: 'Dinner', time: '18:30', ridCol: 'DinnerRecipeId', titleCol: 'DinnerTitle', jsonCol: 'Dinner', evCol: 'DinnerGoogleEventId' }
    ];

    for (const s of slots) {
      // Try to get from dedicated columns first (new schema)
      let mealTitle = String(p[s.titleCol] || '').trim();
      let mealRid = String(p[s.ridCol] || '').trim();
      
      // If not found, try parsing from JSON column (legacy schema)
      if (!mealTitle && p[s.jsonCol]) {
        try {
          const mealData = typeof p[s.jsonCol] === 'string' ? JSON.parse(p[s.jsonCol]) : p[s.jsonCol];
          if (mealData) {
            mealTitle = String(mealData.Title || '').trim();
            mealRid = String(mealData.RecipeId || '').trim();
          }
        } catch (e) {
          console.error(`[googleCalendarSyncRange] Failed to parse ${s.slot} JSON:`, e);
        }
      }
      
      const existingEventId = String(p[s.evCol] || '').trim();

      console.log(`[googleCalendarSyncRange] ${dateId} ${s.slot}: Title="${mealTitle}", RecipeId="${mealRid}", EventId="${existingEventId}"`);

      if (!mealTitle) {
        // Delete event if it exists
        if (existingEventId) {
          try {
            await googleCal.deleteGoogleEvent({ calendarId, eventId: existingEventId });
          } catch (_) {}
          db().prepare(`UPDATE plans SET ${s.evCol}='', UpdatedAt=datetime('now') WHERE Date=?`).run(dateId);
        }
        continue;
      }

      // Create ISO datetime strings
      const startDateTime = `${dateId}T${s.time}:00`;
      
      // Calculate end time (1 hour later)
      const [hours, minutes] = s.time.split(':').map(Number);
      let endHours = hours + 1;
      const endMinutes = minutes;
      
      // Format end time as HH:MM
      const endTime = `${String(endHours).padStart(2, '0')}:${String(endMinutes).padStart(2, '0')}`;
      const endDateTime = `${dateId}T${endTime}:00`;

      const title = `${s.slot}: ${mealTitle}`;
      let description = mealRid ? `RecipeId: ${mealRid}` : '';

      // Add additional items to description
      try {
        const additionalItems = db().prepare(`
          SELECT Title, ItemType FROM plan_additional_items 
          WHERE Date = ? AND Slot = ? 
          ORDER BY SortOrder ASC
        `).all(dateId, s.slot);
        
        if (additionalItems.length > 0) {
          description += '\n\nAdditional Items:';
          for (const item of additionalItems) {
            description += `\n- ${item.Title} (${item.ItemType || 'side'})`;
          }
        }
      } catch (e) {
        // Table might not exist, ignore
        console.warn('[googleCalendarSyncRange] Could not query additional items:', e.message);
      }

      console.log(`[googleCalendarSyncRange] Creating/updating event: "${title}" from ${startDateTime} to ${endDateTime}`);

      const result = await googleCal.upsertGoogleEvent({
        calendarId,
        eventId: existingEventId || null,
        title,
        description,
        startDateTime,
        endDateTime
      });

      console.log(`[googleCalendarSyncRange] Event result:`, result);

      if (!result.ok) {
        console.error(`Failed to sync ${s.slot} for ${dateId}:`, result.error);
        continue;
      }

      if (result.action === 'updated') updated += 1;
      else created += 1;

      db().prepare(`UPDATE plans SET ${s.evCol}=?, UpdatedAt=datetime('now') WHERE Date=?`).run(result.eventId, dateId);
    }
  }

  console.log('[googleCalendarSyncRange] Final counts - Created:', created, 'Updated:', updated);
  return ok_({ created, updated });
}

async function initGoogleCalendar(payload) {
  const credentials = payload && payload.credentials;
  if (!credentials) {
    return err_('Missing credentials.');
  }

  // Save credentials
  const saveResult = googleCal.saveCredentials(credentials);
  if (!saveResult.ok) {
    return saveResult;
  }

  // Initialize
  return await googleCal.initializeGoogleCalendar(credentials);
}

function getGoogleAuthUrl() {
  const url = googleCal.getAuthUrl();
  if (!url) {
    return err_('Google Calendar not initialized. Please set up credentials first.');
  }
  return ok_({ authUrl: url });
}

async function setGoogleAuthCode(payload) {
  const code = String(payload && payload.code || '').trim();
  if (!code) {
    return err_('Missing authorization code.');
  }

  return await googleCal.getTokenFromCode(code);
}

async function listGoogleCalendars() {
  return await googleCal.listCalendars();
}

async function getGoogleCalendarStatus() {
  console.log('[getGoogleCalendarStatus] Checking Google Calendar status...');
  
  // Try to auto-initialize if credentials exist but not yet loaded
  if (!googleCal.isAuthenticated()) {
    console.log('[getGoogleCalendarStatus] Not authenticated, checking for stored credentials...');
    const credentialsResult = googleCal.loadCredentials();
    if (credentialsResult.ok && credentialsResult.credentials) {
      console.log('[getGoogleCalendarStatus] Credentials found, initializing Google Calendar...');
      // Initialize with stored credentials (loads token from disk)
      await googleCal.initializeGoogleCalendar(credentialsResult.credentials);
    } else {
      console.log('[getGoogleCalendarStatus] No credentials found:', credentialsResult.error);
    }
  } else {
    console.log('[getGoogleCalendarStatus] Already authenticated');
  }
  
  const authenticated = googleCal.isAuthenticated();
  const credentialsResult = googleCal.loadCredentials();
  
  console.log('[getGoogleCalendarStatus] Result: authenticated =', authenticated, ', hasCredentials =', credentialsResult.ok);
  
  return ok_({
    authenticated,
    hasCredentials: credentialsResult.ok
  });
}

async function revokeGoogleCalendar() {
  return await googleCal.revokeAccess();
}

async function checkGoogleCalendarDuplicates(payload) {
  const start = String(payload && payload.start || '').trim();
  const end = String(payload && payload.end || '').trim();
  if (!start || !end) return err_('Missing start/end.');

  const calendarId = String(payload && payload.calendarId || 'primary').trim();

  if (!googleCal.isAuthenticated()) {
    return err_('Not authenticated with Google Calendar.');
  }

  const plans = db().prepare("SELECT * FROM plans WHERE Date >= ? AND Date <= ? ORDER BY Date ASC").all(start, end);
  
  const duplicates = [];
  const slots = [
    { slot: 'Breakfast', time: '08:00', titleCol: 'BreakfastTitle', jsonCol: 'Breakfast' },
    { slot: 'Lunch', time: '12:00', titleCol: 'LunchTitle', jsonCol: 'Lunch' },
    { slot: 'Dinner', time: '18:30', titleCol: 'DinnerTitle', jsonCol: 'Dinner' }
  ];

  for (const p of plans) {
    const dateId = p.Date;
    
    for (const s of slots) {
      let mealTitle = String(p[s.titleCol] || '').trim();
      
      if (!mealTitle && p[s.jsonCol]) {
        try {
          const mealData = typeof p[s.jsonCol] === 'string' ? JSON.parse(p[s.jsonCol]) : p[s.jsonCol];
          if (mealData) {
            mealTitle = String(mealData.Title || '').trim();
          }
        } catch (e) {}
      }

      if (!mealTitle) continue;

      const [hours, minutes] = s.time.split(':').map(Number);
      const endHours = hours + 1;
      const endTime = `${String(endHours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
      
      const startDateTime = `${dateId}T${s.time}:00`;
      const endDateTime = `${dateId}T${endTime}:00`;
      const title = `${s.slot}: ${mealTitle}`;

      const dupCheck = await googleCal.findDuplicateEvents({
        calendarId,
        title,
        startDateTime,
        endDateTime
      });

      if (dupCheck.ok && dupCheck.events.length > 1) {
        duplicates.push({
          date: dateId,
          slot: s.slot,
          title: mealTitle,
          count: dupCheck.events.length,
          eventIds: dupCheck.events.map(e => e.id)
        });
      }
    }
  }

  return ok_({ 
    checked: plans.length * 3,
    duplicates,
    hasDuplicates: duplicates.length > 0
  });
}

// ================= RECIPE COLLECTIONS =================

function listCollections(){
  try {
    const rows = db().prepare(`
      SELECT collection_id as CollectionId, name as Name, description as Description, created_at as CreatedAt
      FROM recipe_collections
      ORDER BY name ASC
    `).all();
    return ok_({ collections: rows });
  } catch (e) {
    return err_(e && e.message ? e.message : e);
  }
}

function getCollection(payload){
  const collectionId = String(payload && payload.collectionId || '').trim();
  if (!collectionId) return err_('Missing collectionId.');
  try {
    const row = db().prepare(`
      SELECT collection_id as CollectionId, name as Name, description as Description, created_at as CreatedAt
      FROM recipe_collections
      WHERE collection_id = ?
    `).get(collectionId);
    if (!row) return err_('Collection not found.');
    return ok_({ collection: row });
  } catch (e) {
    return err_(e && e.message ? e.message : e);
  }
}

function upsertCollection(payload){
  const collectionId = String(payload && payload.collectionId || '').trim();
  const name = String(payload && payload.name || '').trim();
  const description = String(payload && payload.description || '').trim();
  
  if (!name) return err_('Collection name is required.');
  
  try {
    if (collectionId) {
      // Update existing
      const existing = db().prepare('SELECT collection_id FROM recipe_collections WHERE collection_id = ?').get(collectionId);
      if (existing) {
        db().prepare(`
          UPDATE recipe_collections
          SET name = ?, description = ?
          WHERE collection_id = ?
        `).run(name, description, collectionId);
        return ok_({ CollectionId: collectionId });
      }
    }
    
    // Insert new
    const info = db().prepare(`
      INSERT INTO recipe_collections(name, description)
      VALUES(?, ?)
    `).run(name, description);
    
    return ok_({ CollectionId: info.lastInsertRowid });
  } catch (e) {
    return err_(e && e.message ? e.message : e);
  }
}

function deleteCollection(payload){
  const collectionId = String(payload && payload.collectionId || '').trim();
  if (!collectionId) return err_('Missing collectionId.');
  
  try {
    db().prepare('DELETE FROM recipe_collection_map WHERE collection_id = ?').run(collectionId);
    db().prepare('DELETE FROM recipe_collections WHERE collection_id = ?').run(collectionId);
    return ok_({});
  } catch (e) {
    return err_(e && e.message ? e.message : e);
  }
}

function addRecipeToCollection(payload){
  const collectionId = String(payload && payload.collectionId || '').trim();
  const recipeId = String(payload && payload.recipeId || '').trim();
  
  if (!collectionId) return err_('Missing collectionId.');
  if (!recipeId) return err_('Missing recipeId.');
  
  try {
    const existing = db().prepare(`
      SELECT * FROM recipe_collection_map
      WHERE collection_id = ? AND recipe_id = ?
    `).get(collectionId, recipeId);
    
    if (existing) return ok_({ alreadyExists: true });
    
    db().prepare(`
      INSERT INTO recipe_collection_map(collection_id, recipe_id)
      VALUES(?, ?)
    `).run(collectionId, recipeId);
    
    return ok_({});
  } catch (e) {
    return err_(e && e.message ? e.message : e);
  }
}

function removeRecipeFromCollection(payload){
  const collectionId = String(payload && payload.collectionId || '').trim();
  const recipeId = String(payload && payload.recipeId || '').trim();
  
  if (!collectionId) return err_('Missing collectionId.');
  if (!recipeId) return err_('Missing recipeId.');
  
  try {
    db().prepare(`
      DELETE FROM recipe_collection_map
      WHERE collection_id = ? AND recipe_id = ?
    `).run(collectionId, recipeId);
    
    return ok_({});
  } catch (e) {
    return err_(e && e.message ? e.message : e);
  }
}

function listCollectionRecipes(payload){
  const collectionId = String(payload && payload.collectionId || '').trim();
  if (!collectionId) return err_('Missing collectionId.');
  
  try {
    const rows = db().prepare(`
      SELECT r.RecipeId, r.Title, r.TitleLower, r.URL, r.Cuisine, r.MealType, 
             r.Notes, r.Instructions, r.Image_Name, r.is_favorite, r.default_servings,
             m.is_main_dish
      FROM recipe_collection_map m
      JOIN recipes r ON m.recipe_id = r.RecipeId
      WHERE m.collection_id = ?
      ORDER BY m.is_main_dish DESC, r.TitleLower ASC
    `).all(collectionId);
    
    return ok_({ recipes: rows });
  } catch (e) {
    return err_(e && e.message ? e.message : e);
  }
}

/**
 * Set a recipe as the main dish in a collection
 * payload: { collectionId, recipeId, isMainDish }
 */
function setMainDishInCollection(payload) {
  const collectionId = String(payload && payload.collectionId || '').trim();
  const recipeId = String(payload && payload.recipeId || '').trim();
  const isMainDish = payload && payload.isMainDish ? 1 : 0;
  
  if (!collectionId || !recipeId) {
    return err_('Missing collectionId or recipeId.');
  }
  
  try {
    // If setting as main dish, unset all other recipes in this collection
    if (isMainDish === 1) {
      db().prepare(`
        UPDATE recipe_collection_map 
        SET is_main_dish = 0 
        WHERE collection_id = ?
      `).run(collectionId);
    }
    
    // Set the main dish flag for this recipe
    db().prepare(`
      UPDATE recipe_collection_map 
      SET is_main_dish = ? 
      WHERE collection_id = ? AND recipe_id = ?
    `).run(isMainDish, collectionId, recipeId);
    
    return ok_({ updated: true });
  } catch (e) {
    return err_(e && e.message ? e.message : e);
  }
}

// ================= ADDITIONAL ITEMS API =================

/**
 * Add an additional item (side, dessert, appetizer) to a meal slot
 * payload: { date, slot, recipeId, title, itemType }
 */
function addAdditionalItem(payload) {
  const date = String(payload && payload.date || '').trim();
  const slot = String(payload && payload.slot || '').trim();
  const recipeId = String(payload && payload.recipeId || '').trim();
  const title = String(payload && payload.title || '').trim();
  const itemType = String(payload && payload.itemType || '').trim();

  if (!date || !slot || !recipeId) {
    return err_('Missing required fields: date, slot, or recipeId.');
  }

  // Validate slot
  if (!['Breakfast', 'Lunch', 'Dinner'].includes(slot)) {
    return err_('Invalid slot. Must be Breakfast, Lunch, or Dinner.');
  }

  try {
    // Get current max SortOrder for this date/slot
    const maxOrderRow = db().prepare(`
      SELECT COALESCE(MAX(SortOrder), -1) as maxOrder 
      FROM plan_additional_items 
      WHERE Date = ? AND Slot = ?
    `).get(date, slot);
    
    const nextOrder = (maxOrderRow.maxOrder || 0) + 1;

    const stmt = db().prepare(`
      INSERT INTO plan_additional_items (Date, Slot, RecipeId, Title, ItemType, SortOrder)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    
    const result = stmt.run(date, slot, recipeId, title, itemType, nextOrder);
    
    return ok_({
      item: {
        id: result.lastInsertRowid,
        Date: date,
        Slot: slot,
        RecipeId: recipeId,
        Title: title,
        ItemType: itemType,
        SortOrder: nextOrder
      }
    });
  } catch (e) {
    return err_(e && e.message ? e.message : e);
  }
}

/**
 * Remove an additional item by ID
 * payload: { id }
 */
function removeAdditionalItem(payload) {
  const id = payload && payload.id;
  
  if (!id) return err_('Missing id.');

  try {
    const stmt = db().prepare('DELETE FROM plan_additional_items WHERE id = ?');
    stmt.run(id);
    return ok_({ deleted: true });
  } catch (e) {
    return err_(e && e.message ? e.message : e);
  }
}

/**
 * Get all additional items for a specific date and slot
 * payload: { date, slot }
 */
function getAdditionalItems(payload) {
  const date = String(payload && payload.date || '').trim();
  const slot = String(payload && payload.slot || '').trim();

  if (!date || !slot) {
    return err_('Missing date or slot.');
  }

  try {
    const rows = db().prepare(`
      SELECT id, Date, Slot, RecipeId, Title, ItemType, SortOrder
      FROM plan_additional_items
      WHERE Date = ? AND Slot = ?
      ORDER BY SortOrder ASC
    `).all(date, slot);

    return ok_({ items: rows });
  } catch (e) {
    return err_(e && e.message ? e.message : e);
  }
}

/**
 * Assign a collection to a meal slot
 * First recipe becomes the main recipe, remaining become additional items
 * payload: { date, slot, collectionId }
 */
function assignCollectionToSlot(payload) {
  const date = String(payload && payload.date || '').trim();
  const slot = String(payload && payload.slot || '').trim();
  const collectionId = String(payload && payload.collectionId || '').trim();

  if (!date || !slot || !collectionId) {
    return err_('Missing date, slot, or collectionId.');
  }

  // Validate slot
  if (!['Breakfast', 'Lunch', 'Dinner'].includes(slot)) {
    return err_('Invalid slot. Must be Breakfast, Lunch, or Dinner.');
  }

  try {
    // Get all recipes in the collection, including the is_main_dish flag
    const recipes = db().prepare(`
      SELECT r.RecipeId, r.Title, r.MealType, m.is_main_dish
      FROM recipe_collection_map m
      JOIN recipes r ON m.recipe_id = r.RecipeId
      WHERE m.collection_id = ?
      ORDER BY m.is_main_dish DESC, r.Title ASC
    `).all(collectionId);

    if (recipes.length === 0) {
      return err_('Collection is empty or does not exist.');
    }

    // Find the recipe marked as main dish (is_main_dish = 1)
    // If none marked, use the first recipe
    let mainRecipe = recipes.find(r => r.is_main_dish === 1);
    
    if (!mainRecipe) {
      mainRecipe = recipes[0];
      console.log('[assignCollectionToSlot] No main dish marked, using first recipe:', mainRecipe.Title);
    } else {
      console.log('[assignCollectionToSlot] Using marked main dish:', mainRecipe.Title);
    }
    
    // Update the plan with the main recipe (RecipeId AND Title)
    const slotColumn = `${slot}RecipeId`;
    const titleColumn = `${slot}Title`;
    
    const updatePlan = db().prepare(`
      INSERT INTO plans (Date, ${slotColumn}, ${titleColumn})
      VALUES (?, ?, ?)
      ON CONFLICT(Date) DO UPDATE SET 
        ${slotColumn} = excluded.${slotColumn},
        ${titleColumn} = excluded.${titleColumn}
    `);
    updatePlan.run(date, mainRecipe.RecipeId, mainRecipe.Title);

    // Clear any existing additional items for this slot
    db().prepare('DELETE FROM plan_additional_items WHERE Date = ? AND Slot = ?').run(date, slot);

    // Add remaining recipes as additional items (exclude the main recipe)
    const additionalItems = [];
    let sortOrder = 0;
    
    for (const recipe of recipes) {
      // Skip the main recipe
      if (recipe.RecipeId === mainRecipe.RecipeId) {
        continue;
      }
      
      const itemType = recipe.MealType || 'side';
      
      const insertAdditional = db().prepare(`
        INSERT INTO plan_additional_items (Date, Slot, RecipeId, Title, ItemType, SortOrder)
        VALUES (?, ?, ?, ?, ?, ?)
      `);
      
      const result = insertAdditional.run(date, slot, recipe.RecipeId, recipe.Title, itemType, sortOrder);
      sortOrder++;
      
      additionalItems.push({
        id: result.lastInsertRowid,
        RecipeId: recipe.RecipeId,
        Title: recipe.Title,
        ItemType: itemType
      });
    }

    return ok_({
      mainRecipe: {
        RecipeId: mainRecipe.RecipeId,
        Title: mainRecipe.Title
      },
      additionalItems
    });
  } catch (e) {
    return err_(e && e.message ? e.message : e);
  }
}

/**
 * Add a collection's ingredients to shopping list
 * Can be date-tied (dateStart, dateEnd) or independent
 * payload: { collectionId, dateStart?, dateEnd? }
 */
function addCollectionToShoppingList(payload) {
  const collectionId = String(payload && payload.collectionId || '').trim();
  const dateStart = payload && payload.dateStart ? String(payload.dateStart).trim() : null;
  const dateEnd = payload && payload.dateEnd ? String(payload.dateEnd).trim() : null;

  if (!collectionId) {
    return err_('Missing collectionId.');
  }

  try {
    // Get all recipes in the collection
    const recipes = db().prepare(`
      SELECT r.RecipeId, r.Title
      FROM recipe_collection_map m
      JOIN recipes r ON m.recipe_id = r.RecipeId
      WHERE m.collection_id = ?
    `).all(collectionId);

    if (recipes.length === 0) {
      return err_('Collection is empty or does not exist.');
    }

    // Get all ingredients for these recipes
    const recipeIds = recipes.map(r => r.RecipeId);
    const placeholders = recipeIds.map(() => '?').join(',');
    
    const ingredients = db().prepare(`
      SELECT RecipeId, IngredientName, IngredientNorm, Quantity, Unit, Notes
      FROM ingredients
      WHERE RecipeId IN (${placeholders})
      ORDER BY RecipeId, idx
    `).all(...recipeIds);

    return ok_({
      recipes,
      ingredients,
      dateStart,
      dateEnd
    });
  } catch (e) {
    return err_(e && e.message ? e.message : e);
  }
}

// ================= AUTO-ASSIGN CUISINES =================
function autoAssignCuisines(payload){
  try {
    // Comprehensive cuisine keywords mapping (aligned with COMPREHENSIVE_CUISINES list)
    const cuisineKeywords = {
      'Afghan': ['afghan', 'kabuli', 'pulao', 'mantu', 'kebab'],
      'African': ['african', 'jollof', 'fufu', 'injera', 'tagine'],
      'American': ['burger', 'bbq', 'barbecue', 'fried chicken', 'mac and cheese', 'meatloaf', 'hot dog', 'coleslaw', 'cornbread', 'biscuit', 'gravy', 'american', 'southern', 'tex-mex'],
      'Argentinian': ['argentine', 'empanada', 'chimichurri', 'asado', 'dulce de leche'],
      'Asian': ['asian', 'stir fry', 'rice', 'noodle', 'wok'],
      'Australian': ['australian', 'vegemite', 'lamington', 'pavlova'],
      'Austrian': ['austrian', 'schnitzel', 'strudel', 'sacher'],
      'Brazilian': ['brazilian', 'feijoada', 'churrasco', 'açaí', 'brigadeiro'],
      'British': ['british', 'fish and chips', 'shepherd\'s pie', 'bangers', 'mash', 'tea', 'scone'],
      'Cajun/Creole': ['cajun', 'creole', 'gumbo', 'jambalaya', 'étouffée', 'andouille'],
      'Caribbean': ['caribbean', 'jerk', 'plantain', 'rice and peas', 'callaloo'],
      'Chinese': ['chinese', 'stir fry', 'fried rice', 'chow mein', 'lo mein', 'dumpling', 'wonton', 'spring roll', 'sweet and sour', 'kung pao', 'sesame', 'szechuan', 'general tso', 'egg roll', 'bok choy', 'hoisin', 'oyster sauce'],
      'Cuban': ['cuban', 'ropa vieja', 'mojo', 'plantain', 'black beans'],
      'Ethiopian': ['ethiopian', 'injera', 'berbere', 'doro wat'],
      'Filipino': ['filipino', 'adobo', 'lumpia', 'pancit', 'sinigang'],
      'French': ['french', 'croissant', 'baguette', 'quiche', 'ratatouille', 'coq au vin', 'bouillabaisse', 'crêpe', 'brie', 'camembert', 'béarnaise', 'hollandaise', 'escargot', 'cassoulet'],
      'German': ['german', 'bratwurst', 'sauerkraut', 'schnitzel', 'pretzel', 'spätzle'],
      'Greek': ['greek', 'gyro', 'souvlaki', 'moussaka', 'spanakopita', 'tzatziki', 'feta', 'baklava'],
      'Indian': ['indian', 'curry', 'tikka', 'masala', 'tandoori', 'biryani', 'naan', 'samosa', 'chutney', 'korma', 'vindaloo', 'dal', 'paneer', 'garam masala', 'turmeric', 'cumin', 'cardamom'],
      'Indonesian': ['indonesian', 'satay', 'nasi goreng', 'rendang', 'gado gado'],
      'Irish': ['irish', 'stew', 'colcannon', 'soda bread', 'guinness'],
      'Italian': ['italian', 'pasta', 'pizza', 'risotto', 'lasagna', 'spaghetti', 'ravioli', 'gnocchi', 'marinara', 'parmigiana', 'parmesan', 'mozzarella', 'basil', 'pesto', 'focaccia', 'tiramisu', 'carbonara', 'bolognese', 'alfredo', 'bruschetta', 'caprese'],
      'Japanese': ['japanese', 'sushi', 'ramen', 'teriyaki', 'tempura', 'miso', 'udon', 'soba', 'sashimi', 'edamame', 'katsu', 'yakitori', 'wasabi', 'sake', 'bento', 'gyoza', 'tonkatsu'],
      'Korean': ['korean', 'kimchi', 'bulgogi', 'bibimbap', 'gochujang', 'banchan'],
      'Lebanese': ['lebanese', 'tabbouleh', 'kibbeh', 'fattoush', 'shawarma'],
      'Malaysian': ['malaysian', 'laksa', 'nasi lemak', 'rendang', 'char kway teow'],
      'Mediterranean': ['mediterranean', 'hummus', 'falafel', 'tzatziki', 'olive', 'feta', 'pita', 'kebab', 'shawarma', 'couscous', 'tabouleh'],
      'Mexican': ['mexican', 'taco', 'burrito', 'enchilada', 'quesadilla', 'salsa', 'guacamole', 'tortilla', 'fajita', 'nacho', 'tamale', 'chorizo', 'cilantro', 'jalapeño', 'chipotle', 'carnitas', 'carne asada', 'mole', 'queso'],
      'Middle Eastern': ['middle eastern', 'hummus', 'falafel', 'shawarma', 'kebab', 'tahini', 'pita'],
      'Moroccan': ['moroccan', 'tagine', 'couscous', 'harira', 'preserved lemon'],
      'Pakistani': ['pakistani', 'biryani', 'nihari', 'haleem', 'chapati'],
      'Persian': ['persian', 'kabob', 'tahdig', 'fesenjan', 'ghormeh sabzi'],
      'Peruvian': ['peruvian', 'ceviche', 'lomo saltado', 'aji', 'anticuchos'],
      'Polish': ['polish', 'pierogi', 'kielbasa', 'bigos', 'golabki'],
      'Portuguese': ['portuguese', 'bacalhau', 'piri piri', 'pastel de nata'],
      'Russian': ['russian', 'borscht', 'pelmeni', 'blini', 'stroganoff'],
      'Spanish': ['spanish', 'paella', 'tapas', 'gazpacho', 'chorizo', 'jamón'],
      'Thai': ['thai', 'pad thai', 'curry', 'tom yum', 'satay', 'lemongrass', 'coconut milk', 'fish sauce', 'thai basil', 'galangal'],
      'Turkish': ['turkish', 'kebab', 'döner', 'baklava', 'börek', 'meze'],
      'Vegan': ['vegan', 'plant-based', 'tofu', 'tempeh', 'seitan', 'dairy-free'],
      'Vegetarian': ['vegetarian', 'veggie', 'meatless'],
      'Vietnamese': ['vietnamese', 'pho', 'banh mi', 'spring roll', 'nuoc mam', 'lemongrass']
    };

    // Get all recipes without a cuisine or with empty cuisine
    const recipes = db().prepare(`
      SELECT RecipeId, Title, TitleLower, Notes, Instructions
      FROM recipes
      WHERE Cuisine IS NULL OR Cuisine = ''
    `).all();

    if (!recipes.length) {
      return ok_({ 
        message: 'No recipes found that need cuisine assignment. All recipes already have cuisines!',
        updated: 0,
        total: 0
      });
    }

    let updated = 0;
    const stmt = db().prepare(`
      UPDATE recipes 
      SET Cuisine = ?, UpdatedAt = datetime('now')
      WHERE RecipeId = ?
    `);

    for (const recipe of recipes) {
      const searchText = `${recipe.Title || ''} ${recipe.TitleLower || ''} ${recipe.Notes || ''} ${recipe.Instructions || ''}`.toLowerCase();
      
      let bestCuisine = '';
      let maxMatches = 0;
      
      // Find cuisine with most keyword matches
      for (const [cuisine, keywords] of Object.entries(cuisineKeywords)) {
        const matches = keywords.filter(keyword => searchText.includes(keyword.toLowerCase())).length;
        if (matches > maxMatches) {
          maxMatches = matches;
          bestCuisine = cuisine;
        }
      }
      
      // Only update if we found at least one match
      if (bestCuisine && maxMatches > 0) {
        stmt.run(bestCuisine, recipe.RecipeId);
        updated++;
      }
    }

    return ok_({ 
      message: `Auto-assigned cuisines to ${updated} of ${recipes.length} recipe(s). ${recipes.length - updated} recipe(s) had no matching keywords.`,
      updated,
      total: recipes.length,
      unmatched: recipes.length - updated
    });
  } catch (e) {
    return err_(e && e.message ? e.message : e);
  }
}

// ================= CUISINE MANAGEMENT =================
function listUniqueCuisines(payload){
  try {
    const rows = db().prepare(`
      SELECT DISTINCT Cuisine 
      FROM recipes 
      WHERE Cuisine IS NOT NULL AND Cuisine != ''
      ORDER BY Cuisine ASC
    `).all();
    
    const cuisines = rows.map(r => r.Cuisine).filter(Boolean);
    return ok_({ cuisines });
  } catch (e) {
    return err_(e && e.message ? e.message : e);
  }
}

function manageCuisine(payload){
  const action = String(payload && payload.action || '').trim();
  const oldName = String(payload && payload.oldName || '').trim();
  const newName = String(payload && payload.newName || '').trim();
  
  try {
    if (action === 'rename') {
      if (!oldName || !newName) return err_('Missing oldName or newName.');
      
      // Update all recipes with this cuisine
      const result = db().prepare(`
        UPDATE recipes 
        SET Cuisine = ?, UpdatedAt = datetime('now')
        WHERE Cuisine = ?
      `).run(newName, oldName);
      
      return ok_({ message: `Updated ${result.changes} recipe(s).`, updated: result.changes });
    }
    
    if (action === 'delete') {
      if (!oldName) return err_('Missing cuisine name.');
      
      // Set cuisine to empty for all recipes with this cuisine
      const result = db().prepare(`
        UPDATE recipes 
        SET Cuisine = '', UpdatedAt = datetime('now')
        WHERE Cuisine = ?
      `).run(oldName);
      
      return ok_({ message: `Removed cuisine from ${result.changes} recipe(s).`, updated: result.changes });
    }
    
    return err_('Invalid action. Use "rename" or "delete".');
  } catch (e) {
    return err_(e && e.message ? e.message : e);
  }
}

module.exports = { handleApiCall, parseIngredientLine };
