const crypto = require('crypto');
const path = require('path');
const fs = require('fs');
const https = require('https');
const http = require('http');
const { app } = require('electron');
const { db } = require('./db');
const { upsertEvent, deleteEvent } = require('./calendar');

const googleCal = require('./google-calendar');
const { getCanonicalKey } = require('./shopping-normalizer');

function downloadImageToLocal_(imageUrl, recipeId) {
  return new Promise((resolve, reject) => {
    if (!imageUrl || !imageUrl.startsWith('http')) {
      return resolve(null);
    }

    const imagesDir = path.join(app.getPath('userData'), 'images');
    if (!fs.existsSync(imagesDir)) {
      fs.mkdirSync(imagesDir, { recursive: true });
    }

    // Try to guess extension from URL
    let ext = 'jpg';
    try {
      const urlObj = new URL(imageUrl);
      const pathname = urlObj.pathname;
      const match = pathname.match(/\.(jpg|jpeg|png|gif|webp)$/i);
      if (match) {
        ext = match[1].toLowerCase();
      }
    } catch (e) {
      // invalid url, default to jpg
    }

    const filename = `${recipeId}.${ext}`;
    const filepath = path.join(imagesDir, filename);

    const protocol = imageUrl.startsWith('https') ? https : http;
    const file = fs.createWriteStream(filepath);

    const request = protocol.get(imageUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8'
      }
    }, (response) => {
      // Handle redirects manualy if needed, though http.get usually follows them if configured? 
      // Node's http.get does NOT follow redirects by default.
      if (response.statusCode === 301 || response.statusCode === 302 || response.statusCode === 303 || response.statusCode === 307 || response.statusCode === 308) {
        file.close();
        if (fs.existsSync(filepath)) fs.unlinkSync(filepath);
        if (response.headers.location) {
          // Handle relative redirects
          let redirectUrl = response.headers.location;
          if (!redirectUrl.startsWith('http')) {
            try {
              const u = new URL(imageUrl);
              redirectUrl = new URL(redirectUrl, u.origin).toString();
            } catch (e) { }
          }

          return downloadImageToLocal_(redirectUrl, recipeId)
            .then(resolve)
            .catch(resolve); // Resolve null on error
        }
        return resolve(null);
      }

      if (response.statusCode !== 200) {
        file.close();
        if (fs.existsSync(filepath)) fs.unlinkSync(filepath);
        return resolve(null);
      }

      response.pipe(file);
      file.on('finish', () => {
        file.close(() => {
          resolve(`images/${filename}`);
        });
      });
      file.on('error', (err) => {
        file.close();
        if (fs.existsSync(filepath)) fs.unlinkSync(filepath);
        resolve(null);
      });
    });

    request.on('error', (err) => {
      file.close();
      if (fs.existsSync(filepath)) fs.unlinkSync(filepath);
      resolve(null);
    });

    // Set timeout
    request.setTimeout(30000, () => {
      request.destroy();
      file.close();
      if (fs.existsSync(filepath)) fs.unlinkSync(filepath);
      resolve(null);
    });
  });
}


function ok_(obj) { return Object.assign({ ok: true }, obj || {}); }
function err_(msg) { return { ok: false, error: String(msg || 'Unknown error') }; }

function normLower_(s) { return String(s || '').trim().toLowerCase(); }
function clamp_(n, lo, hi) { n = Number(n || 0); return Math.max(lo, Math.min(hi, n)); }


