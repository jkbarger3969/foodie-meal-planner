#!/usr/bin/env node

/**
 * Quick test to verify pagination logic works correctly
 * Tests the findNextPageUrl function with sample HTML
 */

// Simulate the findNextPageUrl function
function findNextPageUrl(html, currentUrl, siteConfig) {
  const paginationPatterns = {
    'AllRecipes': [
      /href=["']([^"']*\?page=(\d+)[^"']*)["'][^>]*>Next/i,
      /href=["']([^"']*\?page=(\d+)[^"']*)["'][^>]*aria-label=["']Next/i,
      /<a[^>]*class=["'][^"']*pagination[^"']*next[^"']*["'][^>]*href=["']([^"']+)["']/i
    ],
    'BBC Good Food': [
      /href=["']([^"']*\/page\/(\d+)[^"']*)["'][^>]*>Next/i,
      /href=["']([^"']*\?page=(\d+)[^"']*)["'][^>]*>Next/i,
      /<a[^>]*class=["'][^"']*pagination__link--next[^"']*["'][^>]*href=["']([^"']+)["']/i
    ]
  };
  
  const patterns = paginationPatterns[siteConfig.name] || [
    /href=["']([^"']*[?&]page=(\d+)[^"']*)["'][^>]*>Next/i,
    /<a[^>]*class=["'][^"']*next[^"']*["'][^>]*href=["']([^"']+)["']/i
  ];
  
  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match) {
      let nextUrl = match[1];
      
      if (nextUrl.startsWith('/')) {
        nextUrl = siteConfig.baseUrl + nextUrl;
      } else if (!nextUrl.startsWith('http')) {
        nextUrl = siteConfig.baseUrl + '/' + nextUrl;
      }
      
      return nextUrl;
    }
  }
  
  return null;
}

// Test cases
const tests = [
  {
    name: 'AllRecipes with ?page=2',
    html: '<a href="/recipes/78/breakfast-and-brunch/?page=2">Next</a>',
    currentUrl: 'https://www.allrecipes.com/recipes/78/breakfast-and-brunch/',
    siteConfig: { name: 'AllRecipes', baseUrl: 'https://www.allrecipes.com' },
    expected: 'https://www.allrecipes.com/recipes/78/breakfast-and-brunch/?page=2'
  },
  {
    name: 'AllRecipes with aria-label',
    html: '<a href="/recipes/78/breakfast-and-brunch/?page=3" aria-label="Next">›</a>',
    currentUrl: 'https://www.allrecipes.com/recipes/78/breakfast-and-brunch/?page=2',
    siteConfig: { name: 'AllRecipes', baseUrl: 'https://www.allrecipes.com' },
    expected: 'https://www.allrecipes.com/recipes/78/breakfast-and-brunch/?page=3'
  },
  {
    name: 'BBC Good Food with /page/2',
    html: '<a href="/recipes/collection/breakfast-recipes/page/2">Next</a>',
    currentUrl: 'https://www.bbcgoodfood.com/recipes/collection/breakfast-recipes',
    siteConfig: { name: 'BBC Good Food', baseUrl: 'https://www.bbcgoodfood.com' },
    expected: 'https://www.bbcgoodfood.com/recipes/collection/breakfast-recipes/page/2'
  },
  {
    name: 'No next page link',
    html: '<a href="/recipes/some-recipe">Recipe Link</a>',
    currentUrl: 'https://www.allrecipes.com/recipes/78/breakfast-and-brunch/?page=20',
    siteConfig: { name: 'AllRecipes', baseUrl: 'https://www.allrecipes.com' },
    expected: null
  }
];

console.log('Testing pagination link detection...\n');

let passed = 0;
let failed = 0;

for (const test of tests) {
  const result = findNextPageUrl(test.html, test.currentUrl, test.siteConfig);
  const isPass = result === test.expected;
  
  if (isPass) {
    console.log(`✅ PASS: ${test.name}`);
    console.log(`   Expected: ${test.expected}`);
    console.log(`   Got:      ${result}\n`);
    passed++;
  } else {
    console.log(`❌ FAIL: ${test.name}`);
    console.log(`   Expected: ${test.expected}`);
    console.log(`   Got:      ${result}\n`);
    failed++;
  }
}

console.log(`\nResults: ${passed} passed, ${failed} failed`);

if (failed === 0) {
  console.log('✅ All pagination tests passed!');
  process.exit(0);
} else {
  console.log('❌ Some tests failed');
  process.exit(1);
}
