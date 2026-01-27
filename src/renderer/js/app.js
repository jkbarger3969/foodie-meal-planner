// ========== UTILITY HELPERS ==========
// Debug flag - set to false for production
// NOTE: This is the active DEBUG flag. constants.js also has DEBUG for future modularization.
const DEBUG = false;

// Platform detection - used for keyboard shortcuts (Cmd vs Ctrl)
const IS_MAC = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
const MOD_KEY_SYMBOL = IS_MAC ? '⌘' : 'Ctrl';

// Null-safe getElementById with optional error handling
function getEl(id, required = false) {
  const el = document.getElementById(id);
  if (!el && required && DEBUG) {
    console.warn(`[DOM] Element not found: ${id}`);
  }
  return el;
}

// Debug-aware console.log
function log(...args) {
  if (DEBUG) console.log(...args);
}

// Event listener cleanup helper
const listenerRegistry = new Map();
function addManagedListener(element, event, handler, options) {
  if (!element) return;
  const key = `${element.id || 'anon'}_${event}`;
  if (!listenerRegistry.has(key)) {
    listenerRegistry.set(key, []);
  }
  listenerRegistry.get(key).push({ element, event, handler, options });
  element.addEventListener(event, handler, options);
}

function cleanupListeners(elementOrId) {
  const element = typeof elementOrId === 'string' ? getEl(elementOrId) : elementOrId;
  if (!element) return;
  const key = `${element.id || 'anon'}`;
  for (const [regKey, listeners] of listenerRegistry.entries()) {
    if (regKey.startsWith(key)) {
      listeners.forEach(({ element: el, event, handler, options }) => {
        el.removeEventListener(event, handler, options);
      });
      listenerRegistry.delete(regKey);
    }
  }
}

// ========== MAIN APPLICATION CODE ==========
// ---------- utilities ----------

// Convert decimal to user-friendly fraction string for display
// Common cooking fractions: 1/8, 1/4, 1/3, 1/2, 2/3, 3/4
function decimalToFraction(decimal) {
  if (decimal === null || decimal === undefined || decimal === '') return '';
  
  const num = parseFloat(decimal);
  if (isNaN(num)) return String(decimal);
  if (num === 0) return '0';
  
  // Handle negative numbers
  const sign = num < 0 ? '-' : '';
  const absNum = Math.abs(num);
  
  // Extract whole number and fractional part
  const whole = Math.floor(absNum);
  const frac = absNum - whole;
  
  // If very close to whole number, return whole
  if (frac < 0.03) {
    return sign + (whole === 0 ? '0' : String(whole));
  }
  
  // Common cooking fractions with their decimal equivalents and tolerance
  const fractions = [
    { decimal: 0.125, display: '⅛', tolerance: 0.02 },
    { decimal: 0.167, display: '⅙', tolerance: 0.02 },
    { decimal: 0.25, display: '¼', tolerance: 0.03 },
    { decimal: 0.333, display: '⅓', tolerance: 0.03 },
    { decimal: 0.375, display: '⅜', tolerance: 0.02 },
    { decimal: 0.5, display: '½', tolerance: 0.04 },
    { decimal: 0.625, display: '⅝', tolerance: 0.02 },
    { decimal: 0.667, display: '⅔', tolerance: 0.03 },
    { decimal: 0.75, display: '¾', tolerance: 0.04 },
    { decimal: 0.833, display: '⅚', tolerance: 0.02 },
    { decimal: 0.875, display: '⅞', tolerance: 0.02 },
  ];
  
  // Find closest matching fraction
  for (const f of fractions) {
    if (Math.abs(frac - f.decimal) <= f.tolerance) {
      if (whole === 0) {
        return sign + f.display;
      }
      return sign + whole + ' ' + f.display;
    }
  }
  
  // If close to next whole number (e.g., 0.97 -> 1)
  if (frac > 0.97) {
    return sign + String(whole + 1);
  }
  
  // No matching fraction - return decimal rounded to 2 places
  const rounded = Math.round(absNum * 100) / 100;
  return sign + String(rounded);
}

// Format a quantity for display (converts decimals to fractions when appropriate)
function formatQuantityForDisplay(qtyNum, unit) {
  if (qtyNum === '' || qtyNum === null || qtyNum === undefined) return '';
  
  const fractionStr = decimalToFraction(qtyNum);
  if (unit) {
    return `${fractionStr} ${unit}`.trim();
  }
  return fractionStr;
}

async function api(fn, payload) {
  const result = await window.Foodie.api(fn, payload);
  return result;
}

// ---------- META / common options ----------
const DEFAULT_ING_CATEGORIES = ['Produce', 'Dairy', 'Meat', 'Seafood', 'Pantry', 'Snacks', 'Frozen', 'Bakery', 'Deli', 'Beverages', 'Household', 'Spice', 'Other'];

const META = {
  qtyNumOptions: ['', '0.25', '0.5', '0.75', '1', '1.5', '2', '3', '4', '5', '6', '8', '10', '12'],
  unitOptions: ['', 'tsp', 'tbsp', 'cup', 'oz', 'lb', 'g', 'kg', 'ml', 'l', 'pinch', 'clove', 'can', 'jar', 'package', 'bunch', 'slice', 'piece'],
  categories: [''],  // Start empty, will be loaded from database
  categoriesLoaded: false  // Track if categories have been loaded from DB
};

// ==================== GLOBAL ERROR HANDLER ====================
window.addEventListener('unhandledrejection', function (event) {
  console.error('Unhandled rejection (promise):', event.reason);
  showToast(`Error: ${event.reason}`, 'error', 5000);
});
window.addEventListener('error', function (event) {
  console.error('Global error:', event.error);
  showToast(`Error: ${event.message}`, 'error', 5000);
});

// ==================== MODAL STATE TRACKING ====================
// Track which modals are currently open to prevent flash on close
const MODAL_STATE = {};

// ==================== BACKUP HELPER FUNCTIONS ====================
// These need to be defined early because they're called in ensureTabLoaded

async function loadBackupStatus() {
  try {
    const res = await window.Foodie.backupGetStatus();
    if (res.ok) {
      const lastBackupEl = document.getElementById('backupLastBackupTime');
      const locationEl = document.getElementById('backupLocation');
      const countEl = document.getElementById('backupCount');

      if (res.lastBackupTime) {
        const date = new Date(res.lastBackupTime);
        const timeAgo = formatTimeAgo(date);
        lastBackupEl.textContent = `Last backup: ${timeAgo}`;
      } else {
        lastBackupEl.textContent = 'Last backup: Never';
      }

      locationEl.textContent = `Location: ${res.backupDir || '~/Backups/Foodie/'}`;
      countEl.textContent = `Backups: ${res.backupCount || 0}`;
    }
  } catch (e) {
    console.error('Failed to load backup status:', e);
  }

  await loadBackupList();
}

async function loadBackupList() {
  try {
    const res = await window.Foodie.backupList();
    const listEl = document.getElementById('backupList');

    if (!res.ok || !res.backups || res.backups.length === 0) {
      listEl.innerHTML = '<div class="muted" style="padding:12px;text-align:center;">No backups found</div>';
      return;
    }

    let html = '';
    for (const backup of res.backups) {
      // Backend returns 'created' not 'timestamp', and 'fileName' not 'filename'
      const date = new Date(backup.created || backup.timestamp);
      const timeAgo = formatTimeAgo(date);
      const size = formatBytes(backup.size);
      const filename = backup.fileName || backup.filename;

      html += `
        <div class="backup-item" data-filepath="${backup.filePath}" data-filename="${filename}">
          <div class="backup-info">
            <div class="backup-name">${filename}</div>
            <div class="backup-meta">${timeAgo} • ${size}</div>
          </div>
          <div class="backup-actions">
            <button class="btn-restore" data-filepath="${backup.filePath}" data-filename="${filename}">Restore</button>
          </div>
        </div>
      `;
    }

    listEl.innerHTML = html;

    // Attach restore handlers
    listEl.querySelectorAll('.btn-restore').forEach(btn => {
      btn.addEventListener('click', async () => {
        const filepath = btn.getAttribute('data-filepath');
        const filename = btn.getAttribute('data-filename');
        if (!confirm(`Restore from backup "${filename}"? This will replace your current data.`)) return;

        btn.textContent = 'Restoring...';
        btn.disabled = true;

        const res = await window.Foodie.backupRestore(filepath);
        if (!res.ok) {
          showToast(`Restore failed: ${res.error}`, 'error');
          btn.textContent = 'Restore';
          btn.disabled = false;
          return;
        }

        showToast('Restore complete. Reloading...', 'success');
        setTimeout(() => window.location.reload(), 1000);
      });
    });
  } catch (e) {
    console.error('Failed to load backup list:', e);
  }
}

function formatTimeAgo(date) {
  const now = new Date();
  const diffMs = now - date;
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffSec < 60) return 'Just now';
  if (diffMin < 60) return `${diffMin} minute${diffMin === 1 ? '' : 's'} ago`;
  if (diffHour < 24) return `${diffHour} hour${diffHour === 1 ? '' : 's'} ago`;
  if (diffDay < 7) return `${diffDay} day${diffDay === 1 ? '' : 's'} ago`;

  return date.toLocaleDateString();
}

function formatBytes(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

// ============= PHASE 5.1: MICRO-INTERACTIONS & WOW FACTOR =============
let MOUSE_POS = { x: 0, y: 0 };
document.addEventListener('mousedown', (e) => {
  MOUSE_POS = { x: e.clientX, y: e.clientY };
}, true);

/**
 * Opens a modal overlay with animation
 */
function openModal(id) {
  const overlay = document.getElementById(id);
  if (!overlay) return;

  // Prevent re-opening if already open (fixes flash on close)
  if (MODAL_STATE[id]) return;

  MODAL_STATE[id] = true;

  const modal = overlay.querySelector('.modal');
  overlay.style.display = 'flex';
  overlay.style.pointerEvents = 'auto';

  if (modal) {
    modal.style.transform = 'none';
    const rect = modal.getBoundingClientRect();
    modal.style.transformOrigin = `${MOUSE_POS.x - rect.left}px ${MOUSE_POS.y - rect.top}px`;
    modal.style.transform = '';
  }

  requestAnimationFrame(() => {
    overlay.classList.add('show');
  });
}

function closeModal(id) {
  const overlay = document.getElementById(id);
  if (!overlay) return;

  MODAL_STATE[id] = false;

  // Immediately hide and reset pointer events
  overlay.style.display = 'none';
  overlay.style.pointerEvents = 'auto'; // Reset so next open is interactive
  overlay.classList.remove('show');
}

/**
 * Triggers a subtle haptic-style pulse feedback
 */
function triggerSuccessFeedback(element) {
  if (!element) return;
  element.classList.remove('success-pulse');
  void element.offsetWidth; // trigger reflow
  element.classList.add('success-pulse');
}

function optionHtml_(vals, selected) {
  const s = String(selected ?? '');
  const list = Array.isArray(vals) ? vals.slice() : [];
  if (s && !list.some(v => String(v) === s)) list.push(s);
  return (list || []).map(v => {
    const vv = String(v);
    return `<option value="${escapeAttr(vv)}"${vv === s ? ' selected' : ''}>${escapeHtml(vv)}</option>`;
  }).join('');
}

function ensureDatalist_(id, values) {
  let dl = document.getElementById(id);
  if (!dl) {
    dl = document.createElement('datalist');
    dl.id = id;
    document.body.appendChild(dl);
  }
  dl.innerHTML = (values || []).map(v => `<option value="${escapeAttr(String(v))}"></option>`).join('');
  return dl;
}
async function pantryModal_(opts) {
  const overlay = document.getElementById('pantryModalOverlay');
  const titleEl = document.getElementById('pantryModalTitle');
  const btnClose = document.getElementById('pantryModalClose');
  const btnCancel = document.getElementById('pantryModalCancel');
  const btnSave = document.getElementById('pantryModalSave');
  const errEl = document.getElementById('pantryModalError');

  const nameEl = document.getElementById('pantryModalName');
  const qtyNumEl = document.getElementById('pantryModalQtyNum');
  const unitEl = document.getElementById('pantryModalUnit');
  const unitCustomEl = document.getElementById('pantryModalUnitCustom');
  const categoryEl = document.getElementById('pantryModalCategory');
  const qtyTextEl = document.getElementById('pantryModalQtyText');
  const lowStockEl = document.getElementById('pantryModalLowStock');
  const expirationEl = document.getElementById('pantryModalExpiration');
  const storeIdEl = document.getElementById('pantryModalStoreId');
  const notesEl = document.getElementById('pantryModalNotes');

  titleEl.textContent = (opts && opts.title) ? String(opts.title) : 'Pantry Item';
  const init = (opts && opts.initial) ? opts.initial : {};

  // populate datalist for QtyNum
  ensureDatalist_('dlPantryQtyNum', META.qtyNumOptions);
  qtyNumEl.setAttribute('list', 'dlPantryQtyNum');

  // populate unit dropdown
  if (unitEl && unitCustomEl) {
    const currentUnit = String(init.Unit || '').trim();
    const predefinedUnits = META.unitOptions.filter(u => u !== '');

    // If current unit exists and not in predefined list, add it
    let allUnits = [...predefinedUnits];
    const isCustomUnit = currentUnit && !predefinedUnits.includes(currentUnit);
    if (isCustomUnit) {
      allUnits.push(currentUnit);
    }

    unitEl.innerHTML = '<option value="">-- Select Unit --</option>' +
      allUnits.map(u => `<option value="${escapeAttr(u)}">${escapeHtml(u)}</option>`).join('') +
      '<option value="__custom__">Other (Custom)</option>';

    // Set initial value
    if (isCustomUnit) {
      unitEl.value = currentUnit;
    } else if (currentUnit) {
      unitEl.value = currentUnit;
    }

    // Show/hide custom input based on selection
    unitEl.addEventListener('change', function () {
      if (this.value === '__custom__') {
        unitCustomEl.style.display = 'block';
        unitCustomEl.focus();
      } else {
        unitCustomEl.style.display = 'none';
        unitCustomEl.value = '';
      }
    });

    // If editing an item with a custom unit not in list, show it in dropdown
    // (already handled above by adding to allUnits)
  }

  // category options mirror ingredient categories
  if (categoryEl) {
    categoryEl.innerHTML = optionHtml_(META.categories, String(init.Category || ''));
    categoryEl.value = String(init.Category || '');
  }

  // populate store dropdown
  if (storeIdEl) {
    const storeNames = STORES.map(s => s.Name);
    const storeIds = STORES.map(s => s.StoreId);
    storeIdEl.innerHTML = '<option value="">-- None --</option>' +
      STORES.map(s => `<option value="${escapeAttr(s.StoreId)}">${escapeHtml(s.Name)}</option>`).join('');
    storeIdEl.value = String(init.StoreId || '');
  }

  nameEl.value = String(init.Name || '');
  qtyNumEl.value = (init.QtyNum === null || init.QtyNum === undefined) ? '' : String(init.QtyNum);
  unitEl.value = String(init.Unit || '');
  if (categoryEl) categoryEl.value = String(init.Category || '');
  qtyTextEl.value = String(init.QtyText || '');
  if (lowStockEl) lowStockEl.value = (init.low_stock_threshold === null || init.low_stock_threshold === undefined) ? '' : String(init.low_stock_threshold);
  if (expirationEl) expirationEl.value = String(init.expiration_date || '');
  if (storeIdEl) storeIdEl.value = String(init.StoreId || '');
  notesEl.value = String(init.Notes || '');
  errEl.textContent = '';

  // PHASE 3.3: Apply smart defaults for new items (only if no ItemId)
  if (!init.ItemId && !init.PantryId) {
    setTimeout(() => applyPantryDefaults(), 50);
  }

  overlay.style.display = 'flex';

  return await new Promise((resolve) => {
    let isSaving = false; // Prevent double submission

    function close_(res) {
      overlay.style.display = 'none';
      btnClose.removeEventListener('click', onCancel);
      btnCancel.removeEventListener('click', onCancel);
      btnSave.removeEventListener('click', onSave);
      resolve(res);
    }
    function onCancel() { close_({ ok: false, cancelled: true }); }
    async function onSave() {
      // Prevent double submission
      if (isSaving) return;

      const name = String(nameEl.value || '').trim();
      if (!name) { errEl.textContent = 'Name is required.'; return; }
      const qtyNum = qtyNumEl.value === '' ? null : Number(qtyNumEl.value);
      if (qtyNumEl.value !== '' && !Number.isFinite(qtyNum)) { errEl.textContent = 'Qty number must be numeric.'; return; }
      if (lowStockEl && lowStockEl.value !== '') {
        const t = Number(lowStockEl.value);
        if (!Number.isFinite(t) || t < 0) { errEl.textContent = 'Low stock threshold must be a non-negative number.'; return; }
      }

      // Get unit from dropdown or custom input
      let unit = String(unitEl.value || '').trim();
      if (unit === '__custom__') {
        unit = String(unitCustomEl.value || '').trim();
        if (!unit) { errEl.textContent = 'Please enter a custom unit.'; return; }

        // Auto-save new unit to META.unitOptions if not already there
        const predefinedUnits = META.unitOptions.filter(u => u !== '');
        if (!predefinedUnits.includes(unit)) {
          META.unitOptions.push(unit);
          console.log('Added new unit to list:', unit);
        }
      }

      const payload = {
        ItemId: init.ItemId || init.PantryId || null,
        Name: name,
        QtyNum: qtyNum,
        Unit: unit,
        Category: categoryEl ? String(categoryEl.value || '').trim() : '',
        low_stock_threshold: lowStockEl ? String(lowStockEl.value || '').trim() : '',
        expiration_date: expirationEl ? String(expirationEl.value || '').trim() : '',
        QtyText: String(qtyTextEl.value || '').trim(),
        StoreId: String(storeIdEl.value || '').trim(),
        Notes: String(notesEl.value || '').trim(),
      };

      // Set saving flag and disable button to prevent double submission
      isSaving = true;
      btnSave.disabled = true;
      btnSave.textContent = 'Saving...';

      try {
        console.log('[pantryModal] Saving item:', payload);
        const r = await api('upsertPantryItem', payload);
        if (!r.ok) {
          console.error('[pantryModal] Save failed:', r.error);
          errEl.textContent = r.error || 'Save error';
          return;
        }

        console.log('[pantryModal] Save success');

        // PHASE 3.3: Learn from user's choices
        try {
          learnFromPantryModal();
        } catch (e) {
          console.warn('[pantryModal] Failed to learn defaults:', e);
        }

        // Reload pantry list to show updated values
        await loadPantry();

        close_({ ok: true });
      } catch (e) {
        console.error('[pantryModal] Unexpected error:', e);
        errEl.textContent = 'Unexpected error: ' + e.message;
      } finally {
        isSaving = false;
        btnSave.disabled = false;
        btnSave.textContent = 'Save';
      }
    }

    btnClose.addEventListener('click', onCancel);
    btnCancel.addEventListener('click', onCancel);
    btnSave.addEventListener('click', onSave);
  });
}

function escapeHtml(s) { return String(s || '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]); }
function escapeAttr(s) { return escapeHtml(s).replace(/"/g, '&quot;'); }

// Convert image path to displayable URL
// Handles: local paths (images/xxx.jpg), full URLs (https://...), and empty/default
const DEFAULT_RECIPE_IMAGE = 'https://images.unsplash.com/photo-1495521821757-a1efb6729352?auto=format&fit=crop&q=80&w=800';
function getRecipeImageUrl(imageName) {
  if (!imageName) return DEFAULT_RECIPE_IMAGE;

  // Already a full URL
  if (imageName.startsWith('http://') || imageName.startsWith('https://')) {
    return imageName;
  }

  // Local path - use custom protocol
  if (imageName.startsWith('images/')) {
    return 'foodie-image://' + imageName.replace('images/', '');
  }

  // Legacy path format
  if (imageName.startsWith('data/images/')) {
    return 'foodie-image://' + imageName.replace('data/images/', '');
  }

  return DEFAULT_RECIPE_IMAGE;
}

// Debounce utility for auto-categorization
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

// ==================== DATE HELPERS ====================
function ymd(d) {
  const dt = (d instanceof Date) ? d : new Date(d);
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, '0');
  const da = String(dt.getDate()).padStart(2, '0');
  return `${y}-${m}-${da}`;
}
function addDays(dateYmd, days) {
  if (!dateYmd || typeof dateYmd !== 'string') {
    // try to handle date object or return current date as fallback
    if (dateYmd instanceof Date) return ymd(dateYmd);
    return ymd(new Date());
  }
  const [y, m, d] = dateYmd.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + Number(days || 0));
  return ymd(dt);
}

function daysInclusive(startYmd, endYmd) {
  if (!startYmd || !endYmd) return 0;
  const [sy, sm, sd] = String(startYmd).split('-').map(Number);
  const [ey, em, ed] = String(endYmd).split('-').map(Number);
  const s = new Date(sy, sm - 1, sd);
  const e = new Date(ey, em - 1, ed);
  const diff = Math.floor((e - s) / (24 * 60 * 60 * 1000));
  return diff + 1;
}

// ---------- global state ----------
let STORES = [];
let STORE_ID_TO_NAME = {};
let RECIPES = [];
let CURRENT_QUERY = '';
let LOADING = false;
let ACTIVE_USER = null; // Will be set by initUserSwitcher
let toastCounter = 0; // For showToast

// Early stub for showToast - actual implementation is later
function showToast(message, type = 'info', duration = 5000) {
  const container = document.getElementById('toast-container');
  if (!container) { console.log('[Toast]', type, message); return; }
  const toastId = `toast-${toastCounter++}`;
  const icons = { success: '✓', error: '✕', info: 'ℹ', warning: '⚠' };
  const toast = document.createElement('div');
  toast.id = toastId;
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `<span class="toast-icon">${icons[type] || 'ℹ'}</span><span class="toast-message">${message}</span><button class="toast-close" onclick="this.parentElement.remove()">×</button>`;
  container.appendChild(toast);
  setTimeout(() => toast.classList.add('show'), 10);
  setTimeout(() => { toast.classList.remove('show'); setTimeout(() => toast.remove(), 300); }, duration);
}

// Early stub for updateContextualHelpButton
function updateContextualHelpButton() {
  const helpBtn = document.getElementById('contextualHelpBtn');
  if (!helpBtn) return;
  const activeTab = document.querySelector('.tab.active');
  const tabName = activeTab ? activeTab.getAttribute('data-tab') : '';
  helpBtn.style.display = tabName === 'admin' ? 'none' : 'flex';
}

// Early stub for addToRecentRecipes - actual implementation is later
function addToRecentRecipes(recipeId, title, cuisine, mealType) {
  // No-op stub - will be overridden by actual implementation
  console.log('[addToRecentRecipes stub] Called with:', recipeId, title);
}

// ========== PHASE 2.3: Advanced Filter State ==========
const ADVANCED_FILTERS = {
  mealTypes: [],           // Array of selected meal types
  mustHaveIngredients: [], // Array of ingredients that must be present
  excludeIngredients: [],  // Array of ingredients to exclude
  active: false            // Whether advanced filters are active
};

// modal state (recipes)
let CURRENT_RECIPE_ID = '';
let ING_ROWS = [];
let recipeModalMode = 'view'; // view|edit|new

// Recipe scaling state
let RECIPE_SCALE = 1.0;
let RECIPE_BASE_SERVINGS = 4; // Default base servings
let RECIPE_ORIGINAL_ING_ROWS = []; // Store original quantities for scaling

// Auto-categorization debounce timer
let autoCatDebounceTimer = null;

// meal picker state
let MP = { open: false, date: '', slot: '', q: '', recipes: [] };

// planner state
let PLAN = { start: '', days: 14, plansByDate: {}, viewMode: 'grid' };

// Phase 3: Recipe Collections state
let COLLECTIONS = [];
let CURRENT_COLLECTION_ID = '';
let COLLECTION_RECIPES = [];

// ========== PHASE 2.4: Collection View Mode ==========
let COLLECTION_VIEW_MODE = 'card'; // 'card' or 'list'

// Phase 3: Grid view drag state
let DRAG_SOURCE = null;

// Phase 3: Meal pattern templates (stored in localStorage)
const MEAL_PATTERN_KEY = 'foodieMealPattern';

// Phase 1.3: Undo/Redo system
const UNDO = {
  stack: [],        // Array of undo actions (max 50)
  redoStack: [],    // Array of redo actions
  maxSize: 50       // Maximum undo history
};

// admin state
let BF = { token: '', totalUpdated: 0, totalScanned: 0 };
let CL = { token: '', totalDeleted: 0, totalScanned: 0 };

// ========== PHASE 9.1: QUERY RESULT CACHING ==========
const QUERY_CACHE = {
  recipes: null,           // Full recipe list cache
  recipesFetchTime: 0,     // Timestamp of last fetch
  recipeCacheTTL: 60000,   // Cache TTL: 60 seconds
  plans: new Map(),        // Map<dateKey, plan>
  plansFetchTime: new Map(), // Map<dateKey, timestamp>
  planCacheTTL: 30000,     // Cache TTL: 30 seconds
  ingredients: new Map(),  // Map<recipeId, ingredients[]>
  ingredientsFetchTime: new Map(),
  ingredientsCacheTTL: 120000, // Cache TTL: 2 minutes
  pantry: null,           // Pantry items cache
  pantryFetchTime: 0      // Timestamp of last pantry fetch
};

// ========== PHASE 9.4: SEARCH INDEX ==========
const SEARCH_INDEX = {
  index: null,              // Map<searchTerm, Set<recipeId>>
  recipeMap: null,          // Map<recipeId, recipe>
  lastBuiltTime: 0,
  lastSearchQuery: '',
  lastSearchResults: null
};

// ========== PHASE 9.2: VIRTUAL SCROLLING ==========
// NOTE: JS-based virtual scrolling is disabled because it doesn't work well with
// responsive CSS grids (auto-fill columns). Instead, we use CSS content-visibility: auto
// on .recipe-card for native browser-level rendering optimization. This provides
// similar performance benefits without the complexity of calculating dynamic grid layouts.
const VIRTUAL_SCROLL = {
  enabled: false,            // Disabled - using CSS content-visibility instead
  itemHeight: 404,          // 380px card + 24px gap
  bufferSize: 20,           // Number of items to render above/below viewport
  visibleRange: { start: 0, end: 50 },  // Currently visible range
  scrollTop: 0,             // Last scroll position
  containerHeight: 0,       // Viewport height
  totalItems: 0,            // Total number of filtered recipes
  filteredRecipes: []       // Current filtered recipe list
};

// Build search index for fast lookups
function buildSearchIndex_() {
  if (!RECIPES || !RECIPES.length) return;

  SEARCH_INDEX.index = new Map();
  SEARCH_INDEX.recipeMap = new Map();

  for (const recipe of RECIPES) {
    const rid = recipe.RecipeId;
    SEARCH_INDEX.recipeMap.set(rid, recipe);

    // Index title words
    const title = String(recipe.Title || '').toLowerCase();
    const titleWords = title.split(/\s+/);
    for (const word of titleWords) {
      if (word.length >= 2) { // Skip single-char words
        if (!SEARCH_INDEX.index.has(word)) {
          SEARCH_INDEX.index.set(word, new Set());
        }
        SEARCH_INDEX.index.get(word).add(rid);
      }
    }

    // Index full title
    if (!SEARCH_INDEX.index.has(title)) {
      SEARCH_INDEX.index.set(title, new Set());
    }
    SEARCH_INDEX.index.get(title).add(rid);

    // Index cuisine
    const cuisine = String(recipe.Cuisine || '').toLowerCase();
    if (cuisine) {
      if (!SEARCH_INDEX.index.has(cuisine)) {
        SEARCH_INDEX.index.set(cuisine, new Set());
      }
      SEARCH_INDEX.index.get(cuisine).add(rid);
    }

    // Index meal type
    const mealType = String(recipe.MealType || '').toLowerCase();
    if (mealType) {
      if (!SEARCH_INDEX.index.has(mealType)) {
        SEARCH_INDEX.index.set(mealType, new Set());
      }
      SEARCH_INDEX.index.get(mealType).add(rid);
    }
  }

  SEARCH_INDEX.lastBuiltTime = Date.now();
}

// Fast indexed search
function searchRecipesIndexed_(query) {
  if (!query) return RECIPES;

  const q = query.toLowerCase().trim();

  // Check if we've cached this exact search
  if (SEARCH_INDEX.lastSearchQuery === q && SEARCH_INDEX.lastSearchResults) {
    return SEARCH_INDEX.lastSearchResults;
  }

  if (!SEARCH_INDEX.index || !SEARCH_INDEX.recipeMap) {
    // Fallback to linear search if index not built
    return RECIPES.filter(r => {
      const title = String(r.Title || '').toLowerCase();
      return title.includes(q);
    });
  }

  // Split query into words for multi-word search
  const queryWords = q.split(/\s+/).filter(w => w.length >= 2);

  let matchingIds = null;

  // Check if query is a single word that exists in index
  if (queryWords.length === 1) {
    const word = queryWords[0];
    if (SEARCH_INDEX.index.has(word)) {
      matchingIds = new Set(SEARCH_INDEX.index.get(word));
    } else {
      // Partial match - check all index terms
      matchingIds = new Set();
      for (const [term, ids] of SEARCH_INDEX.index.entries()) {
        if (term.includes(word)) {
          for (const id of ids) {
            matchingIds.add(id);
          }
        }
      }
    }
  } else if (queryWords.length > 1) {
    // Multi-word: find recipes that match ALL words (AND logic)
    const wordSets = queryWords.map(word => {
      const matches = new Set();
      for (const [term, ids] of SEARCH_INDEX.index.entries()) {
        if (term.includes(word)) {
          for (const id of ids) {
            matches.add(id);
          }
        }
      }
      return matches;
    });

    // Intersection of all word matches
    matchingIds = wordSets.reduce((acc, set) => {
      const intersection = new Set();
      for (const id of acc) {
        if (set.has(id)) intersection.add(id);
      }
      return intersection;
    });
  } else {
    matchingIds = new Set();
  }

  // Convert IDs to recipe objects
  const results = Array.from(matchingIds).map(id => SEARCH_INDEX.recipeMap.get(id)).filter(Boolean);

  // Cache the results
  SEARCH_INDEX.lastSearchQuery = q;
  SEARCH_INDEX.lastSearchResults = results;

  return results;
}

// ========== PHASE 9.2: VIRTUAL SCROLL CALCULATION ==========
function calculateVisibleRange_() {
  const container = document.getElementById('recipesList');
  if (!container) return { start: 0, end: 50 };

  const scrollTop = container.scrollTop || 0;
  const containerHeight = container.clientHeight || 600;
  const scrollHeight = container.scrollHeight || 0;

  // Calculate which items are visible
  const startIndex = Math.max(0, Math.floor(scrollTop / VIRTUAL_SCROLL.itemHeight) - VIRTUAL_SCROLL.bufferSize);
  const endIndex = Math.min(
    VIRTUAL_SCROLL.totalItems,
    Math.ceil((scrollTop + containerHeight) / VIRTUAL_SCROLL.itemHeight) + VIRTUAL_SCROLL.bufferSize
  );

  return { start: startIndex, end: endIndex };
}

// Throttled scroll handler - stored as named function for proper removal
let _virtualScrollTimeout = null;
let _virtualScrollHandler = null;

function setupVirtualScrollListener_() {
  const container = document.getElementById('recipesList');
  if (!container) return;

  // Remove existing listener if any (must use same function reference)
  if (_virtualScrollHandler) {
    container.removeEventListener('scroll', _virtualScrollHandler);
  }

  // Create named handler for proper cleanup
  _virtualScrollHandler = function() {
    if (_virtualScrollTimeout) clearTimeout(_virtualScrollTimeout);

    _virtualScrollTimeout = setTimeout(() => {
      handleVirtualScroll_();
    }, 16); // ~60fps throttle
  };

  container.addEventListener('scroll', _virtualScrollHandler);
}

function handleVirtualScroll_() {
  if (!VIRTUAL_SCROLL.enabled) return;

  const newRange = calculateVisibleRange_();

  // Only re-render if range changed significantly (>5 items)
  if (Math.abs(newRange.start - VIRTUAL_SCROLL.visibleRange.start) > 5 ||
    Math.abs(newRange.end - VIRTUAL_SCROLL.visibleRange.end) > 5) {

    VIRTUAL_SCROLL.visibleRange = newRange;
    renderRecipes();
  }
}

// Check if cached data is still valid
function isCacheValid_(cacheTime, ttl) {
  if (!cacheTime) return false;
  return (Date.now() - cacheTime) < ttl;
}

// Clear all caches (call when data changes)
function clearAllCaches_() {
  QUERY_CACHE.recipes = null;
  QUERY_CACHE.recipesFetchTime = 0;
  QUERY_CACHE.plans.clear();
  QUERY_CACHE.plansFetchTime.clear();
  QUERY_CACHE.ingredients.clear();
  QUERY_CACHE.ingredientsFetchTime.clear();

  // PHASE 9.4: Clear search index
  SEARCH_INDEX.index = null;
  SEARCH_INDEX.recipeMap = null;
  SEARCH_INDEX.lastBuiltTime = 0;
  SEARCH_INDEX.lastSearchQuery = '';
  SEARCH_INDEX.lastSearchResults = null;
}

// Clear specific cache type
function clearCache_(type) {
  switch (type) {
    case 'recipes':
      QUERY_CACHE.recipes = null;
      QUERY_CACHE.recipesFetchTime = 0;
      // PHASE 9.4: Also clear search index
      SEARCH_INDEX.index = null;
      SEARCH_INDEX.recipeMap = null;
      SEARCH_INDEX.lastSearchQuery = '';
      SEARCH_INDEX.lastSearchResults = null;
      break;
    case 'plans':
      QUERY_CACHE.plans.clear();
      QUERY_CACHE.plansFetchTime.clear();
      break;
    case 'ingredients':
      QUERY_CACHE.ingredients.clear();
      QUERY_CACHE.ingredientsFetchTime.clear();
      break;
  }
}

// ========== PHASE 9.7: LAZY TAB LOADING ==========
const TAB_LOADED = {
  home: false,
  planner: false,
  recipes: false,
  collections: false,
  shop: false,
  pantry: false,
  admin: false
};

// Load tab data on-demand
async function ensureTabLoaded(tabName) {
  if (TAB_LOADED[tabName]) return; // Already loaded

  if (DEBUG) console.log(`[Lazy] Loading ${tabName} tab...`);

  switch (tabName) {
    case 'home':
      if (!TAB_LOADED.home || document.getElementById('dashboardDinnerTitle').textContent === 'Loading...') {
        await renderDashboard();
        TAB_LOADED.home = true;
      }
      break;

    case 'recipes':
      if (!TAB_LOADED.recipes || document.getElementById('recipesList').children.length === 0) {
        await resetAndLoadRecipes();
        populateBreakfastRecipeDropdown();
        TAB_LOADED.recipes = true;
      }
      break;

    case 'collections':
      if (!TAB_LOADED.collections || document.getElementById('collectionsList').children.length === 0) {
        await loadCollections();
        TAB_LOADED.collections = true;
      }
      break;

    case 'pantry':
      if (!TAB_LOADED.pantry || document.getElementById('pantryList').children.length === 0) {
        await loadPantry();
        TAB_LOADED.pantry = true;
      }
      break;

    case 'admin':
      if (!TAB_LOADED.admin) {
        await loadStores();
        await renderCuisineManagementUI();
        await loadBackupStatus();
        TAB_LOADED.admin = true;
      }
      break;

    case 'planner':
      if (!TAB_LOADED.planner || document.getElementById('planGrid').children.length === 0) {
        await loadPlan();
        TAB_LOADED.planner = true;
      }
      break;

    case 'shop':
      if (!TAB_LOADED.shop || document.getElementById('shopOut').children.length === 0) {
        if (SHOP.groups.length === 0) {
          renderShop_(SHOP.groups);
        } else {
          renderShop_(SHOP.groups);
        }
        TAB_LOADED.shop = true;
      }
      break;
  }
}

// ---------- tabbing ----------
async function setTab(tabName) {
  // Update tab button states and ARIA attributes
  document.querySelectorAll('.tab').forEach(t => {
    const isActive = t.dataset.tab === tabName;
    t.classList.toggle('active', isActive);
    t.setAttribute('aria-selected', isActive ? 'true' : 'false');
  });

  const tabElement = document.getElementById('tab-' + tabName);

  if (tabElement) {
    // Robust class-based toggling for tab panels
    document.querySelectorAll('section[id^="tab-"]').forEach(s => {
      s.classList.remove('active-view');
      s.style.display = '';
    });
    tabElement.classList.add('active-view');
    tabElement.style.display = 'block';
    tabElement.style.opacity = '1';
  }

  // Lazy load tab data
  await ensureTabLoaded(tabName);

  // Load cuisine management UI when Admin tab is shown
  if (tabName === 'admin') {
    await renderCuisineManagementUI();
    await loadBackupStatus();
  }

  // Update contextual help button visibility
  updateContextualHelpButton();
}

const tabsElement = document.getElementById('tabs');
if (tabsElement) {
  tabsElement.addEventListener('click', (e) => {
    const t = e.target.closest('.tab');
    if (!t) return;
    setTab(t.dataset.tab);
  });
} else {
  console.error('[CRITICAL] tabs element not found in DOM');
}

// ---------- stores ----------
async function loadStores() {
  const res = await api('listStores', {});
  if (!res.ok) throw new Error(res.error || 'listStores failed');
  STORES = res.stores || [];
  STORE_ID_TO_NAME = {};
  for (const s of STORES) STORE_ID_TO_NAME[String(s.StoreId)] = String(s.Name || '');
  renderStoreList();
}
function getStoreNameById(id) { return STORE_ID_TO_NAME[String(id || '')] || ''; }

// Get default store ID for Kroger (used for ingredient defaults)
function getDefaultStoreId() {
  const k = (STORES || []).find(s => String(s.Name || '').trim().toLowerCase() === 'kroger');
  return k ? String(k.StoreId) : '';
}

function renderStoreList() {
  const box = document.getElementById('storeList');
  if (!box) return;
  if (!STORES.length) { box.innerHTML = `<div class="muted">No stores yet. Add one above.</div>`; return; }
  box.innerHTML = `
        <div style="display:grid;grid-template-columns:1fr auto;gap:8px;padding:8px 10px;font-size:12px;font-weight:600;color:var(--muted);border-bottom:1px solid var(--line);margin-bottom:4px;">
          <div>STORE NAME</div>
          <div>ACTION</div>
        </div>
        ${STORES.map(s => `
          <div class="item" style="display:grid;grid-template-columns:1fr auto;gap:10px;padding:10px 10px;align-items:center;">
            <div>
              <strong>${escapeHtml(s.Name)}</strong>
              <span class="muted" style="margin-left:8px;">(${escapeHtml(s.StoreId)})</span>
            </div>
            <button class="danger" data-action="store-delete" data-storeid="${escapeAttr(s.StoreId)}" data-storename="${escapeAttr(s.Name)}" style="padding:6px 10px;font-size:12px;">Delete</button>
          </div>
        `).join('')}
      `;
}

// ---------- recipes (local: load all, no pagination) ----------
async function resetAndLoadRecipes() {
  if (LOADING) return;
  LOADING = true;
  try {
    const statusEl = document.getElementById('recipeStatus');
    if (statusEl) statusEl.textContent = 'Loading...';

    // PHASE 9.1: Check cache first
    const useCachedRecipes = !CURRENT_QUERY &&
      QUERY_CACHE.recipes &&
      isCacheValid_(QUERY_CACHE.recipesFetchTime, QUERY_CACHE.recipeCacheTTL);

    if (useCachedRecipes) {
      console.log(`[Phase 9.1] Using ${QUERY_CACHE.recipes.length} cached recipes`);
      RECIPES = QUERY_CACHE.recipes;
    } else {
      console.log('[Phase 9.1] Fetching recipes from database...');
      const userId = ACTIVE_USER?.userId || null;
      const res = await api('listRecipesAll', { q: CURRENT_QUERY, userId });
      console.log('[Phase 9.1] listRecipesAll response:', res.ok ? `Success (${res.recipes?.length || 0} recipes)` : `Error: ${res.error}`);

      if (!res.ok) throw new Error(res.error || 'listRecipesAll failed');
      RECIPES = res.recipes || [];
      console.log(`[Phase 9.1] Sorting ${RECIPES.length} recipes...`);

      // Cache the results (only if no search query)
      if (!CURRENT_QUERY) {
        QUERY_CACHE.recipes = RECIPES;
        QUERY_CACHE.recipesFetchTime = Date.now();
      }
      buildSearchIndex_();
    }

    renderRecipes();
    populateBreakfastRecipeDropdown();

    // Update status - use filtered count from VIRTUAL_SCROLL, not total RECIPES.length
    const filteredCount = VIRTUAL_SCROLL.totalItems || RECIPES.length;
    if (statusEl) statusEl.textContent = filteredCount ? 'Loaded.' : 'No matches.';

    console.log(`[Phase 9.7] Recipe loading complete. Found ${RECIPES.length} recipes, showing ${filteredCount}.`);
  } catch (e) {
    console.error('[Phase 9.7] Critical error in resetAndLoadRecipes:', e);
    const errStatusEl = document.getElementById('recipeStatus');
    if (errStatusEl) errStatusEl.textContent = `Error: ${String(e?.message || e)}`;
    showToast(`Failed to load recipes: ${e.message}`, 'error');
  } finally {
    LOADING = false;
  }
}

// Unified toggle favorite logic
let _favoriteToggleInProgress = false; // Prevent double-click race conditions

// ========== INCREMENTAL UPDATE HELPER ==========
// Update a single recipe card without full re-render (30-40% performance gain)
function updateRecipeCard(recipeId, updates) {
  const cards = document.querySelectorAll(`[data-recipe-id="${recipeId}"]`);

  cards.forEach(card => {
    // Update favorite star
    if (updates.is_favorite !== undefined) {
      const btn = card.querySelector('.card-action-btn[data-action="recipe-favorite"]');
      if (btn) {
        btn.innerHTML = updates.is_favorite ? '★' : '☆';
        btn.style.color = updates.is_favorite ? '#ffd700' : 'var(--muted)';
        btn.title = updates.is_favorite ? 'Remove from favorites' : 'Add to favorites';
      }
    }

    // Update title if provided
    if (updates.Title) {
      const titleEl = card.querySelector('.recipe-card-title');
      if (titleEl) titleEl.textContent = updates.Title;
    }

    // Update image if provided
    if (updates.Image_Name) {
      const imgEl = card.querySelector('.recipe-card-image');
      if (imgEl) imgEl.style.backgroundImage = `url('${getRecipeImageUrl(updates.Image_Name)}')`;
    }
  });
}

async function toggleRecipeFavorite(rid) {
  // Prevent double-click race conditions
  if (_favoriteToggleInProgress) return;
  _favoriteToggleInProgress = true;

  // Store original state for rollback
  let originalFavoriteState = null;

  try {
    // PHASE 4.5.4: Use user-specific favorites
    if (!ACTIVE_USER) {
      showToast('Please select a user first', 'error');
      return;
    }

    // OPTIMISTIC UPDATE: Update UI immediately
    const rMatch = RECIPES.find(item => item.RecipeId === rid) || (SEARCH_INDEX.recipeMap ? SEARCH_INDEX.recipeMap.get(rid) : null);
    const isCurrentlyFavorite = rMatch ? (rMatch.is_favorite === true || rMatch.is_favorite === 1 || rMatch.is_favorite === '1') : false;
    originalFavoriteState = isCurrentlyFavorite; // Store for rollback
    const isNowFavorite = !isCurrentlyFavorite; // Predict new state

    // Use incremental update for better performance
    updateRecipeCard(rid, { is_favorite: isNowFavorite });

    const res = await api('toggleUserFavorite', {
      userId: ACTIVE_USER.userId,
      recipeId: rid
    });

    if (res.ok) {
      const action = res.isFavorite ? 'added to' : 'removed from';
      showToast(`Recipe ${action} ${ACTIVE_USER.name}'s favorites`, 'success');

      // Update cached recipe data in RECIPES and SEARCH_INDEX.recipeMap
      const recipesToUpdate = [RECIPES];
      if (SEARCH_INDEX.recipeMap) {
        const indexedRecipe = SEARCH_INDEX.recipeMap.get(rid);
        if (indexedRecipe) recipesToUpdate.push([indexedRecipe]);
      }

      recipesToUpdate.forEach(list => {
        const r = list.find(item => item.RecipeId === rid);
        if (r) {
          r.is_favorite = res.isFavorite ? 1 : 0;
          // Also update the nested user_favorites if it exists
          if (!r.user_favorites) r.user_favorites = {};
          r.user_favorites[ACTIVE_USER.userId] = res.isFavorite;
        }
      });

      // Only full re-render if we are in "Favorites Only" mode (to remove the card)
      // Otherwise, our optimistic DOM update is sufficient and much faster
      if (document.getElementById('recipeFavoritesOnly')?.checked) {
        renderRecipes();
      }

      // Revert if API response mismatched (unlikely)
      if (res.isFavorite !== isNowFavorite) {
        updateRecipeCard(rid, { is_favorite: res.isFavorite });
      }
    } else {
      // Revert UI on error
      updateRecipeCard(rid, { is_favorite: originalFavoriteState });
      // Also revert cache to match original state
      const recipesToRevert = [RECIPES];
      if (SEARCH_INDEX.recipeMap) {
        const indexedRecipe = SEARCH_INDEX.recipeMap.get(rid);
        if (indexedRecipe) recipesToRevert.push([indexedRecipe]);
      }
      recipesToRevert.forEach(list => {
        const r = list.find(item => item.RecipeId === rid);
        if (r) {
          r.is_favorite = originalFavoriteState ? 1 : 0;
        }
      });
      showToast('Failed to toggle favorite', 'error');
    }
  } catch (err) {
    // On exception, revert to original state
    if (originalFavoriteState !== null) {
      updateRecipeCard(rid, { is_favorite: originalFavoriteState });
    }
    showToast('Error toggling favorite: ' + (err.message || 'Unknown error'), 'error');
  } finally {
    // Allow next toggle after a short delay to prevent rapid double-clicks
    setTimeout(() => {
      _favoriteToggleInProgress = false;
    }, 300);
  }
}
function renderRecipes() {
  // PHASE 9.2: Performance tracking
  const startTime = performance.now();

  const box = document.getElementById('recipesList');
  const showFavoritesOnly = document.getElementById('recipeFavoritesOnly')?.checked || false;
  const cuisineFilter = document.getElementById('recipeCuisineFilter')?.value || '';

  console.log(`[renderRecipes] Start. total RECIPES: ${RECIPES.length}, query: "${CURRENT_QUERY}"`);

  // Determine if this is a Jump A-Z single letter query
  const isJumpAZ = CURRENT_QUERY && CURRENT_QUERY.length === 1 && /^[a-zA-Z]$/.test(CURRENT_QUERY);

  // PHASE 9.4: Use indexed search if CURRENT_QUERY exists
  let recipesToShow;
  try {
    if (isJumpAZ) {
      // For A-Z jump, filter by title starting with the letter
      const letter = CURRENT_QUERY.toLowerCase();
      recipesToShow = RECIPES.filter(r => {
        const title = (r.Title || '').toLowerCase();
        return title.startsWith(letter);
      });
    } else if (CURRENT_QUERY) {
      recipesToShow = searchRecipesIndexed_(CURRENT_QUERY);
    } else {
      recipesToShow = RECIPES;
    }
  } catch (searchErr) {
    console.error('[renderRecipes] Search index failed, falling back to linear search', searchErr);
    recipesToShow = RECIPES.filter(r => (r.Title || '').toLowerCase().includes((CURRENT_QUERY || '').toLowerCase()));
  }

  // Filter recipes by favorites and cuisine
  if (showFavoritesOnly) {
    recipesToShow = recipesToShow.filter(r => {
      // Handle both boolean true and numeric 1
      return r.is_favorite === true || r.is_favorite === 1 || r.is_favorite === '1';
    });
  }
  if (cuisineFilter) {
    recipesToShow = recipesToShow.filter(r => {
      return r.Cuisine === cuisineFilter;
    });
  }

  // ========== PHASE 2.3: Apply Advanced Filters ==========
  if (ADVANCED_FILTERS.active) {
    // Filter by meal types
    if (ADVANCED_FILTERS.mealTypes.length > 0) {
      recipesToShow = recipesToShow.filter(r => {
        return ADVANCED_FILTERS.mealTypes.includes(r.MealType);
      });
    }

    // Filter by must-have and exclude ingredients
    if (ADVANCED_FILTERS.mustHaveIngredients.length > 0 || ADVANCED_FILTERS.excludeIngredients.length > 0) {
      recipesToShow = recipesToShow.filter(r => {
        // Check if recipe has ingredients (we need to check the recipe's ingredients)
        // For now, we'll filter based on what we can check from RECIPES data
        // Note: For full ingredient checking, we'd need to load ingredients for each recipe
        // which would be expensive. Let's use a simpler approach with recipe title/notes

        const searchableText = `${r.Title || ''} ${r.Notes || ''} ${r.Instructions || ''}`.toLowerCase();

        // Must have all required ingredients (simple text search)
        const hasMustHave = ADVANCED_FILTERS.mustHaveIngredients.every(ing => {
          return searchableText.includes(ing.toLowerCase());
        });

        // Must not have any excluded ingredients
        const hasExcluded = ADVANCED_FILTERS.excludeIngredients.some(ing => {
          return searchableText.includes(ing.toLowerCase());
        });

        return hasMustHave && !hasExcluded;
      });
    }
  }

  // ========== PHASE 9.2: Store filtered recipes for virtual scrolling ==========
  VIRTUAL_SCROLL.filteredRecipes = recipesToShow;
  VIRTUAL_SCROLL.totalItems = recipesToShow.length;

  // ========== PHASE 4.1: Enhanced Empty States ==========
  if (!recipesToShow.length) {
    // Determine if this is a filter result or truly empty
    const isFiltered = showFavoritesOnly || cuisineFilter || ADVANCED_FILTERS.active;
    const hasAnyRecipes = RECIPES.length > 0;

    if (isFiltered && hasAnyRecipes) {
      // Filtered view - no results
      const filterMsg = showFavoritesOnly && cuisineFilter
        ? `No ${cuisineFilter} favorite recipes found.`
        : showFavoritesOnly
          ? 'No favorite recipes found.'
          : cuisineFilter
            ? `No ${cuisineFilter} recipes found.`
            : 'No recipes match your current filters.';

      box.innerHTML = `
            <div class="empty-state">
              <div class="empty-state-icon">🔍</div>
              <div class="empty-state-title">${filterMsg}</div>
              <div class="empty-state-message">
                Try adjusting your filters or search criteria.
              </div>
              <div class="empty-state-actions">
                <button class="ghost" onclick="document.getElementById('recipeFavoritesOnly').checked = false; document.getElementById('recipeCuisineFilter').value = ''; ADVANCED_FILTERS.active = false; renderRecipes();">
                  Clear Filters
                </button>
              </div>
            </div>
          `;
    } else {
      // Truly empty - no recipes at all
      box.innerHTML = `
            <div class="empty-state">
              <div class="empty-state-icon">📚</div>
              <div class="empty-state-title">No recipes yet!</div>
              <div class="empty-state-message">
                Get started by importing recipes from your favorite<br>
                cooking websites or creating your own from scratch.
              </div>
              <div class="empty-state-actions">
                <button class="primary" onclick="document.getElementById('btnImportRecipe').click()">
                  Import from URL
                </button>
                <button class="ghost" onclick="openRecipeModalNew()">
                  Create New Recipe
                </button>
              </div>
            </div>
          `;
    }
    return;
  }

  // Group recipes by first letter with anchor IDs
  const letterGroups = {};
  recipesToShow.forEach(r => {
    const title = r.Title || '';
    const firstLetter = title.charAt(0).toUpperCase();
    const key = firstLetter.match(/[A-Z]/) ? firstLetter : '#';
    if (!letterGroups[key]) letterGroups[key] = [];
    letterGroups[key].push(r);
  });

  // Render in order: A-Z, then # for non-letter starts
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
  const sortedKeys = [...letters.filter(l => letterGroups[l]), ...(letterGroups['#'] ? ['#'] : [])];

  // ========== PHASE 9.2: VIRTUAL SCROLLING IMPLEMENTATION ==========
  if (VIRTUAL_SCROLL.enabled && recipesToShow.length > 100) {
    box.classList.remove('recipe-grid');
    console.log('[Phase 9.2] Rendering with virtual scrolling');

    // Calculate visible range
    const range = calculateVisibleRange_();

    // Flatten letter groups into single array with indices
    const flatRecipes = [];
    const headerIndices = [];  // Track where letter headers should appear

    sortedKeys.forEach(letter => {
      headerIndices.push({ index: flatRecipes.length, letter });
      flatRecipes.push(...letterGroups[letter]);
    });

    console.log('[Phase 9.2] Total flat recipes:', flatRecipes.length);
    console.log('[Phase 9.2] Visible range:', range.start, 'to', range.end);

    // Calculate total height for proper scrollbar
    const totalHeight = flatRecipes.length * VIRTUAL_SCROLL.itemHeight;
    console.log('[Phase 9.2] Total height:', totalHeight, 'px');

    // Get only visible recipes
    const visibleRecipes = flatRecipes.slice(range.start, range.end);
    const offsetTop = range.start * VIRTUAL_SCROLL.itemHeight;
    const offsetBottom = totalHeight - offsetTop - (visibleRecipes.length * VIRTUAL_SCROLL.itemHeight);

    console.log('[Phase 9.2] Offset top:', offsetTop, 'px, Offset bottom:', offsetBottom, 'px');
    console.log('[Phase 9.2] Visible recipes count:', visibleRecipes.length);

    // Render with grid layout
    box.innerHTML = `
          <div id="virtual-scroll-container" style="position: relative; height: ${totalHeight}px;">
            <div class="recipe-grid" style="position: absolute; top: ${offsetTop}px; left: 0; right: 0;">
              ${visibleRecipes.map(r => renderRecipeCard_(r)).join('')}
            </div>
          </div>
        `;

    // Setup scroll listener
    setupVirtualScrollListener_();
  } else {
    // ========== PRO-MAX GRID RENDERING ==========
    box.classList.add('recipe-grid');
    console.log(`[renderRecipes] Standard mode. Mapping ${recipesToShow.length} cards...`);

    try {
      const cardsHtml = recipesToShow.map(r => renderRecipeCard_(r)).join('');
      if (!cardsHtml && recipesToShow.length > 0) {
        console.error('[renderRecipes] Generated empty HTML for non-empty recipe list!');
      }
      box.innerHTML = cardsHtml;
    } catch (mapErr) {
      console.error('[renderRecipes] Failed to map recipe cards', mapErr);
      box.innerHTML = `<div class="error-state">Failed to render recipes. Please try refreshing.</div>`;
    }
  }

  // ========== PHASE 2.2: Setup recipe card drag-and-drop ==========
  setupRecipeDragAndDrop();

  // Event delegation handles all action button clicks (see document.addEventListener('click') below)

  // PHASE 9.2: Log render performance
  const renderTime = performance.now() - startTime;
  console.log(`[Phase 9.2] Rendered ${VIRTUAL_SCROLL.totalItems} recipes in ${renderTime.toFixed(2)}ms (Virtual scrolling: ${VIRTUAL_SCROLL.enabled && VIRTUAL_SCROLL.totalItems > 100 ? 'ON' : 'OFF'})`);

  // Update counts if they exist
  const pillCount = document.getElementById('pillCount');
  if (pillCount) pillCount.textContent = `Loaded: ${VIRTUAL_SCROLL.totalItems}`;

  // Reset and re-observe lazy images (prevents freeze on filter changes)
  if (window.resetImageObserver) {
    window.resetImageObserver();
  }
  if (window.observeLazyImages) {
    window.observeLazyImages();
  }
}

// ========== PHASE 9.2: Render individual recipe card (extracted for reuse) ==========
function renderRecipeCard_(r) {
  // Handle both boolean true and numeric 1 for is_favorite
  const isFavorite = r.is_favorite === true || r.is_favorite === 1 || r.is_favorite === '1';
  const starIcon = isFavorite ? '⭐' : '☆';
  const starColor = isFavorite ? '#ffd700' : 'var(--muted)';

  // ========== PHASE 4.4: Recipe Card Visual Icons ==========
  // Map cuisines and meal types to emojis
  const cuisineEmojiMap = {
    'Italian': '🍝',
    'Mexican': '🌮',
    'Chinese': '🥡',
    'Indian': '🍛',
    'Japanese': '🍣',
    'French': '🥖',
    'American': '🍔',
    'Thai': '🍜',
    'Mediterranean': '🫒',
    'Greek': '🥙',
    'Korean': '🍜',
    'Vietnamese': '🍜',
    'Spanish': '🥘',
    'Turkish': '🥙',
    'Middle Eastern': '🧆'
  };

  const mealTypeEmojiMap = {
    'Breakfast': '🍳',
    'Brunch': '🥐',
    'Lunch': '🥗',
    'Dinner': '🍽️',
    'Snack': '🍿',
    'Dessert': '🍰',
    'Appetizer': '🍤',
    'Side Dish': '🥔',
    'Beverage': '☕'
  };

  // Get emoji - try cuisine first, then meal type, then default
  const recipeEmoji = cuisineEmojiMap[r.Cuisine] || mealTypeEmojiMap[r.MealType] || '📖';

  return `
    <div class="recipe-card animate-in" 
         draggable="true"
         data-recipe-id="${escapeAttr(r.RecipeId)}" 
         data-recipe-title="${escapeAttr(r.Title || '')}">
      
      <!-- Pinterest Badge (Cuisine) -->
      ${r.Cuisine ? `<div class="recipe-card-badge">${escapeHtml(r.Cuisine)}</div>` : ''}
      
      <!-- Recipe Image (Lazy Loaded) -->
      <div class="recipe-card-image lazy-image" 
           data-src="${escapeAttr(getRecipeImageUrl(r.Image_Name || r.Image))}"
           style="background-color: #f0f0f0"></div>
      
      <!-- Quick Actions (Top Left) -->
      <div class="recipe-card-actions">
        <button class="card-action-btn" data-action="recipe-favorite" data-rid="${escapeAttr(r.RecipeId)}" 
                title="${isFavorite ? 'Remove from favorites' : 'Add to favorites'}"
                style="color: ${starColor}">
          ${starIcon}
        </button>
        <button class="card-action-btn" data-action="quick-assign" data-rid="${escapeAttr(r.RecipeId)}" title="Assign to date">📅</button>
        <button class="card-action-btn" data-action="quick-collection" data-rid="${escapeAttr(r.RecipeId)}" title="Add to collection">📦</button>
      </div>

      <!-- Content Overlay -->
      <div class="recipe-card-overlay">
        <div class="recipe-card-title">${escapeHtml(r.Title || 'Untitled Recipe')}</div>
        <div class="recipe-card-meta">
          <span>${recipeEmoji} ${escapeHtml(r.MealType || 'Any')}</span>
          ${r.PrepTimeMinutes ? `<span>• ⏱️ ${r.PrepTimeMinutes}m</span>` : ''}
        </div>
      </div>
      
      <!-- Hidden Checkbox for multi-select -->
      <input type="checkbox" class="recipe-select-checkbox" 
             style="position:absolute; top:12px; right:12px; z-index:10; opacity:0;" 
             data-recipe-id="${escapeAttr(r.RecipeId)}" />
    </div>
  `;
}

// ========== PHASE 2.2: Recipe Drag & Drop Setup ==========
function setupRecipeDragAndDrop() {
  const recipeCards = document.querySelectorAll('.recipe-card[draggable="true"]');

  recipeCards.forEach(card => {
    card.addEventListener('dragstart', (e) => {
      card.classList.add('dragging');

      const recipeId = card.getAttribute('data-recipe-id');
      const recipeTitle = card.getAttribute('data-recipe-title');

      DRAG_SOURCE = {
        type: 'recipe',  // Type: recipe (for assignment)
        recipeId: recipeId,
        title: recipeTitle
      };

      e.dataTransfer.effectAllowed = 'copy';
      e.dataTransfer.setData('text/plain', JSON.stringify(DRAG_SOURCE));

      // Create custom drag image
      const dragGhost = document.createElement('div');
      dragGhost.className = 'drag-ghost';
      dragGhost.textContent = `📅 ${recipeTitle}`;
      dragGhost.style.position = 'fixed';
      dragGhost.style.top = '-1000px';
      document.body.appendChild(dragGhost);
      e.dataTransfer.setDragImage(dragGhost, 0, 0);

      // Clean up ghost after drag starts
      setTimeout(() => {
        if (dragGhost && dragGhost.parentNode) {
          dragGhost.parentNode.removeChild(dragGhost);
        }
      }, 0);
    });

    card.addEventListener('dragend', () => {
      card.classList.remove('dragging');
      DRAG_SOURCE = null;
    });
  });
}

// Setup direct click handlers on recipe card action buttons
// REMOVED: This function caused duplicate event handlers leading to favorite button
// opening recipe modal. Event delegation in document.addEventListener('click') handles all actions.
// Keeping this comment for documentation purposes.

// ---------- recipe modal ----------
function openRecipeModal() { openModal('recipeModalBack'); }
function closeRecipeModal(e) {
  if (e) {
    e.preventDefault();
    e.stopPropagation();
  }
  closeModal('recipeModalBack');
  // Reset scale when closing modal
  resetRecipeScale();
}

function setRecipeModalMode(mode) {
  recipeModalMode = mode;
  const editable = (mode === 'edit' || mode === 'new');

  document.getElementById('rmTitle').textContent =
    mode === 'view' ? 'View Recipe' : (mode === 'new' ? 'Add Recipe' : 'Edit Recipe');
  document.getElementById('btnModalToggleEdit').textContent = (mode === 'view') ? 'Edit' : 'View';

  ['rTitle', 'rUrl', 'rImage', 'rCuisine', 'rMealType', 'rInstructions', 'rNotes'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.disabled = !editable;
  });

  document.getElementById('modalActions').style.display = editable ? '' : 'none';
  document.getElementById('viewModeActions').style.display = editable ? 'none' : '';

  const btnPrint = document.getElementById('btnModalPrintRecipe');
  if (btnPrint) {
    btnPrint.style.display = (mode === 'new') ? 'none' : '';
  }

  const url = (document.getElementById('rUrl').value || '').trim();
  document.getElementById('rUrlView').innerHTML = url ? `<a href="${escapeAttr(url)}" target="_blank" rel="noreferrer">Open recipe link</a>` : '';

  // Ensure ingredients table re-renders to show/hide edit controls (like Remove button)
  renderIngredientsTable();
}

function toggleRecipeModalMode() {
  if (recipeModalMode === 'view') setRecipeModalMode('edit');
  else setRecipeModalMode('view');
}

// ============= PHASE 5.2: RECIPE TEMPLATES =============

// Recipe template definitions
const RECIPE_TEMPLATES = {
  blank: {
    id: 'blank',
    name: 'Blank Recipe',
    icon: '📝',
    description: 'Start from scratch with no pre-filled content',
    instructions: '',
    ingredientPlaceholders: [],
    tips: 'Add your recipe details below'
  },
  basic: {
    id: 'basic',
    name: 'Basic Recipe',
    icon: '🍳',
    description: 'Simple recipe with standard structure',
    instructions: `1. Prepare ingredients and gather equipment
2. [First cooking step]
3. [Second cooking step]
4. [Third cooking step]
5. Serve and enjoy!`,
    ingredientPlaceholders: [
      { raw: '2 cups main ingredient', category: 'Produce' },
      { raw: '1 tbsp seasoning', category: 'Spices' },
      { raw: '2 tbsp oil or butter', category: 'Oils & Condiments' }
    ],
    tips: 'Replace placeholder text with your actual ingredients and steps'
  },
  onePot: {
    id: 'onePot',
    name: 'One-Pot Meal',
    icon: '🍲',
    description: 'Everything cooks in a single pot or pan',
    instructions: `1. Heat oil in a large pot or Dutch oven over medium heat
2. Add aromatics (onion, garlic) and sauté until fragrant
3. Add protein and brown on all sides
4. Add vegetables and liquid (broth/water)
5. Bring to boil, then reduce to simmer
6. Cover and cook until tender (20-30 minutes)
7. Season to taste and serve`,
    ingredientPlaceholders: [
      { raw: '2 tbsp olive oil', category: 'Oils & Condiments' },
      { raw: '1 onion, diced', category: 'Produce' },
      { raw: '3 cloves garlic, minced', category: 'Produce' },
      { raw: '1 lb protein (chicken, beef, etc.)', category: 'Meat' },
      { raw: '2 cups vegetables', category: 'Produce' },
      { raw: '4 cups broth or stock', category: 'Pantry' }
    ],
    tips: 'One-pot meals are great for easy cleanup and deep flavors'
  },
  bakedGoods: {
    id: 'bakedGoods',
    name: 'Baked Goods',
    icon: '🧁',
    description: 'Cakes, cookies, breads, and pastries',
    instructions: `1. Preheat oven to [temperature]°F
2. Grease and flour baking pan(s)
3. Mix dry ingredients in one bowl (flour, baking powder, salt)
4. Mix wet ingredients in another bowl (eggs, milk, oil/butter)
5. Combine wet and dry ingredients until just mixed
6. Pour batter into prepared pan(s)
7. Bake for [time] minutes until [doneness test]
8. Cool in pan for 10 minutes, then transfer to wire rack`,
    ingredientPlaceholders: [
      { raw: '2 cups all-purpose flour', category: 'Baking' },
      { raw: '1 cup sugar', category: 'Baking' },
      { raw: '2 tsp baking powder', category: 'Baking' },
      { raw: '1/2 tsp salt', category: 'Spices' },
      { raw: '2 eggs', category: 'Dairy' },
      { raw: '1 cup milk', category: 'Dairy' },
      { raw: '1/2 cup butter or oil', category: 'Dairy' }
    ],
    tips: 'Don\'t overmix batter - mix until just combined for tender results'
  },
  slowCooker: {
    id: 'slowCooker',
    name: 'Slow Cooker',
    icon: '🥘',
    description: 'Set it and forget it slow cooker meals',
    instructions: `1. Prepare and chop all ingredients
2. Layer ingredients in slow cooker (usually protein on bottom, vegetables on top)
3. Add liquid (broth, sauce, or water)
4. Add seasonings and aromatics
5. Cover and cook on LOW for 6-8 hours or HIGH for 3-4 hours
6. Check for doneness and adjust seasoning
7. Serve hot`,
    ingredientPlaceholders: [
      { raw: '2 lbs protein (chicken, beef, pork)', category: 'Meat' },
      { raw: '3 cups vegetables, chopped', category: 'Produce' },
      { raw: '1 cup liquid (broth, sauce)', category: 'Pantry' },
      { raw: '1 onion, sliced', category: 'Produce' },
      { raw: '3 cloves garlic, minced', category: 'Produce' },
      { raw: 'Seasonings to taste', category: 'Spices' }
    ],
    tips: 'Slow cooking develops deep flavors - perfect for tough cuts of meat'
  },
  salad: {
    id: 'salad',
    name: 'Salad',
    icon: '🥗',
    description: 'Fresh salads and dressings',
    instructions: `1. Wash and dry all greens thoroughly
2. Chop or tear greens into bite-sized pieces
3. Prepare additional vegetables and toppings
4. Make dressing: whisk together oil, acid (vinegar/lemon), and seasonings
5. Place greens in large bowl
6. Add vegetables and toppings
7. Toss with dressing just before serving (or serve dressing on the side)`,
    ingredientPlaceholders: [
      { raw: '6 cups mixed greens', category: 'Produce' },
      { raw: '1 cup vegetables (tomatoes, cucumbers, etc.)', category: 'Produce' },
      { raw: '1/4 cup nuts or seeds', category: 'Nuts & Seeds' },
      { raw: '1/4 cup cheese (optional)', category: 'Dairy' },
      { raw: '3 tbsp olive oil', category: 'Oils & Condiments' },
      { raw: '1 tbsp vinegar or lemon juice', category: 'Oils & Condiments' },
      { raw: 'Salt and pepper to taste', category: 'Spices' }
    ],
    tips: 'Keep dressing separate until ready to serve to prevent wilting'
  },
  stirFry: {
    id: 'stirFry',
    name: 'Stir-Fry',
    icon: '🍜',
    description: 'Quick high-heat cooking in a wok or pan',
    instructions: `1. Prepare all ingredients before starting (mise en place is crucial)
2. Heat wok or large skillet over high heat until smoking
3. Add oil and swirl to coat
4. Add protein and stir-fry until just cooked, remove and set aside
5. Add harder vegetables (carrots, broccoli) and stir-fry 2-3 minutes
6. Add softer vegetables (peppers, snow peas) and stir-fry 1-2 minutes
7. Return protein to pan
8. Add sauce and toss everything together until heated through
9. Serve immediately over rice or noodles`,
    ingredientPlaceholders: [
      { raw: '2 tbsp vegetable oil', category: 'Oils & Condiments' },
      { raw: '1 lb protein, sliced thin', category: 'Meat' },
      { raw: '3 cups mixed vegetables', category: 'Produce' },
      { raw: '2 cloves garlic, minced', category: 'Produce' },
      { raw: '1 tbsp ginger, minced', category: 'Produce' },
      { raw: '1/4 cup stir-fry sauce', category: 'Oils & Condiments' }
    ],
    tips: 'High heat and constant motion are key - don\'t overcrowd the pan'
  }
};

// Show template selector modal
function showRecipeTemplateSelector() {
  const modal = document.createElement('div');
  modal.className = 'modalBack';
  modal.id = 'templateSelectorModal';
  modal.style.zIndex = '115';
  modal.style.display = 'flex';

  modal.innerHTML = `
        <div class="modal" style="max-width: 800px; width: 90vw;">
          <div class="modalHead">
            <h2 style="margin:0;">Choose a Recipe Template</h2>
            <button class="ghost mini" onclick="closeTemplateSelector()">✕</button>
          </div>
          
          <div style="margin: 16px 0; color: var(--muted); font-size: 14px;">
            Templates provide helpful structure and guidance for common recipe types.
          </div>
          
          <div class="template-grid">
            ${Object.values(RECIPE_TEMPLATES).map(template => `
              <div class="template-card" onclick="selectRecipeTemplate('${template.id}')">
                <div class="template-card-icon">${template.icon}</div>
                <div class="template-card-name">${template.name}</div>
                <div class="template-card-description">${template.description}</div>
              </div>
            `).join('')}
          </div>
        </div>
      `;

  document.body.appendChild(modal);

  // Close on backdrop click
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      closeTemplateSelector();
    }
  });
}

// Close template selector
function closeTemplateSelector() {
  const modal = document.getElementById('templateSelectorModal');
  if (modal) modal.remove();
}

// Apply selected template
async function selectRecipeTemplate(templateId) {
  const template = RECIPE_TEMPLATES[templateId];
  if (!template) return;

  closeTemplateSelector();

  await ensureStoresAndCategoriesLoaded();

  // Clear current recipe data
  CURRENT_RECIPE_ID = '';
  document.getElementById('rTitle').value = '';
  document.getElementById('rUrl').value = '';
  document.getElementById('rImage').value = '';
  setCuisineSelect_('');
  document.getElementById('rMealType').value = 'Any';
  document.getElementById('rNotes').value = template.tips || '';
  document.getElementById('rInstructions').value = template.instructions || '';

  // Set up ingredient placeholders
  ING_ROWS = template.ingredientPlaceholders.map((ing, idx) => ({
    IngredientNorm: '',
    IngredientRaw: ing.raw,
    Notes: '',
    QtyNum: '',
    QtyText: '',
    StoreId: getDefaultStoreId() || '',
    Unit: '',
    Category: ing.category || '',
    idx: idx
  }));

  RECIPE_ORIGINAL_ING_ROWS = [];
  RECIPE_SCALE = 1.0;
  updateScaleDisplay();

  // Open the recipe modal in new mode
  openRecipeModal();
  setRecipeModalMode('new');
  renderIngredientsTable();

  // Apply smart defaults after a short delay
  setTimeout(() => applyRecipeDefaults(), 50);

  // Show success toast
  showToast(`✓ Applied ${template.name} template`, 'success', 2000);
}

// Modified openRecipeModalNew to show template selector
async function openRecipeModalNew() {
  // Show template selector instead of directly opening blank recipe
  showRecipeTemplateSelector();
}

async function ensureStoresAndCategoriesLoaded() {
  console.log('[ensureStoresAndCategoriesLoaded] STORES.length:', STORES?.length, 'META.categories.length:', META?.categories?.length, 'categoriesLoaded:', META.categoriesLoaded);
  if (!STORES || STORES.length === 0) {
    try {
      console.log('[ensureStoresAndCategoriesLoaded] Loading stores...');
      const res = await api('listStores', {});
      console.log('[ensureStoresAndCategoriesLoaded] listStores result:', res);
      if (res.ok && res.stores) {
        STORES = res.stores;
        STORE_ID_TO_NAME = {};
        for (const s of STORES) STORE_ID_TO_NAME[String(s.StoreId)] = String(s.Name || '');
        console.log('[ensureStoresAndCategoriesLoaded] STORES loaded:', STORES.length);
      }
    } catch (e) {
      console.error('Failed to load stores:', e);
    }
  }
  // Load categories from database if not already loaded
  if (!META.categoriesLoaded) {
    try {
      console.log('[ensureStoresAndCategoriesLoaded] Loading categories from database...');
      const catRes = await api('getIngredientCategories', {});
      console.log('[ensureStoresAndCategoriesLoaded] getIngredientCategories result:', catRes);
      if (catRes && catRes.ok && Array.isArray(catRes.categories) && catRes.categories.length > 0) {
        META.categories = [''].concat(catRes.categories);
        META.categoriesLoaded = true;
        console.log('[ensureStoresAndCategoriesLoaded] META.categories loaded from DB:', META.categories);
      } else {
        META.categories = [''].concat(DEFAULT_ING_CATEGORIES);
        META.categoriesLoaded = true;
        console.log('[ensureStoresAndCategoriesLoaded] Using default categories:', META.categories.length);
      }
    } catch (e) {
      console.error('Failed to load categories:', e);
      META.categories = [''].concat(DEFAULT_ING_CATEGORIES);
      META.categoriesLoaded = true;
    }
  }
  console.log('[ensureStoresAndCategoriesLoaded] FINAL - STORES:', STORES?.length, 'META.categories:', META?.categories?.length);
}

let _recipeModalLoading = false; // Prevent parallel modal loads

async function openRecipeModalView(recipeId) {
  if (_recipeModalLoading) return;
  _recipeModalLoading = true;

  console.log('[openRecipeModalView] Called with recipeId:', recipeId);
  try {
    await ensureStoresAndCategoriesLoaded();
    const res = await api('getRecipe', { recipeId });
    console.log('[openRecipeModalView] getRecipe result:', res);
    if (!res.ok) { showToast(res.error || 'Failed to load recipe', 'error'); return; }
    const r = res.recipe || {};
    console.log('[openRecipeModalView] Recipe object:', JSON.stringify(r));
    console.log('[openRecipeModalView] Recipe URL from API:', r.URL);
    console.log('[openRecipeModalView] Recipe URL type:', typeof r.URL);

    // DEBUG: Show toast with URL status (remove after debugging)
    if (r.URL) {
      console.log('[DEBUG] URL exists:', r.URL.substring(0, 50) + '...');
    } else {
      console.log('[DEBUG] URL is empty or undefined');
    }

    CURRENT_RECIPE_ID = r.RecipeId || '';

    document.getElementById('rTitle').value = r.Title || '';
    document.getElementById('rUrl').value = r.URL || '';
    console.log('[openRecipeModalView] After setting rUrl.value:', document.getElementById('rUrl').value);
    document.getElementById('rImage').value = r.Image_Name || r.Image || '';
    setCuisineSelect_(r.Cuisine || '');
    document.getElementById('rMealType').value = r.MealType || 'Any';
    document.getElementById('rNotes').value = r.Notes || '';
    document.getElementById('rInstructions').value = r.Instructions || '';

    await loadIngredientsForCurrentRecipe();
    // Note: loadIngredientsForCurrentRecipe already calls renderIngredientsTable()
    console.log('[openRecipeModalView] After loadIngredients, rUrl.value:', document.getElementById('rUrl').value);

    openRecipeModal();
    console.log('[openRecipeModalView] After openRecipeModal, rUrl.value:', document.getElementById('rUrl').value);
    setRecipeModalMode('view');
    console.log('[openRecipeModalView] After setRecipeModalMode, rUrl.value:', document.getElementById('rUrl').value);
    // Do NOT call renderIngredientsTable() again here - it was already called in loadIngredientsForCurrentRecipe()
    console.log('[openRecipeModalView] rUrlView.innerHTML:', document.getElementById('rUrlView').innerHTML);

    // ========== PHASE 3.1: Add to recent history ==========
    addToRecentRecipes(r.RecipeId, r.Title, r.Cuisine, r.MealType);
  } catch (err) {
    console.error('[openRecipeModalView] Error:', err);
    showToast('Error loading recipe', 'error');
  } finally {
    _recipeModalLoading = false;
  }
}

async function openRecipeModalEdit(recipeId) {
  await openRecipeModalView(recipeId);
  setRecipeModalMode('edit');
}

async function showRecipeModal(recipeId) {
  await openRecipeModalView(recipeId);
}

async function loadIngredientsForCurrentRecipe() {
  ING_ROWS = [];
  if (!CURRENT_RECIPE_ID) {
    RECIPE_ORIGINAL_ING_ROWS = [];
    RECIPE_SCALE = 1.0;
    updateScaleDisplay();
    renderIngredientsTable();
    return;
  }

  const res = await api('listRecipeIngredients', { recipeId: CURRENT_RECIPE_ID });
  if (!res.ok) {
    RECIPE_ORIGINAL_ING_ROWS = [];
    RECIPE_SCALE = 1.0;
    updateScaleDisplay();
    renderIngredientsTable();
    return;
  }

  ING_ROWS = (res.items || []).map(x => ({
    IngredientNorm: x.IngredientNorm || '',
    IngredientRaw: x.IngredientRaw || '',
    Notes: x.Notes || '',
    QtyNum: (x.QtyNum === '' || x.QtyNum === null || x.QtyNum === undefined) ? '' : String(x.QtyNum),
    QtyText: cleanQtyText(x.QtyText || ''),  // Clean date strings from QtyText
    StoreId: x.StoreId || getDefaultStoreId() || '',
    Unit: x.Unit || '',
    Category: x.Category || '',
    idx: (x.idx === '' || x.idx === null || x.idx === undefined) ? '' : Number(x.idx),
  }));

  // Store original rows for scaling
  RECIPE_ORIGINAL_ING_ROWS = JSON.parse(JSON.stringify(ING_ROWS));
  RECIPE_SCALE = 1.0;
  updateScaleDisplay();
  renderIngredientsTable();
  document.getElementById('rmStatus').textContent = '';
}

// Apply current scale to ING_ROWS (used for printing scaled quantities)
function applyCurrentScaleToDisplay(forceRefresh = false) {
  // Always re-apply if forceRefresh is true (e.g., for print operations)
  if (forceRefresh) {
    ING_ROWS = RECIPE_ORIGINAL_ING_ROWS.map(row => {
      const scaled = { ...row };
      if (row.QtyNum !== '' && row.QtyNum !== null && row.QtyNum !== undefined) {
        const originalNum = parseFloat(row.QtyNum);
        if (!isNaN(originalNum)) {
          scaled.QtyNum = String(Math.round(originalNum * RECIPE_SCALE * 100) / 100);
        }
      }
      return scaled;
    });
    renderIngredientsTable();
    return;
  }

  // Check if scaling is needed: if RECIPE_SCALE is 1.0, no scaling needed
  if (RECIPE_SCALE === 1.0) {
    return; // No scaling needed, ING_ROWS already has original values
  }

  // Only apply scale if ING_ROWS matches original (not already scaled)
  // Compare first row's QtyNum to detect if already scaled
  const originalFirst = RECIPE_ORIGINAL_ING_ROWS[0];
  const currentFirst = ING_ROWS[0];

  if (originalFirst && currentFirst) {
    const originalNum = originalFirst.QtyNum ? parseFloat(originalFirst.QtyNum) : null;
    const currentNum = currentFirst.QtyNum ? parseFloat(currentFirst.QtyNum) : null;

    // If current already matches scaled value, don't re-scale
    if (originalNum !== null && currentNum !== null) {
      const expectedScaled = Math.round(originalNum * RECIPE_SCALE * 100) / 100;
      if (Math.abs(currentNum - expectedScaled) < 0.001) {
        return; // Already scaled, no need to re-apply
      }
    }
  }

  // Apply scaling from original
  ING_ROWS = RECIPE_ORIGINAL_ING_ROWS.map(row => {
    const scaled = { ...row };
    if (row.QtyNum !== '' && row.QtyNum !== null && row.QtyNum !== undefined) {
      const originalNum = parseFloat(row.QtyNum);
      if (!isNaN(originalNum)) {
        scaled.QtyNum = String(Math.round(originalNum * RECIPE_SCALE * 100) / 100);
      }
    }
    return scaled;
  });
  renderIngredientsTable();
}

// ---------- Recipe Scaling ----------
function updateScaleDisplay() {
  const scaleValueEl = document.getElementById('scaleValue');
  if (scaleValueEl) {
    scaleValueEl.textContent = RECIPE_SCALE.toFixed(1) + 'x';
  }
}

function scaleRecipe(factor) {
  const newScale = Math.round((RECIPE_SCALE + factor) * 10) / 10;
  if (newScale < 0.1 || newScale > 10) return; // Limit scale range

  RECIPE_SCALE = newScale;

  // Scale the displayed quantities
  ING_ROWS = RECIPE_ORIGINAL_ING_ROWS.map(row => {
    const scaled = { ...row };
    if (row.QtyNum !== '' && row.QtyNum !== null && row.QtyNum !== undefined) {
      const originalNum = parseFloat(row.QtyNum);
      if (!isNaN(originalNum)) {
        scaled.QtyNum = String(Math.round(originalNum * RECIPE_SCALE * 100) / 100);
      }
    }
    return scaled;
  });

  updateScaleDisplay();
  renderIngredientsTable();
}

function resetRecipeScale() {
  RECIPE_SCALE = 1.0;
  ING_ROWS = JSON.parse(JSON.stringify(RECIPE_ORIGINAL_ING_ROWS));
  updateScaleDisplay();
  renderIngredientsTable();
}

// ---------- Auto-Categorization ----------
// Debounce timer reference for cleanup (declared in global state)

const debouncedClassify = debounce(async (idx, ingredientName) => {
  if (!ingredientName || ingredientName.trim().length < 2) return;
  if (recipeModalMode === 'view') return;

  const res = await api('classifyIngredient', { name: ingredientName });
  if (res.ok && res.category && ING_ROWS[idx]) {
    // Only auto-set if current category is empty/default
    if (!ING_ROWS[idx].Category || ING_ROWS[idx].Category === '') {
      ING_ROWS[idx].Category = res.category;
      renderIngredientsTable();
    }
  }
}, 500); // 500ms debounce

function triggerAutoClassify(idx, ingredientName) {
  debouncedClassify(idx, ingredientName);
}

// Auto-categorize ALL ingredients (called when loading recipe and when clicking Categorize All)
async function categorizeAllIngredients() {
  if (recipeModalMode === 'view') return;

  const statusEl = document.getElementById('rmStatus');
  statusEl.textContent = 'Categorizing...';

  let categorized = 0;
  let failed = 0;

  for (let i = 0; i < ING_ROWS.length; i++) {
    const row = ING_ROWS[i];
    const name = row.IngredientRaw || row.IngredientNorm;
    if (!name || name.trim().length < 2) continue;

    // Always classify, even if category already exists (to update/fix)
    const res = await api('classifyIngredient', { name });
    console.log(`Categorizing "${name}":`, res);

    if (res.ok && res.category) {
      ING_ROWS[i].Category = res.category;
      categorized++;
    } else {
      failed++;
    }

    // Small delay to avoid overwhelming the API
    await new Promise(r => setTimeout(r, 10));
  }

  renderIngredientsTable();

  if (categorized > 0) {
    statusEl.textContent = `Categorized ${categorized} ingredient(s).${failed > 0 ? ` (${failed} failed)` : ''}`;
  } else if (failed > 0) {
    statusEl.textContent = 'Could not categorize ingredients.';
  } else {
    statusEl.textContent = 'All ingredients already categorized.';
  }

  // Clear status after 3 seconds
  setTimeout(() => { if (statusEl.textContent.includes('Categorized')) statusEl.textContent = ''; }, 3000);
}

// Train category for an ingredient
async function trainIngredientCategory(idx, ingredientName, category) {
  if (!ingredientName || !category || recipeModalMode === 'view') return;

  const res = await api('trainIngredientCategory', { name: ingredientName, category });
  if (res.ok) {
    console.log(`Learned: "${ingredientName}" → "${category}"`);
  }
}

// Helper to clean date strings from QtyText (fractions like 1/2 were parsed as dates)
function cleanQtyText(qtyText) {
  if (!qtyText) return '';
  // Remove date strings that were mistakenly parsed from fractions
  // Pattern matches: "Fri Jan 02 2026 00:00:00 GMT-0500 (Eastern Standard Time)" or similar
  const datePattern = /^(Mon|Tue|Wed|Thu|Fri|Sat|Sun)\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2}\s+\d{4}\s+\d{2}:\d{2}:\d{2}\s+GMT[-+]\d{4}\s+\([^)]+\)\s*/i;
  return qtyText.replace(datePattern, '').trim();
}

function renderIngredientsTable() {
  console.log('[renderIngredientsTable] STORES:', STORES, 'META.categories:', META?.categories, 'recipeModalMode:', recipeModalMode);
  const wrap = document.getElementById('ingTableWrap');
  if (!wrap) return;

  if (!ING_ROWS.length) {
    wrap.innerHTML = `<div class="muted">No ingredients yet.</div>`;
    return;
  }

  const isView = (recipeModalMode === 'view');
  const disabledAttr = isView ? 'disabled' : '';
  console.log('[renderIngredientsTable] isView:', isView, 'disabledAttr:', disabledAttr);

  wrap.innerHTML = ING_ROWS.map((r, idx) => {
    const effectiveStoreId = String(r.StoreId || '').trim() || (getDefaultStoreId() || '');
    const catIndicator = (r.Category && r.Category !== '') ? `<span class="auto-cat-indicator auto-cat-active">✓</span>` : '';
    const cleanedQtyText = cleanQtyText(r.QtyText || '');
    const catOptions = optionHtml_(META.categories, r.Category || '');
    const storeOptions = storeOptionsHtml_(effectiveStoreId);
    
    // In view mode, display fractions; in edit mode, show decimals for easier editing
    const displayQtyNum = isView ? decimalToFraction(r.QtyNum) : (r.QtyNum ?? '');
    
    if (idx === 0) {
      console.log('[renderIngredientsTable] First ingredient catOptions length:', catOptions.length, 'storeOptions length:', storeOptions.length);
      console.log('[renderIngredientsTable] catOptions preview:', catOptions.substring(0, 200));
      console.log('[renderIngredientsTable] storeOptions preview:', storeOptions.substring(0, 200));
    }
    return `
          <div class="item ingGrid" data-idx="${idx}">
            <div class="row">
              <div class="col-4">
                <label>Name${catIndicator}</label>
                <input ${disabledAttr} value="${escapeAttr(r.IngredientRaw || r.IngredientNorm || r.Name || '')}" data-action="ing-set" data-idx="${idx}" data-key="IngredientRaw" placeholder="e.g., chicken breast">
              </div>
              <div class="col-2">
                <label>Qty #</label>
                <input ${disabledAttr} list="dlQtyNum" value="${escapeAttr(displayQtyNum)}" data-action="ing-set" data-idx="${idx}" data-key="QtyNum">
              </div>
              <div class="col-2">
                <label>Unit</label>
                <input ${disabledAttr} list="dlUnit" value="${escapeAttr(r.Unit || '')}" data-action="ing-set" data-idx="${idx}" data-key="Unit">
              </div>
              <div class="col-4">
                <label>Qty Text</label>
                <input ${disabledAttr} value="${escapeAttr(cleanedQtyText)}" data-action="ing-set" data-idx="${idx}" data-key="QtyText">
              </div>
              <div class="col-4">
                <label>Category</label>
                <select ${disabledAttr} data-action="ing-set" data-action-cat="ing-category" data-idx="${idx}" data-key="Category">
                  ${catOptions || '<option value="">No categories</option><option value="Produce">Produce</option><option value="Dairy">Dairy</option>'}
                </select>
              </div>
              <div class="col-4">
                <label>Store</label>
                <select ${disabledAttr} data-action="ing-store" data-idx="${idx}">
                  ${storeOptions || '<option value="">Unassigned</option><option value="kroger">Kroger</option>'}
                </select>
              </div>
              <div class="col-4">
                <label>Ingredient Norm</label>
                <input ${disabledAttr} value="${escapeAttr(r.IngredientNorm || '')}" data-action="ing-set" data-idx="${idx}" data-key="IngredientNorm">
              </div>
              ${isView ? '' : `
              <div class="col-12" style="margin-top:6px;">
                <div class="actions">
                  <button class="danger" data-action="ing-del" data-idx="${idx}">Remove</button>
                </div>
              </div>
              `}
            </div>
          </div>
        `;
  }).join('');

  ensureDatalist_('dlQtyNum', META.qtyNumOptions);
  ensureDatalist_('dlUnit', META.unitOptions);
}


function addIngredientRow() {
  const newIdx = ING_ROWS.length;
  ING_ROWS.push({ IngredientNorm: '', IngredientRaw: '', Notes: '', QtyNum: '', QtyText: '', StoreId: (getDefaultStoreId() || ''), Unit: '', Category: '', idx: '' });

  // PHASE 3.3: Apply smart defaults to new row
  applyIngredientDefaults(newIdx);
}
function removeIngredientRow(idx) { ING_ROWS.splice(idx, 1); renderIngredientsTable(); }

async function saveRecipeAndIngredients() {
  if (recipeModalMode === 'view') return;

  const saveBtn = document.getElementById('btnSaveRecipeFull');
  setLoading(saveBtn, true, 'Saving...');
  document.getElementById('rmStatus').textContent = 'Saving...';

  try {
    const title = document.getElementById('rTitle').value.trim();
    if (!title) {
      showToast('Title is required', 'warning');
      document.getElementById('rmStatus').textContent = '';
      return;
    }

    // Auto-categorize all ingredients before saving (ensures categories persist)
    await categorizeAllIngredients();

    const recipe = {
      RecipeId: CURRENT_RECIPE_ID || '',
      Title: title,
      URL: document.getElementById('rUrl').value.trim(),
      Image_Name: document.getElementById('rImage').value.trim(),
      Cuisine: document.getElementById('rCuisine').value.trim(),
      MealType: document.getElementById('rMealType').value.trim() || 'Any',
      Notes: document.getElementById('rNotes').value || '',
      Instructions: document.getElementById('rInstructions').value || '',
    };

    const items = ING_ROWS.map(x => ({
      IngredientNorm: (x.IngredientNorm || '').trim(),
      IngredientRaw: (x.IngredientRaw || '').trim(),
      Notes: (x.Notes || '').trim(),
      QtyNum: (x.QtyNum === '' ? '' : Number(x.QtyNum)),
      QtyText: (x.QtyText || '').trim(),
      StoreId: (x.StoreId || '').trim(),
      Unit: (x.Unit || '').trim(),
      Category: (x.Category || '').trim(),
    }))
      .filter(x => x.IngredientRaw);

    const res = await api('upsertRecipeWithIngredients', { recipe, items });
    if (!res.ok) {
      showToast(res.error || 'Save failed', 'error');
      document.getElementById('rmStatus').textContent = '';
      return;
    }

    // Haptic Feedback
    triggerSuccessFeedback(document.getElementById('btnSaveRecipeFull'));

    CURRENT_RECIPE_ID = res.RecipeId;

    // PHASE 3.3: Learn from saved recipe
    learnFromRecipe();

    // Reset scale after save (use original values for the view)
    resetRecipeScale();
    document.getElementById('rmStatus').textContent = 'Saved.';

    // PHASE 9.1: Invalidate recipe cache after save
    clearCache_('recipes');
    clearCache_('ingredients');

    await resetAndLoadRecipes();
    await openRecipeModalView(CURRENT_RECIPE_ID);
  } finally {
    setLoading(saveBtn, false);
  }
}

async function deleteRecipeUi() {
  if (!CURRENT_RECIPE_ID) { showToast('Open an existing recipe to delete', 'warning'); return; }
  if (!confirm('Delete this recipe and its ingredients?')) return;

  try {
    // Capture state BEFORE deletion for undo
    const recipeRes = await api('getRecipe', { recipeId: CURRENT_RECIPE_ID });
    const ingredientsRes = await api('listRecipeIngredients', { recipeId: CURRENT_RECIPE_ID });

    if (!recipeRes.ok || !ingredientsRes.ok) {
      showToast('Failed to load recipe data for undo', 'error');
      return;
    }

    // Perform deletion
    const res = await api('deleteRecipeCascade', { recipeId: CURRENT_RECIPE_ID });
    if (!res.ok) {
      showToast(res.error || 'Delete failed', 'error');
      return;
    }

    // Push to undo stack
    pushUndo('delete_recipe', {
      recipe: recipeRes.recipe,
      ingredients: ingredientsRes.items || []
    }, `Delete recipe: ${recipeRes.recipe.Title}`);

    closeRecipeModal();

    // PHASE 9.1: Invalidate caches after delete
    clearCache_('recipes');
    clearCache_('ingredients');

    await resetAndLoadRecipes();

    showToast(`Recipe deleted. Press Cmd+Z to undo.`, 'success', 5000);
  } catch (e) {
    console.error('Error in deleteRecipeUi:', e);
    showToast(`Error: ${e.message}`, 'error');
  }
}

// ---------- delegated handlers ----------
// Recipe card clicks - only for clicking the card itself (not action buttons)
document.addEventListener('click', async (e) => {
  // Skip if click is inside any modal or popover
  if (e.target.closest('.modalBack, .modal, .popover')) {
    return;
  }

  // Handle action button clicks as fallback (in case direct onclick didn't fire)
  const actionBtn = e.target.closest('.card-action-btn');

  // DEBUG: Check what's being clicked
  if (e.target.closest('.recipe-card')) {
    console.log('[Click] Target:', e.target.tagName, 'Classes:', e.target.className);
    console.log('[Click] ActionBtn found:', !!actionBtn);
    if (actionBtn) console.log('[Click] Action:', actionBtn.getAttribute('data-action'), 'Rid:', actionBtn.getAttribute('data-rid'));
  }

  if (actionBtn) {
    const action = actionBtn.getAttribute('data-action');
    const rid = actionBtn.getAttribute('data-rid');

    console.log('[Click] Handling action:', action, 'for recipe:', rid);

    // Only handle recipe-card specific actions here, let other actions bubble
    if (action === 'recipe-favorite' && rid) {
      e.stopPropagation();
      e.stopImmediatePropagation();
      e.preventDefault();
      try {
        await toggleRecipeFavorite(rid);
      } catch (err) {
        console.error('[Click] Error in toggleRecipeFavorite:', err);
      }
      return;
    } else if (action === 'quick-assign' && rid) {
      e.stopPropagation();
      e.stopImmediatePropagation();
      e.preventDefault();
      const today = ymd(new Date());
      await showQuickAssignModal(rid, today);
      return;
    } else if (action === 'quick-collection' && rid) {
      e.stopPropagation();
      e.stopImmediatePropagation();
      e.preventDefault();
      await showAddToCollectionModal(rid);
      return;
    }
    // For other actions (like clear-day), let event bubble to the next handler
  }

  // Skip opening recipe view if a favorite toggle is in progress
  if (_favoriteToggleInProgress) {
    console.log('[Click] Skipped view open because toggle in progress');
    return;
  }

  const card = e.target.closest('.recipe-card');

  // If clicked a recipe card (but not an action button), view the recipe
  if (card) {
    e.preventDefault();
    e.stopPropagation();
    console.log('[Click] Opening recipe view');
    const rid = card.getAttribute('data-recipe-id');
    if (rid) await openRecipeModalView(rid);
    return;
  }

  const rv = e.target.closest('[data-action="recipe-view"]');
  if (rv) {
    const rid = rv.getAttribute('data-rid');
    if (rid) await openRecipeModalView(rid);
    return;
  }

  const re = e.target.closest('[data-action="recipe-edit"]');
  if (re) {
    const rid = re.getAttribute('data-rid');
    if (rid) await openRecipeModalEdit(rid);
    return;
  }

  const rp = e.target.closest('[data-action="recipe-print"]');
  if (rp) {
    const rid = rp.getAttribute('data-rid');
    if (rid) {
      await openRecipeModalView(rid);
      applyCurrentScaleToDisplay(true);
      await printRecipeWithQuantities();
    }
    return;
  }

  const removeFromCol = e.target.closest('[data-action="remove-from-collection"]');
  if (removeFromCol) {
    const rid = removeFromCol.getAttribute('data-rid');
    if (rid && CURRENT_COLLECTION_ID) {
      if (confirm('Remove this recipe from the collection?')) {
        const res = await api('removeRecipeFromCollection', {
          collectionId: CURRENT_COLLECTION_ID,
          recipeId: rid
        });
        if (res.ok) {
          await loadCollectionRecipes(CURRENT_COLLECTION_ID);
        } else {
          showToast(res.error || 'Failed to remove recipe', 'error');
        }
      }
    }
    return;
  }

  const assignToPlanner = e.target.closest('[data-action="assign-to-planner"]');
  if (assignToPlanner) {
    const rid = assignToPlanner.getAttribute('data-rid');
    const title = assignToPlanner.getAttribute('data-title');
    if (rid && title) {
      openAssignToPlannerModal(rid, title);
    }
    return;
  }

  const toggleMainDish = e.target.closest('[data-action="toggle-main-dish"]');
  if (toggleMainDish) {
    const recipeId = toggleMainDish.getAttribute('data-rid');
    const isChecked = toggleMainDish.checked;

    if (recipeId && CURRENT_COLLECTION_ID) {
      const res = await api('setMainDishInCollection', {
        collectionId: CURRENT_COLLECTION_ID,
        recipeId: recipeId,
        isMainDish: isChecked
      });

      if (res.ok) {
        await loadCollectionRecipes(CURRENT_COLLECTION_ID);
        await updatePlannerForCollection(CURRENT_COLLECTION_ID);
      } else {
        showToast(res.error || 'Failed to update main dish', 'error');
      }
    }
    return;
  }

  const ir = e.target.closest('[data-action="ing-del"]');
  if (ir) { if (recipeModalMode === 'view') return; removeIngredientRow(Number(ir.getAttribute('data-idx'))); return; }

  // Quick Duplicate (not on recipe cards, but elsewhere in the UI)
  const quickDuplicate = e.target.closest('[data-action="quick-duplicate"]');
  if (quickDuplicate) {
    const rid = quickDuplicate.getAttribute('data-rid');
    if (rid) {
      await duplicateRecipe(rid);
    }
    return;
  }

  // More Actions Button (show context menu)
  const moreActions = e.target.closest('[data-action="more-actions"]');
  if (moreActions) {
    e.preventDefault();
    const rid = moreActions.getAttribute('data-rid');
    const rect = moreActions.getBoundingClientRect();
    showRecipeContextMenu(e.pageX, e.pageY, rid);
    return;
  }

  // Scale controls handlers
  const scaleDown = e.target.closest('[data-action="scale-down"]');
  if (scaleDown) { scaleRecipe(-0.5); return; }

  const scaleUp = e.target.closest('[data-action="scale-up"]');
  if (scaleUp) { scaleRecipe(0.5); return; }

  const scaleReset = e.target.closest('[data-action="scale-reset"]');
  if (scaleReset) { resetRecipeScale(); return; }

  // ========== PHASE 6.2: EXPORT HANDLERS ==========

  // Export Collection
  const exportCollection = e.target.closest('[data-action="export-collection"]');
  if (exportCollection) {
    const collectionId = exportCollection.getAttribute('data-cid');
    if (collectionId) {
      await exportCollectionHandler(collectionId);
    }
    return;
  }
});

document.addEventListener('input', (e) => {
  const s = e.target.closest('[data-action="ing-set"]');
  if (s) {
    if (recipeModalMode === 'view') return;
    const idx = Number(s.getAttribute('data-idx'));
    const key = s.getAttribute('data-key');
    if (!Number.isFinite(idx) || !key || !ING_ROWS[idx]) return;
    ING_ROWS[idx][key] = e.target.value;

    // PHASE 3.3: Learn from user input (Unit, Category)
    if ((key === 'Unit' || key === 'Category') && e.target.value) {
      learnFromIngredient(ING_ROWS[idx]);
    }

    // Trigger auto-categorization when typing ingredient name
    if (key === 'IngredientRaw' && e.target.value && e.target.value.length >= 2) {
      triggerAutoClassify(idx, e.target.value);

      // PHASE 4: Smart Pantry Suggestions
      debouncedPantrySearch(e.target, idx);
    }
  }
});

document.addEventListener('change', (e) => {
  const sel = e.target.closest('[data-action="ing-store"]');
  if (sel) {
    if (recipeModalMode === 'view') return;
    const idx = Number(sel.getAttribute('data-idx'));
    if (!Number.isFinite(idx) || !ING_ROWS[idx]) return;
    ING_ROWS[idx].StoreId = sel.value;

    // PHASE 3.3: Learn from store selection
    learnFromIngredient(ING_ROWS[idx]);
  }

  // Train classifier when category is manually set
  const catSel = e.target.closest('[data-action-cat="ing-category"]');
  if (catSel) {
    if (recipeModalMode === 'view') return;
    const idx = Number(catSel.getAttribute('data-idx'));
    const newCategory = catSel.value;
    if (!Number.isFinite(idx) || !ING_ROWS[idx] || !newCategory) return;

    const oldCategory = ING_ROWS[idx].Category;
    ING_ROWS[idx].Category = newCategory;

    // PHASE 3.3: Learn from category selection
    learnFromIngredient(ING_ROWS[idx]);

    // Train the classifier if the user explicitly set a category
    const ingredientName = ING_ROWS[idx].IngredientRaw || ING_ROWS[idx].IngredientNorm;
    if (ingredientName && ingredientName.length >= 2) {
      trainIngredientCategory(idx, ingredientName, newCategory);
    }
  }
});

// ---------- meal picker ----------

function openMealPicker(date, slot) {
  MP = { open: true, date, slot, q: '', recipes: [], selectedUserIds: new Set() };
  document.getElementById('mpTitle').textContent = `Select a recipe for ${slot}`;
  document.getElementById('mpSub').textContent = `Date: ${date}`;
  document.getElementById('mpSearch').value = '';
  document.getElementById('mpStatus').textContent = '';
  document.getElementById('mpList').innerHTML = '';
  openModal('mealPickerBack');

  // PHASE 4.5.5: Load meal assignment editor
  renderMealAssignmentEditor(date, slot);

  mealPickerLoad(true);
}

function closeMealPicker() {
  closeModal('mealPickerBack');
  MP.open = false;
}

// ========== PHASE 4.5.5: MEAL ASSIGNMENT FUNCTIONS ==========

// Render meal assignment editor with user chips
async function renderMealAssignmentEditor(date, slot) {
  const editorBox = document.getElementById('mpAssignmentEditor');
  if (!editorBox) return;

  try {
    // Fetch all users
    const usersRes = await api('listUsers', {});
    if (!usersRes.ok || !usersRes.users) {
      editorBox.innerHTML = '<div class="muted">No users found</div>';
      return;
    }

    // Fetch current meal assignments
    const assignmentsRes = await api('getMealAssignments', { date, slot });
    const assignedUserIds = new Set(
      (assignmentsRes.ok && assignmentsRes.assignments)
        ? assignmentsRes.assignments.map(a => a.userId)
        : []
    );

    // Render user chips
    editorBox.innerHTML = usersRes.users.map(user => `
          <div class="meal-assignment-chip ${assignedUserIds.has(user.userId) ? 'selected' : ''}" 
               data-user-id="${escapeAttr(user.userId)}"
               onclick="toggleMealAssignment('${escapeAttr(user.userId)}', '${escapeAttr(date)}', '${escapeAttr(slot)}')">
            <span class="meal-assignment-chip-avatar">${escapeHtml(user.avatarEmoji || '👤')}</span>
            <span class="meal-assignment-chip-name">${escapeHtml(user.name)}</span>
            <span class="meal-assignment-chip-check">✓</span>
          </div>
        `).join('');

    // Store current selections for later saving
    MP.selectedUserIds = assignedUserIds;

  } catch (e) {
    console.error('Failed to render meal assignment editor:', e);
    editorBox.innerHTML = '<div class="muted">Error loading users</div>';
  }
}

// Toggle user assignment (add/remove from selection)
async function toggleMealAssignment(userId, date, slot) {
  const chip = document.querySelector(`.meal-assignment-chip[data-user-id="${userId}"]`);
  if (!chip) return;

  // Toggle selected state
  const isSelected = chip.classList.contains('selected');
  if (isSelected) {
    chip.classList.remove('selected');
    MP.selectedUserIds.delete(userId);
  } else {
    chip.classList.add('selected');
    MP.selectedUserIds.add(userId);
  }
}

// Save meal assignments when recipe is selected
async function saveMealAssignments(date, slot) {
  if (!MP.selectedUserIds || MP.selectedUserIds.size === 0) {
    // If no users selected, default to "Whole Family"
    const wholeFamilyUser = await getWholeFamilyUser();
    if (wholeFamilyUser) {
      MP.selectedUserIds = new Set([wholeFamilyUser.userId]);
    }
  }

  const userIds = Array.from(MP.selectedUserIds);

  try {
    const res = await api('setMealAssignments', {
      date,
      slot,
      userIds
    });

    if (!res.ok) {
      console.error('Failed to save meal assignments:', res.error);
    }
  } catch (e) {
    console.error('Error saving meal assignments:', e);
  }
}

// Helper to get "Whole Family" user
async function getWholeFamilyUser() {
  try {
    const usersRes = await api('listUsers', {});
    if (usersRes.ok && usersRes.users) {
      return usersRes.users.find(u => u.name === 'Whole Family');
    }
  } catch (e) {
    console.error('Failed to get Whole Family user:', e);
  }
  return null;
}

async function mealPickerLoad(reset) {
  if (!MP.open) return;
  if (reset) { MP.recipes = []; document.getElementById('mpList').innerHTML = ''; }
  document.getElementById('mpStatus').textContent = 'Loading...';
  const userId = ACTIVE_USER?.userId || null;
  const res = await api('listRecipesAll', { q: MP.q, userId });
  if (!res.ok) { document.getElementById('mpStatus').textContent = res.error || 'Error'; return; }
  MP.recipes = res.recipes || [];
  renderMealPickerList();
  document.getElementById('mpStatus').textContent = MP.recipes.length ? `Loaded ${MP.recipes.length}.` : 'No matches.';
}



function renderMealPickerList() {
  const box = document.getElementById('mpList');
  if (!box) return;
  box.innerHTML = (MP.recipes || []).map(r => `
        <div class="item" style="display:flex; justify-content:space-between; gap:10px; align-items:center;">
          <div>
            <div><strong>${escapeHtml(r.Title || '')}</strong></div>
            <div class="muted">${escapeHtml(r.Cuisine || '')}</div>
          </div>
          <div class="actions">
            <button class="primary" data-action="mp-select" data-rid="${escapeAttr(r.RecipeId)}" data-title="${escapeAttr(r.Title || '')}">Select</button>
              <button class="ghost" data-action="mp-view" data-rid="${escapeAttr(r.RecipeId)}">View</button>
          </div>
        </div>
      `).join('');
}


const mealPickerBack = document.getElementById('mealPickerBack');
if (mealPickerBack) {
  mealPickerBack.addEventListener('click', async (e) => {
    const viewBtn = e.target.closest('[data-action="mp-view"]');
    if (viewBtn) {
      const rid = viewBtn.getAttribute('data-rid');
      if (rid) {
        await openRecipeModalView(rid);
      }
      return;
    }

    const pick = e.target.closest('[data-action="mp-select"]');
    if (pick) {
      const rid = pick.getAttribute('data-rid');
      const title = pick.getAttribute('data-title');

      // Phase 4.5.7: Use upsertUserPlanMeal for multi-user support
      // Get active user ID
      const activeUserRes = await api('getActiveUser');
      const userId = (activeUserRes.ok && activeUserRes.userId) ? activeUserRes.userId : null;

      if (!userId) {
        showToast('No active user set', 'error');
        return;
      }

      await api('upsertUserPlanMeal', {
        userId,
        date: MP.date,
        slot: MP.slot,
        meal: { RecipeId: rid, Title: title }
      });

      // ========== PHASE 4.5.5: Save meal assignments ==========
      await saveMealAssignments(MP.date, MP.slot);

      // ========== PHASE 3.1: Add to recent meal assignments ==========
      addToRecentMeals(rid, title, MP.date, MP.slot);

      await loadPlansIntoUi(PLAN.start, PLAN.days);
      await loadPantry(); // Refresh pantry after planning meal
      await refreshDashboardIfToday(MP.date); // Refresh dashboard if today's meal changed
      closeMealPicker();
      return;
    }
  });
}

// ---------- plans ----------

// Phase 4.5.7: Helper function to upsert user meal with active user
async function upsertUserMeal(date, slot, meal, mealId = null) {
  const activeUserRes = await api('getActiveUser');
  const userId = (activeUserRes.ok && activeUserRes.userId) ? activeUserRes.userId : null;

  if (!userId) {
    console.error('[upsertUserMeal] No active user set');
    showToast('No active user set', 'error');
    return { ok: false, error: 'No active user set' };
  }

  // If meal has an id, include it for update
  if (meal && mealId) {
    meal.id = mealId;
  }

  return await api('upsertUserPlanMeal', { userId, date, slot, meal });
}

async function loadPlansIntoUi(start, days) {
  console.log('[loadPlansIntoUi] start:', start, 'days:', days);
  PLAN.start = start;
  PLAN.days = days;
  const end = addDays(start, days - 1);
  console.log('[loadPlansIntoUi] PLAN.start set to:', PLAN.start, 'PLAN.days:', PLAN.days);

  // Phase 4.5.7: Use getUserPlanMeals for multi-user support
  const res = await api('getUserPlanMeals', { start, end });
  if (!res.ok) {
    console.error('[loadPlansIntoUi] API error:', res.error);
    document.getElementById('topStatus').textContent = res.error || 'Plan load error';
    return;
  }
  console.log('[loadPlansIntoUi] API returned plans:', res.plans?.length || 0);
  console.log('[loadPlansIntoUi] Whole Family view:', res.isWholeFamilyView);

  PLAN.plansByDate = {};
  PLAN.isWholeFamilyView = res.isWholeFamilyView;
  PLAN.currentUserId = res.userId;

  for (const p of (res.plans || [])) {
    PLAN.plansByDate[p.Date] = p;
    // Debug: log any meals with their fields
    for (const slot of ['Breakfast', 'Lunch', 'Dinner']) {
      if (p[slot] && Array.isArray(p[slot]) && p[slot].length > 0) {
        console.log(`Loaded ${p.Date} ${slot}: ${p[slot].length} meal(s)`);
        p[slot].forEach((meal, idx) => {
          console.log(`  [${idx}] ${meal.Title} (User: ${meal.userId}, Fallback: ${meal.IsFallback})`);
        });
      }
    }
  }

  renderPlanner('planList', start, days, true);
  // Bulk planner UI may be removed/hidden; do not fail if container is absent.
  renderPlanner('bulkList', start, days, false);

  // Render grid view if it's the active view mode
  console.log('[loadPlansIntoUi] PLAN.viewMode:', PLAN.viewMode);
  if (PLAN.viewMode === 'grid') {
    console.log('[loadPlansIntoUi] Calling renderPlanGrid');
    renderPlanGrid();
  }

  // Update status if element exists
  const topStatusEl = document.getElementById('topStatus');
  if (topStatusEl) {
    topStatusEl.textContent = `Loaded plans: ${start} → ${end}`;
  }
}


// Helper function to fetch and render additional items for a meal slot
async function renderAdditionalItemsAsync_(date, slot) {
  try {
    const result = await api('getAdditionalItems', { date, slot });
    const items = (result.ok && result.items) ? result.items : [];

    // If no items, just show the add button
    if (items.length === 0) {
      return `
          <div class="additional-items">
            <button class="btn-add-additional" data-date="${escapeAttr(date)}" data-slot="${escapeAttr(slot)}">
              + Add Side Dish/Dessert
            </button>
          </div>
        `;
    }

    // Build items HTML for expanded view
    const itemsHtml = items.map(item => `
          <div class="additional-item">
            <span class="item-type-badge">${escapeHtml(item.ItemType || 'side')}</span>
            <span class="item-title">${escapeHtml(item.Title || '')}</span>
            <button class="ghost" data-action="planner-view" data-rid="${escapeAttr(item.RecipeId)}" style="padding:4px 8px;font-size:11px;">View</button>
            <button class="btn-remove-additional" data-id="${item.id}" data-date="${escapeAttr(date)}" data-slot="${escapeAttr(slot)}" title="Remove">×</button>
          </div>
        `).join('');

    // Use details/summary for collapsible display
    return `
          <div class="additional-items">
            <details class="side-dish-details">
              <summary>
                ${items.length} side dish${items.length === 1 ? '' : 'es'}/dessert${items.length === 1 ? '' : 's'}
              </summary>
              <div>
                <div class="additional-items-list">
                  ${itemsHtml}
                </div>
                <button class="btn-add-additional" data-date="${escapeAttr(date)}" data-slot="${escapeAttr(slot)}">
                  + Add Another
                </button>
              </div>
            </details>
          </div>
        `;
  } catch (e) {
    console.warn('Error loading additional items:', e);
    return `
          <div class="additional-items">
            <button class="btn-add-additional" data-date="${escapeAttr(date)}" data-slot="${escapeAttr(slot)}">
              + Add Side Dish/Dessert
            </button>
          </div>
        `;
  }
}

// PHASE 4.5.5: Render meal assignment badge
async function renderMealAssignmentBadge(date, slot) {
  const assignmentBadgeId = `assignment-badge-${date}-${slot}`.replace(/[^a-zA-Z0-9-]/g, '');
  const badgeContainer = document.getElementById(assignmentBadgeId);
  if (!badgeContainer) return;

  try {
    const assignmentsRes = await api('getMealAssignments', { date, slot });
    if (!assignmentsRes.ok || !assignmentsRes.assignments || assignmentsRes.assignments.length === 0) {
      badgeContainer.innerHTML = '';
      return;
    }

    const assignments = assignmentsRes.assignments;
    const avatars = assignments.map(a => escapeHtml(a.avatarEmoji || '👤')).join(' ');
    const names = assignments.map(a => escapeHtml(a.name)).join(', ');

    badgeContainer.innerHTML = `
          <div class="meal-assignment-badge">
            <span class="meal-assignment-badge-label">For:</span>
            <span class="meal-assignment-badge-avatars">
              ${assignments.map(a => `<span class="meal-assignment-badge-avatar">${escapeHtml(a.avatarEmoji || '👤')}</span>`).join('')}
            </span>
            <span class="meal-assignment-badge-names">${names}</span>
          </div>
        `;
  } catch (e) {
    console.error('Failed to render meal assignment badge:', e);
    badgeContainer.innerHTML = '';
  }
}

function slotLine(date, slot, meal, mealIndex = 0, totalMeals = 1) {
  const hasRecipe = !!(meal && meal.RecipeId);
  const title = hasRecipe ? meal.Title : '(empty)';
  const rid = hasRecipe ? meal.RecipeId : '';
  const useLeft = !!(meal && (meal.UseLeftovers === true || meal.UseLeftovers === 1 || meal.UseLeftovers === 'true'));
  const mealId = meal && meal.id ? meal.id : null;

  // Badge logic
  let badges = '';
  if (useLeft) badges += `<span class="meal-badge badge-leftovers">↺ Leftovers</span>`;
  if (meal && meal.userName === 'Whole Family') badges += `<span class="meal-badge badge-whole-family">👨‍👩‍👧‍👦 Family</span>`;
  else if (meal && meal.userName) badges += `<span class="meal-badge">👤 ${escapeHtml(meal.userName)}</span>`;

  // Action buttons
  const actions = `
    <div class="meal-actions">
      ${hasRecipe ? `<button class="card-action-btn ghost" data-action="planner-view" data-rid="${escapeAttr(rid)}" data-tooltip="View Recipe" data-tooltip-pos="top">👁️</button>` : ''}
      ${hasRecipe ? `<button class="card-action-btn ghost" data-action="mark-cooked" data-rid="${escapeAttr(rid)}" data-tooltip="Mark as Cooked" data-tooltip-pos="top">🍳</button>` : ''}
      <button class="card-action-btn ghost" data-action="select-meal" data-date="${escapeAttr(date)}" data-slot="${escapeAttr(slot)}" ${mealId ? `data-meal-id="${mealId}"` : ''} data-tooltip="Change Meal" data-tooltip-pos="top">✏️</button>
      ${totalMeals > 1 ? `<button class="card-action-btn ghost danger" data-action="delete-user-meal" data-meal-id="${mealId}" data-date="${escapeAttr(date)}" data-slot="${escapeAttr(slot)}" data-tooltip="Remove Meal" data-tooltip-pos="top">✕</button>` : ''}
    </div>
  `;

  const assignmentBadgeId = `assignment-badge-${date}-${slot}-${mealIndex}`.replace(/[^a-zA-Z0-9-]/g, '');

  return `
    <div class="meal-line animate-in" 
         data-date="${escapeAttr(date)}" 
         data-slot="${escapeAttr(slot)}" 
         data-idx="${mealIndex}"
         ${hasRecipe ? `data-rid="${escapeAttr(rid)}"` : ''}>
      <div class="meal-title" data-action="${hasRecipe ? 'planner-view' : 'select-meal'}" data-rid="${escapeAttr(rid)}" data-date="${escapeAttr(date)}" data-slot="${escapeAttr(slot)}">
        ${escapeHtml(title)}
      </div>
      <div class="meal-badges">${badges}</div>
      ${actions}
      <div id="${assignmentBadgeId}" class="meal-assignment-badge-container"></div>
      <div class="additional-items-container" data-date="${escapeAttr(date)}" data-slot="${escapeAttr(slot)}">
        <div class="skeleton" style="height: 12px; border-radius: 4px; margin-top: 4px; width: 60%;"></div>
      </div>
    </div>
  `;
}


async function loadPantryDepletionForMeal(date, slot, rid) {
  // This would ideally call an API to get depletion data for this specific meal
  // For now, we'll fetch the recipe ingredients and simulate the depletion
  const res = await api('listRecipeIngredients', { recipeId: rid });
  if (!res.ok || !res.items) {
    return '<div class="muted">Unable to load pantry impact data.</div>';
  }

  const ingredients = res.items || [];
  if (ingredients.length === 0) {
    return '<div class="muted">No ingredients tracked for this recipe.</div>';
  }

  // Fetch current pantry to show remaining levels
  const pantryRes = await api('listPantry', { q: '' });
  const pantryItems = (pantryRes.ok && pantryRes.items) ? pantryRes.items : [];
  const pantryMap = {};
  for (const p of pantryItems) {
    const key = String(p.Name || '').trim().toLowerCase();
    pantryMap[key] = p;
  }

  let html = '<div style="margin-top:6px;">';
  let hasDeductions = false;

  for (const ing of ingredients) {
    const ingName = ing.IngredientNorm || ing.IngredientRaw || '';
    if (!ingName) continue;

    const qtyDisplay = [ing.QtyText || ing.QtyNum || '', ing.Unit || ''].filter(Boolean).join(' ').trim();
    if (!qtyDisplay) continue;

    // Check if we have this in pantry
    const pantryKey = ingName.toLowerCase();
    const pantryItem = pantryMap[pantryKey];

    if (pantryItem) {
      hasDeductions = true;
      const currentQty = pantryItem.QtyNum || 0;
      const unit = pantryItem.Unit || '';
      const remaining = currentQty;
      const lowThreshold = pantryItem.low_stock_threshold || 0;
      const isLow = remaining <= lowThreshold && lowThreshold > 0;
      const warningStyle = isLow ? 'color: #d32f2f; font-weight: 600;' : '';

      html += `
            <div style="padding:4px 0; border-bottom:1px solid rgba(255,255,255,0.05);">
              <div style="display:flex; justify-content:space-between; align-items:center;">
                <span>${escapeHtml(ingName)}</span>
                <span class="muted" style="font-size:11px;">Uses: ${escapeHtml(qtyDisplay)}</span>
              </div>
              <div style="margin-top:2px; display:flex; justify-content:space-between; font-size:11px;">
                <span class="muted">Pantry remaining:</span>
                <span style="${warningStyle}">${remaining} ${unit}${isLow ? ' ⚠️ LOW' : ''}</span>
              </div>
            </div>
          `;
    }
  }

  if (!hasDeductions) {
    html += '<div class="muted">No pantry items affected by this meal.</div>';
  }

  html += '</div>';
  return html;
}


function renderPlanner(containerId, start, days, includeSwap) {
  const box = document.getElementById(containerId);
  if (!box) return;
  box.classList.add('planner-grid');
  const dates = [];
  for (let i = 0; i < days; i++) dates.push(addDays(start, i));

  box.innerHTML = dates.map(date => {
    const p = PLAN.plansByDate[date] || { Date: date, Breakfast: [], Lunch: [], Dinner: [] };

    // Parse date for subtitle
    const d = new Date(date + 'T12:00:00');
    const dayName = d.toLocaleDateString('en-US', { weekday: 'long' });
    const formattedDate = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

    const breakfast = Array.isArray(p.Breakfast) ? p.Breakfast : (p.Breakfast ? [p.Breakfast] : []);
    const lunch = Array.isArray(p.Lunch) ? p.Lunch : (p.Lunch ? [p.Lunch] : []);
    const dinner = Array.isArray(p.Dinner) ? p.Dinner : (p.Dinner ? [p.Dinner] : []);

    const renderSlot = (label, meals, classSuffix) => {
      const slotHtml = meals.length > 0
        ? meals.map((m, idx) => slotLine(date, label, m, idx, meals.length)).join('')
        : `<div class="meal-line ghost-hover" data-action="select-meal" data-date="${escapeAttr(date)}" data-slot="${escapeAttr(label)}">
             <div class="meal-title muted">+ Add ${label}</div>
           </div>`;

      return `
        <div class="planner-slot slot-${classSuffix}" data-date="${escapeAttr(date)}" data-slot="${escapeAttr(label)}">
          <span class="slot-label">${label}</span>
          ${slotHtml}
        </div>
      `;
    };

    return `
      <div class="planner-day-card animate-in" data-day="${escapeAttr(date)}">
        <div class="planner-day-header">
          <div>
            <div class="planner-day-title">${dayName}</div>
            <div class="day-subtitle">${formattedDate}</div>
          </div>
          <button class="card-action-btn ghost" data-tooltip="Clear Todays Meals" data-tooltip-pos="left" data-action="clear-day" data-date="${escapeAttr(date)}">✕</button>
        </div>
        ${renderSlot('Breakfast', breakfast, 'breakfast')}
        ${renderSlot('Lunch', lunch, 'lunch')}
        ${renderSlot('Dinner', dinner, 'dinner')}
        
        ${includeSwap ? `
          <div class="planner-actions">
            <button class="ghost" onclick="swapMeals('${escapeAttr(date)}', 'Breakfast', 'Lunch')">B / L</button>
            <button class="ghost" onclick="swapMeals('${escapeAttr(date)}', 'Lunch', 'Dinner')">L / D</button>
            <button class="ghost" onclick="swapMeals('${escapeAttr(date)}', 'Breakfast', 'Dinner')">B / D</button>
          </div>
        ` : ''}
      </div>
    `;
  }).join('');

  // Load additional items for all slots after rendering
  setTimeout(async () => {
    const containers = box.querySelectorAll('.additional-items-container');
    for (const container of containers) {
      const date = container.dataset.date;
      const slot = container.dataset.slot;
      const html = await renderAdditionalItemsAsync_(date, slot);
      container.innerHTML = html;
      await renderMealAssignmentBadge(date, slot);
    }
  }, 0);
}

async function clearDay(date) {
  if (!confirm(`Clear all meals for ${date}?`)) return;
  const slots = ['Breakfast', 'Lunch', 'Dinner'];
  for (const slot of slots) {
    await upsertUserMeal(date, slot, null);
  }
  await loadPlansIntoUi(PLAN.start, PLAN.days);
  await refreshDashboardIfToday(date); // Refresh dashboard if today's meals changed
  showToast(`Day ${date} cleared`, 'success');
}

// Phase 4.5.7: New function to render a meal slot section with multiple meals
function slotSection(date, slot, meals) {
  if (!meals || meals.length === 0) {
    // Empty slot - show single add meal interface
    return slotLine(date, slot, null, 0, 1);
  }

  // Multiple meals or single meal - render each
  let html = '';
  meals.forEach((meal, index) => {
    html += slotLine(date, slot, meal, index, meals.length);
  });

  // Add "Add Another Meal" button if there are existing meals
  if (meals.length > 0) {
    html += `
          <div style="margin-top:8px;margin-left:24px;">
            <button class="ghost" data-action="add-another-meal" data-date="${escapeAttr(date)}" data-slot="${escapeAttr(slot)}" style="padding:8px 12px;font-size:12px;">
              + Add Another ${escapeHtml(slot)}
            </button>
          </div>
        `;
  }

  return html;
}



// Pick which prior meal/day the leftovers come from, for annotation.
async function pickLeftoversSourceAsync_(targetDate, targetSlot) {
  const opts = [];
  const dates = [];
  for (let i = 0; i < PLAN.days; i++) dates.push(addDays(PLAN.start, i));

  for (const d of dates) {
    if (d >= targetDate) continue;
    const day = PLAN.plansByDate[d];
    if (!day) continue;
    for (const slot of ['Breakfast', 'Lunch', 'Dinner']) {
      const slotMeals = day[slot];
      // Handle both array (multi-user) and single object (legacy) formats
      const mealsArray = Array.isArray(slotMeals) ? slotMeals : (slotMeals ? [slotMeals] : []);

      for (const m of mealsArray) {
        if (!m || !m.RecipeId || !m.Title) continue;
        // Only show meals that are NOT already marked as leftovers
        if (m.UseLeftovers) continue;
        opts.push({
          value: `${d} ${slot} — ${m.Title}`,
          label: `${d} ${slot}: ${m.Title}${m.userName ? ` (${m.userName})` : ''}`,
          recipeId: m.RecipeId,
          title: m.Title
        });
      }
    }
  }
  if (!opts.length) {
    showToast('No previous meals found to use as leftovers. Tip: First plan some regular meals, then come back and mark them as leftovers for future days.', 'info');
    return null;
  }

  return await new Promise((resolve) => {
    const ov = document.createElement('div');
    ov.style.cssText = 'position:fixed;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.7);z-index:9999;';

    const card = document.createElement('div');
    card.style.cssText = 'background:#ffffff;border-radius:16px;padding:28px;max-width:480px;width:90%;box-shadow:0 25px 80px rgba(0,0,0,0.5);';

    card.innerHTML = `
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px;">
            <div style="font-size:20px;font-weight:700;color:#111;">🍽️ Select Meal to Reuse</div>
            <button id="lofClose" style="padding:10px 16px;border-radius:50%;border:1px solid #e5e7eb;background:#f9fafb;cursor:pointer;font-size:18px;color:#6b7280;">✕</button>
          </div>
          <div style="font-size:15px;color:#111111;line-height:1.6;margin-bottom:20px;padding:16px;background:#f3f4f6;border-radius:10px;">
            <strong style="color:#111111;">${escapeHtml(targetDate)} ${escapeHtml(targetSlot)}</strong><br>
            Choose which meal to reuse as leftovers:
          </div>
          <select id="lofSel" style="width:100%;padding:14px 16px;border:2px solid #3b82f6;border-radius:10px;font-size:15px;margin-bottom:20px;background:#fff;cursor:pointer;color:#111;">
            ${opts.map(o => `<option value="${escapeAttr(o.value)}" style="color:#111;">${escapeHtml(o.label)}</option>`).join('')}
          </select>
          <div style="display:flex;justify-content:flex-end;gap:12px;">
            <button id="lofSkip" style="padding:14px 24px;border-radius:10px;border:1px solid #e5e7eb;background:#f9fafb;cursor:pointer;font-size:14px;color:#374151;">Cancel</button>
            <button id="lofOk" style="padding:14px 28px;border-radius:10px;font-weight:600;background:#2563eb;color:#ffffff;border:none;cursor:pointer;font-size:14px;box-shadow:0 4px 12px rgba(37,99,235,0.3);">Use This Meal</button>
          </div>
        `;

    ov.appendChild(card);
    document.body.appendChild(ov);

    function cleanup(val) {
      try { document.body.removeChild(ov); } catch (_) { }
      resolve(val);
    }

    card.querySelector('#lofClose').addEventListener('click', () => cleanup(null));
    card.querySelector('#lofSkip').addEventListener('click', () => cleanup(null));
    card.querySelector('#lofOk').addEventListener('click', () => {
      const sel = card.querySelector('#lofSel');
      const selectedOption = opts[sel.selectedIndex];
      // Return object with string value for parsing and recipe details for the meal
      cleanup(selectedOption ? {
        value: sel.value,
        recipeId: selectedOption.recipeId,
        title: selectedOption.title
      } : null);
    });
    ov.addEventListener('click', (ev) => { if (ev.target === ov) cleanup(null); });
  });
}

// Show modal to add additional item (side, dessert, etc.) to a meal slot
async function showAddAdditionalItemModal(date, slot) {
  console.log('[showAddAdditionalItemModal] Opening modal for', date, slot);
  console.log('[showAddAdditionalItemModal] RECIPES array length:', RECIPES ? RECIPES.length : 'undefined');

  // Load recipes if not already loaded
  if (!RECIPES || RECIPES.length === 0) {
    console.log('[showAddAdditionalItemModal] Loading recipes...');
    try {
      await resetAndLoadRecipes();
      console.log('[showAddAdditionalItemModal] Recipes loaded:', RECIPES.length);
    } catch (e) {
      console.error('[showAddAdditionalItemModal] Failed to load recipes:', e);
      showToast('Failed to load recipes: ' + e.message, 'error');
      return null;
    }
  }

  return new Promise((resolve) => {
    const ov = document.createElement('div');
    ov.style.cssText = 'position:fixed;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.7);z-index:9999;';

    const card = document.createElement('div');
    card.style.cssText = 'background:#ffffff;border-radius:16px;padding:0;max-width:600px;width:90%;box-shadow:0 25px 80px rgba(0,0,0,0.5);max-height:85vh;display:flex;flex-direction:column;';

    console.log('[showAddAdditionalItemModal] Modal elements created');

    card.innerHTML = `
          <div style="padding:28px 28px 20px 28px;border-bottom:1px solid #e5e7eb;">
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px;">
              <div style="font-size:20px;font-weight:700;color:#111;">🍽️ Add Side/Dessert</div>
              <button id="addItemClose" style="padding:10px 16px;border-radius:50%;border:1px solid #e5e7eb;background:#f9fafb;cursor:pointer;font-size:18px;color:#6b7280;">✕</button>
            </div>
            <div style="font-size:15px;color:#111111;line-height:1.6;padding:16px;background:#f3f4f6;border-radius:10px;">
              <strong style="color:#111111;">${escapeHtml(date)} ${escapeHtml(slot)}</strong><br>
              Search for a recipe to add:
            </div>
            
            <!-- PHASE 8.2+: Inline help for additional items feature -->
            <div style="margin:12px 20px;padding:12px;background:rgba(77,163,255,0.08);border:1px solid rgba(77,163,255,0.2);border-radius:8px;display:flex;gap:10px;align-items:flex-start;">
              <span style="font-size:16px;">ℹ️</span>
              <div style="font-size:13px;color:#111111;line-height:1.5;">
                Add complementary items like sides, desserts, or beverages to round out your meal. These items will be included in your shopping list.
              </div>
            </div>
          </div>
          
          <div style="flex:1;overflow-y:auto;padding:20px 28px;">
            <div style="margin-bottom:16px;">
              <input type="text" id="addItemSearch" placeholder="Type to search or browse below..." style="width:100%;padding:14px 16px;border:2px solid #3b82f6;border-radius:10px;font-size:15px;margin-bottom:10px;color:#111111;" />
              <div>
                <label style="display:block;margin-bottom:4px;font-size:13px;font-weight:600;color:#374151;">Filter by Meal Type:</label>
                <select id="addItemMealTypeFilter" style="width:100%;padding:10px 12px;border:1px solid #d1d5db;border-radius:8px;font-size:14px;background:#fff;cursor:pointer;color:#111;">
                  <option value="">All Recipes</option>
                  <option value="Side">Side Dish</option>
                  <option value="Dessert">Dessert</option>
                  <option value="Appetizer">Appetizer</option>
                  <option value="Beverage">Beverage</option>
                  <option value="Salad">Salad</option>
                  <option value="Soup">Soup</option>
                  <option value="Breakfast">Breakfast</option>
                  <option value="Lunch">Lunch</option>
                  <option value="Dinner">Dinner</option>
                </select>
              </div>
            </div>
            <div id="addItemResults" style="max-height:400px;overflow-y:auto;border:1px solid #e5e7eb;border-radius:8px;margin-bottom:16px;"></div>
          </div>

          <div style="padding:20px 28px;border-top:1px solid #e5e7eb;background:#fafafa;">
            <div style="margin-bottom:16px;">
              <label style="display:block;margin-bottom:8px;font-size:14px;font-weight:600;color:#374151;">Item Type:</label>
              <select id="addItemType" style="width:100%;padding:12px 16px;border:2px solid #3b82f6;border-radius:10px;font-size:15px;background:#fff;cursor:pointer;color:#111;">
                <option value="side">Side Dish</option>
                <option value="dessert">Dessert</option>
                <option value="appetizer">Appetizer</option>
                <option value="beverage">Beverage</option>
                <option value="salad">Salad</option>
                <option value="soup">Soup</option>
              </select>
            </div>
            <div style="display:flex;justify-content:flex-end;gap:12px;">
              <button id="addItemCancel" style="padding:14px 24px;border-radius:10px;border:1px solid #e5e7eb;background:#fff;cursor:pointer;font-size:14px;color:#374151;font-weight:500;">Cancel</button>
              <button id="addItemOk" disabled style="padding:14px 28px;border-radius:10px;font-weight:600;background:#2563eb;color:#ffffff;border:none;cursor:pointer;font-size:14px;box-shadow:0 4px 12px rgba(37,99,235,0.3);opacity:0.5;">Add to Meal Plan</button>
            </div>
          </div>
        `;

    ov.appendChild(card);
    document.body.appendChild(ov);

    console.log('[showAddAdditionalItemModal] Card appended to DOM');
    console.log('[showAddAdditionalItemModal] Card.innerHTML length:', card.innerHTML.length);
    console.log('[showAddAdditionalItemModal] First 1000 chars of HTML:', card.innerHTML.substring(0, 1000));
    console.log('[showAddAdditionalItemModal] ov element:', ov);
    console.log('[showAddAdditionalItemModal] Is ov in document?', document.body.contains(ov));
    console.log('[showAddAdditionalItemModal] Looking for #addItemSearch...');

    let selectedRecipe = null;

    function cleanup(val) {
      console.log('[showAddAdditionalItemModal] cleanup called with:', val);
      try { document.body.removeChild(ov); } catch (_) { }
      resolve(val);
    }

    // Search functionality
    const searchInput = card.querySelector('#addItemSearch');
    const resultsDiv = card.querySelector('#addItemResults');
    const okBtn = card.querySelector('#addItemOk');
    const mealTypeFilter = card.querySelector('#addItemMealTypeFilter');

    console.log('[showAddAdditionalItemModal] searchInput element:', searchInput);
    console.log('[showAddAdditionalItemModal] resultsDiv element:', resultsDiv);

    if (!searchInput || !resultsDiv || !okBtn) {
      console.error('[showAddAdditionalItemModal] CRITICAL: Elements not found!');
      console.error('[showAddAdditionalItemModal] card.innerHTML:', card.innerHTML.substring(0, 500));
      showToast('Error: Modal failed to initialize. Check console for details.', 'error');
      cleanup(null);
      return;
    }

    // Test that input is working
    searchInput.addEventListener('focus', () => {
      console.log('[addItemSearch] Input field focused');
    });

    // RECIPES should already be loaded by now (checked before Promise)
    if (!RECIPES || RECIPES.length === 0) {
      resultsDiv.innerHTML = '<div style="padding:12px;color:#ef4444;">No recipes available. Please add recipes first.</div>';
    }

    // Function to perform search with current filters
    function performSearch() {
      const q = searchInput.value.trim();
      const mealTypeFilterValue = mealTypeFilter.value;

      console.log('[addItemSearch] Searching for:', q, 'MealType filter:', mealTypeFilterValue, 'in', RECIPES.length, 'recipes');

      // Search in already loaded RECIPES array for performance
      const lowerQ = q.toLowerCase();
      let matchedRecipes = RECIPES.filter(recipe => {
        const titleMatch = !q || (recipe.Title || '').toLowerCase().includes(lowerQ);
        const cuisineMatch = !q || (recipe.Cuisine || '').toLowerCase().includes(lowerQ);
        const textMatch = titleMatch || cuisineMatch;

        // Apply meal type filter
        const mealTypeMatch = !mealTypeFilterValue || (recipe.MealType || '').toLowerCase() === mealTypeFilterValue.toLowerCase();

        return textMatch && mealTypeMatch;
      });

      console.log('[addItemSearch] Found', matchedRecipes.length, 'matches');

      if (matchedRecipes.length > 0) {
        resultsDiv.innerHTML = matchedRecipes.map(recipe => `
              <div class="recipe-result-item" data-recipe-id="${escapeAttr(recipe.RecipeId)}" data-recipe-title="${escapeAttr(recipe.Title)}" style="padding:12px;border-bottom:1px solid #e5e7eb;cursor:pointer;display:flex;justify-content:space-between;align-items:center;">
                <div>
                  <div style="font-weight:600;color:#111;">${escapeHtml(recipe.Title)}</div>
                  <div style="font-size:12px;color:#6b7280;">
                    ${recipe.MealType ? `<span style="background:#e0f2fe;color:#0369a1;padding:2px 6px;border-radius:3px;margin-right:4px;">${escapeHtml(recipe.MealType)}</span>` : ''}
                    ${recipe.Cuisine ? escapeHtml(recipe.Cuisine) : ''}
                  </div>
                </div>
                <button class="select-recipe-btn" style="padding:6px 12px;background:#4da3ff;color:#fff;border:none;border-radius:6px;cursor:pointer;font-size:12px;">Select</button>
              </div>
            `).join('');
      } else {
        resultsDiv.innerHTML = '<div style="padding:12px;color:#6b7280;">No recipes found</div>';
      }
    }

    let searchTimeout;
    searchInput.addEventListener('input', (event) => {
      console.log('[addItemSearch] Input event fired, value:', event.target.value);
      clearTimeout(searchTimeout);
      searchTimeout = setTimeout(performSearch, 300);
    });

    // Trigger search when meal type filter changes
    mealTypeFilter.addEventListener('change', () => {
      console.log('[addItemSearch] Meal type filter changed to:', mealTypeFilter.value);
      performSearch();
    });

    // Recipe selection
    resultsDiv.addEventListener('click', (e) => {
      console.log('[addItemSearch] Click event:', e.target);
      const resultItem = e.target.closest('.recipe-result-item');
      if (resultItem) {
        console.log('[addItemSearch] Selected recipe:', resultItem.dataset.recipeId, resultItem.dataset.recipeTitle);
        selectedRecipe = {
          recipeId: resultItem.dataset.recipeId,
          title: resultItem.dataset.recipeTitle
        };

        // Highlight selected
        resultsDiv.querySelectorAll('.recipe-result-item').forEach(item => {
          item.style.background = '';
        });
        resultItem.style.background = 'rgba(77,163,255,0.1)';

        okBtn.disabled = false;
        okBtn.style.opacity = '1';
      }
    });

    // Show initial recipes when modal opens
    performSearch();

    card.querySelector('#addItemClose').addEventListener('click', () => cleanup(null));
    card.querySelector('#addItemCancel').addEventListener('click', () => cleanup(null));
    card.querySelector('#addItemOk').addEventListener('click', async () => {
      if (!selectedRecipe) return;

      const itemType = card.querySelector('#addItemType').value;

      const result = await api('addAdditionalItem', {
        date,
        slot,
        recipeId: selectedRecipe.recipeId,
        title: selectedRecipe.title,
        itemType
      });

      if (result.ok) {
        await loadPlansIntoUi(PLAN.start, PLAN.days);
        cleanup(true);
      } else {
        showToast('Error adding item: ' + (result.message || 'Unknown error'), 'error');
      }
    });

    // Prevent clicks on card from closing modal
    card.addEventListener('click', (ev) => {
      ev.stopPropagation();
    });

    ov.addEventListener('click', (ev) => {
      console.log('[showAddAdditionalItemModal] Overlay clicked, target:', ev.target);
      if (ev.target === ov) {
        console.log('[showAddAdditionalItemModal] Closing modal from overlay click');
        cleanup(null);
      }
    });
  });
}

// Show popover for additional items in grid view
async function showGridAdditionalItemsPopover(buttonEl, date, slot) {
  // Remove any existing popover
  const existing = document.querySelector('.grid-additional-popover');
  if (existing) existing.remove();

  // Fetch additional items
  const result = await api('getAdditionalItems', { date, slot });
  if (!result.ok || !result.items || result.items.length === 0) {
    return;
  }

  const items = result.items;

  // Create popover
  const popover = document.createElement('div');
  popover.className = 'grid-additional-popover';
  popover.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
          <div style="font-weight:600;font-size:14px;color:var(--fg);">Additional Items</div>
          <button class="popover-close-btn" style="background:none;border:none;color:#6b7280;cursor:pointer;font-size:18px;padding:4px;line-height:1;">×</button>
        </div>
        ${items.map(item => `
          <div class="popover-item" style="padding:8px 0;border-bottom:1px solid var(--line);display:flex;align-items:center;gap:8px;">
            <span class="item-type-badge" style="background:#4da3ff;color:white;padding:3px 8px;border-radius:4px;font-size:10px;text-transform:uppercase;font-weight:600;">${escapeHtml(item.ItemType || 'side')}</span>
            <span style="flex:1;font-size:13px;color:var(--fg);">${escapeHtml(item.Title || '')}</span>
            <button class="ghost" data-action="planner-view" data-rid="${escapeAttr(item.RecipeId)}" style="padding:4px 8px;font-size:11px;">View</button>
          </div>
        `).join('')}
        <button class="btn-add-additional" data-date="${escapeAttr(date)}" data-slot="${escapeAttr(slot)}" style="margin-top:10px;width:100%;padding:8px 16px;background:#4da3ff;color:#fff;border:none;border-radius:6px;cursor:pointer;font-size:12px;font-weight:600;">
          + Add More
        </button>
      `;

  document.body.appendChild(popover);

  // Position the popover below the button, ensuring it stays within viewport
  const rect = buttonEl.getBoundingClientRect();
  popover.style.position = 'fixed';
  popover.style.top = `${rect.bottom + 5}px`;
  popover.style.zIndex = '10000';

  // Calculate left position, ensuring popover doesn't go off-screen
  const popoverWidth = 320; // Estimated width
  let leftPos = rect.left;

  // If popover would go off right edge, align it to the right edge of button instead
  if (leftPos + popoverWidth > window.innerWidth - 20) {
    leftPos = Math.max(20, rect.right - popoverWidth);
  }

  // Ensure popover doesn't go off left edge
  leftPos = Math.max(20, leftPos);

  popover.style.left = `${leftPos}px`;

  // Function to close popover
  const closePopover = () => {
    popover.remove();
    document.removeEventListener('click', clickOutsideHandler);
  };

  // Close button handler
  popover.querySelector('.popover-close-btn').addEventListener('click', (e) => {
    e.stopPropagation();
    closePopover();
  });

  // Close when "Add More" is clicked (will open the modal)
  popover.querySelector('.btn-add-additional').addEventListener('click', () => {
    closePopover();
  });

  // Close popover when clicking outside
  const clickOutsideHandler = (e) => {
    if (!popover.contains(e.target) && !buttonEl.contains(e.target)) {
      closePopover();
    }
  };

  setTimeout(() => {
    document.addEventListener('click', clickOutsideHandler);
  }, 0);
}

// Show modal to assign a collection to a meal slot
async function showAssignCollectionModal(date, slot) {
  return new Promise(async (resolve) => {
    // Load collections first
    const collectionsResult = await api('listCollections', {});
    if (!collectionsResult.ok || !collectionsResult.collections || collectionsResult.collections.length === 0) {
      showToast('No collections found. Please create a collection first in the Collections tab.', 'info');
      resolve(null);
      return;
    }

    const collections = collectionsResult.collections;

    const ov = document.createElement('div');
    ov.style.cssText = 'position:fixed;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.7);z-index:9999;';

    const card = document.createElement('div');
    card.style.cssText = 'background:#ffffff;border-radius:16px;padding:28px;max-width:500px;width:90%;box-shadow:0 25px 80px rgba(0,0,0,0.5);';

    card.innerHTML = `
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px;">
            <div style="font-size:20px;font-weight:700;color:#111;">📚 Assign Collection</div>
            <button id="assignCollectionClose" style="padding:10px 16px;border-radius:50%;border:1px solid #e5e7eb;background:#f9fafb;cursor:pointer;font-size:18px;color:#6b7280;">✕</button>
          </div>
          <div style="font-size:15px;color:#111111;line-height:1.6;margin-bottom:20px;padding:16px;background:#f3f4f6;border-radius:10px;">
            <strong style="color:#111111;">${escapeHtml(date)} ${escapeHtml(slot)}</strong><br>
            Select a collection to assign to this meal slot. The first recipe will become the main meal, and the rest will be added as sides/desserts.
          </div>
          
          <div style="margin-bottom:20px;">
            <label style="display:block;margin-bottom:8px;font-size:14px;font-weight:600;color:#374151;">Select Collection:</label>
            <select id="collectionSelect" style="width:100%;padding:14px 16px;border:2px solid #3b82f6;border-radius:10px;font-size:15px;background:#fff;cursor:pointer;color:#111;">
              <option value="">-- Choose a collection --</option>
              ${collections.map(c => `<option value="${escapeAttr(c.CollectionId)}">${escapeHtml(c.Name)}</option>`).join('')}
            </select>
          </div>

          <div style="display:flex;justify-content:flex-end;gap:12px;">
            <button id="assignCollectionCancel" style="padding:14px 24px;border-radius:10px;border:1px solid #e5e7eb;background:#f9fafb;cursor:pointer;font-size:14px;color:#374151;">Cancel</button>
            <button id="assignCollectionOk" disabled style="padding:14px 28px;border-radius:10px;font-weight:600;background:#2563eb;color:#ffffff;border:none;cursor:pointer;font-size:14px;box-shadow:0 4px 12px rgba(37,99,235,0.3);opacity:0.5;">Assign Collection</button>
          </div>
        `;

    ov.appendChild(card);
    document.body.appendChild(ov);

    function cleanup(val) {
      try { document.body.removeChild(ov); } catch (_) { }
      resolve(val);
    }

    const selectEl = card.querySelector('#collectionSelect');
    const okBtn = card.querySelector('#assignCollectionOk');

    selectEl.addEventListener('change', () => {
      if (selectEl.value) {
        okBtn.disabled = false;
        okBtn.style.opacity = '1';
      } else {
        okBtn.disabled = true;
        okBtn.style.opacity = '0.5';
      }
    });

    card.querySelector('#assignCollectionClose').addEventListener('click', () => cleanup(null));
    card.querySelector('#assignCollectionCancel').addEventListener('click', () => cleanup(null));
    card.querySelector('#assignCollectionOk').addEventListener('click', async () => {
      const collectionId = selectEl.value;
      if (!collectionId) return;

      console.log('[assignCollectionModal] Assigning collection', collectionId, 'to', date, slot);

      const result = await api('assignCollectionToSlot', {
        date,
        slot,
        collectionId
      });

      console.log('[assignCollectionModal] API result:', result);

      if (result.ok) {
        // Get collection name before cleanup
        const collectionName = selectEl.options[selectEl.selectedIndex].text;

        // Reload the current planner view to show changes FIRST
        console.log('[assignCollectionModal] Reloading planner view');
        await loadPlansIntoUi(PLAN.start, PLAN.days);

        // Wait a moment for render to complete (includes additional items timeout)
        await new Promise(resolve => setTimeout(resolve, 300));

        // Force scroll to the assigned date if in list view
        if (PLAN.viewMode === 'list') {
          const dayElement = document.querySelector(`#planList [data-day="${date}"]`);
          if (dayElement) {
            dayElement.open = true;  // Ensure details is expanded
            dayElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }
        }

        // Then cleanup modal
        cleanup(true);

        // Show success message after everything is done
        showToast(`Collection "${collectionName}" assigned to ${slot} on ${date}`, 'success');
      } else {
        showToast('Error assigning collection: ' + (result.error || 'Unknown error'), 'error');
      }
    });

    ov.addEventListener('click', (ev) => { if (ev.target === ov) cleanup(null); });
  });
}

// Show modal to assign collection to a specific meal slot (Breakfast, Lunch, or Dinner)
async function showAssignCollectionFromCollectionsTab(collectionId, collectionName) {
  // Get collection recipes first
  const res = await api('listCollectionRecipes', { collectionId });
  if (!res.ok || !res.recipes || res.recipes.length === 0) {
    showToast(`No recipes found in "${collectionName}"`, 'info');
    return;
  }

  const recipes = res.recipes;

  const cleanup = () => {
    if (card) card.remove();
    if (ov) ov.remove();
  };

  const ov = document.createElement('div');
  ov.className = 'modal-overlay';
  ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.6);z-index:9999;display:flex;align-items:center;justify-content:center;';

  const card = document.createElement('div');
  card.className = 'modal-card';
  // Match the new 'Assign to Day' style
  card.style.cssText = 'min-width:600px;max-width:90vw;max-height:85vh;height:auto;display:flex;flex-direction:column; background:var(--card-elevated); color:var(--text); padding:24px; border-radius:12px;';

  card.innerHTML = `
        <h3 style="margin-top:0;margin-bottom:16px;font-size:20px;">🍽️ Assign Collection to Meal</h3>
        <div style="background:rgba(77,163,255,0.1);border:1px solid rgba(77,163,255,0.3);border-radius:8px;padding:12px;margin-bottom:16px;">
          <div style="font-weight:600;color:var(--text);">${escapeHtml(collectionName)}</div>
          <div style="font-size:12px;color:var(--muted);">${recipes.length} recipe${recipes.length === 1 ? '' : 's'} in collection</div>
        </div>
        
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px;">
          <div>
            <label style="display:block;margin-bottom:4px;font-size:13px;font-weight:600;">Select Date:</label>
            <input type="date" id="assignCollectionDate" style="width:100%;padding:10px 12px;border-radius:8px;font-size:14px;box-sizing:border-box; background:var(--bg-darker); border:1px solid var(--line); color:var(--text);" />
          </div>
          <div>
            <label style="display:block;margin-bottom:4px;font-size:13px;font-weight:600;">Select Meal Slot:</label>
            <select id="assignCollectionSlot" style="width:100%;padding:10px 12px;border-radius:8px;font-size:14px;cursor:pointer; background:var(--bg-darker); border:1px solid var(--line); color:var(--text);">
              <option value="">-- Choose a slot --</option>
              <option value="Breakfast">Breakfast</option>
              <option value="Lunch">Lunch</option>
              <option value="Dinner">Dinner</option>
            </select>
          </div>
        </div>
        
        <div style="margin-bottom:16px; flex:1; overflow-y:auto; padding-right:4px;">
           <div style="font-size:13px;font-weight:600;margin-bottom:12px;">Assign recipes:</div>
           
           <div class="assign-day-block" style="background:var(--bg-darker); border:1px solid var(--line); border-radius:8px; padding:12px;">
             <!-- Main Dish Selector -->
             <div style="display:flex; gap:8px; margin-bottom:8px; align-items:center;">
               <span style="font-size:12px; width:40px; color:var(--muted);">Main:</span>
               <select id="assignCollectionMain" style="flex:1; padding:6px; border-radius:6px; font-size:13px; background:var(--card); border:1px solid var(--line); color:var(--text);">
                <option value="">-- Select Main Dish --</option>
                ${recipes.map(r => `<option value="${escapeAttr(r.RecipeId)}">${escapeHtml(r.Title)}</option>`).join('')}
              </select>
            </div>
            
            <!-- Dynamic Sides Container -->
            <div id="assignCollectionSidesContainer">
               <!-- Sides added dynamically -->
            </div>
            
            <button id="assignCollectionAddSide" class="ghost" style="font-size:11px; padding:4px 8px; width:100%; border:1px dashed var(--line-strong); margin-top:4px; cursor:pointer;">+ Add Side Dish</button>
           </div>
        </div>
        
        <div style="display:flex;gap:10px;justify-content:flex-end;margin-top:auto;">
          <button id="assignCollectionCancel" style="padding:10px 20px;background:var(--bg-darker);color:var(--text);border:1px solid var(--line);border-radius:8px;cursor:pointer;font-weight:600;">Cancel</button>
          <button id="assignCollectionOk" style="padding:10px 20px;background:var(--accent);color:#fff;border:none;border-radius:8px;cursor:pointer;font-weight:600;">Assign Collection</button>
        </div>
  `;

  ov.appendChild(card);
  document.body.appendChild(ov);

  const dateInput = card.querySelector('#assignCollectionDate');
  const slotSelect = card.querySelector('#assignCollectionSlot');
  const mainSelect = card.querySelector('#assignCollectionMain');
  const sidesContainer = card.querySelector('#assignCollectionSidesContainer');
  const addSideBtn = card.querySelector('#assignCollectionAddSide');
  const okBtn = card.querySelector('#assignCollectionOk');
  const cancelBtn = card.querySelector('#assignCollectionCancel');

  // Set default date to today
  const today = new Date();
  dateInput.value = today.toISOString().split('T')[0];

  // Auto-select first recipe as main if available
  if (recipes.length > 0) {
    mainSelect.value = recipes[0].RecipeId;
  }

  // Pre-populate side dishes if > 1 recipe
  if (recipes.length > 1) {
    for (let i = 1; i < recipes.length; i++) {
      addSideRow(recipes[i].RecipeId);
    }
  }

  function addSideRow(selectedId = '') {
    const div = document.createElement('div');
    div.className = 'assign-side-row';
    div.style.cssText = 'display:flex; gap:8px; margin-bottom:8px; align-items:center; animation:fadeInScale 0.2s ease-out;';
    div.innerHTML = `
         <span style="font-size:12px; width:40px; color:var(--muted); text-align:right;">Side:</span>
         <select class="assign-side-select" style="flex:1; padding:6px; border-radius:6px; font-size:13px; background:var(--card); border:1px solid var(--line); color:var(--text);">
            <option value="">-- Select Side --</option>
            ${recipes.map(r => `<option value="${escapeAttr(r.RecipeId)}">${escapeHtml(r.Title)}</option>`).join('')}
         </select>
         <button class="btn-remove-side-row" style="background:none; border:none; color:var(--danger); cursor:pointer;">✕</button>
      `;
    sidesContainer.appendChild(div);

    const sel = div.querySelector('select');
    if (selectedId) sel.value = selectedId;

    div.querySelector('.btn-remove-side-row').onclick = () => div.remove();
  }

  addSideBtn.addEventListener('click', () => addSideRow());
  cancelBtn.addEventListener('click', () => cleanup(false));
  ov.addEventListener('click', (ev) => { if (ev.target === ov) cleanup(false); });

  okBtn.addEventListener('click', async () => {
    const date = dateInput.value;
    const slot = slotSelect.value;
    const mainRid = mainSelect.value;

    if (!date) { showToast('Please select a date', 'warning'); return; }
    if (!slot) { showToast('Please select a meal slot', 'warning'); return; }

    okBtn.disabled = true;
    okBtn.textContent = 'Assigning...';

    try {
      // Get active user
      const activeUserRes = await api('getActiveUser', {});
      const userId = (activeUserRes.ok && activeUserRes.userId) ? activeUserRes.userId : null;

      // 1. Assign Main Dish
      if (mainRid) {
        const r = recipes.find(x => x.RecipeId === mainRid);
        await api('upsertUserPlanMeal', {
          userId, date, slot,
          meal: { RecipeId: mainRid, Title: r ? r.Title : 'Recipe' }
        });
      }

      // 2. Assign Side Dishes
      const sideSelects = sidesContainer.querySelectorAll('.assign-side-select');
      for (const sSel of sideSelects) {
        const sideRid = sSel.value;
        if (sideRid) {
          const r = recipes.find(x => x.RecipeId === sideRid);
          await api('addAdditionalItem', {
            date, slot,
            recipeId: sideRid,
            title: r ? r.Title : 'Side Dish',
            itemType: 'side'
          });
        }
      }

      // Switch to Meal Planner tab
      document.querySelector('[data-tab="planner"]').click();
      await new Promise(resolve => setTimeout(resolve, 100));

      // Reload the planner
      const currentStart = PLAN.start || ymd(new Date());
      const currentDays = PLAN.days || 7;
      await loadPlansIntoUi(currentStart, currentDays);

      // Wait for render
      await new Promise(resolve => setTimeout(resolve, 300));

      // Scroll to assigned date
      const dayElement = document.querySelector(`#planList [data-day="${date}"]`);
      if (dayElement) {
        dayElement.open = true;
        dayElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }

      cleanup(true);
      showToast(`Collection items assigned to ${slot} on ${date}`, 'success');
    } catch (err) {
      console.error('Error assigning collection:', err);
      showToast('Error: ' + err.message, 'error');
      okBtn.disabled = false;
      okBtn.textContent = 'Assign Collection';
    }
  });
}

// Show modal to assign collection to a full day (Breakfast, Lunch, Dinner)
async function showAssignCollectionToDayModal(collectionId, collectionName) {
  // Get collection recipes first
  const res = await api('listCollectionRecipes', { collectionId });
  if (!res.ok || !res.recipes || res.recipes.length === 0) {
    showToast(`No recipes found in "${collectionName}"`, 'info');
    return;
  }

  const recipes = res.recipes;
  const recipeCount = recipes.length;

  const cleanup = (ok) => {
    if (card) card.remove();
    if (ov) ov.remove();
  };

  const ov = document.createElement('div');
  ov.className = 'modal-overlay';
  ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:9999;display:flex;align-items:center;justify-content:center;';

  const card = document.createElement('div');
  card.className = 'modal-card';
  card.style.cssText = 'background:var(--card-elevated); border-radius:12px; padding:24px; min-width:550px; max-width:90vw; max-height:90vh; display:flex; flex-direction:column; color:var(--text);';

  card.innerHTML = `
    <h3 style="margin-top:0;margin-bottom:16px;font-size:20px;">📆 Assign Collection to Day</h3>
    <div style="background:rgba(77,163,255,0.1);border:1px solid rgba(77,163,255,0.3);border-radius:8px;padding:12px;margin-bottom:16px;">
      <div style="font-weight:600;margin-bottom:4px;color:var(--text);">${escapeHtml(collectionName)}</div>
      <div style="font-size:12px;color:var(--muted);">${recipeCount} recipe${recipeCount === 1 ? '' : 's'} in collection</div>
    </div>
    
    <div style="margin-bottom:16px;">
      <label style="display:block;margin-bottom:4px;font-size:13px;font-weight:600;">Select Date:</label>
      <input type="date" id="assignDayDate" style="width:100%;padding:10px 12px;border-radius:8px;font-size:14px;box-sizing:border-box;" />
    </div>
    
    <div style="margin-bottom:20px; flex:1; overflow-y:auto; padding-right:4px;">
      <div style="font-size:13px;font-weight:600;margin-bottom:12px;">Assign recipes to meals:</div>
      
      <!-- Breakfast Block -->
      <div class="assign-day-block" style="background:var(--bg-darker); border:1px solid var(--line); border-radius:8px; padding:12px; margin-bottom:12px;">
        <div style="display:flex; align-items:center; gap:8px; margin-bottom:8px;">
          <span style="font-size:16px;">🌅</span>
          <span style="font-weight:600; font-size:14px;">Breakfast</span>
        </div>
        
        <div style="display:flex; gap:8px; margin-bottom:8px; align-items:center;">
          <span style="font-size:12px; width:40px; color:var(--muted);">Main:</span>
          <select class="assign-main-select" data-slot="Breakfast" style="flex:1; padding:6px; border-radius:6px; font-size:13px;">
            <option value="">-- None --</option>
            ${recipes.map(r => `<option value="${escapeAttr(r.RecipeId)}">${escapeHtml(r.Title)}</option>`).join('')}
          </select>
        </div>
        
        <div class="assign-sides-container" data-slot="Breakfast">
           <!-- Sides added dynamically -->
        </div>
        
        <button class="ghost btn-add-side-to-day" data-slot="Breakfast" style="font-size:11px; padding:4px 8px; width:100%; border:1px dashed var(--line-strong); margin-top:4px;">+ Add Side Dish</button>
      </div>

      <!-- Lunch Block -->
      <div class="assign-day-block" style="background:var(--bg-darker); border:1px solid var(--line); border-radius:8px; padding:12px; margin-bottom:12px;">
        <div style="display:flex; align-items:center; gap:8px; margin-bottom:8px;">
          <span style="font-size:16px;">☀️</span>
          <span style="font-weight:600; font-size:14px;">Lunch</span>
        </div>
        
        <div style="display:flex; gap:8px; margin-bottom:8px; align-items:center;">
           <span style="font-size:12px; width:40px; color:var(--muted);">Main:</span>
           <select class="assign-main-select" data-slot="Lunch" style="flex:1; padding:6px; border-radius:6px; font-size:13px;">
            <option value="">-- None --</option>
            ${recipes.map(r => `<option value="${escapeAttr(r.RecipeId)}">${escapeHtml(r.Title)}</option>`).join('')}
          </select>
        </div>
         <div class="assign-sides-container" data-slot="Lunch"></div>
         <button class="ghost btn-add-side-to-day" data-slot="Lunch" style="font-size:11px; padding:4px 8px; width:100%; border:1px dashed var(--line-strong); margin-top:4px;">+ Add Side Dish</button>
      </div>

      <!-- Dinner Block -->
      <div class="assign-day-block" style="background:var(--bg-darker); border:1px solid var(--line); border-radius:8px; padding:12px;">
        <div style="display:flex; align-items:center; gap:8px; margin-bottom:8px;">
          <span style="font-size:16px;">🌙</span>
          <span style="font-weight:600; font-size:14px;">Dinner</span>
        </div>
        
        <div style="display:flex; gap:8px; margin-bottom:8px; align-items:center;">
           <span style="font-size:12px; width:40px; color:var(--muted);">Main:</span>
           <select class="assign-main-select" data-slot="Dinner" style="flex:1; padding:6px; border-radius:6px; font-size:13px;">
            <option value="">-- None --</option>
            ${recipes.map(r => `<option value="${escapeAttr(r.RecipeId)}">${escapeHtml(r.Title)}</option>`).join('')}
          </select>
        </div>
        <div class="assign-sides-container" data-slot="Dinner"></div>
        <button class="ghost btn-add-side-to-day" data-slot="Dinner" style="font-size:11px; padding:4px 8px; width:100%; border:1px dashed var(--line-strong); margin-top:4px;">+ Add Side Dish</button>
      </div>
    
    </div>
    
    <div style="display:flex;gap:10px;justify-content:flex-end;margin-top:auto;">
      <button id="assignDayCancel" style="padding:10px 20px;background:var(--bg-darker);color:var(--text);border:1px solid var(--line);border-radius:8px;cursor:pointer;font-weight:600;">Cancel</button>
      <button id="assignDayOk" style="padding:10px 20px;background:var(--accent);color:#fff;border:none;border-radius:8px;cursor:pointer;font-weight:600;">Assign to Day</button>
    </div>
  `;

  ov.appendChild(card);
  document.body.appendChild(ov);

  const dateInput = card.querySelector('#assignDayDate');
  const mainSelects = card.querySelectorAll('.assign-main-select');
  const cancelBtn = card.querySelector('#assignDayCancel');
  const okBtn = card.querySelector('#assignDayOk');

  // Set default date to today
  const today = new Date();
  dateInput.value = today.toISOString().split('T')[0];

  // Auto-suggest recipes based on count (simple default)
  const meals = ['Breakfast', 'Lunch', 'Dinner'];
  if (recipeCount >= 1) mainSelects[2].value = recipes[0].RecipeId; // Dinner
  if (recipeCount >= 2) mainSelects[1].value = recipes[1].RecipeId; // Lunch
  if (recipeCount >= 3) mainSelects[0].value = recipes[2].RecipeId; // Breakfast

  // Side Dish Logic
  card.addEventListener('click', (e) => {
    if (e.target.classList.contains('btn-add-side-to-day')) {
      const slot = e.target.dataset.slot;
      const container = card.querySelector(`.assign-sides-container[data-slot="${slot}"]`);

      const div = document.createElement('div');
      div.className = 'assign-side-row';
      div.style.cssText = 'display:flex; gap:8px; margin-bottom:8px; align-items:center; animation:fadeInScale 0.2s ease-out;';
      div.innerHTML = `
         <span style="font-size:12px; width:40px; color:var(--muted); text-align:right;">Side:</span>
         <select class="assign-side-select" data-slot="${slot}" style="flex:1; padding:6px; border-radius:6px; font-size:13px; background:var(--bg-darker); border:1px solid var(--line); color:var(--text);">
            <option value="">-- Select Side --</option>
            ${recipes.map(r => `<option value="${escapeAttr(r.RecipeId)}">${escapeHtml(r.Title)}</option>`).join('')}
         </select>
         <button class="btn-remove-side-row" style="background:none; border:none; color:var(--danger); cursor:pointer;">✕</button>
      `;
      container.appendChild(div);

      div.querySelector('.btn-remove-side-row').onclick = () => div.remove();
    }
  });

  cancelBtn.addEventListener('click', () => cleanup(false));
  ov.addEventListener('click', (e) => { if (e.target === ov) cleanup(false); });

  okBtn.addEventListener('click', async () => {
    const date = dateInput.value;
    if (!date) {
      showToast('Please select a date', 'warning');
      return;
    }

    okBtn.disabled = true;
    okBtn.textContent = 'Assigning...';

    try {
      // Get active user
      const activeUserRes = await api('getActiveUser', {});
      const userId = (activeUserRes.ok && activeUserRes.userId) ? activeUserRes.userId : null;

      // Collect assignments per slot
      const slots = ['Breakfast', 'Lunch', 'Dinner'];

      for (const slot of slots) {
        // 1. Assign Main Dish
        const mainSel = card.querySelector(`.assign-main-select[data-slot="${slot}"]`);
        const mainRid = mainSel ? mainSel.value : '';

        if (mainRid) {
          const r = recipes.find(x => x.RecipeId === mainRid);
          await api('upsertUserPlanMeal', {
            userId, date, slot,
            meal: { RecipeId: mainRid, Title: r ? r.Title : 'Recipe' }
          });
        }

        // 2. Assign Side Dishes
        const sideSelects = card.querySelectorAll(`.assign-side-select[data-slot="${slot}"]`);
        for (const sSel of sideSelects) {
          const sideRid = sSel.value;
          if (sideRid) {
            const r = recipes.find(x => x.RecipeId === sideRid);
            await api('addAdditionalItem', {
              date, slot,
              recipeId: sideRid,
              title: r ? r.Title : 'Side Dish',
              itemType: 'side'
            });
          }
        }
      }

      // Switch to Meal Planner tab and reload
      document.querySelector('[data-tab="planner"]').click();
      await new Promise(resolve => setTimeout(resolve, 100));

      const currentStart = PLAN.start || ymd(new Date());
      const currentDays = PLAN.days || 7;
      await loadPlansIntoUi(currentStart, currentDays);
      await new Promise(resolve => setTimeout(resolve, 300));

      const dayElement = document.querySelector(`#planList [data-day="${date}"]`);
      if (dayElement) {
        dayElement.open = true;
        dayElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }

      cleanup(true);
      showToast(`Collection items assigned to ${date}`, 'success');

    } catch (err) {
      console.error('Error assigning day:', err);
      showToast('Error: ' + err.message, 'error');
      okBtn.disabled = false;
      okBtn.textContent = 'Assign to Day';
    }
  });
}

document.addEventListener('click', async (e) => {
  // Debug: Log click events on meal action buttons
  const mealAction = e.target.closest('[data-action]');
  if (mealAction) {
    console.log('[Document Click] Action:', mealAction.dataset.action, 'Target:', mealAction);
  }

  // Planner: Select / Replace opens the recipe picker
  const sel = e.target.closest('[data-action="select-meal"]');
  if (sel) {
    console.log('[Document Click] Opening meal picker for', sel.dataset.date, sel.dataset.slot);
    openMealPicker(sel.dataset.date, sel.dataset.slot);
    return;
  }

  // Backwards compatibility: older markup
  const pick = e.target.closest('[data-action="pick-meal"]');
  if (pick) { openMealPicker(pick.dataset.date, pick.dataset.slot); return; }

  // Planner: View/Edit/Print
  const pv = e.target.closest('[data-action="planner-view"],[data-action="view-meal"]');
  if (pv) { const rid = pv.dataset.rid; if (rid) await openRecipeModalView(rid); return; }

  const pe = e.target.closest('[data-action="planner-edit"],[data-action="edit-meal"]');
  if (pe) { const rid = pe.dataset.rid; if (rid) await openRecipeModalEdit(rid); return; }

  // Planner: Mark meal as cooked (deduct ingredients from pantry)
  const mc = e.target.closest('[data-action="mark-cooked"]');
  if (mc) {
    const rid = mc.dataset.rid;
    if (rid) {
      if (!confirm('Mark this meal as cooked? This will deduct ingredients from your pantry.')) return;
      const res = await api('markMealCooked', { recipeId: rid });
      if (res.ok) {
        const msg = res.totalDeducted > 0
          ? `Meal marked as cooked. ${res.totalDeducted} ingredient(s) deducted from pantry.`
          : 'Meal marked as cooked. No pantry items were affected.';
        showToast(msg, 'success', 3000);
        await loadPantry();
      } else {
        showToast(res.error || 'Failed to mark meal as cooked', 'error');
      }
    }
    return;
  }

  const pp = e.target.closest('[data-action="planner-print"],[data-action="print-meal"]');
  if (pp) {
    const rid = pp.dataset.rid;
    if (rid) {
      // Load recipe first, wait for it to fully load with categories
      await openRecipeModalView(rid);
      // Now print with whatever quantities are displayed
      printRecipeWithQuantities();
    }
    return;
  }

  // Planner: Clear
  const clear = e.target.closest('[data-action="clear-meal"]');
  if (clear) {
    const date = clear.dataset.date;
    const slot = clear.dataset.slot;

    // Capture meal data BEFORE clearing for undo
    const plan = PLAN.plansByDate[date];
    const meals = plan && plan[slot];

    // Phase 4.5.7: Handle array of meals
    const mealsArray = Array.isArray(meals) ? meals : (meals ? [meals] : []);

    if (mealsArray.length > 0) {
      // Push to undo stack before clearing (simplified - store all meals)
      pushUndo('delete_meal', {
        date,
        slot,
        meals: mealsArray.map(m => ({ ...m })) // Clone meals
      }, `Delete ${slot} meal(s)`);
    }

    // Phase 4.5.7: Clear all user meals for this slot
    await upsertUserMeal(date, slot, null);
    await loadPlansIntoUi(PLAN.start, PLAN.days);
    await loadPantry(); // Refresh pantry after clearing meal
    await refreshDashboardIfToday(date); // Refresh dashboard if today's meal changed

    if (mealsArray.length > 0) {
      showToast(`Meal(s) cleared. Press Cmd+Z to undo.`, 'success', 3000);
    }
    return;
  }

  // Additional Items: Add Side/Dessert button (list view and popover)
  const btnAdd = e.target.closest('.btn-add-additional,.btn-add-additional-main');
  if (btnAdd) {
    console.log('[Click Handler] Add Side/Dessert button clicked', btnAdd.dataset);
    const date = btnAdd.dataset.date;
    const slot = btnAdd.dataset.slot;
    console.log('[Click Handler] Calling showAddAdditionalItemModal with', date, slot);
    await showAddAdditionalItemModal(date, slot);
    return;
  }

  // Grid View: Add Side button (+ Side button in grid cells)
  const btnAddSide = e.target.closest('[data-action="add-side-to-slot"],.grid-add-side-btn');
  if (btnAddSide) {
    e.stopPropagation();
    console.log('[Click Handler] Grid Add Side button clicked', btnAddSide.dataset);
    const date = btnAddSide.dataset.date;
    const slot = btnAddSide.dataset.slot;
    await showAddAdditionalItemModal(date, slot);
    return;
  }

  // Additional Items: Remove button
  const btnRemove = e.target.closest('.btn-remove-additional');
  if (btnRemove) {
    const id = btnRemove.dataset.id;
    const date = btnRemove.dataset.date;
    const slot = btnRemove.dataset.slot;

    if (confirm('Remove this additional item?')) {
      // Capture item data BEFORE removal for undo (would need API to get item details)
      // For now, simplified version without full undo support
      // TODO: Add getAdditionalItem API if full undo needed

      await api('removeAdditionalItem', { id });
      await loadPlansIntoUi(PLAN.start, PLAN.days);

      showToast('Additional item removed', 'success');
    }
    return;
  }

  // Assign Collection button
  const btnAssignCollection = e.target.closest('.btn-assign-collection');
  if (btnAssignCollection) {
    const date = btnAssignCollection.dataset.date;
    const slot = btnAssignCollection.dataset.slot;
    await showAssignCollectionModal(date, slot);
    return;
  }

  // Phase 4.5.7: Add Another Meal button
  const btnAddAnother = e.target.closest('[data-action="add-another-meal"]');
  if (btnAddAnother) {
    const date = btnAddAnother.dataset.date;
    const slot = btnAddAnother.dataset.slot;
    openMealPicker(date, slot);
    return;
  }

  // Phase 4.5.7: Delete User Meal button
  const btnDeleteMeal = e.target.closest('[data-action="delete-user-meal"]');
  if (btnDeleteMeal) {
    const mealId = btnDeleteMeal.dataset.mealId;
    const date = btnDeleteMeal.dataset.date;
    const slot = btnDeleteMeal.dataset.slot;

    if (confirm('Delete this meal?')) {
      const result = await api('deleteUserPlanMeal', { mealId });
      if (result.ok) {
        showToast('Meal deleted', 'success');
        await loadPlansIntoUi(PLAN.start, PLAN.days);
        await loadPantry(); // Refresh pantry after deleting meal
        await refreshDashboardIfToday(date); // Refresh dashboard if today's meal changed
      } else {
        showToast('Failed to delete meal: ' + result.error, 'error');
      }
    }
    return;
  }

  // Clear Day button
  const btnClearDay = e.target.closest('[data-action="clear-day"]');
  if (btnClearDay) {
    const date = btnClearDay.dataset.date;
    if (date) await clearDay(date);
    return;
  }

  // Grid View: Expand button for additional items
  const expandBtn = e.target.closest('.grid-expand-btn');
  if (expandBtn) {
    e.stopPropagation(); // Prevent dragging
    const date = expandBtn.dataset.date;
    const slot = expandBtn.dataset.slot;
    await showGridAdditionalItemsPopover(expandBtn, date, slot);
    return;
  }
});

// ---------- shopping list ----------
const SHOP = { start: '', end: '', groups: [], storeFilter: 'all' };

function normalizeShopTitle_(s) {
  const str = String(s || '').trim();
  const denOk = new Set(['2', '3', '4', '8', '16']);
  let out = str.replace(/^(\d+)\s+(\d+)\s+(\d+)\b/, (m, a, b, c) => denOk.has(c) ? `${a} ${b}/${c}` : m);
  out = out.replace(/^(\d+)\s+(\d+)\b/, (m, a, b) => denOk.has(b) ? `${a}/${b}` : m);
  return out;
}


function shopQtyDisplay_(it) {
  // Prefer numeric quantity when present; format as common cooking fractions for display.
  const qnRaw = (it && (it.QtyNum !== null && it.QtyNum !== undefined && it.QtyNum !== '')) ? Number(it.QtyNum) : null;
  const qn = (qnRaw !== null && Number.isFinite(qnRaw)) ? qnRaw : null;

  // If QtyText exists and looks meaningful, keep it (this mirrors ingredients behavior).
  // However, some legacy rows may have malformed QtyText; in that case, prefer QtyNum formatting.
  const qt = String((it && it.QtyText) || '').trim();

  function normalizeLostSlash_(s) {
    const denOk = new Set(['2', '3', '4', '8', '16']);
    // "2 1 2 ..." => "2 1/2 ..."
    s = s.replace(/^(\d+)\s+(\d+)\s+(\d+)\b/, (m, a, b, c) => denOk.has(c) ? `${a} ${b}/${c}` : m);
    // "1 2 ..." => "1/2 ..."
    s = s.replace(/^(\d+)\s+(\d+)\b/, (m, a, b) => denOk.has(b) ? `${a}/${b}` : m);
    return s;
  }

  function fracFromNumber_(x) {
    const sign = x < 0 ? -1 : 1;
    let v = Math.abs(x);

    const whole = Math.floor(v + 1e-12);
    const frac = v - whole;

    // Candidate denominators (common in recipes)
    const denoms = [2, 3, 4, 8, 16];
    let best = null;
    for (const d of denoms) {
      const n = Math.round(frac * d);
      const approx = n / d;
      const err = Math.abs(approx - frac);
      if (!best || err < best.err) {
        best = { n, d, err };
      }
    }

    // Relaxed threshold so common cooking decimals display correctly.
    if (!best || best.err > 0.02) {
      return null;
    }

    let n = best.n;
    let d = best.d;
    if (n === 0) {
      return sign * whole;
    }
    if (n === d) {
      return sign * (whole + 1);
    }

    // Reduce fraction
    const gcd = (a, b) => b ? gcd(b, a % b) : a;
    const g = gcd(n, d);
    n = n / g; d = d / g;

    const w = whole;
    const prefix = (sign < 0) ? '-' : '';
    if (w === 0) {
      return `${prefix}${n}/${d}`;
    }
    return `${prefix}${w} ${n}/${d}`;
  }

  if (qn !== null) {
    const asFrac = fracFromNumber_(qn);
    if (asFrac !== null) {
      return String(asFrac);
    }
    // If it is effectively an integer, show as integer
    if (Math.abs(qn - Math.round(qn)) < 1e-9) return String(Math.round(qn));
    // Otherwise, fall back to up to 3 decimals without trailing zeros
    return String(Number(qn.toFixed(3))).replace(/\.0+$/, '').replace(/(\.[0-9]*?)0+$/, '$1');
  }

  if (qt) return normalizeLostSlash_(qt);
  return '';
}

function storeOptionsHtml_(selectedId) {
  const sid0 = String(selectedId || '');
  const sid = (!sid0 || sid0 === 'unassigned') ? (getDefaultStoreId() || '') : sid0;

  const opts = (STORES || []).map(s => {
    const v = String(s.StoreId);
    const sel = (v === sid) ? 'selected' : '';
    return `<option value="${escapeAttr(v)}" ${sel}>${escapeHtml(s.Name || v)}</option>`;
  }).join('');

  const unSel = (!sid) ? 'selected' : '';
  return `<option value="" ${unSel}>Unassigned</option>` + opts;
}


function cuisineOptionsHtml_(selectedCuisine) {
  const cur = String(selectedCuisine || '').trim();

  // Use comprehensive cuisine list
  const items = COMPREHENSIVE_CUISINES.slice();

  // Add current value if not in list
  if (cur && !items.includes(cur)) {
    items.push(cur);
    items.sort((a, b) => a.localeCompare(b));
  }

  const noneSel = (!cur) ? 'selected' : '';
  return [`<option value="" ${noneSel}>(None)</option>`].concat(items.map(c => {
    const sel = (c === cur) ? 'selected' : '';
    return `<option value="${escapeAttr(c)}" ${sel}>${escapeHtml(c)}</option>`;
  })).join('');
}

function setCuisineSelect_(value) {
  const el = document.getElementById('rCuisine');
  if (!el) return;
  el.innerHTML = cuisineOptionsHtml_(value);
  el.value = String(value || '').trim();
}

function populateShopStoreFilter_() {
  const select = document.getElementById('shopStoreFilter');
  if (!select) return;

  const currentValue = SHOP.storeFilter || 'all';
  const storeIds = new Set();

  if (SHOP.groups && SHOP.groups.length) {
    for (const g of SHOP.groups) {
      if (g.StoreId) storeIds.add(g.StoreId);
    }
  }

  let html = '<option value="all">All Stores</option>';
  for (const sid of storeIds) {
    const name = getStoreNameById(sid) || (sid === 'unassigned' ? 'Unassigned' : sid);
    const sel = (sid === currentValue) ? ' selected' : '';
    html += `<option value="${escapeAttr(sid)}"${sel}>${escapeHtml(name)}</option>`;
  }

  select.innerHTML = html;

  if (currentValue !== 'all' && !storeIds.has(currentValue)) {
    SHOP.storeFilter = 'all';
    select.value = 'all';
  } else {
    select.value = currentValue;
  }
}

function renderShop_(groups) {
  SHOP.groups = Array.isArray(groups) ? groups : [];
  const out = document.getElementById('shopOut');

  // Populate store filter dropdown
  populateShopStoreFilter_();

  // ========== PHASE 4.1: Enhanced Empty State for Shopping List ==========
  if (!SHOP.groups.length) {
    out.innerHTML = `
          <div class="empty-state">
            <div class="empty-state-icon">🛒</div>
            <div class="empty-state-title">Your shopping list is empty!</div>
            <div class="empty-state-message">
              Plan meals for the week, then generate a shopping list<br>
              with all the ingredients you'll need.
            </div>
            <div class="empty-state-actions">
              <button class="primary" id="btnGoToMealPlanner">
                Go to Meal Planner
              </button>
            </div>
          </div>
        `;
    // Attach event listener for the button
    const goBtn = document.getElementById('btnGoToMealPlanner');
    if (goBtn) {
      goBtn.addEventListener('click', () => setTab('planner'));
    }
    return;
  }

  // Apply store filter
  // Normalize store comparison to handle undefined/null/empty StoreIds
  const normalizeStoreId = (sid) => (sid === null || sid === undefined || sid === '') ? 'unassigned' : String(sid);
  const normalizedFilter = normalizeStoreId(SHOP.storeFilter);
  
  const filteredGroups = normalizedFilter === 'all'
    ? SHOP.groups
    : SHOP.groups.filter(g => normalizeStoreId(g.StoreId) === normalizedFilter);

  if (filteredGroups.length === 0) {
    // If store filter resulted in empty, auto-reset to 'all' and show all groups
    const storeSelect = document.getElementById('shopStoreFilter');
    if (SHOP.storeFilter !== 'all' && storeSelect) {
      console.warn(`[Shopping] Store filter "${SHOP.storeFilter}" has no items, resetting to "all"`);
      SHOP.storeFilter = 'all';
      storeSelect.value = 'all';
      // Re-render with all groups
      renderShop_(SHOP.groups);
      return;
    }
    
    // If truly empty (even with 'all'), show empty state
    out.innerHTML = `
          <div class="empty-state">
            <div class="empty-state-icon">🔍</div>
            <div class="empty-state-title">No items for this store</div>
            <div class="empty-state-message">
              No ingredients are assigned to this store.<br>
              Select "All Stores" to see all items.
            </div>
          </div>
        `;
    return;
  }

  // Load bought status from localStorage
  let boughtItems = {};
  try {
    const saved = localStorage.getItem('foodieShoppingBought');
    if (saved) boughtItems = JSON.parse(saved);
  } catch (_) { }

  // Count total items (from filtered groups)
  const totalItems = filteredGroups.reduce((sum, g) => sum + g.Items.length, 0);
  const boughtCount = Object.values(boughtItems).filter(Boolean).length;

  // Build summary text - use normalized filter for proper display
  const getStoreName = (sid) => {
    if (sid === 'all') return 'All Stores';
    if (sid === 'unassigned' || !sid) return 'Unassigned';
    const name = getStoreNameById(sid);
    return name || `Store ${sid}`;
  };
  
  const filterText = normalizedFilter === 'all'
    ? `${totalItems} item${totalItems !== 1 ? 's' : ''} across ${filteredGroups.length} store${filteredGroups.length !== 1 ? 's' : ''}`
    : `${totalItems} item${totalItems !== 1 ? 's' : ''} at ${getStoreName(SHOP.storeFilter)}`;

  // Add summary at the top
  out.innerHTML = `
        <div style="background:rgba(77,163,255,0.1); border:1px solid rgba(77,163,255,0.3); border-radius:10px; padding:12px; margin-bottom:12px;">
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <span style="font-weight:600;">📝 Shopping Summary</span>
            <span>${filterText}</span>
          </div>
          <div style="margin-top:6px; font-size:13px; color:var(--muted);">
            ✓ Purchased: ${boughtCount} / ${totalItems} items
          </div>
        </div>
      ` + filteredGroups.map(g => {
    const storeName = getStoreNameById(g.StoreId) || (normalizeStoreId(g.StoreId) === 'unassigned' ? 'Unassigned' : g.StoreId || 'Unassigned');
    const isUnassigned = (normalizeStoreId(g.StoreId) === 'unassigned');

    // Group items by category (normalize to Title Case for display)
    const categoriesMap = {};
    const allCategories = new Set();

    // Helper to normalize category to Title Case
    const normalizeCategory = (cat) => {
      if (!cat || !cat.trim()) return 'Other';
      return String(cat).trim().charAt(0).toUpperCase() + String(cat).trim().slice(1).toLowerCase();
    };

    g.Items.forEach(item => {
      const cat = normalizeCategory(item.Category);
      allCategories.add(cat);
      if (!categoriesMap[cat]) categoriesMap[cat] = [];
      categoriesMap[cat].push(item);
    });

    // Sort categories: use META.categories order, put unknown categories at the end
    // Create lowercase set for case-insensitive matching
    const metaCategoriesLower = new Set((META.categories || []).map(c => String(c || '').toLowerCase()));
    const sortedCategories = (META.categories || []).filter(c => c && allCategories.has(c));
    const unknownCategories = [...allCategories].filter(c => !metaCategoriesLower.has(String(c || '').toLowerCase())).sort();
    const finalCategories = [...sortedCategories, ...unknownCategories];

    const categoriesHtml = finalCategories.map(cat => {
      const catItems = categoriesMap[cat] || [];
      return `
            <div style="margin-top: 12px;">
              <div style="font-size: 13px; font-weight: 600; color: var(--accent); padding: 6px 0; border-bottom: 1px solid var(--line); margin-bottom: 8px;">
                ${escapeHtml(cat || 'Other')}
              </div>
              <div style="display:flex; flex-direction:column; gap:8px;">
                ${catItems.map(it => {
        const storeIdForItem = (g.StoreId === 'unassigned') ? '' : g.StoreId;
        const itemKey = `${it.IngredientNorm}_${it.Unit || ''}`;
        const isBought = boughtItems[itemKey] || false;
        const itemStyle = isBought ? 'opacity:0.5; text-decoration:line-through;' : '';
        const fromPantryBadge = it.FromPantry ? '<span style="background:#10b981;color:white;padding:2px 6px;border-radius:3px;font-size:10px;margin-left:6px;">✓ FROM PANTRY</span>' : '';
        const partialPantryNote = it.PartialPantry ? ' <span class="muted" style="font-size:11px;">(partial from pantry)</span>' : '';

        // Advanced Normalization indicators
        const isMerged = it.IsMerged;
        const originalTooltip = isMerged && it.OriginalNames
          ? `Merged from: ${it.OriginalNames.join(', ')}`
          : '';
        const mergeIcon = isMerged
          ? `<span class="icon-merge" title="${escapeAttr(originalTooltip)}" style="cursor:help; font-size:12px; opacity:0.7;">🔗</span>`
          : '';
        const sourceIdsJson = it.SourceIds ? JSON.stringify(it.SourceIds) : '[]';

        return `
                    <div class="shop-item item" 
                         data-ingredient-norm="${escapeAttr(it.IngredientNorm)}" 
                         data-unit="${escapeAttr(it.Unit || '')}" 
                         data-qty="${escapeAttr(it.QtyNum || '')}"
                         data-source-ids="${escapeAttr(sourceIdsJson)}">
                      <div class="shop-item-check">
                        <input type="checkbox" 
                               data-action="shop-item-toggle" 
                               data-itemkey="${escapeAttr(itemKey)}"
                               ${isBought ? 'checked' : ''}
                               style="width:18px; height:18px; cursor:pointer;">
                      </div>
                      <div class="shop-item-details">
                        <div class="shop-item-name">
                          <strong>${escapeHtml(normalizeShopTitle_(it.IngredientNorm))}</strong> 
                          ${mergeIcon}
                          <span class="muted" style="font-size: 0.8em; font-weight: 400; margin-left: 4px;">x${escapeHtml(it.Count)}</span>
                          ${fromPantryBadge}
                          ${partialPantryNote}
                        </div>
                        <div class="shop-item-meta">
                          <div class="muted">${(it.Examples || []).map(x => escapeHtml(x)).join(' • ')}</div>
                          <div class="muted">Quantity: <strong>${escapeHtml(shopQtyDisplay_(it) || '')}</strong> ${escapeHtml(it.Unit || '')}</div>
                        </div>
                      </div>
                      <div class="shop-item-actions-wrapper">
                        <div class="shop-item-store-select" style="min-width: 160px;">
                          <select data-action="shop-item-store" data-ingredient="${escapeAttr(it.IngredientNorm)}" data-unit="${escapeAttr(it.Unit || '')}" data-storeid="${escapeAttr(storeIdForItem)}" data-sourceids="${escapeAttr(sourceIdsJson)}" style="padding: 4px 8px; height: 30px; font-size: 13px;">
                            ${storeOptionsHtml_(storeIdForItem)}
                          </select>
                        </div>
                        <div class="shop-item-actions">
                          <button class="ghost mini" data-action="shop-item-edit" title="Rename (Updates underlying recipes)">✏️ Edit</button>
                          <button class="danger mini" data-action="shop-item-remove" data-ingredient="${escapeAttr(it.IngredientNorm)}" data-unit="${escapeAttr(it.Unit || '')}" data-qty="${escapeAttr(it.QtyNum || '')}" title="Remove and return to pantry">Remove</button>
                        </div>
                      </div>
                    </div>
                  `;
      }).join('')}
              </div>
            </div>
          `;
    }).join('');

    return `
          <details open class="item" style="padding:10px;">
            <summary style="display:flex; justify-content:space-between; align-items:center; gap:10px;">
              <span>${escapeHtml(storeName)} (${g.Items.length})</span>
              <span class="actions" style="margin-left:auto;">
                <button class="ghost" data-action="shop-print-store" data-storeid="${escapeAttr(g.StoreId)}">Print</button>
              </span>
            </summary>
            <div style="margin-top:10px;">
              ${categoriesHtml}
              ${isUnassigned ? `<div class="muted" style="margin-top: 12px;">Unassigned items must be assigned a store before printing a complete by-store list.</div>` : ``}
            </div>
          </details>
        `;
  }).join('');
}

function persistShop_() {
  try {
    localStorage.setItem('foodieShoppingLast', JSON.stringify({ start: SHOP.start, end: SHOP.end, groups: SHOP.groups }));
  } catch (_) { }
}
function loadPersistedShop_() {
  try {
    const raw = localStorage.getItem('foodieShoppingLast');
    if (!raw) return;
    const obj = JSON.parse(raw);
    if (obj && Array.isArray(obj.groups)) {
      SHOP.start = String(obj.start || '');
      SHOP.end = String(obj.end || '');
      renderShop_(obj.groups);
    }
  } catch (_) { }
}

async function buildShop() {
  const start = document.getElementById('shopStart').value;
  const end = document.getElementById('shopEnd').value;
  if (!start || !end) {
    document.getElementById('shopOut').innerHTML = `<div class="muted">Please select start and end dates.</div>`;
    return;
  }
  SHOP.start = start;
  SHOP.end = end;

  const out = document.getElementById('shopOut');
  out.innerHTML = `<div class="muted">Generating...</div>`;
  const includeLowStock = document.getElementById('shopIncludeLowStock').checked;

  // Phase 4.5.7: Get active user ID for multi-user shopping list
  const activeUserRes = await api('getActiveUser');
  const userId = (activeUserRes.ok && activeUserRes.userId) ? activeUserRes.userId : null;

  // Build main shopping list from date range
  const res = await api('buildShoppingList', { userId, start, end, excludeLeftovers: true, includeLowStock });
  if (!res.ok) {
    out.innerHTML = `<div class="muted">Error: ${escapeHtml(res.error || '')}</div>`;
    return;
  }

  let groups = res.groups || [];
  const pantryWarnings = res.pantryWarnings || [];
  const pantryDeductions = res.pantryDeductions || [];

  // Show pantry deductions summary
  if (pantryDeductions.length > 0) {
    showToast(`Pantry deducted: ${pantryDeductions.length} items`, 'info', 3000);
  }

  // Show pantry warnings
  if (pantryWarnings.length > 0) {
    const warningMsg = pantryWarnings.map(w => w.message).join('\n');
    showToast(`⚠️ Low stock warnings:\n${warningMsg}`, 'warning', 8000);
  }

  // Check if collections should be included
  const includeCollections = document.getElementById('shopIncludeCollections').checked;
  if (includeCollections) {
    const selectedCollections = getSelectedCollections();

    if (selectedCollections.length > 0) {
      // Get existing recipe IDs from the main shopping list to avoid duplicates
      const existingRecipeIds = new Set();
      for (const group of groups) {
        for (const item of group.Items || []) {
          for (const ex of item.Examples || []) {
            // Extract recipe ID from examples if available (not implemented in current schema)
            // For now, we'll deduplicate by ingredient name
          }
        }
      }

      // Aggregate ingredients from selected collections
      for (const collectionId of selectedCollections) {
        const collRes = await api('listCollectionRecipes', { collectionId });
        if (!collRes.ok || !collRes.recipes) continue;

        for (const recipe of collRes.recipes) {
          const ingRes = await api('listRecipeIngredients', { recipeId: recipe.RecipeId });
          if (!ingRes.ok || !ingRes.items) continue;

          // Merge ingredients into groups
          for (const ing of ingRes.items) {
            const storeId = ing.StoreId || '';
            const category = ing.Category || 'Other';
            const ingredientNorm = (ing.IngredientNorm || '').toLowerCase();
            const unit = (ing.Unit || '').toLowerCase();

            if (!ingredientNorm) continue;

            // Find or create store group
            let storeGroup = groups.find(g => g.StoreId === storeId);
            if (!storeGroup) {
              storeGroup = {
                StoreId: storeId,
                StoreName: getStoreNameById(storeId) || storeId || 'No Store',
                Items: []
              };
              groups.push(storeGroup);
            }

            // Find or create category bucket
            const key = `${ingredientNorm}|${unit}`;
            let bucket = storeGroup.Items.find(b =>
              b.IngredientNorm.toLowerCase() === ingredientNorm &&
              (b.Unit || '').toLowerCase() === unit
            );

            if (!bucket) {
              bucket = {
                Category: category,
                IngredientNorm: ingredientNorm,
                Unit: ing.Unit || '',
                QtyNum: 0,
                QtyText: '',
                Examples: []
              };
              storeGroup.Items.push(bucket);
            }

            // Aggregate quantity
            if (ing.QtyNum && Number.isFinite(Number(ing.QtyNum))) {
              bucket.QtyNum += Number(ing.QtyNum);
            }

            // Add example
            const example = ing.IngredientRaw || `${ing.QtyText || ''} ${ing.Unit || ''} ${ingredientNorm}`.trim();
            if (example && bucket.Examples.length < 3 && !bucket.Examples.includes(example)) {
              bucket.Examples.push(example);
            }
          }
        }
      }
    }
  }

  renderShop_(groups);
  persistShop_();
}

function getSelectedCollections() {
  const select = document.getElementById('shopCollectionSelect');
  const selected = [];
  for (const option of select.options) {
    if (option.selected) {
      selected.push(option.value);
    }
  }
  return selected;
}

function populateShoppingCollectionsDropdown() {
  const select = document.getElementById('shopCollectionSelect');
  select.innerHTML = COLLECTIONS.map(c =>
    `<option value="${escapeAttr(c.CollectionId)}">${escapeHtml(c.Name)}</option>`
  ).join('');
}

// Generate shopping list from a recipe collection
async function generateCollectionShoppingList(collectionId) {
  console.log('[generateCollectionShoppingList] CollectionId:', collectionId);
  console.log('[generateCollectionShoppingList] COLLECTIONS:', COLLECTIONS);

  // Reload collections to ensure we have the latest data
  await loadCollections();

  // Convert to number for comparison (dataset values are strings)
  const cid = Number(collectionId);
  const collection = COLLECTIONS.find(c => Number(c.CollectionId) === cid);
  console.log('[generateCollectionShoppingList] Found collection:', collection);

  if (!collection) {
    showToast(`Collection not found. ID: ${collectionId}`, 'error');
    return;
  }

  // Get all recipes in the collection
  const res = await api('listCollectionRecipes', { collectionId });
  if (!res.ok || !res.recipes || res.recipes.length === 0) {
    showToast(`No recipes found in "${collection.Name}"`, 'info');
    return;
  }

  const recipes = res.recipes;

  // Aggregate ingredients from all recipes in the collection
  const ingredientMap = new Map(); // key: ingredientNorm, value: { items: [...], qtyNum total, unit }

  for (const recipe of recipes) {
    // Get ingredients for this recipe
    const ingRes = await api('listRecipeIngredients', { recipeId: recipe.RecipeId });
    if (!ingRes.ok || !ingRes.items) continue;

    for (const item of ingRes.items) {
      const norm = (item.IngredientNorm || '').toLowerCase().trim();
      if (!norm) continue;

      const key = norm;
      if (!ingredientMap.has(key)) {
        ingredientMap.set(key, {
          IngredientNorm: norm,
          IngredientRaw: item.IngredientRaw || norm,
          items: [],
          totalQty: 0,
          unit: item.Unit || '',
          StoreId: item.StoreId || '',
          Category: item.Category || 'Other'
        });
      }

      const entry = ingredientMap.get(key);
      entry.items.push({
        recipe: recipe.Title,
        qty: item.QtyNum || 0,
        qtyText: item.QtyText || '',
        unit: item.Unit || ''
      });

      // Aggregate quantity
      if (item.QtyNum && Number(item.QtyNum) > 0) {
        entry.totalQty += Number(item.QtyNum);
      }
    }
  }

  // Convert to array and apply pantry depletion
  const allItems = Array.from(ingredientMap.values());

  // Apply pantry depletion (similar to buildShoppingList in backend)
  const pantryRes = await api('listPantry', {});
  const pantryItems = (pantryRes.ok && pantryRes.items) ? pantryRes.items : [];

  for (const item of allItems) {
    // Find matching pantry item
    const pantryItem = pantryItems.find(p => {
      const pName = (p.NameLower || p.Name || '').toLowerCase().trim();
      return pName === item.IngredientNorm;
    });

    if (pantryItem) {
      const pantryQty = Number(pantryItem.QtyNum || 0);
      if (pantryQty > 0 && item.totalQty > 0) {
        // Deduct pantry quantity
        const needed = Math.max(0, item.totalQty - pantryQty);
        item.totalQty = needed;
        item.pantryDeducted = pantryQty;
      }
    }
  }

  // Filter out items with zero quantity after pantry depletion
  const neededItems = allItems.filter(item => item.totalQty > 0 || !item.totalQty);

  // Group by store
  const groupsByStore = {};
  for (const item of neededItems) {
    const storeId = item.StoreId || 'unassigned';
    if (!groupsByStore[storeId]) {
      groupsByStore[storeId] = {
        StoreId: storeId,
        Items: []
      };
    }
    groupsByStore[storeId].Items.push({
      IngredientNorm: item.IngredientNorm,
      IngredientRaw: item.IngredientRaw,
      QtyNum: item.totalQty,
      QtyText: item.totalQty > 0 ? `${item.totalQty} ${item.unit}`.trim() : '',
      Unit: item.unit,
      Category: item.Category,
      recipes: item.items.map(i => i.recipe).join(', ')
    });
  }

  const groups = Object.values(groupsByStore);

  // Print the shopping list
  if (groups.length === 0) {
    showToast(`All ingredients for "${collection.Name}" are already in your pantry!`, 'success');
    return;
  }

  // Format for printing (print all stores at once for collections)
  const allStoreItems = [];
  for (const group of groups) {
    const storeName = getStoreNameById(group.StoreId) || 'Unassigned';
    allStoreItems.push({ storeName, items: group.Items });
  }

  // Create a formatted list for printing
  let printContent = `Shopping List: ${collection.Name}\n`;
  printContent += `Generated: ${new Date().toLocaleDateString()}\n`;
  printContent += `Recipes: ${recipes.length}\n\n`;

  for (const store of allStoreItems) {
    printContent += `\n${store.storeName.toUpperCase()}\n`;
    printContent += '='.repeat(40) + '\n';

    // Group by category
    const byCategory = {};
    for (const item of store.items) {
      const cat = item.Category || 'Other';
      if (!byCategory[cat]) byCategory[cat] = [];
      byCategory[cat].push(item);
    }

    for (const [category, items] of Object.entries(byCategory)) {
      printContent += `\n${category}:\n`;
      for (const item of items) {
        const qty = item.QtyText || (item.QtyNum ? `${item.QtyNum} ${item.Unit}`.trim() : '');
        printContent += `  [ ] ${item.IngredientRaw}${qty ? ` - ${qty}` : ''}\n`;
      }
    }
  }

  // Use the existing print function
  const items = groups.flatMap(g => g.Items).map(it => ({
    IngredientNorm: it.IngredientNorm,
    QtyDisplay: it.QtyText || (it.QtyNum ? `${it.QtyNum} ${it.Unit}`.trim() : ''),
    QtyText: it.QtyText,
    Unit: it.Unit,
    Category: it.Category
  }));

  // Show preview before printing
  showShoppingListPreview(`${collection.Name} Collection`, items, groups);
}

// ========== PHASE 2.4: Assign Collection to Week ==========
async function showAssignCollectionToWeekModal(collectionId, collectionName) {
  return new Promise(async (resolve) => {
    // Get collection recipes
    const res = await api('listCollectionRecipes', { collectionId });
    if (!res.ok || !res.recipes || res.recipes.length === 0) {
      showToast(`No recipes found in "${collectionName}"`, 'info');
      resolve(null);
      return;
    }

    const recipeCount = res.recipes.length;
    const recipes = res.recipes;

    // Create overlay modal
    const ov = document.createElement('div');
    ov.style.cssText = 'position:fixed;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.7);z-index:9999;';

    const modal = document.createElement('div');
    modal.style.cssText = 'background:var(--bg);border-radius:12px;padding:24px;max-width:500px;width:90%;box-shadow:0 20px 60px rgba(0,0,0,0.5);';

    // Get today and default to start of current week (Monday)
    const today = new Date();
    const dayOfWeek = today.getDay(); // 0 = Sunday, 1 = Monday, ...
    const mondayOffset = dayOfWeek === 0 ? -6 : -(dayOfWeek - 1); // Get Monday of current week
    const defaultWeekStart = new Date(today);
    defaultWeekStart.setDate(today.getDate() + mondayOffset);

    modal.innerHTML = `
          <h3 style="margin:0 0 16px 0;font-size:18px;color:var(--fg);">📅 Assign Collection to Week</h3>
          
          <div style="background:rgba(77,163,255,0.1);border:1px solid rgba(77,163,255,0.3);border-radius:8px;padding:12px;margin-bottom:16px;">
            <div style="font-weight:600;margin-bottom:4px;color:var(--fg);">${escapeHtml(collectionName)}</div>
            <div style="font-size:12px;color:var(--muted);">${recipeCount} recipe${recipeCount === 1 ? '' : 's'} in collection</div>
          </div>
          
          <div style="margin-bottom:20px;">
            <label style="display:block;margin-bottom:8px;font-size:13px;font-weight:600;color:var(--fg);">
              Week Start Date (Monday):
            </label>
            <input type="date" id="weekStartDate" value="${defaultWeekStart.toISOString().split('T')[0]}" style="width:100%;padding:10px;border:1px solid var(--line);border-radius:6px;background:var(--bg);color:var(--fg);box-sizing:border-box;" />
            <div style="font-size:11px;color:var(--muted);margin-top:4px;">
              💡 Recipes will be distributed across 7 days (Lunch & Dinner)
            </div>
          </div>
          
          <div style="display:flex;gap:10px;justify-content:flex-end;">
            <button id="cancel-assign-week" class="ghost">Cancel</button>
            <button id="confirm-assign-week" class="primary">Assign to Week</button>
          </div>
        `;

    ov.appendChild(modal);
    document.body.appendChild(ov);

    const weekStartInput = modal.querySelector('#weekStartDate');

    // Cancel button
    modal.querySelector('#cancel-assign-week').addEventListener('click', () => {
      ov.remove();
      resolve(null);
    });

    // Confirm button
    modal.querySelector('#confirm-assign-week').addEventListener('click', async () => {
      const weekStart = weekStartInput.value;
      if (!weekStart) {
        showToast('Please select a week start date', 'warning');
        return;
      }

      // Disable button and show loading
      const confirmBtn = modal.querySelector('#confirm-assign-week');
      confirmBtn.disabled = true;
      confirmBtn.innerHTML = '<span class="spinner"></span> Assigning...';

      try {
        // Distribute recipes across 7 days (Lunch & Dinner slots)
        // Strategy: Round-robin assignment to avoid same-day repeats
        const slots = ['Lunch', 'Dinner'];
        const startDate = new Date(weekStart);
        let assignmentCount = 0;

        // Create assignment plan (14 slots for 7 days × 2 meals)
        const assignmentPlan = [];
        for (let day = 0; day < 7; day++) {
          const date = new Date(startDate);
          date.setDate(startDate.getDate() + day);
          const dateStr = date.toISOString().split('T')[0];

          for (const slot of slots) {
            assignmentPlan.push({ date: dateStr, slot });
          }
        }

        // Assign recipes round-robin
        // Phase 4.5.7: Get active user
        const activeUserRes = await api('getActiveUser');
        const userId = (activeUserRes.ok && activeUserRes.userId) ? activeUserRes.userId : null;

        if (!userId) {
          showToast('No active user set', 'error');
          ov.remove();
          resolve(null);
          return;
        }

        for (let i = 0; i < recipes.length && i < assignmentPlan.length; i++) {
          const recipe = recipes[i];
          const assignment = assignmentPlan[i];

          const result = await api('upsertUserPlanMeal', {
            userId,
            date: assignment.date,
            slot: assignment.slot,
            meal: {
              RecipeId: recipe.RecipeId,
              Title: recipe.Title
            }
          });

          if (result.ok) {
            assignmentCount++;
          }
        }

        // Close modal
        ov.remove();

        // Show success message
        showToast(
          `✅ Assigned ${assignmentCount} recipe${assignmentCount === 1 ? '' : 's'} from "${collectionName}" to week starting ${weekStart}`,
          'success'
        );

        // Switch to planner tab and reload
        document.querySelector('[data-tab="planner"]').click();
        await new Promise(r => setTimeout(r, 100));

        // Update planner date range to show the assigned week
        document.getElementById('planStart').value = weekStart;
        const endDate = new Date(startDate);
        endDate.setDate(startDate.getDate() + 6);
        document.getElementById('planEnd').value = endDate.toISOString().split('T')[0];

        // Reload planner
        await loadPlan();

        // Refresh dashboard if today was in the assignment range
        const today = ymd(new Date());
        if (today >= weekStart && today <= endDate.toISOString().split('T')[0]) {
          QUERY_CACHE.plans.delete(today);
          QUERY_CACHE.plansFetchTime.delete(today);
          await renderDashboard();
        }

        resolve(assignmentCount);
      } catch (e) {
        showToast(`Error assigning collection: ${e.message}`, 'error');
        ov.remove();
        resolve(null);
      }
    });

    // Click outside to close
    ov.addEventListener('click', (e) => {
      if (e.target === ov) {
        ov.remove();
        resolve(null);
      }
    });
  });
}

// Shopping List Preview
let SHOPPING_LIST_PREVIEW_DATA = { title: '', items: [], groups: [] };

function showShoppingListPreview(title, items, groups) {
  SHOPPING_LIST_PREVIEW_DATA = { title, items, groups };

  document.getElementById('shoppingListPreviewSubtitle').textContent = title;

  // Build preview HTML
  const content = document.getElementById('shoppingListPreviewContent');
  let html = `<div style="font-size: 14px; line-height: 1.6;">`;
  html += `<div style="font-weight: 700; font-size: 16px; margin-bottom: 12px;">${escapeHtml(title)}</div>`;
  html += `<div style="color: var(--muted); margin-bottom: 20px;">Generated: ${new Date().toLocaleDateString()}</div>`;

  if (groups && groups.length > 0) {
    for (const group of groups) {
      const storeName = getStoreNameById(group.StoreId) || 'Unassigned';
      html += `<div style="margin-bottom: 24px;">`;
      html += `<div style="font-weight: 700; font-size: 15px; margin-bottom: 8px; color: var(--accent);">${escapeHtml(storeName)}</div>`;

      // Group by category
      const byCategory = {};
      for (const item of group.Items) {
        const cat = item.Category || 'Other';
        if (!byCategory[cat]) byCategory[cat] = [];
        byCategory[cat].push(item);
      }

      for (const [category, catItems] of Object.entries(byCategory)) {
        html += `<div style="margin-left: 12px; margin-bottom: 12px;">`;
        html += `<div style="font-weight: 600; font-size: 13px; margin-bottom: 6px; color: var(--text);">${escapeHtml(category)}</div>`;
        html += `<div style="margin-left: 12px;">`;
        for (const item of catItems) {
          const qty = item.QtyText || (item.QtyNum ? `${item.QtyNum} ${item.Unit}`.trim() : '');
          html += `<div style="margin-bottom: 4px;">☐ ${escapeHtml(item.IngredientRaw || item.IngredientNorm)}${qty ? ` — ${escapeHtml(qty)}` : ''}</div>`;
        }
        html += `</div>`;
        html += `</div>`;
      }

      html += `</div>`;
    }
  } else {
    // Flat list (no groups)
    html += `<div style="margin-left: 12px;">`;
    for (const item of items) {
      html += `<div style="margin-bottom: 4px;">☐ ${escapeHtml(item.IngredientNorm)} — ${escapeHtml(item.QtyDisplay)}</div>`;
    }
    html += `</div>`;
  }

  html += `</div>`;
  content.innerHTML = html;

  openModal('shoppingListPreviewBack');
}

async function confirmPrintShoppingList() {
  const { title, items } = SHOPPING_LIST_PREVIEW_DATA;
  closeModal('shoppingListPreviewBack');
  await window.Foodie.printShopping(title, items);
}

function clearShopUi() {
  SHOP.groups = [];
  SHOP.start = '';
  SHOP.end = '';
  document.getElementById('shopOut').innerHTML = `<div class="muted">List cleared.</div>`;
  persistShop_();
}

document.addEventListener('click', async (e) => {
  const ps = e.target.closest('[data-action="shop-print-store"]');
  if (ps) {
    const storeId = String(ps.dataset.storeid || '');
    if (storeId === 'unassigned') { showToast('Please assign stores for unassigned items before printing', 'warning'); return; }
    const g = (SHOP.groups || []).find(x => String(x.StoreId) === storeId);
    if (!g) { showToast('Nothing to print for this store', 'info'); return; }
    const storeName = getStoreNameById(storeId) || storeId;
    const items = (g.Items || []).map(it => ({
      IngredientNorm: it.IngredientNorm,
      QtyDisplay: shopQtyDisplay_(it),
      QtyText: it.QtyText,
      Unit: it.Unit
    }));
    await window.Foodie.printShopping(storeName, items);
    return;
  }

  // Handle shopping item edit (rename)
  const editBtn = e.target.closest('[data-action="shop-item-edit"]');
  if (editBtn) {
    const itemEl = editBtn.closest('[data-ingredient-norm]');
    if (!itemEl) return;

    const normName = itemEl.dataset.ingredientNorm;
    const sourceIdsRaw = itemEl.dataset.sourceIds;

    openShopRenameModal(normName, sourceIdsRaw);
    return;
  }

  // Handle remove button
  const removeBtn = e.target.closest('[data-action="shop-item-remove"]');
  if (removeBtn) {
    const ingredientNorm = removeBtn.dataset.ingredient;
    const unit = removeBtn.dataset.unit;
    const qty = parseFloat(removeBtn.dataset.qty);

    if (confirm(`Remove ${ingredientNorm} from shopping list and return to pantry (if applicable)?`)) {
      const res = await api('returnItemToPantry', { ingredientNorm, qty, unit });
      if (res.ok) {
        showToast(`${ingredientNorm} removed.`, 'success');
        buildShop(); // Refresh
      } else {
        showToast(res.error, 'error');
      }
    }
    return;
  }
});

function openShopRenameModal(normName, sourceIdsRaw) {
  const modalId = 'shopRenameModalBack';
  const nameInput = document.getElementById('shopRenameInput');
  const sourceIdsInput = document.getElementById('shopRenameSourceIds');
  const oldNameInput = document.getElementById('shopRenameOldName');
  const errorEl = document.getElementById('shopRenameError');

  if (!nameInput || !sourceIdsInput || !oldNameInput) return;

  nameInput.value = normName;
  oldNameInput.value = normName;
  sourceIdsInput.value = sourceIdsRaw;
  errorEl.textContent = '';

  openModal(modalId);
  setTimeout(() => nameInput.focus(), 300);
}

// Attach rename save listener once (at bottom of file or in init)
// I'll put it here for now close to the handler logic
document.getElementById('btnShopRenameSave')?.addEventListener('click', async () => {
  const nameInput = document.getElementById('shopRenameInput');
  const sourceIdsInput = document.getElementById('shopRenameSourceIds');
  const oldNameInput = document.getElementById('shopRenameOldName');
  const errorEl = document.getElementById('shopRenameError');
  const btn = document.getElementById('btnShopRenameSave');

  const newName = nameInput.value.trim();
  const oldName = oldNameInput.value;
  const sourceIdsRaw = sourceIdsInput.value;

  if (!newName || newName === oldName) {
    closeModal('shopRenameModalBack');
    return;
  }

  let sourceIds = [];
  try {
    sourceIds = JSON.parse(sourceIdsRaw);
  } catch (e) {
    errorEl.textContent = "Error: Invalid source data.";
    return;
  }

  btn.disabled = true;
  btn.textContent = 'Saving...';

  try {
    const res = await api('updateShoppingItem', { newName, sourceIds });
    if (res.ok) {
      showToast(`Updated ${res.updated} recipe ingredients.`, 'success');
      closeModal('shopRenameModalBack');
      if (SHOP.start && SHOP.end) {
        buildShop();
      } else {
        window.location.reload();
      }
    } else {
      errorEl.textContent = res.error || "Save failed.";
    }
  } catch (e) {
    console.error(e);
    errorEl.textContent = "Error: Connection failed.";
  } finally {
    btn.disabled = false;
    btn.textContent = 'Save Changes';
  }
});

document.addEventListener('change', async (e) => {
  // Handle shopping item bought toggle
  const toggle = e.target.closest('[data-action="shop-item-toggle"]');
  if (toggle) {
    const itemKey = toggle.dataset.itemkey;
    const isChecked = toggle.checked;

    // Load current bought items
    let boughtItems = {};
    try {
      const saved = localStorage.getItem('foodieShoppingBought');
      if (saved) boughtItems = JSON.parse(saved);
    } catch (_) { }

    // Get item data from the DOM
    const itemDiv = toggle.closest('[data-ingredient-norm]');
    const ingredientNorm = itemDiv ? itemDiv.dataset.ingredientNorm : '';
    const unit = itemDiv ? itemDiv.dataset.unit : '';
    const qty = itemDiv ? parseFloat(itemDiv.dataset.qty) : 0;

    // Update bought status
    if (isChecked) {
      boughtItems[itemKey] = true;

      // Add to pantry when purchased
      if (ingredientNorm && qty > 0) {
        try {
          const res = await api('markShoppingItemPurchased', { ingredientNorm, qty, unit: unit || '' });
          if (res && res.ok) {
            showToast(`${ingredientNorm} added to pantry`, 'success', 2000);
          } else {
            console.warn('[Shopping] Failed to add to pantry:', res && res.error);
          }
        } catch (err) {
          console.error('[Shopping] Error adding to pantry:', err);
        }
      }
    } else {
      delete boughtItems[itemKey];

      // If unchecking, remove from pantry (return item)
      if (itemDiv) {
        if (ingredientNorm && qty > 0 && unit) {
          try {
            const res = await api('returnItemToPantry', { ingredientNorm, qty, unit });
            if (res && res.ok) {
              showToast(`${ingredientNorm} returned to pantry`, 'success', 2000);
            } else {
              console.warn('[Shopping] Failed to return to pantry:', res && res.error);
            }
          } catch (err) {
            console.error('[Shopping] Error returning to pantry:', err);
          }
        }
      }
    }

    // Save to localStorage
    try {
      localStorage.setItem('foodieShoppingBought', JSON.stringify(boughtItems));
    } catch (_) { }

    // Re-render to update counts and styling
    renderShop_(SHOP.groups);
    return;
  }

  // Handle store assignment
  const sel = e.target.closest('[data-action="shop-item-store"]');
  if (!sel) return;
  const ingredientNorm = String(sel.dataset.ingredient || '').trim();
  const unit = String(sel.dataset.unit || '').trim();
  const storeId = String(sel.value || '').trim();
  const sourceIdsJson = sel.dataset.sourceids || '[]';
  let sourceIds = [];
  try {
    sourceIds = JSON.parse(sourceIdsJson);
  } catch (_) { }

  if (!SHOP.start || !SHOP.end) {
    showToast('Please generate the shopping list first', 'warning');
    return;
  }
  const res = await api('assignShoppingItemStore', { start: SHOP.start, end: SHOP.end, ingredientNorm, unit, storeId, sourceIds });
  if (!res.ok) { showToast(res.error || 'Failed to assign store', 'error'); return; }
  showToast(`Store updated for ${ingredientNorm}`, 'success', 2000);
  // Refresh grouping immediately
  await buildShop();
});

// ---------- pantry ----------
async function checkExpiringItems() {
  const widget = document.getElementById('expiringItemsWidget');
  const listEl = document.getElementById('expiringItemsList');

  const today = new Date();
  const sevenDaysFromNow = new Date(today);
  sevenDaysFromNow.setDate(today.getDate() + 7);

  const res = await api('getExpiringPantryItems', { days: 7 });
  if (!res.ok || !res.items || res.items.length === 0) {
    widget.style.display = 'none';
    return;
  }

  const items = res.items;
  listEl.innerHTML = items.map(it => {
    const expDate = new Date(it.expiration_date);
    const daysUntil = Math.ceil((expDate - today) / (24 * 60 * 60 * 1000));
    const urgency = daysUntil <= 2 ? 'color: #d32f2f; font-weight: 700;' : '';
    return `<div style="padding: 4px 0;">
          <span style="${urgency}">${escapeHtml(it.Name)}</span> 
          <span class="muted">- expires in ${daysUntil} day${daysUntil !== 1 ? 's' : ''}</span>
        </div>`;
  }).join('');

  widget.style.display = '';
}

async function loadPantry() {
  console.log('[loadPantry] Start');
  try {
    const q = (document.getElementById('pantrySearch').value || '').trim().toLowerCase();
    const filter = document.getElementById('pantryFilter').value || 'all';

    const res = await api('listPantry', { q });
    const box = document.getElementById('pantryList');
    if (!box) {
      console.error('[loadPantry] #pantryList not found!');
      return;
    }

    if (!res.ok) {
      box.innerHTML = `<div class="muted">Error: ${escapeHtml(res.error || 'Failed to load pantry')}</div>`;
      return;
    }

    let items = res.items || [];
    console.log('[loadPantry] Loaded items:', items.length);

    window.__pantryItemsById = Object.create(null);
    for (const it of items) { if (it && it.ItemId) window.__pantryItemsById[it.ItemId] = it; }

    // Check for expiring items (next 7 days)
    try {
      await checkExpiringItems();
    } catch (e) {
      console.warn('[loadPantry] checkExpiringItems failed:', e);
    }

    // Helper: check if item is low stock
    const isLowStock = (it) => {
      const qty = (it.QtyNum !== null && it.QtyNum !== undefined && String(it.QtyNum) !== '') ? Number(it.QtyNum) : null;
      const threshold = (it.low_stock_threshold !== null && it.low_stock_threshold !== undefined && String(it.low_stock_threshold) !== '') ? Number(it.low_stock_threshold) : null;
      return qty !== null && threshold !== null && threshold > 0 && Number.isFinite(qty) && Number.isFinite(threshold) && qty <= threshold;
    };

    // Apply filter
    if (filter === 'low') {
      items = items.filter(isLowStock);
    }

    box.innerHTML = items.length ? items.map(it => {
      const lowStock = isLowStock(it);
      const itemStyle = lowStock ? 'background: #fff8e1; border-left: 4px solid #ff9800; padding-left: 8px;' : '';
      const qtyDisplay = (it.QtyNum !== null && it.QtyNum !== undefined && String(it.QtyNum) !== '' ? (String(it.QtyNum) + (it.Unit ? (' ' + it.Unit) : '')) : (it.QtyText || ''));
      const qtyStyle = lowStock ? 'color: #e65100; font-weight: 700;' : '';
      const nameColor = lowStock ? '#000' : 'inherit';
      const mutedColor = lowStock ? '#666' : 'inherit';

      return `
        <div class="item" style="${itemStyle}">
          <div style="display:flex; justify-content:space-between; gap:10px; align-items:center;">
            <div style="flex:1;">
              <div>
                ${lowStock ? '<span style="color: #ff6f00; font-weight: 700; margin-right: 6px; background: #ffe0b2; padding: 2px 6px; border-radius: 3px; font-size: 0.75em;">⚠️ LOW</span>' : ''}
                <strong style="color: ${nameColor};">${escapeHtml(it.Name)}</strong> 
                <span style="${qtyStyle}">${escapeHtml(qtyDisplay)}</span>
              </div>
              ${it.Category ? `<div class="muted" style="color: ${mutedColor};">Category: ${escapeHtml(it.Category)}</div>` : ''}
              <div class="muted" style="color: ${mutedColor};">${escapeHtml(getStoreNameById(it.StoreId) || it.StoreId || '')}</div>
              ${it.low_stock_threshold ? `<div class="muted" style="color: ${mutedColor};">Low stock threshold: ${escapeHtml(String(it.low_stock_threshold))} ${escapeHtml(it.Unit || '')}</div>` : ''}
              <div class="muted" style="color: ${mutedColor};">${escapeHtml(it.Notes || '')}</div>
            </div>
            <div class="actions">
              <button class="ghost" data-action="pantry-edit" data-id="${escapeAttr(it.ItemId)}" ${lowStock ? 'style="color: #000;"' : ''}>Edit</button>
              <button class="danger" data-action="pantry-del" data-id="${escapeAttr(it.ItemId)}" ${lowStock ? 'style="color: #d32f2f;"' : ''}>Delete</button>
            </div>
          </div>
        </div>
      `;
    }).join('') : (filter === 'low' ? `
        <div class="empty-state">
          <div class="empty-state-icon">✅</div>
          <div class="empty-state-title">No low stock items!</div>
          <div class="empty-state-message">
            All your pantry items are well stocked.
          </div>
          <div class="empty-state-actions">
            <button class="ghost" onclick="document.getElementById('pantryFilter').value = 'all'; loadPantry();">
              View All Items
            </button>
          </div>
        </div>
      ` : `
        <div class="empty-state">
          <div class="empty-state-icon">🥫</div>
          <div class="empty-state-title">Your pantry is empty!</div>
          <div class="empty-state-message">
            Start tracking your kitchen inventory to plan meals<br>
            and generate accurate shopping lists.
          </div>
          <div class="empty-state-actions">
            <button class="primary" onclick="pantryModal_({ ItemId:'', PantryId:'', Name:'', QtyNum:'', QtyText:'', Unit:'', Category:'', StoreId:'', Notes:'' }, true)">
              Add First Item
            </button>
          </div>
        </div>
      `);

    // PHASE 3.2: Update insights dashboard if visible
    if (document.getElementById('pantryInsights').classList.contains('visible')) {
      try {
        await updatePantryInsights();
      } catch (e) {
        console.warn('[loadPantry] updatePantryInsights failed:', e);
      }
    }
  } catch (err) {
    console.error('[loadPantry] Fatal error:', err);
    showToast('Failed to load pantry display', 'error');
  }
}

// ========== PHASE 3.2: PANTRY INSIGHTS DASHBOARD ==========

// Toggle pantry insights visibility
function togglePantryInsights() {
  const insights = document.getElementById('pantryInsights');
  const btn = document.getElementById('btnTogglePantryInsights');
  const icon = btn.querySelector('.insights-toggle-icon');
  const text = btn.querySelector('span:last-child');

  if (insights.classList.contains('visible')) {
    insights.classList.remove('visible');
    btn.classList.remove('expanded');
    text.textContent = 'Show Pantry Insights';
  } else {
    insights.classList.add('visible');
    btn.classList.add('expanded');
    text.textContent = 'Hide Pantry Insights';
    updatePantryInsights();
  }
}

// Update all pantry insights data
async function updatePantryInsights() {
  try {
    // Fetch all pantry items
    const res = await api('listPantry', { q: '' });
    if (!res.ok) {
      showToast('Failed to load pantry insights', 'error');
      return;
    }

    const items = res.items || [];

    // Helper: check if item is low stock
    // Item is only considered "low stock" if:
    // 1. A threshold is set (threshold > 0)
    // 2. Current quantity is at or below that threshold
    const isLowStock = (it) => {
      const qty = (it.QtyNum !== null && it.QtyNum !== undefined && String(it.QtyNum) !== '') ? Number(it.QtyNum) : null;
      const threshold = (it.low_stock_threshold !== null && it.low_stock_threshold !== undefined && String(it.low_stock_threshold) !== '') ? Number(it.low_stock_threshold) : null;
      return qty !== null && threshold !== null && threshold > 0 && Number.isFinite(qty) && Number.isFinite(threshold) && qty <= threshold;
    };

    // Calculate stats
    const lowStockItems = items.filter(isLowStock);
    const inStockItems = items.filter(it => !isLowStock(it));

    // Get expiring items
    const expiringRes = await api('getExpiringPantryItems', { days: 7 });
    const expiringItems = (expiringRes.ok && expiringRes.items) ? expiringRes.items : [];

    // Update status cards
    document.getElementById('inStockCount').textContent = inStockItems.length;
    document.getElementById('lowStockCount').textContent = lowStockItems.length;
    document.getElementById('expiringSoonCount').textContent = expiringItems.length;

    // Update category breakdown
    updateCategoryBreakdown(items);

    // Update low stock details
    updateLowStockDetails(lowStockItems);

    // Update expiring items details
    updateExpiringDetails(expiringItems);

  } catch (error) {
    console.error('Error updating pantry insights:', error);
    showToast('Error updating insights', 'error');
  }
}

// Update category breakdown
function updateCategoryBreakdown(items) {
  const container = document.getElementById('categoryBreakdownList');

  // Group items by category
  const categoryMap = {};
  for (const item of items) {
    const category = item.Category || 'Uncategorized';
    if (!categoryMap[category]) {
      categoryMap[category] = 0;
    }
    categoryMap[category]++;
  }

  // Sort categories by count (descending)
  const categories = Object.entries(categoryMap)
    .sort((a, b) => b[1] - a[1]);

  if (categories.length === 0) {
    container.innerHTML = '<div class="muted">No items in pantry</div>';
    return;
  }

  container.innerHTML = categories.map(([category, count]) => `
        <div class="category-item">
          <div class="category-item-name">${escapeHtml(category)}</div>
          <div class="category-item-count">${count}</div>
        </div>
      `).join('');
}

// Update low stock details
function updateLowStockDetails(lowStockItems) {
  const container = document.getElementById('lowStockItemsList');
  const details = document.getElementById('lowStockDetails');

  if (lowStockItems.length === 0) {
    details.style.display = 'none';
    return;
  }

  details.style.display = 'block';

  container.innerHTML = lowStockItems.map(item => {
    const qtyDisplay = (item.QtyNum !== null && item.QtyNum !== undefined && String(item.QtyNum) !== '')
      ? `${item.QtyNum} ${item.Unit || ''}`
      : item.QtyText || '0';
    const threshold = item.low_stock_threshold || 0;

    return `
          <div class="low-stock-item">
            <div>
              <div class="low-stock-item-name">${escapeHtml(item.Name)}</div>
              <div class="low-stock-item-qty">
                Current: ${escapeHtml(qtyDisplay)} | Threshold: ${threshold} ${escapeHtml(item.Unit || '')}
              </div>
            </div>
            <div class="low-stock-item-actions">
              <button class="restock-btn" data-action="quick-restock" data-item-id="${escapeAttr(item.ItemId)}">
                Restock
              </button>
              <button class="ghost mini" data-action="pantry-edit" data-id="${escapeAttr(item.ItemId)}">
                Edit
              </button>
            </div>
          </div>
        `;
  }).join('');
}

// Update expiring items details
function updateExpiringDetails(expiringItems) {
  const container = document.getElementById('expiringItemsDetailList');
  const details = document.getElementById('expiringDetails');

  if (expiringItems.length === 0) {
    details.style.display = 'none';
    return;
  }

  details.style.display = 'block';

  const today = new Date();
  container.innerHTML = expiringItems.map(item => {
    const expDate = new Date(item.expiration_date);
    const daysUntil = Math.ceil((expDate - today) / (24 * 60 * 60 * 1000));
    const urgency = daysUntil <= 2 ? 'URGENT' : daysUntil <= 5 ? 'SOON' : '';

    return `
          <div class="expiring-item">
            <div>
              <div class="expiring-item-name">
                ${urgency ? `<span style="background:#ef4444;color:white;padding:2px 6px;border-radius:3px;font-size:10px;margin-right:6px;">${urgency}</span>` : ''}
                ${escapeHtml(item.Name)}
              </div>
              <div class="expiring-item-date">
                Expires: ${item.expiration_date} (${daysUntil} day${daysUntil !== 1 ? 's' : ''})
              </div>
            </div>
            <div>
              <button class="ghost mini" data-action="pantry-edit" data-id="${escapeAttr(item.ItemId)}">
                Edit
              </button>
            </div>
          </div>
        `;
  }).join('');
}

// Quick restock function
async function quickRestock(itemId) {
  const item = window.__pantryItemsById[itemId];
  if (!item) {
    showToast('Item not found', 'error');
    return;
  }

  const threshold = item.low_stock_threshold || 10;
  const currentQty = item.QtyNum || 0;
  const restockAmount = Math.max(threshold * 2, currentQty + 10); // Restock to 2x threshold or +10

  const r = await pantryModal_({
    title: `Restock ${item.Name}`,
    initial: {
      ...item,
      QtyNum: restockAmount
    }
  });

  if (r && r.ok) {
    await loadPantry();
    showToast(`${item.Name} restocked to ${restockAmount} ${item.Unit || ''}`, 'success');
  }
}

// Filter pantry to show only low stock items
function filterPantryLowStock() {
  document.getElementById('pantryFilter').value = 'low';
  loadPantry();
  // Scroll to pantry list
  document.getElementById('pantryList').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// Filter pantry to show all items
function filterPantryAll() {
  document.getElementById('pantryFilter').value = 'all';
  loadPantry();
  // Scroll to pantry list
  document.getElementById('pantryList').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// ========== PHASE 3.3: SMART DEFAULTS ==========

const SMART_DEFAULTS_KEY = 'foodieSmartDefaults';

// Load smart defaults from localStorage
function loadSmartDefaults() {
  try {
    const stored = localStorage.getItem(SMART_DEFAULTS_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (e) {
    console.error('Failed to load smart defaults:', e);
  }

  // Default structure
  return {
    pantry: {
      category: '',
      unit: '',
      storeId: '',
      lowStockThreshold: 5
    },
    ingredient: {
      unit: '',
      category: '',
      storeId: ''
    },
    recipe: {
      cuisine: '',
      mealType: 'Any'
    }
  };
}

// Save smart defaults to localStorage
function saveSmartDefaults(defaults) {
  try {
    localStorage.setItem(SMART_DEFAULTS_KEY, JSON.stringify(defaults));
  } catch (e) {
    console.error('Failed to save smart defaults:', e);
  }
}

// Get a specific default value
function getSmartDefault(section, field) {
  const defaults = loadSmartDefaults();
  return defaults[section] && defaults[section][field] !== undefined
    ? defaults[section][field]
    : '';
}

// Set a specific default value
function setSmartDefault(section, field, value) {
  const defaults = loadSmartDefaults();
  if (!defaults[section]) {
    defaults[section] = {};
  }
  defaults[section][field] = value;
  saveSmartDefaults(defaults);
}

// Learn from user action (save as default)
function learnDefault(section, field, value) {
  // Don't save empty values as defaults
  if (value === null || value === undefined || value === '') {
    return;
  }
  setSmartDefault(section, field, value);
}

// Apply smart defaults to pantry modal
function applyPantryDefaults() {
  const defaults = loadSmartDefaults().pantry;

  const categoryEl = document.getElementById('pantryModalCategory');
  const unitEl = document.getElementById('pantryModalUnit');
  const storeIdEl = document.getElementById('pantryModalStoreId');
  const lowStockEl = document.getElementById('pantryModalLowStock');

  // Only apply if field is empty (don't override existing values)
  if (categoryEl && !categoryEl.value && defaults.category) {
    categoryEl.value = defaults.category;
  }
  if (unitEl && !unitEl.value && defaults.unit) {
    unitEl.value = defaults.unit;
  }
  if (storeIdEl && !storeIdEl.value && defaults.storeId) {
    storeIdEl.value = defaults.storeId;
  }
  if (lowStockEl && !lowStockEl.value && defaults.lowStockThreshold) {
    lowStockEl.value = defaults.lowStockThreshold;
  }
}

// Learn from pantry modal on save
function learnFromPantryModal() {
  const categoryEl = document.getElementById('pantryModalCategory');
  const unitEl = document.getElementById('pantryModalUnit');
  const storeIdEl = document.getElementById('pantryModalStoreId');
  const lowStockEl = document.getElementById('pantryModalLowStock');

  if (categoryEl && categoryEl.value) {
    learnDefault('pantry', 'category', categoryEl.value);
  }
  if (unitEl && unitEl.value) {
    learnDefault('pantry', 'unit', unitEl.value);
  }
  if (storeIdEl && storeIdEl.value) {
    learnDefault('pantry', 'storeId', storeIdEl.value);
  }
  if (lowStockEl && lowStockEl.value) {
    learnDefault('pantry', 'lowStockThreshold', lowStockEl.value);
  }
}

// Apply smart defaults to ingredient row (new row)
function applyIngredientDefaults(idx) {
  const defaults = loadSmartDefaults().ingredient;

  if (!ING_ROWS[idx]) return;

  // Apply defaults to empty fields
  if (!ING_ROWS[idx].Unit && defaults.unit) {
    ING_ROWS[idx].Unit = defaults.unit;
  }
  if (!ING_ROWS[idx].Category && defaults.category) {
    ING_ROWS[idx].Category = defaults.category;
  }
  if (!ING_ROWS[idx].StoreId && defaults.storeId) {
    ING_ROWS[idx].StoreId = defaults.storeId;
  }

  // Re-render to show defaults
  renderIngredientsTable();
}

// Learn from ingredient edits
function learnFromIngredient(row) {
  if (row.Unit) {
    learnDefault('ingredient', 'unit', row.Unit);
  }
  if (row.Category) {
    learnDefault('ingredient', 'category', row.Category);
  }
  if (row.StoreId) {
    learnDefault('ingredient', 'storeId', row.StoreId);
  }
}

// Apply smart defaults to recipe modal
function applyRecipeDefaults() {
  const defaults = loadSmartDefaults().recipe;

  const cuisineEl = document.getElementById('rCuisine');
  const mealTypeEl = document.getElementById('rMealType');

  // Only apply to NEW recipes (when CURRENT_RECIPE_ID is empty)
  if (!CURRENT_RECIPE_ID) {
    if (cuisineEl && !cuisineEl.value && defaults.cuisine) {
      cuisineEl.value = defaults.cuisine;
    }
    if (mealTypeEl && mealTypeEl.value === 'Any' && defaults.mealType) {
      mealTypeEl.value = defaults.mealType;
    }
  }
}

// Learn from recipe save
function learnFromRecipe() {
  const cuisineEl = document.getElementById('rCuisine');
  const mealTypeEl = document.getElementById('rMealType');

  if (cuisineEl && cuisineEl.value) {
    learnDefault('recipe', 'cuisine', cuisineEl.value);
  }
  if (mealTypeEl && mealTypeEl.value && mealTypeEl.value !== 'Any') {
    learnDefault('recipe', 'mealType', mealTypeEl.value);
  }
}

// Reset all smart defaults
function resetSmartDefaults() {
  if (!confirm('Reset all smart defaults to empty values?')) {
    return;
  }

  localStorage.removeItem(SMART_DEFAULTS_KEY);
  showToast('Smart defaults reset', 'success');
}

// Show current defaults (for debugging/user info)
function showSmartDefaults() {
  const defaults = loadSmartDefaults();
  console.log('Current Smart Defaults:', defaults);

  const summary = [];

  if (defaults.pantry.category) summary.push(`Pantry Category: ${defaults.pantry.category}`);
  if (defaults.pantry.unit) summary.push(`Pantry Unit: ${defaults.pantry.unit}`);
  if (defaults.pantry.storeId) summary.push(`Pantry Store: ${defaults.pantry.storeId}`);
  if (defaults.pantry.lowStockThreshold) summary.push(`Low Stock Threshold: ${defaults.pantry.lowStockThreshold}`);

  if (defaults.ingredient.category) summary.push(`Ingredient Category: ${defaults.ingredient.category}`);
  if (defaults.ingredient.unit) summary.push(`Ingredient Unit: ${defaults.ingredient.unit}`);
  if (defaults.ingredient.storeId) summary.push(`Ingredient Store: ${defaults.ingredient.storeId}`);

  if (defaults.recipe.cuisine) summary.push(`Recipe Cuisine: ${defaults.recipe.cuisine}`);
  if (defaults.recipe.mealType) summary.push(`Recipe Meal Type: ${defaults.recipe.mealType}`);

  if (summary.length === 0) {
    showToast('No smart defaults saved yet', 'info');
  } else {
    showToast(`Smart Defaults:\n${summary.join('\n')}`, 'info', 5000);
  }
}


// ---------- calendar ----------
async function calSync() {
  const start = (PLAN && PLAN.start) ? PLAN.start : document.getElementById('planStart').value;
  const days = (PLAN && PLAN.days) ? Number(PLAN.days || 14) : Number(document.getElementById('planDays').value || 14);
  if (!start) { document.getElementById('calStatus').textContent = 'Select a plan start date first.'; return; }
  const end = addDays(start, days - 1);
  const calNameEl = document.getElementById('calId');
  const calName = (calNameEl && calNameEl.value ? calNameEl.value : 'Foodie Meal Planner').trim() || 'Foodie Meal Planner';

  document.getElementById('calStatus').textContent = 'Syncing...';
  const res = await api('calendarSyncRange', { start, end, calendarName: calName });
  if (!res.ok) { document.getElementById('calStatus').textContent = `Error: ${res.error || ''}`; return; }
  document.getElementById('calStatus').textContent = `Synced. Created: ${res.created || 0}, Updated: ${res.updated || 0}`;
}


// ---------- bindings ----------
function fillJumpLetters() {
  const sel = document.getElementById('jumpLetter');
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
  sel.innerHTML = `<option value="">Jump A–Z</option>` + letters.map(l => `<option value="${l.toLowerCase()}">${l}</option>`).join('');
}

function collapseExpandAll(containerId, open) {
  const box = document.getElementById(containerId);
  box.querySelectorAll('details').forEach(d => d.open = !!open);
}

// ========== PHASE 5.3: SMART MEAL SUGGESTIONS ==========

// Get smart recipe suggestions for a meal slot
async function getSmartSuggestions(date, slot, limit = 3) {
  const suggestions = [];
  const currentPlan = PLAN.plansByDate || {};

  // Get week range for variety analysis
  const weekStart = getWeekStart(date);
  const weekDates = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  // PHASE 4.5.4: Get user-specific favorites
  const favorites = RECIPES.filter(r => r.is_favorite === 1 || r.is_favorite === true);

  // 2. Get pantry items (to suggest recipes using available ingredients)
  let pantryItems = [];
  try {
    const pantryRes = await api('listPantry', {});
    if (pantryRes.ok && pantryRes.items) {
      pantryItems = pantryRes.items.map(item => item.Name.toLowerCase());
    }
  } catch (e) {
    console.error('Failed to load pantry for suggestions:', e);
  }

  // 3. Analyze current week for variety
  const usedCuisines = new Set();
  const usedRecipes = new Set();
  weekDates.forEach(d => {
    const dayPlan = currentPlan[d];
    if (dayPlan) {
      ['Breakfast', 'Lunch', 'Dinner'].forEach(s => {
        if (dayPlan[s] && dayPlan[s].RecipeId) {
          usedRecipes.add(dayPlan[s].RecipeId);
          const recipe = RECIPES.find(r => r.RecipeId === dayPlan[s].RecipeId);
          if (recipe && recipe.Cuisine) {
            usedCuisines.add(recipe.Cuisine);
          }
        }
      });
    }
  });

  // 4. Filter recipes by meal type if applicable
  let candidateRecipes = RECIPES.filter(r => {
    // Skip already used this week
    if (usedRecipes.has(r.RecipeId)) return false;

    // Match meal type (breakfast only for breakfast, but lunch/dinner are flexible)
    if (slot === 'Breakfast') {
      return r.MealType === 'Breakfast' || r.MealType === 'Brunch';
    }
    // For lunch/dinner, allow most meal types except breakfast
    return r.MealType !== 'Breakfast';
  });

  // 5. Score each recipe
  const scoredRecipes = candidateRecipes.map(recipe => {
    let score = 0;
    const reasons = [];

    // PHASE 4.5.4: Favorite recipes get highest priority (user-specific)
    if (recipe.is_favorite === 1 || recipe.is_favorite === true) {
      score += 100;
      reasons.push('⭐ Favorite');
    }

    // Recipes with ingredients in pantry
    if (recipe.RecipeId && pantryItems.length > 0) {
      // Check if any ingredients are in pantry (simplified check)
      const recipeName = recipe.Title.toLowerCase();
      const hasInPantry = pantryItems.some(item => recipeName.includes(item.split(' ')[0]));
      if (hasInPantry) {
        score += 50;
        reasons.push('🥫 Ingredients in pantry');
      }
    }

    // Variety bonus: prefer cuisines not used this week
    if (recipe.Cuisine && !usedCuisines.has(recipe.Cuisine)) {
      score += 30;
      reasons.push(`🌍 ${recipe.Cuisine} variety`);
    }

    // Meal type match
    if (recipe.MealType === slot) {
      score += 20;
      reasons.push(`🍽️ ${slot} recipe`);
    }

    // Random factor for diversity (0-10 points)
    score += Math.random() * 10;

    return {
      recipe,
      score,
      reasons: reasons.slice(0, 2) // Keep top 2 reasons
    };
  });

  // 6. Sort by score and take top N
  scoredRecipes.sort((a, b) => b.score - a.score);
  return scoredRecipes.slice(0, limit);
}

// Show suggestion popover for empty meal slot
async function showMealSuggestions(date, slot, targetElement) {
  // Remove any existing popover
  const existingPopover = document.getElementById('mealSuggestionsPopover');
  if (existingPopover) existingPopover.remove();

  // Create popover
  const popover = document.createElement('div');
  popover.id = 'mealSuggestionsPopover';
  popover.className = 'meal-suggestions-popover';

  // Show loading state
  popover.innerHTML = `
        <div class="meal-suggestions-header">
          <div class="meal-suggestions-title">💡 Suggestions for ${slot}</div>
          <button class="meal-suggestions-close" onclick="closeMealSuggestions()">✕</button>
        </div>
        <div class="meal-suggestions-loading">
          <div class="spinner"></div>
          <div>Finding recipes...</div>
        </div>
      `;

  document.body.appendChild(popover);

  // Position popover near target element
  const rect = targetElement.getBoundingClientRect();
  popover.style.left = Math.min(rect.left, window.innerWidth - 320) + 'px';
  popover.style.top = (rect.bottom + 8) + 'px';

  // Get suggestions
  try {
    const suggestions = await getSmartSuggestions(date, slot, 3);

    if (suggestions.length === 0) {
      popover.innerHTML = `
            <div class="meal-suggestions-header">
              <div class="meal-suggestions-title">💡 Suggestions for ${slot}</div>
              <button class="meal-suggestions-close" onclick="closeMealSuggestions()">✕</button>
            </div>
            <div class="meal-suggestions-empty">
              <div class="meal-suggestions-empty-icon">🔍</div>
              <div class="meal-suggestions-empty-text">No suggestions available</div>
              <div class="meal-suggestions-empty-hint">Try adding more recipes to your library</div>
            </div>
          `;
      return;
    }

    // Render suggestions
    let html = `
          <div class="meal-suggestions-header">
            <div class="meal-suggestions-title">💡 Suggestions for ${slot}</div>
            <button class="meal-suggestions-close" onclick="closeMealSuggestions()">✕</button>
          </div>
          <div class="meal-suggestions-list">
        `;

    suggestions.forEach(({ recipe, reasons }) => {
      const cuisineEmoji = getCuisineEmoji(recipe.Cuisine) || '📖';
      html += `
            <div class="meal-suggestion-item" onclick="assignSuggestionToSlot('${escapeAttr(recipe.RecipeId)}', '${escapeAttr(date)}', '${escapeAttr(slot)}')">
              <div class="meal-suggestion-icon">${cuisineEmoji}</div>
              <div class="meal-suggestion-content">
                <div class="meal-suggestion-title">${escapeHtml(recipe.Title)}</div>
                <div class="meal-suggestion-meta">
                  ${recipe.Cuisine || 'Any Cuisine'} • ${recipe.MealType || 'Any'}
                </div>
                ${reasons.length > 0 ? `
                  <div class="meal-suggestion-reasons">
                    ${reasons.map(r => `<span class="meal-suggestion-reason">${r}</span>`).join('')}
                  </div>
                ` : ''}
              </div>
              <div class="meal-suggestion-action">
                <button class="ghost mini">Assign</button>
              </div>
            </div>
          `;
    });

    html += `
          </div>
          <div class="meal-suggestions-footer">
            <button class="ghost mini" onclick="closeMealSuggestions(); openMealPicker('${escapeAttr(date)}', '${escapeAttr(slot)}')">
              Browse All Recipes
            </button>
          </div>
        `;

    popover.innerHTML = html;

  } catch (e) {
    console.error('Failed to get suggestions:', e);
    popover.innerHTML = `
          <div class="meal-suggestions-header">
            <div class="meal-suggestions-title">💡 Suggestions</div>
            <button class="meal-suggestions-close" onclick="closeMealSuggestions()">✕</button>
          </div>
          <div class="meal-suggestions-empty">
            <div class="meal-suggestions-empty-icon">⚠️</div>
            <div class="meal-suggestions-empty-text">Failed to load suggestions</div>
          </div>
        `;
  }

  // Close on click outside
  setTimeout(() => {
    const closeHandler = (e) => {
      if (!popover.contains(e.target) && !targetElement.contains(e.target)) {
        closeMealSuggestions();
        document.removeEventListener('click', closeHandler);
      }
    };
    document.addEventListener('click', closeHandler);
  }, 100);
}

// Close suggestions popover
function closeMealSuggestions() {
  const popover = document.getElementById('mealSuggestionsPopover');
  if (popover) popover.remove();
}

// Assign suggested recipe to slot
async function assignSuggestionToSlot(recipeId, date, slot) {
  closeMealSuggestions();

  try {
    // Phase 4.5.7: Get active user
    const activeUserRes = await api('getActiveUser');
    const userId = (activeUserRes.ok && activeUserRes.userId) ? activeUserRes.userId : null;

    if (!userId) {
      showToast('No active user set', 'error');
      return;
    }

    // Fetch recipe to get title
    const recipeRes = await api('getRecipe', { recipeId });
    if (!recipeRes.ok) {
      showToast('Failed to load recipe', 'error');
      return;
    }

    const res = await api('upsertUserPlanMeal', {
      userId,
      date,
      slot,
      meal: {
        RecipeId: recipeId,
        Title: recipeRes.recipe.Title
      }
    });
    if (res.ok) {
      await loadPlan();
      await refreshDashboardIfToday(date); // Refresh dashboard if today's meal changed
      showToast(`✓ Recipe assigned to ${slot}`, 'success', 2000);
    } else {
      showToast(res.error || 'Failed to assign recipe', 'error');
    }
  } catch (e) {
    showToast(`Error: ${e.message}`, 'error');
  }
}

// Helper to get cuisine emoji (reuse from Phase 4.4)
function getCuisineEmoji(cuisine) {
  const map = {
    'Italian': '🍝', 'Mexican': '🌮', 'Chinese': '🥡', 'Indian': '🍛',
    'Japanese': '🍣', 'French': '🥖', 'American': '🍔', 'Thai': '🍜',
    'Mediterranean': '🫒', 'Greek': '🥙', 'Korean': '🍜', 'Vietnamese': '🍜',
    'Spanish': '🥘', 'Turkish': '🥙', 'Middle Eastern': '🧆'
  };
  return map[cuisine] || null;
}

// Helper to get week start (Monday)
function getWeekStart(dateStr) {
  // Parse date as local to avoid timezone issues
  const [year, month, day] = dateStr.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  const dayOfWeek = date.getDay();
  const diff = date.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1); // Adjust to Monday
  const monday = new Date(year, month - 1, diff);
  return `${monday.getFullYear()}-${String(monday.getMonth() + 1).padStart(2, '0')}-${String(monday.getDate()).padStart(2, '0')}`;
}

// ========== PHASE 3 HELPER FUNCTIONS ==========

async function renderPlanGrid() {
  // PHASE 9.3: Performance tracking
  const startTime = performance.now();

  console.log('[renderPlanGrid] Called. PLAN.start:', PLAN.start, 'PLAN.days:', PLAN.days);
  const container = document.getElementById('planGrid');
  if (!container) {
    console.error('[renderPlanGrid] Container #planGrid not found!');
    return;
  }
  if (!PLAN.start) {
    console.log('[renderPlanGrid] No PLAN.start, showing placeholder');
    container.innerHTML = '<div class="muted">Load a plan range first</div>';
    return;
  }

  // Show all days in the range (remove the 7-day limit)
  const days = PLAN.days;
  const end = addDays(PLAN.start, days - 1);
  console.log('[renderPlanGrid] Rendering', days, 'days starting from', PLAN.start);

  // ========== PHASE 9.3: BATCH QUERY FOR ADDITIONAL ITEMS ==========
  const additionalItemsResult = await api('getAdditionalItemsRange', {
    start: PLAN.start,
    end: end
  });
  const additionalItems = additionalItemsResult.ok ? additionalItemsResult.itemsByDateSlot : {};
  console.log(`[Phase 9.3] Loaded additional items in 1 query (vs ${days * 3} individual queries)`);

  let html = '<div class="calendar-grid">';

  for (let i = 0; i < days; i++) {
    const dateKey = addDays(PLAN.start, i);
    const plan = PLAN.plansByDate[dateKey] || {};
    // Parse date correctly to avoid timezone issues
    // dateKey is "YYYY-MM-DD" - parse as local date, not UTC
    const [year, month, day] = dateKey.split('-').map(Number);
    const dt = new Date(year, month - 1, day); // month is 0-indexed
    const dayName = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][dt.getDay()];

    html += `<div class="grid-day">`;
    html += `<div class="grid-day-header">${dayName} ${dateKey}</div>`;

    for (const slot of ['Breakfast', 'Lunch', 'Dinner']) {
      // Phase 4.5.7: Handle array of meals
      const meals = plan[slot];
      const mealsArray = Array.isArray(meals) ? meals : (meals && meals.Title ? [meals] : []);

      if (mealsArray.length > 0) {
        // Has one or more meals
        const slotClass = slot.toLowerCase();

        // ========== PHASE 9.3: Check additional items from batched data ==========
        const itemKey = `${dateKey}:${slot}`;
        const slotAdditionalItems = additionalItems[itemKey] || [];
        const hasAdditional = slotAdditionalItems.length > 0;

        if (mealsArray.length === 1) {
          // Single meal - original rendering
          const meal = mealsArray[0];
          const recipe = RECIPES.find(r => r.RecipeId === meal.RecipeId);
          const cuisine = recipe ? recipe.Cuisine : '';
          const cuisineClass = cuisine ? `cuisine-${cuisine.toLowerCase().replace(/\s+/g, '-')}` : '';

          html += `
                <div class="grid-meal ${slotClass} ${cuisineClass}" 
                     draggable="true"
                     data-date="${dateKey}" 
                     data-slot="${slot}"
                     data-rid="${escapeAttr(meal.RecipeId || '')}"
                     data-title="${escapeAttr(meal.Title)}"
                     ${hasAdditional ? `data-has-additional="true" data-additional-count="${slotAdditionalItems.length}"` : ''}>
                  <div class="grid-meal-label">${slot.charAt(0)}</div>
                  <div class="grid-meal-title">${escapeHtml(meal.Title)}</div>
                  ${hasAdditional ? `
                    <div class="grid-additional-badge">+${slotAdditionalItems.length}</div>
                    <button class="grid-expand-btn" title="Show additional items" data-date="${dateKey}" data-slot="${slot}">
                      <span class="expand-icon">⌄</span>
                    </button>
                  ` : ''}
                </div>
              `;
        } else {
          // Multiple meals - show count and expandable
          const totalCount = mealsArray.length;
          const firstMeal = mealsArray[0];

          html += `
                <div class="grid-meal grid-meal-multi ${slotClass}" 
                     draggable="true"
                     data-date="${dateKey}" 
                     data-slot="${slot}"
                     data-rid="${escapeAttr(firstMeal.RecipeId || '')}"
                     data-title="${escapeAttr(firstMeal.Title)}"
                     data-meal-count="${totalCount}">
                  <div class="grid-meal-label">${slot.charAt(0)} (${totalCount})</div>
                  <div class="grid-multi-meals">
                    ${mealsArray.slice(0, 2).map((meal, idx) => `
                      <div class="grid-multi-meal-item" title="${escapeAttr(meal.Title)}">
                        ${meal.IsFallback ? '👨‍👩‍👧‍👦' : '👤'} ${escapeHtml(meal.Title.length > 15 ? meal.Title.substring(0, 15) + '...' : meal.Title)}
                      </div>
                    `).join('')}
                    ${totalCount > 2 ? `
                      <div class="grid-multi-more">+${totalCount - 2} more</div>
                    ` : ''}
                  </div>
                  <button class="grid-expand-multi-btn" title="View all meals" data-date="${dateKey}" data-slot="${slot}">
                    <span class="expand-icon">⌄</span>
                  </button>
                </div>
              `;
        }
      } else {
        // PHASE 5.3: Enhanced empty slot with suggestions button
        html += `
              <div class="grid-empty-slot" 
                   id="empty-${dateKey}-${slot}"
                   data-date="${dateKey}" 
                   data-slot="${slot}"
                   data-action="pick-meal">
                <div class="grid-empty-slot-content">
                  <div class="grid-empty-slot-label">+ ${slot}</div>
                  <button class="grid-empty-suggestions-btn" 
                          onclick="event.stopPropagation(); showMealSuggestions('${dateKey}', '${slot}', document.getElementById('empty-${dateKey}-${slot}'))">
                    💡 Suggest
                  </button>
                </div>
              </div>
            `;
      }
    }

    html += `</div>`;
  }

  html += '</div>';
  container.innerHTML = html;

  setupGridDragAndDrop();

  // Phase 4.5.7: Setup multi-meal expand handlers
  setupGridMultiMealHandlers();

  // PHASE 9.3: Log render performance
  const renderTime = performance.now() - startTime;
  console.log(`[Phase 9.3] Rendered meal planner grid (${days} days) in ${renderTime.toFixed(2)}ms`);
}

// Phase 4.5.7: Setup handlers for multi-meal grid cells
function setupGridMultiMealHandlers() {
  const expandBtns = document.querySelectorAll('.grid-expand-multi-btn');
  expandBtns.forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const date = btn.dataset.date;
      const slot = btn.dataset.slot;
      await showGridMultiMealPopover(btn, date, slot);
    });
  });
}

// Phase 4.5.7: Show popover with all meals for a multi-meal slot
async function showGridMultiMealPopover(triggerElement, date, slot) {
  const plan = PLAN.plansByDate[date] || {};
  const meals = plan[slot] || [];
  const mealsArray = Array.isArray(meals) ? meals : (meals ? [meals] : []);

  if (mealsArray.length === 0) return;

  // Create popover
  const popover = document.createElement('div');
  popover.className = 'grid-meal-popover';
  popover.style.cssText = `
        position: absolute;
        background: var(--bg);
        border: 2px solid var(--accent);
        border-radius: 12px;
        padding: 16px;
        min-width: 250px;
        max-width: 350px;
        box-shadow: 0 8px 24px rgba(0,0,0,0.3);
        z-index: 10000;
      `;

  let popoverHtml = `
        <div style="font-weight:600;font-size:14px;margin-bottom:12px;color:var(--fg);">
          ${escapeHtml(slot)} - ${escapeHtml(date)}
        </div>
        <div style="max-height:300px;overflow-y:auto;">
      `;

  mealsArray.forEach((meal, idx) => {
    const badgeColor = meal.IsFallback ? '#6b7280' : '#3b82f6';
    const badgeText = (meal.userName === 'Whole Family' || meal.IsFallback)
      ? '👨‍👩‍👧‍👦 Whole Family'
      : (meal.userName ? `👤 ${escapeHtml(meal.userName)}` : '👤 Personal');

    popoverHtml += `
          <div style="padding:10px;margin-bottom:8px;background:rgba(77,163,255,0.05);border-radius:8px;border-left:4px solid ${badgeColor};">
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;">
              <span style="background:${badgeColor};color:#fff;padding:2px 8px;border-radius:4px;font-size:10px;font-weight:600;">#${idx + 1}</span>
              <span style="background:${badgeColor};color:#fff;padding:2px 8px;border-radius:4px;font-size:10px;font-weight:600;">${badgeText}</span>
            </div>
            <div style="font-weight:600;color:var(--fg);margin-bottom:4px;">${escapeHtml(meal.Title)}</div>
            <div style="display:flex;gap:6px;flex-wrap:wrap;">
              ${meal.RecipeId ? `<button class="ghost" onclick="openRecipeModalView('${escapeAttr(meal.RecipeId)}');closeAllPopovers();" style="padding:4px 8px;font-size:11px;">View</button>` : ''}
              ${!meal.IsFallback && meal.id ? `<button class="ghost" onclick="deleteUserMealFromGrid(${meal.id}, '${escapeAttr(date)}', '${escapeAttr(slot)}');closeAllPopovers();" style="padding:4px 8px;font-size:11px;color:#ef4444;">Delete</button>` : ''}
            </div>
          </div>
        `;
  });

  popoverHtml += `
        </div>
        <div style="margin-top:12px;padding-top:12px;border-top:1px solid var(--line);">
          <button class="primary" onclick="openMealPicker('${escapeAttr(date)}', '${escapeAttr(slot)}');closeAllPopovers();" style="width:100%;padding:8px;font-size:12px;">
            + Add Another Meal
          </button>
        </div>
      `;

  popover.innerHTML = popoverHtml;
  document.body.appendChild(popover);

  // Position popover
  const rect = triggerElement.getBoundingClientRect();
  popover.style.left = `${rect.left}px`;
  popover.style.top = `${rect.bottom + 5}px`;

  // Close on outside click
  setTimeout(() => {
    document.addEventListener('click', function closePopover(e) {
      if (!popover.contains(e.target) && e.target !== triggerElement) {
        popover.remove();
        document.removeEventListener('click', closePopover);
      }
    });
  }, 100);

  // Store reference for closeAllPopovers
  window._activeGridPopover = popover;
}

// Helper to close all popovers
function closeAllPopovers() {
  if (window._activeGridPopover) {
    window._activeGridPopover.remove();
    window._activeGridPopover = null;
  }
}

// Helper to delete meal from grid view
async function deleteUserMealFromGrid(mealId, date, slot) {
  if (!confirm('Delete this meal?')) return;

  const result = await api('deleteUserPlanMeal', { mealId });
  if (result.ok) {
    showToast('Meal deleted', 'success');
    await loadPlansIntoUi(PLAN.start, PLAN.days);
    await refreshDashboardIfToday(date); // Refresh dashboard if today's meal changed
  } else {
    showToast('Failed to delete meal: ' + result.error, 'error');
  }
}

function setupGridDragAndDrop() {
  const meals = document.querySelectorAll('.grid-meal');
  const slots = document.querySelectorAll('.grid-meal, .grid-empty-slot');

  // ========== PHASE 2.2: Enhanced drag setup for meals ==========
  meals.forEach(meal => {
    meal.addEventListener('dragstart', (e) => {
      meal.classList.add('dragging');
      DRAG_SOURCE = {
        type: 'meal',  // Type: meal (for swapping)
        date: meal.dataset.date,
        slot: meal.dataset.slot,
        recipeId: meal.dataset.rid,
        title: meal.dataset.title
      };
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', JSON.stringify(DRAG_SOURCE));
    });

    meal.addEventListener('dragend', () => {
      meal.classList.remove('dragging');
      DRAG_SOURCE = null;
    });
  });

  // ========== PHASE 2.2: Enhanced drop zones for slots ==========
  slots.forEach(slot => {
    slot.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';

      // Different visual feedback based on drag source type
      if (DRAG_SOURCE && DRAG_SOURCE.type === 'recipe') {
        slot.classList.add('drag-over-recipe');
      } else {
        slot.classList.add('drag-over');
      }
    });

    slot.addEventListener('dragleave', () => {
      slot.classList.remove('drag-over');
      slot.classList.remove('drag-over-recipe');
    });

    slot.addEventListener('drop', async (e) => {
      e.preventDefault();
      slot.classList.remove('drag-over');
      slot.classList.remove('drag-over-recipe');

      if (!DRAG_SOURCE) return;

      // Capture DRAG_SOURCE locally before any async operations
      // (dragend fires and nullifies DRAG_SOURCE during async awaits)
      const dragSource = { ...DRAG_SOURCE };

      const targetDate = slot.dataset.date;
      const targetSlot = slot.dataset.slot;

      // ========== PHASE 2.2: Handle recipe drops (assign) vs meal drops (swap) ==========
      if (dragSource.type === 'recipe') {
        // Phase 4.5.7: Get active user
        const activeUserRes = await api('getActiveUser');
        const userId = (activeUserRes.ok && activeUserRes.userId) ? activeUserRes.userId : null;

        if (!userId) {
          showToast('No active user set', 'error');
          return;
        }

        // Recipe → Meal Slot: Assign recipe to slot
        // Fetch recipe title first
        const recipeRes = await api('getRecipe', { recipeId: dragSource.recipeId });
        if (!recipeRes.ok) {
          showToast('Failed to load recipe', 'error');
          return;
        }

        const res = await api('upsertUserPlanMeal', {
          userId,
          date: targetDate,
          slot: targetSlot,
          meal: {
            RecipeId: dragSource.recipeId,
            Title: recipeRes.recipe.Title
          }
        });

        if (res.ok) {
          showToast(`"${dragSource.title}" assigned to ${targetSlot} on ${targetDate}`, 'success');
          await loadPlansIntoUi(PLAN.start, PLAN.days);
          if (PLAN.viewMode === 'grid') renderPlanGrid();
          await refreshDashboardIfToday(targetDate); // Refresh dashboard if today's meal changed
        } else {
          showToast(res.error || 'Failed to assign recipe', 'error');
        }
      } else if (dragSource.type === 'meal') {
        // Meal → Meal Slot: Swap meals
        if (dragSource.date === targetDate && dragSource.slot === targetSlot) return;

        const res = await api('swapPlanMeals', {
          date1: dragSource.date,
          slot1: dragSource.slot,
          date2: targetDate,
          slot2: targetSlot
        });

        if (res.ok) {
          await loadPlansIntoUi(PLAN.start, PLAN.days);
          if (PLAN.viewMode === 'grid') renderPlanGrid();
          // Refresh dashboard if either date involves today
          const today = ymd(new Date());
          if (dragSource.date === today || targetDate === today) {
            QUERY_CACHE.plans.delete(today);
            QUERY_CACHE.plansFetchTime.delete(today);
            await renderDashboard();
          }
        }
      }
    });
  });

  document.querySelectorAll('[data-action="pick-meal"]').forEach(el => {
    el.addEventListener('click', () => {
      openMealPicker(el.dataset.date, el.dataset.slot);
    });
  });
}

function openLeftoverPicker() {
  if (!MP.open || !MP.date) return;

  const targetDate = new Date(MP.date);
  const meals = [];

  for (let i = 1; i <= 3; i++) {
    const pastDate = ymd(new Date(targetDate.getTime() - i * 24 * 60 * 60 * 1000));
    const plan = PLAN.plansByDate[pastDate];
    if (plan) {
      ['Dinner', 'Lunch', 'Breakfast'].forEach(slot => {
        const slotMeals = plan[slot];
        // Handle both array (multi-user) and single object (legacy) formats
        const mealsArray = Array.isArray(slotMeals) ? slotMeals : (slotMeals ? [slotMeals] : []);

        for (const m of mealsArray) {
          if (m && m.Title && m.RecipeId) {
            meals.push({
              date: pastDate,
              slot,
              title: m.Title,
              recipeId: m.RecipeId,
              userName: m.userName || ''
            });
          }
        }
      });
    }
  }

  const container = document.getElementById('leftoverList');
  if (!meals.length) {
    container.innerHTML = '<div class="muted">No meals found in past 3 days</div>';
  } else {
    container.innerHTML = meals.map(m => `
          <div class="item" data-action="pick-leftover" 
               data-title="${escapeAttr(m.title)}"
               data-recipeid="${escapeAttr(m.recipeId)}"
               data-fromdate="${escapeAttr(m.date)}"
               data-fromslot="${escapeAttr(m.slot)}"
               style="cursor:pointer;">
            <strong>${escapeHtml(m.title)}</strong>
            <div class="muted">${m.date} ${m.slot}${m.userName ? ` (${m.userName})` : ''}</div>
          </div>
        `).join('');
  }

  openModal('leftoverPickerBack');
}

// Collection Recipe Picker for Meal Planner
function openCollectionRecipePicker() {
  if (!MP.open || !MP.date) return;

  // Populate collection dropdown
  const select = document.getElementById('collectionRecipePickerSelect');
  select.innerHTML = '<option value="">-- Choose a collection --</option>' +
    COLLECTIONS.map(c => `<option value="${escapeAttr(c.CollectionId)}">${escapeHtml(c.Name)}</option>`).join('');

  // Clear recipe list
  document.getElementById('collectionRecipePickerList').innerHTML = '<div class="muted">Select a collection to view recipes</div>';

  openModal('collectionRecipePickerBack');
}

async function loadCollectionRecipesForPicker(collectionId) {
  const container = document.getElementById('collectionRecipePickerList');

  if (!collectionId) {
    container.innerHTML = '<div class="muted">Select a collection to view recipes</div>';
    return;
  }

  container.innerHTML = '<div class="muted">Loading...</div>';

  const res = await api('listCollectionRecipes', { collectionId });
  if (!res.ok || !res.recipes || res.recipes.length === 0) {
    container.innerHTML = '<div class="muted">No recipes in this collection</div>';
    return;
  }

  const recipes = res.recipes;
  container.innerHTML = recipes.map(r => `
        <div class="item" data-action="pick-collection-recipe" 
             data-rid="${escapeAttr(r.RecipeId)}"
             data-title="${escapeAttr(r.Title)}"
             style="cursor:pointer;">
          <strong>${escapeHtml(r.Title)}</strong>
          <div class="muted">${escapeHtml(r.MealType || 'Any')} • ${escapeHtml(r.Cuisine || '')}</div>
        </div>
      `).join('');
}

async function loadCollections() {
  const res = await api('listCollections', {});
  if (res.ok) {
    COLLECTIONS = res.collections || [];
    renderCollections();
    updateCollectionFilter();
  }
}

function renderCollections() {
  const container = document.getElementById('collectionsList');

  // ========== PHASE 4.1: Enhanced Empty State for Collections ==========
  if (!COLLECTIONS.length) {
    container.className = 'empty-state-container';
    container.innerHTML = `
          <div class="empty-state">
            <div class="empty-state-icon">📦</div>
            <div class="empty-state-title">No collections yet!</div>
            <div class="empty-state-message">
              Collections help you group recipes for themed weeks,<br>
              special occasions, or meal prep planning.
            </div>
            <div class="empty-state-actions">
              <button class="primary" onclick="openCollectionModal(null)">
                Create First Collection
              </button>
            </div>
          </div>
        `;
    return;
  }

  // ========== PHASE 2.4: Card View ==========
  if (COLLECTION_VIEW_MODE === 'card') {
    container.className = 'collections-grid';
    container.innerHTML = COLLECTIONS.map(c => {
      // Get first 4 recipe emojis/icons or use placeholders
      const emojiMap = {
        'Breakfast': '🍳',
        'Brunch': '🥐',
        'Lunch': '🥗',
        'Dinner': '🍝',
        'Side Dish': '🥔',
        'Appetizer': '🍤',
        'Snack': '🍿',
        'Dessert': '🍰',
        'Beverage': '☕',
        'Italian': '🍕',
        'Mexican': '🌮',
        'Chinese': '🥡',
        'Indian': '🍛',
        'Japanese': '🍣',
        'French': '🥖',
        'American': '🍔',
        'Thai': '🍜',
        'Mediterranean': '🫒'
      };

      // Get cuisine-based emoji or default to recipe icon
      const emoji = emojiMap[c.Cuisine] || emojiMap[c.MealType] || '🍽️';

      // Show up to 4 thumbnails based on actual recipe count
      const recipeCount = c.RecipeCount || 0;
      const thumbs = [];

      if (recipeCount === 0) {
        // Show empty state
        thumbs.push(`<div class="collection-thumb empty">📋</div>`);
      } else if (recipeCount <= 3) {
        // Show one emoji per recipe
        for (let i = 0; i < recipeCount; i++) {
          thumbs.push(`<div class="collection-thumb">${emoji}</div>`);
        }
      } else {
        // Show 3 emojis + "+X more"
        for (let i = 0; i < 3; i++) {
          thumbs.push(`<div class="collection-thumb">${emoji}</div>`);
        }
        thumbs.push(`<div class="collection-thumb more">+${recipeCount - 3}</div>`);
      }

      return `
            <div class="collection-card" data-cid="${escapeAttr(c.CollectionId)}" style="cursor: pointer;">
              <div class="collection-thumbnails" data-action="view-collection" data-cid="${escapeAttr(c.CollectionId)}">
                ${thumbs.join('')}
              </div>
              <div class="collection-card-content">
                <h3 class="collection-card-title" data-action="view-collection" data-cid="${escapeAttr(c.CollectionId)}">${escapeHtml(c.Name)}</h3>
                <div class="collection-card-meta">
                  <div class="collection-card-meta-item">
                    <span>📋</span>
                    <span>${recipeCount} recipe${recipeCount === 1 ? '' : 's'}</span>
                  </div>
                </div>
                ${c.Description ? `<div class="collection-card-description">${escapeHtml(c.Description)}</div>` : ''}
                <div class="collection-card-actions">
                  <button class="collection-card-action" data-action="view-collection" data-cid="${escapeAttr(c.CollectionId)}">
                    View
                  </button>
                  <button class="collection-card-action" data-action="assign-recipes" data-cid="${escapeAttr(c.CollectionId)}">
                    Edit
                  </button>
                  <button class="collection-card-action" data-action="export-collection" data-cid="${escapeAttr(c.CollectionId)}" style="background: rgba(34, 197, 94, 0.15); border-color: rgba(34, 197, 94, 0.3); color: #22c55e;">
                    📥 Export
                  </button>
                  <div class="collection-assign-dropdown" style="position: relative; display: inline-block;">
                    <button class="collection-card-action primary collection-assign-btn" data-cid="${escapeAttr(c.CollectionId)}" data-cname="${escapeAttr(c.Name)}">
                      📅 Assign ▾
                    </button>
                    <div class="collection-assign-menu" style="display:none; position:absolute; top:100%; left:0; background:var(--card); border:1px solid var(--line); border-radius:8px; box-shadow:0 4px 12px rgba(0,0,0,0.15); z-index:100; min-width:180px; margin-top:4px;">
                      <button class="collection-assign-option" data-action="assign-collection-to-planner" data-cid="${escapeAttr(c.CollectionId)}" data-cname="${escapeAttr(c.Name)}" style="display:block; width:100%; padding:10px 14px; border:none; background:none; text-align:left; cursor:pointer; color:var(--text); font-size:13px;">
                        🍽️ Assign to Meal
                      </button>
                      <button class="collection-assign-option" data-action="assign-collection-to-day" data-cid="${escapeAttr(c.CollectionId)}" data-cname="${escapeAttr(c.Name)}" style="display:block; width:100%; padding:10px 14px; border:none; background:none; text-align:left; cursor:pointer; color:var(--text); font-size:13px; border-top:1px solid var(--line);">
                        📆 Assign to Day
                      </button>
                      <button class="collection-assign-option" data-action="assign-collection-to-week" data-cid="${escapeAttr(c.CollectionId)}" data-cname="${escapeAttr(c.Name)}" style="display:block; width:100%; padding:10px 14px; border:none; background:none; text-align:left; cursor:pointer; color:var(--text); font-size:13px; border-top:1px solid var(--line);">
                        📅 Assign to Week
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          `;
    }).join('');
    return;
  }

  // ========== Existing List View ==========
  container.className = 'list';
  container.innerHTML = COLLECTIONS.map(c => `
        <div class="item">
          <div style="display:flex; justify-content:space-between; gap:10px; align-items:start;">
            <div style="flex:1;">
              <strong>${escapeHtml(c.Name)}</strong>
              ${c.Description ? `<div class="muted">${escapeHtml(c.Description)}</div>` : ''}
              <div class="muted">${c.RecipeCount || 0} recipe${(c.RecipeCount || 0) === 1 ? '' : 's'}</div>
            </div>
            <div class="actions">
              <button class="ghost" data-action="edit-collection" data-cid="${escapeAttr(c.CollectionId)}">Edit</button>
              <button class="ghost" data-action="assign-recipes" data-cid="${escapeAttr(c.CollectionId)}">Assign Recipes</button>
              <button class="ghost" data-action="export-collection" data-cid="${escapeAttr(c.CollectionId)}" style="background: rgba(34, 197, 94, 0.15); border-color: rgba(34, 197, 94, 0.3); color: #22c55e;">📥 Export</button>
              <div class="collection-assign-dropdown" style="position: relative; display: inline-block;">
                <button class="primary collection-assign-btn" data-cid="${escapeAttr(c.CollectionId)}" data-cname="${escapeAttr(c.Name)}" style="background: linear-gradient(135deg, #10b981 0%, #059669 100%);">📅 Assign ▾</button>
                <div class="collection-assign-menu" style="display:none; position:absolute; top:100%; right:0; background:var(--card); border:1px solid var(--line); border-radius:8px; box-shadow:0 4px 12px rgba(0,0,0,0.15); z-index:100; min-width:180px; margin-top:4px;">
                  <button class="collection-assign-option" data-action="assign-collection-to-planner" data-cid="${escapeAttr(c.CollectionId)}" data-cname="${escapeAttr(c.Name)}" style="display:block; width:100%; padding:10px 14px; border:none; background:none; text-align:left; cursor:pointer; color:var(--text); font-size:13px;">
                    🍽️ Assign to Meal
                  </button>
                  <button class="collection-assign-option" data-action="assign-collection-to-day" data-cid="${escapeAttr(c.CollectionId)}" data-cname="${escapeAttr(c.Name)}" style="display:block; width:100%; padding:10px 14px; border:none; background:none; text-align:left; cursor:pointer; color:var(--text); font-size:13px; border-top:1px solid var(--line);">
                    📆 Assign to Day
                  </button>
                  <button class="collection-assign-option" data-action="assign-collection-to-week" data-cid="${escapeAttr(c.CollectionId)}" data-cname="${escapeAttr(c.Name)}" style="display:block; width:100%; padding:10px 14px; border:none; background:none; text-align:left; cursor:pointer; color:var(--text); font-size:13px; border-top:1px solid var(--line);">
                    📅 Assign to Week
                  </button>
                </div>
              </div>
              <button class="primary" data-action="collection-shopping-list" data-cid="${escapeAttr(c.CollectionId)}" style="background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);">🛒 Shopping List</button>
            </div>
          </div>
        </div>
      `).join('');
}

function updateCollectionFilter() {
  const filter = document.getElementById('collectionFilter');
  filter.innerHTML = '<option value="">All Recipes</option>' +
    COLLECTIONS.map(c => `<option value="${escapeAttr(c.CollectionId)}">${escapeHtml(c.Name)}</option>`).join('');
}

async function loadCollectionRecipes(collectionId) {
  console.log('loadCollectionRecipes called with collectionId:', collectionId);
  CURRENT_COLLECTION_ID = collectionId;
  const res = await api('listCollectionRecipes', { collectionId });
  console.log('listCollectionRecipes result:', res);
  if (res.ok) {
    COLLECTION_RECIPES = res.recipes || [];
    console.log('COLLECTION_RECIPES set to:', COLLECTION_RECIPES);
    renderCollectionRecipes();
  } else {
    console.error('Failed to load collection recipes:', res.error);
  }
}

/**
 * Updates planner entries when a collection's main dish changes
 * Finds all meal slots that contain recipes from this collection and reassigns
 */
async function updatePlannerForCollection(collectionId) {
  if (!collectionId) return;

  // Get all recipes in this collection
  const collectionRes = await api('listCollectionRecipes', { collectionId });
  if (!collectionRes.ok || !collectionRes.recipes) return;

  const recipeIds = collectionRes.recipes.map(r => r.RecipeId);
  if (recipeIds.length === 0) return;

  // Get current plan view dates
  const start = PLAN.start || ymd(new Date());
  const days = PLAN.days || 7;

  // Load plans for current view
  const plansRes = await api('getPlansRange', { start, end: ymd(addDays(new Date(start), days)) });
  if (!plansRes.ok || !plansRes.plans) return;

  // Find dates/slots that have any recipe from this collection
  const slotsToUpdate = [];
  for (const plan of plansRes.plans) {
    for (const slot of ['Breakfast', 'Lunch', 'Dinner']) {
      const meal = plan[slot];
      if (meal && meal.RecipeId && recipeIds.includes(meal.RecipeId)) {
        slotsToUpdate.push({ date: plan.Date, slot });
      }
    }
  }

  // Reassign each collection to update with new main dish
  for (const { date, slot } of slotsToUpdate) {
    await api('assignCollectionToSlot', {
      date,
      slot,
      collectionId
    });
  }

  // Reload planner view if any updates were made
  if (slotsToUpdate.length > 0) {
    await loadPlansIntoUi(start, days);
  }
}

function renderCollectionRecipes() {
  console.log('renderCollectionRecipes called');
  const container = document.getElementById('collectionRecipesList');
  console.log('Container element:', container);
  const collection = COLLECTIONS.find(c => c.CollectionId === CURRENT_COLLECTION_ID);
  console.log('Current collection:', collection);
  console.log('COLLECTION_RECIPES length:', COLLECTION_RECIPES.length);

  const subtitleEl = document.getElementById('collectionRecipesSubtitle');
  if (subtitleEl) {
    subtitleEl.textContent = collection ? `Recipes in "${collection.Name}"` : 'Select a collection';
  }

  if (!COLLECTION_RECIPES.length) {
    container.innerHTML = '<div class="muted">No recipes in this collection</div>';
    console.log('No recipes to display');
    return;
  }

  console.log('Rendering', COLLECTION_RECIPES.length, 'recipes');
  container.innerHTML = COLLECTION_RECIPES.map(r => `
        <div class="item">
          <div style="display:flex; justify-content:space-between; gap:10px; align-items:start;">
            <div style="display:flex; align-items:center; gap:12px; flex:1;">
              <div style="display:flex; flex-direction:column; gap:2px;">
                <label style="font-size:11px; color:var(--muted); font-weight:600;">Meal Role</label>
                <select 
                       class="collection-role-select"
                       data-action="toggle-main-dish" 
                       data-rid="${escapeAttr(r.RecipeId)}"
                       style="padding:4px 8px; border-radius:6px; border:1px solid var(--line); font-size:12px; background:var(--card); color:var(--text); cursor:pointer;">
                  <option value="1" ${r.IsMainDish ? 'selected' : ''}>Main Dish</option>
                  <option value="0" ${!r.IsMainDish ? 'selected' : ''}>Side Dish</option>
                </select>
              </div>
              <div style="flex:1;">
                <strong>${escapeHtml(r.Title)}</strong>
                <div class="muted">${escapeHtml(r.MealType || 'Any')} • ${escapeHtml(r.Cuisine || '')}</div>
              </div>
            </div>
            <div class="actions">
              <button class="ghost" data-action="recipe-view" data-rid="${escapeAttr(r.RecipeId)}">View</button>
              <button class="primary" data-action="assign-to-planner" data-rid="${escapeAttr(r.RecipeId)}" data-title="${escapeAttr(r.Title)}" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);">📅 Assign to Planner</button>
              <button class="danger" data-action="remove-from-collection" data-rid="${escapeAttr(r.RecipeId)}">Remove</button>
            </div>
          </div>
        </div>
      `).join('');
  console.log('Rendered collection recipes HTML');
}

function openCollectionModal(collection) {
  if (collection) {
    CURRENT_COLLECTION_ID = collection.CollectionId;
    document.getElementById('collectionModalTitle').textContent = 'Edit Collection';
    document.getElementById('collectionName').value = collection.Name || '';
    document.getElementById('collectionDescription').value = collection.Description || '';
    document.getElementById('btnDeleteCollection').style.display = '';
  } else {
    CURRENT_COLLECTION_ID = '';
    document.getElementById('collectionModalTitle').textContent = 'Create Collection';
    document.getElementById('collectionName').value = '';
    document.getElementById('collectionDescription').value = '';
    document.getElementById('btnDeleteCollection').style.display = 'none';
  }

  document.getElementById('collectionModalStatus').textContent = '';
  openModal('collectionModalBack');
}

// Assign to Planner Modal
let ASSIGN_TO_PLANNER_STATE = { recipeId: '', title: '' };

function openAssignToPlannerModal(recipeId, title) {
  ASSIGN_TO_PLANNER_STATE = { recipeId, title };

  document.getElementById('assignToPlannerRecipeTitle').textContent = title;
  document.getElementById('assignToPlannerDate').value = ymd(new Date());
  document.getElementById('assignToPlannerSlot').value = 'Dinner';
  document.getElementById('assignToPlannerStatus').textContent = '';

  openModal('assignToPlannerBack');
}

async function confirmAssignToPlanner() {
  const { recipeId, title } = ASSIGN_TO_PLANNER_STATE;
  const date = document.getElementById('assignToPlannerDate').value;
  const slot = document.getElementById('assignToPlannerSlot').value;
  const status = document.getElementById('assignToPlannerStatus');

  if (!date) {
    status.textContent = 'Please select a date';
    return;
  }

  status.textContent = 'Assigning...';

  // Phase 4.5.7: Get active user
  const activeUserRes = await api('getActiveUser');
  const userId = (activeUserRes.ok && activeUserRes.userId) ? activeUserRes.userId : null;

  if (!userId) {
    status.textContent = 'No active user set';
    return;
  }

  const res = await api('upsertUserPlanMeal', {
    userId,
    date,
    slot,
    meal: {
      RecipeId: recipeId,
      Title: title
    }
  });

  if (res.ok) {
    status.textContent = 'Assigned successfully!';
    await refreshDashboardIfToday(date); // Refresh dashboard if today's meal changed
    setTimeout(() => {
      document.getElementById('assignToPlannerBack').style.display = 'none';
      // If user is on planner tab, reload it
      if (PLAN.start && PLAN.days) {
        loadPlansIntoUi(PLAN.start, PLAN.days);
      }
    }, 1000);
  } else {
    status.textContent = res.error || 'Failed to assign';
  }
}

async function openAssignRecipesModal() {
  console.log('openAssignRecipesModal called');

  // Ensure recipes are loaded before showing the modal
  if (!RECIPES || RECIPES.length === 0) {
    console.log('RECIPES empty, loading all recipes...');
    const res = await api('listRecipesAll', {});
    if (res.ok) {
      RECIPES = res.recipes || [];
      RECIPES.sort((a, b) => String(a.TitleLower || a.Title || '').localeCompare(String(b.TitleLower || b.Title || '')));
      console.log('Loaded', RECIPES.length, 'recipes');
    } else {
      console.error('Failed to load recipes:', res.error);
      showToast('Failed to load recipes', 'error');
      return;
    }
  } else {
    console.log('Using existing RECIPES array with', RECIPES.length, 'recipes');
  }

  const collection = COLLECTIONS.find(c => c.CollectionId === CURRENT_COLLECTION_ID);
  document.getElementById('assignRecipesModalSubtitle').textContent =
    collection ? `Assigning to: ${collection.Name}` : '';

  document.getElementById('assignRecipesSearch').value = '';
  renderAssignRecipesList('');
  openModal('assignRecipesModalBack');
}

function renderAssignRecipesList(query) {
  console.log('renderAssignRecipesList called with query:', query);
  const container = document.getElementById('assignRecipesList');
  console.log('Container:', container);
  console.log('RECIPES length:', RECIPES.length);
  const collectionRecipeIds = new Set((COLLECTION_RECIPES || []).map(r => r.RecipeId));
  console.log('Collection recipe IDs:', collectionRecipeIds);

  let recipesToShow = RECIPES;
  if (query) {
    recipesToShow = RECIPES.filter(r =>
      (r.Title || '').toLowerCase().includes(query) ||
      (r.Cuisine || '').toLowerCase().includes(query)
    );
    console.log('Filtered to', recipesToShow.length, 'recipes');
  } else {
    console.log('Showing all', recipesToShow.length, 'recipes');
  }

  container.innerHTML = recipesToShow.map(r => {
    const inCollection = collectionRecipeIds.has(r.RecipeId);
    return `
          <div class="item">
            <div style="display:flex; justify-content:space-between; gap:10px; align-items:center;">
              <div style="flex:1;">
                <strong>${escapeHtml(r.Title)}</strong>
                <div class="muted">${escapeHtml(r.MealType || 'Any')} • ${escapeHtml(r.Cuisine || '')}</div>
              </div>
              <button class="${inCollection ? 'danger' : 'ghost'}" 
                      data-action="toggle-recipe-in-collection"
                      data-rid="${escapeAttr(r.RecipeId)}"
                      data-incollection="${inCollection}">
                ${inCollection ? 'Remove' : 'Add'}
              </button>
            </div>
          </div>
        `;
  }).join('');
  console.log('Rendered', recipesToShow.length, 'recipes to container');
}

function populateBreakfastRecipeDropdown() {
  // This function now handles the searchable dropdown
  const searchInput = document.getElementById('autoFillBreakfastSearch');
  const dropdown = document.getElementById('autoFillBreakfastDropdown');
  const hiddenInput = document.getElementById('autoFillBreakfastRecipe');

  if (!searchInput || !dropdown || !hiddenInput) return;

  const breakfastRecipes = RECIPES.filter(r =>
    (r.MealType || '').toLowerCase().includes('breakfast') ||
    (r.MealType || '').toLowerCase() === 'any'
  );

  searchInput.addEventListener('input', (e) => {
    const query = e.target.value.trim().toLowerCase();

    if (!query) {
      dropdown.style.display = 'none';
      return;
    }

    const filtered = breakfastRecipes.filter(r =>
      (r.Title || '').toLowerCase().includes(query)
    );

    if (!filtered.length) {
      dropdown.innerHTML = '<div style="padding:8px; color:var(--muted);">No recipes found</div>';
      dropdown.style.display = 'block';
      return;
    }

    dropdown.innerHTML = filtered.map(r => `
          <div class="item" data-action="select-breakfast-recipe" data-rid="${escapeAttr(r.RecipeId)}" data-title="${escapeAttr(r.Title)}"
               style="cursor:pointer; padding:8px; border-bottom:1px solid var(--line);">
            ${escapeHtml(r.Title)}
          </div>
        `).join('');
    dropdown.style.display = 'block';
  });

  searchInput.addEventListener('blur', () => {
    setTimeout(() => {
      dropdown.style.display = 'none';
    }, 200);
  });

  searchInput.addEventListener('focus', (e) => {
    if (e.target.value.trim()) {
      e.target.dispatchEvent(new Event('input'));
    }
  });

  dropdown.addEventListener('click', (e) => {
    const select = e.target.closest('[data-action="select-breakfast-recipe"]');
    if (select) {
      hiddenInput.value = select.dataset.rid;
      searchInput.value = select.dataset.title;
      dropdown.style.display = 'none';
    }
  });
}

// ============ IMPORT RECIPE FROM URL ============
function openImportRecipeModal() {
  const modal = document.getElementById('importRecipeModalBack');
  const urlInput = document.getElementById('importRecipeUrl');
  const preview = document.getElementById('importRecipePreview');
  const divider = document.getElementById('importPreviewDivider');
  const status = document.getElementById('importRecipeStatus');

  // Reset
  urlInput.value = '';
  preview.style.display = 'none';
  divider.style.display = 'none';
  status.textContent = '';

  // Populate cuisine dropdown with comprehensive list
  populateImportCuisineDropdown();

  modal.style.display = 'flex';

  // Focus the URL input after modal is visible
  setTimeout(() => {
    urlInput.focus();
  }, 100);
}

function closeImportRecipeModal() {
  document.getElementById('importRecipeModalBack').style.display = 'none';
}

async function fetchRecipeFromUrl() {
  const url = document.getElementById('importRecipeUrl').value.trim();
  const status = document.getElementById('importRecipeStatus');
  const preview = document.getElementById('importRecipePreview');
  const divider = document.getElementById('importPreviewDivider');

  if (!url) {
    status.textContent = 'Please enter a URL';
    return;
  }

  status.textContent = 'Fetching recipe...';

  const result = await api('importRecipeFromUrl', { url });

  if (!result.ok) {
    status.textContent = 'Error: ' + (result.error || 'Failed to import');
    preview.style.display = 'none';
    divider.style.display = 'none';
    return;
  }

  // Populate preview
  document.getElementById('importPreviewTitle').value = result.title || '';
  document.getElementById('importPreviewInstructions').value = result.instructions || '';

  // Handle ingredients: if already parsed objects, convert to text; if strings, join as-is
  const ingredientsDisplay = (result.ingredients || []).map(ing => {
    if (typeof ing === 'object' && ing.IngredientRaw) {
      return ing.IngredientRaw; // Already parsed, show original
    }
    return String(ing); // String format
  }).join('\n');
  document.getElementById('importPreviewIngredients').value = ingredientsDisplay;

  document.getElementById('importPreviewServings').value = result.servings || 4;
  document.getElementById('importPreviewCuisine').value = result.cuisine || '';
  document.getElementById('importPreviewMealType').value = result.mealType || 'Any';
  document.getElementById('importPreviewImageUrl').value = result.imageUrl || '';

  // Store parsed ingredients for later use
  window._importedIngredients = result.ingredients || [];

  preview.style.display = 'block';
  divider.style.display = 'block';
  status.textContent = `✓ Found recipe: ${result.title || 'Untitled'}`;

  // PHASE 3: Update visual preview card
  updateVisualImportPreview();
}

/**
 * PHASE 3: Sync import form fields with visual preview card
 */
function updateVisualImportPreview() {
  const title = document.getElementById('importPreviewTitle').value || 'Recipe Title';
  const cuisine = document.getElementById('importPreviewCuisine').value || 'Unknown Cuisine';
  const servings = document.getElementById('importPreviewServings').value || '4';
  const mealType = document.getElementById('importPreviewMealType').value || 'Any';
  const imageUrl = document.getElementById('importPreviewImageUrl').value.trim();

  document.getElementById('importPreviewCardTitle').textContent = title;
  document.getElementById('importPreviewCardCuisine').textContent = cuisine;
  document.getElementById('importPreviewCardServings').textContent = servings;
  document.getElementById('importPreviewCardBadge').textContent = mealType;

  const imgEl = document.getElementById('importPreviewCardImage');
  if (imageUrl) {
    imgEl.style.backgroundImage = `url('${imageUrl}')`;
  } else {
    imgEl.style.backgroundImage = `url('https://via.placeholder.com/400x200?text=No+Image')`;
  }
}

async function saveImportedRecipe() {
  const title = document.getElementById('importPreviewTitle').value.trim();
  const instructions = document.getElementById('importPreviewInstructions').value.trim();
  const ingredientsText = document.getElementById('importPreviewIngredients').value.trim();
  const servings = parseInt(document.getElementById('importPreviewServings').value) || 4;
  const cuisine = document.getElementById('importPreviewCuisine').value;
  const mealType = document.getElementById('importPreviewMealType').value;
  const imageUrl = document.getElementById('importPreviewImageUrl').value.trim();
  const sourceUrl = document.getElementById('importRecipeUrl').value.trim();
  const saveStatus = document.getElementById('importSaveStatus');

  if (!title) {
    saveStatus.textContent = 'Title is required';
    return;
  }

  // Use pre-parsed ingredients if available, otherwise parse manually
  let items = [];
  if (window._importedIngredients && Array.isArray(window._importedIngredients) && window._importedIngredients.length > 0) {
    // Already parsed by backend
    items = window._importedIngredients.map(ing => {
      if (typeof ing === 'object') {
        return {
          IngredientRaw: ing.IngredientRaw || '',
          IngredientName: ing.IngredientName || '',
          IngredientNorm: ing.IngredientNorm || '',
          QtyNum: ing.QtyNum,
          QtyText: ing.QtyText || '',
          Unit: ing.Unit || '',
          Notes: ing.Notes || '',
          StoreId: ing.StoreId || '',
          Category: ing.Category || ''
        };
      }
      // Fallback for string format
      return {
        IngredientRaw: String(ing),
        IngredientName: String(ing),
        IngredientNorm: String(ing).toLowerCase(),
        QtyNum: null,
        QtyText: '',
        Unit: '',
        Notes: '',
        StoreId: '',
        Category: ''
      };
    });
  } else {
    // Manual parsing (fallback)
    const ingredientLines = ingredientsText.split('\n').filter(line => line.trim());
    items = ingredientLines.map(line => {
      return {
        IngredientRaw: line,
        IngredientName: line,
        IngredientNorm: line.toLowerCase(),
        QtyNum: null,
        QtyText: '',
        Unit: '',
        Notes: '',
        StoreId: '',
        Category: ''
      };
    });
  }

  saveStatus.textContent = 'Saving...';

  const recipe = {
    Title: title,
    URL: sourceUrl,
    Cuisine: cuisine,
    MealType: mealType,
    Instructions: instructions,
    Notes: `Imported from: ${sourceUrl}`,
    Image_Name: imageUrl,
    default_servings: servings
  };

  const result = await api('upsertRecipeWithIngredients', { recipe, items });

  if (result.ok) {
    saveStatus.textContent = '✓ Recipe saved!';
    await resetAndLoadRecipes();
    setTimeout(() => {
      closeImportRecipeModal();
    }, 1000);
  } else {
    saveStatus.textContent = 'Error: ' + (result.error || 'Failed to save');
  }
}

// ============ SMART WEEKLY MEAL PLANNER ============

const MEAL_PLANNER_PREFS_KEY = 'foodie_meal_planner_prefs';

// Load preferences from localStorage
function loadMealPlannerPrefs() {
  try {
    const saved = localStorage.getItem(MEAL_PLANNER_PREFS_KEY);
    if (saved) {
      return JSON.parse(saved);
    }
  } catch (e) {
    console.error('Failed to load meal planner prefs:', e);
  }

  // Default preferences
  return {
    favoriteCuisines: ['Italian', 'Mexican', 'American'],
    avoidRepeat: true,
    usePantry: true,
    favoritesOnly: false,
    breakfastStyle: 'varied',
    avoidRecipeRepeat: false,
    recipeRepeatDays: 3,
    excludeBreakfast: false,
    excludeLunch: false,
    excludeDinner: false
  };
}

// Save preferences to localStorage
function saveMealPlannerPrefs(prefs) {
  try {
    localStorage.setItem(MEAL_PLANNER_PREFS_KEY, JSON.stringify(prefs));
  } catch (e) {
    console.error('Failed to save meal planner prefs:', e);
  }
}

// Open preferences modal
function openMealPlannerPrefs() {
  const modal = document.getElementById('mealPlannerPrefsBack');
  const prefs = loadMealPlannerPrefs();

  // Render cuisine checkboxes from comprehensive list
  renderCuisineCheckboxes();

  // Set other preferences
  document.getElementById('prefAvoidRepeat').checked = prefs.avoidRepeat;
  document.getElementById('prefUsePantry').checked = prefs.usePantry;
  document.getElementById('prefFavoritesOnly').checked = prefs.favoritesOnly;
  document.getElementById('prefBreakfastStyle').value = prefs.breakfastStyle;

  // Set recipe repeat preferences
  document.getElementById('prefAvoidRecipeRepeat').checked = prefs.avoidRecipeRepeat || false;
  document.getElementById('prefRecipeRepeatDays').value = prefs.recipeRepeatDays || 3;
  document.getElementById('prefExcludeBreakfast').checked = prefs.excludeBreakfast || false;
  document.getElementById('prefExcludeLunch').checked = prefs.excludeLunch || false;
  document.getElementById('prefExcludeDinner').checked = prefs.excludeDinner || false;

  // Show/hide recipe repeat options based on checkbox
  const recipeRepeatOptions = document.getElementById('recipeRepeatOptions');
  recipeRepeatOptions.style.display = prefs.avoidRecipeRepeat ? 'block' : 'none';

  modal.style.display = 'flex';
}

// Close preferences modal
function closeMealPlannerPrefs() {
  document.getElementById('mealPlannerPrefsBack').style.display = 'none';
}

// Save preferences from modal
function saveMealPlannerPrefsFromModal() {
  const cuisines = Array.from(document.querySelectorAll('.pref-cuisine:checked')).map(cb => cb.value);

  const prefs = {
    favoriteCuisines: cuisines,
    avoidRepeat: document.getElementById('prefAvoidRepeat').checked,
    usePantry: document.getElementById('prefUsePantry').checked,
    favoritesOnly: document.getElementById('prefFavoritesOnly').checked,
    breakfastStyle: document.getElementById('prefBreakfastStyle').value,
    avoidRecipeRepeat: document.getElementById('prefAvoidRecipeRepeat').checked,
    recipeRepeatDays: Number(document.getElementById('prefRecipeRepeatDays').value),
    excludeBreakfast: document.getElementById('prefExcludeBreakfast').checked,
    excludeLunch: document.getElementById('prefExcludeLunch').checked,
    excludeDinner: document.getElementById('prefExcludeDinner').checked
  };

  saveMealPlannerPrefs(prefs);
  document.getElementById('mealPlannerPrefsStatus').textContent = '✓ Saved!';

  setTimeout(() => {
    closeMealPlannerPrefs();
  }, 800);
}

// ============ CUISINE MANAGEMENT (Comprehensive List) ============

// Comprehensive master cuisine list (single source of truth)
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

// Get cuisines currently in use in recipes
async function getCuisinesInUse() {
  try {
    const result = await api('listUniqueCuisines', {});
    if (result.ok && Array.isArray(result.cuisines)) {
      return new Set(result.cuisines);
    }
  } catch (e) {
    console.error('Failed to load cuisines from database:', e);
  }
  return new Set();
}

// Render cuisine checkboxes in preferences modal (shows comprehensive list)
function renderCuisineCheckboxes() {
  const grid = document.getElementById('cuisineGrid');
  const prefs = loadMealPlannerPrefs();

  grid.innerHTML = COMPREHENSIVE_CUISINES.map(cuisine => `
        <label class="cuisine-option">
          <input type="checkbox" class="pref-cuisine" value="${escapeAttr(cuisine)}" ${prefs.favoriteCuisines.includes(cuisine) ? 'checked' : ''}>
          <span>${escapeHtml(cuisine)}</span>
        </label>
      `).join('');
}

// Render cuisine management UI in Admin tab (shows comprehensive list with usage indicators)
async function renderCuisineManagementUI() {
  const list = document.getElementById('cuisineManageList');
  const status = document.getElementById('cuisineManageStatus');

  status.textContent = 'Loading...';
  const cuisinesInUse = await getCuisinesInUse();
  status.textContent = '';

  list.innerHTML = COMPREHENSIVE_CUISINES.map(cuisine => {
    const inUse = cuisinesInUse.has(cuisine);
    return `
          <div class="item" style="display:flex; justify-content:space-between; align-items:center; gap:8px;">
            <span style="flex:1;">
              ${escapeHtml(cuisine)}
              ${inUse ? '<span class="pill accent" style="margin-left:8px; font-size:11px;">In Use</span>' : '<span class="muted" style="margin-left:8px; font-size:11px;">Not Used</span>'}
            </span>
            <div style="display:flex; gap:4px;">
              ${inUse ? `<button class="ghost mini" data-action="rename-cuisine" data-cuisine="${escapeAttr(cuisine)}">Rename</button>` : ''}
              ${inUse ? `<button class="danger mini" data-action="clear-cuisine" data-cuisine="${escapeAttr(cuisine)}">Clear from Recipes</button>` : ''}
              ${!inUse ? `<button class="danger mini" data-action="delete-cuisine" data-cuisine="${escapeAttr(cuisine)}">Remove from List</button>` : ''}
            </div>
          </div>
        `;
  }).join('');
}

// Clear cuisine from all recipes that use it
async function clearCuisineFromRecipes(cuisineName) {
  if (!confirm(`Clear "${cuisineName}" from all recipes? This will remove this cuisine assignment from all recipes that use it.`)) return;

  const status = document.getElementById('cuisineManageStatus');
  status.textContent = 'Clearing...';

  const result = await api('manageCuisine', {
    action: 'delete',
    oldName: cuisineName
  });

  if (result.ok) {
    status.textContent = `✓ ${result.message}`;
    setTimeout(() => { status.textContent = ''; }, 3000);
    await renderCuisineManagementUI();
  } else {
    status.textContent = `Error: ${result.error}`;
    setTimeout(() => { status.textContent = ''; }, 5000);
  }
}

// Rename a cuisine (updates all recipes using it)
async function renameCuisine(oldName) {
  const newName = prompt(`Rename "${oldName}" to:`, oldName);
  if (!newName || newName.trim() === '') return;
  if (newName.trim() === oldName) return;

  const status = document.getElementById('cuisineManageStatus');
  status.textContent = 'Renaming...';

  const result = await api('manageCuisine', {
    action: 'rename',
    oldName: oldName,
    newName: newName.trim()
  });

  if (result.ok) {
    // Update the comprehensive cuisines list
    const index = COMPREHENSIVE_CUISINES.indexOf(oldName);
    if (index !== -1) {
      COMPREHENSIVE_CUISINES[index] = newName.trim();
      COMPREHENSIVE_CUISINES.sort((a, b) => a.localeCompare(b));
    }

    status.textContent = `✓ ${result.message}`;
    setTimeout(() => { status.textContent = ''; }, 3000);

    // Refresh all UI components
    await renderCuisineManagementUI();
    populateCuisineFilter();
    renderCuisineCheckboxes();
  } else {
    status.textContent = `Error: ${result.error}`;
    setTimeout(() => { status.textContent = ''; }, 5000);
  }
}

// Add a new cuisine to the master list
function addCuisine() {
  const input = document.getElementById('newCuisineName');
  const cuisineName = input.value.trim();

  if (!cuisineName) {
    document.getElementById('cuisineManageStatus').textContent = 'Please enter a cuisine name.';
    setTimeout(() => { document.getElementById('cuisineManageStatus').textContent = ''; }, 3000);
    return;
  }

  // Check if already exists (case-insensitive)
  const exists = COMPREHENSIVE_CUISINES.some(c => c.toLowerCase() === cuisineName.toLowerCase());
  if (exists) {
    document.getElementById('cuisineManageStatus').textContent = `"${cuisineName}" already exists in the list.`;
    setTimeout(() => { document.getElementById('cuisineManageStatus').textContent = ''; }, 3000);
    return;
  }

  // Add to the list
  COMPREHENSIVE_CUISINES.push(cuisineName);
  COMPREHENSIVE_CUISINES.sort((a, b) => a.localeCompare(b));

  // Clear input
  input.value = '';

  // Refresh UI
  renderCuisineManagementUI();
  populateCuisineFilter();
  renderCuisineCheckboxes();

  document.getElementById('cuisineManageStatus').textContent = `✓ Added "${cuisineName}" to the cuisine list.`;
  setTimeout(() => { document.getElementById('cuisineManageStatus').textContent = ''; }, 3000);
}

// Remove a cuisine from the master list (only if not in use)
function deleteCuisineFromList(cuisineName) {
  if (!confirm(`Remove "${cuisineName}" from the cuisine list? This only removes it from the dropdown, not from recipes.`)) return;

  const index = COMPREHENSIVE_CUISINES.indexOf(cuisineName);
  if (index !== -1) {
    COMPREHENSIVE_CUISINES.splice(index, 1);
  }

  // Refresh UI
  renderCuisineManagementUI();
  populateCuisineFilter();
  renderCuisineCheckboxes();

  document.getElementById('cuisineManageStatus').textContent = `✓ Removed "${cuisineName}" from the cuisine list.`;
  setTimeout(() => { document.getElementById('cuisineManageStatus').textContent = ''; }, 3000);
}

// Populate cuisine filter dropdown with comprehensive list
function populateCuisineFilter() {
  const select = document.getElementById('recipeCuisineFilter');
  if (!select) return;

  const currentValue = select.value;

  // Build options HTML
  const optionsHtml = ['<option value="">All Cuisines</option>'].concat(
    COMPREHENSIVE_CUISINES.map(cuisine =>
      `<option value="${escapeAttr(cuisine)}">${escapeHtml(cuisine)}</option>`
    )
  ).join('');

  select.innerHTML = optionsHtml;

  // Restore selected value if it still exists
  if (currentValue && COMPREHENSIVE_CUISINES.includes(currentValue)) {
    select.value = currentValue;
  }
}

// Populate import preview cuisine dropdown with comprehensive list
function populateImportCuisineDropdown() {
  const select = document.getElementById('importPreviewCuisine');
  if (!select) return;

  const currentValue = select.value;

  // Build options HTML
  const optionsHtml = ['<option value="">Unknown</option>'].concat(
    COMPREHENSIVE_CUISINES.map(cuisine =>
      `<option value="${escapeAttr(cuisine)}">${escapeHtml(cuisine)}</option>`
    )
  ).join('');

  select.innerHTML = optionsHtml;

  // Restore selected value if it still exists
  if (currentValue && COMPREHENSIVE_CUISINES.includes(currentValue)) {
    select.value = currentValue;
  }
}

// Score a recipe for a given meal slot
function scoreRecipe(recipe, context, prefs) {
  let score = 100;

  // Cuisine preference (+50 if favorite - BOOSTED)
  if (prefs.favoriteCuisines.length > 0) {
    if (prefs.favoriteCuisines.includes(recipe.Cuisine)) {
      score += 50;
    } else if (recipe.Cuisine) {
      score -= 10; // Slight penalty for non-favorite cuisines
    }
  }

  // Favorites bonus (+40 if starred)
  if (recipe.is_favorite) {
    score += 40;
  }

  // Favorites only filter (hard constraint)
  if (prefs.favoritesOnly && !recipe.is_favorite) {
    return 0;
  }

  // Pantry ingredients match
  if (prefs.usePantry && context.pantryItems && context.pantryItems.length > 0) {
    const recipeName = (recipe.Title || '').toLowerCase();
    const matchCount = context.pantryItems.filter(p => {
      const pantryName = (p.NameLower || p.Name || '').toLowerCase();
      return pantryName && recipeName.includes(pantryName);
    }).length;
    score += matchCount * 15;
  }

  // Avoid cuisine repetition (same cuisine on consecutive days)
  if (prefs.avoidRepeat && context.previousDayCuisine && recipe.Cuisine) {
    if (context.previousDayCuisine === recipe.Cuisine) {
      return 0; // HARD EXCLUSION
    }
  }

  // Avoid same-day cuisine repetition
  if (context.sameDayCuisines && recipe.Cuisine) {
    if (context.sameDayCuisines.includes(recipe.Cuisine)) {
      return 0; // HARD EXCLUSION
    }
  }

  // Meal type match
  if (context.mealType) {
    const recipeMealType = (recipe.MealType || 'Any').toLowerCase();
    const targetMealType = context.mealType.toLowerCase();

    if (recipeMealType === targetMealType) {
      score += 20;
    } else if (recipeMealType === 'any') {
      score += 5; // Small bonus for flexible recipes
    } else {
      score -= 15; // Penalty for mismatch
    }
  }

  // Avoid recently used recipes (in last 7 days)
  if (context.recentlyUsed && context.recentlyUsed.has(recipe.RecipeId)) {
    return 0; // HARD EXCLUSION
  }

  // Avoid recipe repetition within specified days (new feature)
  if (prefs.avoidRecipeRepeat && context.usedRecipesInWindow) {
    const recipeId = recipe.RecipeId;
    const mealType = context.mealType;

    // Check if this meal type is excluded from the rule
    const isExcluded =
      (mealType === 'Breakfast' && prefs.excludeBreakfast) ||
      (mealType === 'Lunch' && prefs.excludeLunch) ||
      (mealType === 'Dinner' && prefs.excludeDinner);

    // Apply penalty if recipe was used recently and meal type is not excluded
    if (!isExcluded && context.usedRecipesInWindow.has(recipeId)) {
      return 0; // HARD EXCLUSION
    }
  }

  // Random variation to avoid always picking same top recipes
  score += Math.random() * 10;

  return Math.max(0, score);
}

// Get recently used recipes from plans
async function getRecentlyUsedRecipes(daysBack = 7) {
  const endDate = ymd(new Date());
  const startDate = addDays(endDate, -daysBack);

  const result = await api('getPlansRange', { start: startDate, end: endDate });
  if (!result.ok || !result.plans) return new Set();

  const used = new Set();
  result.plans.forEach(plan => {
    if (plan.Breakfast && plan.Breakfast.RecipeId) used.add(plan.Breakfast.RecipeId);
    if (plan.Lunch && plan.Lunch.RecipeId) used.add(plan.Lunch.RecipeId);
    if (plan.Dinner && plan.Dinner.RecipeId) used.add(plan.Dinner.RecipeId);
  });

  return used;
}

// Generate smart weekly meal plan
async function generateSmartWeek() {
  const status = document.getElementById('generateWeekStatus');
  status.textContent = 'Generating your week...';

  const prefs = loadMealPlannerPrefs();

  // Read date range from the main planner inputs (not modal)
  const startDateInput = document.getElementById('genStartDate').value;
  const endDateInput = document.getElementById('genEndDate').value;

  if (!startDateInput || !endDateInput) {
    status.textContent = 'Error: Please select start and end dates';
    setTimeout(() => { status.textContent = ''; }, 3000);
    return;
  }

  // Calculate number of days (inclusive of both start and end)
  const [sy, sm, sd] = startDateInput.split('-').map(Number);
  const [ey, em, ed] = endDateInput.split('-').map(Number);
  const startDateObj = new Date(sy, sm - 1, sd);
  const endDateObj = new Date(ey, em - 1, ed);

  if (endDateObj < startDateObj) {
    status.textContent = 'Error: End date must be after start date';
    setTimeout(() => { status.textContent = ''; }, 3000);
    return;
  }

  const diffTime = endDateObj.getTime() - startDateObj.getTime();
  const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24)) + 1; // +1 to include both start and end days

  console.log('[generateSmartWeek] Start:', startDateInput, 'End:', endDateInput, 'Days:', diffDays);

  if (diffDays > 60) {
    status.textContent = 'Error: Date range too large (max 60 days)';
    setTimeout(() => { status.textContent = ''; }, 3000);
    return;
  }

  // Get all recipes - include userId to get correct favorites
  const userId = ACTIVE_USER?.userId || null;
  const recipesResult = await api('listRecipesAll', { userId });
  if (!recipesResult.ok || !recipesResult.recipes) {
    status.textContent = 'Error: Could not load recipes';
    return;
  }

  let allRecipes = recipesResult.recipes;

  // Debug: Log favorites count if favoritesOnly is enabled
  if (prefs.favoritesOnly) {
    const favoriteCount = allRecipes.filter(r => r.is_favorite === 1 || r.is_favorite === true).length;
    console.log(`[generateSmartWeek] Favorites only mode: found ${favoriteCount} favorite recipes out of ${allRecipes.length}`);
    if (favoriteCount === 0) {
      status.textContent = 'No favorite recipes found. Mark some recipes as favorites first.';
      setTimeout(() => { status.textContent = ''; }, 5000);
      return;
    }
  }

  // Get pantry items if needed
  let pantryItems = [];
  if (prefs.usePantry) {
    const pantryResult = await api('listPantry', {});
    if (pantryResult.ok && pantryResult.items) {
      pantryItems = pantryResult.items.filter(item => {
        const qty = item.QtyNum;
        return qty && Number(qty) > 0;
      });
    }
  }

  // Get recently used recipes
  const recentlyUsed = await getRecentlyUsedRecipes(diffDays);

  // Separate recipes by meal type
  const breakfastRecipes = allRecipes.filter(r => {
    const mt = (r.MealType || 'Any').toLowerCase();
    return mt === 'breakfast' || mt === 'any';
  });

  const lunchRecipes = allRecipes.filter(r => {
    const mt = (r.MealType || 'Any').toLowerCase();
    return mt === 'lunch' || mt === 'any';
  });

  const dinnerRecipes = allRecipes.filter(r => {
    const mt = (r.MealType || 'Any').toLowerCase();
    return mt === 'dinner' || mt === 'any';
  });

  if (breakfastRecipes.length === 0 || lunchRecipes.length === 0 || dinnerRecipes.length === 0) {
    status.textContent = 'Error: Not enough recipes. Add more recipes first.';
    return;
  }

  const weekPlan = [];
  let previousDayCuisine = null;

  // Track used recipes within the repeat window for recipe repetition avoidance
  const usedRecipesByDay = []; // Array of Sets, one per day

  // Generate meals for the selected date range
  for (let dayOffset = 0; dayOffset < diffDays; dayOffset++) {
    const dayDate = addDays(startDateInput, dayOffset);
    const sameDayCuisines = [];

    // Calculate the sliding window for recipe repetition
    const windowStart = Math.max(0, dayOffset - (prefs.recipeRepeatDays || 3) + 1);
    const usedRecipesInWindow = new Set();
    if (prefs.avoidRecipeRepeat) {
      for (let i = windowStart; i < dayOffset; i++) {
        if (usedRecipesByDay[i]) {
          usedRecipesByDay[i].forEach(rid => usedRecipesInWindow.add(rid));
        }
      }
    }

    // Initialize the set for tracking today's recipes
    usedRecipesByDay[dayOffset] = new Set();

    // Breakfast
    let breakfastRecipe = null;
    if (prefs.breakfastStyle === 'skip') {
      breakfastRecipe = null;
    } else if (prefs.breakfastStyle === 'same' && dayOffset > 0 && weekPlan[0].breakfast) {
      // Use same breakfast as day 1
      breakfastRecipe = weekPlan[0].breakfast;
    } else {
      // Score and select breakfast
      const breakfastCandidates = breakfastRecipes.map(r => ({
        recipe: r,
        score: scoreRecipe(r, {
          mealType: 'Breakfast',
          pantryItems,
          recentlyUsed,
          previousDayCuisine,
          sameDayCuisines,
          usedRecipesInWindow
        }, prefs)
      })).filter(c => c.score > 0);

      if (breakfastCandidates.length > 0) {
        breakfastCandidates.sort((a, b) => b.score - a.score);
        breakfastRecipe = breakfastCandidates[0].recipe;
        if (breakfastRecipe.Cuisine) sameDayCuisines.push(breakfastRecipe.Cuisine);
        if (breakfastRecipe.RecipeId) usedRecipesByDay[dayOffset].add(breakfastRecipe.RecipeId);
      }
    }

    // Lunch
    const lunchCandidates = lunchRecipes.map(r => ({
      recipe: r,
      score: scoreRecipe(r, {
        mealType: 'Lunch',
        pantryItems,
        recentlyUsed,
        previousDayCuisine,
        sameDayCuisines,
        usedRecipesInWindow
      }, prefs)
    })).filter(c => c.score > 0);

    lunchCandidates.sort((a, b) => b.score - a.score);
    const lunchRecipe = lunchCandidates.length > 0 ? lunchCandidates[0].recipe : null;
    if (lunchRecipe && lunchRecipe.Cuisine) sameDayCuisines.push(lunchRecipe.Cuisine);
    if (lunchRecipe && lunchRecipe.RecipeId) usedRecipesByDay[dayOffset].add(lunchRecipe.RecipeId);

    // Dinner
    const dinnerCandidates = dinnerRecipes.map(r => ({
      recipe: r,
      score: scoreRecipe(r, {
        mealType: 'Dinner',
        pantryItems,
        recentlyUsed,
        previousDayCuisine,
        sameDayCuisines,
        usedRecipesInWindow
      }, prefs)
    })).filter(c => c.score > 0);

    dinnerCandidates.sort((a, b) => b.score - a.score);
    const dinnerRecipe = dinnerCandidates.length > 0 ? dinnerCandidates[0].recipe : null;
    if (dinnerRecipe && dinnerRecipe.RecipeId) usedRecipesByDay[dayOffset].add(dinnerRecipe.RecipeId);

    weekPlan.push({
      date: dayDate,
      breakfast: breakfastRecipe,
      lunch: lunchRecipe,
      dinner: dinnerRecipe
    });

    // Set previous day cuisine for next iteration (use dinner cuisine as primary)
    previousDayCuisine = dinnerRecipe ? dinnerRecipe.Cuisine : (lunchRecipe ? lunchRecipe.Cuisine : (breakfastRecipe ? breakfastRecipe.Cuisine : null));
  }

  // Apply the plan to the database
  status.textContent = 'Applying plan...';

  // Phase 4.5.7: Get active user for meal assignment
  const activeUserRes = await api('getActiveUser');
  const activeUserId = (activeUserRes.ok && activeUserRes.userId) ? activeUserRes.userId : null;

  if (!activeUserId) {
    status.textContent = 'Error: No active user set';
    setTimeout(() => { status.textContent = ''; }, 3000);
    return;
  }

  for (const day of weekPlan) {
    if (day.breakfast) {
      await api('upsertUserPlanMeal', {
        userId: activeUserId,
        date: day.date,
        slot: 'Breakfast',
        meal: {
          RecipeId: day.breakfast.RecipeId,
          Title: day.breakfast.Title,
          UseLeftovers: false,
          From: ''
        }
      });
    }

    if (day.lunch) {
      await api('upsertUserPlanMeal', {
        userId: activeUserId,
        date: day.date,
        slot: 'Lunch',
        meal: {
          RecipeId: day.lunch.RecipeId,
          Title: day.lunch.Title,
          UseLeftovers: false,
          From: ''
        }
      });
    }

    if (day.dinner) {
      await api('upsertUserPlanMeal', {
        userId: activeUserId,
        date: day.date,
        slot: 'Dinner',
        meal: {
          RecipeId: day.dinner.RecipeId,
          Title: day.dinner.Title,
          UseLeftovers: false,
          From: ''
        }
      });
    }
  }

  status.textContent = '✓ Week generated successfully!';

  // Update the planner tab date inputs to match generated range (they're the same now)
  document.getElementById('planStart').value = startDateInput;
  document.getElementById('planEnd').value = endDateInput;

  // Reload the planner to show new meals
  await loadPlan();

  // Refresh dashboard if today is in the generated range
  const today = ymd(new Date());
  if (today >= startDateInput && today <= endDateInput) {
    QUERY_CACHE.plans.delete(today);
    QUERY_CACHE.plansFetchTime.delete(today);
    await renderDashboard();
  }

  setTimeout(() => {
    status.textContent = `✓ Generated ${diffDays} days of meals!`;
    setTimeout(() => {
      status.textContent = '';
    }, 5000);
  }, 500);
}


// Planner / Bulk planner - shared load function
async function loadPlan() {
  const start = document.getElementById('planStart').value;
  console.log('[loadPlan] start:', start);
  if (!start) {
    console.log('[loadPlan] No start date, returning early');
    return;
  }

  // Check if end date is provided and calculate the range
  const endInput = document.getElementById('planEnd').value;
  console.log('[loadPlan] endInput:', endInput);
  let days = 1;

  if (endInput) {
    // Calculate days from start to end (inclusive)
    const [sy, sm, sd] = start.split('-').map(Number);
    const [ey, em, ed] = endInput.split('-').map(Number);
    const startDate = new Date(sy, sm - 1, sd);
    const endDate = new Date(ey, em - 1, ed);
    const diffTime = endDate.getTime() - startDate.getTime();
    days = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
    console.log('[loadPlan] Calculated days:', days, 'from', start, 'to', endInput);
  } else {
    // Fall back to planDays input if no end date
    days = Number(document.getElementById('planDays').value || 1);
    console.log('[loadPlan] Using planDays fallback:', days);
  }

  console.log('[loadPlan] Calling loadPlansIntoUi with start:', start, 'days:', days);
  await loadPlansIntoUi(start, days);
}

// ========== GOOGLE CALENDAR FUNCTIONS ==========

async function uploadGoogleCredentials() {
  const fileInput = document.getElementById('googleCredentialsFile');
  const file = fileInput.files[0];
  if (!file) {
    document.getElementById('googleCredsStatus').textContent = 'No file selected';
    return;
  }

  const reader = new FileReader();
  reader.onload = async (e) => {
    try {
      const credentials = JSON.parse(e.target.result);
      const res = await api('initGoogleCalendar', { credentials });

      if (res.ok) {
        document.getElementById('googleCredsStatus').textContent = '✓ Credentials loaded';
        document.getElementById('btnGoogleAuthorize').disabled = false;
        await checkGoogleCalendarStatus();
      } else {
        document.getElementById('googleCredsStatus').textContent = `Error: ${res.error}`;
      }
    } catch (err) {
      document.getElementById('googleCredsStatus').textContent = `Error: Invalid JSON file`;
    }
  };
  reader.readAsText(file);
}

async function authorizeGoogleCalendar() {
  const res = await api('getGoogleAuthUrl', {});
  if (!res.ok) {
    document.getElementById('googleAuthStatus').textContent = `Error: ${res.error}`;
    return;
  }

  window.open(res.authUrl, '_blank');

  document.getElementById('googleAuthCodeRow').style.display = 'block';
  document.getElementById('googleAuthLink').href = res.authUrl;
  document.getElementById('googleAuthLink').style.display = 'inline';
  document.getElementById('googleAuthStatus').textContent = 'Sign in with Google and paste the authorization code below';
}

async function submitGoogleAuthCode() {
  const code = document.getElementById('googleAuthCode').value.trim();
  if (!code) {
    document.getElementById('googleAuthStatus').textContent = 'Please enter the authorization code';
    return;
  }

  document.getElementById('googleAuthStatus').textContent = 'Authorizing...';
  const res = await api('setGoogleAuthCode', { code });

  if (res.ok) {
    document.getElementById('googleAuthStatus').textContent = '✓ Authorized! Google Calendar is ready.';
    document.getElementById('googleAuthCodeRow').style.display = 'none';
    document.getElementById('googleAuthCode').value = '';
    await checkGoogleCalendarStatus();
    await listGoogleCalendars();
  } else {
    document.getElementById('googleAuthStatus').textContent = `Error: ${res.error}`;
  }
}

async function listGoogleCalendars() {
  const res = await api('listGoogleCalendars', {});
  if (!res.ok) {
    document.getElementById('googleSyncStatus').textContent = `Error: ${res.error}`;
    return;
  }

  const select = document.getElementById('googleCalendarSelect');
  select.innerHTML = '<option value="">-- Select calendar --</option>';

  for (const cal of res.calendars) {
    const option = document.createElement('option');
    option.value = cal.id;
    option.textContent = cal.name + (cal.primary ? ' (Primary)' : '');
    select.appendChild(option);
  }

  select.disabled = false;
  document.getElementById('btnGoogleCalSync').disabled = false;
}

async function syncToGoogleCalendar() {
  const start = document.getElementById('googleSyncStart').value;
  const end = document.getElementById('googleSyncEnd').value;
  const calendarId = document.getElementById('googleCalendarSelect').value;

  if (!start || !end) {
    document.getElementById('googleSyncStatus').textContent = 'Please set sync date range above';
    return;
  }

  if (!calendarId) {
    document.getElementById('googleSyncStatus').textContent = 'Please select a calendar';
    return;
  }

  await window.Foodie.setGoogleCalendarId(calendarId);

  document.getElementById('googleSyncStatus').textContent = 'Syncing...';
  console.log('[Google Calendar Sync] Start:', start, 'End:', end, 'CalendarId:', calendarId);

  let res;
  try {
    res = await api('googleCalendarSyncRange', { start, end, calendarId });
  } catch (err) {
    console.error('[Google Calendar Sync] Exception during API call:', err);
    document.getElementById('googleSyncStatus').textContent = `Error: ${err.message}`;
    return;
  }

  console.log('[Google Calendar Sync] Result:', res);
  console.log('[Google Calendar Sync] Result.ok:', res.ok);
  console.log('[Google Calendar Sync] Result.error:', res.error);
  console.log('[Google Calendar Sync] Result.created:', res.created);
  console.log('[Google Calendar Sync] Result.updated:', res.updated);

  if (!res || !res.ok) {
    const errorMsg = (res && res.error) ? res.error : 'Unknown error - check main process logs';
    console.error('[Google Calendar Sync] ERROR:', errorMsg);
    document.getElementById('googleSyncStatus').textContent = `Error: ${errorMsg}`;
    return;
  }

  document.getElementById('googleSyncStatus').textContent = `✓ Synced. Created: ${res.created || 0}, Updated: ${res.updated || 0}`;
  setTimeout(() => {
    document.getElementById('googleSyncStatus').textContent = '';
  }, 5000);
}

async function revokeGoogleCalendar() {
  if (!confirm('This will remove Foodie\'s access to your Google Calendar. You\'ll need to re-authorize. Continue?')) {
    return;
  }

  const res = await api('revokeGoogleCalendar', {});
  if (res.ok) {
    document.getElementById('googleAuthStatus').textContent = 'Access revoked. Re-authorize to sync again.';
    document.getElementById('btnGoogleCalSync').disabled = true;
    document.getElementById('googleCalendarSelect').disabled = true;
    await checkGoogleCalendarStatus();
  }
}

async function checkForDuplicates() {
  const start = document.getElementById('googleSyncStart').value;
  const end = document.getElementById('googleSyncEnd').value;
  const calendarId = document.getElementById('googleCalendarSelect').value;

  if (!start || !end) {
    document.getElementById('googleDuplicateStatus').textContent = 'Please set sync date range first';
    return;
  }

  if (!calendarId) {
    document.getElementById('googleDuplicateStatus').textContent = 'Please select a calendar';
    return;
  }

  document.getElementById('googleDuplicateStatus').textContent = 'Checking for duplicates...';
  console.log('[Check Duplicates] Start:', start, 'End:', end, 'CalendarId:', calendarId);

  const res = await api('checkGoogleCalendarDuplicates', { start, end, calendarId });

  if (!res.ok) {
    document.getElementById('googleDuplicateStatus').textContent = `Error: ${res.error}`;
    return;
  }

  console.log('[Check Duplicates] Result:', res);

  if (res.hasDuplicates) {
    const dupList = res.duplicates.map(d =>
      `${d.date} ${d.slot} (${d.count} copies)`
    ).join(', ');
    document.getElementById('googleDuplicateStatus').innerHTML =
      `⚠️ Found ${res.duplicates.length} duplicate(s):<br>${dupList}<br><span class="muted">Check your Google Calendar settings on the device showing duplicates.</span>`;
  } else {
    document.getElementById('googleDuplicateStatus').textContent =
      `✓ No duplicates found. Checked ${res.checked} events.`;
    setTimeout(() => {
      document.getElementById('googleDuplicateStatus').textContent = '';
    }, 5000);
  }
}

async function checkGoogleCalendarStatus() {
  const res = await api('getGoogleCalendarStatus', {});
  if (res.ok) {
    if (res.authenticated) {
      document.getElementById('googleCredsStatus').textContent = '✓ Configured & Authorized';
      document.getElementById('btnListGoogleCals').disabled = false;
      document.getElementById('btnCheckDuplicates').disabled = false;
      document.getElementById('googleCalendarSelect').disabled = false;
      await listGoogleCalendars();
    } else if (res.hasCredentials) {
      document.getElementById('googleCredsStatus').textContent = 'Credentials loaded. Please authorize.';
      document.getElementById('btnGoogleAuthorize').disabled = false;
    }
  }
}


function bindUi() {
  const safeBind = (id, event, handler) => {
    const el = document.getElementById(id);
    if (el) {
      el.addEventListener(event, handler);
    } else if (DEBUG) {
      console.warn(`[bindUi] Skipped binding ${event} for missing element: ${id}`);
    }
  };

  // Recipes
  safeBind('btnAddRecipe', 'click', openRecipeModalNew);
  safeBind('btnQuickAddRecipe', 'click', openQuickAddModal);
  safeBind('btnImportRecipe', 'click', openImportRecipeModal);
  safeBind('btnRefresh', 'click', resetAndLoadRecipes);

  // PHASE 3: Visual Import Preview Event Listeners
  const importInputs = [
    'importPreviewTitle',
    'importPreviewServings',
    'importPreviewCuisine',
    'importPreviewMealType',
    'importPreviewImageUrl'
  ];
  importInputs.forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      const eventType = el.tagName === 'SELECT' ? 'change' : 'input';
      el.addEventListener(eventType, updateVisualImportPreview);
    }
  });

  // PHASE 3.5: Quick Add Modal Event Listeners
  safeBind('btnQuickAddClose', 'click', closeQuickAddModal);
  safeBind('btnQuickAddCancel', 'click', closeQuickAddModal);
  safeBind('btnQuickAddSave', 'click', () => saveQuickAddRecipe(false));
  safeBind('btnQuickAddSaveAndOpen', 'click', () => saveQuickAddRecipe(true));

  safeBind('btnModalClose', 'click', closeRecipeModal);
  safeBind('btnModalToggleEdit', 'click', toggleRecipeModalMode);
  safeBind('btnSaveRecipeFull', 'click', saveRecipeAndIngredients);
  safeBind('btnDeleteRecipe', 'click', deleteRecipeUi);

  // Print the current recipe with scaled quantities (from modal)
  async function printRecipeWithQuantities() {
    const title = document.getElementById('rTitle').value || 'Untitled Recipe';
    const instructions = document.getElementById('rInstructions').value || '';
    const url = document.getElementById('rUrl').value || '';

    // Helper to clean date strings from QtyText
    const cleanQtyText = (qtyText) => {
      if (!qtyText) return '';
      // Remove date strings that were mistakenly parsed from fractions
      const datePattern = /^(Mon|Tue|Wed|Thu|Fri|Sat|Sun)\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2}\s+\d{4}\s+\d{2}:\d{2}:\d{2}\s+GMT[-+]\d{4}\s+\([^)]+\)\s*/i;
      return qtyText.replace(datePattern, '').trim();
    };

    // Build ingredients list from current ING_ROWS (includes any scaling)
    const ingredientsHtml = ING_ROWS.map(r => {
      const qtyNum = r.QtyNum !== '' ? r.QtyNum : '';
      const unit = r.Unit || '';
      const rawQtyText = r.QtyText || '';
      const cleanText = cleanQtyText(rawQtyText);
      const name = r.IngredientRaw || r.IngredientNorm || '';

      let qtyDisplay = '';
      if (RECIPE_SCALE !== 1.0) {
        if (qtyNum && unit) {
          qtyDisplay = `${qtyNum} ${unit}`;
        } else if (qtyNum) {
          qtyDisplay = qtyNum;
        } else if (unit) {
          qtyDisplay = unit;
        }
      } else {
        if (cleanText && cleanText.length > 0) {
          qtyDisplay = cleanText;
        } else if (qtyNum && unit) {
          qtyDisplay = `${qtyNum} ${unit}`;
        } else if (qtyNum) {
          qtyDisplay = qtyNum;
        } else if (unit) {
          qtyDisplay = unit;
        }
      }

      return `<div style="display:flex;gap:8px;margin-bottom:4px;">
          <span style="min-width:80px;text-align:right;font-weight:600;">${escapeHtml(qtyDisplay)}</span>
          <span>${escapeHtml(name)}</span>
        </div>`;
    }).join('');

    const printHtml = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <title>${escapeHtml(title)}</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; padding: 20px; max-width: 800px; margin: 0 auto; color: #000; }
            h1 { border-bottom: 2px solid #333; padding-bottom: 8px; font-size: 24px; }
            h3 { margin-top: 20px; margin-bottom: 10px; font-size: 16px; }
            pre { white-space: pre-wrap; font-family: inherit; line-height: 1.6; }
            @media print { body { padding: 0; } h1 { font-size: 20px; } }
          </style>
        </head>
        <body>
          <h1>${escapeHtml(title)}</h1>
          ${url ? `<p><a href="${escapeAttr(url)}">${escapeHtml(url)}</a></p>` : ''}
          ${instructions ? `<div><h3>Instructions</h3><pre>${escapeHtml(instructions)}</pre></div>` : ''}
          <div><h3>Ingredients</h3>${ingredientsHtml}</div>
        </body>
        </html>
      `;

    if (window._printInProgress) return;
    window._printInProgress = true;

    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(printHtml);
      printWindow.document.close();
      printWindow.onload = function () {
        setTimeout(() => {
          printWindow.focus();
          printWindow.print();
          window._printInProgress = false;
        }, 250);
      };
      setTimeout(() => { window._printInProgress = false; }, 2000);
    } else {
      window._printInProgress = false;
    }
  }

  // Consolidated Recipe Print Button listener
  safeBind('btnModalPrintRecipe', 'click', async () => {
    if (CURRENT_RECIPE_ID) {
      applyCurrentScaleToDisplay(true);
      await printRecipeWithQuantities();
    }
  });

  safeBind('btnAddIngredientRow', 'click', () => {
    if (recipeModalMode !== 'view') addIngredientRow();
  });
  safeBind('btnCategorizeAll', 'click', async () => {
    if (recipeModalMode !== 'view') await categorizeAllIngredients();
  });

  safeBind('recipesList', 'click', async (e) => {
    // Note: Event delegation catch-all for clicks on recipe list
  });

  // Recipe search with debouncing for better performance
  const debouncedRecipeSearch = debounce(() => {
    CURRENT_QUERY = (document.getElementById('recipeSearch').value || '').trim().toLowerCase();
    // PHASE 9.4: Just re-render with indexed search, no need to reload from DB
    renderRecipes();
  }, 200);

  document.getElementById('recipeSearch').addEventListener('input', debouncedRecipeSearch);

  // Favorites filter
  document.getElementById('recipeFavoritesOnly').addEventListener('change', async () => {
    await resetAndLoadRecipes();
  });

  // Cuisine filter
  document.getElementById('recipeCuisineFilter').addEventListener('change', async () => {
    await resetAndLoadRecipes();
  });

  // ========== PHASE 2.3: Advanced Filter Event Handlers ==========

  // Toggle advanced filters panel
  safeBind('toggleAdvancedFilters', 'click', () => {
    const panel = document.getElementById('advancedFiltersPanel');
    const button = document.getElementById('toggleAdvancedFilters');
    if (!panel || !button) return;

    if (panel.classList.contains('expanded')) {
      panel.classList.remove('expanded');
      button.classList.remove('expanded');
    } else {
      panel.classList.add('expanded');
      button.classList.add('expanded');
    }
  });

  // Meal type chip selection
  safeBind('mealTypeChips', 'click', (e) => {
    const chip = e.target.closest('.filter-chip');
    if (!chip) return;

    chip.classList.toggle('active');
    updateAdvancedFilterState();
  });

  // Add must-have ingredient
  safeBind('addMustHaveIngredient', 'click', () => {
    const input = document.getElementById('mustHaveIngredient');
    if (!input) return;
    const value = input.value.trim();
    if (!value) return;

    ADVANCED_FILTERS.mustHaveIngredients.push(value);
    input.value = '';
    renderIngredientTags();
    updateAdvancedFilterState();
  });

  // Enter key for must-have ingredient
  safeBind('mustHaveIngredient', 'keypress', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      document.getElementById('addMustHaveIngredient')?.click();
    }
  });

  // Add exclude ingredient
  safeBind('addExcludeIngredient', 'click', () => {
    const input = document.getElementById('excludeIngredient');
    if (!input) return;
    const value = input.value.trim();
    if (!value) return;

    ADVANCED_FILTERS.excludeIngredients.push(value);
    input.value = '';
    renderIngredientTags();
    updateAdvancedFilterState();
  });

  // Enter key for exclude ingredient
  safeBind('excludeIngredient', 'keypress', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      document.getElementById('addExcludeIngredient')?.click();
    }
  });

  // Clear all filters
  safeBind('clearAllFilters', 'click', () => {
    clearAdvancedFilters();
  });

  // Apply filters button
  safeBind('applyFilters', 'click', async () => {
    await resetAndLoadRecipes();
    const filteredCount = VIRTUAL_SCROLL.totalItems || VIRTUAL_SCROLL.filteredRecipes?.length || 0;
    showToast(`Filters applied - ${filteredCount} recipe${filteredCount === 1 ? '' : 's'} match`, 'success');
  });

  // Jump A-Z functionality
  safeBind('jumpLetter', 'change', async (e) => {
    const letter = e.target.value;
    CURRENT_QUERY = letter;
    await resetAndLoadRecipes();
  });

  // Meal picker
  safeBind('btnMealPickerClose', 'click', closeMealPicker);
  safeBind('mpSearch', 'input', async () => {
    MP.q = (document.getElementById('mpSearch').value || '').trim().toLowerCase();
    await mealPickerLoad(true);
  });
  safeBind('mpClearMeal', 'click', async () => {
    if (!MP.open) return;
    // Phase 4.5.7: Use upsertUserMeal helper to clear meal
    await upsertUserMeal(MP.date, MP.slot, null);
    closeMealPicker();
    await loadPlansIntoUi(PLAN.start, PLAN.days);
    await loadPantry(); // Refresh pantry after clearing meal
    await refreshDashboardIfToday(MP.date); // Refresh dashboard if today's meal changed
  });
  safeBind('mpList', 'click', async (e) => {
    const sel = e.target.closest('[data-action="mp-select"]');
    if (!sel || !MP.open) return;
    const meal = { RecipeId: sel.dataset.rid, Title: sel.dataset.title };
    // Phase 4.5.7: Use upsertUserMeal helper
    await upsertUserMeal(MP.date, MP.slot, meal);
    closeMealPicker();
    await loadPlansIntoUi(PLAN.start, PLAN.days);
    await loadPantry(); // Refresh pantry after planning meal
    await refreshDashboardIfToday(MP.date); // Refresh dashboard if today's meal changed
  });

  // Auto-load when date inputs change
  safeBind('planStart', 'change', loadPlan);
  safeBind('planEnd', 'change', loadPlan);
  safeBind('btnPlanExpandAll', 'click', () => {
    document.querySelectorAll('#planList details').forEach(d => d.open = true);
  });
  safeBind('btnPlanCollapseAll', 'click', () => {
    document.querySelectorAll('#planList details').forEach(d => d.open = false);
  });

  // Bulk planner handlers
  document.getElementById('btnBulkLoad').addEventListener('click', async () => {
    const start = document.getElementById('bulkStart').value;
    if (!start) return;

    // Check if end date is provided and extend the range
    const endInput = document.getElementById('bulkEnd').value;
    let days = Number(document.getElementById('bulkDays').value || 14);

    if (endInput) {
      // Calculate days from start to end
      const [sy, sm, sd] = start.split('-').map(Number);
      const [ey, em, ed] = endInput.split('-').map(Number);
      const startDate = new Date(sy, sm - 1, sd);
      const endDate = new Date(ey, em - 1, ed);
      const diffTime = endDate.getTime() - startDate.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
      if (diffDays > days) {
        days = diffDays;
        document.getElementById('bulkDays').value = days;
      }
    }

    await loadPlansIntoUi(start, days);
  });
  document.getElementById('btnBulkExpandAll').addEventListener('click', () => {
    document.querySelectorAll('#bulkList details').forEach(d => d.open = true);
  });
  document.getElementById('btnBulkCollapseAll').addEventListener('click', () => {
    document.querySelectorAll('#bulkList details').forEach(d => d.open = false);
  });

  safeBind('planList', 'click', async (e) => {
    const sel = e.target.closest('[data-action="select-meal"]');
    if (sel) { openMealPicker(sel.dataset.date, sel.dataset.slot); return; }

    const v = e.target.closest('[data-action="planner-view"]');
    if (v && v.dataset.rid) { await openRecipeModalView(v.dataset.rid); return; }

    const ed = e.target.closest('[data-action="planner-edit"]');
    if (ed && ed.dataset.rid) { await openRecipeModalEdit(ed.dataset.rid); return; }

    const pp = e.target.closest('[data-action="planner-print"]');
    if (pp && pp.dataset.rid) {
      await openRecipeModalView(pp.dataset.rid);
      // Apply current scale to display before printing (force refresh)
      applyCurrentScaleToDisplay(true);
      printRecipeWithQuantities();
      return;
    }

    const sw = e.target.closest('[data-action="swap"]');
    if (sw) {
      const date = sw.dataset.date;
      const slotA = sw.dataset.a;
      const slotB = sw.dataset.b;
      if (!date || !slotA || !slotB) return;
      await api('swapPlanMeals', {
        date1: date,
        slot1: slotA,
        date2: date,
        slot2: slotB
      });
      await loadPlansIntoUi(PLAN.start, PLAN.days);
      return;
    }

    const left = e.target.closest('[data-action="planner-leftovers"]');
    if (left) {
      const date = left.dataset.date;
      const slot = left.dataset.slot;
      const mealId = left.dataset.mealId;
      const p = PLAN.plansByDate[date] || {};
      const meals = p[slot] || [];
      const mealsArray = Array.isArray(meals) ? meals : (meals ? [meals] : []);
      const cur = mealId ? mealsArray.find(m => String(m.id) === String(mealId)) : mealsArray[0];
      const currently = !!(cur && cur.UseLeftovers);

      if (currently) {
        await upsertUserMeal(date, slot, {
          RecipeId: cur.RecipeId || '',
          Title: cur.Title || '',
          UseLeftovers: false,
          From: ''
        }, mealId);
        await loadPlansIntoUi(PLAN.start, PLAN.days);
        await loadPantry();
        await refreshDashboardIfToday(date);
        return;
      }

      const source = await pickLeftoversSourceAsync_(date, slot);
      if (source === null) return;
      if (!source) {
        showToast('Please select a source meal for leftovers', 'warning');
        return;
      }
      const sourceValue = (typeof source === 'string') ? source : source.value;
      const sourceRecipeId = source.recipeId || '';
      const sourceMealTitle = source.title || '';
      const match = sourceValue.match(/^(\d{4}-\d{2}-\d{2})\s+(\w+)\s+[—–-]\s+(.+)$/);
      const sourceDate = match ? match[1] : '';
      const sourceSlot = match ? match[2] : '';
      const updatedMeal = {
        RecipeId: sourceRecipeId,
        Title: sourceMealTitle,
        UseLeftovers: true,
        From: sourceValue
      };
      const res = await upsertUserMeal(date, slot, updatedMeal, mealId);
      if (res && res.ok) {
        await loadPlansIntoUi(PLAN.start, PLAN.days);
        await loadPantry();
        await refreshDashboardIfToday(date);
      } else {
        showToast('Error saving leftovers: ' + (res.error || 'Unknown error'), 'error');
      }
      return;
    }
  });

  safeBind('planGrid', 'click', async (e) => {
    if (e.target.closest('button') || e.target.closest('.meal-actions') || e.target.closest('.card-action-btn')) {
      return;
    }
    const v = e.target.closest('[data-action="planner-view"]');
    const mealLine = e.target.closest('.meal-line[data-rid]');
    if (v && v.dataset.rid) {
      await openRecipeModalView(v.dataset.rid);
      return;
    } else if (mealLine && mealLine.dataset.rid) {
      await openRecipeModalView(mealLine.dataset.rid);
      return;
    }
    const sel = e.target.closest('[data-action="select-meal"]');
    if (sel) {
      openMealPicker(sel.dataset.date, sel.dataset.slot);
      return;
    }
  });

  safeBind('planList', 'toggle', async (e) => {
    if (e.target.tagName === 'DETAILS' && e.target.open) {
      const contentDiv = e.target.querySelector('.pantry-depletion-content');
      if (contentDiv && contentDiv.innerHTML.includes('Loading...')) {
        const date = contentDiv.dataset.date;
        const slot = contentDiv.dataset.slot;
        const rid = contentDiv.dataset.rid;
        if (date && slot && rid) {
          const html = await loadPantryDepletionForMeal(date, slot, rid);
          contentDiv.innerHTML = html;
        }
      }
    }
  }, true);

  safeBind('btnCalSync', 'click', calSync);

  let clearRangeProcessing = false;
  safeBind('btnClearRange', 'click', async (event) => {
    event.stopPropagation();
    event.preventDefault();
    if (clearRangeProcessing) return;
    const start = document.getElementById('clearStart')?.value;
    const end = document.getElementById('clearEnd')?.value;
    const target = document.getElementById('clearUserSelect')?.value;
    const status = document.getElementById('clearStatus');
    if (!start || !end || !status) return;
    const confirmed = confirm(`Are you sure you want to clear meals?`);
    if (!confirmed) return;
    clearRangeProcessing = true;
    status.textContent = 'Clearing...';
    const r = await api('clearMealsByRange', { start, end, userId: target === 'all' ? 'all' : undefined });
    if (r.ok) {
      status.textContent = 'Cleared!';
      await loadPlan();
    } else {
      status.textContent = 'Error: ' + r.error;
    }
    clearRangeProcessing = false;
  });

  let clearAllProcessing = false;
  safeBind('btnClearAll', 'click', async (event) => {
    event.stopPropagation();
    event.preventDefault();
    if (clearAllProcessing) return;
    const status = document.getElementById('clearStatus');
    const target = document.getElementById('clearUserSelect')?.value;
    if (!status) return;
    const confirmed = confirm(`⚠️ FINAL WARNING ⚠️ Clear ALL meals?`);
    if (!confirmed) return;
    clearAllProcessing = true;
    status.textContent = 'Clearing all...';
    const r = await api('clearMealsByRange', { start: '1900-01-01', end: '2099-12-31', userId: target === 'all' ? 'all' : undefined });
    if (r.ok) {
      status.textContent = 'All meals cleared!';
      await loadPlan();
    } else {
      status.textContent = 'Error: ' + r.error;
    }
    clearAllProcessing = false;
  });

  // Shopping list
  safeBind('btnBuildShop', 'click', buildShop);
  safeBind('btnClearShop', 'click', clearShopUi);
  safeBind('btnPrintShopAll', 'click', printShoppingList);
  safeBind('btnSendToPhone', 'click', sendShoppingListToPhones);

  // Print shopping list function
  function printShoppingList() {
    if (!SHOP.groups || SHOP.groups.length === 0) {
      showToast('No shopping list to print', 'warning');
      return;
    }

    // Create printable content
    let printContent = `
          <html>
          <head>
            <title>Shopping List - ${SHOP.start} to ${SHOP.end}</title>
            <style>
              @media print {
                @page { margin: 0.5in; }
              }
              body {
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
                padding: 20px;
                max-width: 800px;
                margin: 0 auto;
              }
              h1 {
                font-size: 24px;
                margin-bottom: 10px;
                border-bottom: 2px solid #333;
                padding-bottom: 10px;
              }
              .date-range {
                color: #666;
                font-size: 14px;
                margin-bottom: 20px;
              }
              .store-section {
                margin-bottom: 30px;
                page-break-inside: avoid;
              }
              .store-name {
                font-size: 18px;
                font-weight: 600;
                background: #f5f5f5;
                padding: 8px 12px;
                border-left: 4px solid #4da3ff;
                margin-bottom: 15px;
              }
              .category-name {
                font-size: 14px;
                font-weight: 600;
                color: #4da3ff;
                margin: 15px 0 8px 0;
                border-bottom: 1px solid #ddd;
                padding-bottom: 4px;
              }
              .item {
                display: flex;
                padding: 6px 0;
                border-bottom: 1px solid #eee;
              }
              .checkbox {
                width: 20px;
                height: 20px;
                border: 2px solid #999;
                border-radius: 3px;
                margin-right: 12px;
                flex-shrink: 0;
              }
              .item-content {
                flex: 1;
              }
              .item-name {
                font-weight: 500;
              }
              .item-qty {
                color: #666;
                font-size: 13px;
              }
              .examples {
                color: #888;
                font-size: 12px;
                margin-top: 2px;
              }
            </style>
          </head>
          <body>
            <h1>🛒 Shopping List</h1>
            <div class="date-range">${SHOP.start} to ${SHOP.end}</div>
        `;

    // Add each store section
    SHOP.groups.forEach(store => {
      const storeName = getStoreNameById(store.StoreId) || (store.StoreId === 'unassigned' ? 'Unassigned' : store.StoreId);

      printContent += `<div class="store-section"><div class="store-name">${escapeHtml(storeName)}</div>`;

      // Group items by category
      const categoriesMap = {};
      const allCategories = new Set();

      store.Items.forEach(item => {
        const cat = item.Category || 'Other';
        const catNorm = String(cat).trim().charAt(0).toUpperCase() + String(cat).trim().slice(1).toLowerCase();
        allCategories.add(catNorm);
        if (!categoriesMap[catNorm]) categoriesMap[catNorm] = [];
        categoriesMap[catNorm].push(item);
      });

      // Sort categories
      const metaCategoriesLower = new Set((META.categories || []).map(c => String(c || '').toLowerCase()));
      const sortedCategories = (META.categories || []).filter(c => c && allCategories.has(c));
      const unknownCategories = [...allCategories].filter(c => !metaCategoriesLower.has(String(c || '').toLowerCase())).sort();
      const finalCategories = [...sortedCategories, ...unknownCategories];

      // Render each category
      finalCategories.forEach(cat => {
        const catItems = categoriesMap[cat] || [];
        printContent += `<div class="category-name">${escapeHtml(cat)}</div>`;

        catItems.forEach(item => {
          const qty = item.QtyNum ? `${item.QtyNum} ${item.Unit || ''}`.trim() : '';
          const examples = (item.Examples || []).join(', ');

          printContent += `
                <div class="item">
                  <div class="checkbox"></div>
                  <div class="item-content">
                    <div class="item-name">${escapeHtml(item.IngredientNorm)}</div>
                    ${qty ? `<div class="item-qty">${escapeHtml(qty)}</div>` : ''}
                    ${examples ? `<div class="examples">${escapeHtml(examples)}</div>` : ''}
                  </div>
                </div>
              `;
        });
      });

      printContent += `</div>`;
    });

    printContent += `</body></html>`;

    // Open print window
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(printContent);
      printWindow.document.close();
      printWindow.focus();
      setTimeout(() => {
        printWindow.print();
      }, 250);
    } else {
      showToast('Pop-up blocked. Please allow pop-ups to print.', 'error');
    }
  }

  // Auto-refresh shopping list when low-stock checkbox is toggled
  document.getElementById('shopIncludeLowStock').addEventListener('change', async () => {
    // Only refresh if there's already a list generated
    if (SHOP.start && SHOP.end) {
      await buildShop();
    }
  });

  // Collection inclusion toggle
  document.getElementById('shopIncludeCollections').addEventListener('change', async (e) => {
    const options = document.getElementById('collectionInclusionOptions');
    options.style.display = e.target.checked ? 'block' : 'none';

    // Populate collections dropdown when first shown
    if (e.target.checked) {
      // Load collections if not already loaded
      if (!COLLECTIONS || COLLECTIONS.length === 0) {
        const res = await api('listCollections', {});
        if (res.ok) {
          COLLECTIONS = res.collections || [];
        }
      }
      populateShoppingCollectionsDropdown();
    }

    // Auto-refresh shopping list when toggled (if list already exists)
    if (SHOP.start && SHOP.end) {
      await buildShop();
    }
  });

  // Auto-refresh shopping list when collection selection changes
  document.getElementById('shopCollectionSelect').addEventListener('change', async () => {
    // Only refresh if collections are enabled and there's already a list generated
    const includeCollections = document.getElementById('shopIncludeCollections').checked;
    if (includeCollections && SHOP.start && SHOP.end) {
      await buildShop();
    }
  });

  // Store filter dropdown for shopping list
  document.getElementById('shopStoreFilter').addEventListener('change', (e) => {
    SHOP.storeFilter = e.target.value;
    renderShop_(SHOP.groups);
  });

  // Pantry
  document.getElementById('pantryFilter').addEventListener('change', loadPantry);
  document.getElementById('pantrySearch').addEventListener('input', loadPantry);

  document.getElementById('btnPantryPrint').addEventListener('click', async () => {
    const q = (document.getElementById('pantrySearch').value || '').trim().toLowerCase();
    const filter = document.getElementById('pantryFilter').value || 'all';
    const res = await api('listPantry', { q });
    if (!res.ok) { showToast('Error loading pantry: ' + (res.error || ''), 'error'); return; }

    let items = res.items || [];

    // Apply filter
    if (filter === 'low') {
      items = items.filter(it => {
        const qty = (it.QtyNum !== null && it.QtyNum !== undefined && String(it.QtyNum) !== '') ? Number(it.QtyNum) : null;
        const threshold = (it.low_stock_threshold !== null && it.low_stock_threshold !== undefined && String(it.low_stock_threshold) !== '') ? Number(it.low_stock_threshold) : null;
        return qty !== null && threshold !== null && Number.isFinite(qty) && Number.isFinite(threshold) && qty <= threshold;
      });
    }

    // Group by category
    const byCategory = {};
    for (const it of items) {
      const cat = it.Category || 'Other';
      if (!byCategory[cat]) byCategory[cat] = [];
      byCategory[cat].push({
        Name: it.Name,
        Qty: (it.QtyNum !== null && it.QtyNum !== undefined && String(it.QtyNum) !== '') ? String(it.QtyNum) + ' ' + (it.Unit || '') : it.QtyText || '',
        Store: getStoreNameById(it.StoreId) || it.StoreId || '',
        Notes: it.Notes || ''
      });
    }

    await window.Foodie.printPantry(byCategory, filter === 'low' ? 'Low Stock Items' : 'Pantry Inventory');
  });

  document.getElementById('btnPantryAdd').addEventListener('click', async () => {
    const r = await pantryModal_({ title: 'Add Pantry Item', initial: {} });
    if (r && r.ok) await loadPantry();
  });

  // PHASE 3.2: Pantry Insights Event Listeners
  document.getElementById('btnTogglePantryInsights').addEventListener('click', togglePantryInsights);

  document.getElementById('btnViewAllPantry').addEventListener('click', filterPantryAll);
  document.getElementById('btnViewLowStock').addEventListener('click', filterPantryLowStock);
  document.getElementById('btnViewExpiring').addEventListener('click', () => {
    document.getElementById('pantryFilter').value = 'all';
    loadPantry();
    document.getElementById('pantryList').scrollIntoView({ behavior: 'smooth', block: 'start' });
  });

  // Delegated event listener for quick restock buttons
  document.getElementById('pantryInsights').addEventListener('click', async (e) => {
    const restockBtn = e.target.closest('[data-action="quick-restock"]');
    if (restockBtn) {
      const itemId = restockBtn.getAttribute('data-item-id');
      if (itemId) {
        await quickRestock(itemId);
      }
      return;
    }

    // Handle pantry edit buttons within insights (delegated)
    const editBtn = e.target.closest('[data-action="pantry-edit"]');
    if (editBtn) {
      const id = String(editBtn.dataset.id || '').trim();
      const cur = (window.__pantryItemsById && id && window.__pantryItemsById[id]) ? window.__pantryItemsById[id] : { ItemId: id };
      const r = await pantryModal_({
        title: 'Edit Pantry Item', initial: {
          ItemId: cur.ItemId || id,
          Name: cur.Name || '',
          QtyNum: (cur.QtyNum === null || cur.QtyNum === undefined) ? null : cur.QtyNum,
          Unit: cur.Unit || '',
          QtyText: cur.QtyText || '',
          Category: cur.Category || '',
          StoreId: cur.StoreId || '',
          Notes: cur.Notes || '',
          low_stock_threshold: (cur.low_stock_threshold === null || cur.low_stock_threshold === undefined) ? '' : cur.low_stock_threshold,
          expiration_date: cur.expiration_date || ''
        }
      });
      if (r && r.ok) await loadPantry();
      return;
    }
  });

  document.getElementById('btnDismissExpiring').addEventListener('click', () => {
    document.getElementById('expiringItemsWidget').style.display = 'none';
  });

  document.getElementById('pantryList').addEventListener('click', async (e) => {
    const ed = e.target.closest('[data-action="pantry-edit"]');
    if (ed) {
      const id = String(ed.dataset.id || '').trim();
      const cur = (window.__pantryItemsById && id && window.__pantryItemsById[id]) ? window.__pantryItemsById[id] : { ItemId: id };
      const r = await pantryModal_({
        title: 'Edit Pantry Item', initial: {
          ItemId: cur.ItemId || id,
          Name: cur.Name || '',
          QtyNum: (cur.QtyNum === null || cur.QtyNum === undefined) ? null : cur.QtyNum,
          Unit: cur.Unit || '',
          QtyText: cur.QtyText || '',
          Category: cur.Category || '',
          StoreId: cur.StoreId || '',
          Notes: cur.Notes || '',
          low_stock_threshold: (cur.low_stock_threshold === null || cur.low_stock_threshold === undefined) ? '' : cur.low_stock_threshold,
          expiration_date: cur.expiration_date || ''
        }
      });
      if (r && r.ok) await loadPantry();
      return;
    }
    const del = e.target.closest('[data-action="pantry-del"]');
    if (del) {
      const id = del.dataset.id;
      if (!id) return;
      if (!confirm('Delete pantry item?')) return;
      await api('deletePantryItem', { itemId: id });
      await loadPantry();
      return;
    }
  });

  // ========== GOOGLE CALENDAR SETUP ==========
  function initGoogleCalendarUI() {
    const btnAuthorize = document.getElementById('btnGoogleAuthorize');
    const btnSubmitCode = document.getElementById('btnGoogleAuthSubmit');
    const inputCode = document.getElementById('googleAuthCode');
    const setupSection = document.getElementById('googleCalSetup');

    // PKCE Flow: Step 1 - Open Auth URL
    if (btnAuthorize) {
      btnAuthorize.disabled = false; // Always enabled now (no credentials file needed)
      btnAuthorize.onclick = async () => {
        const res = await api('google-login');
        if (res.ok) {
          document.getElementById('googleAuthCodeRow').style.display = 'flex';
          inputCode.focus();
          showToast('Browser opened. Please paste the code below.', 'info');
        } else {
          showToast(res.error, 'error');
        }
      };
    }

    // PKCE Flow: Step 2 - Submit Code
    if (btnSubmitCode) {
      btnSubmitCode.onclick = async () => {
        const code = inputCode.value.trim();
        if (!code) return;

        btnSubmitCode.disabled = true;
        btnSubmitCode.textContent = 'Verifying...';

        const res = await api('google-submit-code', code);
        if (res.ok) {
          showToast('Google Calendar Connected!', 'success');
          setupSection.style.display = 'none';
          checkGoogleCalStatus(); // Refresh status
        } else {
          showToast(res.error, 'error');
          btnSubmitCode.disabled = false;
          btnSubmitCode.textContent = 'Complete Authorization';
        }
      };
    }

    // Hide the old file upload section if it exists
    const fileUploadRow = document.getElementById('googleCredentialsFile')?.closest('.row');
    if (fileUploadRow) fileUploadRow.style.display = 'none';
  }
  initGoogleCalendarUI(); // Call the function to set up the UI

  // Stores
  const btnReloadStores = document.getElementById('btnReloadStores');
  if (btnReloadStores) {
    btnReloadStores.addEventListener('click', loadStores);
  }

  const btnAddStore = document.getElementById('btnAddStore');
  if (btnAddStore) {
    btnAddStore.addEventListener('click', async () => {
      const nameInput = document.getElementById('newStoreName');
      const priorityInput = document.getElementById('newStorePriority');
      const status = document.getElementById('storeStatus');
      const name = (nameInput?.value || '').trim();
      const priority = Number(priorityInput?.value || 10);

      if (!name) {
        if (status) status.textContent = 'Enter a store name.';
        return;
      }
      if (status) status.textContent = 'Adding...';

      const res = await api('addStore', { name, priority });
      if (res.ok) {
        if (nameInput) nameInput.value = '';
        if (status) status.textContent = 'Store added!';
        await loadStores();
      } else {
        if (status) status.textContent = `Error: ${res.error || ''}`;
      }
    });
  }

  // Store list delete handler
  document.getElementById('storeList').addEventListener('click', async (e) => {
    const del = e.target.closest('[data-action="store-delete"]');
    if (del) {
      const storeId = del.dataset.storeid;
      const storeName = del.dataset.storename;
      if (!confirm(`Delete store "${storeName}"? This may affect ingredients assigned to this store.`)) return;
      const res = await api('deleteStore', { storeId });
      if (!res.ok) { document.getElementById('storeStatus').textContent = `Error: ${res.error || ''}`; return; }
      document.getElementById('storeStatus').textContent = `Store "${storeName}" deleted.`;
      await loadStores();
      return;
    }
  });

  // Admin: Export/Import
  const btnExportData = document.getElementById('btnExportData');
  if (btnExportData) {
    btnExportData.addEventListener('click', async () => {
      const status = document.getElementById('adminStatus');
      if (status) status.textContent = 'Exporting...';
      const res = await window.Foodie.exportData();
      if (!res.ok) {
        if (status) status.textContent = `Error: ${res.error || ''}`;
        return;
      }
      if (status) status.textContent = 'Export complete.';
      setTimeout(() => { if (status) status.textContent = ''; }, 3000);
    });
  }

  const btnImportData = document.getElementById('btnImportData');
  if (btnImportData) {
    btnImportData.addEventListener('click', async () => {
      if (!confirm('Import will replace your current data. Continue?')) return;
      const status = document.getElementById('adminStatus');
      if (status) status.textContent = 'Importing...';
      const res = await window.Foodie.importData();
      if (!res.ok) {
        if (status) status.textContent = `Error: ${res.error || ''}`;
        return;
      }
      if (status) status.textContent = 'Import complete. Reloading...';
      // Reload page to pick up new data
      setTimeout(() => { window.location.reload(); }, 1500);
    });
  }

  // ========== PHASE 6.1: Backup System Handlers ==========

  // Note: loadBackupStatus and loadBackupList are defined at the top of the file

  // Create manual backup
  document.getElementById('btnCreateBackup').addEventListener('click', async (e) => {
    const btn = e.currentTarget;
    const statusEl = document.getElementById('backupStatus');

    setLoading(btn, true, 'Creating backup...');
    statusEl.textContent = 'Creating backup...';

    try {
      const res = await window.Foodie.backupCreate();
      setLoading(btn, false);

      if (res.ok) {
        statusEl.textContent = `✅ Backup created: ${res.fileName}`;
        showToast(`Backup created successfully: ${res.fileName}`, 'success');
        await loadBackupStatus();

        setTimeout(() => {
          statusEl.textContent = '';
        }, 5000);
      } else {
        statusEl.textContent = `❌ Error: ${res.error}`;
        showToast(`Backup failed: ${res.error}`, 'error');
      }
    } catch (e) {
      setLoading(btn, false);
      statusEl.textContent = `❌ Error: ${e.message}`;
      showToast(`Backup failed: ${e.message}`, 'error');
    }
  });

  // Refresh backup status
  document.getElementById('btnRefreshBackupStatus').addEventListener('click', async () => {
    await loadBackupStatus();
    showToast('Backup status refreshed', 'info');
  });

  // Restore from backup (global function for inline onclick)
  window.restoreBackup = async function (backupPath, fileName) {
    if (!confirm(`Are you sure you want to restore from this backup?\n\n${fileName}\n\nYour current data will be backed up as a safety measure before restoring.`)) {
      return;
    }

    document.getElementById('backupStatus').textContent = 'Restoring backup...';

    try {
      const res = await window.Foodie.backupRestore(backupPath);

      if (res.ok) {
        showToast('Backup restored successfully. Reloading app...', 'success');
        document.getElementById('backupStatus').textContent = '✅ Restore complete. Reloading...';

        // Reload app to pick up restored data
        setTimeout(() => {
          window.location.reload();
        }, 2000);
      } else {
        showToast(`Restore failed: ${res.error}`, 'error');
        document.getElementById('backupStatus').textContent = `❌ Restore failed: ${res.error}`;
      }
    } catch (e) {
      showToast(`Restore failed: ${e.message}`, 'error');
      document.getElementById('backupStatus').textContent = `❌ Error: ${e.message}`;
    }
  };

  // Delete backup (global function for inline onclick)
  window.deleteBackup = async function (backupPath, fileName) {
    if (!confirm(`Are you sure you want to delete this backup?\n\n${fileName}\n\nThis action cannot be undone.`)) {
      return;
    }

    try {
      const res = await window.Foodie.backupDelete(backupPath);

      if (res.ok) {
        showToast(`Backup deleted: ${fileName}`, 'success');
        await loadBackupList();
      } else {
        showToast(`Delete failed: ${res.error}`, 'error');
      }
    } catch (e) {
      showToast(`Delete failed: ${e.message}`, 'error');
    }
  };

  // Note: formatFileSize and formatTimeAgo are defined at the top of the file as formatBytes and formatTimeAgo

  // ========== END PHASE 6.1 ==========

  // Admin: Fix all recipe categories
  const btnFixCategories = document.getElementById('btnFixCategories');
  if (btnFixCategories) {
    btnFixCategories.addEventListener('click', async (e) => {
      if (!confirm('This will re-categorize all ingredients in all recipes and save them to the database. Continue?')) return;

      const btn = e.currentTarget;
      const statusEl = document.getElementById('fixCategoriesStatus');
      setLoading(btn, true, 'Processing...');
      statusEl.textContent = 'Loading recipes...';

      try {
        // Get all recipes
        const res = await api('listRecipesAll', {});
        if (!res.ok) throw new Error(res.error || 'Failed to load recipes');

        const recipes = res.recipes || [];
        if (!recipes.length) {
          statusEl.textContent = 'No recipes found.';
          return;
        }

        let totalFixed = 0;
        let totalErrors = 0;

        for (const recipe of recipes) {
          statusEl.textContent = `Processing ${totalFixed + 1}/${recipes.length}: ${recipe.Title}...`;

          // Load ingredients for this recipe
          const ingRes = await api('listRecipeIngredients', { recipeId: recipe.RecipeId });
          if (!ingRes.ok) {
            console.error(`Failed to load ingredients for ${recipe.RecipeId}:`, ingRes.error);
            totalErrors++;
            continue;
          }

          const items = ingRes.items || [];
          if (!items.length) {
            // Recipe has no ingredients, skip
            continue;
          }

          let categorized = false;

          // Categorize each ingredient
          for (let i = 0; i < items.length; i++) {
            const item = items[i];
            const name = item.IngredientRaw || item.IngredientNorm;
            if (!name || name.trim().length < 2) continue;

            const catRes = await api('classifyIngredient', { name });
            console.log(`[btnFixCategories] Classify "${name}":`, catRes.ok ? catRes.category : `Error: ${catRes.error}`);

            if (catRes.ok && catRes.category) {
              items[i].Category = catRes.category;
              categorized = true;
            } else {
              items[i].Category = items[i].Category || 'Other';
            }

            // Small delay to avoid overwhelming the API
            await new Promise(r => setTimeout(r, 5));
          }

          // Only save if we actually categorized something
          if (!categorized) {
            console.log(`[btnFixCategories] No new categories for "${recipe.Title}", skipping save.`);
            continue;
          }

          console.log(`[btnFixCategories] Saving "${recipe.Title}" with updated categories...`);
          // Save back to database - MUST include full recipe object with Title
          const saveRes = await api('upsertRecipeWithIngredients', {
            recipe: {
              RecipeId: recipe.RecipeId,
              Title: recipe.Title,
              URL: recipe.URL || '',
              Cuisine: recipe.Cuisine || '',
              MealType: recipe.MealType || 'Any',
              Notes: recipe.Notes || '',
              Instructions: recipe.Instructions || '',
              Image_Name: recipe.Image_Name || ''
            },
            items: items.map(x => ({
              IngredientNorm: x.IngredientNorm || '',
              IngredientRaw: x.IngredientRaw || '',
              Notes: x.Notes || '',
              QtyNum: (x.QtyNum === '' || x.QtyNum === null || x.QtyNum === undefined) ? null : Number(x.QtyNum),
              QtyText: x.QtyText || '',
              StoreId: x.StoreId || '',
              Unit: x.Unit || '',
              Category: x.Category || ''
            }))
          });

          if (saveRes.ok) {
            totalFixed++;
          } else {
            console.error(`Failed to save ${recipe.RecipeId}:`, saveRes.error);
            totalErrors++;
          }

          // Small delay between recipes
          await new Promise(r => setTimeout(r, 10));
        }

        statusEl.textContent = `Done! Fixed ${totalFixed} recipe(s).${totalErrors > 0 ? ` ${totalErrors} errors.` : ''}`;

        // Refresh the recipes list
        await resetAndLoadRecipes();

      } catch (e) {
        statusEl.textContent = `Error: ${e.message}`;
      } finally {
        setLoading(btn, false);
      }
    });
  }

  // Admin: Download all recipe images
  const btnDownloadAllImages = document.getElementById('btnDownloadAllImages');
  if (btnDownloadAllImages) {
    btnDownloadAllImages.addEventListener('click', async (e) => {
      if (!confirm('This will download all recipe images from their URLs and save them locally. This may take several minutes. Continue?')) return;

      const btn = e.currentTarget;
      const statusEl = document.getElementById('downloadImagesStatus');
      setLoading(btn, true, 'Downloading...');
      statusEl.textContent = 'Starting download...';

      try {
        const res = await api('downloadAllRecipeImages', {});
        if (!res.ok) throw new Error(res.error || 'Failed to download images');

        const { total, downloaded, skipped, failed, errors } = res;

        let message = `✓ Downloaded ${downloaded} image(s).`;
        if (skipped > 0) message += ` Skipped ${skipped} (already local or invalid).`;
        if (failed > 0) message += ` Failed: ${failed}.`;

        statusEl.textContent = message;

        if (errors && errors.length > 0) {
          console.error('[Download Images] Errors:', errors);
        }

        // Refresh the recipes list to show updated images
        await resetAndLoadRecipes();

        showToast(`Downloaded ${downloaded} recipe images`, 'success');

      } catch (e) {
        statusEl.textContent = `Error: ${e.message}`;
        showToast(`Failed to download images: ${e.message}`, 'error');
      } finally {
        setLoading(btn, false);
      }
    });
  }

  // PHASE 3.3: Smart Defaults Management Event Listeners
  document.getElementById('btnViewSmartDefaults').addEventListener('click', () => {
    showSmartDefaults();
  });

  document.getElementById('btnResetSmartDefaults').addEventListener('click', () => {
    resetSmartDefaults();
  });

  // NOTE: Keyboard shortcuts are handled by the main handler in KEYBOARD SHORTCUTS section
  // See: Cmd/Ctrl+K (command palette), Cmd/Ctrl+N (new recipe), Cmd/Ctrl+P (print)

  // ========== PHASE 3: CALENDAR GRID VIEW ==========

  document.getElementById('btnPlanViewList').addEventListener('click', () => {
    PLAN.viewMode = 'list';
    document.getElementById('planList').style.display = '';
    document.getElementById('planGrid').style.display = 'none';
    document.getElementById('btnPlanViewList').style.borderColor = 'rgba(77,163,255,0.55)';
    document.getElementById('btnPlanViewGrid').style.borderColor = 'rgba(255,255,255,0.12)';

    // Collapse all details elements when switching to list view
    document.querySelectorAll('#planList details').forEach(d => d.open = false);
  });

  document.getElementById('btnPlanViewGrid').addEventListener('click', () => {
    PLAN.viewMode = 'grid';
    document.getElementById('planList').style.display = 'none';
    document.getElementById('planGrid').style.display = '';
    document.getElementById('btnPlanViewList').style.borderColor = 'rgba(255,255,255,0.12)';
    document.getElementById('btnPlanViewGrid').style.borderColor = 'rgba(77,163,255,0.55)';
    renderPlanGrid();
  });

  // ========== PHASE 3: BULK MEAL OPERATIONS ==========

  document.getElementById('btnCopyWeekForward').addEventListener('click', async (e) => {
    const start = PLAN.start;
    if (!start) { showToast('Load a plan range first', 'warning'); return; }

    const btn = e.currentTarget;
    const statusEl = document.getElementById('copyWeekStatus');
    setLoading(btn, true, 'Copying...');
    statusEl.textContent = 'Copying...';

    try {
      // Phase 4.5.7: Get active user
      const activeUserRes = await api('getActiveUser');
      const userId = (activeUserRes.ok && activeUserRes.userId) ? activeUserRes.userId : null;

      if (!userId) {
        statusEl.textContent = 'No active user set';
        setLoading(btn, false);
        return;
      }

      for (let i = 0; i < 7; i++) {
        const srcDate = addDays(start, i);
        const dstDate = addDays(start, i + 7);
        const srcPlan = PLAN.plansByDate[srcDate];
        if (!srcPlan) continue;

        for (const slot of ['Breakfast', 'Lunch', 'Dinner']) {
          const mealsArray = Array.isArray(srcPlan[slot]) ? srcPlan[slot] : (srcPlan[slot] ? [srcPlan[slot]] : []);
          for (const meal of mealsArray) {
            if (!meal) continue;
            await api('upsertUserPlanMeal', {
              userId,
              date: dstDate,
              slot,
              meal: {
                RecipeId: meal.RecipeId || '',
                Title: meal.Title || ''
              }
            });
          }
        }
      }

      const endDate = addDays(start, daysInclusive(start, PLAN.start + 13));
      await loadPlansIntoUi(start, daysInclusive(start, endDate));
      statusEl.textContent = 'Week copied!';
      setTimeout(() => { statusEl.textContent = ''; }, 3000);
    } catch (e) {
      statusEl.textContent = `Error: ${e.message}`;
    } finally {
      setLoading(btn, false);
    }
  });

  document.getElementById('btnCopyWeekBack').addEventListener('click', async (e) => {
    const start = PLAN.start;
    if (!start) { showToast('Load a plan range first', 'warning'); return; }

    const btn = e.currentTarget;
    const statusEl = document.getElementById('copyWeekStatus');
    setLoading(btn, true, 'Copying...');
    statusEl.textContent = 'Copying...';

    try {
      // Phase 4.5.7: Get active user
      const activeUserRes = await api('getActiveUser');
      const userId = (activeUserRes.ok && activeUserRes.userId) ? activeUserRes.userId : null;

      if (!userId) {
        statusEl.textContent = 'No active user set';
        setLoading(btn, false);
        return;
      }

      for (let i = 0; i < 7; i++) {
        const srcDate = addDays(start, i);
        const dstDate = addDays(start, i - 7);
        const srcPlan = PLAN.plansByDate[srcDate];
        if (!srcPlan) continue;

        for (const slot of ['Breakfast', 'Lunch', 'Dinner']) {
          const mealsArray = Array.isArray(srcPlan[slot]) ? srcPlan[slot] : (srcPlan[slot] ? [srcPlan[slot]] : []);
          for (const meal of mealsArray) {
            if (!meal) continue;
            await api('upsertUserPlanMeal', {
              userId,
              date: dstDate,
              slot,
              meal: {
                RecipeId: meal.RecipeId || '',
                Title: meal.Title || ''
              }
            });
          }
        }
      }

      await loadPlansIntoUi(addDays(start, -7), daysInclusive(addDays(start, -7), start));
      statusEl.textContent = 'Week copied!';
      setTimeout(() => { statusEl.textContent = ''; }, 3000);
    } catch (e) {
      statusEl.textContent = `Error: ${e.message}`;
    } finally {
      setLoading(btn, false);
    }
  });

  document.getElementById('btnAutoFillBreakfast').addEventListener('click', async (e) => {
    const recipeId = document.getElementById('autoFillBreakfastRecipe').value;
    if (!recipeId) { showToast('Select a recipe first', 'warning'); return; }

    const recipe = RECIPES.find(r => r.RecipeId === recipeId);
    if (!recipe) { showToast('Recipe not found', 'error'); return; }

    const btn = e.currentTarget;
    const statusEl = document.getElementById('autoFillStatus');
    setLoading(btn, true, 'Filling...');
    statusEl.textContent = 'Filling...';

    try {
      // Phase 4.5.7: Get active user
      const activeUserRes = await api('getActiveUser');
      const userId = (activeUserRes.ok && activeUserRes.userId) ? activeUserRes.userId : null;

      if (!userId) {
        statusEl.textContent = 'No active user set';
        setLoading(btn, false);
        return;
      }

      let filled = 0;
      for (const dateKey in PLAN.plansByDate) {
        const plan = PLAN.plansByDate[dateKey];
        const breakfastArray = Array.isArray(plan.Breakfast) ? plan.Breakfast : (plan.Breakfast ? [plan.Breakfast] : []);
        if (breakfastArray.length === 0) {
          await api('upsertUserPlanMeal', {
            userId,
            date: dateKey,
            slot: 'Breakfast',
            meal: {
              RecipeId: recipe.RecipeId,
              Title: recipe.Title
            }
          });
          filled++;
        }
      }

      await loadPlansIntoUi(PLAN.start, PLAN.days);
      statusEl.textContent = `Filled ${filled} breakfasts!`;
      setTimeout(() => { statusEl.textContent = ''; }, 3000);
    } catch (e) {
      statusEl.textContent = `Error: ${e.message}`;
    } finally {
      setLoading(btn, false);
    }
  });

  document.getElementById('btnSaveMealPattern').addEventListener('click', () => {
    if (!PLAN.start) { showToast('Load a plan range first', 'warning'); return; }

    const pattern = [];
    for (let i = 0; i < 7; i++) {
      const dateKey = addDays(PLAN.start, i);
      const plan = PLAN.plansByDate[dateKey] || {};
      pattern.push({
        Breakfast: plan.Breakfast || null,
        Lunch: plan.Lunch || null,
        Dinner: plan.Dinner || null
      });
    }

    try {
      localStorage.setItem(MEAL_PATTERN_KEY, JSON.stringify(pattern));
      document.getElementById('templateStatus').textContent = 'Template saved!';
      setTimeout(() => { document.getElementById('templateStatus').textContent = ''; }, 3000);
    } catch (e) {
      showToast('Failed to save template: ' + e.message, 'error');
    }
  });

  document.getElementById('btnLoadMealPattern').addEventListener('click', async () => {
    let pattern;
    try {
      pattern = JSON.parse(localStorage.getItem(MEAL_PATTERN_KEY));
      if (!pattern || !Array.isArray(pattern)) throw new Error('No template found');
    } catch (e) {
      showToast('No saved template found', 'info');
      return;
    }

    if (!PLAN.start) { showToast('Load a plan range first', 'warning'); return; }

    const statusEl = document.getElementById('templateStatus');
    statusEl.textContent = 'Loading template...';

    try {
      for (let i = 0; i < pattern.length && i < 7; i++) {
        const dateKey = addDays(PLAN.start, i);
        const day = pattern[i];

        for (const slot of ['Breakfast', 'Lunch', 'Dinner']) {
          if (day[slot]) {
            await api('upsertPlanMeal', {
              date: dateKey,
              slot,
              recipeId: day[slot].RecipeId || '',
              title: day[slot].Title || ''
            });
          }
        }
      }

      await loadPlansIntoUi(PLAN.start, PLAN.days);
      statusEl.textContent = 'Template loaded!';
      setTimeout(() => { statusEl.textContent = ''; }, 3000);
    } catch (e) {
      statusEl.textContent = `Error: ${e.message}`;
    }
  });

  // ========== PHASE 3: LEFTOVERS PICKER ==========

  document.getElementById('mpUseLeftovers').addEventListener('click', () => {
    openLeftoverPicker();
  });

  document.getElementById('btnLeftoverPickerClose').addEventListener('click', () => {
    document.getElementById('leftoverPickerBack').style.display = 'none';
  });

  document.getElementById('leftoverPickerBack').addEventListener('click', async (e) => {
    const pick = e.target.closest('[data-action="pick-leftover"]');
    if (pick) {
      const title = pick.dataset.title;
      const fromDate = pick.dataset.fromdate;
      const fromSlot = pick.dataset.fromslot;

      if (MP.open && MP.date && MP.slot) {
        const res = await api('upsertPlanMeal', {
          date: MP.date,
          slot: MP.slot,
          recipeId: '',
          title,
          useLeftovers: true,
          from: `${fromDate} ${fromSlot}`
        });

        if (res.ok) {
          await loadPlansIntoUi(PLAN.start, PLAN.days);
          document.getElementById('leftoverPickerBack').style.display = 'none';
          closeMealPicker();
        }
      }
      return;
    }
  });

  // ========== COLLECTION RECIPE PICKER FOR MEAL PLANNER ==========

  document.getElementById('mpUseCollection').addEventListener('click', () => {
    openCollectionRecipePicker();
  });

  document.getElementById('btnCollectionRecipePickerClose').addEventListener('click', () => {
    document.getElementById('collectionRecipePickerBack').style.display = 'none';
  });

  document.getElementById('collectionRecipePickerSelect').addEventListener('change', async (e) => {
    const collectionId = e.target.value;
    await loadCollectionRecipesForPicker(collectionId);
  });

  document.getElementById('collectionRecipePickerBack').addEventListener('click', async (e) => {
    const pick = e.target.closest('[data-action="pick-collection-recipe"]');
    if (pick) {
      const recipeId = pick.dataset.rid;
      const title = pick.dataset.title;

      if (MP.open && MP.date && MP.slot && recipeId) {
        const res = await api('upsertPlanMeal', {
          date: MP.date,
          slot: MP.slot,
          recipeId,
          title
        });

        if (res.ok) {
          await loadPlansIntoUi(PLAN.start, PLAN.days);
          document.getElementById('collectionRecipePickerBack').style.display = 'none';
          closeMealPicker();
        }
      }
      return;
    }
  });

  // ========== PHASE 3: RECIPE COLLECTIONS ==========

  document.getElementById('btnCreateCollection').addEventListener('click', () => {
    openCollectionModal();
  });

  document.getElementById('btnCollectionModalClose').addEventListener('click', () => {
    document.getElementById('collectionModalBack').style.display = 'none';
  });

  document.getElementById('btnSaveCollection').addEventListener('click', async () => {
    const name = document.getElementById('collectionName').value.trim();
    const description = document.getElementById('collectionDescription').value.trim();

    if (!name) {
      document.getElementById('collectionModalStatus').textContent = 'Name is required';
      return;
    }

    const res = await api('upsertCollection', {
      collectionId: CURRENT_COLLECTION_ID,
      name,
      description
    });

    if (res.ok) {
      await loadCollections();
      document.getElementById('collectionModalBack').style.display = 'none';
      document.getElementById('collectionModalStatus').textContent = '';
    } else {
      document.getElementById('collectionModalStatus').textContent = res.error || 'Save failed';
    }
  });

  document.getElementById('btnDeleteCollection').addEventListener('click', async () => {
    if (!CURRENT_COLLECTION_ID) return;
    if (!confirm('Delete this collection? Recipes will not be deleted.')) return;

    const res = await api('deleteCollection', { collectionId: CURRENT_COLLECTION_ID });
    if (res.ok) {
      await loadCollections();
      document.getElementById('collectionModalBack').style.display = 'none';
    }
  });

  document.getElementById('collectionFilter').addEventListener('change', async (e) => {
    const collectionId = e.target.value;
    if (collectionId) {
      await loadCollectionRecipes(collectionId);
    } else {
      document.getElementById('collectionRecipesList').innerHTML = '<div class="muted">Select a collection to view recipes</div>';
    }
  });

  // Import Recipe Modal
  document.getElementById('btnImportRecipeModalClose').addEventListener('click', closeImportRecipeModal);
  document.getElementById('btnFetchRecipe').addEventListener('click', fetchRecipeFromUrl);
  document.getElementById('btnSaveImportedRecipe').addEventListener('click', saveImportedRecipe);
  document.getElementById('btnCancelImport').addEventListener('click', closeImportRecipeModal);

  // Smart Weekly Meal Planner
  document.getElementById('btnGenerateWeek').addEventListener('click', generateSmartWeek);
  document.getElementById('btnMealPlannerSettings').addEventListener('click', openMealPlannerPrefs);
  document.getElementById('btnMealPlannerPrefsClose').addEventListener('click', closeMealPlannerPrefs);
  document.getElementById('btnSaveMealPlannerPrefs').addEventListener('click', saveMealPlannerPrefsFromModal);

  // Toggle recipe repeat options visibility
  document.getElementById('prefAvoidRecipeRepeat').addEventListener('change', (e) => {
    const options = document.getElementById('recipeRepeatOptions');
    options.style.display = e.target.checked ? 'block' : 'none';
  });

  // Admin tab - Cuisine Management (delegate event listeners on cuisineManageList)
  document.getElementById('cuisineManageList').addEventListener('click', async (e) => {
    const clearBtn = e.target.closest('[data-action="clear-cuisine"]');
    const renameBtn = e.target.closest('[data-action="rename-cuisine"]');
    const deleteBtn = e.target.closest('[data-action="delete-cuisine"]');

    if (clearBtn) {
      const cuisineName = clearBtn.dataset.cuisine;
      await clearCuisineFromRecipes(cuisineName);
    } else if (renameBtn) {
      const cuisineName = renameBtn.dataset.cuisine;
      await renameCuisine(cuisineName);
    } else if (deleteBtn) {
      const cuisineName = deleteBtn.dataset.cuisine;
      deleteCuisineFromList(cuisineName);
    }
  });

  // Add cuisine button
  document.getElementById('btnAddCuisine').addEventListener('click', addCuisine);

  // Allow Enter key to add cuisine
  document.getElementById('newCuisineName').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      addCuisine();
    }
  });

  // Assign to Planner Modal
  document.getElementById('btnAssignToPlannerClose').addEventListener('click', () => {
    document.getElementById('assignToPlannerBack').style.display = 'none';
  });

  document.getElementById('btnConfirmAssignToPlanner').addEventListener('click', async () => {
    await confirmAssignToPlanner();
  });

  // Shopping List Preview Modal
  document.getElementById('btnShoppingListPreviewClose').addEventListener('click', () => {
    document.getElementById('shoppingListPreviewBack').style.display = 'none';
  });

  document.getElementById('btnCancelPrintShopping').addEventListener('click', () => {
    document.getElementById('shoppingListPreviewBack').style.display = 'none';
  });

  document.getElementById('btnConfirmPrintShopping').addEventListener('click', async () => {
    await confirmPrintShoppingList();
  });

  document.getElementById('btnAssignRecipesModalClose').addEventListener('click', () => {
    document.getElementById('assignRecipesModalBack').style.display = 'none';
  });

  document.getElementById('assignRecipesSearch').addEventListener('input', debounce((e) => {
    console.log('Search input changed:', e.target.value);
    renderAssignRecipesList(e.target.value.trim().toLowerCase());
  }, 300));

  // ========== PHASE 2.5: Collection Main Dish Toggle ==========
  document.getElementById('collectionsList').addEventListener('change', async (e) => {
    if (e.target.classList.contains('collection-role-select')) {
      const rid = e.target.dataset.rid;
      const isMain = e.target.value === '1';
      console.log('[Collection] Setting recipe', rid, 'isMain:', isMain);

      await api('setMainDishInCollection', {
        collectionId: CURRENT_COLLECTION_ID,
        recipeId: rid,
        isMain: isMain
      });

      // Refresh valid main dish state
      // Re-render to show updated state (e.g. if we enforce only 1 main)
      // For now, simpler to just let it save.
    }
  });

  document.getElementById('assignRecipesModalBack').addEventListener('click', async (e) => {
    const toggle = e.target.closest('[data-action="toggle-recipe-in-collection"]');
    if (toggle) {
      const recipeId = toggle.dataset.rid;
      const isInCollection = toggle.dataset.incollection === 'true';

      let res;
      if (isInCollection) {
        res = await api('removeRecipeFromCollection', {
          collectionId: CURRENT_COLLECTION_ID,
          recipeId
        });
      } else {
        res = await api('addRecipeToCollection', {
          collectionId: CURRENT_COLLECTION_ID,
          recipeId
        });
      }

      if (res.ok) {
        await loadCollectionRecipes(CURRENT_COLLECTION_ID);
        renderAssignRecipesList(document.getElementById('assignRecipesSearch').value.trim().toLowerCase());
      }
    }
  });

  document.getElementById('collectionsList').addEventListener('click', async (e) => {
    // Toggle dropdown menu for assign button
    const assignBtn = e.target.closest('.collection-assign-btn');
    if (assignBtn) {
      e.preventDefault();
      e.stopPropagation();
      console.log('[Collection Dropdown] Assign button clicked (Global Portal)');
      const cid = assignBtn.dataset.cid;
      const cname = assignBtn.dataset.cname;

      // Use new global portal function
      if (typeof openGlobalCollectionDropdown === 'function') {
        openGlobalCollectionDropdown(assignBtn, cid, cname);
      } else {
        console.error('openGlobalCollectionDropdown not found!');
      }
      return;
    }

    const edit = e.target.closest('[data-action="edit-collection"]');
    if (edit) {
      const collectionId = edit.dataset.cid;
      const res = await api('getCollection', { collectionId });
      if (res.ok) {
        openCollectionModal(res.collection);
      }
      return;
    }

    const assign = e.target.closest('[data-action="assign-recipes"]');
    if (assign) {
      CURRENT_COLLECTION_ID = assign.dataset.cid;
      await openAssignRecipesModal();
      return;
    }

    const shoppingList = e.target.closest('[data-action="collection-shopping-list"]');
    if (shoppingList) {
      const collectionId = shoppingList.dataset.cid;
      await generateCollectionShoppingList(collectionId);
      return;
    }

    const assignToPlanner = e.target.closest('[data-action="assign-collection-to-planner"]');
    if (assignToPlanner) {
      const collectionId = assignToPlanner.dataset.cid;
      const collectionName = assignToPlanner.dataset.cname;
      // Close dropdown menu
      document.querySelectorAll('.collection-assign-menu').forEach(m => m.style.display = 'none');
      await showAssignCollectionFromCollectionsTab(collectionId, collectionName);
      return;
    }

    const assignToDay = e.target.closest('[data-action="assign-collection-to-day"]');
    if (assignToDay) {
      const collectionId = assignToDay.dataset.cid;
      const collectionName = assignToDay.dataset.cname;
      // Close dropdown menu
      document.querySelectorAll('.collection-assign-menu').forEach(m => m.style.display = 'none');
      await showAssignCollectionToDayModal(collectionId, collectionName);
      return;
    }
  });

  // ========== PHASE 2.4: Collection View Toggle ==========
  document.getElementById('viewCollectionsCard').addEventListener('click', () => {
    COLLECTION_VIEW_MODE = 'card';
    document.getElementById('viewCollectionsCard').classList.add('active');
    document.getElementById('viewCollectionsList').classList.remove('active');
    renderCollections();
  });

  document.getElementById('viewCollectionsList').addEventListener('click', () => {
    COLLECTION_VIEW_MODE = 'list';
    document.getElementById('viewCollectionsList').classList.add('active');
    document.getElementById('viewCollectionsCard').classList.remove('active');
    renderCollections();
  });

  // ========== PHASE 2.4: Collection Card Actions ==========
  document.getElementById('collectionsList').addEventListener('click', async (e) => {
    // View collection (card view)
    const viewCollection = e.target.closest('[data-action="view-collection"]');
    if (viewCollection) {
      const collectionId = viewCollection.dataset.cid;
      await loadCollectionRecipes(collectionId);
      // Scroll to collection recipes list to show the recipes
      document.getElementById('collectionRecipesList').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      return;
    }

    // Assign collection to week
    const assignToWeek = e.target.closest('[data-action="assign-collection-to-week"]');
    if (assignToWeek) {
      const collectionId = assignToWeek.dataset.cid;
      const collectionName = assignToWeek.dataset.cname;
      // Close dropdown menu
      document.querySelectorAll('.collection-assign-menu').forEach(m => m.style.display = 'none');
      await showAssignCollectionToWeekModal(collectionId, collectionName);
      return;
    }
  });

  // Close collection assign dropdowns when clicking outside
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.collection-assign-dropdown')) {
      document.querySelectorAll('.collection-assign-menu').forEach(m => m.style.display = 'none');
    }
  });

  // Theme toggle
  document.getElementById('btnThemeToggle').addEventListener('click', () => {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'light' ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', newTheme === 'dark' ? '' : 'light');
    try {
      localStorage.setItem('foodieTheme', newTheme);
    } catch (_) { }
  });

  // Google Calendar setup
  document.getElementById('btnUploadGoogleCreds').addEventListener('click', uploadGoogleCredentials);
  document.getElementById('btnGoogleAuthorize').addEventListener('click', authorizeGoogleCalendar);
  document.getElementById('btnGoogleAuthSubmit').addEventListener('click', submitGoogleAuthCode);
  document.getElementById('btnListGoogleCals').addEventListener('click', listGoogleCalendars);
  document.getElementById('btnGoogleCalSync').addEventListener('click', syncToGoogleCalendar);
  document.getElementById('btnCheckDuplicates').addEventListener('click', checkForDuplicates);
  document.getElementById('btnRevokeGoogleCal').addEventListener('click', revokeGoogleCalendar);

  // Calendar selection change
  document.getElementById('googleCalendarSelect').addEventListener('change', async (e) => {
    const calendarId = e.target.value;
    if (calendarId) {
      await window.Foodie.setGoogleCalendarId(calendarId);
    }
  });

  // ========== PHASE 6.2: EXPORT EVENT LISTENERS ==========

  // Recipe export controls
  document.getElementById('btnSelectAllRecipes').addEventListener('click', selectAllRecipes);
  document.getElementById('btnDeselectAllRecipes').addEventListener('click', deselectAllRecipes);
  document.getElementById('btnExportSelectedRecipes').addEventListener('click', exportSelectedRecipes);

  // PHASE 3.4: Bulk Actions Event Listeners
  document.getElementById('btnBulkAssign').addEventListener('click', bulkAssignRecipes);
  document.getElementById('btnBulkCollection').addEventListener('click', bulkAddToCollection);
  document.getElementById('btnBulkEdit').addEventListener('click', bulkEditRecipes);
  document.getElementById('btnBulkDelete').addEventListener('click', bulkDeleteRecipes);

  // Recipe checkbox delegation
  document.getElementById('recipesList').addEventListener('change', handleRecipeCheckboxChange);

  // Meal plan export
  document.getElementById('btnExportMealPlan').addEventListener('click', exportMealPlan);

  // ========== PHASE 3.1: RECENT ACTIONS EVENT LISTENERS ==========

  // Toggle recent actions panel
  const recentActionsBtn = document.getElementById('recentActionsFloatBtn');
  console.log('recentActionsFloatBtn element:', recentActionsBtn);
  if (recentActionsBtn) {
    recentActionsBtn.addEventListener('click', toggleRecentActionsPanel);
    console.log('Added click listener to recentActionsFloatBtn');
  } else {
    console.error('recentActionsFloatBtn not found!');
  }

  // Header action buttons
  const contextualHelpBtn = document.getElementById('contextualHelpBtn');
  if (contextualHelpBtn) {
    contextualHelpBtn.addEventListener('click', openContextualHelp);
  }

  const startTourBtn = document.getElementById('btnStartTour');
  if (startTourBtn) {
    startTourBtn.addEventListener('click', startTour);
  }

  // Clear buttons
  document.getElementById('btnClearRecentRecipes').addEventListener('click', clearRecentRecipes);
  document.getElementById('btnClearRecentMeals').addEventListener('click', clearRecentMeals);

  // Recent item clicks (delegated)
  document.getElementById('recentActionsPanel').addEventListener('click', async (e) => {
    const recentRecipe = e.target.closest('[data-action="open-recent-recipe"]');
    if (recentRecipe) {
      const recipeId = recentRecipe.getAttribute('data-recipe-id');
      if (recipeId) {
        await openRecipeModalView(recipeId);
        document.getElementById('recentActionsPanel').classList.remove('show');
      }
      return;
    }

    const recentMeal = e.target.closest('[data-action="open-recent-meal"]');
    if (recentMeal) {
      const recipeId = recentMeal.getAttribute('data-recipe-id');
      if (recipeId) {
        await openRecipeModalView(recipeId);
        document.getElementById('recentActionsPanel').classList.remove('show');
      }
      return;
    }
  });
}


// ---------- init ----------
// ========== PHASE 3.1: RECENT ACTIONS HISTORY ==========

// Recent actions state (persisted to localStorage)
const RECENT_HISTORY = {
  recipes: [], // { recipeId, title, cuisine, mealType, timestamp }
  meals: [],   // { recipeId, title, date, slot, timestamp }
  maxItems: 10
};

// Load recent history from localStorage
function loadRecentHistory() {
  try {
    const stored = localStorage.getItem('foodieRecentHistory');
    if (stored) {
      const parsed = JSON.parse(stored);
      RECENT_HISTORY.recipes = parsed.recipes || [];
      RECENT_HISTORY.meals = parsed.meals || [];
    }
  } catch (e) {
    console.error('Failed to load recent history:', e);
  }
}

// Save recent history to localStorage
function saveRecentHistory() {
  try {
    localStorage.setItem('foodieRecentHistory', JSON.stringify({
      recipes: RECENT_HISTORY.recipes,
      meals: RECENT_HISTORY.meals
    }));
  } catch (e) {
    console.error('Failed to save recent history:', e);
  }
}

// Add recipe to recent history
function addToRecentRecipes(recipeId, title, cuisine, mealType) {
  if (!recipeId || !title) return;

  // Remove if already exists
  RECENT_HISTORY.recipes = RECENT_HISTORY.recipes.filter(r => r.recipeId !== recipeId);

  // Add to front
  RECENT_HISTORY.recipes.unshift({
    recipeId,
    title,
    cuisine: cuisine || '',
    mealType: mealType || '',
    timestamp: new Date().toISOString()
  });

  // Keep only last N items
  if (RECENT_HISTORY.recipes.length > RECENT_HISTORY.maxItems) {
    RECENT_HISTORY.recipes = RECENT_HISTORY.recipes.slice(0, RECENT_HISTORY.maxItems);
  }

  saveRecentHistory();
  renderRecentHistory();
}

// Add meal assignment to recent history
function addToRecentMeals(recipeId, title, date, slot) {
  if (!recipeId || !title || !date || !slot) return;

  // Create unique key
  const key = `${date}-${slot}`;

  // Remove if same slot exists
  RECENT_HISTORY.meals = RECENT_HISTORY.meals.filter(m => `${m.date}-${m.slot}` !== key);

  // Add to front
  RECENT_HISTORY.meals.unshift({
    recipeId,
    title,
    date,
    slot,
    timestamp: new Date().toISOString()
  });

  // Keep only last N items
  if (RECENT_HISTORY.meals.length > RECENT_HISTORY.maxItems) {
    RECENT_HISTORY.meals = RECENT_HISTORY.meals.slice(0, RECENT_HISTORY.maxItems);
  }

  saveRecentHistory();
  renderRecentHistory();
}

// Format relative time
function formatRelativeTime(timestamp) {
  const now = new Date();
  const then = new Date(timestamp);
  const diffMs = now - then;
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffSec < 60) return 'Just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHour < 24) return `${diffHour}h ago`;
  if (diffDay < 7) return `${diffDay}d ago`;
  return then.toLocaleDateString();
}

// Render recent history in panel
function renderRecentHistory() {
  // Render recent recipes
  const recipesContainer = document.getElementById('recentRecipesList');
  if (!recipesContainer) return;

  if (RECENT_HISTORY.recipes.length === 0) {
    recipesContainer.innerHTML = '<div class="recent-empty">No recent recipes</div>';
  } else {
    recipesContainer.innerHTML = RECENT_HISTORY.recipes.map(r => `
          <div class="recent-item" data-action="open-recent-recipe" data-recipe-id="${escapeAttr(r.recipeId)}">
            <div class="recent-item-title">${escapeHtml(r.title)}</div>
            <div class="recent-item-meta">
              ${r.mealType ? `<span>${escapeHtml(r.mealType)}</span>` : ''}
              ${r.cuisine ? `<span>• ${escapeHtml(r.cuisine)}</span>` : ''}
              <span class="recent-item-time" style="margin-left:auto;">${formatRelativeTime(r.timestamp)}</span>
            </div>
          </div>
        `).join('');
  }

  // Render recent meals
  const mealsContainer = document.getElementById('recentMealsList');
  if (!mealsContainer) return;

  if (RECENT_HISTORY.meals.length === 0) {
    mealsContainer.innerHTML = '<div class="recent-empty">No recent meal assignments</div>';
  } else {
    mealsContainer.innerHTML = RECENT_HISTORY.meals.map(m => `
          <div class="recent-item" data-action="open-recent-meal" data-recipe-id="${escapeAttr(m.recipeId)}">
            <div class="recent-item-title">${escapeHtml(m.title)}</div>
            <div class="recent-item-meta">
              <span>${escapeHtml(m.slot)}</span>
              <span>• ${escapeHtml(m.date)}</span>
              <span class="recent-item-time" style="margin-left:auto;">${formatRelativeTime(m.timestamp)}</span>
            </div>
          </div>
        `).join('');
  }
}

// Clear recent recipes
function clearRecentRecipes() {
  RECENT_HISTORY.recipes = [];
  saveRecentHistory();
  renderRecentHistory();
  showToast('Recent recipes cleared', 'info');
}

// Clear recent meals
function clearRecentMeals() {
  RECENT_HISTORY.meals = [];
  saveRecentHistory();
  renderRecentHistory();
  showToast('Recent meal assignments cleared', 'info');
}

// Toggle recent actions panel
function toggleRecentActionsPanel() {
  const panel = document.getElementById('recentActionsPanel');
  if (panel.classList.contains('show')) {
    panel.classList.remove('show');
  } else {
    panel.classList.add('show');
    renderRecentHistory();
  }
}

// ---------- init ----------
// ========== PHASE 6.2: EXPORT FUNCTIONALITY ==========

// Track selected recipes for export
let SELECTED_RECIPES = new Set();

// Update selected recipe count and visibility of export controls
function updateRecipeExportControls() {
  const count = SELECTED_RECIPES.size;
  const controls = document.getElementById('recipeExportControls');
  const countEl = document.getElementById('selectedRecipeCount');

  const bulkButtons = [
    document.getElementById('btnBulkAssign'),
    document.getElementById('btnBulkCollection'),
    document.getElementById('btnBulkEdit'),
    document.getElementById('btnBulkDelete'),
    document.getElementById('btnExportSelectedRecipes')
  ];

  if (count > 0) {
    countEl.textContent = count;
    bulkButtons.forEach(btn => {
      if (btn) btn.disabled = false;
    });
  } else {
    countEl.textContent = '0';
    bulkButtons.forEach(btn => {
      if (btn) btn.disabled = true;
    });
  }
}

// Handle recipe checkbox change
function handleRecipeCheckboxChange(e) {
  const checkbox = e.target;
  if (!checkbox.classList.contains('recipe-select-checkbox')) return;

  const recipeId = checkbox.getAttribute('data-recipe-id');
  if (!recipeId) return;

  if (checkbox.checked) {
    SELECTED_RECIPES.add(recipeId);
  } else {
    SELECTED_RECIPES.delete(recipeId);
  }

  updateRecipeExportControls();
}

// Select all visible recipes
function selectAllRecipes() {
  const checkboxes = document.querySelectorAll('.recipe-select-checkbox');
  checkboxes.forEach(cb => {
    cb.checked = true;
    const recipeId = cb.getAttribute('data-recipe-id');
    if (recipeId) SELECTED_RECIPES.add(recipeId);
  });
  updateRecipeExportControls();
}

// Deselect all recipes
function deselectAllRecipes() {
  const checkboxes = document.querySelectorAll('.recipe-select-checkbox');
  checkboxes.forEach(cb => {
    cb.checked = false;
  });
  SELECTED_RECIPES.clear();
  updateRecipeExportControls();
}

// Export selected recipes
async function exportSelectedRecipes() {
  if (SELECTED_RECIPES.size === 0) {
    showToast('No recipes selected', 'warning');
    return;
  }

  const recipeIds = Array.from(SELECTED_RECIPES);

  try {
    const result = await window.Foodie.exportRecipes(recipeIds);

    if (result.ok) {
      showToast(`Exported ${result.count} recipe(s) to ${result.filePath}`, 'success');
      deselectAllRecipes();
    } else {
      showToast(result.error || 'Export failed', 'error');
    }
  } catch (error) {
    showToast(`Export error: ${error.message}`, 'error');
  }
}

// Export collection handler
async function exportCollectionHandler(collectionId) {
  if (!collectionId) return;

  try {
    const result = await window.Foodie.exportCollection(collectionId);

    if (result.ok) {
      showToast(`Exported collection (${result.count} recipe(s)) to ${result.filePath}`, 'success');
    } else {
      showToast(result.error || 'Export failed', 'error');
    }
  } catch (error) {
    showToast(`Export error: ${error.message}`, 'error');
  }
}

// Export meal plan handler
async function exportMealPlan() {
  const startDate = document.getElementById('planStart').value;
  const endDate = document.getElementById('planEnd').value;

  if (!startDate || !endDate) {
    showToast('Please select start and end dates', 'warning');
    return;
  }

  const statusEl = document.getElementById('exportMealPlanStatus');
  if (statusEl) statusEl.textContent = 'Exporting...';

  try {
    const result = await window.Foodie.exportMealPlan(startDate, endDate);

    if (result.ok) {
      showToast(`Exported meal plan (${result.dayCount} day(s)) to ${result.filePath}`, 'success');
      if (statusEl) statusEl.textContent = `✅ Exported ${result.dayCount} day(s)`;
    } else {
      showToast(result.error || 'Export failed', 'error');
      if (statusEl) statusEl.textContent = '❌ Export failed';
    }
  } catch (error) {
    showToast(`Export error: ${error.message}`, 'error');
    if (statusEl) statusEl.textContent = '❌ Error';
  }

  // Clear status after 3 seconds
  if (statusEl) {
    setTimeout(() => { statusEl.textContent = ''; }, 3000);
  }
}

// ========== PHASE 3.4: BULK ACTIONS ==========

// Helper: Get selected recipes data
function getSelectedRecipesData() {
  const recipeIds = Array.from(SELECTED_RECIPES);
  return RECIPES.filter(r => recipeIds.includes(r.RecipeId));
}

// Bulk Assign: Assign selected recipes to dates
async function bulkAssignRecipes() {
  if (SELECTED_RECIPES.size === 0) {
    showToast('No recipes selected', 'warning');
    return;
  }

  const selectedRecipes = getSelectedRecipesData();
  const count = selectedRecipes.length;

  // Calculate suggested end date based on number of recipes
  const startDate = new Date();
  const endDate = new Date();
  endDate.setDate(endDate.getDate() + Math.ceil(count / 2) - 1); // Assume 2 meals per day

  // Create modal for bulk assign
  const modalHtml = `
        <div class="modalBack" id="bulkAssignModalBack" style="display:flex;">
          <div class="modal" style="max-width:550px;">
            <div class="modalHead">
              <h2>Bulk Assign ${count} Recipe(s) to Meal Plan</h2>
              <button class="ghost mini" onclick="document.getElementById('bulkAssignModalBack').remove()">✕</button>
            </div>
            <div style="padding:16px;">
              <div class="help-text" style="margin-bottom:16px;">
                Recipes will be distributed across the selected date range and meal slots in the order they appear.
              </div>
              
              <label style="font-weight:600; margin-bottom:4px; display:block;">Date Range</label>
              <div style="display:flex; gap:12px; margin-bottom:16px;">
                <div style="flex:1;">
                  <label style="font-size:12px; color:var(--muted); display:block; margin-bottom:4px;">Start Date</label>
                  <input type="date" id="bulkAssignStartDate" value="${ymd(startDate)}" style="width:100%;">
                </div>
                <div style="flex:1;">
                  <label style="font-size:12px; color:var(--muted); display:block; margin-bottom:4px;">End Date</label>
                  <input type="date" id="bulkAssignEndDate" value="${ymd(endDate)}" style="width:100%;">
                </div>
              </div>
              
              <label style="font-weight:600; margin-bottom:8px; display:block;">Meal Slots</label>
              <div style="margin-bottom:16px; padding:12px; background:rgba(77,163,255,0.05); border-radius:8px;">
                <label style="display:flex; align-items:center; gap:8px; margin:6px 0; cursor:pointer;">
                  <input type="checkbox" value="Breakfast" class="bulk-assign-slot" style="width:16px; height:16px;">
                  <span>🍳 Breakfast</span>
                </label>
                <label style="display:flex; align-items:center; gap:8px; margin:6px 0; cursor:pointer;">
                  <input type="checkbox" value="Lunch" class="bulk-assign-slot" checked style="width:16px; height:16px;">
                  <span>🥗 Lunch</span>
                </label>
                <label style="display:flex; align-items:center; gap:8px; margin:6px 0; cursor:pointer;">
                  <input type="checkbox" value="Dinner" class="bulk-assign-slot" checked style="width:16px; height:16px;">
                  <span>🍽️ Dinner</span>
                </label>
              </div>
              
              <div id="bulkAssignPreview" style="padding:12px; background:rgba(255,193,7,0.1); border:1px solid rgba(255,193,7,0.3); border-radius:8px; margin-bottom:16px;">
                <div style="font-size:13px; font-weight:600; margin-bottom:4px;">📊 Preview</div>
                <div id="bulkAssignPreviewText" style="font-size:12px; color:var(--muted);">
                  Select date range and meal slots to see assignment preview
                </div>
              </div>
              
              <div class="actions">
                <button class="primary" onclick="executeBulkAssign()">Assign ${count} Recipe(s)</button>
                <button class="ghost" onclick="document.getElementById('bulkAssignModalBack').remove()">Cancel</button>
              </div>
            </div>
          </div>
        </div>
      `;

  document.body.insertAdjacentHTML('beforeend', modalHtml);

  // Add event listeners to update preview
  const updatePreview = () => {
    const startDate = document.getElementById('bulkAssignStartDate').value;
    const endDate = document.getElementById('bulkAssignEndDate').value;
    const slotCheckboxes = document.querySelectorAll('.bulk-assign-slot:checked');
    const slots = Array.from(slotCheckboxes).map(cb => cb.value);
    const previewText = document.getElementById('bulkAssignPreviewText');

    if (!startDate || !endDate || slots.length === 0) {
      previewText.textContent = 'Select date range and meal slots to see assignment preview';
      return;
    }

    const start = new Date(startDate);
    const end = new Date(endDate);
    const daysDiff = Math.floor((end - start) / (1000 * 60 * 60 * 24)) + 1;
    const totalSlots = daysDiff * slots.length;

    if (totalSlots < count) {
      previewText.innerHTML = `⚠️ Warning: You selected ${count} recipes but only have ${totalSlots} meal slots available (${daysDiff} days × ${slots.length} meals/day). Some recipes won't be assigned.`;
    } else {
      previewText.innerHTML = `✓ ${count} recipes will fill ${count} of ${totalSlots} available slots across ${daysDiff} day(s). Meals: ${slots.join(', ')}.`;
    }
  };

  document.getElementById('bulkAssignStartDate').addEventListener('change', updatePreview);
  document.getElementById('bulkAssignEndDate').addEventListener('change', updatePreview);
  document.querySelectorAll('.bulk-assign-slot').forEach(cb => {
    cb.addEventListener('change', updatePreview);
  });

  // Initial preview
  updatePreview();
}

async function executeBulkAssign() {
  const startDate = document.getElementById('bulkAssignStartDate').value;
  const endDate = document.getElementById('bulkAssignEndDate').value;
  const slotCheckboxes = document.querySelectorAll('.bulk-assign-slot:checked');
  const slots = Array.from(slotCheckboxes).map(cb => cb.value);

  if (!startDate || !endDate) {
    showToast('Please select start and end dates', 'warning');
    return;
  }

  if (slots.length === 0) {
    showToast('Please select at least one meal slot', 'warning');
    return;
  }

  // Validate date range
  if (new Date(endDate) < new Date(startDate)) {
    showToast('End date must be after start date', 'warning');
    return;
  }

  document.getElementById('bulkAssignModalBack').remove();

  const selectedRecipes = getSelectedRecipesData();

  try {
    let assignedCount = 0;
    let currentDate = new Date(startDate);
    const end = new Date(endDate);
    let slotIndex = 0;
    let recipeIndex = 0;

    // Loop through dates and slots until all recipes are assigned or date range ends
    while (recipeIndex < selectedRecipes.length && currentDate <= end) {
      const recipe = selectedRecipes[recipeIndex];
      const slot = slots[slotIndex % slots.length];
      const dateStr = currentDate.toISOString().split('T')[0];

      const res = await api('upsertPlanMeal', {
        date: dateStr,
        slot: slot,
        meal: { RecipeId: recipe.RecipeId, Title: recipe.Title }
      });

      if (res.ok) {
        assignedCount++;
      }

      recipeIndex++;
      slotIndex++;

      // Move to next day after cycling through all selected slots
      if (slotIndex % slots.length === 0) {
        currentDate.setDate(currentDate.getDate() + 1);
      }
    }

    const unassignedCount = selectedRecipes.length - assignedCount;

    if (unassignedCount > 0) {
      showToast(`Assigned ${assignedCount} recipes. ${unassignedCount} recipes didn't fit in the date range.`, 'warning', 5000);
    } else {
      showToast(`Assigned ${assignedCount} recipe(s) to meal plan`, 'success');
    }

    deselectAllRecipes();

    // Switch to planner tab and refresh
    const plannerTab = document.querySelector('.tab[data-tab="planner"]');
    if (plannerTab) plannerTab.click();
  } catch (error) {
    showToast(`Bulk assign error: ${error.message}`, 'error');
  }
}

// Bulk Collection: Add selected recipes to a collection
async function bulkAddToCollection() {
  if (SELECTED_RECIPES.size === 0) {
    showToast('No recipes selected', 'warning');
    return;
  }

  const selectedRecipes = getSelectedRecipesData();
  const count = selectedRecipes.length;

  // Load collections
  const collectionsRes = await api('listCollections', {});
  if (!collectionsRes.ok) {
    showToast('Failed to load collections', 'error');
    return;
  }

  const collections = collectionsRes.collections || [];

  // Create modal for collection selection
  const collectionsOptions = collections.length > 0
    ? collections.map(c => `<option value="${c.CollectionId}">${c.Name} (${c.RecipeCount} recipes)</option>`).join('')
    : '';

  const modalHtml = `
        <div class="modalBack" id="bulkCollectionModalBack" style="display:flex;">
          <div class="modal" style="max-width:500px;">
            <div class="modalHead">
              <h2>Add ${count} Recipe(s) to Collection</h2>
              <button class="ghost mini" onclick="document.getElementById('bulkCollectionModalBack').remove()">✕</button>
            </div>
            <div style="padding:16px;">
              ${collections.length > 0 ? `
                <label>Select Existing Collection</label>
                <select id="bulkCollectionSelect" style="width:100%; margin-bottom:16px; padding:8px;">
                  <option value="">-- Or Create New --</option>
                  ${collectionsOptions}
                </select>
              ` : ''}
              
              <label>Or Create New Collection</label>
              <input type="text" id="bulkCollectionName" placeholder="Enter collection name" style="width:100%; margin-bottom:16px; padding:8px;">
              
              <label>Description (optional)</label>
              <input type="text" id="bulkCollectionDesc" placeholder="Enter description" style="width:100%; margin-bottom:16px; padding:8px;">
              
              <div class="actions">
                <button class="primary" onclick="executeBulkAddToCollection()">Add to Collection</button>
                <button class="ghost" onclick="document.getElementById('bulkCollectionModalBack').remove()">Cancel</button>
              </div>
            </div>
          </div>
        </div>
      `;

  document.body.insertAdjacentHTML('beforeend', modalHtml);
}

async function executeBulkAddToCollection() {
  const selectedCollectionId = document.getElementById('bulkCollectionSelect')?.value || '';
  const newCollectionName = document.getElementById('bulkCollectionName').value.trim();
  const newCollectionDesc = document.getElementById('bulkCollectionDesc').value.trim();

  let collectionId;

  if (selectedCollectionId) {
    // Use existing collection
    collectionId = selectedCollectionId;
  } else if (newCollectionName) {
    // Create new collection
    const createRes = await api('upsertCollection', {
      name: newCollectionName,
      description: newCollectionDesc || `Collection of recipes`
    });
    if (!createRes.ok) {
      showToast('Failed to create collection', 'error');
      return;
    }
    collectionId = createRes.collectionId;
  } else {
    showToast('Please select a collection or enter a new collection name', 'warning');
    return;
  }

  document.getElementById('bulkCollectionModalBack').remove();

  const selectedRecipes = getSelectedRecipesData();

  // Add all recipes to collection
  let addedCount = 0;
  for (const recipe of selectedRecipes) {
    const res = await api('addRecipeToCollection', {
      collectionId: collectionId,
      recipeId: recipe.RecipeId
    });
    if (res.ok) addedCount++;
  }

  showToast(`Added ${addedCount} recipe(s) to collection`, 'success');
  deselectAllRecipes();

  // Refresh collections view if we're on that tab
  const collectionsTab = document.querySelector('.tab[data-tab="collections"]');
  if (collectionsTab && collectionsTab.classList.contains('active')) {
    await loadCollections();
  }
}

// Bulk Edit: Edit common fields for selected recipes
async function bulkEditRecipes() {
  if (SELECTED_RECIPES.size === 0) {
    showToast('No recipes selected', 'warning');
    return;
  }

  const selectedRecipes = getSelectedRecipesData();
  const count = selectedRecipes.length;

  // Load cuisines
  const cuisines = await getCuisinesList();
  const mealTypes = ['Breakfast', 'Brunch', 'Lunch', 'Dinner', 'Side Dish', 'Appetizer', 'Snack', 'Dessert', 'Beverage', 'Any'];

  // Create modal for bulk edit
  const modalHtml = `
        <div class="modalBack" id="bulkEditModalBack" style="display:flex;">
          <div class="modal" style="max-width:500px;">
            <div class="modalHead">
              <h2>Bulk Edit ${count} Recipe(s)</h2>
              <button class="ghost mini" onclick="document.getElementById('bulkEditModalBack').remove()">✕</button>
            </div>
            <div style="padding:16px;">
              <label>Select Field to Edit</label>
              <select id="bulkEditField" style="width:100%; margin-bottom:16px; padding:8px;">
                <option value="">-- Select a field --</option>
                <option value="cuisine">Cuisine</option>
                <option value="mealType">Meal Type</option>
              </select>
              
              <div id="bulkEditCuisineGroup" style="display:none; margin-bottom:16px;">
                <label>New Cuisine</label>
                <select id="bulkEditCuisine" style="width:100%; padding:8px;">
                  <option value="">-- Select cuisine --</option>
                  ${cuisines.map(c => `<option value="${c}">${c}</option>`).join('')}
                </select>
              </div>
              
              <div id="bulkEditMealTypeGroup" style="display:none; margin-bottom:16px;">
                <label>New Meal Type</label>
                <select id="bulkEditMealType" style="width:100%; padding:8px;">
                  <option value="">-- Select meal type --</option>
                  ${mealTypes.map(m => `<option value="${m}">${m}</option>`).join('')}
                </select>
              </div>
              
              <div class="actions">
                <button class="primary" onclick="executeBulkEdit()">Update Recipes</button>
                <button class="ghost" onclick="document.getElementById('bulkEditModalBack').remove()">Cancel</button>
              </div>
            </div>
          </div>
        </div>
      `;

  document.body.insertAdjacentHTML('beforeend', modalHtml);

  // Add field selector change listener
  document.getElementById('bulkEditField').addEventListener('change', (e) => {
    const cuisineGroup = document.getElementById('bulkEditCuisineGroup');
    const mealTypeGroup = document.getElementById('bulkEditMealTypeGroup');

    if (e.target.value === 'cuisine') {
      cuisineGroup.style.display = 'block';
      mealTypeGroup.style.display = 'none';
    } else if (e.target.value === 'mealType') {
      cuisineGroup.style.display = 'none';
      mealTypeGroup.style.display = 'block';
    } else {
      cuisineGroup.style.display = 'none';
      mealTypeGroup.style.display = 'none';
    }
  });
}

async function executeBulkEdit() {
  const field = document.getElementById('bulkEditField').value;

  if (!field) {
    showToast('Please select a field to edit', 'warning');
    return;
  }

  const selectedRecipes = getSelectedRecipesData();
  let newValue;
  let fieldName;

  if (field === 'cuisine') {
    newValue = document.getElementById('bulkEditCuisine').value;
    fieldName = 'Cuisine';
    if (!newValue) {
      showToast('Please select a cuisine', 'warning');
      return;
    }
  } else if (field === 'mealType') {
    newValue = document.getElementById('bulkEditMealType').value;
    fieldName = 'MealType';
    if (!newValue) {
      showToast('Please select a meal type', 'warning');
      return;
    }
  }

  document.getElementById('bulkEditModalBack').remove();

  // Update all selected recipes
  let updatedCount = 0;
  for (const recipe of selectedRecipes) {
    recipe[fieldName] = newValue;
    const res = await api('upsertRecipeWithIngredients', {
      recipe: recipe,
      items: [] // Don't update ingredients
    });
    if (res.ok) updatedCount++;
  }

  showToast(`Updated ${fieldName.toLowerCase()} for ${updatedCount} recipe(s)`, 'success');

  // Refresh recipes list
  await resetAndLoadRecipes();
  deselectAllRecipes();
}

// Bulk Delete: Delete selected recipes with confirmation
async function bulkDeleteRecipes() {
  if (SELECTED_RECIPES.size === 0) {
    showToast('No recipes selected', 'warning');
    return;
  }

  const selectedRecipes = getSelectedRecipesData();
  const count = selectedRecipes.length;

  const confirmation = confirm(`Delete ${count} recipe(s)?\n\nThis will permanently delete the recipes and their ingredients.\n\nThis action cannot be undone.`);
  if (!confirmation) return;

  try {
    let deletedCount = 0;
    const failedRecipes = [];

    for (const recipe of selectedRecipes) {
      const res = await api('deleteRecipeCascade', { recipeId: recipe.RecipeId });
      if (res.ok) {
        deletedCount++;
      } else {
        failedRecipes.push(recipe.Title);
      }
    }

    if (deletedCount === count) {
      showToast(`Deleted ${deletedCount} recipe(s)`, 'success');
    } else {
      showToast(`Deleted ${deletedCount} of ${count} recipe(s). ${failedRecipes.length} failed.`, 'warning');
    }

    // Refresh recipes list
    await resetAndLoadRecipes();
    deselectAllRecipes();
  } catch (error) {
    showToast(`Bulk delete error: ${error.message}`, 'error');
  }
}

// Helper: Get cuisines list
async function getCuisinesList() {
  const res = await api('listUniqueCuisines', {});
  if (res.ok && res.cuisines) {
    return res.cuisines.map(c => c.Cuisine).filter(c => c);
  }
  return [];
}

// ========== PHASE 3.5: QUICK ADD RECIPE ==========

// Open quick add modal
function openQuickAddModal() {
  // Clear fields
  document.getElementById('qaTitle').value = '';
  document.getElementById('qaCuisine').value = '';
  document.getElementById('qaMealType').value = 'Any';
  document.getElementById('qaUrl').value = '';
  document.getElementById('qaIngredients').value = '';
  document.getElementById('qaNotes').value = '';
  document.getElementById('qaStatus').textContent = '';

  // Apply smart defaults (Phase 3.3)
  const defaults = loadSmartDefaults();
  if (defaults.recipe.cuisine) {
    document.getElementById('qaCuisine').value = defaults.recipe.cuisine;
  }
  if (defaults.recipe.mealType) {
    document.getElementById('qaMealType').value = defaults.recipe.mealType;
  }

  // Show modal
  openModal('quickAddModalBack');

  // Focus title field
  setTimeout(() => {
    document.getElementById('qaTitle').focus();
  }, 100);
}

// Close quick add modal
function closeQuickAddModal() {
  closeModal('quickAddModalBack');
}

// Parse quick ingredients text into structured format
function parseQuickIngredients(text) {
  if (!text || !text.trim()) return [];

  const lines = text.split('\n').filter(l => l.trim());
  const ingredients = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // Try to parse: "quantity unit ingredient"
    // Examples: "2 cups flour", "1 tbsp salt", "3 chicken breasts"
    const parts = trimmed.split(/\s+/);

    let qtyNum = '';
    let qtyText = '';
    let unit = '';
    let ingredientRaw = trimmed;

    // Check if first part is a number or fraction
    if (parts.length >= 1) {
      const firstPart = parts[0];
      // Check for number (including fractions like 1/2, decimals like 1.5)
      if (/^[\d\/\.]+$/.test(firstPart)) {
        qtyText = firstPart;
        // Try to convert to number
        if (firstPart.includes('/')) {
          const [num, den] = firstPart.split('/');
          qtyNum = parseFloat(num) / parseFloat(den);
        } else {
          qtyNum = parseFloat(firstPart);
        }

        // Check if second part is a unit
        if (parts.length >= 2) {
          const secondPart = parts[1].toLowerCase();
          const commonUnits = ['cup', 'cups', 'tbsp', 'tsp', 'oz', 'lb', 'lbs', 'g', 'kg', 'ml', 'l', 'clove', 'cloves', 'piece', 'pieces', 'slice', 'slices'];
          if (commonUnits.some(u => secondPart.includes(u))) {
            unit = parts[1];
            ingredientRaw = parts.slice(2).join(' ');
          } else {
            ingredientRaw = parts.slice(1).join(' ');
          }
        }
      }
    }

    ingredients.push({
      IngredientRaw: ingredientRaw || trimmed,
      IngredientNorm: '', // Will be normalized by backend
      QtyNum: qtyNum,
      QtyText: qtyText,
      Unit: unit,
      Category: '', // Will be auto-categorized
      StoreId: '', // Will use default
      Notes: ''
    });
  }

  return ingredients;
}

// Save quick add recipe (simple save)
async function saveQuickAddRecipe(openForEdit = false) {
  const title = document.getElementById('qaTitle').value.trim();
  if (!title) {
    showToast('Recipe title is required', 'warning');
    document.getElementById('qaTitle').focus();
    return;
  }

  const cuisine = document.getElementById('qaCuisine').value.trim();
  const mealType = document.getElementById('qaMealType').value.trim() || 'Any';
  const url = document.getElementById('qaUrl').value.trim();
  const ingredientsText = document.getElementById('qaIngredients').value;
  const notes = document.getElementById('qaNotes').value.trim();

  const statusEl = document.getElementById('qaStatus');
  statusEl.textContent = 'Saving...';

  try {
    // Parse ingredients
    const ingredients = parseQuickIngredients(ingredientsText);

    // Create recipe object
    const recipe = {
      RecipeId: '',
      Title: title,
      Cuisine: cuisine,
      MealType: mealType,
      URL: url,
      Notes: notes,
      Instructions: '' // Empty for quick add
    };

    // Save recipe with ingredients
    const res = await api('upsertRecipeWithIngredients', {
      recipe: recipe,
      items: ingredients
    });

    if (!res.ok) {
      showToast(res.error || 'Failed to save recipe', 'error');
      statusEl.textContent = 'Save failed';
      return;
    }

    const recipeId = res.RecipeId;

    // Learn from recipe (Phase 3.3)
    if (cuisine) setSmartDefault('recipe', 'cuisine', cuisine);
    if (mealType) setSmartDefault('recipe', 'mealType', mealType);

    showToast(`Recipe "${title}" saved successfully`, 'success');

    // Refresh recipes list
    await resetAndLoadRecipes();

    if (openForEdit) {
      // Close quick add and open full recipe modal for editing
      closeQuickAddModal();
      await openRecipeModalEdit(recipeId);
    } else {
      // Just close and show success
      closeQuickAddModal();
    }
  } catch (error) {
    showToast(`Error saving recipe: ${error.message}`, 'error');
    statusEl.textContent = 'Error';
  }
}

// Populate cuisine dropdown for quick add
async function populateQuickAddCuisines() {
  const cuisines = await getCuisinesList();
  const select = document.getElementById('qaCuisine');

  // Clear existing options except first
  while (select.options.length > 1) {
    select.remove(1);
  }

  // Add cuisines
  cuisines.forEach(cuisine => {
    const option = document.createElement('option');
    option.value = cuisine;
    option.textContent = cuisine;
    select.appendChild(option);
  });
}

// ============= PHASE 4.5: MULTI-USER SUPPORT - JAVASCRIPT =============

// ACTIVE_USER is already declared at top level (line 430)

// Initialize user switcher on page load
async function initUserSwitcher() {
  console.log('initUserSwitcher called');
  try {
    // Load active user from localStorage
    const savedUserId = localStorage.getItem('activeUserId');
    console.log('Saved user ID from localStorage:', savedUserId);

    // Get active user from backend (defaults to "Whole Family")
    const activeResult = await api('getActiveUser', {});
    console.log('getActiveUser result:', activeResult);
    console.log('getActiveUser result.ok:', activeResult.ok);
    console.log('getActiveUser result.userId:', activeResult.userId);
    console.log('getActiveUser result.name:', activeResult.name);

    if (activeResult.ok && activeResult.userId) {
      // Backend returns user data flat, not nested
      ACTIVE_USER = {
        userId: activeResult.userId,
        name: activeResult.name,
        email: activeResult.email,
        avatarEmoji: activeResult.avatarEmoji,
        isActive: activeResult.isActive
      };
      console.log('Active user set to:', ACTIVE_USER);

      // If we have a saved user ID, set it as active
      if (savedUserId && savedUserId !== activeResult.userId) {
        const setResult = await api('setActiveUser', { userId: savedUserId });
        if (setResult.ok) {
          const updatedResult = await api('getActiveUser', {});
          if (updatedResult.ok) {
            ACTIVE_USER = {
              userId: updatedResult.userId,
              name: updatedResult.name,
              email: updatedResult.email,
              avatarEmoji: updatedResult.avatarEmoji,
              isActive: updatedResult.isActive
            };
          }
        }
      }

      // Update UI
      updateUserSwitcherButton();

      // Set up event listeners
      const btnUserSwitcher = document.getElementById('btnUserSwitcher');
      console.log('Button found for event listener:', btnUserSwitcher);
      if (btnUserSwitcher) {
        btnUserSwitcher.addEventListener('click', toggleUserSwitcher);
        console.log('Click event listener added to button');
      } else {
        console.error('btnUserSwitcher not found!');
      }

      // Load users into dropdown
      await renderUserSwitcherList();
    } else {
      console.error('Failed to get active user:', activeResult);
      console.error('Result has ok=false or no userId. Attempting to continue anyway...');

      // Try to initialize anyway with a fallback
      ACTIVE_USER = { userId: null, name: 'Whole Family', avatarEmoji: '👨‍👩‍👧‍👦' };
      updateUserSwitcherButton();

      // Set up event listeners anyway
      const btnUserSwitcher = document.getElementById('btnUserSwitcher');
      console.log('Button found for event listener (fallback):', btnUserSwitcher);
      if (btnUserSwitcher) {
        btnUserSwitcher.addEventListener('click', toggleUserSwitcher);
        console.log('Click event listener added to button (fallback)');
      }

      // Try to load users
      await renderUserSwitcherList();
    }
  } catch (e) {
    console.error('Failed to initialize user switcher:', e);
  }
}

// Update user switcher button display
function updateUserSwitcherButton() {
  if (!ACTIVE_USER) return;

  const avatarEl = document.getElementById('activeUserAvatar');
  const nameEl = document.getElementById('activeUserName');

  if (avatarEl) avatarEl.textContent = ACTIVE_USER.avatarEmoji || '👤';
  if (nameEl) nameEl.textContent = ACTIVE_USER.name || 'Unknown User';
}

// Toggle user switcher dropdown
function toggleUserSwitcher(event) {
  console.log('toggleUserSwitcher called', event);
  event.stopPropagation();
  const dropdown = document.getElementById('userSwitcherDropdown');
  const btn = document.getElementById('btnUserSwitcher');

  console.log('Dropdown element:', dropdown);
  console.log('Button element:', btn);

  if (!dropdown || !btn) {
    console.error('Missing dropdown or button!');
    return;
  }

  const isVisible = dropdown.style.display === 'block';
  console.log('Current visibility:', isVisible);

  if (isVisible) {
    console.log('Closing dropdown');
    dropdown.style.display = 'none';
    btn.classList.remove('open');
    document.removeEventListener('click', handleClickOutsideUserSwitcher);
  } else {
    console.log('Opening dropdown');
    // Calculate position based on button location
    const rect = btn.getBoundingClientRect();
    console.log('Button rect:', rect);
    dropdown.style.top = `${rect.bottom + 8}px`;
    dropdown.style.right = `${window.innerWidth - rect.right}px`;
    console.log('Set dropdown position - top:', dropdown.style.top, 'right:', dropdown.style.right);

    dropdown.style.display = 'block';
    btn.classList.add('open');
    console.log('Dropdown display set to block');

    // Check list content
    const listEl = document.getElementById('userSwitcherList');
    console.log('List element HTML length:', listEl ? listEl.innerHTML.length : 'null');
    console.log('List content:', listEl ? listEl.innerHTML : 'null');

    setTimeout(() => {
      document.addEventListener('click', handleClickOutsideUserSwitcher);
    }, 0);
  }
}

// Close user switcher when clicking outside
function handleClickOutsideUserSwitcher(event) {
  console.log('handleClickOutsideUserSwitcher called', event.target);
  const dropdown = document.getElementById('userSwitcherDropdown');
  const btn = document.getElementById('btnUserSwitcher');

  if (!dropdown || !btn) return;

  const clickedOutside = !dropdown.contains(event.target) && !btn.contains(event.target);
  console.log('Clicked outside?', clickedOutside, 'Target:', event.target);

  if (clickedOutside) {
    console.log('Closing dropdown due to outside click');
    closeUserSwitcher();
  }
}

// Close user switcher dropdown
function closeUserSwitcher() {
  const dropdown = document.getElementById('userSwitcherDropdown');
  const btn = document.getElementById('btnUserSwitcher');

  if (dropdown) dropdown.style.display = 'none';
  if (btn) btn.classList.remove('open');
  document.removeEventListener('click', handleClickOutsideUserSwitcher);
}

// Render user list in dropdown
async function renderUserSwitcherList() {
  console.log('renderUserSwitcherList called');
  try {
    const result = await api('listUsers', {});
    console.log('listUsers result:', result);
    if (!result.ok) {
      console.error('listUsers returned not ok');
      return;
    }

    const listEl = document.getElementById('userSwitcherList');
    console.log('List element found:', listEl);
    if (!listEl) {
      console.error('userSwitcherList element not found!');
      return;
    }

    console.log('Number of users:', result.users ? result.users.length : 0);

    let html = '';
    for (const user of result.users) {
      const isActive = ACTIVE_USER && user.userId === ACTIVE_USER.userId;
      console.log('Processing user:', user.name, 'Active:', isActive);

      // Get dietary restrictions for this user
      const restrictionsResult = await api('getUserDietaryRestrictions', { userId: user.userId });
      const restrictions = restrictionsResult.ok ? restrictionsResult.restrictions : [];

      html += `
            <div class="user-switcher-item ${isActive ? 'active' : ''}" 
                 onclick="switchToUser('${user.userId}')">
              <div class="user-switcher-avatar">${user.avatarEmoji || '👤'}</div>
              <div class="user-switcher-info">
                <div class="user-switcher-name">${escapeHtml(user.name)}</div>
                ${user.email ? `<div class="user-switcher-email">${escapeHtml(user.email)}</div>` : ''}
                ${restrictions.length > 0 ? `
                  <div class="user-switcher-restrictions">
                    ${restrictions.slice(0, 2).map(r => `
                      <span class="user-restriction-badge">${escapeHtml(r.name)}</span>
                    `).join('')}
                    ${restrictions.length > 2 ? `<span class="user-restriction-badge">+${restrictions.length - 2}</span>` : ''}
                  </div>
                ` : ''}
              </div>
              ${isActive ? '<div class="user-switcher-check">✓</div>' : ''}
            </div>
          `;
    }

    console.log('Generated HTML length:', html.length);
    listEl.innerHTML = html;
    console.log('List element innerHTML set');
  } catch (e) {
    console.error('Failed to render user list:', e);
  }
}

// Switch to a different user
async function switchToUser(userId) {
  console.log('switchToUser called with userId:', userId);
  try {
    if (!userId) {
      console.error('No userId provided');
      return;
    }

    // Set active user in backend
    console.log('Calling setActiveUser API...');
    const result = await api('setActiveUser', { userId });
    console.log('setActiveUser result:', result);

    if (!result.ok) {
      console.error('setActiveUser failed:', result.error);
      showToast('Failed to switch user', 'error');
      return;
    }

    // Save to localStorage
    localStorage.setItem('activeUserId', userId);
    console.log('Saved userId to localStorage');

    // Get updated user details
    console.log('Getting active user...');
    const activeResult = await api('getActiveUser', {});
    console.log('getActiveUser result:', activeResult);

    if (activeResult.ok && activeResult.userId) {
      // Backend returns user data flat, not nested
      ACTIVE_USER = {
        userId: activeResult.userId,
        name: activeResult.name,
        email: activeResult.email,
        avatarEmoji: activeResult.avatarEmoji,
        isActive: activeResult.isActive
      };
      console.log('ACTIVE_USER updated to:', ACTIVE_USER);
      updateUserSwitcherButton();
      await renderUserSwitcherList();
    } else {
      console.error('Failed to get active user after switch:', activeResult);
    }

    // Close dropdown
    closeUserSwitcher();

    // Show success message
    const userName = ACTIVE_USER ? ACTIVE_USER.name : 'Unknown';
    console.log('Showing toast for user:', userName);
    showToast(`Switched to ${userName}`, 'success');

    // Phase 4.5.7: Reload meal planner to show user-specific meals
    if (PLAN.start && PLAN.days) {
      console.log('Reloading meal planner for new user');
      await loadPlansIntoUi(PLAN.start, PLAN.days);
    }

    // CRITICAL: Invalidate recipe cache BEFORE reloading to force fresh fetch with new user's favorites
    console.log('[User Switch] Invalidating recipe cache to reload favorites');
    QUERY_CACHE.recipes = null;
    QUERY_CACHE.recipesFetchTime = 0;

    // Reload recipes to get new user's favorites
    await resetAndLoadRecipes();

  } catch (e) {
    console.error('Failed to switch user:', e);
    showToast('Error switching user', 'error');
  }
}

// Open Manage Users modal
function openManageUsersModal() {
  closeUserSwitcher();

  const modalHtml = `
        <div id="manageUsersModalBack" class="modalBack" style="display:flex;">
          <div class="modal">
            <div class="modalHead">
              <h2>Manage Users</h2>
              <button class="ghost mini" onclick="closeManageUsersModal()">✕</button>
            </div>
            
            <!-- PHASE 8.2+: Inline help for multi-user feature -->
            <div class="help-text" style="margin-top:16px;">
              Create profiles for family members to track individual meal assignments, dietary restrictions, and preferences. You can assign meals to specific users in the meal planner.
            </div>
            
            <div style="margin-top:16px;">
              <div id="manageUsersGrid" class="manage-users-grid">
                <!-- Populated by renderManageUsers() -->
              </div>
            </div>
          </div>
        </div>
      `;

  document.body.insertAdjacentHTML('beforeend', modalHtml);
  renderManageUsers();
}

// Close Manage Users modal
function closeManageUsersModal() {
  const modal = document.getElementById('manageUsersModalBack');
  if (modal) modal.remove();
}

// Render users grid in Manage Users modal
async function renderManageUsers() {
  try {
    const result = await api('listUsers', {});
    if (!result.ok) return;

    const gridEl = document.getElementById('manageUsersGrid');
    if (!gridEl) return;

    let html = '';

    // User cards
    for (const user of result.users) {
      const isWholeFamilyUser = user.name === 'Whole Family';

      // Get dietary restrictions
      const restrictionsResult = await api('getUserDietaryRestrictions', { userId: user.userId });
      const restrictions = restrictionsResult.ok ? restrictionsResult.restrictions : [];

      html += `
            <div class="user-card">
              <div class="user-card-avatar">${user.avatarEmoji || '👤'}</div>
              <div class="user-card-name">${escapeHtml(user.name)}</div>
              ${user.email ? `<div class="user-card-email">${escapeHtml(user.email)}</div>` : '<div class="user-card-email" style="opacity:0;">-</div>'}
              <div class="user-card-restrictions">
                ${restrictions.map(r => `
                  <span class="user-restriction-badge">${escapeHtml(r.name)}</span>
                `).join('')}
              </div>
              <div class="user-card-actions">
                <button class="ghost mini" onclick="openUserProfileEditor('${user.userId}')">
                  Edit
                </button>
                ${!isWholeFamilyUser ? `
                  <button class="danger mini" onclick="deleteUserWithConfirmation('${user.userId}', '${escapeHtml(user.name).replace(/'/g, "\\'")}')">
                    Delete
                  </button>
                ` : '<div style="flex:1;"></div>'}
              </div>
            </div>
          `;
    }

    // Add new user card
    html += `
          <div class="user-card add-user-card" onclick="openUserProfileEditor(null)">
            <div class="add-user-icon">+</div>
            <div class="add-user-text">Add New User</div>
          </div>
        `;

    gridEl.innerHTML = html;
  } catch (e) {
    console.error('Failed to render manage users:', e);
  }
}

// Open user profile editor (create or edit)
async function openUserProfileEditor(userId) {
  const isNew = !userId;
  let user = null;
  let restrictions = [];

  if (!isNew) {
    // Load existing user
    const userResult = await api('getUser', { userId });
    if (!userResult.ok) {
      showToast('Failed to load user', 'error');
      return;
    }
    user = userResult.user;

    // Load dietary restrictions
    const restrictionsResult = await api('getUserDietaryRestrictions', { userId });
    if (restrictionsResult.ok) {
      restrictions = restrictionsResult.restrictions;
    }
  }

  const modalHtml = `
        <div id="userProfileEditorBack" class="modalBack" style="display:flex;">
          <div class="modal" style="max-width:600px;">
            <div class="modalHead">
              <h2>${isNew ? 'Create New User' : 'Edit User Profile'}</h2>
              <button class="ghost mini" onclick="closeUserProfileEditor()">✕</button>
            </div>
            <div style="margin-top:16px;">
              <div class="row">
                <div class="col-12">
                  <label>Avatar Emoji</label>
                  <div id="emojiPickerGrid" class="emoji-picker-grid">
                    <!-- Populated by renderEmojiPicker() -->
                  </div>
                  <input type="hidden" id="selectedEmoji" value="${user ? user.avatarEmoji : '👤'}" />
                </div>
              </div>
              
              <div class="row">
                <div class="col-12">
                  <label>Name *</label>
                  <input type="text" id="userName" value="${user ? escapeHtml(user.name) : ''}" placeholder="e.g., Keith, Sarah, Kids" />
                </div>
              </div>
              
              <div class="row">
                <div class="col-12">
                  <label>Email (optional)</label>
                  <input type="email" id="userEmail" value="${user ? escapeHtml(user.email || '') : ''}" placeholder="email@example.com" />
                </div>
              </div>
              
              <div class="row">
                <div class="col-12">
                  <label>Dietary Restrictions</label>
                  <div id="dietaryRestrictionsGrid" class="dietary-restrictions-grid">
                    <!-- Populated by renderDietaryRestrictions() -->
                  </div>
                </div>
              </div>
              
              <div class="hr"></div>
              
              <div class="actions">
                <button class="primary" onclick="saveUserProfile(${isNew ? 'null' : `'${userId}'`})">
                  ${isNew ? 'Create User' : 'Save Changes'}
                </button>
                <button class="ghost" onclick="closeUserProfileEditor()">Cancel</button>
              </div>
              
              <div id="userProfileStatus" style="margin-top:12px; font-size:13px;"></div>
            </div>
          </div>
        </div>
      `;

  document.body.insertAdjacentHTML('beforeend', modalHtml);

  // Render emoji picker
  renderEmojiPicker(user ? user.avatarEmoji : '👤');

  // Render dietary restrictions
  await renderDietaryRestrictions(userId, restrictions);
}

// Close user profile editor
function closeUserProfileEditor() {
  const modal = document.getElementById('userProfileEditorBack');
  if (modal) modal.remove();
}

// Render emoji picker grid
function renderEmojiPicker(selectedEmoji = '👤') {
  const gridEl = document.getElementById('emojiPickerGrid');
  if (!gridEl) return;

  // Common people/family emojis
  const emojis = [
    '👤', '👨', '👩', '👶', '🧒', '👦', '👧',
    '🧑', '👨‍🦰', '👩‍🦰', '👨‍🦱', '👩‍🦱', '👨‍🦳', '👩‍🦳',
    '👨‍🦲', '👩‍🦲', '🧔', '👴', '👵', '👨‍👩‍👧‍👦', '👨‍👩‍👧',
    '👨‍👩‍👦', '👪', '👨‍👦', '👩‍👦', '👨‍👧', '👩‍👧'
  ];

  let html = '';
  for (const emoji of emojis) {
    const isSelected = emoji === selectedEmoji;
    html += `
          <div class="emoji-option ${isSelected ? 'selected' : ''}" 
               onclick="selectEmoji('${emoji}')">
            ${emoji}
          </div>
        `;
  }

  gridEl.innerHTML = html;
}

// Select emoji
function selectEmoji(emoji) {
  // Update hidden input
  document.getElementById('selectedEmoji').value = emoji;

  // Update visual selection
  const options = document.querySelectorAll('.emoji-option');
  options.forEach(opt => opt.classList.remove('selected'));
  event.target.classList.add('selected');
}

// Render dietary restrictions checkboxes
async function renderDietaryRestrictions(userId, userRestrictions = []) {
  try {
    const gridEl = document.getElementById('dietaryRestrictionsGrid');
    if (!gridEl) return;

    // Get all dietary restrictions
    const result = await api('listDietaryRestrictions', {});
    if (!result.ok) return;

    const userRestrictionIds = new Set(userRestrictions.map(r => r.restrictionId));

    let html = '';
    for (const restriction of result.restrictions) {
      const isChecked = userRestrictionIds.has(restriction.restrictionId);

      html += `
            <label class="dietary-restriction-option">
              <input type="checkbox" 
                     class="dietary-restriction-checkbox"
                     value="${restriction.restrictionId}"
                     ${isChecked ? 'checked' : ''} />
              <div class="dietary-restriction-content">
                <div class="dietary-restriction-name">${escapeHtml(restriction.name)}</div>
                <div class="dietary-restriction-desc">${escapeHtml(restriction.description || '')}</div>
              </div>
            </label>
          `;
    }

    gridEl.innerHTML = html;
  } catch (e) {
    console.error('Failed to render dietary restrictions:', e);
  }
}

// Save user profile (create or update)
async function saveUserProfile(userId) {
  try {
    const statusEl = document.getElementById('userProfileStatus');
    if (statusEl) statusEl.textContent = 'Saving...';

    // Get form values
    const name = document.getElementById('userName').value.trim();
    const email = document.getElementById('userEmail').value.trim();
    const avatarEmoji = document.getElementById('selectedEmoji').value;

    if (!name) {
      showToast('Name is required', 'error');
      if (statusEl) statusEl.textContent = '';
      return;
    }

    // Create or update user
    let result;
    if (!userId) {
      // Create new user
      result = await api('createUser', { name, email, avatarEmoji });
      if (!result.ok) {
        showToast(result.error || 'Failed to create user', 'error');
        if (statusEl) statusEl.textContent = '';
        return;
      }
      userId = result.user.userId;
    } else {
      // Update existing user
      result = await api('updateUser', { userId, name, email, avatarEmoji });
      if (!result.ok) {
        showToast(result.error || 'Failed to update user', 'error');
        if (statusEl) statusEl.textContent = '';
        return;
      }
    }

    // Save dietary restrictions
    const checkboxes = document.querySelectorAll('.dietary-restriction-checkbox');
    const selectedRestrictions = Array.from(checkboxes)
      .filter(cb => cb.checked)
      .map(cb => parseInt(cb.value));

    // Get current restrictions
    const currentResult = await api('getUserDietaryRestrictions', { userId });
    const currentRestrictions = currentResult.ok ? currentResult.restrictions.map(r => r.restrictionId) : [];

    // Add new restrictions
    for (const restrictionId of selectedRestrictions) {
      if (!currentRestrictions.includes(restrictionId)) {
        await api('addUserDietaryRestriction', { userId, restrictionId });
      }
    }

    // Remove unchecked restrictions
    for (const restrictionId of currentRestrictions) {
      if (!selectedRestrictions.includes(restrictionId)) {
        await api('removeUserDietaryRestriction', { userId, restrictionId });
      }
    }

    showToast(`User "${name}" saved successfully`, 'success');

    // Close editor
    closeUserProfileEditor();

    // Refresh manage users modal
    await renderManageUsers();

    // Refresh user switcher list
    await renderUserSwitcherList();

    // If we edited the active user, update the button
    if (ACTIVE_USER && userId === ACTIVE_USER.userId) {
      const activeResult = await api('getActiveUser', {});
      if (activeResult.ok) {
        ACTIVE_USER = activeResult.user;
        // Invalidate recipe cache to reload with new user's favorites
        QUERY_CACHE.recipes = null;
        QUERY_CACHE.recipesFetchTime = 0;
        updateUserSwitcherButton();
      }
    }

  } catch (e) {
    console.error('Failed to save user:', e);
    showToast('Error saving user profile', 'error');
    const statusEl = document.getElementById('userProfileStatus');
    if (statusEl) statusEl.textContent = '';
  }
}

// Delete user with confirmation
async function deleteUserWithConfirmation(userId, userName) {
  if (!confirm(`Are you sure you want to delete user "${userName}"?\n\nThis will remove all their favorites and meal assignments.`)) {
    return;
  }

  try {
    const result = await api('deleteUser', { userId });
    if (!result.ok) {
      showToast(result.error || 'Failed to delete user', 'error');
      return;
    }

    showToast(`User "${userName}" deleted`, 'success');

    // Refresh manage users modal
    await renderManageUsers();

    // Refresh user switcher list
    await renderUserSwitcherList();

    // If we deleted the active user, switch to "Whole Family"
    if (ACTIVE_USER && userId === ACTIVE_USER.userId) {
      const usersResult = await api('listUsers', {});
      if (usersResult.ok && usersResult.users.length > 0) {
        const wholeFamilyUser = usersResult.users.find(u => u.name === 'Whole Family');
        if (wholeFamilyUser) {
          await switchToUser(wholeFamilyUser.userId);
        }
      }
    }

  } catch (e) {
    console.error('Failed to delete user:', e);
    showToast('Error deleting user', 'error');
  }
}

// ============= END PHASE 4.5 MULTI-USER SUPPORT =============

async function init() {
  // Guard to prevent double initialization
  if (window.__FOODIE_INITIALIZED__) {
    console.warn('[Init] Prevented double initialization - init() called twice!');
    return;
  }
  window.__FOODIE_INITIALIZED__ = true;

  // PHASE 5.4: Prevent transitions on initial page load
  document.body.classList.add('no-transitions');

  // Load saved theme
  try {
    const savedTheme = localStorage.getItem('foodieTheme');
    if (savedTheme === 'light') {
      document.documentElement.setAttribute('data-theme', 'light');
    }
  } catch (_) { }

  // Enable transitions after a brief delay
  requestAnimationFrame(() => {
    setTimeout(() => {
      document.body.classList.remove('no-transitions');
    }, 100);
  });

  bindUi();

  // ========== UNIVERSAL MODAL BACKDROP CLICK-TO-CLOSE ==========
  // Add click handlers to all modal backdrops to close when clicking outside
  document.querySelectorAll('.modalBack').forEach(modalBack => {
    modalBack.addEventListener('click', (e) => {
      // Only close if clicking the backdrop itself, not the modal content
      if (e.target === modalBack) {
        const modalId = modalBack.id;
        if (modalId) {
          // Call the appropriate close function based on modal ID
          if (modalId === 'recipeModalBack') {
            closeRecipeModal(e);
          } else {
            closeModal(modalId);
          }
        }
      }
    });
  });

  // Prevent clicks inside modal content from bubbling to backdrop
  document.querySelectorAll('.modal').forEach(modal => {
    modal.addEventListener('click', (e) => {
      e.stopPropagation();
    });
  });

  // ========== LAZY IMAGE LOADING ==========
  // Setup Intersection Observer for lazy loading recipe images
  let imageObserver = null;
  let observedImages = new Set();

  function createImageObserver() {
    return new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const imgEl = entry.target;
          const src = imgEl.dataset.src;
          if (src) {
            imgEl.style.backgroundImage = `url('${src}')`;
            imgEl.classList.remove('lazy-image');
            if (imageObserver) {
              imageObserver.unobserve(imgEl);
            }
            observedImages.delete(imgEl);
          }
        }
      });
    }, {
      rootMargin: '50px' // Start loading 50px before entering viewport
    });
  }

  imageObserver = createImageObserver();

  // Function to observe new lazy images
  window.observeLazyImages = function () {
    // Batch process to avoid blocking main thread
    const lazyImages = document.querySelectorAll('.lazy-image:not([data-observed])');
    if (lazyImages.length === 0) return;

    // Process in chunks to prevent freeze
    const chunkSize = 20;
    let index = 0;

    function processChunk() {
      const end = Math.min(index + chunkSize, lazyImages.length);
      for (let i = index; i < end; i++) {
        const img = lazyImages[i];
        if (!observedImages.has(img)) {
          img.setAttribute('data-observed', 'true');
          observedImages.add(img);
          imageObserver.observe(img);
        }
      }
      index = end;
      if (index < lazyImages.length) {
        requestAnimationFrame(processChunk);
      }
    }

    requestAnimationFrame(processChunk);
  };

  // Function to reset observer when switching views or applying filters
  window.resetImageObserver = function () {
    if (imageObserver) {
      imageObserver.disconnect();
    }
    observedImages.clear();
    imageObserver = createImageObserver();
  };

  // Phase 3.1: Load recent history from localStorage (fast, sync)
  loadRecentHistory();

  // ========== PHASE 9.7: OPTIMIZED STARTUP - CRITICAL PATH ONLY ==========
  console.log('[Phase 9.7] Starting optimized init...');

  fillJumpLetters(); // Fast, sync operation

  const today = ymd(new Date());
  const weekEnd = addDays(today, 6);

  // Set default dates (fast, sync)
  document.getElementById('planStart').value = today;
  document.getElementById('planEnd').value = weekEnd;
  document.getElementById('genStartDate').value = today;
  document.getElementById('genEndDate').value = weekEnd;
  document.getElementById('googleSyncStart').value = today;
  document.getElementById('googleSyncEnd').value = weekEnd;
  document.getElementById('bulkStart').value = today;
  document.getElementById('shopStart').value = today;
  document.getElementById('clearStart').value = today;

  // Load stores (needed for many operations, fast query)
  try { await loadStores(); } catch (_) { }

  // ========== CRITICAL: Load Home Dashboard tab data ==========
  // Home Dashboard is the NEW default tab
  try {
    await renderDashboard();
    TAB_LOADED.home = true;
  } catch (e) {
    console.error('Failed to load dashboard:', e);
  }

  // ========== CRITICAL: Load Planner tab data in background ==========
  // Planner is no longer default but we still want it relatively soon
  try {
    await loadPlan();
    TAB_LOADED.planner = true;
  } catch (e) {
    console.error('Failed to load initial plan:', e);
    if (PLAN.viewMode === 'grid') {
      PLAN.start = today;
      PLAN.days = 7;
      renderPlanGrid();
    }
  }

  // ========== DEFERRED: Load non-critical data after initial render ==========
  // Use requestIdleCallback or setTimeout to defer these
  const deferredInit = async () => {
    console.log('[Phase 9.7] Loading deferred init tasks...');

    // Load ingredient categories (needed for forms, but not immediate)
    try {
      console.log('[Phase 9.7] Loading ingredient categories...');
      const catRes = await api('getIngredientCategories', {});
      const ta = document.getElementById('adminCategoriesText');

      if (catRes && catRes.ok && Array.isArray(catRes.categories) && catRes.categories.length > 0) {
        console.log(`[Phase 9.7] Loaded ${catRes.categories.length} categories from DB:`, catRes.categories);
        META.categories = [''].concat(catRes.categories);
        META.categoriesLoaded = true;
        if (ta) ta.value = catRes.categories.join('\n');
      } else {
        console.log('[Phase 9.7] No categories found in DB, using defaults');
        META.categories = [''].concat(DEFAULT_ING_CATEGORIES);
        META.categoriesLoaded = true;
        if (ta) ta.value = DEFAULT_ING_CATEGORIES.join('\n');
      }
    } catch (e) {
      console.error('[Phase 9.7] Error loading categories:', e);
      const ta = document.getElementById('adminCategoriesText');
      META.categories = [''].concat(DEFAULT_ING_CATEGORIES);
      META.categoriesLoaded = true;
      if (ta) ta.value = DEFAULT_ING_CATEGORIES.join('\n');
    }

    // Populate cuisine filter (needed for filters, but not immediate)
    populateCuisineFilter();

    // Check Google Calendar status (non-blocking)
    try {
      await checkGoogleCalendarStatus();
    } catch (_) { }

    // Populate quick add cuisines (only needed when using quick add)
    try {
      await populateQuickAddCuisines();
    } catch (_) { }

    // Initialize command palette (only needed when user presses Cmd+K)
    try {
      initCommandPalette();
    } catch (_) { }

    // Initialize user switcher (loads users)
    try {
      await initUserSwitcher();
    } catch (_) { }

    // Initialize help search (only needed on Admin tab)
    try {
      initHelpSearch();
    } catch (_) { }

    // Initialize contextual help button
    try {
      updateContextualHelpButton();
    } catch (_) { }

    // Load recipes for suggestions (non-blocking, needed for meal suggestions)
    try {
      console.log('[Phase 9.7] Loading recipes for suggestions...');
      await resetAndLoadRecipes();
      console.log('[Phase 9.7] Recipes loaded:', RECIPES.length);
    } catch (e) {
      console.error('[Phase 9.7] Failed to load recipes:', e);
    }

    // Initialize recipe export controls (disable bulk action buttons until recipes selected)
    try {
      updateRecipeExportControls();
    } catch (_) { }

    console.log('[Phase 9.7] Deferred init complete');
  };

  // Schedule deferred initialization
  if (window.requestIdleCallback) {
    requestIdleCallback(deferredInit, { timeout: 2000 });
  } else {
    setTimeout(deferredInit, 100);
  }

  console.log('[Phase 9.7] Initial render complete - Time to Interactive');
}

// ========== PHASE 9.8: TAB VISIBILITY TRACKING ==========
// Pause animations when tab is hidden to save battery
function updateTabVisibility_() {
  if (document.hidden) {
    document.body.classList.remove('tab-visible');
    console.log('[Phase 9.8] Tab hidden - pausing animations');
  } else {
    document.body.classList.add('tab-visible');
    console.log('[Phase 9.8] Tab visible - resuming animations');
  }
}

// Listen for visibility changes
document.addEventListener('visibilitychange', updateTabVisibility_);

// Set initial state
if (!document.hidden) {
  document.body.classList.add('tab-visible');
}

window.addEventListener('load', init);

// Companion Panel JavaScript
let companionCurrentRecipeId = null;

// Listen for main process logs
Foodie.onCompanionLog((event, data) => {
  const prefix = data.level === 'error' ? '❌ MAIN:' :
    data.level === 'warn' ? '⚠️  MAIN:' :
      data.level === 'success' ? '✅ MAIN:' : '📱 MAIN:';
  console.log(prefix, data.message);
});

function toggleCompanionPanel() {
  const panel = document.getElementById('companionPanel');
  panel.classList.toggle('show');
  if (panel.classList.contains('show')) {
    panel.scrollTop = 0;
    updateCompanionDevices();
  }
}

const companionBtn = document.getElementById('companionFloatBtn');
console.log('companionFloatBtn element:', companionBtn);
if (companionBtn) {
  companionBtn.addEventListener('click', toggleCompanionPanel);
  console.log('Added click listener to companionFloatBtn');
} else {
  console.error('companionFloatBtn not found!');
}

async function updateCompanionDevices() {
  try {
    const result = await Foodie.getCompanionDevices();
    if (result.ok && result.devices) {
      const statusDot = document.getElementById('companionStatusDot');
      const statusText = document.getElementById('companionStatusText');

      const pairedCount = result.devices.filter(d => d.authenticated).length;
      
      if (result.devices.length === 0) {
        statusDot.classList.add('offline');
        statusText.textContent = 'Server ready (no devices)';
      } else {
        statusDot.classList.remove('offline');
        const connectedMsg = `${result.devices.length} connected`;
        const pairedMsg = pairedCount > 0 ? `, ${pairedCount} paired` : '';
        statusText.textContent = connectedMsg + pairedMsg;
      }

      // Update server address - show the actual local IP
      const serverAddr = document.getElementById('companionServerAddress');
      const interfaces = await getLocalIP();
      if (interfaces) {
        serverAddr.textContent = interfaces;
      } else {
        serverAddr.textContent = 'ws://[checking...]:8080';
      }
    }

    await updatePairingCode();
    await updateTrustedDevices();
  } catch (e) {
    console.error('Failed to get companion devices:', e);
  }
}

async function updatePairingCode() {
  try {
    const result = await Foodie.getPairingCode();
    const codeEl = document.getElementById('companionPairingCode');
    if (result.ok && result.code && codeEl) {
      codeEl.textContent = result.code;
    }
  } catch (e) {
    console.error('Failed to get pairing code:', e);
  }
}

async function regeneratePairingCode() {
  try {
    const result = await Foodie.regeneratePairingCode();
    if (result.ok && result.code) {
      const codeEl = document.getElementById('companionPairingCode');
      if (codeEl) {
        codeEl.textContent = result.code;
        codeEl.style.animation = 'none';
        void codeEl.offsetWidth;
        codeEl.style.animation = 'pulse 0.5s ease';
      }
      showToast('New pairing code generated', 'success');
    }
  } catch (e) {
    console.error('Failed to regenerate pairing code:', e);
    showToast('Failed to generate new code', 'error');
  }
}

async function updateTrustedDevices() {
  try {
    const result = await Foodie.getTrustedDevices();
    const listEl = document.getElementById('companionTrustedDeviceList');
    if (!listEl) return;

    if (!result.ok || !result.devices || result.devices.length === 0) {
      listEl.innerHTML = '<div class="muted" style="font-size:12px;">No paired devices</div>';
      return;
    }

    listEl.innerHTML = result.devices.map(d => {
      const lastSeen = d.lastSeen ? new Date(d.lastSeen).toLocaleDateString() : 'Never';
      const statusIcon = d.isOnline ? '🟢' : '⚪';
      const deviceIcon = d.type === 'iPad' ? '📱' : '📱';
      const deviceType = d.type === 'iPad' ? 'iPad' : d.type === 'iPhone' ? 'iPhone' : '';
      const typeLabel = deviceType ? ` (${deviceType})` : '';
      return `
        <div class="companion-trusted-device" style="display:flex; justify-content:space-between; align-items:center; padding:8px; background:rgba(255,255,255,0.04); border-radius:8px; margin-bottom:6px;">
          <div>
            <div style="font-size:13px;">${statusIcon} ${deviceIcon} ${escapeHtml(d.name || 'Unknown Device')}${typeLabel}</div>
            <div class="muted" style="font-size:10px;">Last seen: ${lastSeen}</div>
          </div>
          <button class="mini danger" onclick="untrustDevice('${escapeAttr(d.deviceId)}')" title="Remove device">✕</button>
        </div>
      `;
    }).join('');
  } catch (e) {
    console.error('Failed to get trusted devices:', e);
  }
}

async function untrustDevice(deviceId) {
  if (!confirm('Remove this device? It will need to re-enter the pairing code to connect again.')) {
    return;
  }
  try {
    const result = await Foodie.untrustDevice(deviceId);
    if (result.ok) {
      showToast('Device removed', 'success');
      await updateTrustedDevices();
      await updateCompanionDevices();
    } else {
      showToast('Failed to remove device', 'error');
    }
  } catch (e) {
    console.error('Failed to untrust device:', e);
    showToast('Error removing device', 'error');
  }
}

async function sendShoppingListToPhones() {
  console.log('🔵 RENDERER: sendShoppingListToPhones called');
  try {
    // Collect all items from the current SHOP.groups
    const items = [];
    if (SHOP.groups && SHOP.groups.length > 0) {
      for (const group of SHOP.groups) {
        // Fix: resolve store name from StoreId using getStoreNameById
        const storeName = getStoreNameById(group.StoreId) || group.StoreId || 'Unassigned';
        for (const item of (group.Items || [])) {
          items.push({
            id: `${storeName}-${item.IngredientNorm || item.DisplayTitle}`,
            IngredientNorm: item.IngredientNorm || item.DisplayTitle || '',
            name: item.DisplayTitle || item.IngredientNorm || '',
            QtyText: item.QtyText || '',
            Unit: item.Unit || '',
            Category: item.Category || '',
            StoreName: storeName,
            store: storeName,
            isPurchased: false
          });
        }
      }
    }

    console.log(`🔵 RENDERER: Sending ${items.length} items from current shopping list`);
    console.log('🔵 RENDERER: Calling Foodie.sendShoppingListToPhones()...');
    const result = await Foodie.sendShoppingListToPhones(items);
    console.log('🔵 RENDERER: Result:', result);
    if (result.ok) {
      console.log(`🔵 RENDERER: Success! Count: ${result.count}`);
      if (items.length > 0) {
        showToast(`Shopping list (${items.length} items) sent to ${result.count} device(s)`, 'success');
      } else {
        showToast(`Shopping list sent to ${result.count} device(s) (generated from today's meals)`, 'success');
      }
    } else {
      console.error('🔴 RENDERER: Failed:', result.error);
      showToast('Failed to send: ' + (result.error || 'Unknown error'), 'error');
    }
  } catch (e) {
    console.error('🔴 RENDERER: Exception:', e);
    showToast('Error: ' + e.message, 'error');
  }
}

async function sendTodaysMealsToTablets() {
  console.log('🔵 RENDERER: sendTodaysMealsToTablets called');
  try {
    console.log('🔵 RENDERER: Calling Foodie.sendTodaysMealsToTablets()...');
    const result = await Foodie.sendTodaysMealsToTablets();
    console.log('🔵 RENDERER: Result:', result);
    if (result.ok) {
      console.log(`🔵 RENDERER: Success! Count: ${result.count}`);
      showToast(`Today's meals sent to ${result.count} device(s)`, 'success');
    } else {
      console.error('🔴 RENDERER: Failed:', result.error);
      showToast('Failed to send: ' + (result.error || 'Unknown error'), 'error');
    }
  } catch (e) {
    console.error('🔴 RENDERER: Exception:', e);
    showToast('Error: ' + e.message, 'error');
  }
}

async function sendCurrentRecipeToTablet() {
  if (!companionCurrentRecipeId) {
    showToast('No recipe selected', 'warning');
    return;
  }
  try {
    const result = await Foodie.sendRecipeToTablet(companionCurrentRecipeId);
    if (result.ok) {
      showToast(`Recipe sent to ${result.count} device(s)`, 'success');
    } else {
      showToast('Failed to send: ' + (result.error || 'Unknown error'), 'error');
    }
  } catch (e) {
    showToast('Error: ' + e.message, 'error');
  }
}

// Get local IP address for display
async function getLocalIP() {
  try {
    const result = await Foodie.getServerIP();
    if (result.ok && result.ip) {
      return `ws://${result.ip}:8080`;
    }
    return 'ws://[check console]:8080';
  } catch (e) {
    return 'ws://[unavailable]:8080';
  }
}

// Listen for device changes (debounced to prevent flashing)
let _companionUpdateTimeout = null;
if (typeof Foodie !== 'undefined' && Foodie.onCompanionDevicesChanged) {
  Foodie.onCompanionDevicesChanged((devices) => {
    // Only update if panel is visible
    const panel = document.getElementById('companionPanel');
    if (panel && panel.classList.contains('show')) {
      // Debounce updates to prevent rapid flashing
      if (_companionUpdateTimeout) clearTimeout(_companionUpdateTimeout);
      _companionUpdateTimeout = setTimeout(() => {
        updateCompanionDevices();
      }, 300);
    }
  });
}

// Listen for pantry updates from iPhone barcode scanner
if (typeof Foodie !== 'undefined' && Foodie.onPantryUpdated) {
  Foodie.onPantryUpdated((data) => {
    console.log('📦 Pantry updated from companion device:', data);
    loadPantry();
    if (data && data.item) {
      showToast(`Added to pantry: ${data.item}`, 'success', 3000);
    }
  });
}

// Listen for pairing code changes (when code is regenerated from main process)
if (typeof Foodie !== 'undefined' && Foodie.onPairingCodeChanged) {
  Foodie.onPairingCodeChanged((data) => {
    console.log('🔑 Pairing code changed:', data.code);
    const codeEl = document.getElementById('companionPairingCode');
    if (codeEl && data.code) {
      codeEl.textContent = data.code;
    }
  });
}

// Update devices every 10 seconds if panel is open
setInterval(() => {
  const panel = document.getElementById('companionPanel');
  if (panel && panel.classList.contains('show')) {
    updateCompanionDevices();
  }
}, 10000);

// ============= TOAST NOTIFICATIONS =============
// toastCounter is already declared at top level (line 431)

// ============= PHASE 5.5: SKELETON LOADERS & ANIMATIONS =============

/**
 * Show skeleton loader for recipe list
 * @param {string} containerId - Container element ID
 * @param {number} count - Number of skeleton items to show
 */
function showRecipeListSkeleton(containerId, count = 15) {
  const container = document.getElementById(containerId);
  if (!container) return;

  let html = '<div class="skeleton-recipe-list">';
  for (let i = 0; i < count; i++) {
    html += `
        <div class="skeleton-recipe-item">
          <div class="skeleton-recipe-content">
            <div class="skeleton skeleton-title"></div>
            <div class="skeleton skeleton-line short"></div>
            <div class="skeleton skeleton-line medium"></div>
          </div>
        </div>
      `;
  }
  html += '</div>';
  container.innerHTML = html;
}

/**
 * Show skeleton loader for meal planner
 * @param {string} containerId - Container element ID
 * @param {number} days - Number of days to show
 */
function showPlannerSkeleton(containerId, days = 7) {
  const container = document.getElementById(containerId);
  if (!container) return;

  let html = '<div class="skeleton-planner">';
  for (let i = 0; i < days; i++) {
    html += `
        <div class="skeleton-day-card">
          <div class="skeleton skeleton-text h2"></div>
          <div class="skeleton-meal-slot">
            <div class="skeleton skeleton-line short"></div>
          </div>
          <div class="skeleton-meal-slot">
            <div class="skeleton skeleton-line short"></div>
          </div>
          <div class="skeleton-meal-slot">
            <div class="skeleton skeleton-line short"></div>
          </div>
        </div>
      `;
  }
  html += '</div>';
  container.innerHTML = html;
}

/**
 * Show skeleton loader for user cards
 * @param {string} containerId - Container element ID
 * @param {number} count - Number of user cards
 */
function showUserCardsSkeleton(containerId, count = 4) {
  const container = document.getElementById(containerId);
  if (!container) return;

  let html = '<div class="skeleton-user-grid">';
  for (let i = 0; i < count; i++) {
    html += `
        <div class="skeleton-user-card">
          <div class="skeleton skeleton-avatar"></div>
          <div class="skeleton skeleton-text h2"></div>
          <div class="skeleton skeleton-line short"></div>
        </div>
      `;
  }
  html += '</div>';
  container.innerHTML = html;
}

/**
 * Show generic loading overlay
 * @param {string} containerId - Container element ID
 * @param {boolean} show - Show or hide
 */
function showLoadingOverlay(containerId, show = true) {
  const container = document.getElementById(containerId);
  if (!container) return;

  let overlay = container.querySelector('.loading-overlay');

  if (show) {
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.className = 'loading-overlay';
      overlay.innerHTML = '<div class="loading-spinner"></div>';
      container.style.position = 'relative';
      container.appendChild(overlay);
    }
    requestAnimationFrame(() => {
      overlay.classList.add('active');
    });
  } else {
    if (overlay) {
      overlay.classList.remove('active');
      setTimeout(() => {
        if (overlay.parentNode) {
          overlay.remove();
        }
      }, 200);
    }
  }
}

/**
 * Add fade-in animation to content
 * @param {HTMLElement} element - Element to animate
 */
function fadeInContent(element) {
  if (!element) return;
  element.classList.add('fade-in');
}

/**
 * Add stagger animation to children
 * @param {HTMLElement} container - Container element
 */
function staggerChildren(container) {
  if (!container) return;
  container.classList.add('stagger-children');
}

/**
 * Trigger shake animation (for errors)
 * @param {HTMLElement} element - Element to shake
 */
function shakeElement(element) {
  if (!element) return;
  element.classList.add('shake');
  setTimeout(() => {
    element.classList.remove('shake');
  }, 400);
}

/**
 * Animate modal opening with enhanced transitions
 * @param {string} modalId - Modal element ID
 */
function openModalAnimated(modalId) {
  const modal = document.getElementById(modalId);
  if (!modal) return;

  modal.style.display = 'flex';
  // Animation is handled by CSS
}

/**
 * Animate modal closing
 * @param {string} modalId - Modal element ID
 */
function closeModalAnimated(modalId, callback) {
  const modal = document.getElementById(modalId);
  if (!modal) return;

  const modalContent = modal.querySelector('.modal');
  if (modalContent) {
    modalContent.style.animation = 'slideUpModal 0.2s cubic-bezier(0.4, 0, 0.6, 1) reverse';
  }

  setTimeout(() => {
    modal.style.display = 'none';
    if (modalContent) {
      modalContent.style.animation = '';
    }
    if (callback) callback();
  }, 200);
}

// ============= END SKELETON LOADERS & ANIMATIONS =============

// ============= PHASE 8.1: FIRST-RUN TOUR =============

let currentTourStep = 0;
const tourSteps = [
  {
    target: '[data-tab="planner"]',
    title: 'Meal Planner',
    description: 'Plan your meals for the week with our intuitive meal planner. Drag and drop recipes, assign meals to family members, and organize your week effortlessly.'
  },
  {
    target: '[data-tab="recipes"]',
    title: 'Recipe Library',
    description: 'Browse over 3,000 professionally curated recipes. Search by cuisine, meal type, ingredients, or dietary preferences. Save your favorites to collections for quick access.'
  },
  {
    target: '[data-tab="shop"]',
    title: 'Shopping List',
    description: 'Auto-generate shopping lists from your meal plans. Ingredients are organized by store category, and you can add custom items while shopping.'
  },
  {
    target: '#btnUserSwitcher',
    title: 'Multi-User Profiles',
    description: 'Create profiles for each family member. Assign meals to specific people, track individual preferences, and manage dietary restrictions.'
  },
  {
    target: '#btnStartTour',
    title: 'Companion Apps',
    description: 'Connect your iPad as a kitchen display and iPhone as a shopping assistant. Sync meal plans and shopping lists in real-time across all devices.'
  },
  {
    target: '[data-tab="collections"]',
    title: 'Recipe Collections',
    description: 'Organize recipes into custom collections like "Quick Weeknight Dinners" or "Holiday Favorites". Add entire collections to your meal plan with one click.'
  },
  {
    target: '#btnThemeToggle',
    title: 'Personalize Your Experience',
    description: 'Toggle between light and dark modes, customize settings, and configure integrations like Google Calendar sync. Access settings from the Admin tab.'
  }
];

function startTour() {
  currentTourStep = 0;
  document.getElementById('tourOverlay').style.display = 'block';
  showTourStep(0);
}

function showTourStep(index) {
  if (index < 0 || index >= tourSteps.length) return;

  currentTourStep = index;
  const step = tourSteps[index];

  // Update tour card content
  document.getElementById('tourTitle').textContent = step.title;
  document.getElementById('tourDescription').textContent = step.description;
  document.getElementById('tourStepIndicator').textContent = `Step ${index + 1} of ${tourSteps.length}`;

  // Update button states
  document.getElementById('btnTourPrevious').disabled = index === 0;
  const nextBtn = document.getElementById('btnTourNext');
  if (index === tourSteps.length - 1) {
    nextBtn.textContent = 'Finish';
    nextBtn.classList.add('primary');
  } else {
    nextBtn.textContent = 'Next →';
    nextBtn.classList.add('primary');
  }

  // Position spotlight on target element
  const target = document.querySelector(step.target);
  if (target) {
    const rect = target.getBoundingClientRect();
    const spotlight = document.getElementById('tourSpotlight');

    spotlight.style.left = `${rect.left - 8}px`;
    spotlight.style.top = `${rect.top - 8}px`;
    spotlight.style.width = `${rect.width + 16}px`;
    spotlight.style.height = `${rect.height + 16}px`;

    // Position tour card
    positionTourCard(rect);
  }
}

function positionTourCard(targetRect) {
  const card = document.getElementById('tourCard');
  const cardRect = card.getBoundingClientRect();
  const padding = 20;
  const windowWidth = window.innerWidth;
  const windowHeight = window.innerHeight;

  let left, top;

  // Try to position below target
  if (targetRect.bottom + cardRect.height + padding < windowHeight) {
    top = targetRect.bottom + padding;
    left = targetRect.left + (targetRect.width / 2) - (cardRect.width / 2);
  }
  // Try above target
  else if (targetRect.top - cardRect.height - padding > 0) {
    top = targetRect.top - cardRect.height - padding;
    left = targetRect.left + (targetRect.width / 2) - (cardRect.width / 2);
  }
  // Position to the right
  else if (targetRect.right + cardRect.width + padding < windowWidth) {
    top = targetRect.top + (targetRect.height / 2) - (cardRect.height / 2);
    left = targetRect.right + padding;
  }
  // Position to the left
  else if (targetRect.left - cardRect.width - padding > 0) {
    top = targetRect.top + (targetRect.height / 2) - (cardRect.height / 2);
    left = targetRect.left - cardRect.width - padding;
  }
  // Fallback: center on screen
  else {
    top = (windowHeight - cardRect.height) / 2;
    left = (windowWidth - cardRect.width) / 2;
  }

  // Ensure card stays within viewport
  left = Math.max(padding, Math.min(left, windowWidth - cardRect.width - padding));
  top = Math.max(padding, Math.min(top, windowHeight - cardRect.height - padding));

  card.style.left = `${left}px`;
  card.style.top = `${top}px`;
}

function nextTourStep() {
  if (currentTourStep < tourSteps.length - 1) {
    showTourStep(currentTourStep + 1);
  } else {
    completeTour();
  }
}

function previousTourStep() {
  if (currentTourStep > 0) {
    showTourStep(currentTourStep - 1);
  }
}

function skipTour() {
  document.getElementById('tourOverlay').style.display = 'none';
  try {
    localStorage.setItem('foodieTourCompleted', 'skipped');
  } catch (e) {
    console.warn('Could not save tour state:', e);
  }
}

function completeTour() {
  document.getElementById('tourOverlay').style.display = 'none';
  try {
    localStorage.setItem('foodieTourCompleted', 'true');
  } catch (e) {
    console.warn('Could not save tour state:', e);
  }
  showToast('Tour complete! Explore the app to discover more features.', 'success');
}

// Handle window resize during tour
window.addEventListener('resize', () => {
  const overlay = document.getElementById('tourOverlay');
  if (overlay && overlay.style.display !== 'none') {
    showTourStep(currentTourStep);
  }
});

// ============= END FIRST-RUN TOUR =============

// ============= PHASE 8.2: CONTEXTUAL HELP FUNCTIONS =============

/**
 * Toggle FAQ item open/closed
 * @param {HTMLElement} questionElement - The question element clicked
 */
function toggleFaq(questionElement) {
  const faqItem = questionElement.closest('.faq-item');
  if (!faqItem) return;

  // Close other FAQs
  const wasOpen = faqItem.classList.contains('open');
  document.querySelectorAll('.faq-item.open').forEach(item => {
    if (item !== faqItem) {
      item.classList.remove('open');
    }
  });

  // Toggle current FAQ
  if (wasOpen) {
    faqItem.classList.remove('open');
  } else {
    faqItem.classList.add('open');
  }
}

/**
 * Filter FAQ items based on search query
 * @param {string} query - Search query
 */
function filterFaqItems(query) {
  const normalizedQuery = query.toLowerCase().trim();
  const faqItems = document.querySelectorAll('.faq-item');
  let visibleCount = 0;

  faqItems.forEach(item => {
    const questionText = item.querySelector('.faq-question-text').textContent.toLowerCase();
    const answerText = item.querySelector('.faq-answer').textContent.toLowerCase();
    const keywords = (item.getAttribute('data-keywords') || '').toLowerCase();

    const matches = normalizedQuery === '' ||
      questionText.includes(normalizedQuery) ||
      answerText.includes(normalizedQuery) ||
      keywords.includes(normalizedQuery);

    if (matches) {
      item.style.display = '';
      visibleCount++;

      // Auto-expand if searching
      if (normalizedQuery !== '') {
        item.classList.add('open');
      }
    } else {
      item.style.display = 'none';
      item.classList.remove('open');
    }
  });

  // Show "no results" message if needed
  let noResultsMsg = document.getElementById('helpNoResults');
  if (visibleCount === 0 && normalizedQuery !== '') {
    if (!noResultsMsg) {
      noResultsMsg = document.createElement('div');
      noResultsMsg.id = 'helpNoResults';
      noResultsMsg.className = 'help-text warning';
      noResultsMsg.innerHTML = `
          <span>No help topics found for "${escapeHtml(query)}". Try different keywords or take the tour by clicking the 🎯 button.</span>
        `;
      document.getElementById('faqContainer').appendChild(noResultsMsg);
    }
  } else if (noResultsMsg) {
    noResultsMsg.remove();
  }
}

/**
 * Initialize help search functionality
 */
function initHelpSearch() {
  const searchInput = document.getElementById('helpSearchInput');
  if (!searchInput) return;

  let searchTimeout;
  searchInput.addEventListener('input', (e) => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
      filterFaqItems(e.target.value);
    }, 300); // Debounce 300ms
  });
}

// ============= END CONTEXTUAL HELP FUNCTIONS =============

// ============= PHASE 8.2+: KEYBOARD SHORTCUTS & CONTEXTUAL HELP =============

/**
 * Open keyboard shortcuts modal
 */
function openKeyboardShortcutsModal() {
  const modal = document.getElementById('keyboardShortcutsModal');
  if (modal) {
    modal.style.display = 'flex';
  }
}

/**
 * Close keyboard shortcuts modal
 */
function closeKeyboardShortcutsModal() {
  const modal = document.getElementById('keyboardShortcutsModal');
  if (modal) {
    modal.style.display = 'none';
  }
}

/**
 * Open contextual help based on current tab
 */
function openContextualHelp() {
  const activeTab = document.querySelector('.tab.active');
  if (!activeTab) return;

  const tabName = activeTab.getAttribute('data-tab');

  // Switch to admin tab and open help section
  setTab('admin');

  // Scroll to help section
  setTimeout(() => {
    const helpSection = document.querySelector('#faqContainer');
    if (helpSection) {
      helpSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    // Search for relevant help based on current tab
    const searchInput = document.getElementById('helpSearchInput');
    if (searchInput) {
      const searchQueries = {
        'planner': 'meal planning',
        'recipes': 'recipes',
        'collections': 'collections',
        'shop': 'shopping list',
        'pantry': 'pantry',
        'admin': ''
      };

      const query = searchQueries[tabName] || '';
      if (query) {
        searchInput.value = query;
        filterFaqItems(query);
      }
    }
  }, 300);
}

/**
 * Show/hide contextual help button based on tab
 */
function updateContextualHelpButton() {
  const helpBtn = document.getElementById('contextualHelpBtn');
  if (!helpBtn) return;

  const activeTab = document.querySelector('.tab.active');
  const tabName = activeTab ? activeTab.getAttribute('data-tab') : '';

  // Hide button on admin tab (help is already visible)
  if (tabName === 'admin') {
    helpBtn.style.display = 'none';
  } else {
    helpBtn.style.display = 'flex';
  }
}

// ============= END KEYBOARD SHORTCUTS & CONTEXTUAL HELP =============
// NOTE: Main keyboard shortcuts handler is defined later in the file (around line 13545)
// to avoid duplicate event listeners. See "// ============= KEYBOARD SHORTCUTS ============="

function showToast(message, type = 'info', duration = 5000) {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toastId = `toast-${toastCounter++}`;
  const icons = {
    success: '✓',
    error: '✕',
    info: 'ℹ',
    warning: '⚠'
  };

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.id = toastId;
  toast.innerHTML = `
      <span class="toast-icon">${icons[type] || icons.info}</span>
      <span class="toast-message">${escapeHtml(message)}</span>
      <button class="toast-close" onclick="closeToast('${toastId}')" aria-label="Close">×</button>
    `;

  container.appendChild(toast);

  // Auto-dismiss after duration
  if (duration > 0) {
    setTimeout(() => closeToast(toastId), duration);
  }
}

function closeToast(toastId) {
  const toast = document.getElementById(toastId);
  if (!toast) return;

  toast.classList.add('hiding');
  setTimeout(() => {
    if (toast.parentNode) {
      toast.parentNode.removeChild(toast);
    }
  }, 300);
}

// ============= LOADING STATES =============
function setLoading(button, loading = true, loadingText = 'Loading...') {
  if (!button) return;

  if (loading) {
    button.classList.add('loading');
    button.disabled = true;
    button.dataset.originalText = button.textContent;
    button.textContent = loadingText;
  } else {
    button.classList.remove('loading');
    button.disabled = false;
    if (button.dataset.originalText) {
      button.textContent = button.dataset.originalText;
      delete button.dataset.originalText;
    }
  }
}

// ============= UNDO/REDO SYSTEM =============

/**
 * Push an action onto the undo stack
 * @param {string} type - Action type ('delete_recipe', 'delete_meal', 'clear_range', etc.)
 * @param {object} data - Action-specific data needed to restore
 * @param {string} description - Human-readable description
 */
function pushUndo(type, data, description) {
  UNDO.stack.push({
    type,
    data,
    description,
    timestamp: new Date()
  });

  // Limit stack size
  if (UNDO.stack.length > UNDO.maxSize) {
    UNDO.stack.shift(); // Remove oldest
  }

  // Clear redo stack when new action is performed
  UNDO.redoStack = [];

  console.log(`[Undo] Pushed: ${description}`, { stack: UNDO.stack.length, redo: UNDO.redoStack.length });
}

/**
 * Undo the last action
 */
async function undo() {
  if (UNDO.stack.length === 0) {
    showToast('Nothing to undo', 'info');
    return;
  }

  const action = UNDO.stack.pop();
  console.log(`[Undo] Undoing: ${action.description}`, action);

  try {
    // Restore based on action type
    await restoreAction(action);

    // Move to redo stack
    UNDO.redoStack.push(action);

    showToast(`Undone: ${action.description}`, 'success');
  } catch (e) {
    console.error('[Undo] Failed to undo:', e);
    // Put action back on stack if undo failed
    UNDO.stack.push(action);
    showToast(`Failed to undo: ${e.message}`, 'error');
  }
}

/**
 * Redo the last undone action
 */
async function redo() {
  if (UNDO.redoStack.length === 0) {
    showToast('Nothing to redo', 'info');
    return;
  }

  const action = UNDO.redoStack.pop();
  console.log(`[Undo] Redoing: ${action.description}`, action);

  try {
    // Re-apply the action (inverse of restore)
    await reapplyAction(action);

    // Move back to undo stack
    UNDO.stack.push(action);

    showToast(`Redone: ${action.description}`, 'success');
  } catch (e) {
    console.error('[Undo] Failed to redo:', e);
    // Put action back on redo stack if redo failed
    UNDO.redoStack.push(action);
    showToast(`Failed to redo: ${e.message}`, 'error');
  }
}

/**
 * Restore state from an action (undo)
 */
async function restoreAction(action) {
  switch (action.type) {
    case 'delete_recipe':
      await restoreDeletedRecipe(action.data);
      break;
    case 'delete_meal':
      await restoreDeletedMeal(action.data);
      break;
    case 'clear_range':
      await restoreClearedRange(action.data);
      break;
    case 'delete_additional_item':
      await restoreAdditionalItem(action.data);
      break;
    default:
      console.warn(`[Undo] Unknown action type: ${action.type}`);
  }
}

/**
 * Re-apply an action (redo)
 */
async function reapplyAction(action) {
  switch (action.type) {
    case 'delete_recipe':
      // Re-delete the recipe
      await api('deleteRecipeCascade', { recipeId: action.data.recipe.RecipeId });
      await resetAndLoadRecipes();
      break;
    case 'delete_meal':
      // Phase 4.5.7: Re-delete the meal using upsertUserMeal helper
      await upsertUserMeal(action.data.date, action.data.slot, null);
      await loadPlansIntoUi(PLAN.start, PLAN.days);
      break;
    case 'clear_range':
      // Re-clear the range
      const firstMeal = action.data.meals[0];
      const lastMeal = action.data.meals[action.data.meals.length - 1];
      await api('clearMealsByRange', { start: firstMeal.date, end: lastMeal.date });
      await loadPlansIntoUi(PLAN.start, PLAN.days);
      break;
    case 'delete_additional_item':
      // Re-delete the additional item
      await api('removeAdditionalItem', { id: action.data.item.id });
      await loadPlansIntoUi(PLAN.start, PLAN.days);
      break;
    default:
      console.warn(`[Undo] Unknown action type for redo: ${action.type}`);
  }
}

/**
 * Restore a deleted recipe
 */
async function restoreDeletedRecipe(data) {
  const { recipe, ingredients } = data;
  console.log(`[Undo] Restoring recipe: ${recipe.Title}`);

  const res = await api('upsertRecipeWithIngredients', { recipe, items: ingredients });
  if (!res.ok) {
    throw new Error(res.error || 'Failed to restore recipe');
  }

  await resetAndLoadRecipes();
}

/**
 * Restore a deleted meal
 */
async function restoreDeletedMeal(data) {
  const { date, slot, meals } = data;

  // Phase 4.5.7: Handle array of meals (multi-user support)
  const mealsArray = Array.isArray(meals) ? meals : (meals ? [meals] : [data.meal ? data.meal : null]);

  if (!mealsArray || mealsArray.length === 0) {
    console.warn('[Undo] No meals to restore');
    return;
  }

  console.log(`[Undo] Restoring ${mealsArray.length} meal(s): ${date} ${slot}`);

  // Get active user to assign restored meals
  const activeUserRes = await api('getActiveUser');
  const userId = (activeUserRes.ok && activeUserRes.userId) ? activeUserRes.userId : null;

  if (!userId) {
    throw new Error('No active user set - cannot restore meals');
  }

  // Restore each meal
  for (const meal of mealsArray) {
    if (!meal) continue;

    const res = await api('upsertUserPlanMeal', {
      userId,
      date,
      slot,
      meal: {
        RecipeId: meal.RecipeId || meal.recipeId || '',
        Title: meal.Title || meal.title || '',
        UseLeftovers: meal.UseLeftovers || meal.use_leftovers || false,
        From: meal.From || meal.from_meal || ''
      }
    });

    if (!res.ok) {
      console.error(`Failed to restore meal: ${res.error}`);
    }
  }

  await loadPlansIntoUi(PLAN.start, PLAN.days);
}

/**
 * Restore meals from a cleared range
 */
async function restoreClearedRange(data) {
  const { meals } = data;
  console.log(`[Undo] Restoring ${meals.length} meals`);

  // Phase 4.5.7: Get active user
  const activeUserRes = await api('getActiveUser');
  const userId = (activeUserRes.ok && activeUserRes.userId) ? activeUserRes.userId : null;

  if (!userId) {
    throw new Error('No active user set - cannot restore meals');
  }

  for (const entry of meals) {
    const res = await api('upsertUserPlanMeal', {
      userId,
      date: entry.date || entry.Date,
      slot: entry.slot || entry.Slot,
      meal: {
        RecipeId: entry.RecipeId || entry.recipeId || '',
        Title: entry.Title || entry.title || ''
      }
    });

    if (!res.ok) {
      console.error(`Failed to restore meal at ${entry.date} ${entry.slot}:`, res.error);
    }
  }

  await loadPlansIntoUi(PLAN.start, PLAN.days);
}

/**
 * Restore a deleted additional item
 */
async function restoreAdditionalItem(data) {
  const { date, slot, item } = data;
  console.log(`[Undo] Restoring additional item: ${item.title}`);

  const res = await api('addAdditionalItem', {
    date,
    slot,
    recipeId: item.recipeId,
    title: item.title,
    itemType: item.itemType
  });

  if (!res.ok) {
    throw new Error(res.error || 'Failed to restore additional item');
  }

  await loadPlansIntoUi(PLAN.start, PLAN.days);
}

// ============= KEYBOARD SHORTCUTS =============
document.addEventListener('keydown', (e) => {
  // Esc - Close modals, context menus, and popups
  if (e.key === 'Escape') {
    // Close any open modal
    const modals = document.querySelectorAll('.modalBack[style*="display: flex"], .modalBack[style*="display:flex"]');
    modals.forEach(modal => {
      modal.style.display = 'none';
    });
    // Close context menus and suggestions
    hideRecipeContextMenu();
    hidePantrySuggestions();
    return;
  }

  // ? - Show keyboard shortcuts help
  if (e.key === '?' && !e.target.matches('input, textarea, select')) {
    e.preventDefault();
    showKeyboardShortcutsHelp();
    return;
  }

  // Ignore shortcuts if typing in an input/textarea
  if (e.target.matches('input, textarea, select')) return;

  const modKey = IS_MAC ? e.metaKey : e.ctrlKey;

  // ========== NAVIGATION SHORTCUTS ==========

  // Cmd/Ctrl+1 - Recipes tab
  if (modKey && e.key === '1') {
    e.preventDefault();
    setTab('recipes');
    return;
  }

  // Cmd/Ctrl+2 - Planner tab
  if (modKey && e.key === '2') {
    e.preventDefault();
    setTab('planner');
    return;
  }

  // Cmd/Ctrl+3 - Shopping tab
  if (modKey && e.key === '3') {
    e.preventDefault();
    setTab('shopping');
    return;
  }

  // Cmd/Ctrl+4 - Pantry tab
  if (modKey && e.key === '4') {
    e.preventDefault();
    setTab('pantry');
    return;
  }

  // Cmd/Ctrl+5 - Collections tab
  if (modKey && e.key === '5') {
    e.preventDefault();
    setTab('collections');
    return;
  }

  // Cmd/Ctrl+6 - Admin tab
  if (modKey && e.key === '6') {
    e.preventDefault();
    setTab('admin');
    return;
  }

  // ========== ACTION SHORTCUTS ==========

  // Cmd/Ctrl+Z - Undo
  if (modKey && !e.shiftKey && e.key === 'z') {
    e.preventDefault();
    undo();
    return;
  }

  // Cmd/Ctrl+Shift+Z - Redo
  if (modKey && e.shiftKey && e.key === 'z') {
    e.preventDefault();
    redo();
    return;
  }

  // Cmd/Ctrl+N - New recipe
  if (modKey && e.key === 'n') {
    e.preventDefault();
    openRecipeModalNew();
    return;
  }

  // Cmd/Ctrl+S - Save recipe (if recipe modal is open)
  if (modKey && e.key === 's') {
    e.preventDefault();
    const recipeModal = document.getElementById('recipeModalBack');
    if (recipeModal && recipeModal.style.display === 'flex') {
      document.getElementById('btnSaveRecipeFull').click();
    }
    return;
  }

  // Cmd/Ctrl+K - Command palette (handled by initCommandPalette)
  // Note: Do not handle here to avoid conflict with command palette handler

  // Cmd/Ctrl+F - Focus search (current tab)
  if (modKey && e.key === 'f') {
    e.preventDefault();
    const currentTab = getCurrentActiveTab();
    if (currentTab === 'recipes') {
      document.getElementById('recipeSearch').focus();
    } else if (currentTab === 'pantry') {
      document.getElementById('pantrySearch').focus();
    }
    return;
  }

  // Cmd/Ctrl+P - Print (context-aware)
  if (modKey && e.key === 'p') {
    e.preventDefault();
    const currentTab = getCurrentActiveTab();

    // Check if recipe modal is open first
    const recipeModal = document.getElementById('recipeModalBack');
    if (recipeModal && recipeModal.style.display === 'flex' && CURRENT_RECIPE_ID) {
      // Print current recipe
      const btnPrint = document.querySelector('[data-action="recipe-print"]');
      if (btnPrint) btnPrint.click();
    } else if (currentTab === 'pantry') {
      // Print pantry
      const btnPantryPrint = document.getElementById('btnPantryPrint');
      if (btnPantryPrint) btnPantryPrint.click();
    } else if (currentTab === 'shopping') {
      // Trigger shopping list print (if shopping list generated)
      // Future: add dedicated shopping list print button
      showToast('Shopping list print: Use the preview and print buttons', 'info');
    }
    return;
  }

  // Cmd/Ctrl+, - Show keyboard shortcuts help
  if (modKey && e.key === ',') {
    e.preventDefault();
    showKeyboardShortcutsHelp();
    return;
  }

  // Arrow keys - Navigate in lists (can be extended for meal navigation)
  if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
    // Future: implement meal navigation with arrow keys
    // For now, let default behavior work
  }
});

/**
 * Get the currently active tab name
 */
function getCurrentActiveTab() {
  const tabs = ['recipes', 'planner', 'shopping', 'pantry', 'collections', 'admin'];
  for (const tab of tabs) {
    const tabElement = document.getElementById(`tab-${tab}`);
    if (tabElement && tabElement.style.display !== 'none') {
      return tab;
    }
  }
  return 'recipes'; // default
}

/**
 * Show keyboard shortcuts help modal
 */
function showKeyboardShortcutsHelp() {
  const mod = MOD_KEY_SYMBOL;

  const modal = document.createElement('div');
  modal.className = 'modalBack';
  modal.style.cssText = 'position:fixed;inset:0;background:var(--overlay);z-index:10000;display:flex;align-items:center;justify-content:center;';

  modal.innerHTML = `
      <div style="background:var(--card);border-radius:16px;padding:32px;max-width:700px;width:90%;max-height:85vh;overflow-y:auto;box-shadow:0 25px 80px rgba(0,0,0,0.5);border:1px solid var(--line);">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:24px;">
          <h2 style="margin:0;font-size:24px;color:var(--text);">⌨️ Keyboard Shortcuts</h2>
          <button onclick="this.closest('.modalBack').remove()" style="padding:8px 16px;border-radius:50%;border:1px solid var(--line);background:var(--bg-elevated);cursor:pointer;font-size:20px;color:var(--text-secondary);">✕</button>
        </div>
        
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:24px;">
          <!-- Navigation -->
          <div>
            <h3 style="margin:0 0 12px 0;font-size:16px;font-weight:600;color:var(--accent);">Navigation</h3>
            <div style="display:flex;flex-direction:column;gap:8px;">
              <div style="display:flex;justify-content:space-between;align-items:center;">
                <span style="color:var(--text);">Recipes</span>
                <kbd style="padding:4px 8px;background:var(--bg-elevated);border:1px solid var(--line);border-radius:4px;font-size:13px;color:var(--text);">${mod}+1</kbd>
              </div>
              <div style="display:flex;justify-content:space-between;align-items:center;">
                <span style="color:var(--text);">Planner</span>
                <kbd style="padding:4px 8px;background:var(--bg-elevated);border:1px solid var(--line);border-radius:4px;font-size:13px;color:var(--text);">${mod}+2</kbd>
              </div>
              <div style="display:flex;justify-content:space-between;align-items:center;">
                <span style="color:var(--text);">Shopping</span>
                <kbd style="padding:4px 8px;background:var(--bg-elevated);border:1px solid var(--line);border-radius:4px;font-size:13px;color:var(--text);">${mod}+3</kbd>
              </div>
              <div style="display:flex;justify-content:space-between;align-items:center;">
                <span style="color:var(--text);">Pantry</span>
                <kbd style="padding:4px 8px;background:var(--bg-elevated);border:1px solid var(--line);border-radius:4px;font-size:13px;color:var(--text);">${mod}+4</kbd>
              </div>
              <div style="display:flex;justify-content:space-between;align-items:center;">
                <span style="color:var(--text);">Collections</span>
                <kbd style="padding:4px 8px;background:var(--bg-elevated);border:1px solid var(--line);border-radius:4px;font-size:13px;color:var(--text);">${mod}+5</kbd>
              </div>
              <div style="display:flex;justify-content:space-between;align-items:center;">
                <span style="color:var(--text);">Admin</span>
                <kbd style="padding:4px 8px;background:var(--bg-elevated);border:1px solid var(--line);border-radius:4px;font-size:13px;color:var(--text);">${mod}+6</kbd>
              </div>
            </div>
          </div>
          
          <!-- Actions -->
          <div>
            <h3 style="margin:0 0 12px 0;font-size:16px;font-weight:600;color:var(--accent);">Actions</h3>
            <div style="display:flex;flex-direction:column;gap:8px;">
              <div style="display:flex;justify-content:space-between;align-items:center;">
                <span style="color:var(--text);">New Recipe</span>
                <kbd style="padding:4px 8px;background:var(--bg-elevated);border:1px solid var(--line);border-radius:4px;font-size:13px;color:var(--text);">${mod}+N</kbd>
              </div>
              <div style="display:flex;justify-content:space-between;align-items:center;">
                <span style="color:var(--text);">Save Recipe</span>
                <kbd style="padding:4px 8px;background:var(--bg-elevated);border:1px solid var(--line);border-radius:4px;font-size:13px;color:var(--text);">${mod}+S</kbd>
              </div>
              <div style="display:flex;justify-content:space-between;align-items:center;">
                <span style="color:var(--text);">Quick Search</span>
                <kbd style="padding:4px 8px;background:var(--bg-elevated);border:1px solid var(--line);border-radius:4px;font-size:13px;color:var(--text);">${mod}+K</kbd>
              </div>
              <div style="display:flex;justify-content:space-between;align-items:center;">
                <span style="color:var(--text);">Focus Search</span>
                <kbd style="padding:4px 8px;background:var(--bg-elevated);border:1px solid var(--line);border-radius:4px;font-size:13px;color:var(--text);">${mod}+F</kbd>
              </div>
              <div style="display:flex;justify-content:space-between;align-items:center;">
                <span style="color:var(--text);">Print</span>
                <kbd style="padding:4px 8px;background:var(--bg-elevated);border:1px solid var(--line);border-radius:4px;font-size:13px;color:var(--text);">${mod}+P</kbd>
              </div>
              <div style="display:flex;justify-content:space-between;align-items:center;">
                <span style="color:var(--text);">Close Modal</span>
                <kbd style="padding:4px 8px;background:var(--bg-elevated);border:1px solid var(--line);border-radius:4px;font-size:13px;color:var(--text);">Esc</kbd>
              </div>
            </div>
          </div>
          
          <!-- Editing -->
          <div>
            <h3 style="margin:0 0 12px 0;font-size:16px;font-weight:600;color:var(--accent);">Editing</h3>
            <div style="display:flex;flex-direction:column;gap:8px;">
              <div style="display:flex;justify-content:space-between;align-items:center;">
                <span style="color:var(--text);">Undo</span>
                <kbd style="padding:4px 8px;background:var(--bg-elevated);border:1px solid var(--line);border-radius:4px;font-size:13px;color:var(--text);">${mod}+Z</kbd>
              </div>
              <div style="display:flex;justify-content:space-between;align-items:center;">
                <span style="color:var(--text);">Redo</span>
                <kbd style="padding:4px 8px;background:var(--bg-elevated);border:1px solid var(--line);border-radius:4px;font-size:13px;color:var(--text);">${mod}+Shift+Z</kbd>
              </div>
            </div>
          </div>
          
          <!-- Help -->
          <div>
            <h3 style="margin:0 0 12px 0;font-size:16px;font-weight:600;color:var(--accent);">Help</h3>
            <div style="display:flex;flex-direction:column;gap:8px;">
              <div style="display:flex;justify-content:space-between;align-items:center;">
                <span style="color:var(--text);">Show Shortcuts</span>
                <kbd style="padding:4px 8px;background:var(--bg-elevated);border:1px solid var(--line);border-radius:4px;font-size:13px;color:var(--text);">?</kbd>
              </div>
              <div style="display:flex;justify-content:space-between;align-items:center;">
                <span style="color:var(--text);">Show Shortcuts</span>
                <kbd style="padding:4px 8px;background:var(--bg-elevated);border:1px solid var(--line);border-radius:4px;font-size:13px;color:var(--text);">${mod}+,</kbd>
              </div>
            </div>
          </div>
        </div>
        
        <div style="margin-top:24px;padding-top:20px;border-top:1px solid var(--line);">
          <p style="margin:0;color:var(--text-secondary);font-size:13px;text-align:center;">
            Press <kbd style="padding:2px 6px;background:var(--bg-elevated);border:1px solid var(--line);border-radius:3px;font-size:12px;color:var(--text);">Esc</kbd> to close this dialog
          </p>
        </div>
      </div>
    `;

  // Close on Esc or overlay click
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      modal.remove();
    }
  });

  document.body.appendChild(modal);
}

// ============= PHASE 5.1: COMMAND PALETTE =============

// Command palette state
const COMMAND_PALETTE = {
  isOpen: false,
  selectedIndex: 0,
  filteredCommands: [],
  recentCommands: []
};

// Load recent commands from localStorage
function loadRecentCommands() {
  try {
    const stored = localStorage.getItem('recentCommands');
    COMMAND_PALETTE.recentCommands = stored ? JSON.parse(stored) : [];
  } catch (e) {
    COMMAND_PALETTE.recentCommands = [];
  }
}

// Save recent commands to localStorage
function saveRecentCommand(commandId) {
  // Add to front, remove duplicates, keep max 10
  COMMAND_PALETTE.recentCommands = [
    commandId,
    ...COMMAND_PALETTE.recentCommands.filter(id => id !== commandId)
  ].slice(0, 10);

  try {
    localStorage.setItem('recentCommands', JSON.stringify(COMMAND_PALETTE.recentCommands));
  } catch (e) {
    console.error('Failed to save recent commands:', e);
  }
}

// Command registry with all available commands
function getCommandRegistry() {
  const currentTab = getCurrentActiveTab();

  const commands = [
    // Navigation commands (always available)
    {
      id: 'nav-planner',
      category: 'Navigation',
      icon: '📋',
      title: 'Go to Planner',
      description: 'View meal planning calendar',
      shortcut: `${MOD_KEY_SYMBOL}+1`,
      action: () => document.querySelector('.tab[data-tab="planner"]')?.click()
    },
    {
      id: 'nav-recipes',
      category: 'Navigation',
      icon: '📚',
      title: 'Go to Recipes',
      description: 'Browse recipe library',
      shortcut: `${MOD_KEY_SYMBOL}+2`,
      action: () => document.querySelector('.tab[data-tab="recipes"]')?.click()
    },
    {
      id: 'nav-collections',
      category: 'Navigation',
      icon: '📦',
      title: 'Go to Collections',
      description: 'Manage recipe collections',
      shortcut: `${MOD_KEY_SYMBOL}+3`,
      action: () => document.querySelector('.tab[data-tab="collections"]')?.click()
    },
    {
      id: 'nav-shopping',
      category: 'Navigation',
      icon: '🛒',
      title: 'Go to Shopping List',
      description: 'View shopping items',
      shortcut: `${MOD_KEY_SYMBOL}+4`,
      action: () => document.querySelector('.tab[data-tab="shop"]')?.click()
    },
    {
      id: 'nav-pantry',
      category: 'Navigation',
      icon: '🥫',
      title: 'Go to Pantry',
      description: 'Manage pantry inventory',
      shortcut: `${MOD_KEY_SYMBOL}+5`,
      action: () => document.querySelector('.tab[data-tab="pantry"]')?.click()
    },
    {
      id: 'nav-admin',
      category: 'Navigation',
      icon: '⚙️',
      title: 'Go to Admin',
      description: 'App settings and tools',
      shortcut: `${MOD_KEY_SYMBOL}+6`,
      action: () => document.querySelector('.tab[data-tab="admin"]')?.click()
    },

    // Recipe actions
    {
      id: 'recipe-new',
      category: 'Recipe Actions',
      icon: '➕',
      title: 'New Recipe',
      description: 'Create a new recipe',
      shortcut: `${MOD_KEY_SYMBOL}+N`,
      action: () => openRecipeModalNew()
    },
    {
      id: 'recipe-quick-add',
      category: 'Recipe Actions',
      icon: '⚡',
      title: 'Quick Add Recipe',
      description: 'Fast recipe entry',
      action: () => showQuickAddRecipeModal?.()
    },
    {
      id: 'recipe-import',
      category: 'Recipe Actions',
      icon: '🌐',
      title: 'Import from URL',
      description: 'Import recipe from website',
      action: () => document.getElementById('btnImportRecipe')?.click()
    },

    // Planner actions
    {
      id: 'planner-today',
      category: 'Planner Actions',
      icon: '📅',
      title: 'Go to Today',
      description: 'Jump to current date',
      action: () => {
        const today = new Date().toISOString().split('T')[0];
        document.getElementById('planStart').value = today;
        const endDate = new Date(new Date(today).getTime() + 6 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        document.getElementById('planEnd').value = endDate;
        loadPlanner?.();
      }
    },
    {
      id: 'planner-generate-week',
      category: 'Planner Actions',
      icon: '🎲',
      title: 'Auto-Fill Week',
      description: 'Smart weekly meal planning',
      action: () => document.getElementById('btnGenerateWeek')?.click()
    },
    {
      id: 'planner-copy-forward',
      category: 'Planner Actions',
      icon: '⏩',
      title: 'Copy Week Forward',
      description: 'Duplicate current week to next',
      action: () => document.getElementById('btnCopyWeekForward')?.click()
    },

    // Shopping list actions
    {
      id: 'shopping-generate',
      category: 'Shopping List',
      icon: '🛍️',
      title: 'Generate Shopping List',
      description: 'Create list from meal plan',
      action: () => document.getElementById('btnBuildShop')?.click()
    },
    {
      id: 'shopping-clear',
      category: 'Shopping List',
      icon: '🗑️',
      title: 'Clear Shopping List',
      description: 'Remove all items',
      action: () => {
        if (confirm('Clear all shopping list items?')) {
          document.getElementById('btnClearShop')?.click();
        }
      }
    },

    // Pantry actions
    {
      id: 'pantry-add',
      category: 'Pantry Actions',
      icon: '➕',
      title: 'Add Pantry Item',
      description: 'Add new item to pantry',
      action: () => pantryModal_?.({ ItemId: '', PantryId: '', Name: '', QtyNum: '', QtyText: '', Unit: '', Category: '', StoreId: '', Notes: '' }, true)
    },

    // Quick operations
    {
      id: 'print',
      category: 'Quick Operations',
      icon: '🖨️',
      title: 'Print',
      description: 'Print current view',
      shortcut: `${MOD_KEY_SYMBOL}+P`,
      action: () => {
        const currentTab = getCurrentActiveTab();

        // Check if recipe modal is open first
        const recipeModal = document.getElementById('recipeModalBack');
        if (recipeModal && recipeModal.style.display === 'flex' && CURRENT_RECIPE_ID) {
          // Print current recipe
          const btnPrint = document.querySelector('[data-action="recipe-print"]');
          if (btnPrint) btnPrint.click();
        } else if (currentTab === 'pantry') {
          // Print pantry
          const btnPantryPrint = document.getElementById('btnPantryPrint');
          if (btnPantryPrint) btnPantryPrint.click();
        } else if (currentTab === 'shopping') {
          showToast('Shopping list print: Use the preview and print buttons', 'info');
        }
      }
    },
    {
      id: 'search',
      category: 'Quick Operations',
      icon: '🔍',
      title: 'Search',
      description: 'Quick search',
      shortcut: `${MOD_KEY_SYMBOL}+F`,
      action: () => {
        const currentTab = getCurrentActiveTab();
        if (currentTab === 'recipes') {
          document.getElementById('recipeSearch')?.focus();
        } else if (currentTab === 'pantry') {
          document.getElementById('pantrySearch')?.focus();
        }
      }
    },
    {
      id: 'help',
      category: 'Quick Operations',
      icon: '❓',
      title: 'Keyboard Shortcuts',
      description: 'Show all shortcuts',
      shortcut: '?',
      action: () => showKeyboardShortcutsHelp()
    },
    {
      id: 'undo',
      category: 'Quick Operations',
      icon: '↩️',
      title: 'Undo',
      description: 'Undo last action',
      shortcut: `${MOD_KEY_SYMBOL}+Z`,
      action: () => undo()
    }
  ];

  // Filter commands based on context (optional: show only relevant commands)
  return commands;
}

// Fuzzy search function
function fuzzyMatch(text, query) {
  if (!query) return true;

  text = text.toLowerCase();
  query = query.toLowerCase();

  // Exact match
  if (text.includes(query)) return true;

  // Fuzzy match - check if all query chars appear in order
  let textIndex = 0;
  for (let queryChar of query) {
    textIndex = text.indexOf(queryChar, textIndex);
    if (textIndex === -1) return false;
    textIndex++;
  }
  return true;
}

// Filter commands based on search query
function filterCommands(query) {
  const commands = getCommandRegistry();

  if (!query.trim()) {
    // No query - show recent commands first, then all commands
    const recentIds = COMMAND_PALETTE.recentCommands;
    const recentCmds = commands.filter(cmd => recentIds.includes(cmd.id))
      .sort((a, b) => recentIds.indexOf(a.id) - recentIds.indexOf(b.id));
    const otherCmds = commands.filter(cmd => !recentIds.includes(cmd.id));

    return [...recentCmds, ...otherCmds];
  }

  // Filter by fuzzy match on title and description
  return commands.filter(cmd =>
    fuzzyMatch(cmd.title, query) ||
    fuzzyMatch(cmd.description, query) ||
    fuzzyMatch(cmd.category, query)
  );
}

// Render command palette results
function renderCommandPaletteResults(filteredCommands) {
  const resultsContainer = document.getElementById('commandPaletteResults');
  if (!resultsContainer) return;

  if (filteredCommands.length === 0) {
    resultsContainer.innerHTML = `
        <div class="command-palette-empty">
          <div class="command-palette-empty-icon">🔍</div>
          <div class="command-palette-empty-text">No commands found</div>
        </div>
      `;
    return;
  }

  // Group by category
  const grouped = {};
  filteredCommands.forEach(cmd => {
    if (!grouped[cmd.category]) {
      grouped[cmd.category] = [];
    }
    grouped[cmd.category].push(cmd);
  });

  let html = '';
  Object.keys(grouped).forEach(category => {
    html += `<div class="command-category">${category}</div>`;

    grouped[category].forEach((cmd, index) => {
      const globalIndex = filteredCommands.indexOf(cmd);
      const isSelected = globalIndex === COMMAND_PALETTE.selectedIndex;

      html += `
          <div class="command-item ${isSelected ? 'selected' : ''}" 
               data-index="${globalIndex}"
               data-command-id="${cmd.id}">
            <div class="command-item-content">
              <div class="command-item-icon">${cmd.icon}</div>
              <div class="command-item-text">
                <div class="command-item-title">${cmd.title}</div>
                <div class="command-item-description">${cmd.description}</div>
              </div>
            </div>
            ${cmd.shortcut ? `
              <div class="command-item-shortcut">
                <kbd>${cmd.shortcut}</kbd>
              </div>
            ` : ''}
          </div>
        `;
    });
  });

  resultsContainer.innerHTML = html;

  // Scroll selected item into view
  const selectedItem = resultsContainer.querySelector('.command-item.selected');
  if (selectedItem) {
    selectedItem.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }
}

// Open command palette
function openCommandPalette() {
  const modal = document.getElementById('commandPaletteBack');
  const input = document.getElementById('commandPaletteInput');

  if (!modal || !input) return;

  COMMAND_PALETTE.isOpen = true;
  COMMAND_PALETTE.selectedIndex = 0;
  COMMAND_PALETTE.filteredCommands = filterCommands('');

  modal.style.display = 'flex';
  input.value = '';
  input.focus();

  renderCommandPaletteResults(COMMAND_PALETTE.filteredCommands);
}

// Close command palette
function closeCommandPalette() {
  const modal = document.getElementById('commandPaletteBack');
  if (!modal) return;

  COMMAND_PALETTE.isOpen = false;
  modal.style.display = 'none';
}

// Execute selected command
function executeSelectedCommand() {
  const selectedCmd = COMMAND_PALETTE.filteredCommands[COMMAND_PALETTE.selectedIndex];
  if (!selectedCmd) return;

  // Save to recent commands
  saveRecentCommand(selectedCmd.id);

  // Close palette
  closeCommandPalette();

  // Execute command action
  try {
    selectedCmd.action();
    showToast(`✓ ${selectedCmd.title}`, 'success', 2000);
  } catch (e) {
    showToast(`Failed to execute: ${e.message}`, 'error');
  }
}

// Handle command palette input
function handleCommandPaletteInput(e) {
  const query = e.target.value;
  COMMAND_PALETTE.filteredCommands = filterCommands(query);
  COMMAND_PALETTE.selectedIndex = 0;
  renderCommandPaletteResults(COMMAND_PALETTE.filteredCommands);
}

// Handle command palette keyboard navigation
function handleCommandPaletteKeydown(e) {
  if (!COMMAND_PALETTE.isOpen) return;

  switch (e.key) {
    case 'Escape':
      e.preventDefault();
      closeCommandPalette();
      break;

    case 'ArrowDown':
      e.preventDefault();
      if (COMMAND_PALETTE.selectedIndex < COMMAND_PALETTE.filteredCommands.length - 1) {
        COMMAND_PALETTE.selectedIndex++;
        renderCommandPaletteResults(COMMAND_PALETTE.filteredCommands);
      }
      break;

    case 'ArrowUp':
      e.preventDefault();
      if (COMMAND_PALETTE.selectedIndex > 0) {
        COMMAND_PALETTE.selectedIndex--;
        renderCommandPaletteResults(COMMAND_PALETTE.filteredCommands);
      }
      break;

    case 'Enter':
      e.preventDefault();
      executeSelectedCommand();
      break;
  }
}

// Initialize command palette event listeners
function initCommandPalette() {
  loadRecentCommands();

  const input = document.getElementById('commandPaletteInput');
  const modal = document.getElementById('commandPaletteBack');
  const resultsContainer = document.getElementById('commandPaletteResults');

  if (input) {
    input.addEventListener('input', handleCommandPaletteInput);
    input.addEventListener('keydown', handleCommandPaletteKeydown);
  }

  if (modal) {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        closeCommandPalette();
      }
    });
  }

  if (resultsContainer) {
    resultsContainer.addEventListener('click', (e) => {
      const item = e.target.closest('.command-item');
      if (item) {
        const index = parseInt(item.dataset.index);
        COMMAND_PALETTE.selectedIndex = index;
        executeSelectedCommand();
      }
    });
  }

  // Add global keydown listener for Cmd/Ctrl+K
  document.addEventListener('keydown', (e) => {
    // Cmd/Ctrl+K to open command palette
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
      e.preventDefault();
      if (COMMAND_PALETTE.isOpen) {
        closeCommandPalette();
      } else {
        openCommandPalette();
      }
    }
  });
}

// ============= ENHANCED ASYNC OPERATIONS WITH TOAST =============
// Replace alert() calls with toast notifications for better UX
// Example wrapper for async operations:
async function runWithFeedback(operation, successMessage, errorPrefix = 'Error') {
  try {
    const result = await operation();
    if (result && result.ok === false) {
      showToast(`${errorPrefix}: ${result.error || 'Operation failed'}`, 'error');
      return result;
    }
    if (successMessage) {
      showToast(successMessage, 'success');
    }
    return result;
  } catch (e) {
    showToast(`${errorPrefix}: ${e.message}`, 'error');
    throw e;
  }
}

// ============= PHASE 2.1: RECIPE QUICK ACTIONS & CONTEXT MENU =============

let currentContextMenuRecipeId = null;

/**
 * Show recipe context menu (right-click or "more actions" button)
 */
function showRecipeContextMenu(x, y, recipeId) {
  const menu = document.getElementById('recipe-context-menu');
  if (!menu) return;

  currentContextMenuRecipeId = recipeId;

  // Position the menu, ensuring it stays within viewport
  const menuWidth = 220; // Estimated width
  const menuHeight = 350; // Estimated height

  let leftPos = x;
  let topPos = y;

  // Adjust if menu would go off right edge
  if (leftPos + menuWidth > window.innerWidth - 20) {
    leftPos = window.innerWidth - menuWidth - 20;
  }

  // Adjust if menu would go off bottom edge
  if (topPos + menuHeight > window.innerHeight - 20) {
    topPos = window.innerHeight - menuHeight - 20;
  }

  // Ensure menu doesn't go off left or top edges
  leftPos = Math.max(20, leftPos);
  topPos = Math.max(20, topPos);

  menu.style.left = leftPos + 'px';
  menu.style.top = topPos + 'px';
  menu.classList.add('visible');

  // Close on outside click
  setTimeout(() => {
    const closeHandler = (e) => {
      if (!menu.contains(e.target)) {
        hideRecipeContextMenu();
        document.removeEventListener('click', closeHandler);
      }
    };
    document.addEventListener('click', closeHandler);
  }, 0);
}

/**
 * Hide recipe context menu
 */
function hideRecipeContextMenu() {
  const menu = document.getElementById('recipe-context-menu');
  if (menu) {
    menu.classList.remove('visible');
  }
  currentContextMenuRecipeId = null;
}

/**
 * Handle context menu item clicks
 */
document.addEventListener('click', async (e) => {
  const menuItem = e.target.closest('.context-menu-item');
  if (!menuItem || !currentContextMenuRecipeId) return;

  const action = menuItem.getAttribute('data-action');
  const rid = currentContextMenuRecipeId;

  hideRecipeContextMenu();

  switch (action) {
    case 'view':
      await openRecipeModalView(rid);
      break;
    case 'edit':
      await openRecipeModalEdit(rid);
      break;
    case 'assign':
      const card = document.querySelector(`[data-recipe-id="${rid}"]`);
      const title = card?.getAttribute('data-recipe-title') || '';
      openAssignToPlannerModal(rid, title);
      break;
    case 'add-to-collection':
      await showAddToCollectionModal(rid);
      break;
    case 'duplicate':
      await duplicateRecipe(rid);
      break;
    case 'print':
      await openRecipeModalView(rid);
      applyCurrentScaleToDisplay(true);
      await printRecipeWithQuantities();
      break;
    case 'delete':
      if (confirm('Are you sure you want to delete this recipe? This action cannot be undone.')) {
        CURRENT_RECIPE_ID = rid;
        await deleteRecipeUi();
      }
      break;
  }
});

/**
 * Right-click context menu on recipe cards
 */
document.addEventListener('contextmenu', (e) => {
  const recipeCard = e.target.closest('.recipe-card-wrapper');
  if (recipeCard) {
    e.preventDefault();
    const rid = recipeCard.getAttribute('data-recipe-id');
    if (rid) {
      showRecipeContextMenu(e.pageX, e.pageY, rid);
    }
  }
});

// ========== GRID MEAL CONTEXT MENU (Planner Grid View) ==========

let currentGridMealContext = null; // { date, slot, meals, additionalItems }

/**
 * Show context menu for grid meal items
 */
async function showGridMealContextMenu(x, y, date, slot) {
  const menu = document.getElementById('grid-meal-context-menu');
  if (!menu) return;

  // Hide other context menus
  hideRecipeContextMenu();

  // Get meals for this date/slot
  const plan = PLAN.plansByDate[date] || {};
  const meals = plan[slot];
  const mealsArray = Array.isArray(meals) ? meals : (meals && meals.Title ? [meals] : []);

  // Get additional items
  const itemKey = `${date}:${slot}`;
  let additionalItems = [];

  // Try to get from cached data or fetch
  try {
    const result = await api('getAdditionalItems', { date, slot });
    if (result.ok && result.items) {
      additionalItems = result.items;
    }
  } catch (e) {
    console.warn('Failed to fetch additional items:', e);
  }

  if (mealsArray.length === 0 && additionalItems.length === 0) {
    return; // Nothing to show
  }

  currentGridMealContext = { date, slot, meals: mealsArray, additionalItems };

  // Build menu content
  const header = document.getElementById('grid-meal-context-header');
  const itemsContainer = document.getElementById('grid-meal-context-items');

  header.textContent = `${slot} - ${date}`;

  let itemsHtml = '';

  // Add main meals
  mealsArray.forEach((meal, idx) => {
    const badge = meal.IsFallback ? '👨‍👩‍👧‍👦' : '👤';
    itemsHtml += `
      <button class="context-menu-item" data-action="view-grid-meal" data-rid="${escapeAttr(meal.RecipeId || '')}">
        <span>👁️</span>
        <span>View: ${escapeHtml(meal.Title)}</span>
      </button>
      <button class="context-menu-item" data-action="change-grid-meal" data-date="${escapeAttr(date)}" data-slot="${escapeAttr(slot)}">
        <span>✏️</span>
        <span>Change ${escapeHtml(slot)}</span>
      </button>
    `;
  });

  // Add separator if there are additional items
  if (mealsArray.length > 0 && additionalItems.length > 0) {
    itemsHtml += '<div class="context-menu-separator"></div>';
    itemsHtml += '<div style="padding:4px 12px;font-size:11px;color:var(--muted);font-weight:600;">Additional Items</div>';
  }

  // Add additional items
  additionalItems.forEach(item => {
    const typeIcon = item.ItemType === 'dessert' ? '🍰' : item.ItemType === 'appetizer' ? '🥗' : '🍽️';
    itemsHtml += `
      <button class="context-menu-item" data-action="view-grid-meal" data-rid="${escapeAttr(item.RecipeId || '')}">
        <span>${typeIcon}</span>
        <span>${escapeHtml(item.Title)} <span style="color:var(--muted);font-size:11px;">(${item.ItemType || 'side'})</span></span>
      </button>
    `;
  });

  itemsContainer.innerHTML = itemsHtml;

  // Position the menu
  const menuWidth = 280;
  const menuHeight = Math.min(400, (mealsArray.length + additionalItems.length) * 44 + 60);

  let leftPos = x;
  let topPos = y;

  if (leftPos + menuWidth > window.innerWidth - 20) {
    leftPos = window.innerWidth - menuWidth - 20;
  }
  if (topPos + menuHeight > window.innerHeight - 20) {
    topPos = window.innerHeight - menuHeight - 20;
  }

  leftPos = Math.max(20, leftPos);
  topPos = Math.max(20, topPos);

  menu.style.left = leftPos + 'px';
  menu.style.top = topPos + 'px';
  menu.classList.add('visible');
}

/**
 * Hide grid meal context menu
 */
function hideGridMealContextMenu() {
  const menu = document.getElementById('grid-meal-context-menu');
  if (menu) {
    menu.classList.remove('visible');
  }
  currentGridMealContext = null;
}

/**
 * Handle grid meal context menu item clicks
 */
document.addEventListener('click', async (e) => {
  // Hide grid meal context menu on any click
  const gridMenu = document.getElementById('grid-meal-context-menu');
  if (gridMenu && gridMenu.classList.contains('visible')) {
    const menuItem = e.target.closest('#grid-meal-context-menu .context-menu-item');
    if (menuItem) {
      const action = menuItem.getAttribute('data-action');
      const rid = menuItem.getAttribute('data-rid');
      const date = menuItem.getAttribute('data-date');
      const slot = menuItem.getAttribute('data-slot');

      if (action === 'view-grid-meal' && rid) {
        hideGridMealContextMenu();
        await openRecipeModalView(rid);
        return;
      }

      if (action === 'change-grid-meal' && date && slot) {
        hideGridMealContextMenu();
        openMealPicker(date, slot);
        return;
      }
    }

    // Hide if clicked outside menu
    if (!e.target.closest('#grid-meal-context-menu')) {
      hideGridMealContextMenu();
    }
  }
});

/**
 * Right-click context menu on grid meal items
 */
document.addEventListener('contextmenu', (e) => {
  const gridMeal = e.target.closest('.grid-meal, .grid-meal-multi');
  if (gridMeal) {
    e.preventDefault();
    const date = gridMeal.getAttribute('data-date');
    const slot = gridMeal.getAttribute('data-slot');
    if (date && slot) {
      showGridMealContextMenu(e.pageX, e.pageY, date, slot);
    }
  }
});

/**
 * Show modal to add recipe to a collection
 */
async function showAddToCollectionModal(recipeId) {
  return new Promise(async (resolve) => {
    // Load collections
    const collectionsResult = await api('listCollections', {});
    if (!collectionsResult.ok || !collectionsResult.collections || collectionsResult.collections.length === 0) {
      showToast('No collections found. Create one in the Collections tab first.', 'info');
      resolve(null);
      return;
    }

    const collections = collectionsResult.collections;

    // Create overlay modal
    const ov = document.createElement('div');
    ov.style.cssText = 'position:fixed;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.7);z-index:9999;';

    const modal = document.createElement('div');
    modal.style.cssText = 'background:var(--bg);border-radius:12px;padding:24px;max-width:400px;width:90%;box-shadow:0 20px 60px rgba(0,0,0,0.5);';

    modal.innerHTML = `
        <h3 style="margin:0 0 16px 0;font-size:18px;color:var(--fg);">Add to Collection</h3>
        <select id="collection-select-modal" style="width:100%;padding:10px;border:1px solid var(--line);border-radius:6px;background:var(--bg);color:var(--fg);margin-bottom:16px;">
          ${collections.map(c => `<option value="${escapeAttr(c.CollectionId)}">${escapeHtml(c.Name)}</option>`).join('')}
        </select>
        <div style="display:flex;gap:10px;justify-content:flex-end;">
          <button id="cancel-add-collection" class="ghost">Cancel</button>
          <button id="confirm-add-collection" class="primary">Add to Collection</button>
        </div>
      `;

    ov.appendChild(modal);
    document.body.appendChild(ov);

    // Handle confirm
    document.getElementById('confirm-add-collection').addEventListener('click', async () => {
      const collectionId = document.getElementById('collection-select-modal').value;
      if (collectionId) {
        const res = await api('addRecipeToCollection', {
          collectionId: collectionId,
          recipeId: recipeId
        });

        if (res.ok) {
          const collectionName = collections.find(c => c.CollectionId === collectionId)?.Name || 'Collection';
          showToast(`Recipe added to "${collectionName}"`, 'success');
        } else if (res.error && res.error.includes('already in collection')) {
          showToast('Recipe is already in this collection', 'warning');
        } else {
          showToast(res.error || 'Failed to add recipe', 'error');
        }
      }
      ov.remove();
      resolve(collectionId);
    });

    // Handle cancel
    document.getElementById('cancel-add-collection').addEventListener('click', () => {
      ov.remove();
      resolve(null);
    });

    // Handle overlay click
    ov.addEventListener('click', (e) => {
      if (e.target === ov) {
        ov.remove();
        resolve(null);
      }
    });
  });
}

/**
 * Duplicate a recipe (create a copy with "Copy of" prefix)
 */
async function duplicateRecipe(recipeId) {
  try {
    // Load the original recipe
    const recipeRes = await api('getRecipe', { recipeId });
    if (!recipeRes.ok) {
      showToast('Failed to load recipe', 'error');
      return;
    }

    const originalRecipe = recipeRes.recipe;
    const ingredientsRes = await api('listRecipeIngredients', { recipeId });
    const ingredients = ingredientsRes.ok ? (ingredientsRes.items || []) : [];

    // Create new recipe with "Copy of" prefix
    const newRecipeData = {
      Title: `Copy of ${originalRecipe.Title}`,
      URL: originalRecipe.URL || '',
      Cuisine: originalRecipe.Cuisine || '',
      MealType: originalRecipe.MealType || 'Any',
      Notes: originalRecipe.Notes || '',
      Instructions: originalRecipe.Instructions || ''
    };

    // Copy ingredients
    const ingredientsCopy = ingredients.map(ing => ({
      IngredientNorm: ing.IngredientNorm || '',
      IngredientRaw: ing.IngredientRaw || '',
      Notes: ing.Notes || '',
      QtyNum: ing.QtyNum,
      QtyText: ing.QtyText || '',
      StoreId: ing.StoreId || '',
      Unit: ing.Unit || '',
      Category: ing.Category || '',
      idx: ing.idx
    }));

    const createRes = await api('upsertRecipeWithIngredients', {
      recipe: newRecipeData,
      items: ingredientsCopy
    });
    if (!createRes.ok) {
      showToast('Failed to create duplicate recipe', 'error');
      return;
    }

    // Reload recipes
    await resetAndLoadRecipes();

    showToast(`Recipe duplicated as "${newRecipeData.Title}"`, 'success');
  } catch (e) {
    showToast(`Error duplicating recipe: ${e.message}`, 'error');
  }
}

// ============= PHASE 2.3: ADVANCED FILTER FUNCTIONS =============

/**
 * Update advanced filter state from UI
 */
function updateAdvancedFilterState() {
  // Collect selected meal types
  ADVANCED_FILTERS.mealTypes = [];
  document.querySelectorAll('#mealTypeChips .filter-chip.active').forEach(chip => {
    ADVANCED_FILTERS.mealTypes.push(chip.getAttribute('data-meal-type'));
  });

  // Update active flag
  ADVANCED_FILTERS.active =
    ADVANCED_FILTERS.mealTypes.length > 0 ||
    ADVANCED_FILTERS.mustHaveIngredients.length > 0 ||
    ADVANCED_FILTERS.excludeIngredients.length > 0;

  // Update badge
  updateFilterBadge();
}

/**
 * Update the active filters count badge
 */
function updateFilterBadge() {
  const badge = document.getElementById('activeFiltersBadge');
  const count =
    ADVANCED_FILTERS.mealTypes.length +
    ADVANCED_FILTERS.mustHaveIngredients.length +
    ADVANCED_FILTERS.excludeIngredients.length;

  if (count > 0) {
    badge.textContent = count;
    badge.style.display = 'inline-block';
  } else {
    badge.style.display = 'none';
  }
}

/**
 * Render ingredient tags (must-have and exclude)
 */
function renderIngredientTags() {
  const container = document.getElementById('ingredientTags');
  const tags = [];

  // Must-have ingredients
  ADVANCED_FILTERS.mustHaveIngredients.forEach((ing, index) => {
    tags.push(`
        <div class="ingredient-tag">
          <span>✓ ${escapeHtml(ing)}</span>
          <span class="remove" data-action="remove-must-have" data-index="${index}">×</span>
        </div>
      `);
  });

  // Exclude ingredients
  ADVANCED_FILTERS.excludeIngredients.forEach((ing, index) => {
    tags.push(`
        <div class="ingredient-tag exclude">
          <span>✗ ${escapeHtml(ing)}</span>
          <span class="remove" data-action="remove-exclude" data-index="${index}">×</span>
        </div>
      `);
  });

  container.innerHTML = tags.join('');

  // Add click handlers for removal
  container.addEventListener('click', (e) => {
    const removeBtn = e.target.closest('[data-action="remove-must-have"], [data-action="remove-exclude"]');
    if (!removeBtn) return;

    const index = parseInt(removeBtn.getAttribute('data-index'));
    const action = removeBtn.getAttribute('data-action');

    if (action === 'remove-must-have') {
      ADVANCED_FILTERS.mustHaveIngredients.splice(index, 1);
    } else if (action === 'remove-exclude') {
      ADVANCED_FILTERS.excludeIngredients.splice(index, 1);
    }

    renderIngredientTags();
    updateAdvancedFilterState();
  });
}

/**
 * Clear all advanced filters
 */
function clearAdvancedFilters() {
  // Clear meal types
  document.querySelectorAll('#mealTypeChips .filter-chip').forEach(chip => {
    chip.classList.remove('active');
  });

  // Clear ingredients
  ADVANCED_FILTERS.mealTypes = [];
  ADVANCED_FILTERS.mustHaveIngredients = [];
  ADVANCED_FILTERS.excludeIngredients = [];
  ADVANCED_FILTERS.active = false;

  // Update UI
  renderIngredientTags();
  updateFilterBadge();

  // Reload recipes
  resetAndLoadRecipes();

  showToast('All filters cleared', 'info');
}


// ==================== HOME DASHBOARD LOGIC ====================

// Helper to refresh dashboard when today's meals change
async function refreshDashboardIfToday(changedDate) {
  const today = ymd(new Date());
  if (changedDate === today) {
    // Invalidate cache for today
    QUERY_CACHE.plans.delete(today);
    QUERY_CACHE.plansFetchTime.delete(today);
    // Re-render dashboard
    await renderDashboard();
  }
}

async function renderDashboard() {
  console.log('[Dashboard] Rendering...');

  // 1. Welcome Message (time-based greeting)
  const h = new Date().getHours();
  const greet = h < 12 ? 'Good Morning' : h < 18 ? 'Good Afternoon' : 'Good Evening';
  document.getElementById('dashboardWelcome').textContent = greet;

  // 2. Fetch "Dinner Tonight"
  const today = ymd(new Date());
  document.getElementById('dashboardDinnerTitle').textContent = 'Loading...';
  document.getElementById('dashboardDinnerTitle').classList.remove('empty');
  document.getElementById('dashboardDinnerImage').style.backgroundImage = '';

  try {
    // Check for cached plan first
    let plan = QUERY_CACHE.plans.get(today);
    if (!plan || !isCacheValid_(QUERY_CACHE.plansFetchTime.get(today), QUERY_CACHE.planCacheTTL)) {
      const res = await api('getUserPlanMeals', { start: today, end: today });
      if (res.ok && res.plans && Array.isArray(res.plans) && res.plans.length > 0) {
        plan = res.plans.find(p => p.Date === today) || res.plans[0];
        QUERY_CACHE.plans.set(today, plan);
        QUERY_CACHE.plansFetchTime.set(today, Date.now());
      }
    }

    // Find Dinner - getUserPlanMeals returns { Dinner: [{RecipeId, Title, ...}] }
    const dinnerMeals = (plan && Array.isArray(plan.Dinner)) ? plan.Dinner : [];
    const dinner = dinnerMeals.length > 0 ? dinnerMeals[0] : null;

    if (dinner && dinner.RecipeId) {
      // We have a dinner!
      const recipeId = dinner.RecipeId;

      // Try to fetch recipe details from API if not in RECIPES array
      let recipe = RECIPES.find(r => r.RecipeId === recipeId);

      if (!recipe) {
        // Recipe not yet loaded in RECIPES array, fetch it directly
        const recipeRes = await api('getRecipe', { recipeId });
        if (recipeRes.ok && recipeRes.recipe) {
          recipe = recipeRes.recipe;
        }
      }

      const recipeTitle = recipe ? recipe.Title : (dinner.Title || 'Unknown Recipe');

      document.getElementById('dashboardDinnerTitle').textContent = recipeTitle;
      document.getElementById('dashboardDinnerMeta').innerHTML = `
          <span>📅 Today's Dinner</span>
          ${dinner.notes ? `<span>📝 ${escapeHtml(dinner.notes)}</span>` : ''}
        `;

      // Setup actions
      document.getElementById('btnDashCookNow').onclick = () => openRecipeModalView(recipeId);
      document.getElementById('btnDashViewRecipe').onclick = () => showRecipeModal(recipeId);

      // Use the already-fetched recipe for image
      if (recipe && (recipe.Image_Name || recipe.Image)) {
        document.getElementById('dashboardDinnerImage').style.backgroundImage = `url('${getRecipeImageUrl(recipe.Image_Name || recipe.Image)}')`;
      }

    } else {
      // No dinner planned
      document.getElementById('dashboardDinnerTitle').textContent = 'No dinner planned yet';
      document.getElementById('dashboardDinnerTitle').classList.add('empty');
      document.getElementById('dashboardDinnerMeta').innerHTML = '<span>What are you craving?</span>';

      document.getElementById('btnDashCookNow').textContent = '📅 Plan Now';
      document.getElementById('btnDashCookNow').onclick = () => document.querySelector('[data-tab=planner]').click();
      document.getElementById('btnDashViewRecipe').style.display = 'none';
    }

  } catch (e) {
    console.error('Dashboard error:', e);
    document.getElementById('dashboardDinnerTitle').textContent = 'Error loading plan';
  }

  // 3. Stats - Shopping List
  try {
    document.getElementById('dashShopCount').textContent = 'View';
  } catch (e) {
    console.warn('[Dashboard] Failed to update shop count:', e);
  }

  // 4. Stats - Pantry Low Stock
  try {
    const res = await api('listPantry', { q: '' });
    if (res.ok && res.items) {
      const lowStockCount = res.items.filter(item => {
        const qty = item.QtyNum;
        const threshold = item.low_stock_threshold;
        // Only count as low stock if threshold is set (> 0) and qty is at or below it
        return qty !== null && threshold !== null && Number(threshold) > 0 && Number(qty) <= Number(threshold);
      }).length;
      document.getElementById('dashLowStockCount').textContent = lowStockCount;
      document.getElementById('dashLowStockLabel').textContent = lowStockCount === 1 ? 'Item' : 'Items';
    } else {
      document.getElementById('dashLowStockCount').textContent = '0';
      document.getElementById('dashLowStockLabel').textContent = 'Items';
    }
  } catch (e) {
    console.warn('[Dashboard] Failed to load pantry stats:', e);
    document.getElementById('dashLowStockCount').textContent = '-';
    document.getElementById('dashLowStockLabel').textContent = '';
  }

  // 5. Total Recipes - fetch if not loaded yet
  if (RECIPES.length) {
    document.getElementById('dashRecipeCount').textContent = RECIPES.length;
  } else {
    // Recipes not loaded yet, fetch the count
    try {
      const recipeRes = await api('listRecipesAll', { q: '' });
      if (recipeRes.ok && recipeRes.recipes) {
        RECIPES = recipeRes.recipes;
        document.getElementById('dashRecipeCount').textContent = RECIPES.length;
      } else {
        console.warn('[Dashboard] Failed to load recipes:', recipeRes.error);
        document.getElementById('dashRecipeCount').textContent = '-';
      }
    } catch (e) {
      console.warn('[Dashboard] Exception loading recipes:', e);
      document.getElementById('dashRecipeCount').textContent = '-';
    }
  }
}

// ==================== PHASE 4: SMART PANTRY SUGGESTIONS ====================

/**
 * Fetches pantry items (using cache if available)
 */
async function getPantryItemsForSuggestions() {
  if (QUERY_CACHE.pantry && isCacheValid_(QUERY_CACHE.pantryFetchTime, 300000)) { // 5 min cache
    return QUERY_CACHE.pantry;
  }
  const res = await api('listPantry', { q: '' });
  if (res.ok) {
    QUERY_CACHE.pantry = res.items || [];
    QUERY_CACHE.pantryFetchTime = Date.now();
    return QUERY_CACHE.pantry;
  }
  return [];
}

/**
 * Shows pantry suggestions for a specific ingredient input
 */
async function showPantrySuggestions(inputEl, rowIdx) {
  const query = inputEl.value.trim().toLowerCase();

  // Remove any existing suggestion list
  hidePantrySuggestions();

  if (query.length < 2) return;

  const items = await getPantryItemsForSuggestions();
  const matches = items.filter(it => it.Name.toLowerCase().includes(query)).slice(0, 10);

  if (matches.length === 0) return;

  const list = document.createElement('div');
  list.id = 'pantrySuggestionOverlay';
  list.className = 'pantry-suggestion-list';

  // Position listing
  const rect = inputEl.getBoundingClientRect();
  list.style.top = (rect.bottom + window.scrollY) + 'px';
  list.style.left = (rect.left + window.scrollX) + 'px';
  list.style.width = rect.width + 'px';

  list.innerHTML = matches.map(it => {
    const isLow = (it.QtyNum !== null && it.low_stock_threshold !== null && it.QtyNum <= it.low_stock_threshold);
    return `
      <div class="pantry-suggestion-item" data-item-id="${it.ItemId}">
        <span>${escapeHtml(it.Name)}</span>
        <span class="pantry-stock-badge ${isLow ? 'pantry-stock-low' : 'pantry-stock-ok'}">
          ${isLow ? '⚠️ Low' : 'In Stock'}
        </span>
      </div>
    `;
  }).join('');

  document.body.appendChild(list);

  // Event Delegation for selection
  list.addEventListener('click', (e) => {
    const itemEl = e.target.closest('.pantry-suggestion-item');
    if (itemEl) {
      const itemId = itemEl.dataset.itemId;
      const selectedItem = matches.find(m => String(m.ItemId) === String(itemId));
      if (selectedItem) {
        selectPantrySuggestion(selectedItem, rowIdx);
      }
    }
  });

  // Close when clicking outside
  const clickOutside = (e) => {
    if (!list.contains(e.target) && e.target !== inputEl) {
      hidePantrySuggestions();
      document.removeEventListener('click', clickOutside);
    }
  };
  setTimeout(() => document.addEventListener('click', clickOutside), 10);
}

function hidePantrySuggestions() {
  const existing = document.getElementById('pantrySuggestionOverlay');
  if (existing) existing.remove();
}
// Make swapMeals available globally for inline onclick handlers
window.swapMeals = async function (date, slot1, slot2) {
  if (!date || !slot1 || !slot2) return;

  await api('swapPlanMeals', {
    date1: date,
    slot1: slot1,
    date2: date,
    slot2: slot2
  });
  await loadPlansIntoUi(PLAN.start, PLAN.days);
};
function selectPantrySuggestion(item, rowIdx) {
  const row = ING_ROWS[rowIdx];
  if (!row) return;

  row.IngredientRaw = item.Name;
  row.IngredientNorm = item.Name.toLowerCase();
  row.Unit = item.Unit || row.Unit;
  row.Category = item.Category || row.Category;
  row.StoreId = item.StoreId || row.StoreId;

  // Re-render table to show updated row
  renderIngredientsTable();
  hidePantrySuggestions();
  showToast(`Linked to pantry item: ${item.Name}`, 'success');
}

// Debounced input handler
const debouncedPantrySearch = debounce((el, idx) => {
  showPantrySuggestions(el, idx);
}, 250);

// Call init() to start the application
init();
/* ============= PHASE 9: GLOBAL UI PORTALS (Fixed Z-Index) ============= */

// Global Tooltip System
function initGlobalTooltips() {
  let tooltip = document.getElementById('global-tooltip');
  if (!tooltip) {
    tooltip = document.createElement('div');
    tooltip.id = 'global-tooltip';
    tooltip.className = 'global-tooltip';
    document.body.appendChild(tooltip);
  }

  const show = (e) => {
    const target = e.target.closest('[data-tooltip]');
    if (!target) return;

    const text = target.getAttribute('data-tooltip');
    if (!text) return;

    tooltip.textContent = text;
    tooltip.style.display = 'block';

    const rect = target.getBoundingClientRect();
    const pos = target.getAttribute('data-tooltip-pos') || 'top';
    const tooltipRect = tooltip.getBoundingClientRect();

    let top, left;

    if (pos === 'bottom') {
      top = rect.bottom + 8;
      left = rect.left + (rect.width / 2) - (tooltipRect.width / 2);
    } else if (pos === 'left') {
      top = rect.top + (rect.height / 2) - (tooltipRect.height / 2);
      left = rect.left - tooltipRect.width - 8;
    } else {
      // Default top
      top = rect.top - tooltipRect.height - 8;
      left = rect.left + (rect.width / 2) - (tooltipRect.width / 2);
    }

    // Boundary check
    if (left < 4) left = 4;
    if (left + tooltipRect.width > window.innerWidth - 4) left = window.innerWidth - tooltipRect.width - 4;
    if (top < 4) top = 4;

    tooltip.style.top = `${top}px`;
    tooltip.style.left = `${left}px`;
  };

  const hide = () => {
    tooltip.style.display = 'none';
  };

  document.addEventListener('mouseover', show);
  document.addEventListener('mouseout', (e) => {
    const target = e.target.closest('[data-tooltip]');
    if (target) hide();
  });
}

// Global Dropdown System (Portal)
function openGlobalCollectionDropdown(btn, cid, cname) {
  // Close existing dropdowns
  document.querySelectorAll('.global-dropdown-menu').forEach(e => e.remove());

  const menu = document.createElement('div');
  menu.className = 'global-dropdown-menu';
  menu.setAttribute('data-dropdown-open', 'true');

  const options = [
    { label: '🍽️ Assign to Meal', action: 'planner' },
    { label: '📆 Assign to Day', action: 'day' },
    { label: '📅 Assign to Week', action: 'week' }
  ];

  options.forEach(opt => {
    const b = document.createElement('button');
    b.className = 'global-dropdown-option';
    b.textContent = opt.label;
    b.onclick = async (e) => {
      e.preventDefault();
      e.stopPropagation();
      menu.remove();
      try {
        if (opt.action === 'planner') {
          await showAssignCollectionFromCollectionsTab(cid, cname);
        } else if (opt.action === 'day') {
          await showAssignCollectionToDayModal(cid, cname);
        } else if (opt.action === 'week') {
          await showAssignCollectionToWeekModal(cid, cname);
        }
      } catch (err) {
        console.error('Dropdown action error:', err);
        showToast('Error: ' + err.message, 'error');
      }
    };
    menu.appendChild(b);
  });

  document.body.appendChild(menu);

  // Position the menu
  const rect = btn.getBoundingClientRect();
  const menuHeight = menu.offsetHeight || 150;
  const menuWidth = menu.offsetWidth || 180;

  // Check if menu would go off bottom of screen
  let top = rect.bottom + 4;
  if (top + menuHeight > window.innerHeight) {
    top = rect.top - menuHeight - 4;
  }

  // Check if menu would go off right of screen  
  let left = rect.left;
  if (left + menuWidth > window.innerWidth) {
    left = window.innerWidth - menuWidth - 8;
  }

  menu.style.top = `${top}px`;
  menu.style.left = `${left}px`;

  // Close on outside click - use requestAnimationFrame to delay listener
  // This prevents the same click from immediately closing the dropdown
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      const closer = (e) => {
        if (!menu.contains(e.target) && !btn.contains(e.target)) {
          menu.remove();
          document.removeEventListener('click', closer, true);
          document.removeEventListener('keydown', escHandler);
        }
      };
      const escHandler = (e) => {
        if (e.key === 'Escape') {
          menu.remove();
          document.removeEventListener('click', closer, true);
          document.removeEventListener('keydown', escHandler);
        }
      };
      document.addEventListener('click', closer, true);
      document.addEventListener('keydown', escHandler);
    });
  });
}

// Init Tooltips
initGlobalTooltips();