function parseQtyText_(s) {
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

  // Decode HTML entities first
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
    .replace(/·/g, ' ') // Middle dot
    .replace(/"/g, '"') // Smart quotes
    .replace(/"/g, '"')
    .replace(/'/g, "'") // Smart apostrophes
    .replace(/'/g, "'")
    .replace(/\s+/g, ' '); // Normalize spaces

  // Unicode fraction mapping
  const fractionMap = {
    '½': '1/2', '⅓': '1/3', '¼': '1/4', '⅔': '2/3', '¾': '3/4',
    '⅕': '1/5', '⅖': '2/5', '⅗': '3/5', '⅘': '4/5',
    '⅙': '1/6', '⅚': '5/6', '⅛': '1/8', '⅜': '3/8', '⅝': '5/8', '⅞': '7/8'
  };

  for (const [unicode, frac] of Object.entries(fractionMap)) {
    text = text.replace(new RegExp(unicode, 'g'), frac);
  }

  // IMPORTANT: Try mixed fraction first, then simple fraction, then decimal
  const qtyPattern = /^(\d+\s+\d+\/\d+|\d+\/\d+|\d+(?:\.\d+)?)(?:\s*(?:to|-)\s*(\d+\s+\d+\/\d+|\d+\/\d+|\d+(?:\.\d+)?))?/;
  const unitPattern = /(teaspoons?|tablespoons?|cups?|ounces?|pounds?|lbs?|grams?|kilograms?|milliliters?|liters?|tsp|tbsp|oz|lb|g|kg|ml|l|pinch|dash|cloves?|cans?|jars?|packages?|pkgs?|bunches?|slices?|pieces?|whole|medium|large|small)\b/i;

  let match = text.match(qtyPattern);
  let qtyNum = null;
  let qtyText = '';
  let remainder = text;

  if (match) {
    const qty1 = match[1];
    const qty2 = match[2];
    qtyNum = parseFraction_(qty1);
    qtyText = qty2 ? `${qty1} to ${qty2}` : qty1;
    remainder = text.substring(match[0].length).trim();
  }

  // Handle parenthetical size info: "1 (16 ounce) can"
  const sizeParenMatch = remainder.match(/^\(([^)]+?(?:ounce|oz|lb|pound|gram|g|kg|ml|liter|l)s?[^)]*)\)\s*/i);
  if (sizeParenMatch) {
    const sizeInfo = sizeParenMatch[1].trim();
    qtyText = qtyText ? `${qtyText} (${sizeInfo})` : `(${sizeInfo})`;
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

  // Extract notes
  let ingredientName = remainder;
  let notes = '';

  // Extract ALL parenthetical notes
  while (ingredientName.match(/\(([^)]+)\)/)) {
    const parenMatch = ingredientName.match(/\(([^)]+)\)/);
    if (parenMatch) {
      const parenContent = parenMatch[1].trim();
      notes = notes ? notes + '; ' + parenContent : parenContent;
      ingredientName = ingredientName.replace(parenMatch[0], ' ').trim();
    }
  }

  // Extract comma-separated notes
  const commaMatch = ingredientName.match(/,\s*(.+)$/);
  if (commaMatch) {
    const suffix = commaMatch[1].trim();
    notes = notes ? notes + '; ' + suffix : suffix;
    ingredientName = ingredientName.substring(0, commaMatch.index).trim();
  }

  // Extract dash notes
  const dashMatch = ingredientName.match(/\s+-\s+(.+)$/);
  if (dashMatch) {
    const suffix = dashMatch[1].trim();
    notes = notes ? notes + '; ' + suffix : suffix;
    ingredientName = ingredientName.substring(0, dashMatch.index).trim();
  }

  // Clean ingredient name
  ingredientName = ingredientName.trim();
  ingredientName = ingredientName.replace(/^[\s\.\,\;\:\)\]\}\-\/\|\&\*\+\=\!\?\<\>\"\`\~\#\@\$\%\^\(\[\{]+/g, '').trim();
  ingredientName = ingredientName.replace(/[\s\.\,\;\:\)\]\}\-\/\|\&\*\+\=\!\?\<\>\"\`\~\#\@\$\%\^\(\[\{]+$/g, '').trim();

  if (ingredientName.match(/^'s\s/)) {
    ingredientName = ingredientName.substring(2).trim();
  }

  if ((ingredientName.startsWith('"') && ingredientName.endsWith('"')) ||
    (ingredientName.startsWith("'") && ingredientName.endsWith("'"))) {
    ingredientName = ingredientName.substring(1, ingredientName.length - 1).trim();
  }

  let ingredientNorm = ingredientName.toLowerCase().trim();
  ingredientNorm = ingredientNorm.replace(/\([^)]*\)/g, ' ').trim();
  ingredientNorm = ingredientNorm.replace(/\s+/g, ' ').trim();

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
function canonicalUnit(u) {
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

function unitFamily_(u) {
  const cu = canonicalUnit(u);
  if (!cu) return { fam: '', base: '' };
  if (cu === 'tsp' || cu === 'tbsp' || cu === 'cup') return { fam: 'vol', base: 'tsp' };
  if (cu === 'ml' || cu === 'l') return { fam: 'ml', base: 'ml' };
  if (cu === 'g' || cu === 'kg' || cu === 'oz' || cu === 'lb') return { fam: 'wt', base: 'g' };
  // count-like units (no conversion beyond identity)
  return { fam: 'count', base: cu };
}

function toBase_(qty, unit) {
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

function fromBase_(baseQty, targetUnit) {
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

function convertQty_(qty, fromUnit, toUnit) {
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

function formatQty_(qty, unit) {
  if (qty === null || qty === undefined || !Number.isFinite(Number(qty))) {
    return unit ? unit : '';
  }
  const n = Number(qty);
  const u = String(unit || '').trim();

  const commonFractions = [
    { decimal: 0.125, text: '1/8' },
    { decimal: 0.25, text: '1/4' },
    { decimal: 0.333, text: '1/3' },
    { decimal: 0.375, text: '3/8' },
    { decimal: 0.5, text: '1/2' },
    { decimal: 0.625, text: '5/8' },
    { decimal: 0.667, text: '2/3' },
    { decimal: 0.75, text: '3/4' },
    { decimal: 0.875, text: '7/8' }
  ];

  const whole = Math.floor(n);
  const frac = n - whole;

  if (frac < 0.01) {
    return u ? `${whole} ${u}` : `${whole}`;
  }

  let fracText = '';
  for (const f of commonFractions) {
    if (Math.abs(frac - f.decimal) < 0.05) {
      fracText = f.text;
      break;
    }
  }

  if (fracText) {
    if (whole > 0) {
      return u ? `${whole} ${fracText} ${u}` : `${whole} ${fracText}`;
    } else {
      return u ? `${fracText} ${u}` : fracText;
    }
  }

  const rounded = Math.round(n * 100) / 100;
  return u ? `${rounded} ${u}` : `${rounded}`;
}

function pantryQtyFromRow_(row) {
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

function _deductFromPantry_(ingredientLower, requiredQty, baseUnit) {
  const ing = normLower_(ingredientLower);
  const needBase = Number(requiredQty);
  const bu = canonicalUnit(baseUnit);
  if (!ing || !Number.isFinite(needBase) || needBase <= 0 || !bu) return 0;

  const hasQtyNum = pantryHasCol_('QtyNum');
  const hasUnit = pantryHasCol_('Unit');

  // Select only columns that exist in the current DB schema.
  const cols = ['ItemId', 'Name', 'NameLower', 'QtyText'];
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


function _addBackToPantry_(ingredientLower, addQty, baseUnit) {
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

  const cols = ['ItemId', 'Name', 'NameLower', 'QtyText', 'StoreId', 'Notes'];
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
function _reconcileOutstandingFromDate_(_dateYmd) {
  return;
}

let _pantryColsCache = null;
function pantryCols_() {
  if (_pantryColsCache) return _pantryColsCache;
  try {
    const cols = db().prepare("PRAGMA table_info(pantry)").all().map(r => r.name);
    _pantryColsCache = new Set(cols);
  } catch (_) {
    _pantryColsCache = new Set();
  }
  return _pantryColsCache;
}
function pantryHasCol_(name) {
  return pantryCols_().has(name);
}

function ymd_(d) {
  const dt = (d instanceof Date) ? d : new Date(d);
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, '0');
  const da = String(dt.getDate()).padStart(2, '0');
  return `${y}-${m}-${da}`;
}
function addDays_(dateYmd, days) {
  const [y, m, d] = String(dateYmd).split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + Number(days || 0));
  return ymd_(dt);
}
function uuidShort_(prefix) {
  const id = crypto.randomUUID().replace(/-/g, '').slice(0, 12);
  return `${prefix}_${id}`;
}

// --- helpers to map DB rows to UI objects ---
function recipeRowToObj(r) {
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
function planRowToObj(p) {
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
  return { PlanId: p.Date, Date: p.Date, Breakfast: null, Lunch: null, Dinner: null, Calendar: {} };
}


// ---- plans schema compatibility ----
let _plansSchemaCache = null;
function plansSchema_() {
  if (_plansSchemaCache) return _plansSchemaCache;
  const cols = db().prepare("PRAGMA table_info(plans)").all().map(r => r.name);
  const hasNew = cols.includes('BreakfastRecipeId') && cols.includes('BreakfastTitle');
  const hasLegacy = cols.includes('Breakfast') && cols.includes('Lunch') && cols.includes('Dinner');
  _plansSchemaCache = { hasNew, hasLegacy };
  return _plansSchemaCache;
}
function parseMealJson_(s) {
  if (!s) return null;
  try {
    const obj = JSON.parse(String(s));
    if (obj && (obj.RecipeId || obj.Title)) {
      return {
        RecipeId: String(obj.RecipeId || ''),
        Title: String(obj.Title || ''),
        UseLeftovers: obj.UseLeftovers || false,
        From: obj.From || ''
      };
    }
  } catch (_) { }
  return null;
}
function mealToJson_(meal) {
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
      case 'upsertRecipeWithIngredients': return await upsertRecipeWithIngredients(payload);
      case 'deleteRecipeCascade': return deleteRecipeCascade(payload);
      // Recipe favorites: per-user logic (redirecting legacy if called)
      case 'toggleRecipeFavorite': return toggleUserFavorite(payload);
      case 'searchRecipesFuzzy': return searchRecipesFuzzy(payload);
      case 'getRecipeSuggestionsFromPantry': return getRecipeSuggestionsFromPantry(payload);
      case 'importRecipeFromUrl': return importRecipeFromUrl(payload);

      case 'getPlansRange': return getPlansRange(payload);
      case 'upsertPlanMeal': return upsertPlanMeal(payload);
      case 'swapPlanMeals': return swapPlanMeals(payload);
      case 'clearMealsByRange': return clearMealsByRange(payload);

      // Multi-User Meal Plans (Phase 4.5.7)
      case 'getUserPlanMeals': return getUserPlanMeals(payload);
      case 'upsertUserPlanMeal': return upsertUserPlanMeal(payload);
      case 'deleteUserPlanMeal': return deleteUserPlanMeal(payload);

      case 'buildShoppingList': return buildShoppingList(payload);

      // Shopping list: assign/reassign store for items in the selected plan range
      case 'assignShoppingItemStore': return assignShoppingItemStore(payload);
      case 'returnItemToPantry': return returnItemToPantry(payload);
      case 'markShoppingItemPurchased': return markShoppingItemPurchased(payload);

      case 'updateShoppingItem': return updateShoppingItem(payload);
      case 'deleteShoppingItem': return deleteShoppingItem(payload);

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

      // Additional Items API (new)
      case 'addAdditionalItem': return addAdditionalItem(payload);
      case 'removeAdditionalItem': return removeAdditionalItem(payload);
      case 'getAdditionalItems': return getAdditionalItems(payload);
      case 'getAdditionalItemsRange': return getAdditionalItemsRange(payload);
      case 'assignCollectionToSlot': return assignCollectionToSlot(payload);

      // Multi-User Support API (Phase 4.5)
      case 'listUsers': return listUsers();
      case 'getUser': return getUser(payload);
      case 'createUser': return createUser(payload);
      case 'updateUser': return updateUser(payload);
      case 'deleteUser': return deleteUser(payload);
      case 'setActiveUser': return setActiveUser(payload);
      case 'getActiveUser': return getActiveUser();

      case 'listDietaryRestrictions': return listDietaryRestrictions();
      case 'getUserDietaryRestrictions': return getUserDietaryRestrictions(payload);
      case 'addUserDietaryRestriction': return addUserDietaryRestriction(payload);
      case 'removeUserDietaryRestriction': return removeUserDietaryRestriction(payload);

      case 'toggleUserFavorite': return toggleUserFavorite(payload);
      case 'getUserFavorites': return getUserFavorites(payload);
      case 'isUserFavorite': return isUserFavorite(payload);

      case 'getMealAssignments': return getMealAssignments(payload);
      case 'setMealAssignments': return setMealAssignments(payload);
      case 'addMealAssignment': return addMealAssignment(payload);
      case 'removeMealAssignment': return removeMealAssignment(payload);


      // Image Download API (TODO: Implement these functions)
      // case 'downloadRecipeImage': return downloadRecipeImage(payload);
      // case 'downloadAllRecipeImages': return downloadAllRecipeImages(payload);


      default:
        return err_('Unknown function: ' + fn);
    }
  } catch (e) {
    console.error('[handleApiCall] ERROR in function', fn, ':', e);
    return err_(e && e.message ? e.message : e);
  }
}

// ================= STORES =================
function listStores() {
  const rows = db().prepare("SELECT StoreId, Name, Priority FROM stores ORDER BY Priority ASC, StoreId ASC").all();
  const seen = new Set();
  const out = [];

  // Prefer human-readable IDs (e.g. 'costco') over generated ones (e.g. 'store_xxx') when names match.
  // Dedupe by normalized name.
  const preferred = (a, b) => {
    const aGen = /^store[_-]/i.test(String(a.StoreId || ''));
    const bGen = /^store[_-]/i.test(String(b.StoreId || ''));
    if (aGen !== bGen) return aGen ? b : a;
    // tie-breaker: lower StoreId
    return String(a.StoreId || '') <= String(b.StoreId || '') ? a : b;
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
  out.push(...Array.from(byName.values()).sort((a, b) => {
    const pa = Number(a.Priority ?? 9999), pb = Number(b.Priority ?? 9999);
    if (pa !== pb) return pa - pb;
    return String(a.Name).localeCompare(String(b.Name));
  }));

  return ok_({ stores: out });
}

function addStore(payload) {
  const name = String(payload && payload.name || '').trim();
  if (!name) return err_('Store name is required.');
  const priority = Number(payload && payload.priority || 999);

  const storeId = normLower_(name).replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || uuidShort_('store');
  db().prepare("INSERT INTO stores(StoreId, Name, Priority, UpdatedAt) VALUES(?,?,?,datetime('now')) ON CONFLICT(StoreId) DO UPDATE SET Name=excluded.Name, Priority=excluded.Priority, UpdatedAt=excluded.UpdatedAt")
    .run(storeId, name, priority);
  return ok_({ StoreId: storeId });
}

function deleteStore(payload) {
  const storeId = String(payload && payload.storeId || '').trim();
  if (!storeId) return err_('Missing storeId.');
  db().prepare("DELETE FROM stores WHERE StoreId=?").run(storeId);
  return ok_({});
}

// ================= RECIPES =================
function listRecipesPage(payload) {
  const q = normLower_((payload && payload.q) || '');
  const userId = (payload && payload.userId) || '';
  const limit = clamp_(payload && payload.limit || 50, 10, 250);
  const pageToken = (payload && payload.pageToken) ? String(payload.pageToken) : '';

  let startAfterTitle = '';
  let startAfterDocId = '';
  if (pageToken) {
    try {
      const t = JSON.parse(pageToken);
      startAfterTitle = String(t.title || '');
      startAfterDocId = String(t.docId || '');
    } catch (e) {
      console.error('[listRecipesPage] Invalid pageToken:', pageToken);
    }
  }

  const params = { limit };
  let where = "1=1";

  // Filter by Cuisine
  const cuisine = (payload && payload.cuisine) || '';
  if (cuisine) {
    where += " AND r.Cuisine = @cuisine";
    params.cuisine = cuisine;
  }

  // Filter by MealType
  const mealType = (payload && payload.mealType) || '';
  if (mealType) {
    where += " AND r.MealType = @mealType";
    params.mealType = mealType;
  }

  if (q) {
    where += " AND r.TitleLower >= @q AND r.TitleLower < @q2";
    params.q = q;
    params.q2 = q + '\uf8ff';
  }

  if (startAfterTitle && startAfterDocId) {
    where += " AND (r.TitleLower > @st OR (r.TitleLower = @st AND r.RecipeId > @sid))";
    params.st = startAfterTitle;
    params.sid = startAfterDocId;
  }

  // Handle favorites join if userId is provided
  let favoriteSelect = "0 AS is_favorite";
  let favoriteJoin = "";
  if (userId) {
    favoriteSelect = "CASE WHEN f.recipe_id IS NOT NULL THEN 1 ELSE 0 END AS is_favorite";
    favoriteJoin = "LEFT JOIN user_favorites f ON r.RecipeId = f.recipe_id AND f.user_id = @userId";
    params.userId = userId;
  }

  const rows = db().prepare(`
    SELECT r.RecipeId, r.Title, r.TitleLower, r.URL, r.Cuisine, r.MealType, r.Notes, r.Instructions, r.Image_Name, ${favoriteSelect}
    FROM recipes r
    ${favoriteJoin}
    WHERE ${where}
    ORDER BY r.TitleLower ASC, r.RecipeId ASC
    LIMIT @limit
  `).all(params);

  const recipes = rows.map(recipeRowToObj);

  let nextPageToken = '';
  if (recipes.length === limit) {
    const last = recipes[recipes.length - 1];
    nextPageToken = JSON.stringify({ title: last.TitleLower || normLower_(last.Title), docId: last.RecipeId });
  }

  return ok_({ recipes, nextPageToken });
}

function listRecipesAll(payload) {
  const q = normLower_((payload && payload.q) || '');
  const userId = (payload && payload.userId) || '';

  const params = {};
  let where = "1=1";

  // Add cuisine/mealType filters if provided (optional, for consistency)
  if (payload && payload.cuisine) {
    where += " AND r.Cuisine = @cuisine";
    params.cuisine = payload.cuisine;
  }
  if (payload && payload.mealType) {
    where += " AND r.MealType = @mealType";
    params.mealType = payload.mealType;
  }

  let favoriteSelect = "0 AS is_favorite";
  let favoriteJoin = "";
  if (userId) {
    favoriteSelect = "CASE WHEN f.recipe_id IS NOT NULL THEN 1 ELSE 0 END AS is_favorite";
    favoriteJoin = "LEFT JOIN user_favorites f ON r.RecipeId = f.recipe_id AND f.user_id = @userId";
    params.userId = userId;
  }

  let rows;
  if (q) {
    params.q = q;
    params.q2 = q + '\uf8ff';
    where += " AND r.TitleLower >= @q AND r.TitleLower < @q2";
  }

  rows = db().prepare(
    `SELECT r.RecipeId, r.Title, r.TitleLower, r.URL, r.Cuisine, r.MealType, r.Notes, r.Instructions, r.Image_Name, ${favoriteSelect} ` +
    `FROM recipes r ${favoriteJoin} ` +
    `WHERE ${where} ` +
    `ORDER BY r.TitleLower ASC, r.RecipeId ASC`
  ).all(params);
  return ok_({ recipes: rows });
}

function getRecipe(payload) {
  const recipeId = String(payload && payload.recipeId || '').trim();
  if (!recipeId) return err_('Missing recipeId.');
  const r = db().prepare("SELECT * FROM recipes WHERE RecipeId=?").get(recipeId);
  if (!r) return err_('Recipe not found.');
  const result = recipeRowToObj(r);
  return ok_({ recipe: result });
}

function listRecipeIngredients(payload) {
  const recipeId = String(payload && payload.recipeId || '').trim();
  if (!recipeId) return err_('Missing recipeId.');
  const rows = db().prepare("SELECT IngredientNorm, IngredientRaw, Notes, QtyNum, QtyText, StoreId, Unit, Category, idx FROM ingredients WHERE RecipeId=? ORDER BY idx ASC").all(recipeId);
  return ok_({
    items: rows.map(r => ({
      IngredientNorm: r.IngredientNorm || '',
      IngredientRaw: r.IngredientRaw || '',
      Notes: r.Notes || '',
      QtyNum: (r.QtyNum === null || r.QtyNum === undefined) ? '' : r.QtyNum,
      QtyText: r.QtyText || '',
      StoreId: r.StoreId || '',
      Unit: r.Unit || '',
      Category: r.Category || '',
      idx: r.idx
    }))
  });
}

async function upsertRecipeWithIngredients(payload) {
  const recipe = (payload && payload.recipe) || {};
  const items = Array.isArray(payload && payload.items) ? payload.items : [];
  const ingredientsOnly = payload && payload.ingredientsOnly === true;

  const nowIso = new Date().toISOString();
  const recipeId = String(recipe.RecipeId || '').trim() || uuidShort_('rec');

  const title = String(recipe.Title || '').trim();
  if (!title) return err_('Title is required.');

  // Handle image: if it's a URL, download it locally
  let imageName = String(recipe.Image_Name || '').trim();
  if (imageName && (imageName.startsWith('http://') || imageName.startsWith('https://'))) {
    try {
      const localPath = await downloadImageToLocal_(imageName, recipeId);
      if (localPath) {
        imageName = localPath;
      }
    } catch (imgErr) {
      console.warn('[upsertRecipe] Failed to download image:', imgErr.message);
    }
  }

  // Only update recipe if not ingredientsOnly mode
  if (!ingredientsOnly) {
    const docPatch = {
      RecipeId: recipeId,
      Title: title,
      TitleLower: normLower_(title),
      URL: String(recipe.URL || '').trim(),
      Cuisine: String(recipe.Cuisine || '').trim(),
      MealType: String(recipe.MealType || 'Any').trim() || 'Any',
      Notes: String(recipe.Notes || ''),
      Instructions: String(recipe.Instructions || ''),
      Image_Name: imageName,
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
  }

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

function deleteRecipeCascade(payload) {
  const recipeId = String(payload && payload.recipeId || '').trim();
  if (!recipeId) return err_('Missing recipeId.');
  db().prepare("DELETE FROM recipes WHERE RecipeId=?").run(recipeId); // cascades to ingredients
  return ok_({});
}

function toggleRecipeFavorite(payload) {
  const recipeId = String(payload && payload.recipeId || '').trim();
  if (!recipeId) return err_('Missing recipeId.');

  const current = db().prepare("SELECT is_favorite FROM recipes WHERE RecipeId=?").get(recipeId);
  if (!current) return err_('Recipe not found.');

  const newValue = current.is_favorite ? 0 : 1;
  db().prepare("UPDATE recipes SET is_favorite = ?, UpdatedAt = datetime('now') WHERE RecipeId=?").run(newValue, recipeId);
  return ok_({ isFavorite: newValue === 1 });
}

function searchRecipesFuzzy(payload) {
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

  return ok_({
    recipes: rows.map(r => ({
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
    }))
  });
}

function getRecipeSuggestionsFromPantry(payload) {
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

  return ok_({
    recipes: rows.map(r => ({
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
    })), matchedIngredients: pantryItems.map(p => p.Name).slice(0, 10)
  });
}

// ---- Auto-categorization functions ----

const COMPREHENSIVE_CUISINES = [
  'Afghan', 'African', 'Albanian', 'American', 'Argentinian', 'Armenian', 'Asian', 'Australian', 'Austrian',
  'Bangladeshi', 'Barbecue', 'Belgian', 'Bolivian', 'Brazilian', 'British', 'Bulgarian', 'Cajun/Creole',
  'Cambodian', 'Caribbean', 'Chilean', 'Chinese', 'Colombian', 'Cuban', 'Czech',
  'Danish', 'Dominican', 'Dutch',
  'Ecuadorian', 'Egyptian', 'English', 'Ethiopian', 'European',
  'Filipino', 'Finnish', 'French',
  'Georgian', 'German', 'Greek', 'Guatemalan',
  'Haitian', 'Hawaiian', 'Hungarian',
  'Icelandic', 'Indian', 'Indonesian', 'Iranian', 'Iraqi', 'Irish', 'Israeli', 'Italian',
  'Jamaican', 'Japanese', 'Jewish', 'Jordanian',
  'Korean', 'Kosher',
  'Latin American', 'Lebanese',
  'Malaysian', 'Mediterranean', 'Mexican', 'Middle Eastern', 'Mongolian', 'Moroccan',
  'Nepalese', 'New Zealand', 'Nigerian', 'Norwegian',
  'Pakistani', 'Persian', 'Peruvian', 'Polish', 'Portuguese', 'Puerto Rican',
  'Romanian', 'Russian',
  'Salvadoran', 'Scandinavian', 'Scottish', 'Seafood', 'Serbian', 'Singaporean', 'Slovak', 'South African', 'South American', 'Spanish', 'Sri Lankan', 'Swedish', 'Swiss',
  'Taiwanese', 'Thai', 'Tibetan', 'Turkish',
  'Ukrainian',
  'Vegan', 'Vegetarian', 'Vietnamese',
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
    'Italian': ['italian', 'pasta', 'pizza', 'risotto', 'parmigiana', 'carbonara', 'bolognese', 'marinara', 'alfredo', 'pesto'],
    'Mexican': ['mexican', 'taco', 'burrito', 'quesadilla', 'enchilada', 'salsa', 'guacamole', 'tortilla', 'fajita', 'chimichanga'],
    'Chinese': ['chinese', 'stir-fry', 'wok', 'chow mein', 'fried rice', 'dim sum', 'kung pao', 'szechuan', 'cantonese'],
    'Indian': ['indian', 'curry', 'tandoori', 'tikka', 'masala', 'biryani', 'naan', 'samosa', 'vindaloo', 'korma'],
    'Japanese': ['japanese', 'sushi', 'ramen', 'teriyaki', 'tempura', 'udon', 'miso', 'sashimi', 'katsu'],
    'Thai': ['thai', 'pad thai', 'curry', 'basil', 'lemongrass', 'coconut milk', 'tom yum', 'panang'],
    'French': ['french', 'crepe', 'croissant', 'quiche', 'ratatouille', 'bourguignon', 'provencal', 'bechamel'],
    'Greek': ['greek', 'gyro', 'souvlaki', 'moussaka', 'tzatziki', 'spanakopita', 'feta'],
    'American': ['american', 'burger', 'bbq', 'barbecue', 'hot dog', 'fried chicken', 'mac and cheese'],
    'Mediterranean': ['mediterranean', 'hummus', 'falafel', 'tabbouleh', 'olive oil', 'chickpea'],
    'Korean': ['korean', 'kimchi', 'bulgogi', 'bibimbap', 'gochujang', 'korean bbq'],
    'Vietnamese': ['vietnamese', 'pho', 'banh mi', 'spring roll', 'nuoc cham'],
    'Middle Eastern': ['middle eastern', 'shawarma', 'kebab', 'tahini', 'za\'atar'],
    'Spanish': ['spanish', 'paella', 'tapas', 'gazpacho', 'chorizo', 'manchego'],
    'Caribbean': ['caribbean', 'jerk', 'plantain', 'mofongo', 'rum'],
    'Cajun/Creole': ['cajun', 'creole', 'gumbo', 'jambalaya', 'andouille', 'étouffée'],
    'British': ['british', 'fish and chips', 'shepherd\'s pie', 'bangers', 'yorkshire pudding'],
    'German': ['german', 'bratwurst', 'schnitzel', 'sauerkraut', 'pretzel', 'spätzle'],
    'Brazilian': ['brazilian', 'feijoada', 'churrasco', 'brigadeiro', 'açaí'],
    'Peruvian': ['peruvian', 'ceviche', 'lomo saltado', 'aji amarillo'],
    'Ethiopian': ['ethiopian', 'injera', 'berbere', 'doro wat'],
    'Lebanese': ['lebanese', 'kibbeh', 'labneh', 'manakish'],
    'Turkish': ['turkish', 'döner', 'baklava', 'börek', 'köfte']
  };

  for (const [cuisine, terms] of Object.entries(cuisineKeywords)) {
    if (terms.some(term => keywords.includes(term))) {
      return cuisine;
    }
  }

  // Priority 3: URL analysis (e.g., "allrecipes.com/recipes/world-cuisine/asian/indian/")
  if (recipeData.url) {
    const urlLower = String(recipeData.url).toLowerCase();
    for (const cuisine of COMPREHENSIVE_CUISINES) {
      if (urlLower.includes(cuisine.toLowerCase())) {
        return cuisine;
      }
    }
  }

  return ''; // No cuisine detected
}

function detectMealType(recipeData) {
  const keywords = [
    recipeData.recipeCategory,
    recipeData.keywords,
    recipeData.name,
    recipeData.description
  ].filter(Boolean).join(' ').toLowerCase();

  const mealTypeMap = {
    'Breakfast': ['breakfast', 'brunch', 'morning', 'pancake', 'waffle', 'omelette', 'cereal', 'muffin', 'bagel'],
    'Lunch': ['lunch', 'sandwich', 'wrap', 'salad', 'soup'],
    'Dinner': ['dinner', 'entree', 'main course', 'supper'],
    'Snack': ['snack', 'appetizer', 'hors d\'oeuvre', 'finger food', 'dip'],
    'Dessert': ['dessert', 'cake', 'cookie', 'pie', 'ice cream', 'pudding', 'brownie', 'tart', 'sweet']
  };

  for (const [mealType, terms] of Object.entries(mealTypeMap)) {
    if (terms.some(term => keywords.includes(term))) {
      return mealType;
    }
  }

  return 'Any';
}

function findSystemChrome() {
  const fs = require('fs');
  const path = require('path');
  const os = require('os');

  const platform = os.platform();
  let paths = [];

  if (platform === 'darwin') {
    paths = [
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
      '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser'
    ];
  } else if (platform === 'win32') {
    paths = [
      'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
      'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
      'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
    ];
  }

  for (const p of paths) {
    if (fs.existsSync(p)) return p;
  }
  return null;
}

async function importRecipeFromUrl(payload) {
  const url = String(payload && payload.url || '').trim();
  if (!url) return err_('URL is required');

  try {
    const puppeteer = require('puppeteer');
    const executablePath = findSystemChrome();

    const launchOptions = {
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    };

    if (executablePath) {
      console.log('[api] Using system browser:', executablePath);
      launchOptions.executablePath = executablePath;
    } else {
      console.warn('[api] No system browser found, falling back to Puppeteer default');
    }

    const browser = await puppeteer.launch(launchOptions);

    const page = await browser.newPage();

    // Set a realistic user agent to avoid being blocked
    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });

    // Extract recipe data from JSON-LD with enhanced parsing
    const recipeData = await page.evaluate(() => {
      // Helper to check if an object is a Recipe type
      function isRecipeType(obj) {
        if (!obj || typeof obj !== 'object') return false;
        const type = obj['@type'];
        if (Array.isArray(type)) return type.includes('Recipe');
        return type === 'Recipe';
      }

      // Helper to recursively find Recipe in an object
      function findRecipe(obj, depth = 0) {
        if (depth > 5) return null; // Prevent infinite recursion
        if (!obj || typeof obj !== 'object') return null;

        // Direct match
        if (isRecipeType(obj)) return obj;

        // Check @graph array
        if (Array.isArray(obj['@graph'])) {
          for (const item of obj['@graph']) {
            const found = findRecipe(item, depth + 1);
            if (found) return found;
          }
        }

        // Check mainEntity
        if (obj.mainEntity) {
          const found = findRecipe(obj.mainEntity, depth + 1);
          if (found) return found;
        }

        // Check if it's an array (some sites put recipes in an array)
        if (Array.isArray(obj)) {
          for (const item of obj) {
            const found = findRecipe(item, depth + 1);
            if (found) return found;
          }
        }

        return null;
      }

      const scripts = Array.from(document.querySelectorAll('script[type="application/ld+json"]'));
      for (const script of scripts) {
        try {
          const json = JSON.parse(script.textContent);
          const recipe = findRecipe(json);

          if (recipe) {
            return {
              name: recipe.name || '',
              description: recipe.description || '',
              recipeIngredient: recipe.recipeIngredient || [],
              recipeInstructions: recipe.recipeInstructions || [],
              recipeCuisine: recipe.recipeCuisine || '',
              recipeCategory: recipe.recipeCategory || '',
              keywords: recipe.keywords || '',
              image: recipe.image || '',
              prepTime: recipe.prepTime || '',
              cookTime: recipe.cookTime || '',
              totalTime: recipe.totalTime || '',
              recipeYield: recipe.recipeYield || '',
              url: recipe.url || window.location.href
            };
          }
        } catch (e) {
          console.error('Error parsing JSON-LD:', e);
        }
      }

      // Fallback: Try to extract from microdata (schema.org itemtype)
      const microdataRecipe = document.querySelector('[itemtype*="schema.org/Recipe"]');
      if (microdataRecipe) {
        const getName = (el) => {
          const prop = el.querySelector('[itemprop="name"]');
          return prop ? prop.textContent.trim() : '';
        };
        const getAll = (el, prop) => {
          return Array.from(el.querySelectorAll(`[itemprop="${prop}"]`)).map(e => e.textContent.trim());
        };

        return {
          name: getName(microdataRecipe),
          description: microdataRecipe.querySelector('[itemprop="description"]')?.textContent?.trim() || '',
          recipeIngredient: getAll(microdataRecipe, 'recipeIngredient'),
          recipeInstructions: getAll(microdataRecipe, 'recipeInstructions'),
          recipeCuisine: '',
          recipeCategory: '',
          keywords: '',
          image: microdataRecipe.querySelector('[itemprop="image"]')?.src || '',
          prepTime: '',
          cookTime: '',
          totalTime: '',
          recipeYield: '',
          url: window.location.href
        };
      }

      return null;
    });

    await browser.close();

    if (!recipeData || !recipeData.name) {
      return err_('Could not extract recipe data from URL. The site may not use standard recipe markup.');
    }

    // Process ingredients
    const ingredients = [];
    for (const line of recipeData.recipeIngredient) {
      const parsed = parseIngredientLine(line);
      if (parsed) {
        ingredients.push(parsed);
      }
    }

    // Process instructions
    let instructions = '';
    if (Array.isArray(recipeData.recipeInstructions)) {
      instructions = recipeData.recipeInstructions
        .map((step, idx) => {
          const text = typeof step === 'string' ? step :
            (step.text || step.name || '');
          return text ? `${idx + 1}. ${text}` : '';
        })
        .filter(Boolean)
        .join('\n\n');
    } else if (typeof recipeData.recipeInstructions === 'string') {
      instructions = recipeData.recipeInstructions;
    }

    // Auto-detect cuisine and meal type
    const cuisine = detectCuisine(recipeData);
    const mealType = detectMealType(recipeData);

    // Extract image URL
    let imageUrl = '';
    if (recipeData.image) {
      imageUrl = Array.isArray(recipeData.image) ? recipeData.image[0] :
        (typeof recipeData.image === 'object' ? recipeData.image.url : recipeData.image);
    }

    // Build notes with metadata
    const notes = [
      recipeData.description,
      recipeData.prepTime ? `Prep: ${recipeData.prepTime}` : '',
      recipeData.cookTime ? `Cook: ${recipeData.cookTime}` : '',
      recipeData.totalTime ? `Total: ${recipeData.totalTime}` : '',
      recipeData.recipeYield ? `Servings: ${recipeData.recipeYield}` : ''
    ].filter(Boolean).join('\n');

    // Parse servings from recipeYield
    let servings = 4;
    if (recipeData.recipeYield) {
      const yieldStr = String(recipeData.recipeYield);
      const match = yieldStr.match(/(\d+)/);
      if (match) servings = parseInt(match[1]) || 4;
    }

    // Return preview data for user to review before saving
    // The frontend will call saveImportedRecipe to actually save
    return ok_({
      title: recipeData.name,
      instructions: instructions,
      ingredients: ingredients,
      cuisine: cuisine,
      mealType: mealType,
      imageUrl: imageUrl,
      servings: servings,
      notes: notes,
      sourceUrl: url
    });

  } catch (error) {
    console.error('[importRecipeFromUrl] Error:', error);
    return err_(error.message || 'Failed to import recipe');
  }
}

function autoAssignCuisines(payload) {
  const limit = payload && payload.limit ? Number(payload.limit) : 100;

  // Get recipes without cuisines
  const recipes = db().prepare(`
    SELECT RecipeId, Title, URL, Notes, MealType 
    FROM recipes 
    WHERE Cuisine IS NULL OR Cuisine = ''
    LIMIT ?
  `).all(limit);

  let updated = 0;
  const updateStmt = db().prepare('UPDATE recipes SET Cuisine = ?, UpdatedAt = datetime(\'now\') WHERE RecipeId = ?');

  for (const recipe of recipes) {
    // Create synthetic recipeData for detection
    const recipeData = {
      name: recipe.Title,
      description: recipe.Notes,
      url: recipe.URL,
      recipeCategory: recipe.MealType
    };

    const cuisine = detectCuisine(recipeData);
    if (cuisine) {
      updateStmt.run(cuisine, recipe.RecipeId);
      updated++;
    }
  }

  return ok_({ updated, total: recipes.length });
}

function listUniqueCuisines(payload) {
  const rows = db().prepare(`
    SELECT DISTINCT Cuisine 
    FROM recipes 
    WHERE Cuisine IS NOT NULL AND Cuisine != ''
    ORDER BY Cuisine ASC
  `).all();

  return ok_({ cuisines: rows.map(r => r.Cuisine) });
}

function manageCuisine(payload) {
  const action = payload && payload.action;
  const oldName = payload && payload.oldName;
  const newName = payload && payload.newName;

  if (action === 'rename') {
    if (!oldName || !newName) return err_('Both oldName and newName required for rename');

    const count = db().prepare('UPDATE recipes SET Cuisine = ?, UpdatedAt = datetime(\'now\') WHERE Cuisine = ?')
      .run(newName, oldName);

    return ok_({ updated: count.changes });
  }

  if (action === 'delete') {
    if (!oldName) return err_('oldName required for delete');

    const count = db().prepare('UPDATE recipes SET Cuisine = \'\', UpdatedAt = datetime(\'now\') WHERE Cuisine = ?')
      .run(oldName);

    return ok_({ updated: count.changes });
  }

  return err_('Unknown action: ' + action);
}

// ================= PLANS =================
function getPlansRange(payload) {
  const start = String(payload && payload.start || '').trim();
  const end = String(payload && payload.end || '').trim();
  if (!start || !end) return err_('start and end date required.');

  const schema = plansSchema_();

  let rows;
  if (schema.hasNew) {
    rows = db().prepare(`
      SELECT 
        Date,
        BreakfastRecipeId, BreakfastTitle, BreakfastUseLeftovers, BreakfastFrom, BreakfastEventId,
        LunchRecipeId, LunchTitle, LunchUseLeftovers, LunchFrom, LunchEventId,
        DinnerRecipeId, DinnerTitle, DinnerUseLeftovers, DinnerFrom, DinnerEventId
      FROM plans
      WHERE Date >= ? AND Date <= ?
      ORDER BY Date ASC
    `).all(start, end);
  } else if (schema.hasLegacy) {
    rows = db().prepare(`
      SELECT Date, Breakfast, Lunch, Dinner, Calendar
      FROM plans
      WHERE Date >= ? AND Date <= ?
      ORDER BY Date ASC
    `).all(start, end);
  } else {
    rows = db().prepare(`
      SELECT Date FROM plans WHERE Date >= ? AND Date <= ? ORDER BY Date ASC
    `).all(start, end);
  }

  const plans = rows.map(planRowToObj);
  return ok_({ plans });
}

function upsertPlanMeal(payload) {
  const date = String(payload && payload.date || '').trim();
  const slot = String(payload && payload.slot || '').trim();
  const meal = (payload && payload.meal) || null;

  if (!date) return err_('date required.');
  if (slot !== 'Breakfast' && slot !== 'Lunch' && slot !== 'Dinner') {
    return err_('slot must be Breakfast, Lunch, or Dinner.');
  }

  const schema = plansSchema_();

  if (meal === null) {
    // Clear the meal slot
    if (schema.hasNew) {
      db().prepare(`UPDATE plans SET ${slot}RecipeId=NULL, ${slot}Title=NULL, ${slot}UseLeftovers=0, ${slot}From='', ${slot}EventId='' WHERE Date=?`).run(date);
    } else if (schema.hasLegacy) {
      db().prepare(`UPDATE plans SET ${slot}=NULL WHERE Date=?`).run(date);
    }
    return ok_({});
  }

  const recipeId = String(meal.RecipeId || '').trim();
  const title = String(meal.Title || '').trim();
  const useLeftovers = meal.UseLeftovers ? 1 : 0;
  const from = String(meal.From || '').trim();

  if (!recipeId && !title) return err_('meal must have RecipeId or Title.');

  // Ensure plan row exists
  db().prepare("INSERT INTO plans(Date) VALUES(?) ON CONFLICT(Date) DO NOTHING").run(date);

  if (schema.hasNew) {
    db().prepare(`
      UPDATE plans 
      SET ${slot}RecipeId=?, ${slot}Title=?, ${slot}UseLeftovers=?, ${slot}From=?
      WHERE Date=?
    `).run(recipeId, title, useLeftovers, from, date);
  } else if (schema.hasLegacy) {
    const mealJson = mealToJson_({ RecipeId: recipeId, Title: title, UseLeftovers: useLeftovers, From: from });
    db().prepare(`UPDATE plans SET ${slot}=? WHERE Date=?`).run(mealJson, date);
  }

  return ok_({});
}

function swapPlanMeals(payload) {
  const date1 = String(payload && payload.date1 || '').trim();
  const slot1 = String(payload && payload.slot1 || '').trim();
  const date2 = String(payload && payload.date2 || '').trim();
  const slot2 = String(payload && payload.slot2 || '').trim();

  if (!date1 || !slot1 || !date2 || !slot2) return err_('All date/slot parameters required.');

  // Phase 4.5.7: Check if user_plan_meals table exists (multi-user system)
  const tableExists = db().prepare(`
    SELECT name FROM sqlite_master WHERE type='table' AND name='user_plan_meals'
  `).get();

  if (tableExists) {
    // Multi-user swap: Get active user and swap their meals only
    const activeUser = getActiveUser();
    if (!activeUser.ok || !activeUser.userId) {
      return err_('No active user set');
    }
    const userId = activeUser.userId;

    // Get all meals for slot1 (for this user)
    const meals1 = db().prepare(`
      SELECT id, user_id, recipe_id, title, use_leftovers, from_meal, apple_event_id, google_event_id, sort_order
      FROM user_plan_meals
      WHERE user_id = ? AND date = ? AND slot = ?
      ORDER BY sort_order ASC, id ASC
    `).all(userId, date1, slot1);

    // Get all meals for slot2 (for this user)
    const meals2 = db().prepare(`
      SELECT id, user_id, recipe_id, title, use_leftovers, from_meal, apple_event_id, google_event_id, sort_order
      FROM user_plan_meals
      WHERE user_id = ? AND date = ? AND slot = ?
      ORDER BY sort_order ASC, id ASC
    `).all(userId, date2, slot2);

    // Delete both slots first (to avoid conflicts)
    db().prepare(`DELETE FROM user_plan_meals WHERE user_id = ? AND date = ? AND slot = ?`).run(userId, date1, slot1);
    db().prepare(`DELETE FROM user_plan_meals WHERE user_id = ? AND date = ? AND slot = ?`).run(userId, date2, slot2);

    // Insert slot2 meals into slot1 position
    for (const meal of meals2) {
      db().prepare(`
        INSERT INTO user_plan_meals 
        (user_id, date, slot, recipe_id, title, use_leftovers, from_meal, apple_event_id, google_event_id, sort_order, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, '', '', ?, datetime('now'), datetime('now'))
      `).run(
        userId,
        date1,
        slot1,
        meal.recipe_id || '',
        meal.title,
        meal.use_leftovers || 0,
        meal.from_meal || '',
        meal.sort_order || 0
      );
    }

    // Insert slot1 meals into slot2 position
    for (const meal of meals1) {
      db().prepare(`
        INSERT INTO user_plan_meals 
        (user_id, date, slot, recipe_id, title, use_leftovers, from_meal, apple_event_id, google_event_id, sort_order, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, '', '', ?, datetime('now'), datetime('now'))
      `).run(
        userId,
        date2,
        slot2,
        meal.recipe_id || '',
        meal.title,
        meal.use_leftovers || 0,
        meal.from_meal || '',
        meal.sort_order || 0
      );
    }

    return ok_({ swappedCount: Math.max(meals1.length, meals2.length) });
  }

  // Fallback to old plans table (legacy support)
  const schema = plansSchema_();

  let meal1, meal2;

  if (schema.hasNew) {
    const p1 = db().prepare(`SELECT ${slot1}RecipeId, ${slot1}Title, ${slot1}UseLeftovers, ${slot1}From FROM plans WHERE Date=?`).get(date1);
    const p2 = db().prepare(`SELECT ${slot2}RecipeId, ${slot2}Title, ${slot2}UseLeftovers, ${slot2}From FROM plans WHERE Date=?`).get(date2);

    meal1 = p1 && p1[`${slot1}Title`] ? {
      RecipeId: p1[`${slot1}RecipeId`] || '',
      Title: p1[`${slot1}Title`],
      UseLeftovers: p1[`${slot1}UseLeftovers`] ? true : false,
      From: p1[`${slot1}From`] || ''
    } : null;

    meal2 = p2 && p2[`${slot2}Title`] ? {
      RecipeId: p2[`${slot2}RecipeId`] || '',
      Title: p2[`${slot2}Title`],
      UseLeftovers: p2[`${slot2}UseLeftovers`] ? true : false,
      From: p2[`${slot2}From`] || ''
    } : null;

  } else if (schema.hasLegacy) {
    const p1 = db().prepare(`SELECT ${slot1} FROM plans WHERE Date=?`).get(date1);
    const p2 = db().prepare(`SELECT ${slot2} FROM plans WHERE Date=?`).get(date2);

    meal1 = p1 ? parseMealJson_(p1[slot1]) : null;
    meal2 = p2 ? parseMealJson_(p2[slot2]) : null;
  }

  // Write swapped meals
  upsertPlanMeal({ date: date1, slot: slot1, meal: meal2 });
  upsertPlanMeal({ date: date2, slot: slot2, meal: meal1 });

  return ok_({});
}

function clearMealsByRange(payload) {
  const start = String(payload && payload.start || '').trim();
  const end = String(payload && payload.end || '').trim();
  const userId = payload && payload.userId; // Can be a number, "all", or undefined

  if (!start || !end) return err_('start and end date required.');

  console.log(`[clearMealsByRange] start: ${start}, end: ${end}, userId: ${userId}`);

  const schema = plansSchema_();

  // Phase 4.5.7: Check if user_plan_meals table exists (multi-user system)
  const userTableExists = db().prepare(`
    SELECT name FROM sqlite_master WHERE type='table' AND name='user_plan_meals'
  `).get();

  if (userTableExists) {
    if (userId === 'all') {
      // Clear for ALL users
      console.log('[clearMealsByRange] Clearing for ALL users');
      const result = db().prepare(`
        DELETE FROM user_plan_meals
        WHERE date >= ? AND date <= ?
      `).run(start, end);
      console.log(`[clearMealsByRange] Deleted ${result.changes} rows from user_plan_meals`);
    } else {
      // Get target user (either passed in or active)
      let targetUserId = userId;
      if (!targetUserId) {
        const activeUser = getActiveUser();
        console.log('[clearMealsByRange] getActiveUser result:', activeUser);
        if (activeUser.ok && activeUser.userId) {
          targetUserId = activeUser.userId;
        }
      }

      console.log(`[clearMealsByRange] Target user ID: ${targetUserId}`);

      if (targetUserId) {
        // Check what meals exist for this user in this range
        const existingMeals = db().prepare(`
          SELECT COUNT(*) as count FROM user_plan_meals
          WHERE user_id = ? AND date >= ? AND date <= ?
        `).get(targetUserId, start, end);
        console.log(`[clearMealsByRange] Found ${existingMeals.count} meals for user ${targetUserId}`);

        const result = db().prepare(`
          DELETE FROM user_plan_meals
          WHERE user_id = ? AND date >= ? AND date <= ?
        `).run(targetUserId, start, end);
        console.log(`[clearMealsByRange] Deleted ${result.changes} rows from user_plan_meals`);
      } else {
        console.warn('[clearMealsByRange] No target user ID found!');
      }
    }
  }

  // Also clear old plans table for backward compatibility
  // Note: old plans table is naturally "all users" as it didn't support users
  if (schema.hasNew) {
    db().prepare(`
      UPDATE plans SET
        BreakfastRecipeId=NULL, BreakfastTitle=NULL, BreakfastUseLeftovers=0, BreakfastFrom='', BreakfastEventId='',
        LunchRecipeId=NULL, LunchTitle=NULL, LunchUseLeftovers=0, LunchFrom='', LunchEventId='',
        DinnerRecipeId=NULL, DinnerTitle=NULL, DinnerUseLeftovers=0, DinnerFrom='', DinnerEventId=''
      WHERE Date >= ? AND Date <= ?
    `).run(start, end);
  } else if (schema.hasLegacy) {
    db().prepare(`UPDATE plans SET Breakfast=NULL, Lunch=NULL, Dinner=NULL, Calendar=NULL WHERE Date >= ? AND Date <= ?`).run(start, end);
  }

  return ok_({ message: userId === 'all' ? 'Meals cleared for all users.' : 'Meals cleared for selected user.' });
}

// ================= MULTI-USER MEAL PLANS (Phase 4.5.7) =================

/**
 * Get meal plans for a specific user in a date range.
 * Implements fallback logic: if user has no meals for a date/slot, fallback to Whole Family meals.
 * For Whole Family user, aggregates ALL user meals.
 */
function getUserPlanMeals(payload) {
  const start = String(payload && payload.start || '').trim();
  const end = String(payload && payload.end || '').trim();
  let userId = String(payload && payload.userId || '').trim();

  if (!start || !end) return err_('start and end date required.');

  // If no userId provided, use active user
  if (!userId) {
    const activeUser = getActiveUser();
    if (!activeUser.ok || !activeUser.userId) {
      return err_('No active user set');
    }
    userId = activeUser.userId;
  }

  // Check if user exists and get Whole Family ID
  const user = db().prepare("SELECT user_id, name FROM users WHERE user_id = ?").get(userId);
  if (!user) return err_('User not found');

  const wholeFamilyUser = db().prepare("SELECT user_id FROM users WHERE name = 'Whole Family'").get();
  const wholeFamilyId = wholeFamilyUser ? wholeFamilyUser.user_id : null;
  const isWholeFamilyView = (userId === wholeFamilyId);

  // Check if user_plan_meals table exists
  const tableExists = db().prepare(`
    SELECT name FROM sqlite_master WHERE type='table' AND name='user_plan_meals'
  `).get();

  if (!tableExists) {
    // Fallback to old plans table if new table doesn't exist yet
    console.log('[getUserPlanMeals] user_plan_meals table not found, falling back to getPlansRange');
    return getPlansRange({ start, end });
  }

  let meals;

  if (isWholeFamilyView) {
    // Whole Family view: aggregate ALL user meals
    meals = db().prepare(`
      SELECT 
        upm.id,
        upm.user_id,
        u.name as user_name,
        upm.date,
        upm.slot,
        upm.recipe_id,
        upm.title,
        upm.use_leftovers,
        upm.from_meal,
        upm.apple_event_id,
        upm.google_event_id,
        upm.sort_order,
        upm.created_at,
        upm.updated_at,
        r.Image_Name
      FROM user_plan_meals upm
      LEFT JOIN users u ON upm.user_id = u.user_id
      LEFT JOIN recipes r ON upm.recipe_id = r.RecipeId
      WHERE upm.date >= ? AND upm.date <= ?
      ORDER BY upm.date ASC, upm.slot ASC, upm.sort_order ASC, upm.created_at ASC
    `).all(start, end);
  } else {
    // Individual user view: ONLY user's own meals (no fallback)
    meals = db().prepare(`
      SELECT 
        upm.id,
        upm.user_id,
        u.name as user_name,
        upm.date,
        upm.slot,
        upm.recipe_id,
        upm.title,
        upm.use_leftovers,
        upm.from_meal,
        upm.apple_event_id,
        upm.google_event_id,
        upm.sort_order,
        upm.created_at,
        upm.updated_at,
        r.Image_Name,
        0 as is_fallback
      FROM user_plan_meals upm
      LEFT JOIN users u ON upm.user_id = u.user_id
      LEFT JOIN recipes r ON upm.recipe_id = r.RecipeId
      WHERE upm.date >= ? AND upm.date <= ?
        AND upm.user_id = ?
      ORDER BY upm.date ASC, upm.slot ASC, upm.sort_order ASC, upm.created_at ASC
    `).all(start, end, userId);
  }

  // Group meals by date and slot
  const plansByDate = new Map();

  for (const meal of meals) {
    const date = meal.date;
    if (!plansByDate.has(date)) {
      plansByDate.set(date, {
        Date: date,
        Breakfast: [],
        Lunch: [],
        Dinner: []
      });
    }

    const plan = plansByDate.get(date);
    const slot = meal.slot;

    if (slot !== 'Breakfast' && slot !== 'Lunch' && slot !== 'Dinner') {
      console.warn(`[getUserPlanMeals] Invalid slot '${slot}' for meal ID ${meal.id}`);
      continue;
    }

    plan[slot].push({
      id: meal.id,
      userId: meal.user_id,
      userName: meal.user_name || '',
      RecipeId: meal.recipe_id || '',
      Title: meal.title || '',
      Image_Name: meal.Image_Name || '',
      UseLeftovers: meal.use_leftovers ? 1 : 0,
      From: meal.from_meal || '',
      AppleEventId: meal.apple_event_id || '',
      GoogleEventId: meal.google_event_id || '',
      SortOrder: meal.sort_order || 0,
      IsFallback: meal.is_fallback || false,
      CreatedAt: meal.created_at,
      UpdatedAt: meal.updated_at
    });
  }

  // Convert map to array and fill empty dates
  const plans = [];
  const startDate = new Date(start);
  const endDate = new Date(end);

  for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
    const dateStr = d.toISOString().split('T')[0];
    const plan = plansByDate.get(dateStr) || {
      Date: dateStr,
      Breakfast: [],
      Lunch: [],
      Dinner: []
    };
    plans.push(plan);
  }

  return ok_({ plans, userId, isWholeFamilyView });
}

/**
 * Create or update a user meal in the user_plan_meals table.
 */
function upsertUserPlanMeal(payload) {
  const userId = String(payload && payload.userId || '').trim();
  const date = String(payload && payload.date || '').trim();
  const slot = String(payload && payload.slot || '').trim();
  const meal = (payload && payload.meal) || null;

  if (!userId) return err_('userId required.');
  if (!date) return err_('date required.');
  if (slot !== 'Breakfast' && slot !== 'Lunch' && slot !== 'Dinner') {
    return err_('slot must be Breakfast, Lunch, or Dinner.');
  }

  // Verify user exists
  const user = db().prepare("SELECT user_id FROM users WHERE user_id = ?").get(userId);
  if (!user) return err_('User not found');

  // Check if table exists
  const tableExists = db().prepare(`
    SELECT name FROM sqlite_master WHERE type='table' AND name='user_plan_meals'
  `).get();

  if (!tableExists) {
    return err_('user_plan_meals table not found. Run migration first.');
  }

  if (meal === null) {
    // Clear all meals for this user/date/slot
    db().prepare(`
      DELETE FROM user_plan_meals 
      WHERE user_id = ? AND date = ? AND slot = ?
    `).run(userId, date, slot);
    return ok_({});
  }

  const recipeId = String(meal.RecipeId || '').trim() || null;
  const title = String(meal.Title || '').trim();
  const useLeftovers = meal.UseLeftovers ? 1 : 0;
  const fromMeal = String(meal.From || '').trim() || null;
  const appleEventId = String(meal.AppleEventId || '').trim() || null;
  const googleEventId = String(meal.GoogleEventId || '').trim() || null;
  const sortOrder = Number(meal.SortOrder || 0);
  const mealId = meal.id ? Number(meal.id) : null;

  if (!title) return err_('meal must have a Title.');

  // Verify recipe exists if recipeId provided
  if (recipeId) {
    const recipe = db().prepare("SELECT RecipeId FROM recipes WHERE RecipeId = ?").get(recipeId);
    if (!recipe) return err_('Recipe not found');
  }

  if (mealId) {
    // Update existing meal by ID
    db().prepare(`
      UPDATE user_plan_meals
      SET recipe_id = ?,
          title = ?,
          use_leftovers = ?,
          from_meal = ?,
          apple_event_id = ?,
          google_event_id = ?,
          sort_order = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND user_id = ?
    `).run(recipeId, title, useLeftovers, fromMeal, appleEventId, googleEventId, sortOrder, mealId, userId);

    return ok_({ id: mealId });
  } else {
    // Check if user already has a meal in this slot (to replace instead of adding)
    const existing = db().prepare(`
      SELECT id FROM user_plan_meals
      WHERE user_id = ? AND date = ? AND slot = ?
      ORDER BY sort_order ASC, id ASC
      LIMIT 1
    `).get(userId, date, slot);

    if (existing) {
      // Replace the first existing meal (upsert behavior)
      db().prepare(`
        UPDATE user_plan_meals
        SET recipe_id = ?,
            title = ?,
            use_leftovers = ?,
            from_meal = ?,
            apple_event_id = ?,
            google_event_id = ?,
            sort_order = ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ? AND user_id = ?
      `).run(recipeId, title, useLeftovers, fromMeal, appleEventId, googleEventId, sortOrder, existing.id, userId);

      return ok_({ id: existing.id, replaced: true });
    } else {
      // Insert new meal (first meal in this slot)
      const result = db().prepare(`
        INSERT INTO user_plan_meals (
          user_id, date, slot, recipe_id, title, use_leftovers, 
          from_meal, apple_event_id, google_event_id, sort_order
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(userId, date, slot, recipeId, title, useLeftovers, fromMeal, appleEventId, googleEventId, sortOrder);

      return ok_({ id: result.lastInsertRowid });
    }
  }
}

/**
 * Delete a specific user meal by ID.
 */
function deleteUserPlanMeal(payload) {
  const mealId = Number(payload && payload.mealId);
  const userId = String(payload && payload.userId || '').trim();

  if (!mealId) return err_('mealId required.');

  // Check if table exists
  const tableExists = db().prepare(`
    SELECT name FROM sqlite_master WHERE type='table' AND name='user_plan_meals'
  `).get();

  if (!tableExists) {
    return err_('user_plan_meals table not found. Run migration first.');
  }

  // Get meal details before deleting (for calendar cleanup)
  const meal = db().prepare(`
    SELECT id, user_id, date, slot, apple_event_id, google_event_id 
    FROM user_plan_meals 
    WHERE id = ?
  `).get(mealId);

  if (!meal) return err_('Meal not found');

  // If userId provided, verify it matches (security check)
  if (userId && meal.user_id !== userId) {
    return err_('Meal does not belong to specified user');
  }

  // Delete the meal
  db().prepare("DELETE FROM user_plan_meals WHERE id = ?").run(mealId);

  // Return deleted meal info for calendar cleanup
  return ok_({
    deleted: true,
    meal: {
      id: meal.id,
      userId: meal.user_id,
      date: meal.date,
      slot: meal.slot,
      appleEventId: meal.apple_event_id,
      googleEventId: meal.google_event_id
    }
  });
}

// ================= SHOPPING LIST =================
function buildShoppingList(payload) {
  const start = String(payload && payload.start || '').trim();
  const end = String(payload && payload.end || '').trim();
  let userId = String(payload && payload.userId || '').trim();

  if (!start || !end) return err_('start and end date required.');

  // Get active user if not specified
  if (!userId) {
    const activeUser = getActiveUser();
    if (activeUser.ok && activeUser.userId) {
      userId = activeUser.userId;
    }
  }

  const recipeIds = new Set();

  // Check if user_plan_meals table exists (new multi-user system)
  const userPlanMealsExists = db().prepare(`
    SELECT name FROM sqlite_master WHERE type='table' AND name='user_plan_meals'
  `).get();

  if (userPlanMealsExists && userId) {
    // Use new multi-user system
    const wholeFamilyUser = db().prepare("SELECT user_id FROM users WHERE name = 'Whole Family'").get();
    const wholeFamilyId = wholeFamilyUser ? wholeFamilyUser.user_id : null;
    const isWholeFamilyView = (userId === wholeFamilyId);

    let meals;
    if (isWholeFamilyView) {
      // Whole Family: get ONLY recipes assigned to the Whole Family user
      meals = db().prepare(`
        SELECT DISTINCT recipe_id
        FROM user_plan_meals
        WHERE date >= ? AND date <= ? AND recipe_id IS NOT NULL
          AND user_id = ?
      `).all(start, end, wholeFamilyId);
    } else {
      // Individual user: get ONLY user's own recipes (no fallback)
      meals = db().prepare(`
        SELECT DISTINCT recipe_id
        FROM user_plan_meals
        WHERE date >= ? AND date <= ? AND recipe_id IS NOT NULL
          AND user_id = ?
      `).all(start, end, userId);
    }

    for (const meal of meals) {
      if (meal.recipe_id) recipeIds.add(String(meal.recipe_id));
    }
  } else {
    // Fallback to old plans table
    const schema = plansSchema_();

    let plans;
    if (schema.hasNew) {
      plans = db().prepare(`
        SELECT Date, BreakfastRecipeId, LunchRecipeId, DinnerRecipeId
        FROM plans WHERE Date >= ? AND Date <= ? ORDER BY Date ASC
      `).all(start, end);
    } else if (schema.hasLegacy) {
      plans = db().prepare(`
        SELECT Date, Breakfast, Lunch, Dinner
        FROM plans WHERE Date >= ? AND Date <= ? ORDER BY Date ASC
      `).all(start, end);
    } else {
      plans = [];
    }

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
  }

  // Collect additional items from plan_additional_items table
  try {
    const additionalItemsStmt = db().prepare(`
      SELECT DISTINCT RecipeId 
      FROM plan_additional_items 
      WHERE Date >= ? AND Date <= ?
    `);
    const additionalRows = additionalItemsStmt.all(start, end);
    for (const row of additionalRows) {
      if (row.RecipeId) recipeIds.add(String(row.RecipeId));
    }
  } catch (e) {
    // Table might not exist in older databases, silently skip
    console.log('[buildShoppingList] No plan_additional_items table, skipping additional items');
  }

  if (!recipeIds.size) return ok_({ groups: [] });

  const ingRows = db().prepare(`
    SELECT RecipeId, idx, IngredientNorm, IngredientRaw, QtyNum, QtyText, Unit, StoreId, Category
    FROM ingredients
    WHERE RecipeId IN (${Array.from(recipeIds).map(() => '?').join(',')})
    ORDER BY IngredientNorm ASC
  `).all(...recipeIds);

  const map = new Map();


  for (const r of ingRows) {
    // Legacy generic normalization (just lowercase)
    const legacyNorm = normLower_(r.IngredientNorm || r.IngredientRaw || '');
    if (!legacyNorm) continue;

    // Advanced Normalization for Grouping
    // "Extra Virgin Olive Oil" -> "olive oil"
    const canonicalKey = getCanonicalKey(legacyNorm);

    const cur = map.get(canonicalKey);
    if (!cur) {
      map.set(canonicalKey, {
        IngredientNorm: canonicalKey, // Use the shared canonical name as 'Display Name' base
        DisplayTitle: r.IngredientNorm, // Keep first seen name as display fallback
        OriginalNames: [r.IngredientNorm], // Track variations
        IngredientRaw: r.IngredientRaw,
        QtyNum: (r.QtyNum !== null && r.QtyNum !== undefined) ? Number(r.QtyNum) : null,
        QtyText: r.QtyText || '',
        Unit: r.Unit || '',
        StoreId: r.StoreId || '',
        Category: r.Category || '',
        Count: 1,
        IsMerged: false,
        // Track source IDs for editing/updates
        SourceIds: [{ rid: r.RecipeId, idx: r.idx }]
      });
    } else {
      // Merge logic
      const curQty = (cur.QtyNum !== null && Number.isFinite(cur.QtyNum)) ? Number(cur.QtyNum) : null;
      const newQty = (r.QtyNum !== null && r.QtyNum !== undefined) ? Number(r.QtyNum) : null;
      const curUnit = canonicalUnit(cur.Unit);
      const newUnit = canonicalUnit(r.Unit);

      // Try to combine quantities with unit conversion
      if (curQty !== null && newQty !== null && curUnit && newUnit) {
        if (curUnit === newUnit) {
          // Same units - direct addition
          cur.QtyNum = curQty + newQty;
          cur.QtyText = formatQty_(cur.QtyNum, cur.Unit);
        } else {
          // Try unit conversion
          const converted = convertQty_(newQty, newUnit, curUnit);
          if (converted.ok && converted.qty !== null) {
            // Successful conversion - add in cur's unit
            cur.QtyNum = curQty + converted.qty;
            cur.QtyText = formatQty_(cur.QtyNum, cur.Unit);
          } else {
            // Incompatible units - append text
            const newQtyText = r.QtyText || formatQty_(newQty, r.Unit);
            cur.QtyText = `${cur.QtyText} + ${newQtyText}`;
            cur.QtyNum = null; // Can't sum numeric values with incompatible units
          }
        }
      } else if (curQty === null && newQty !== null) {
        // Current has no qty, use new
        cur.QtyNum = newQty;
        cur.Unit = r.Unit || cur.Unit;
        cur.QtyText = formatQty_(newQty, cur.Unit);
      } else if (cur.QtyText && (r.QtyText || newQty !== null)) {
        // Fall back to text concatenation
        const newQtyText = r.QtyText || (newQty !== null ? formatQty_(newQty, r.Unit) : '');
        if (newQtyText) {
          cur.QtyText = `${cur.QtyText} + ${newQtyText}`;
        }
      }

      cur.OriginalNames.push(r.IngredientNorm);
      if (r.RecipeId !== undefined && r.idx !== undefined) {
        cur.SourceIds.push({ rid: r.RecipeId, idx: r.idx });
      }

      cur.IsMerged = true;
      cur.Count++;
    }
  }

  const items = Array.from(map.values());

  // Group by store
  const storeGroups = {};

  for (const it of items) {
    const storeId = it.StoreId || '';
    if (!storeGroups[storeId]) {
      storeGroups[storeId] = {
        StoreId: storeId,
        Items: []
      };
    }
    storeGroups[storeId].Items.push({
      Category: it.Category || 'Other',
      IngredientNorm: it.IngredientNorm || '',
      QtyNum: it.QtyNum,
      QtyText: it.QtyText || '',
      Unit: it.Unit || '',
      Examples: [it.IngredientRaw || it.IngredientNorm || ''],
      IsMerged: it.IsMerged || false,
      OriginalNames: it.OriginalNames || [],
      SourceIds: it.SourceIds || [],
      Count: it.Count || 1
    });
  }

  const groups = Object.values(storeGroups);

  // NEW: Auto-deduct from pantry and track warnings
  const pantryWarnings = [];
  const pantryDeductions = [];

  for (const group of groups) {
    for (const item of group.Items) {
      const ingredientLower = normLower_(item.IngredientNorm);
      const requiredQty = item.QtyNum;
      const unit = canonicalUnit(item.Unit);

      if (!ingredientLower || !requiredQty || !Number.isFinite(requiredQty) || requiredQty <= 0 || !unit) {
        continue;
      }

      // Try to deduct from pantry
      const deducted = _deductFromPantry_(ingredientLower, requiredQty, unit);

      if (deducted > 0) {
        pantryDeductions.push({
          ingredient: ingredientLower,
          deducted: deducted,
          unit: unit,
          originalQty: requiredQty
        });

        // Update the shopping list item to show NET amount needed
        const netQty = requiredQty - deducted;
        if (netQty <= 0) {
          // Fully covered by pantry - mark item
          item.QtyNum = 0;
          item.QtyText = '✓ From Pantry';
          item.FromPantry = true;
        } else {
          // Partially covered
          item.QtyNum = netQty;
          item.QtyText = `${netQty} ${unit} (${deducted} from pantry)`;
          item.PartialPantry = true;
        }
      }
    }
  }

  // Check for low stock warnings AFTER deductions
  const hasQtyNum = pantryHasCol_('QtyNum');
  const hasLowStockThreshold = pantryHasCol_('low_stock_threshold');

  if (hasQtyNum && hasLowStockThreshold) {
    const lowStockRows = db().prepare(`
      SELECT Name, QtyNum, low_stock_threshold, Unit
      FROM pantry
      WHERE low_stock_threshold IS NOT NULL 
        AND low_stock_threshold > 0
        AND QtyNum IS NOT NULL 
        AND QtyNum <= low_stock_threshold
      ORDER BY Name ASC
    `).all();

    for (const row of lowStockRows) {
      pantryWarnings.push({
        name: row.Name,
        current: row.QtyNum,
        threshold: row.low_stock_threshold,
        unit: row.Unit || '',
        message: `${row.Name}: ${row.QtyNum} ${row.Unit || ''} (threshold: ${row.low_stock_threshold})`
      });
    }
  }

  return ok_({
    groups,
    pantryDeductions,
    pantryWarnings,
    deductionsApplied: pantryDeductions.length > 0
  });
}

function assignShoppingItemStore(payload) {
  const ingredientNorm = normLower_((payload && payload.ingredientNorm) || '');
  const storeId = String(payload && payload.storeId || '').trim();
  const sourceIds = Array.isArray(payload && payload.sourceIds) ? payload.sourceIds : [];
  
  if (!ingredientNorm && sourceIds.length === 0) return err_('ingredientNorm or sourceIds required.');

  let updatedCount = 0;

  // If we have sourceIds, use them to update specific recipe ingredients
  if (sourceIds.length > 0) {
    const stmt = db().prepare("UPDATE ingredients SET StoreId=? WHERE RecipeId=? AND idx=?");
    for (const src of sourceIds) {
      if (src.rid && src.idx !== undefined) {
        stmt.run(storeId, src.rid, src.idx);
        updatedCount++;
      }
    }
  } else {
    // Fallback: update by ingredient name (legacy behavior)
    const result = db().prepare("UPDATE ingredients SET StoreId=? WHERE lower(IngredientNorm)=?").run(storeId, ingredientNorm);
    updatedCount = result.changes;
  }

  return ok_({ updated: updatedCount });
}

// Add item back to pantry (when removed from shopping list or not purchased)
function returnItemToPantry(payload) {
  const ingredientNorm = String(payload && payload.ingredientNorm || '').trim().toLowerCase();
  const qty = Number(payload && payload.qty || 0);
  const unit = String(payload && payload.unit || '').trim();

  if (!ingredientNorm || !qty || qty <= 0) {
    return err_('ingredientNorm and qty required.');
  }

  const baseUnit = canonicalUnit(unit);
  if (!baseUnit) {
    return err_('Invalid unit.');
  }

  _addBackToPantry_(ingredientNorm, qty, baseUnit);

  return ok_({
    ingredient: ingredientNorm,
    returned: qty,
    unit: baseUnit
  });
}

// Mark shopping list item as purchased (for companion app sync)
function markShoppingItemPurchased(payload) {
  const ingredientNorm = String(payload && payload.ingredientNorm || '').trim().toLowerCase();
  const purchased = Boolean(payload && payload.purchased);

  if (!ingredientNorm) {
    return err_('ingredientNorm required.');
  }

  // If marking as NOT purchased, we need to add back to pantry
  if (!purchased && payload.qty && payload.unit) {
    const qty = Number(payload.qty);
    const unit = String(payload.unit).trim();
    if (qty > 0 && unit) {
      _addBackToPantry_(ingredientNorm, qty, canonicalUnit(unit));
    }
  }

  return ok_({
    ingredient: ingredientNorm,
    purchased,
    pantryRestored: !purchased
  });
}

function addShoppingItem(payload) {
  const { itemId, ingredientName, qtyText, category, storeId, recipeId, isPurchased, isManuallyAdded } = payload;
  if (!itemId || !ingredientName) return err_('itemId and ingredientName required');

  db().prepare(`
    INSERT INTO shopping_list (ItemId, IngredientName, QtyText, Category, StoreId, RecipeId, IsPurchased, IsManuallyAdded, UpdatedAt)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
  `).run(itemId, ingredientName, qtyText || '', category || '', storeId || '', recipeId || '', isPurchased ? 1 : 0, isManuallyAdded ? 1 : 0);

  return ok_({ itemId });
}

function updateShoppingItem(payload) {
  const { itemId, isPurchased } = payload;
  if (!itemId) return err_('itemId required');

  db().prepare(`
    UPDATE shopping_list SET IsPurchased = ?, UpdatedAt = datetime('now') WHERE ItemId = ?
  `).run(isPurchased ? 1 : 0, itemId);

  return ok_({ itemId });
}

function deleteShoppingItem(payload) {
  const { itemId } = payload;
  if (!itemId) return err_('itemId required');

  db().prepare(`DELETE FROM shopping_list WHERE ItemId = ?`).run(itemId);
  return ok_({ itemId });
}

// ================= PANTRY =================
function listPantry(payload) {
  const q = normLower_((payload && payload.q) || '');
  const hasQtyNum = pantryHasCol_('QtyNum');
  const hasUnit = pantryHasCol_('Unit');
  const hasExpirationDate = pantryHasCol_('expiration_date');
  const hasLowStockThreshold = pantryHasCol_('low_stock_threshold');
  const hasCategory = pantryHasCol_('Category');

  const cols = ['ItemId', 'Name', 'NameLower', 'QtyText', 'StoreId', 'Notes', 'UpdatedAt'];
  if (hasQtyNum) cols.push('QtyNum');
  if (hasUnit) cols.push('Unit');
  if (hasExpirationDate) cols.push('expiration_date');
  if (hasLowStockThreshold) cols.push('low_stock_threshold');
  if (hasCategory) cols.push('Category');

  let rows;
  if (q) {
    rows = db().prepare(`
      SELECT ${cols.join(', ')} FROM pantry
      WHERE NameLower >= ? AND NameLower < ?
      ORDER BY NameLower ASC, ItemId ASC
    `).all(q, q + '\uf8ff');
  } else {
    rows = db().prepare(`SELECT ${cols.join(', ')} FROM pantry ORDER BY NameLower ASC, ItemId ASC`).all();
  }

  const items = rows.map(r => {
    const obj = {
      ItemId: r.ItemId,
      Name: r.Name,
      NameLower: r.NameLower,
      QtyText: r.QtyText || '',
      StoreId: r.StoreId || '',
      Notes: r.Notes || '',
      UpdatedAt: r.UpdatedAt
    };
    if (hasQtyNum) obj.QtyNum = (r.QtyNum !== null && r.QtyNum !== undefined) ? r.QtyNum : null;
    if (hasUnit) obj.Unit = r.Unit || '';
    if (hasExpirationDate) obj.expiration_date = r.expiration_date || '';
    if (hasLowStockThreshold) obj.low_stock_threshold = (r.low_stock_threshold !== null && r.low_stock_threshold !== undefined) ? r.low_stock_threshold : null;
    if (hasCategory) obj.Category = r.Category || '';
    return obj;
  });

  return ok_({ items });
}

function upsertPantryItem(payload) {
  const itemId = String(payload && (payload.itemId || payload.ItemId) || '').trim() || uuidShort_('pan');
  const name = String(payload && (payload.name || payload.Name) || '').trim();
  if (!name) return err_('name required.');

  const nameLower = normLower_(name);
  const qtyText = String(payload && (payload.qtyText || payload.QtyText) || '').trim();
  const storeId = String(payload && (payload.storeId || payload.StoreId) || '').trim();
  const notes = String(payload && (payload.notes || payload.Notes) || '');
  const category = String(payload && (payload.category || payload.Category) || '').trim();

  const hasQtyNum = pantryHasCol_('QtyNum');
  const hasUnit = pantryHasCol_('Unit');
  const hasExpirationDate = pantryHasCol_('expiration_date');
  const hasLowStockThreshold = pantryHasCol_('low_stock_threshold');
  const hasCategory = pantryHasCol_('Category');

  const qtyNum = (payload && (payload.qtyNum !== null && payload.qtyNum !== undefined) ? Number(payload.qtyNum) :
    (payload.QtyNum !== null && payload.QtyNum !== undefined) ? Number(payload.QtyNum) : null);
  const unit = String(payload && (payload.unit || payload.Unit) || '').trim();
  const expirationDate = String(payload && payload.expiration_date || '').trim();
  const lowStockThreshold = (payload && payload.low_stock_threshold !== null && payload.low_stock_threshold !== undefined && payload.low_stock_threshold !== '') ? Number(payload.low_stock_threshold) : null;

  if (hasQtyNum && hasUnit && hasExpirationDate && hasLowStockThreshold && hasCategory) {
    db().prepare(`
      INSERT INTO pantry(ItemId, Name, NameLower, QtyText, QtyNum, Unit, StoreId, Notes, expiration_date, low_stock_threshold, Category, UpdatedAt)
      VALUES(?,?,?,?,?,?,?,?,?,?,?,datetime('now'))
      ON CONFLICT(ItemId) DO UPDATE SET
        Name=excluded.Name,
        NameLower=excluded.NameLower,
        QtyText=excluded.QtyText,
        QtyNum=excluded.QtyNum,
        Unit=excluded.Unit,
        StoreId=excluded.StoreId,
        Notes=excluded.Notes,
        expiration_date=excluded.expiration_date,
        low_stock_threshold=excluded.low_stock_threshold,
        Category=excluded.Category,
        UpdatedAt=excluded.UpdatedAt
    `).run(itemId, name, nameLower, qtyText, qtyNum, unit, storeId, notes, expirationDate, lowStockThreshold, category);
  } else if (hasQtyNum && hasUnit && hasCategory) {
    db().prepare(`
      INSERT INTO pantry(ItemId, Name, NameLower, QtyText, QtyNum, Unit, StoreId, Notes, Category, UpdatedAt)
      VALUES(?,?,?,?,?,?,?,?,?,datetime('now'))
      ON CONFLICT(ItemId) DO UPDATE SET
        Name=excluded.Name,
        NameLower=excluded.NameLower,
        QtyText=excluded.QtyText,
        QtyNum=excluded.QtyNum,
        Unit=excluded.Unit,
        StoreId=excluded.StoreId,
        Notes=excluded.Notes,
        Category=excluded.Category,
        UpdatedAt=excluded.UpdatedAt
    `).run(itemId, name, nameLower, qtyText, qtyNum, unit, storeId, notes, category);
  } else if (hasQtyNum && hasUnit) {
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
    `).run(itemId, name, nameLower, qtyText, qtyNum, unit, storeId, notes);
  } else if (hasCategory) {
    db().prepare(`
      INSERT INTO pantry(ItemId, Name, NameLower, QtyText, StoreId, Notes, Category, UpdatedAt)
      VALUES(?,?,?,?,?,?,?,datetime('now'))
      ON CONFLICT(ItemId) DO UPDATE SET
        Name=excluded.Name,
        NameLower=excluded.NameLower,
        QtyText=excluded.QtyText,
        StoreId=excluded.StoreId,
        Notes=excluded.Notes,
        Category=excluded.Category,
        UpdatedAt=excluded.UpdatedAt
    `).run(itemId, name, nameLower, qtyText, storeId, notes, category);
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
    `).run(itemId, name, nameLower, qtyText, storeId, notes);
  }

  return ok_({ ItemId: itemId });
}

function deletePantryItem(payload) {
  const itemId = String(payload && payload.itemId || '').trim();
  if (!itemId) return err_('itemId required.');
  db().prepare("DELETE FROM pantry WHERE ItemId=?").run(itemId);
  return ok_({});
}

function getExpiringPantryItems(payload) {
  const days = clamp_(payload && payload.days || 7, 1, 90);
  const hasExpirationDate = pantryHasCol_('expiration_date');
  if (!hasExpirationDate) return ok_({ items: [] });

  const today = ymd_(new Date());
  const cutoff = addDays_(today, days);

  const rows = db().prepare(`
    SELECT ItemId, Name, QtyText, StoreId, expiration_date
    FROM pantry
    WHERE expiration_date IS NOT NULL AND expiration_date != '' AND expiration_date <= ?
    ORDER BY expiration_date ASC
  `).all(cutoff);

  return ok_({
    items: rows.map(r => ({
      ItemId: r.ItemId,
      Name: r.Name,
      QtyText: r.QtyText || '',
      StoreId: r.StoreId || '',
      expiration_date: r.expiration_date
    }))
  });
}

function getLowStockPantryItems(payload) {
  const hasQtyNum = pantryHasCol_('QtyNum');
  const hasLowStockThreshold = pantryHasCol_('low_stock_threshold');
  if (!hasQtyNum || !hasLowStockThreshold) return ok_({ items: [] });

  const rows = db().prepare(`
    SELECT ItemId, Name, QtyNum, low_stock_threshold, Unit, StoreId
    FROM pantry
    WHERE low_stock_threshold IS NOT NULL 
      AND low_stock_threshold > 0
      AND QtyNum IS NOT NULL 
      AND QtyNum <= low_stock_threshold
    ORDER BY Name ASC
  `).all();

  return ok_({
    items: rows.map(r => ({
      ItemId: r.ItemId,
      Name: r.Name,
      QtyNum: r.QtyNum,
      low_stock_threshold: r.low_stock_threshold,
      Unit: r.Unit || '',
      StoreId: r.StoreId || ''
    }))
  });
}

// ================= CALENDAR =================
async function calendarSyncRange(payload, store) {
  const start = String(payload && payload.start || '').trim();
  const end = String(payload && payload.end || '').trim();
  let userId = String(payload && payload.userId || '').trim();
  if (!start || !end) return err_('start and end date required.');

  // Get active user if not specified
  if (!userId) {
    const activeUser = getActiveUser();
    if (activeUser.ok && activeUser.userId) {
      userId = activeUser.userId;
    }
  }

  const calendarName = String(store.get('calendarName') || 'Foodie Meal Planner').trim();

  // Phase 4.5.7: Check if user_plan_meals table exists (new multi-user system)
  const userPlanMealsExists = db().prepare(`
    SELECT name FROM sqlite_master WHERE type='table' AND name='user_plan_meals'
  `).get();

  if (userPlanMealsExists && userId) {
    // Use new multi-user system
    const wholeFamilyUser = db().prepare("SELECT user_id FROM users WHERE name = 'Whole Family'").get();
    const wholeFamilyId = wholeFamilyUser ? wholeFamilyUser.user_id : null;
    const isWholeFamilyView = (userId === wholeFamilyId);

    // Get all meals for this date range
    let meals;
    if (isWholeFamilyView) {
      // Whole Family: sync ALL meals from ALL users
      meals = db().prepare(`
        SELECT id, user_id, date, slot, recipe_id, title, apple_event_id
        FROM user_plan_meals
        WHERE date >= ? AND date <= ?
        ORDER BY date, slot, user_id
      `).all(start, end);
    } else {
      // Individual user: sync only their meals (no fallback for calendar sync)
      meals = db().prepare(`
        SELECT id, user_id, date, slot, recipe_id, title, apple_event_id
        FROM user_plan_meals
        WHERE date >= ? AND date <= ? AND user_id = ?
        ORDER BY date, slot
      `).all(start, end, userId);
    }

    // Group meals by date and slot
    const mealsByDateSlot = new Map();
    for (const meal of meals) {
      const key = `${meal.date}|${meal.slot}`;
      if (!mealsByDateSlot.has(key)) {
        mealsByDateSlot.set(key, []);
      }
      mealsByDateSlot.get(key).push(meal);
    }

    // Sync each date/slot
    for (const [key, slotMeals] of mealsByDateSlot.entries()) {
      const [date, slot] = key.split('|');

      if (slotMeals.length === 0) continue;

      // For multiple meals in one slot, create separate calendar events for each
      for (const meal of slotMeals) {
        const eventId = meal.apple_event_id || '';
        const title = slotMeals.length > 1
          ? `${slot}: ${meal.title} (${slotMeals.indexOf(meal) + 1}/${slotMeals.length})`
          : `${slot}: ${meal.title}`;

        const newEventId = await upsertEvent({
          eventId,
          title,
          date,
          slot,
          calendarName
        });

        if (newEventId && newEventId !== eventId) {
          db().prepare(`
            UPDATE user_plan_meals SET apple_event_id = ? WHERE id = ?
          `).run(newEventId, meal.id);
        }
      }
    }
  } else {
    // Fall back to old plans table
    const schema = plansSchema_();
    let plans;
    if (schema.hasNew) {
      plans = db().prepare(`
        SELECT Date,
          BreakfastRecipeId, BreakfastTitle, BreakfastEventId,
          LunchRecipeId, LunchTitle, LunchEventId,
          DinnerRecipeId, DinnerTitle, DinnerEventId
        FROM plans WHERE Date >= ? AND Date <= ?
      `).all(start, end);
    } else if (schema.hasLegacy) {
      plans = db().prepare(`
        SELECT Date, Breakfast, Lunch, Dinner, Calendar
        FROM plans WHERE Date >= ? AND Date <= ?
      `).all(start, end);
    } else {
      plans = [];
    }

    for (const p of plans) {
      const date = p.Date;
      const planObj = planRowToObj(p);
      const cal = planObj.Calendar || {};

      for (const slot of ['Breakfast', 'Lunch', 'Dinner']) {
        const meal = planObj[slot];
        const eventId = cal[`${slot}EventId`] || '';

        if (!meal || !meal.Title) {
          if (eventId) {
            await deleteEvent(eventId);
            if (schema.hasNew) {
              db().prepare(`UPDATE plans SET ${slot}EventId='' WHERE Date=?`).run(date);
            } else if (schema.hasLegacy) {
              const newCal = { ...cal, [`${slot}EventId`]: '' };
              db().prepare("UPDATE plans SET Calendar=? WHERE Date=?").run(JSON.stringify(newCal), date);
            }
          }
          continue;
        }

        const title = `${slot}: ${meal.Title}`;
        const newEventId = await upsertEvent({
          eventId,
          title,
          date,
          slot,
          calendarName
        });

        if (newEventId && newEventId !== eventId) {
          if (schema.hasNew) {
            db().prepare(`UPDATE plans SET ${slot}EventId=? WHERE Date=?`).run(newEventId, date);
          } else if (schema.hasLegacy) {
            const newCal = { ...cal, [`${slot}EventId`]: newEventId };
            db().prepare("UPDATE plans SET Calendar=? WHERE Date=?").run(JSON.stringify(newCal), date);
          }
        }
      }
    }
  }

  return ok_({});
}

// ================= GOOGLE CALENDAR =================
async function googleCalendarSyncRange(payload, store) {
  const start = String(payload && payload.start || '').trim();
  const end = String(payload && payload.end || '').trim();
  let userId = String(payload && payload.userId || '').trim();
  if (!start || !end) return err_('start and end date required.');

  try {
    // Get active user if not specified
    if (!userId) {
      const activeUser = getActiveUser();
      if (activeUser.ok && activeUser.userId) {
        userId = activeUser.userId;
      }
    }

    const googleCalendarId = String(store.get('googleCalendarId') || 'primary').trim();

    let syncedCount = 0;
    let deletedCount = 0;

    // Phase 4.5.7: Check if user_plan_meals table exists (new multi-user system)
    const userPlanMealsExists = db().prepare(`
      SELECT name FROM sqlite_master WHERE type='table' AND name='user_plan_meals'
    `).get();

    if (userPlanMealsExists && userId) {
      // Use new multi-user system
      const wholeFamilyUser = db().prepare("SELECT user_id FROM users WHERE name = 'Whole Family'").get();
      const wholeFamilyId = wholeFamilyUser ? wholeFamilyUser.user_id : null;
      const isWholeFamilyView = (userId === wholeFamilyId);

      // Get all meals for this date range
      let meals;
      if (isWholeFamilyView) {
        // Whole Family: sync ALL meals from ALL users
        meals = db().prepare(`
          SELECT id, user_id, date, slot, recipe_id, title, google_event_id
          FROM user_plan_meals
          WHERE date >= ? AND date <= ?
          ORDER BY date, slot, user_id
        `).all(start, end);
      } else {
        // Individual user: sync only their meals (no fallback for calendar sync)
        meals = db().prepare(`
          SELECT id, user_id, date, slot, recipe_id, title, google_event_id
          FROM user_plan_meals
          WHERE date >= ? AND date <= ? AND user_id = ?
          ORDER BY date, slot
        `).all(start, end, userId);
      }

      // Group meals by date and slot
      const mealsByDateSlot = new Map();
      for (const meal of meals) {
        const key = `${meal.date}|${meal.slot}`;
        if (!mealsByDateSlot.has(key)) {
          mealsByDateSlot.set(key, []);
        }
        mealsByDateSlot.get(key).push(meal);
      }

      // Sync each date/slot
      for (const [key, slotMeals] of mealsByDateSlot.entries()) {
        const [date, slot] = key.split('|');

        if (slotMeals.length === 0) continue;

        const slotTimes = {
          Breakfast: { start: '08:00:00', end: '09:00:00' },
          Lunch: { start: '12:00:00', end: '13:00:00' },
          Dinner: { start: '18:00:00', end: '19:00:00' }
        };
        const times = slotTimes[slot];

        // For multiple meals in one slot, create separate calendar events for each
        for (const meal of slotMeals) {
          const eventId = meal.google_event_id || '';
          const title = slotMeals.length > 1
            ? `${slot}: ${meal.title} (${slotMeals.indexOf(meal) + 1}/${slotMeals.length})`
            : `${slot}: ${meal.title}`;

          const startDateTime = `${date}T${times.start}`;
          const endDateTime = `${date}T${times.end}`;

          const result = await googleCal.upsertGoogleEvent({
            calendarId: googleCalendarId,
            eventId,
            title,
            description: '',
            startDateTime,
            endDateTime
          });

          if (result.ok && result.eventId) {
            syncedCount++;
            if (result.eventId !== eventId) {
              db().prepare(`
                UPDATE user_plan_meals SET google_event_id = ? WHERE id = ?
              `).run(result.eventId, meal.id);
            }
          }
        }
      }
    } else {
      // Fall back to old plans table
      const schema = plansSchema_();
      let plans;
      if (schema.hasNew) {
        plans = db().prepare(`
          SELECT Date,
            BreakfastRecipeId, BreakfastTitle, BreakfastEventId,
            LunchRecipeId, LunchTitle, LunchEventId,
            DinnerRecipeId, DinnerTitle, DinnerEventId
          FROM plans WHERE Date >= ? AND Date <= ?
        `).all(start, end);
      } else if (schema.hasLegacy) {
        plans = db().prepare(`
          SELECT Date, Breakfast, Lunch, Dinner, Calendar
          FROM plans WHERE Date >= ? AND Date <= ?
        `).all(start, end);
      } else {
        plans = [];
      }

      for (const p of plans) {
        const date = p.Date;
        const planObj = planRowToObj(p);
        const cal = planObj.Calendar || {};

        for (const slot of ['Breakfast', 'Lunch', 'Dinner']) {
          const meal = planObj[slot];
          const eventId = cal[`${slot}EventId`] || '';

          if (!meal || !meal.Title) {
            if (eventId) {
              await googleCal.deleteGoogleEvent({ calendarId: googleCalendarId, eventId });
              deletedCount++;
              if (schema.hasNew) {
                db().prepare(`UPDATE plans SET ${slot}EventId='' WHERE Date=?`).run(date);
              } else if (schema.hasLegacy) {
                const newCal = { ...cal, [`${slot}EventId`]: '' };
                db().prepare("UPDATE plans SET Calendar=? WHERE Date=?").run(JSON.stringify(newCal), date);
              }
            }
            continue;
          }

          const title = `${slot}: ${meal.Title}`;
          const slotTimes = {
            Breakfast: { start: '08:00:00', end: '09:00:00' },
            Lunch: { start: '12:00:00', end: '13:00:00' },
            Dinner: { start: '18:00:00', end: '19:00:00' }
          };
          const times = slotTimes[slot];
          const startDateTime = `${date}T${times.start}`;
          const endDateTime = `${date}T${times.end}`;

          const result = await googleCal.upsertGoogleEvent({
            calendarId: googleCalendarId,
            eventId,
            title,
            description: meal.Notes || '',
            startDateTime,
            endDateTime
          });

          if (result.ok && result.eventId) {
            syncedCount++;
            if (result.eventId !== eventId) {
              if (schema.hasNew) {
                db().prepare(`UPDATE plans SET ${slot}EventId=? WHERE Date=?`).run(result.eventId, date);
              } else if (schema.hasLegacy) {
                const newCal = { ...cal, [`${slot}EventId`]: result.eventId };
                db().prepare("UPDATE plans SET Calendar=? WHERE Date=?").run(JSON.stringify(newCal), date);
              }
            }
          }
        }
      }
    }

    return ok_({ synced: syncedCount, deleted: deletedCount });
  } catch (error) {
    return err_(error.message || 'Google Calendar sync failed');
  }
}

async function initGoogleCalendar(payload) {
  try {
    const credentials = payload && payload.credentials;
    if (!credentials) return err_('credentials required');

    const saveResult = googleCal.saveCredentials(credentials);
    if (!saveResult.ok) return saveResult;

    const initResult = await googleCal.initializeGoogleCalendar(credentials);
    return initResult;
  } catch (error) {
    return err_(error.message || 'Failed to initialize Google Calendar');
  }
}

async function getGoogleAuthUrl() {
  try {
    const credResult = googleCal.loadCredentials();
    if (!credResult.ok) {
      return err_('No credentials found. Please upload credentials first.');
    }

    await googleCal.initializeGoogleCalendar(credResult.credentials);
    const url = googleCal.getAuthUrl();

    if (!url) return err_('Failed to generate auth URL');
    return ok_({ url });
  } catch (error) {
    return err_(error.message || 'Failed to get auth URL');
  }
}

async function setGoogleAuthCode(payload) {
  try {
    const code = String(payload && payload.code || '').trim();
    if (!code) return err_('Authorization code required');

    const result = await googleCal.getTokenFromCode(code);
    return result;
  } catch (error) {
    return err_(error.message || 'Failed to set auth code');
  }
}

async function listGoogleCalendars() {
  try {
    const result = await googleCal.listCalendars();
    return result;
  } catch (error) {
    return err_(error.message || 'Failed to list calendars');
  }
}

async function getGoogleCalendarStatus() {
  try {
    const isAuth = googleCal.isAuthenticated();
    const credResult = googleCal.loadCredentials();

    return ok_({
      authenticated: isAuth,
      hasCredentials: credResult.ok
    });
  } catch (error) {
    return err_(error.message || 'Failed to get status');
  }
}

async function revokeGoogleCalendar() {
  try {
    const result = await googleCal.revokeAccess();
    return result;
  } catch (error) {
    return err_(error.message || 'Failed to revoke access');
  }
}

async function checkGoogleCalendarDuplicates(payload) {
  try {
    const start = String(payload && payload.start || '').trim();
    const end = String(payload && payload.end || '').trim();
    if (!start || !end) return err_('start and end date required.');

    const schema = plansSchema_();
    let plans;
    if (schema.hasNew) {
      plans = db().prepare(`
        SELECT Date,
          BreakfastTitle, BreakfastEventId,
          LunchTitle, LunchEventId,
          DinnerTitle, DinnerEventId
        FROM plans WHERE Date >= ? AND Date <= ?
      `).all(start, end);
    } else {
      plans = [];
    }

    const duplicates = [];

    for (const p of plans) {
      const date = p.Date;
      const planObj = planRowToObj(p);

      for (const slot of ['Breakfast', 'Lunch', 'Dinner']) {
        const meal = planObj[slot];
        if (!meal || !meal.Title) continue;

        const title = `${slot}: ${meal.Title}`;
        const slotTimes = {
          Breakfast: { start: '08:00:00', end: '09:00:00' },
          Lunch: { start: '12:00:00', end: '13:00:00' },
          Dinner: { start: '18:00:00', end: '19:00:00' }
        };
        const times = slotTimes[slot];
        const startDateTime = `${date}T${times.start}`;
        const endDateTime = `${date}T${times.end}`;

        const dupResult = await googleCal.findDuplicateEvents({
          calendarId: 'primary',
          title,
          startDateTime,
          endDateTime
        });

        if (dupResult.ok && dupResult.events && dupResult.events.length > 1) {
          duplicates.push({
            date,
            slot,
            title,
            count: dupResult.events.length,
            events: dupResult.events
          });
        }
      }
    }

    return ok_({ duplicates, count: duplicates.length });
  } catch (error) {
    return err_(error.message || 'Failed to check duplicates');
  }
}

// ================= COLLECTIONS =================

// ================= COLLECTIONS =================
function listCollections() {
  const rows = db().prepare(`
    SELECT 
      rc.collection_id, 
      rc.name, 
      rc.description, 
      rc.created_at,
      COUNT(rcm.recipe_id) as recipe_count
    FROM recipe_collections rc
    LEFT JOIN recipe_collection_map rcm ON rc.collection_id = rcm.collection_id
    GROUP BY rc.collection_id
    ORDER BY rc.name ASC
  `).all();
  return ok_({
    collections: rows.map(r => ({
      CollectionId: r.collection_id,
      Name: r.name,
      Description: r.description,
      RecipeCount: r.recipe_count
    }))
  });
}


function getCollection(payload) {
  const collectionId = String(payload && payload.collectionId || '').trim();
  if (!collectionId) return err_('collectionId required.');

  const c = db().prepare("SELECT * FROM recipe_collections WHERE collection_id=?").get(collectionId);
  if (!c) return err_('Collection not found.');

  const recipes = db().prepare(`
    SELECT r.RecipeId, r.Title, r.TitleLower, r.URL, r.Cuisine, r.MealType, r.Notes, r.Instructions, r.Image_Name
    FROM recipes r
    INNER JOIN recipe_collection_map m ON r.RecipeId = m.recipe_id
    WHERE m.collection_id = ?
    ORDER BY r.Title ASC
  `).all(collectionId);

  return ok_({
    collection: {
      CollectionId: c.collection_id,
      Name: c.name,
      Description: c.description || '',
      CreatedAt: c.created_at
    },
    recipes: recipes.map(recipeRowToObj)
  });
}

function upsertCollection(payload) {
  const collectionId = String(payload && payload.collectionId || '').trim();
  const name = String(payload && payload.name || '').trim();
  if (!name) return err_('name required.');
  const description = String(payload && payload.description || '');

  if (collectionId) {
    // Update existing
    db().prepare(`
      UPDATE recipe_collections SET name=?, description=?
      WHERE collection_id=?
    `).run(name, description, collectionId);
    return ok_({ CollectionId: collectionId });
  } else {
    // Insert new
    const result = db().prepare(`
      INSERT INTO recipe_collections(name, description)
      VALUES(?,?)
    `).run(name, description);
    return ok_({ CollectionId: result.lastInsertRowid });
  }
}

function deleteCollection(payload) {
  const collectionId = String(payload && payload.collectionId || '').trim();
  if (!collectionId) return err_('collectionId required.');
  db().prepare("DELETE FROM recipe_collections WHERE collection_id=?").run(collectionId);
  return ok_({});
}

function addRecipeToCollection(payload) {
  const collectionId = String(payload && payload.collectionId || '').trim();
  const recipeId = String(payload && payload.recipeId || '').trim();
  if (!collectionId || !recipeId) return err_('collectionId and recipeId required.');

  db().prepare(`
    INSERT INTO recipe_collection_map(collection_id, recipe_id)
    VALUES(?,?)
    ON CONFLICT(recipe_id, collection_id) DO NOTHING
  `).run(collectionId, recipeId);

  return ok_({});
}

function removeRecipeFromCollection(payload) {
  const collectionId = String(payload && payload.collectionId || '').trim();
  const recipeId = String(payload && payload.recipeId || '').trim();
  if (!collectionId || !recipeId) return err_('collectionId and recipeId required.');

  db().prepare("DELETE FROM recipe_collection_map WHERE collection_id=? AND recipe_id=?").run(collectionId, recipeId);
  return ok_({});
}

function listCollectionRecipes(payload) {
  const collectionId = String(payload && payload.collectionId || '').trim();
  if (!collectionId) return err_('collectionId required.');

  const recipes = db().prepare(`
    SELECT r.RecipeId, r.Title, r.TitleLower, r.URL, r.Cuisine, r.MealType, r.Notes, r.Instructions, r.Image_Name, m.is_main_dish
    FROM recipes r
    INNER JOIN recipe_collection_map m ON r.RecipeId = m.recipe_id
    WHERE m.collection_id = ?
    ORDER BY m.is_main_dish DESC, r.Title ASC
  `).all(collectionId);

  return ok_({
    recipes: recipes.map(r => ({
      ...recipeRowToObj(r),
      IsMainDish: r.is_main_dish || 0
    }))
  });
}

function setMainDishInCollection(payload) {
  const collectionId = String(payload && payload.collectionId || '').trim();
  const recipeId = String(payload && payload.recipeId || '').trim();
  if (!collectionId || !recipeId) return err_('collectionId and recipeId required.');

  // Set all recipes in collection to is_main_dish = 0
  db().prepare(`
    UPDATE recipe_collection_map 
    SET is_main_dish = 0 
    WHERE collection_id = ?
  `).run(collectionId);

  // Set the selected recipe to is_main_dish = 1
  db().prepare(`
    UPDATE recipe_collection_map 
    SET is_main_dish = 1 
    WHERE collection_id = ? AND recipe_id = ?
  `).run(collectionId, recipeId);

  return ok_({});
}

// ================= CATEGORIZATION =================
function getCategoryOverrides() {
  try {
    const rows = db().prepare("SELECT keyword, category FROM category_overrides ORDER BY keyword ASC").all();
    return ok_({
      overrides: rows.map(r => ({
        IngredientNorm: r.keyword,
        Category: r.category
      }))
    });
  } catch (e) {
    return ok_({ overrides: [] });
  }
}

function saveCategoryOverride(payload) {
  const ingredientNorm = normLower_((payload && payload.ingredientNorm) || '');
  const category = String(payload && payload.category || '').trim();
  if (!ingredientNorm || !category) return err_('ingredientNorm and category required.');

  db().prepare(`
    INSERT INTO category_overrides(keyword, category, updated_at)
    VALUES(?, ?, datetime('now'))
    ON CONFLICT(keyword) DO UPDATE SET category=excluded.category, updated_at=excluded.updated_at
  `).run(ingredientNorm, category);

  return ok_({});
}

function deleteCategoryOverride(payload) {
  const ingredientNorm = normLower_((payload && payload.ingredientNorm) || '');
  if (!ingredientNorm) return err_('ingredientNorm required.');

  db().prepare("DELETE FROM category_overrides WHERE keyword=?").run(ingredientNorm);
  return ok_({});
}

function getIngredientCategories() {
  const rows = db().prepare("SELECT DISTINCT Category FROM ingredients WHERE Category IS NOT NULL AND Category != '' ORDER BY Category ASC").all();
  const categories = rows.map(r => r.Category);
  return ok_({ categories });
}

function setIngredientCategories(payload) {
  const ingredientNorm = normLower_((payload && payload.ingredientNorm) || '');
  const category = String(payload && payload.category || '').trim();
  if (!ingredientNorm) return err_('ingredientNorm required.');

  db().prepare("UPDATE ingredients SET Category=? WHERE lower(IngredientNorm)=?").run(category, ingredientNorm);
  return ok_({});
}

function classifyIngredient(payload) {
  const ingredientNorm = normLower_((payload && payload.ingredientNorm) || '');
  if (!ingredientNorm) return err_('ingredientNorm required.');

  const override = db().prepare("SELECT category FROM category_overrides WHERE keyword=?").get(ingredientNorm);
  if (override) return ok_({ category: override.category, source: 'override' });

  const existing = db().prepare("SELECT Category FROM ingredients WHERE lower(IngredientNorm)=? AND Category IS NOT NULL AND Category != '' LIMIT 1").get(ingredientNorm);
  if (existing) return ok_({ category: existing.Category, source: 'existing' });

  return ok_({ category: 'Other', source: 'default' });
}

function trainIngredientCategory(payload) {
  const ingredientNorm = normLower_((payload && payload.ingredientNorm) || '');
  const category = String(payload && payload.category || '').trim();
  if (!ingredientNorm || !category) return err_('ingredientNorm and category required.');

  db().prepare("UPDATE ingredients SET Category=? WHERE lower(IngredientNorm)=?").run(category, ingredientNorm);
  return ok_({});
}

// ================= ADDITIONAL ITEMS API (NEW) =================
function addAdditionalItem(payload) {
  const { date, slot, recipeId, itemType } = payload || {};
  const d = String(date || '').trim();
  const s = String(slot || '').trim();
  const rid = String(recipeId || '').trim();
  const type = String(itemType || 'side').trim();

  if (!d || !s || !rid) {
    return err_('Missing required fields: date, slot, recipeId');
  }

  // Get recipe title
  const recipe = db().prepare('SELECT Title FROM recipes WHERE RecipeId = ?').get(rid);
  if (!recipe) {
    return err_('Recipe not found');
  }

  // Get max sort order
  const maxSort = db().prepare(
    'SELECT MAX(SortOrder) as max FROM plan_additional_items WHERE Date = ? AND Slot = ?'
  ).get(d, s);
  const sortOrder = (maxSort && maxSort.max !== null) ? maxSort.max + 1 : 0;

  // Insert additional item
  const result = db().prepare(`
    INSERT INTO plan_additional_items(Date, Slot, RecipeId, Title, ItemType, SortOrder)
    VALUES(?, ?, ?, ?, ?, ?)
  `).run(d, s, rid, recipe.Title, type, sortOrder);

  return ok_({
    id: result.lastInsertRowid,
    item: {
      id: result.lastInsertRowid,
      Date: d,
      Slot: s,
      RecipeId: rid,
      Title: recipe.Title,
      ItemType: type,
      SortOrder: sortOrder
    }
  });
}

function removeAdditionalItem(payload) {
  const id = payload && payload.id;
  if (!id) {
    return err_('Missing required field: id');
  }

  db().prepare('DELETE FROM plan_additional_items WHERE id = ?').run(id);
  return ok_({});
}

function getAdditionalItems(payload) {
  const { date, slot } = payload || {};
  const d = String(date || '').trim();
  const s = String(slot || '').trim();

  if (!d || !s) {
    return err_('Missing required fields: date, slot');
  }

  const items = db().prepare(`
    SELECT id, Date, Slot, RecipeId, Title, ItemType, SortOrder
    FROM plan_additional_items
    WHERE Date = ? AND Slot = ?
    ORDER BY SortOrder ASC
  `).all(d, s);

  return ok_({ items });
}

function assignCollectionToSlot(payload) {
  const { date, slot, collectionId, userId: payloadUserId } = payload || {};
  const d = String(date || '').trim();
  const s = String(slot || '').trim();
  const cid = String(collectionId || '').trim();

  if (!d || !s || !cid) {
    return err_('Missing required fields: date, slot, collectionId');
  }

  // Phase 4.5.7: Get active user if not provided
  let userId = String(payloadUserId || '').trim();
  if (!userId) {
    const activeUser = getActiveUser();
    if (activeUser.ok && activeUser.userId) {
      userId = activeUser.userId;
    } else {
      return err_('No active user set');
    }
  }

  // Get collection recipes - main dish first, then others
  const recipes = db().prepare(`
    SELECT r.RecipeId, r.Title, m.is_main_dish
    FROM recipes r
    INNER JOIN recipe_collection_map m ON r.RecipeId = m.recipe_id
    WHERE m.collection_id = ?
    ORDER BY m.is_main_dish DESC, r.Title ASC
  `).all(cid);

  if (recipes.length === 0) {
    return err_('Collection is empty');
  }

  // Phase 4.5.7: First recipe becomes main meal for the user
  const mainRecipe = recipes[0];
  const mainResult = upsertUserPlanMeal({
    userId,
    date: d,
    slot: s,
    meal: {
      RecipeId: mainRecipe.RecipeId,
      Title: mainRecipe.Title
    }
  });

  if (!mainResult.ok) {
    return err_('Failed to assign main meal: ' + (mainResult.error || 'Unknown error'));
  }

  const mainMealId = mainResult.id;

  // Remaining recipes become additional items linked to the main meal
  const additionalItems = [];
  for (let i = 1; i < recipes.length; i++) {
    const result = addAdditionalItem({
      date: d,
      slot: s,
      recipeId: recipes[i].RecipeId,
      title: recipes[i].Title,
      itemType: 'side',
      mealId: mainMealId  // Link to the main meal
    });
    if (result.ok) {
      additionalItems.push(result.item);
    }
  }

  return ok_({
    mainRecipe: {
      RecipeId: mainRecipe.RecipeId,
      Title: mainRecipe.Title
    },
    additionalItems
  });
}

// ========== PHASE 4.5: MULTI-USER SUPPORT / HOUSEHOLD MANAGEMENT ==========

// Store active user in memory (could be persisted to localStorage in frontend)
let ACTIVE_USER_ID = null;

// ================= USER MANAGEMENT =================

function listUsers() {
  const rows = db().prepare(`
    SELECT user_id, name, email, avatar_emoji, is_active, created_at, updated_at
    FROM users
    ORDER BY CASE WHEN name = 'Whole Family' THEN 0 ELSE 1 END, name ASC
  `).all();

  return ok_({
    users: rows.map(r => ({
      userId: r.user_id,
      name: r.name,
      email: r.email,
      avatarEmoji: r.avatar_emoji,
      isActive: !!r.is_active,
      createdAt: r.created_at,
      updatedAt: r.updated_at
    }))
  });
}

function getUser(payload) {
  const { userId } = payload;
  if (!userId) return err_('userId required');

  const user = db().prepare(`
    SELECT user_id, name, email, avatar_emoji, is_active, created_at, updated_at
    FROM users
    WHERE user_id = ?
  `).get(userId);

  if (!user) return err_('User not found');

  return ok_({
    userId: user.user_id,
    name: user.name,
    email: user.email,
    avatarEmoji: user.avatar_emoji,
    isActive: !!user.is_active,
    createdAt: user.created_at,
    updatedAt: user.updated_at
  });
}

function createUser(payload) {
  const { name, email, avatarEmoji } = payload;
  if (!name) return err_('name required');

  const { randomUUID } = require('crypto');
  const userId = randomUUID();

  try {
    db().prepare(`
      INSERT INTO users (user_id, name, email, avatar_emoji, is_active)
      VALUES (?, ?, ?, ?, 1)
    `).run(userId, name, email || null, avatarEmoji || '👤');

    return ok_({ userId, name, email, avatarEmoji: avatarEmoji || '👤', isActive: true });
  } catch (e) {
    return err_('Failed to create user: ' + (e.message || e));
  }
}

function updateUser(payload) {
  const { userId, name, email, avatarEmoji, isActive } = payload;
  if (!userId) return err_('userId required');

  const updates = [];
  const values = [];

  if (name !== undefined) { updates.push('name = ?'); values.push(name); }
  if (email !== undefined) { updates.push('email = ?'); values.push(email); }
  if (avatarEmoji !== undefined) { updates.push('avatar_emoji = ?'); values.push(avatarEmoji); }
  if (isActive !== undefined) { updates.push('is_active = ?'); values.push(isActive ? 1 : 0); }

  if (updates.length === 0) return err_('No fields to update');

  updates.push("updated_at = datetime('now')");
  values.push(userId);

  try {
    db().prepare(`
      UPDATE users
      SET ${updates.join(', ')}
      WHERE user_id = ?
    `).run(...values);

    return ok_({ userId });
  } catch (e) {
    return err_('Failed to update user: ' + (e.message || e));
  }
}

function deleteUser(payload) {
  const { userId } = payload;
  if (!userId) return err_('userId required');

  // Prevent deletion of "Whole Family" user
  const user = db().prepare("SELECT name FROM users WHERE user_id = ?").get(userId);
  if (user && user.name === 'Whole Family') {
    return err_('Cannot delete Whole Family user');
  }

  try {
    // CASCADE DELETE: Remove all user's meals from user_plan_meals table
    const userTableExists = db().prepare(`
      SELECT name FROM sqlite_master WHERE type='table' AND name='user_plan_meals'
    `).get();

    if (userTableExists) {
      const deletedMeals = db().prepare("DELETE FROM user_plan_meals WHERE user_id = ?").run(userId);
      console.log(`[deleteUser] Deleted ${deletedMeals.changes} meals for user ${userId}`);
    }

    // CASCADE DELETE: Remove user's favorite recipes
    const favoritesTableExists = db().prepare(`
      SELECT name FROM sqlite_master WHERE type='table' AND name='user_favorites'
    `).get();

    if (favoritesTableExists) {
      const deletedFavorites = db().prepare("DELETE FROM user_favorites WHERE user_id = ?").run(userId);
      console.log(`[deleteUser] Deleted ${deletedFavorites.changes} favorites for user ${userId}`);
    }

    // Finally, delete the user
    db().prepare("DELETE FROM users WHERE user_id = ?").run(userId);
    console.log(`[deleteUser] Successfully deleted user ${userId}`);

    return ok_({ userId, message: 'User and all associated data deleted successfully' });
  } catch (e) {
    console.error('[deleteUser] Error:', e);
    return err_('Failed to delete user: ' + (e.message || e));
  }
}

function setActiveUser(payload) {
  const { userId } = payload;
  if (!userId) return err_('userId required');

  // Verify user exists
  const user = db().prepare("SELECT user_id FROM users WHERE user_id = ?").get(userId);
  if (!user) return err_('User not found');

  ACTIVE_USER_ID = userId;
  return ok_({ userId });
}

function getActiveUser() {
  // If no active user set, default to "Whole Family"
  if (!ACTIVE_USER_ID) {
    const wholeFamilyUser = db().prepare("SELECT user_id FROM users WHERE name = 'Whole Family'").get();
    if (wholeFamilyUser) {
      ACTIVE_USER_ID = wholeFamilyUser.user_id;
    }
  }

  if (!ACTIVE_USER_ID) {
    return ok_({ userId: null, name: null });
  }

  const user = db().prepare(`
    SELECT user_id, name, email, avatar_emoji, is_active
    FROM users
    WHERE user_id = ?
  `).get(ACTIVE_USER_ID);

  if (!user) {
    ACTIVE_USER_ID = null;
    return ok_({ userId: null, name: null });
  }

  return ok_({
    userId: user.user_id,
    name: user.name,
    email: user.email,
    avatarEmoji: user.avatar_emoji,
    isActive: !!user.is_active
  });
}

// ================= DIETARY RESTRICTIONS =================

function listDietaryRestrictions() {
  const rows = db().prepare(`
    SELECT restriction_id, name, description, created_at
    FROM dietary_restrictions
    ORDER BY name ASC
  `).all();

  return ok_({
    restrictions: rows.map(r => ({
      restrictionId: r.restriction_id,
      name: r.name,
      description: r.description,
      createdAt: r.created_at
    }))
  });
}

function getUserDietaryRestrictions(payload) {
  const { userId } = payload;
  if (!userId) return err_('userId required');

  const rows = db().prepare(`
    SELECT dr.restriction_id, dr.name, dr.description
    FROM user_dietary_restrictions udr
    JOIN dietary_restrictions dr ON udr.restriction_id = dr.restriction_id
    WHERE udr.user_id = ?
    ORDER BY dr.name ASC
  `).all(userId);

  return ok_({
    restrictions: rows.map(r => ({
      restrictionId: r.restriction_id,
      name: r.name,
      description: r.description
    }))
  });
}

function addUserDietaryRestriction(payload) {
  const { userId, restrictionId } = payload;
  if (!userId || !restrictionId) return err_('userId and restrictionId required');

  try {
    db().prepare(`
      INSERT OR IGNORE INTO user_dietary_restrictions (user_id, restriction_id)
      VALUES (?, ?)
    `).run(userId, restrictionId);

    return ok_({ userId, restrictionId });
  } catch (e) {
    return err_('Failed to add dietary restriction: ' + (e.message || e));
  }
}

function removeUserDietaryRestriction(payload) {
  const { userId, restrictionId } = payload;
  if (!userId || !restrictionId) return err_('userId and restrictionId required');

  try {
    db().prepare(`
      DELETE FROM user_dietary_restrictions
      WHERE user_id = ? AND restriction_id = ?
    `).run(userId, restrictionId);

    return ok_({ userId, restrictionId });
  } catch (e) {
    return err_('Failed to remove dietary restriction: ' + (e.message || e));
  }
}

// ================= PERSONAL FAVORITES =================

function toggleUserFavorite(payload) {
  const { userId, recipeId } = payload;
  if (!userId || !recipeId) return err_('userId and recipeId required');

  // Check if already favorited
  const existing = db().prepare(`
    SELECT 1 FROM user_favorites
    WHERE user_id = ? AND recipe_id = ?
  `).get(userId, recipeId);

  if (existing) {
    // Remove favorite
    db().prepare(`
      DELETE FROM user_favorites
      WHERE user_id = ? AND recipe_id = ?
    `).run(userId, recipeId);

    return ok_({ userId, recipeId, isFavorite: false });
  } else {
    // Add favorite
    db().prepare(`
      INSERT INTO user_favorites (user_id, recipe_id)
      VALUES (?, ?)
    `).run(userId, recipeId);

    return ok_({ userId, recipeId, isFavorite: true });
  }
}

function getUserFavorites(payload) {
  const { userId } = payload;
  if (!userId) return err_('userId required');

  const rows = db().prepare(`
    SELECT r.RecipeId, r.Title, r.Cuisine, r.MealType, r.Image_Name, uf.created_at
    FROM user_favorites uf
    JOIN recipes r ON uf.recipe_id = r.RecipeId
    WHERE uf.user_id = ?
    ORDER BY uf.created_at DESC
  `).all(userId);

  return ok_({
    favorites: rows.map(r => ({
      recipeId: r.RecipeId,
      title: r.Title,
      cuisine: r.Cuisine,
      mealType: r.MealType,
      imageName: r.Image_Name,
      createdAt: r.created_at
    }))
  });
}

function isUserFavorite(payload) {
  const { userId, recipeId } = payload;
  if (!userId || !recipeId) return err_('userId and recipeId required');

  const existing = db().prepare(`
    SELECT 1 FROM user_favorites
    WHERE user_id = ? AND recipe_id = ?
  `).get(userId, recipeId);

  return ok_({ isFavorite: !!existing });
}

// ================= MEAL ASSIGNMENTS PER PERSON =================

function getMealAssignments(payload) {
  const { date, slot } = payload;
  if (!date || !slot) return err_('date and slot required');

  const rows = db().prepare(`
    SELECT u.user_id, u.name, u.avatar_emoji
    FROM plan_meal_assignments pma
    JOIN users u ON pma.user_id = u.user_id
    WHERE pma.date = ? AND pma.slot = ?
    ORDER BY CASE WHEN u.name = 'Whole Family' THEN 0 ELSE 1 END, u.name ASC
  `).all(date, slot);

  return ok_({
    assignments: rows.map(r => ({
      userId: r.user_id,
      name: r.name,
      avatarEmoji: r.avatar_emoji
    }))
  });
}

function setMealAssignments(payload) {
  const { date, slot, userIds } = payload;
  if (!date || !slot || !Array.isArray(userIds)) return err_('date, slot, and userIds array required');

  try {
    // Delete existing assignments
    db().prepare(`
      DELETE FROM plan_meal_assignments
      WHERE date = ? AND slot = ?
    `).run(date, slot);

    // Insert new assignments
    if (userIds.length > 0) {
      const insertStmt = db().prepare(`
        INSERT INTO plan_meal_assignments (date, slot, user_id)
        VALUES (?, ?, ?)
      `);

      const tx = db().transaction(() => {
        userIds.forEach(userId => insertStmt.run(date, slot, userId));
      });
      tx();
    }

    return ok_({ date, slot, userIds });
  } catch (e) {
    return err_('Failed to set meal assignments: ' + (e.message || e));
  }
}

function addMealAssignment(payload) {
  const { date, slot, userId } = payload;
  if (!date || !slot || !userId) return err_('date, slot, and userId required');

  try {
    db().prepare(`
      INSERT OR IGNORE INTO plan_meal_assignments (date, slot, user_id)
      VALUES (?, ?, ?)
    `).run(date, slot, userId);

    return ok_({ date, slot, userId });
  } catch (e) {
    return err_('Failed to add meal assignment: ' + (e.message || e));
  }
}

function removeMealAssignment(payload) {
  const { date, slot, userId } = payload;
  if (!date || !slot || !userId) return err_('date, slot, and userId required');

  try {
    db().prepare(`
      DELETE FROM plan_meal_assignments
      WHERE date = ? AND slot = ? AND user_id = ?
    `).run(date, slot, userId);

    return ok_({ date, slot, userId });
  } catch (e) {
    return err_('Failed to remove meal assignment: ' + (e.message || e));
  }
}

// ========== PHASE 9.3: BATCHED ADDITIONAL ITEMS QUERY ==========
function getAdditionalItemsRange(payload) {
  const { start, end } = payload || {};
  const startDate = String(start || '').trim();
  const endDate = String(end || '').trim();

  if (!startDate || !endDate) {
    return err_('Missing required fields: start, end');
  }

  // Get all additional items for the date range in one query
  const items = db().prepare(`
    SELECT id, Date, Slot, RecipeId, Title, ItemType, SortOrder
    FROM plan_additional_items
    WHERE Date >= ? AND Date <= ?
    ORDER BY Date ASC, Slot ASC, SortOrder ASC
  `).all(startDate, endDate);

  // Group by date and slot for easier lookup
  const itemsByDateSlot = {};
  for (const item of items) {
    const key = `${item.Date}:${item.Slot}`;
    if (!itemsByDateSlot[key]) {
      itemsByDateSlot[key] = [];
    }
    itemsByDateSlot[key].push(item);
  }

  return ok_({ itemsByDateSlot });
}


function updateShoppingItem({ newName, sourceIds }) {
  if (!newName || !sourceIds || !Array.isArray(sourceIds) || sourceIds.length === 0) {
    return ok_({ updated: 0 });
  }

  const norm = newName.trim();
  // We update only the normalization, preserving the original IngredientRaw text
  // so the recipe text remains "1 cup chopped onions" but the system knows it is "Red Onion".

  const stmt = db().prepare(`
    UPDATE ingredients 
    SET IngredientNorm = ?
    WHERE RecipeId = ? AND idx = ?
  `);

  const tx = db().transaction((ids) => {
    for (const { rid, idx } of ids) {
      stmt.run(norm, rid, idx);
    }
  });

  try {
    tx(sourceIds);
    return ok_({ updated: sourceIds.length });
  } catch (e) {
    return err_('Failed to update shopping items: ' + e.message);
  }
}

module.exports = { handleApiCall };
