// Paste this into DevTools Console while app is running

console.clear();
console.log('🔍 Checking User Switcher Dropdown...\n');

// 1. Check elements
const btn = document.getElementById('btnUserSwitcher');
const dropdown = document.getElementById('userSwitcherDropdown');
const list = document.getElementById('userSwitcherList');

console.log('✓ Elements found:');
console.log('  Button:', btn ? '✓' : '✗');
console.log('  Dropdown:', dropdown ? '✓' : '✗');
console.log('  List:', list ? '✓' : '✗');

if (!btn || !dropdown || !list) {
  console.error('❌ Missing elements!');
} else {
  console.log('\n✓ Dropdown state:');
  console.log('  Display style:', dropdown.style.display);
  console.log('  Computed display:', window.getComputedStyle(dropdown).display);
  console.log('  Z-index:', window.getComputedStyle(dropdown).zIndex);
  console.log('  Position:', window.getComputedStyle(dropdown).position);
  
  console.log('\n✓ List content:');
  console.log('  HTML length:', list.innerHTML.length);
  console.log('  First 300 chars:', list.innerHTML.substring(0, 300));
  
  console.log('\n✓ Trying manual open:');
  dropdown.style.display = 'block';
  console.log('  Set display to block');
  console.log('  Check if dropdown is now visible on screen!');
}
