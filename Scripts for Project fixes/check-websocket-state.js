/**
 * Diagnostic script to check WebSocket connection states
 * Run this while the desktop app is running and devices are connected
 */

const WebSocket = require('ws');

console.log('\n🔍 WebSocket ReadyState Values:');
console.log('0 = CONNECTING');
console.log('1 = OPEN (ready to send)');
console.log('2 = CLOSING');
console.log('3 = CLOSED');

console.log('\n⚠️  This script cannot directly inspect the running app.');
console.log('📋 To see actual connection states, you need to:');
console.log('   1. Run the app from terminal: /Applications/Foodie\\ Meal\\ Planner.app/Contents/MacOS/Foodie\\ Meal\\ Planner');
console.log('   2. Or check Console.app and filter for "Foodie"');
console.log('   3. Look for these log patterns:');
console.log('      • "✅ Sent to..." = successful send');
console.log('      • "⚠️  Skipping... WebSocket not OPEN (state: X)" = connection not ready');
console.log('      • "❌ Failed to send..." = send error');
console.log('      • "📊 pushToDeviceType(...): Sent to N device(s)" = final count');
console.log('\n💡 The fact that you\'re getting count: 1 means:');
console.log('   • Either 1 message was successfully sent');
console.log('   • OR the WebSocket was not in OPEN state (readyState !== 1)');
console.log('   • Main process logs will show which scenario occurred\n');
