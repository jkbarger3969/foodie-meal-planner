// Debug flag - set to false for production builds
// NOTE: app.js has its own DEBUG constant which is the one actually used at runtime.
// This file is kept for potential future modularization.
const DEBUG = false;

// Debounce delays
const DEBOUNCE_SEARCH = 500;
const DEBOUNCE_CLASSIFY = 500;
const DEBOUNCE_INPUT = 300;

// Cache TTL
const RECIPE_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// UI delays
const TOAST_DURATION = 3000;
const TOAST_DURATION_LONG = 5000;
const MODAL_TRANSITION = 300;
const FAVORITE_TOGGLE_DELAY = 300;

// Virtual scrolling
const VIRTUAL_SCROLL_THRESHOLD = 100;
const VIRTUAL_SCROLL_ITEM_HEIGHT = 280;
const VIRTUAL_SCROLL_BUFFER = 5;

// Pagination
const RECIPES_PER_PAGE = 50;

// Search
const MIN_SEARCH_LENGTH = 2;

// Performance
const IDLE_CALLBACK_TIMEOUT = 2000;

// Export for use in app
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        DEBUG,
        DEBOUNCE_SEARCH,
        DEBOUNCE_CLASSIFY,
        DEBOUNCE_INPUT,
        RECIPE_CACHE_TTL,
        TOAST_DURATION,
        TOAST_DURATION_LONG,
        MODAL_TRANSITION,
        FAVORITE_TOGGLE_DELAY,
        VIRTUAL_SCROLL_THRESHOLD,
        VIRTUAL_SCROLL_ITEM_HEIGHT,
        VIRTUAL_SCROLL_BUFFER,
        RECIPES_PER_PAGE,
        MIN_SEARCH_LENGTH,
        IDLE_CALLBACK_TIMEOUT
    };
}
