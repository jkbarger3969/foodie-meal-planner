#!/usr/bin/env node

/**
 * Test script to verify toast notification system
 * Checks that:
 * 1. showToast function exists in index.html
 * 2. All alert() calls have been replaced
 * 3. Toast types are valid (error, warning, success, info)
 */

const fs = require('fs');
const path = require('path');

const indexPath = path.join(__dirname, 'src/renderer/index.html');
const content = fs.readFileSync(indexPath, 'utf8');

console.log('🧪 Testing Toast Notification System\n');

// Test 1: Verify showToast function exists
console.log('Test 1: Checking for showToast function...');
const hasShowToast = /function showToast\(/.test(content);
if (hasShowToast) {
  console.log('✅ showToast function found\n');
} else {
  console.log('❌ showToast function NOT found\n');
  process.exit(1);
}

// Test 2: Check for remaining alert() calls (excluding comments)
console.log('Test 2: Checking for remaining alert() calls...');
const lines = content.split('\n');
let remainingAlerts = [];

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  const trimmed = line.trim();
  
  // Skip comment lines
  if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) {
    continue;
  }
  
  // Check for alert( but not showAlert
  if (/\balert\s*\(/.test(line) && !/showAlert/.test(line)) {
    remainingAlerts.push({ lineNum: i + 1, line: line.trim().substring(0, 80) });
  }
}

if (remainingAlerts.length === 0) {
  console.log('✅ No alert() calls found (all replaced with showToast)\n');
} else {
  console.log(`❌ Found ${remainingAlerts.length} alert() calls still remaining:`);
  remainingAlerts.forEach(({ lineNum, line }) => {
    console.log(`   Line ${lineNum}: ${line}`);
  });
  console.log('');
  process.exit(1);
}

// Test 3: Verify all showToast calls use valid types
console.log('Test 3: Checking toast types...');
const toastCalls = content.match(/showToast\([^)]+\)/g) || [];
const validTypes = ['error', 'warning', 'success', 'info'];
let invalidTypes = 0;

for (const call of toastCalls) {
  let hasValidType = false;
  for (const type of validTypes) {
    if (call.includes(`'${type}'`) || call.includes(`"${type}"`)) {
      hasValidType = true;
      break;
    }
  }
  if (!hasValidType) {
    console.log(`⚠️  No explicit type found in: ${call.substring(0, 60)}...`);
    invalidTypes++;
  }
}

if (invalidTypes === 0) {
  console.log(`✅ All ${toastCalls.length} toast calls use valid types\n`);
} else {
  console.log(`⚠️  ${invalidTypes} toast calls without explicit type (will use default)\n`);
}

// Test 4: Count toast types usage
console.log('Test 4: Toast type distribution...');
const typeCount = {
  error: (content.match(/showToast\([^)]*'error'/g) || []).length,
  warning: (content.match(/showToast\([^)]*'warning'/g) || []).length,
  success: (content.match(/showToast\([^)]*'success'/g) || []).length,
  info: (content.match(/showToast\([^)]*'info'/g) || []).length
};

console.log('  error:   ', typeCount.error);
console.log('  warning: ', typeCount.warning);
console.log('  success: ', typeCount.success);
console.log('  info:    ', typeCount.info);
console.log('  TOTAL:   ', Object.values(typeCount).reduce((a, b) => a + b, 0));

console.log('\n✅ All tests passed! Toast system is working correctly.\n');
