const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('Foodie', {
  api: (fn, payload) => ipcRenderer.invoke('foodie-api', { fn, payload }),
  getSettings: () => ipcRenderer.invoke('foodie-get-settings'),
  getEnvConfig: () => ipcRenderer.invoke('foodie-get-env-config'),

  setDbFolder: () => ipcRenderer.invoke('foodie-set-db-path'),
  setCalendarName: (calendarName) => ipcRenderer.invoke('foodie-set-calendar-name', { calendarName }),
  setGoogleCalendarId: (calendarId) => ipcRenderer.invoke('foodie-set-google-calendar-id', { calendarId }),
  printRecipe: (recipeId) => ipcRenderer.invoke('foodie-print-recipe', { recipeId }),
  printShopping: (storeName, items) => ipcRenderer.invoke('foodie-print-shopping', { storeName, items }),
  printPantry: (byCategory, title) => ipcRenderer.invoke('foodie-print-pantry', { byCategory, title }),
  exportData: () => ipcRenderer.invoke('foodie-export-data'),
  importData: () => ipcRenderer.invoke('foodie-import-data'),

  // ========== PHASE 6.1: Backup System ==========
  backupCreate: () => ipcRenderer.invoke('foodie-backup-create'),
  backupList: () => ipcRenderer.invoke('foodie-backup-list'),
  backupRestore: (backupPath) => ipcRenderer.invoke('foodie-backup-restore', { backupPath }),
  backupDelete: (backupPath) => ipcRenderer.invoke('foodie-backup-delete', { backupPath }),
  backupGetStatus: () => ipcRenderer.invoke('foodie-backup-get-status'),

  // ========== PHASE 6.2: Selective Export ==========
  exportRecipes: (recipeIds) => ipcRenderer.invoke('foodie-export-recipes', { recipeIds }),
  exportCollection: (collectionId) => ipcRenderer.invoke('foodie-export-collection', { collectionId }),
  exportMealPlan: (startDate, endDate) => ipcRenderer.invoke('foodie-export-meal-plan', { startDate, endDate }),

  // Companion server API for iOS apps
  sendShoppingListToPhones: (items) => ipcRenderer.invoke('companion:send-shopping-list', { items }),
  sendTodaysMealsToTablets: () => ipcRenderer.invoke('companion:send-todays-meals'),
  sendRecipeToTablet: (recipeId) => ipcRenderer.invoke('companion:send-recipe', { recipeId }),
  getCompanionDevices: () => ipcRenderer.invoke('companion:get-devices'),
  getServerIP: () => ipcRenderer.invoke('companion:get-server-ip'),

  // ========== PAIRING & TRUSTED DEVICES ==========
  getPairingCode: () => ipcRenderer.invoke('companion:get-pairing-code'),
  regeneratePairingCode: () => ipcRenderer.invoke('companion:regenerate-pairing-code'),
  getTrustedDevices: () => ipcRenderer.invoke('companion:get-trusted-devices'),
  untrustDevice: (deviceId) => ipcRenderer.invoke('companion:untrust-device', { deviceId }),
  onPairingCodeChanged: (callback) => {
    const listener = (_event, data) => callback(data);
    ipcRenderer.on('pairing-code-changed', listener);
    return () => ipcRenderer.removeListener('pairing-code-changed', listener);
  },

  onCompanionDevicesChanged: (callback) => {
    const listener = (_event, devices) => callback(devices);
    ipcRenderer.on('companion:devices-changed', listener);
    return () => ipcRenderer.removeListener('companion:devices-changed', listener);
  },
  onShoppingListUpdated: (callback) => {
    const listener = (_event) => callback();
    ipcRenderer.on('shopping-list:updated', listener);
    return () => ipcRenderer.removeListener('shopping-list:updated', listener);
  },
  onCompanionLog: (callback) => {
    const listener = (_event, data) => callback(_event, data);
    ipcRenderer.on('companion-log', listener);
    return () => ipcRenderer.removeListener('companion-log', listener);
  },
  onDbPathChanged: (callback) => {
    const listener = (_event, data) => callback(data);
    ipcRenderer.on('foodie-db-path-changed', listener);
    return () => ipcRenderer.removeListener('foodie-db-path-changed', listener);
  },
  onPantryUpdated: (callback) => {
    const listener = (_event, data) => callback(data);
    ipcRenderer.on('pantry-updated', listener);
    return () => ipcRenderer.removeListener('pantry-updated', listener);
  }
});
