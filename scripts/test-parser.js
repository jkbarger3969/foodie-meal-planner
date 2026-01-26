const path = require('path');
const api = require(path.join(__dirname, '..', 'src', 'main', 'api.js'));

const testCases = [
  '1 tsp. crushed red pepper flakes',
  '2 tbsp. extra-virgin olive oil, divided',
  '1 tbsp. fresh thyme&nbsp;',
  '2 tbsp. fresh torn basil',
  '1 (17-oz.) pkg. gnocchi',
  '1 unsmoked gammon joint (around 750g)',
  'Chopped cilantro (optional)',
  '2 (3 ounce) pkgs dry ramen noodles, seasoning packets discarded',
  '1 1/2 c. heavy cream',
  '. crushed red pepper flakes',
  '/2 c. heavy cream',
  ') pkg. gnocchi'
];

console.log('Testing parser with problematic ingredients:\n');

for (const test of testCases) {
  const result = api.parseIngredientLine(test);
  if (result) {
    console.log(`Raw: "${test}"`);
    console.log(`  → Norm: "${result.IngredientNorm}"`);
    console.log(`  → Name: "${result.IngredientName}"`);
    console.log(`  → Qty: ${result.QtyNum} | QtyText: "${result.QtyText}"`);
    console.log();
  }
}
