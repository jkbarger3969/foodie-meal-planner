/**
 * @fileoverview Application state module.
 * In ES modules, exported `let` variables can be modified by the module and 
 * those changes are reflected in all importing modules.
 */

import { CACHE_TTL } from './constants.js';

// --- Global Data Stores ---
export let STORES = [];
export let STORE_ID_TO_NAME = {};
export let RECIPES = [];
export let COLLECTIONS = [];
export let COLLECTION_RECIPES = [];

// --- User & UI State ---
export let ACTIVE_USER = null;
export let CURRENT_QUERY = '';
export let LOADING = false;
export let recipeModalMode = 'view'; // view|edit|new
export let CURRENT_RECIPE_ID = '';
export let CURRENT_COLLECTION_ID = '';
export let COLLECTION_VIEW_MODE = 'card'; // 'card' or 'list'
export let MOUSE_POS = { x: 0, y: 0 };
export let MODAL_STATE = {};

// --- Recipe Specific State ---
export let ING_ROWS = [];
export let RECIPE_SCALE = 1.0;
export let RECIPE_BASE_SERVINGS = 4;
export let RECIPE_ORIGINAL_ING_ROWS = [];
export let autoCatDebounceTimer = null;

// --- Feature States ---
export let PLAN = { start: '', days: 14, plansByDate: {}, viewMode: 'grid' };
export let MP = { open: false, date: '', slot: '', q: '', recipes: [] };
export let DRAG_SOURCE = null;
export let toastCounter = 0;

// --- Cache State ---
export const QUERY_CACHE = {
    recipes: null,
    recipesFetchTime: 0,
    plans: new Map(),
    plansFetchTime: new Map(),
    ingredients: new Map(),
    ingredientsFetchTime: new Map(),
    pantry: null,
    pantryFetchTime: 0
};

// --- Search Index ---
export const SEARCH_INDEX = {
    index: null,
    recipeMap: null,
    lastBuiltTime: 0,
    lastSearchQuery: '',
    lastSearchResults: null
};

// --- Undo System ---
export const UNDO = {
    stack: [],
    redoStack: [],
    maxSize: 50
};

// --- Admin/Sync State ---
export let BF = { token: '', totalUpdated: 0, totalScanned: 0 };
export let CL = { token: '', totalDeleted: 0, totalScanned: 0 };

// --- Setters (needed for primitive types if we want to ensure reactivity) ---
export const setLoading = (val) => { LOADING = val; };
export const setActiveUser = (user) => { ACTIVE_USER = user; };
export const setCurrentQuery = (q) => { CURRENT_QUERY = q; };
export const incrementToastCounter = () => { toastCounter++; return toastCounter; };
export const setMousePos = (x, y) => { MOUSE_POS.x = x; MOUSE_POS.y = y; };
export const setRecipeScale = (s) => { RECIPE_SCALE = s; };
export const setIngRows = (rows) => { ING_ROWS = rows; };
export const setRecipeModalMode = (mode) => { recipeModalMode = mode; };
export const setCurrentRecipeId = (id) => { CURRENT_RECIPE_ID = id; };
