/**
 * @fileoverview Logic for normalizing and aggregating shopping list ingredients.
 * Handles aliases (mayo -> mayonnaise), plurals, and noise words (chopped, diced).
 */

const pluralize = (word) => {
    // Simple pluralizer to avoid dependency bloat.
    // We only need to catch common cases for aggregation.
    if (!word) return '';
    if (word.endsWith('ies')) return word.slice(0, -3) + 'y';
    if (word.endsWith('es') && (word.endsWith('oes') || word.endsWith('xes') || word.endsWith('ches') || word.endsWith('ses'))) return word.slice(0, -2);
    if (word.endsWith('s') && !word.endsWith('ss')) return word.slice(0, -1);
    return word;
};

// Words to strip out when generating the "Canonical Key" for grouping
const NOISE_WORDS = new Set([
    // Prep methods
    'chopped', 'diced', 'minced', 'sliced', 'grated', 'shredded', 'crushed', 'ground',
    'peeled', 'cored', 'seeded', 'julienned', 'halved', 'quartered', 'cubed', 'smashed',
    'beaten', 'whisked', 'sifted', 'melted', 'softened', 'toasted', 'roasted', 'cooked',
    // Adjectives / Types
    'fresh', 'dried', 'frozen', 'raw', 'organic', 'kosher', 'spicy', 'sweet', 'hot',
    'extra', 'virgin', 'reduced', 'sodium', 'low', 'fat', 'skim', 'whole',
    'large', 'medium', 'small', 'jumbo',
    'boneless', 'skinless', 'lean',
    'can', 'canned', 'jar', 'jarred', 'bottle', 'bottled',
    'package', 'packaged', 'bag', 'box', 'of'
]);

// Explicit mapping for synonyms
const ALIASES = {
    'mayo': 'mayonnaise',
    'sodium soy': 'soy sauce', // Handle space-separated version after dash removal
    'sodiumsoy': 'soy sauce',
    'soy': 'soy sauce', // Aggressive mapping? Maybe too aggressive, but user asked for "sodium-soy" -> "soy sauce"
    'parm': 'parmesan cheese',
    'parmesan': 'parmesan cheese',
    'oj': 'orange juice',
    'bbq': 'barbecue',
    'sriracha': 'hot sauce',
    'catsup': 'ketchup',
    'coke': 'cola',
    'soda': 'cola'
};

/**
 * Generates a canonical key for an ingredient to allow grouping.
 * "Extra Virgin Olive Oil" -> "olive oil"
 * "Chopped Onions" -> "onion"
 * "Mayo" -> "mayonnaise"
 * 
 * @param {string} rawName 
 * @returns {string} The canonical key
 */
function getCanonicalKey(rawName) {
    if (!rawName) return '';

    // 1. Lowercase and normalize dashes/spaces
    let norm = rawName.toLowerCase()
        .replace(/-/g, ' ')
        .replace(/[^\w\s]/g, '') // Remove punctuation
        .trim();

    // 2. Check Whole-Word Alias Match
    if (ALIASES[norm]) {
        return ALIASES[norm];
    }

    // 3. Tokenize
    const tokens = norm.split(/\s+/);

    // 4. Filter Noise Words & Pluralize
    const filtered = tokens
        .filter(t => !NOISE_WORDS.has(t))
        .map(t => pluralize(t));

    // 5. Reassemble
    let key = filtered.join(' ');

    // 6. Final Alias Check
    if (ALIASES[key]) return ALIASES[key];

    // If key became empty (e.g. input was just "Large"), fallback to original singularized
    if (!key) {
        return pluralize(tokens[tokens.length - 1] || norm);
    }

    return key;
}

module.exports = {
    getCanonicalKey,
    ALIASES,
    NOISE_WORDS
};
