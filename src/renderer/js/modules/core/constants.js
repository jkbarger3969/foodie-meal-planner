/**
 * @fileoverview Shared constants for the application.
 */

/**
 * Default categories for ingredients.
 * @type {string[]}
 */
export const DEFAULT_ING_CATEGORIES = [
    'Produce', 'Dairy', 'Meat', 'Seafood', 'Pantry', 'Snacks',
    'Frozen', 'Bakery', 'Deli', 'Beverages', 'Household', 'Spice', 'Other'
];

/**
 * Metadata for common UI options.
 * @type {Object}
 */
export const META = {
    qtyNumOptions: ['', '0.25', '0.5', '0.75', '1', '1.5', '2', '3', '4', '5', '6', '8', '10', '12'],
    unitOptions: ['', 'tsp', 'tbsp', 'cup', 'oz', 'lb', 'g', 'kg', 'ml', 'l', 'pinch', 'clove', 'can', 'jar', 'package', 'bunch', 'slice', 'piece'],
    categories: [''],  // Start empty, will be loaded from database
    categoriesLoaded: false  // Track if categories have been loaded from DB
};

/**
 * TTL (Time To Live) constants for caching in milliseconds.
 * @type {Object}
 */
export const CACHE_TTL = {
    RECIPES: 60000,      // 60 seconds
    PLANS: 30000,        // 30 seconds
    INGREDIENTS: 120000, // 2 minutes
    PANTRY: 60000        // 60 seconds
};

/**
 * Default recipe image URL from Unsplash.
 * @type {string}
 */
export const DEFAULT_RECIPE_IMAGE = 'https://images.unsplash.com/photo-1495521821757-a1efb6729352?auto=format&fit=crop&q=80&w=800';

/**
 * LocalStorage key for meal patterns.
 * @type {string}
 */
export const MEAL_PATTERN_KEY = 'foodieMealPattern';
