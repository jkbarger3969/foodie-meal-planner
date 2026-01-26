const { getCanonicalKey } = require('../src/main/shopping-normalizer');

console.log('🧪 Testing Canonical Key Generation...\n');

const testCases = [
    { input: 'extra virgin olive oil', expected: 'olive oil' },
    { input: 'Olive Oil', expected: 'olive oil' },
    { input: 'reduced sodium soy sauce', expected: 'soy sauce' },
    { input: 'sodium-soy', expected: 'soy sauce' },
    { input: 'large eggs', expected: 'egg' },
    { input: 'egg', expected: 'egg' },
    { input: 'chopped onions', expected: 'onion' },
    { input: 'diced onion', expected: 'onion' },
    { input: 'mayo', expected: 'mayonnaise' },
    { input: 'spicy mayonnaise', expected: 'mayonnaise' }, // Should ideally group if "spicy" is noise or explicitly handled
    { input: 'fresh cilantro', expected: 'cilantro' },
    { input: 'can of beans', expected: 'bean' }
];

let failures = 0;

testCases.forEach(({ input, expected }) => {
    const start = process.hrtime();
    const actual = getCanonicalKey(input);
    const end = process.hrtime(start);
    const time = (end[0] * 1000 + end[1] / 1e6).toFixed(3);

    if (actual === expected) {
        console.log(`✅ "${input}" -> "${actual}" (${time}ms)`);
    } else {
        console.error(`❌ "${input}" -> "${actual}" (Expected: "${expected}")`);
        failures++;
    }
});

console.log(`\n${testCases.length - failures}/${testCases.length} Passed.`);
if (failures > 0) process.exit(1);
