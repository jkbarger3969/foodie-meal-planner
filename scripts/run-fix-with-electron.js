#!/usr/bin/env node

/**
 * Wrapper to run fix-ingredient-quantities.js with Electron's Node.js
 */

const { spawn } = require('child_process');
const path = require('path');

const electronPath = require('electron');
const scriptPath = path.join(__dirname, 'fix-ingredient-quantities.js');

// Pass any command line arguments to the script
const args = [scriptPath, ...process.argv.slice(2)];

console.log('Running with Electron Node.js...\n');

const child = spawn(electronPath, args, {
  stdio: 'inherit',
  env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' }
});

child.on('exit', (code) => {
  process.exit(code);
});
