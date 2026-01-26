// Run this in DevTools console to diagnose user switcher dropdown

console.log('=== User Switcher Diagnostic ===');

// Check if elements exist
const btn = document.getElementById('btnUserSwitcher');
const dropdown = document.getElementById('userSwitcherDropdown');
const list = document.getElementById('userSwitcherList');

console.log('Button exists:', !!btn);
console.log('Dropdown exists:', !!dropdown);
console.log('List exists:', !!list);

if (dropdown) {
  console.log('Dropdown display:', dropdown.style.display);
  console.log('Dropdown computed display:', window.getComputedStyle(dropdown).display);
  console.log('Dropdown innerHTML length:', dropdown.innerHTML.length);
  console.log('Dropdown z-index:', window.getComputedStyle(dropdown).zIndex);
  console.log('Dropdown position:', window.getComputedStyle(dropdown).position);
}

if (list) {
  console.log('List innerHTML length:', list.innerHTML.length);
  console.log('List content:', list.innerHTML.substring(0, 200));
}

if (btn) {
  console.log('Button has click listener:', btn.onclick !== null);
  
  // Check event listeners (requires getEventListeners in Chrome DevTools)
  if (typeof getEventListeners !== 'undefined') {
    console.log('Button event listeners:', getEventListeners(btn));
  }
}

// Check if toggleUserSwitcher function exists
console.log('toggleUserSwitcher exists:', typeof toggleUserSwitcher !== 'undefined');

// Try to manually toggle
if (dropdown) {
  console.log('Attempting manual toggle...');
  dropdown.style.display = 'block';
  setTimeout(() => {
    console.log('Dropdown should be visible now. Check the screen.');
  }, 100);
}
