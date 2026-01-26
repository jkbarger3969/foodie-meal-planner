const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('Foodie', {
  api: (fn, payload) => ipcRenderer.invoke('foodie-api', { fn, payload }),
  getSettings: () => ipcRenderer.invoke('foodie-get-settings'),
  setDbFolder: () => ipcRenderer.invoke('foodie-set-db-path'),
  setCalendarName: (calendarName) => ipcRenderer.invoke('foodie-set-calendar-name', { calendarName }),
  setGoogleCalendarId: (calendarId) => ipcRenderer.invoke('foodie-set-google-calendar-id', { calendarId }),
  printRecipe: (recipeId) => ipcRenderer.invoke('foodie-print-recipe', { recipeId }),
  printShopping: (storeName, items) => ipcRenderer.invoke('foodie-print-shopping', { storeName, items }),
  printPantry: (byCategory, title) => ipcRenderer.invoke('foodie-print-pantry', { byCategory, title }),
  exportData: () => ipcRenderer.invoke('foodie-export-data'),
  importData: () => ipcRenderer.invoke('foodie-import-data'),
  
  // Companion server API for iOS apps
  sendShoppingListToPhones: () => ipcRenderer.invoke('companion:send-shopping-list'),
  sendTodaysMealsToTablets: () => ipcRenderer.invoke('companion:send-todays-meals'),
  sendRecipeToTablet: (recipeId) => ipcRenderer.invoke('companion:send-recipe', { recipeId }),
  getCompanionDevices: () => ipcRenderer.invoke('companion:get-devices'),
  getServerIP: () => ipcRenderer.invoke('companion:get-server-ip'),
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
  }
});
