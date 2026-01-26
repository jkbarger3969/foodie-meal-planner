#!/usr/bin/env node
/**
 * Electron wrapper for production fix script
 */

const { app } = require('electron');
const path = require('path');

// Wait for app to be ready
app.whenReady().then(() => {
  // Load and run the fix script
  require('./fix-all-production-issues.js');
  
  // Close app after script completes
  setTimeout(() => {
    app.quit();
  }, 1000);
});

// Prevent default window creation
app.on('window-all-closed', () => {
  app.quit();
});
