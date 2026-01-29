require('dotenv').config();
const path = require('path');
const { app, BrowserWindow, ipcMain, dialog, Menu, globalShortcut, protocol, net } = require('electron');
const { createDb, getDbPathDefault, setDbPath } = require('./db');
const { handleApiCall } = require('./api');
const WebSocket = require('ws');
const http = require('http');
const os = require('os');
const fs = require('fs');
const { Bonjour } = require('bonjour-service');

// Handle uncaught exceptions gracefully (especially network errors like EHOSTUNREACH)
process.on('uncaughtException', (err) => {
  if (err.code === 'EHOSTUNREACH' || err.code === 'ENETUNREACH' || err.code === 'ENOTFOUND') {
    console.warn('[Network] Network unreachable, ignoring mDNS/Bonjour error:', err.message);
    return;
  }
  if (err.message && err.message.includes('224.0.0.251')) {
    console.warn('[Network] mDNS multicast failed (network unavailable):', err.message);
    return;
  }
  console.error('[Uncaught Exception]', err);
});

process.on('unhandledRejection', (reason, promise) => {
  if (reason && (reason.code === 'EHOSTUNREACH' || reason.code === 'ENETUNREACH')) {
    console.warn('[Network] Unhandled rejection due to network unavailability:', reason.message);
    return;
  }
  console.error('[Unhandled Rejection]', reason);
});

// Set consistent app name for userData folder
// This ensures dev and production use the same folder
app.setName('Foodie Meal Planner');

// Register custom protocol as privileged BEFORE app.whenReady()
// This is required for the protocol to work in production builds
protocol.registerSchemesAsPrivileged([
  {
    scheme: 'foodie-image',
    privileges: {
      secure: true,
      supportFetchAPI: true,
      bypassCSP: true,
      corsEnabled: false
    }
  }
]);


let StoreCtor = null;
async function getStoreCtor() {
  if (StoreCtor) return StoreCtor;
  const mod = await import('electron-store');
  StoreCtor = mod.default;
  return StoreCtor;
}

let store = null;
async function initStore() {
  const Store = await getStoreCtor();
  store = new Store({
    name: 'foodie-settings',
    defaults: {
      dbPath: '',
      calendarName: 'Foodie Meal Planner',
      googleCalendarId: 'primary',
    },
  });
  return store;
}

// ========================================
// COMPANION SERVER (WebSocket)
// ========================================

class CompanionServer {
  constructor() {
    this.wss = null;
    this.clients = new Map(); // deviceId -> { ws, deviceType, ip, authenticated }
    this.mainWindow = null;
    this.server = null; // Underlying HTTP server

    // ========== PAIRING & AUTHENTICATION ==========
    this.pairingCode = this.generatePairingCode();
    this.trustedDevices = new Map(); // deviceId -> { name, pairedAt, lastSeen }
    this.trustedDevicesPath = null; // Set after app ready
    this.PAIRING_TIMEOUT = 30000; // 30 seconds to enter pairing code

    // ========== RATE LIMITING ==========
    this.rateLimits = new Map(); // deviceId -> { count, windowStart }
    this.RATE_LIMIT_WINDOW = 1000; // 1 second window
    this.RATE_LIMIT_MAX = 20; // Max 20 messages per second per device

    // ========== PHASE 9.6: STATE TRACKING FOR DIFFERENTIAL SYNC ==========
    this.clientState = new Map(); // deviceId -> { lastMealPlanHash, lastShoppingListHash, lastSyncTime }
    this.pendingBatches = new Map(); // deviceId -> { messages: [], timeout }
    this.BATCH_DELAY = 100; // ms - wait 100ms to collect messages before sending

    this.bonjour = new Bonjour();
    this.service = null;
  }

  // ========== RATE LIMITING ==========
  checkRateLimit(deviceId) {
    const now = Date.now();
    let limit = this.rateLimits.get(deviceId);

    if (!limit || (now - limit.windowStart) > this.RATE_LIMIT_WINDOW) {
      // New window
      this.rateLimits.set(deviceId, { count: 1, windowStart: now });
      return true;
    }

    if (limit.count >= this.RATE_LIMIT_MAX) {
      console.warn(`⚠️ Rate limit exceeded for device ${deviceId}`);
      return false;
    }

    limit.count++;
    return true;
  }

  // ========== PAIRING CODE MANAGEMENT ==========
  generatePairingCode() {
    return String(Math.floor(100000 + Math.random() * 900000));
  }

  regeneratePairingCode() {
    this.pairingCode = this.generatePairingCode();
    console.log(`📱 New pairing code generated: ${this.pairingCode}`);
    this.notifyPairingCodeChanged();
    return this.pairingCode;
  }

  getPairingCode() {
    return this.pairingCode;
  }

  notifyPairingCodeChanged() {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send('pairing-code-changed', { code: this.pairingCode });
    }
  }

  // ========== TRUSTED DEVICES PERSISTENCE ==========
  initTrustedDevicesPath() {
    if (!this.trustedDevicesPath) {
      this.trustedDevicesPath = path.join(app.getPath('userData'), 'companion-devices.json');
    }
  }

  loadTrustedDevices() {
    this.initTrustedDevicesPath();
    try {
      if (fs.existsSync(this.trustedDevicesPath)) {
        const data = JSON.parse(fs.readFileSync(this.trustedDevicesPath, 'utf8'));
        this.trustedDevices = new Map(Object.entries(data));
        console.log(`📱 Loaded ${this.trustedDevices.size} trusted device(s)`);
      }
    } catch (error) {
      console.error('Failed to load trusted devices:', error);
      this.trustedDevices = new Map();
    }
  }

  saveTrustedDevices() {
    this.initTrustedDevicesPath();
    try {
      const data = Object.fromEntries(this.trustedDevices);
      fs.writeFileSync(this.trustedDevicesPath, JSON.stringify(data, null, 2));
    } catch (error) {
      console.error('Failed to save trusted devices:', error);
    }
  }

  isDeviceTrusted(deviceId) {
    return this.trustedDevices.has(deviceId);
  }

  trustDevice(deviceId, deviceName, deviceType) {
    const now = new Date().toISOString();
    this.trustedDevices.set(deviceId, {
      name: deviceName || `Device ${deviceId.slice(-6)}`,
      type: deviceType || 'unknown',
      pairedAt: now,
      lastSeen: now
    });
    this.saveTrustedDevices();
    console.log(`📱 Device trusted: ${deviceId} (${deviceName}) [${deviceType}]`);
  }

  updateDeviceLastSeen(deviceId) {
    if (this.trustedDevices.has(deviceId)) {
      const device = this.trustedDevices.get(deviceId);
      const client = this.clients.get(deviceId);

      device.lastSeen = new Date().toISOString();

      // Update name and type if we have better info from the connected client
      if (client) {
        // ALWAYS update the name if provided by the client (allows renaming devices)
        if (client.deviceName && client.deviceName !== device.name) {
          device.name = client.deviceName;
        }
        if (client.deviceType && (!device.type || device.type === 'unknown')) {
          device.type = client.deviceType;
        }
      }

      this.trustedDevices.set(deviceId, device);
      this.saveTrustedDevices();
    }
  }

  untrustDevice(deviceId) {
    if (this.trustedDevices.has(deviceId)) {
      this.trustedDevices.delete(deviceId);
      this.saveTrustedDevices();
      console.log(`📱 Device removed: ${deviceId}`);

      // Disconnect if currently connected
      const client = this.clients.get(deviceId);
      if (client && client.ws) {
        client.ws.send(JSON.stringify({
          type: 'unpaired',
          message: 'Device has been unpaired from the desktop app'
        }));
        client.ws.close();
      }
      return true;
    }
    return false;
  }

  getTrustedDevices() {
    const devices = [];
    for (const [deviceId, info] of this.trustedDevices) {
      const client = this.clients.get(deviceId);

      // Prefer connected client's name if available and stored name looks like a fallback
      let displayName = info.name;
      if (client && client.deviceName) {
        // If stored name is just "iPhone" or "iPad", use the client's actual name
        if (info.name === 'iPhone' || info.name === 'iPad' || info.name === 'unknown') {
          displayName = client.deviceName;
        }
      }

      devices.push({
        deviceId,
        name: displayName,
        type: info.type || (client ? client.deviceType : 'unknown'),
        pairedAt: info.pairedAt,
        lastSeen: info.lastSeen,
        isOnline: !!client && client.authenticated
      });
    }
    return devices;
  }

  // Send log to both console and renderer window
  log(level, ...args) {
    const message = args.join(' ');
    console.log(...args);

    // Also send to renderer if window exists
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send('companion-log', { level, message });
    }
  }

  // Serialize recipe object for safe JSON transmission
  serializeRecipe(recipe) {
    if (!recipe) return null;

    return {
      RecipeId: recipe.RecipeId || '',
      Title: recipe.Title || '',
      URL: recipe.URL || '',
      Cuisine: recipe.Cuisine || '',
      MealType: recipe.MealType || '',
      Notes: recipe.Notes || '',
      Instructions: recipe.Instructions || '',
      Image_Name: recipe.Image_Name || ''
    };
  }

  // Serialize ingredient object for safe JSON transmission
  serializeIngredient(ing) {
    if (!ing) return null;

    return {
      idx: ing.idx || 0,
      IngredientNorm: ing.IngredientNorm || '',
      IngredientRaw: ing.IngredientRaw || '',
      QtyText: ing.QtyText || '',
      QtyNum: ing.QtyNum || null,
      Unit: ing.Unit || '',
      Category: ing.Category || '',
      StoreId: ing.StoreId || ''
    };
  }

  // ========== PHASE 9.6: HASH FUNCTION FOR DIFFERENTIAL SYNC ==========
  hashObject_(obj) {
    // Simple hash function - stringify and hash
    const str = JSON.stringify(obj);
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash;
  }

  // ========== PHASE 9.6: MESSAGE BATCHING ==========
  batchMessage_(deviceId, message) {
    // Get or create batch for this device
    if (!this.pendingBatches.has(deviceId)) {
      this.pendingBatches.set(deviceId, { messages: [], timeout: null });
    }

    const batch = this.pendingBatches.get(deviceId);
    batch.messages.push(message);

    // Clear existing timeout
    if (batch.timeout) {
      clearTimeout(batch.timeout);
    }

    // Set new timeout to send batch after delay
    batch.timeout = setTimeout(() => {
      this.flushBatch_(deviceId);
    }, this.BATCH_DELAY);
  }

  flushBatch_(deviceId) {
    const client = this.clients.get(deviceId);
    const batch = this.pendingBatches.get(deviceId);

    if (!client || !batch || batch.messages.length === 0) {
      return;
    }

    try {
      // If only one message, send it directly
      if (batch.messages.length === 1) {
        client.ws.send(JSON.stringify(batch.messages[0]));
        console.log(`[Phase 9.6] Sent 1 message to ${deviceId}`);
      } else {
        // Send as batched message
        client.ws.send(JSON.stringify({
          type: 'batch',
          messages: batch.messages,
          timestamp: new Date().toISOString()
        }));
        console.log(`[Phase 9.6] Batched ${batch.messages.length} messages to ${deviceId}`);
      }
    } catch (error) {
      console.error(`Error flushing batch to ${deviceId}:`, error);
    }

    // Clear batch
    this.pendingBatches.delete(deviceId);
  }

  startBonjourService(port) {
    try {
      // Stop existing service if any
      if (this.service) {
        try {
          this.service.stop();
        } catch (e) {
          // Ignore stop errors
        }
        this.service = null;
      }

      this.service = this.bonjour.publish({
        name: `Foodie Meal Planner (${os.hostname()})`,
        type: 'foodie',
        protocol: 'tcp',
        port: port,
        txt: {
          version: '1.0.0',
          serverId: os.hostname()
        }
      });

      if (this.service) {
        this.service.on('up', () => {
          console.log(`📡 Bonjour service advertised: ${this.service.name}`);
        });

        this.service.on('error', (err) => {
          // Don't crash the app if Bonjour fails
          if (err.code === 'EHOSTUNREACH' || err.code === 'ENETUNREACH') {
            console.warn('📡 Network unreachable for Bonjour multicast - will retry when network is available');
          } else {
            console.error('📡 Bonjour service error:', err.message || err);
          }
        });
      }
    } catch (bonjourError) {
      console.warn('📡 Failed to start Bonjour advertisement:', bonjourError.message || bonjourError);
    }
  }

  start(port = 8080) {
    try {
      // Create HTTP server for both WebSockets and Image serving
      this.server = http.createServer((req, res) => {
        // Simple static file server for images
        if (req.url.startsWith('/images/')) {
          const imageName = path.basename(req.url);
          const imagePath = path.join(app.getPath('userData'), 'images', imageName);

          fs.access(imagePath, fs.constants.R_OK, (err) => {
            if (err) {
              res.statusCode = 404;
              res.end('Image not found');
              return;
            }

            const ext = path.extname(imageName).toLowerCase();
            const mimeTypes = {
              '.jpg': 'image/jpeg',
              '.jpeg': 'image/jpeg',
              '.png': 'image/png',
              '.webp': 'image/webp'
            };

            res.setHeader('Content-Type', mimeTypes[ext] || 'application/octet-stream');
            fs.createReadStream(imagePath).pipe(res);
          });
          return;
        }

        res.statusCode = 404;
        res.end('Not found');
      });

      this.wss = new WebSocket.Server({ server: this.server });
      this.server.listen(port);

      console.log(`📱 Companion server & Image server started on port ${port}`);
      console.log(`📱 Pairing code: ${this.pairingCode}`);
      this.logLocalIPs();

      // Advertise service via Bonjour (with network error resilience)
      this.startBonjourService(port);

      this.wss.on('connection', (ws, req) => {
        const clientIp = req.socket.remoteAddress;
        const deviceId = req.headers['x-device-id'] || `device-${Date.now()}`;
        const deviceType = req.headers['x-device-type'] || 'unknown';
        const deviceName = req.headers['x-device-name'] || deviceType;
        const isTrusted = this.isDeviceTrusted(deviceId);

        console.log(`📱 ${deviceType} connected: ${deviceId} (${clientIp}) - ${isTrusted ? 'TRUSTED' : 'NEEDS PAIRING'}`);

        // Store client with fresh WebSocket reference
        this.clients.set(deviceId, {
          ws,
          deviceType,
          deviceName,
          ip: clientIp,
          authenticated: isTrusted
        });

        // Initialize client state for differential sync
        this.clientState.set(deviceId, {
          lastMealPlanHash: null,
          lastShoppingListHash: null,
          lastSyncTime: Date.now()
        });

        // CRITICAL: Set up message handler directly on this WebSocket instance
        ws.on('message', async (rawMessage) => {
          const messageText = rawMessage.toString();
          console.log(`📥 Message from ${deviceId}: ${messageText.substring(0, 150)}`);

          try {
            const message = JSON.parse(messageText);
            await this.handleMessage(deviceId, message);
          } catch (err) {
            console.error(`❌ Error handling message from ${deviceId}:`, err);
          }
        });

        ws.on('close', (code, reason) => {
          console.log(`📱 ${deviceType} disconnected: ${deviceId} (code=${code})`);
          const client = this.clients.get(deviceId);
          if (client && client.pairingTimeout) {
            clearTimeout(client.pairingTimeout);
          }
          this.clients.delete(deviceId);
          this.rateLimits.delete(deviceId);
          this.clientState.delete(deviceId);
          if (this.pendingBatches.has(deviceId)) {
            const batch = this.pendingBatches.get(deviceId);
            if (batch.timeout) clearTimeout(batch.timeout);
            this.pendingBatches.delete(deviceId);
          }
          this.notifyDevicesChanged();
        });

        ws.on('error', (error) => {
          console.error(`❌ WebSocket error for ${deviceId}:`, error.message);
        });

        // Send initial response based on trust status
        if (isTrusted) {
          this.updateDeviceLastSeen(deviceId);
          ws.send(JSON.stringify({
            type: 'connected',
            authenticated: true,
            serverId: os.hostname(),
            timestamp: new Date().toISOString()
          }));
        } else {
          ws.send(JSON.stringify({
            type: 'pairing_required',
            serverId: os.hostname(),
            serverName: `Foodie (${os.hostname()})`,
            timestamp: new Date().toISOString()
          }));

          const pairingTimeout = setTimeout(() => {
            const client = this.clients.get(deviceId);
            if (client && !client.authenticated) {
              console.log(`📱 Pairing timeout for ${deviceId} - disconnecting`);
              ws.send(JSON.stringify({
                type: 'pairing_timeout',
                message: 'Pairing code not received in time'
              }));
              ws.close();
            }
          }, this.PAIRING_TIMEOUT);

          const client = this.clients.get(deviceId);
          if (client) {
            client.pairingTimeout = pairingTimeout;
          }
        }

        this.notifyDevicesChanged();
      });

      this.wss.on('error', (error) => {
        console.error('WebSocket server error:', error);
      });

    } catch (error) {
      console.error('Failed to start companion server:', error);
    }
  }

  async handleMessage(deviceId, message) {
    const client = this.clients.get(deviceId);
    if (!client) return;

    try {
      // ========== HANDLE PAIRING MESSAGE ==========
      if (message.type === 'pair') {
        await this.handlePairing(deviceId, message);
        return;
      }

      // ========== PING IS ALWAYS ALLOWED ==========
      if (message.type === 'ping') {
        client.ws.send(JSON.stringify({ type: 'pong', timestamp: Date.now() }));
        return;
      }

      // ========== REQUIRE AUTHENTICATION FOR ALL OTHER MESSAGES ==========
      if (!client.authenticated) {
        client.ws.send(JSON.stringify({
          type: 'error',
          error: 'not_authenticated',
          message: 'Please pair this device first'
        }));
        return;
      }

      switch (message.type) {
        case 'request_shopping_list':
          await this.sendShoppingList(deviceId);
          break;

        case 'request_store_list':
          await this.sendStoreList(deviceId);
          break;

        case 'request_meal_plan':
          await this.sendMealPlan(deviceId, message.date);
          break;

        case 'request_recipe':
          await this.sendRecipe(deviceId, message.recipeId);
          break;

        case 'load_recipe':
          // iPad sends load_recipe with recipeId in data object
          this.log('info', '📥 DESKTOP: Received load_recipe from iPad');
          this.log('info', '   message: ' + JSON.stringify(message));
          if (message.data && message.data.recipeId) {
            this.log('info', '   Loading recipe: ' + message.data.recipeId);
            await this.sendRecipe(deviceId, message.data.recipeId);
            this.log('success', '   Recipe sent!');
          } else {
            this.log('error', '   ERROR: No recipeId in message.data');
          }
          break;

        case 'sync_changes':
          await this.handleSyncChanges(deviceId, message.data);
          break;

        case 'item_removed':
          await this.handleItemRemoved(deviceId, message);
          break;

        case 'item_unpurchased':
          await this.handleItemUnpurchased(deviceId, message);
          break;

        case 'item_purchased':
          await this.handleItemPurchased(deviceId, message);
          break;

        case 'add_pantry_item':
          await this.handleAddPantryItem(deviceId, message);
          break;

        case 'timer_update':
          // Relay timer updates to all other devices (Echo)
          this.broadcastToOthers(deviceId, message);
          break;

        case 'sous_chef_query':
          await this.handleSousChefQuery(deviceId, message);
          break;

        default:
          console.log(`Unknown message type: ${message.type}`);
      }
    } catch (error) {
      console.error(`Error handling message from ${deviceId}:`, error);
    }
  }

  async handlePairing(deviceId, message) {
    const client = this.clients.get(deviceId);
    if (!client) return;

    const providedCode = String(message.code || '').trim();
    const deviceName = message.deviceName || client.deviceName || client.deviceType;
    const deviceType = client.deviceType || 'unknown';

    if (providedCode === this.pairingCode) {
      // Pairing successful
      client.authenticated = true;

      // Clear pairing timeout
      if (client.pairingTimeout) {
        clearTimeout(client.pairingTimeout);
        client.pairingTimeout = null;
      }

      // Trust this device for future connections
      this.trustDevice(deviceId, deviceName, deviceType);

      client.ws.send(JSON.stringify({
        type: 'paired',
        success: true,
        serverId: os.hostname(),
        message: 'Device paired successfully'
      }));

      console.log(`📱 Device paired: ${deviceId} (${deviceName}) [${deviceType}]`);
      this.notifyDevicesChanged();
    } else {
      // Wrong code
      client.ws.send(JSON.stringify({
        type: 'pairing_failed',
        success: false,
        message: 'Invalid pairing code'
      }));
      console.log(`📱 Pairing failed for ${deviceId} - wrong code`);
    }
  }

  async sendShoppingList(deviceId) {
    const client = this.clients.get(deviceId);
    if (!client) return;

    try {
      // Generate shopping list from today's meal plan for the active user
      const today = new Date().toISOString().split('T')[0];

      // Get active user from renderer or use Whole Family as fallback
      const activeUserRes = await handleApiCall({ fn: 'getActiveUser', payload: {}, store });
      const userId = (activeUserRes.ok && activeUserRes.userId) ? activeUserRes.userId : null;

      const planResult = await handleApiCall({
        fn: 'getUserPlanMeals',
        payload: { start: today, end: today, userId },
        store
      });

      let items = [];

      if (planResult && planResult.ok && Array.isArray(planResult.plans) && planResult.plans.length > 0) {
        const plan = planResult.plans[0];
        const recipeIds = [];

        if (plan.Breakfast?.RecipeId) recipeIds.push(plan.Breakfast.RecipeId);
        if (plan.Lunch?.RecipeId) recipeIds.push(plan.Lunch.RecipeId);
        if (plan.Dinner?.RecipeId) recipeIds.push(plan.Dinner.RecipeId);

        for (const recipeId of recipeIds) {
          const ingredientsResult = await handleApiCall({
            fn: 'listRecipeIngredients',
            payload: { recipeId },
            store
          });

          if (ingredientsResult && ingredientsResult.ok && Array.isArray(ingredientsResult.items)) {
            // Serialize each ingredient to ensure clean data
            const serializedIngredients = ingredientsResult.items.map(ing => {
              const serialized = this.serializeIngredient(ing);
              return {
                ItemId: `${recipeId}-${ing.idx || 0}`,  // iOS expects "ItemId"
                IngredientName: serialized.IngredientNorm || serialized.IngredientRaw || 'Unknown',  // iOS expects "IngredientName"
                QtyText: serialized.QtyText || (serialized.QtyNum ? String(serialized.QtyNum) : ''),  // iOS expects "QtyText"
                Unit: serialized.Unit || '',
                Category: serialized.Category || '',
                StoreName: serialized.StoreId || 'kroger',  // iOS expects "StoreName"
                RecipeId: recipeId,
                is_purchased: 0  // iOS expects "is_purchased" as int
              };
            });
            items.push(...serializedIngredients);
          }
        }
      }

      // CRITICAL: If we have no items to send, send a message that tells iPhone to keep its local data
      // This prevents clearing the shopping list when desktop has no plan or connection issues
      if (items.length === 0) {
        client.ws.send(JSON.stringify({
          type: 'shopping_list',
          data: [],
          version: null, // No version = don't replace, just acknowledge
          forceReplace: false, // Don't replace if iPhone has data
          timestamp: new Date().toISOString()
        }));
        console.log(`📤 Sent empty shopping list to ${client.deviceType} (iPhone will keep local data)`);
        return;
      }

      // Generate version for non-empty lists
      const version = `${Date.now()}-${items.length}`;

      client.ws.send(JSON.stringify({
        type: 'shopping_list',
        data: items,
        version: version,
        forceReplace: false, // On reconnect, merge don't replace
        timestamp: new Date().toISOString()
      }));
      console.log(`📤 Sent ${items.length} shopping items to ${client.deviceType} (version: ${version})`);
    } catch (error) {
      console.error('Error sending shopping list:', error);
    }
  }

  async sendStoreList(deviceId) {
    const client = this.clients.get(deviceId);
    if (!client) return;

    try {
      const result = await handleApiCall({
        fn: 'listStores',
        payload: {},
        store
      });

      if (result && result.ok && Array.isArray(result.items)) {
        client.ws.send(JSON.stringify({
          type: 'store_list',
          data: result.items.map(s => ({ StoreId: s.StoreId, Name: s.Name })),
          timestamp: new Date().toISOString()
        }));
        console.log(`📋 Sent ${result.items.length} stores to ${client.deviceType}`);
      }
    } catch (error) {
      console.error(`Error sending store list to ${deviceId}:`, error);
    }
  }

  async sendMealPlan(deviceId, date = new Date().toISOString().split('T')[0]) {
    const client = this.clients.get(deviceId);
    if (!client) return;

    try {
      // Get active user from renderer
      const activeUserRes = await handleApiCall({ fn: 'getActiveUser', payload: {}, store });
      const userId = (activeUserRes.ok && activeUserRes.userId) ? activeUserRes.userId : null;

      const planResult = await handleApiCall({
        fn: 'getUserPlanMeals',
        payload: {
          start: date,
          end: date,
          userId
        },
        store
      });

      let meals = [];
      if (planResult && planResult.ok && Array.isArray(planResult.plans) && planResult.plans.length > 0) {
        const plan = planResult.plans[0];

        for (const slot of ['Breakfast', 'Lunch', 'Dinner']) {
          const meal = plan[slot];
          if (meal && meal.RecipeId) {
            // PHASE 4.5.7: Get meal assignments
            const assignmentsResult = await handleApiCall({
              fn: 'getMealAssignments',
              payload: { date, slot },
              store
            });

            const assignedUsers = (assignmentsResult && assignmentsResult.ok && assignmentsResult.assignments)
              ? assignmentsResult.assignments.map(a => ({
                userId: a.userId,
                name: a.name,
                avatarEmoji: a.avatarEmoji || '👤',
                email: a.email || null
              }))
              : [];

            // PHASE 4.5.7: Get additional items
            const additionalResult = await handleApiCall({
              fn: 'getAdditionalItems',
              payload: { date, slot },
              store
            });

            const additionalItems = (additionalResult && additionalResult.ok && additionalResult.items)
              ? additionalResult.items.map(item => ({
                recipeId: item.RecipeId,
                title: item.Title,
                itemType: item.ItemType || 'side'
              }))
              : [];

            // NEW: Fetch and embed full recipe data (for instant load on iOS)
            const recipeResult = await handleApiCall({ fn: 'getRecipe', payload: { recipeId: meal.RecipeId }, store });
            const ingredientsResult = await handleApiCall({ fn: 'listRecipeIngredients', payload: { recipeId: meal.RecipeId }, store });

            let embeddedRecipe = null;
            if (recipeResult && recipeResult.ok) {
              const serializedRecipe = this.serializeRecipe(recipeResult.recipe);
              const serializedIngredients = (ingredientsResult && ingredientsResult.ok && ingredientsResult.items)
                ? ingredientsResult.items.map(ing => {
                  const s = this.serializeIngredient(ing);
                  return {
                    IngredientId: `${meal.RecipeId}-${ing.idx || 0}`,
                    IngredientName: s.IngredientNorm || s.IngredientRaw || 'Unknown',
                    QtyText: s.QtyText || '',
                    QtyNum: s.QtyNum,
                    Unit: s.Unit || '',
                    Category: s.Category || 'Other'
                  };
                })
                : [];

              embeddedRecipe = {
                ...serializedRecipe,
                ingredients: serializedIngredients
              };
            }

            meals.push({
              slot: slot.toLowerCase(),
              recipeId: meal.RecipeId,
              title: meal.Title,
              imageName: meal.Image_Name || '',
              recipe: embeddedRecipe, // Embedded data
              assignedUsers: assignedUsers,
              additionalItems: additionalItems
            });
          }
        }
      }

      // ========== PHASE 9.6: DIFFERENTIAL SYNC - Only send if changed ==========
      const mealPlanHash = this.hashObject_(meals);
      const state = this.clientState.get(deviceId);

      if (state && state.lastMealPlanHash === mealPlanHash) {
        console.log(`[Phase 9.6] Meal plan unchanged for ${deviceId}, skipping send`);
        return;
      }

      // Update state
      if (state) {
        state.lastMealPlanHash = mealPlanHash;
        state.lastSyncTime = Date.now();
      }

      // ========== PHASE 9.6: Use message batching ==========
      this.batchMessage_(deviceId, {
        type: 'meal_plan',
        date: date,
        data: meals,
        timestamp: new Date().toISOString()
      });

      console.log(`[Phase 9.6] Queued meal plan update for ${deviceId} (${meals.length} meals)`);
    } catch (error) {
      console.error('Error sending meal plan:', error);
    }
  }

  async sendRecipe(deviceId, recipeId) {
    const client = this.clients.get(deviceId);
    if (!client) return;

    try {
      const recipeResult = await handleApiCall({
        fn: 'getRecipe',
        payload: { recipeId },
        store
      });

      const ingredientsResult = await handleApiCall({
        fn: 'listRecipeIngredients',
        payload: { recipeId },
        store
      });

      if (recipeResult && recipeResult.ok && ingredientsResult && ingredientsResult.ok) {
        // Fetch pantry for checkmarks (Phase 4: Pantry Intelligence)
        const pantryResult = await handleApiCall({
          fn: 'listPantry',
          payload: {},
          store
        });
        const pantryNames = new Set((pantryResult.items || []).map(p => p.IngredientName.toLowerCase()));

        const serializedRecipe = this.serializeRecipe(recipeResult.recipe);
        const serializedIngredients = (ingredientsResult.items || []).map(ing => {
          const s = this.serializeIngredient(ing);
          const name = s.IngredientNorm || s.IngredientRaw || 'Unknown';
          return {
            IngredientId: `${recipeId}-${ing.idx || 0}`,
            IngredientName: name,
            QtyText: s.QtyText || '',
            QtyNum: s.QtyNum,
            Unit: s.Unit || '',
            Category: s.Category || 'Other',
            hasInPantry: pantryNames.has(name.toLowerCase())
          };
        });

        client.ws.send(JSON.stringify({
          type: 'recipe',
          data: {
            ...serializedRecipe,
            ingredients: serializedIngredients
          },
          timestamp: new Date().toISOString()
        }));
        console.log(`📤 Sent recipe "${recipeResult.recipe.Title}" to ${client.deviceType}`);
      }
    } catch (error) {
      console.error('Error sending recipe:', error);
    }
  }

  async handleSyncChanges(deviceId, changes) {
    const client = this.clients.get(deviceId);
    if (!client || !Array.isArray(changes)) return;

    console.log(`📥 Syncing ${changes.length} changes from ${client.deviceType}`);

    let updatedCount = 0;
    let addedCount = 0;
    let deletedCount = 0;

    for (const change of changes) {
      try {
        const { id, isPurchased, isManuallyAdded, isDeleted, name, quantity, category } = change;

        if (isDeleted) {
          const result = await handleApiCall({
            fn: 'deleteShoppingItem',
            payload: { itemId: id },
            store
          });
          if (result && result.ok) deletedCount++;
          continue;
        }

        if (isManuallyAdded) {
          // Try to add new item
          const result = await handleApiCall({
            fn: 'addShoppingItem',
            payload: {
              itemId: id,
              ingredientName: name,
              qtyText: quantity || '',
              category: category || 'Other',
              isPurchased: isPurchased ? 1 : 0
            },
            store
          });
          if (result && result.ok) {
            addedCount++;
          } else {
            // Item might exist, try update
            const updateResult = await handleApiCall({
              fn: 'updateShoppingItem',
              payload: {
                itemId: id,
                isPurchased: isPurchased ? 1 : 0
              },
              store
            });
            if (updateResult && updateResult.ok) updatedCount++;
          }
        } else {
          // Update existing item
          const result = await handleApiCall({
            fn: 'updateShoppingItem',
            payload: {
              itemId: id,
              isPurchased: isPurchased ? 1 : 0
            },
            store
          });
          if (result && result.ok) updatedCount++;
        }
      } catch (error) {
        console.error(`Error syncing change:`, error);
      }
    }

    console.log(`✅ Sync complete: ${updatedCount} updated, ${addedCount} added, ${deletedCount} deleted`);

    // Send confirmation
    client.ws.send(JSON.stringify({
      type: 'sync_confirmed',
      data: {
        updated: updatedCount,
        added: addedCount,
        deleted: deletedCount
      },
      timestamp: new Date().toISOString()
    }));

    // Notify desktop UI
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send('shopping-list:updated', {
        updated: updatedCount,
        added: addedCount,
        deleted: deletedCount
      });
    }
  }



  async handleItemRemoved(deviceId, message) {
    const client = this.clients.get(deviceId);
    if (!client) return;

    try {
      const { itemId } = message;

      console.log(`📥 Item removed from ${client.deviceType}: ${itemId}`);

      // FIXED: Simply delete from shopping list - don't touch pantry
      const result = await handleApiCall({
        fn: 'deleteShoppingItem',
        payload: { itemId: itemId },
        store
      });

      if (result && result.ok) {
        console.log(`✅ Removed from shopping list: ${itemId}`);

        // Send confirmation to iPhone
        client.ws.send(JSON.stringify({
          type: 'item_removed_confirmed',
          itemId: itemId,
          timestamp: new Date().toISOString()
        }));

        // Notify desktop UI
        if (this.mainWindow && !this.mainWindow.isDestroyed()) {
          this.mainWindow.webContents.send('shopping-list:updated', {
            action: 'removed',
            itemId: itemId
          });
        }
      }
    } catch (error) {
      console.error(`Error handling item removal from ${deviceId}:`, error);
    }
  }

  async handleItemUnpurchased(deviceId, message) {
    const client = this.clients.get(deviceId);
    if (!client) return;

    try {
      const { ingredient, qty, unit, itemId } = message;

      console.log(`📥 Item unmarked as purchased: ${ingredient} (${qty} ${unit})`);

      // Subtract quantity from pantry (reverse of purchase)
      const ingredientNorm = (ingredient || '').toLowerCase().trim();
      const qtyNum = parseFloat(qty) || 0;

      if (qtyNum > 0) {
        const result = await handleApiCall({
          fn: 'subtractFromPantry',
          payload: {
            ingredientNorm: ingredientNorm,
            qty: qtyNum,
            unit: unit || ''
          },
          store
        });

        if (result && result.ok) {
          console.log(`✅ Subtracted from pantry: ${ingredient} (${result.deducted} ${result.unit})`);
        } else {
          console.log(`⚠️ Could not subtract from pantry: ${result?.reason || 'unknown'}`);
        }
      }

      // Send confirmation to iPhone
      client.ws.send(JSON.stringify({
        type: 'item_unpurchased_confirmed',
        itemId: itemId,
        timestamp: new Date().toISOString()
      }));

      // Notify desktop UI
      if (this.mainWindow && !this.mainWindow.isDestroyed()) {
        this.mainWindow.webContents.send('pantry-updated', {
          action: 'unpurchased',
          ingredient: ingredient
        });
      }
    } catch (error) {
      console.error(`Error handling item unpurchase:`, error);
    }
  }

  async handleItemPurchased(deviceId, message) {
    const client = this.clients.get(deviceId);
    if (!client) return;

    try {
      const { ingredient, qty, unit, itemId } = message;

      console.log(`📥 Item purchased from ${client.deviceType}: ${ingredient} (${qty} ${unit})`);

      // Add purchased item to pantry
      const result = await handleApiCall({
        fn: 'markShoppingItemPurchased',
        payload: {
          ingredientNorm: ingredient,
          qty: parseFloat(qty) || 0,
          unit: unit || ''
        },
        store
      });

      if (result && result.ok) {
        console.log(`✅ Added to pantry: ${ingredient} (${qty} ${unit})`);

        // Send confirmation to iPhone
        client.ws.send(JSON.stringify({
          type: 'item_purchased_confirmed',
          itemId: itemId,
          timestamp: new Date().toISOString()
        }));

        // Notify desktop UI
        if (this.mainWindow && !this.mainWindow.isDestroyed()) {
          this.mainWindow.webContents.send('pantry-updated', {
            action: 'purchased',
            ingredient: ingredient,
            qty: qty,
            unit: unit
          });
        }
      } else {
        console.error(`❌ Failed to add to pantry: ${result?.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error(`Error handling item purchase from ${deviceId}:`, error);
    }
  }

  async handleAddPantryItem(deviceId, message) {
    const client = this.clients.get(deviceId);
    if (!client) return;

    try {
      // Note: rename 'store' to 'storeName' to avoid shadowing the module-level 'store' (electron-store)
      const { name, qtyText, qtyNum, unit, category, store: storeName, barcode, notes } = message.data;

      console.log(`📷 Barcode scanned from ${client.deviceType}: ${name} (${barcode})`);

      // Add to pantry using existing API
      const result = await handleApiCall({
        fn: 'upsertPantryItem',
        payload: {
          name: name,
          qtyText: qtyText,
          qtyNum: qtyNum,
          unit: unit,
          category: category,
          notes: notes || `Scanned barcode: ${barcode}`,
          storeId: storeName || null
        },
        store
      });

      if (result && result.ok) {
        console.log(`✅ Added to pantry: ${name}`);

        // Send confirmation to iPhone
        client.ws.send(JSON.stringify({
          type: 'pantry_add_confirmed',
          data: { name, qtyText },
          timestamp: new Date().toISOString()
        }));

        // Notify desktop UI of pantry update
        if (this.mainWindow && !this.mainWindow.isDestroyed()) {
          this.mainWindow.webContents.send('pantry-updated', {
            action: 'added',
            item: name,
            barcode: barcode
          });
        }
      } else {
        console.error(`❌ Failed to add to pantry: ${result?.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error(`Error handling barcode scan from ${deviceId}:`, error);
    }
  }

  pushToDeviceType(deviceType, data) {
    const targetType = deviceType.toLowerCase();
    let sentCount = 0;

    this.log('info', `🔍 pushToDeviceType('${deviceType}') called - checking ${this.clients.size} connected client(s)`);

    for (const [deviceId, client] of this.clients.entries()) {
      this.log('info', `   Device ${deviceId}: type=${client.deviceType}, authenticated=${client.authenticated}, wsState=${client.ws.readyState}`);

      if (client.deviceType.toLowerCase() === targetType) {
        // Only send to authenticated (paired) devices
        if (!client.authenticated) {
          this.log('warn', `⚠️  Skipping ${deviceId} - device not authenticated (not paired)`);
          continue;
        }

        if (client.ws.readyState === WebSocket.OPEN) {
          try {
            const payload = JSON.stringify(data);
            const preview = payload.length > 200 ? payload.substring(0, 200) + '...' : payload;
            this.log('info', `📤 Sending to ${deviceId}: ${preview}`);

            client.ws.send(payload);
            sentCount++;
            this.log('success', `✅ Sent to ${deviceType} device: ${deviceId}`);
          } catch (error) {
            this.log('error', `❌ Failed to send to ${deviceId}:`, error.message);
          }
        } else {
          this.log('warn', `⚠️  Skipping ${deviceId} - WebSocket not OPEN (state: ${client.ws.readyState})`);
        }
      }
    }

    this.log('info', `📊 pushToDeviceType('${deviceType}'): Sent to ${sentCount} device(s)`);
    return sentCount;
  }

  async pushShoppingListToPhones() {
    console.log('🔍 pushShoppingListToPhones: Starting...');
    try {
      // Generate shopping list from today's meal plan
      const today = new Date().toISOString().split('T')[0];
      console.log(`🔍 pushShoppingListToPhones: Today is ${today}`);

      // Get today's meal plan
      const planResult = await handleApiCall({
        fn: 'getPlansRange',
        payload: { start: today, end: today },
        store
      });

      if (!planResult || !planResult.ok || !Array.isArray(planResult.plans) || planResult.plans.length === 0) {
        // No meal plan for today - DON'T send empty list (would clear iPhone's data)
        console.log(`📤 No meal plan for today - not sending to iPhones (preserves existing data)`);
        return 0;
      }

      const plan = planResult.plans[0];
      const recipeIds = [];

      // Collect all recipe IDs from today's meals
      if (plan.Breakfast?.RecipeId) recipeIds.push(plan.Breakfast.RecipeId);
      if (plan.Lunch?.RecipeId) recipeIds.push(plan.Lunch.RecipeId);
      if (plan.Dinner?.RecipeId) recipeIds.push(plan.Dinner.RecipeId);

      if (recipeIds.length === 0) {
        // Meal plan exists but no recipes - DON'T send empty list
        console.log(`📤 No recipes in today's plan - not sending to iPhones (preserves existing data)`);
        return 0;
      }

      // Get all ingredients for all recipes
      const allIngredients = [];
      for (const recipeId of recipeIds) {
        const ingredientsResult = await handleApiCall({
          fn: 'listRecipeIngredients',
          payload: { recipeId },
          store
        });

        if (ingredientsResult && ingredientsResult.ok && Array.isArray(ingredientsResult.items)) {
          // Serialize each ingredient to ensure clean data
          const serializedIngredients = ingredientsResult.items.map(ing => {
            const serialized = this.serializeIngredient(ing);
            return {
              ItemId: `${recipeId}-${ing.idx || 0}`,  // iOS expects "ItemId"
              IngredientName: serialized.IngredientNorm || serialized.IngredientRaw || 'Unknown',  // iOS expects "IngredientName"
              QtyText: serialized.QtyText || (serialized.QtyNum ? String(serialized.QtyNum) : ''),  // iOS expects "QtyText"
              Unit: serialized.Unit || '',
              Category: serialized.Category || '',
              StoreName: serialized.StoreId || 'kroger',  // iOS expects "StoreName"
              RecipeId: recipeId,
              is_purchased: 0  // iOS expects "is_purchased" as int
            };
          });
          allIngredients.push(...serializedIngredients);
        }
      }

      // Generate version identifier
      const version = `${Date.now()}-${allIngredients.length}`;

      const sentCount = this.pushToDeviceType('iphone', {
        type: 'shopping_list_update',
        data: allIngredients,
        version: version,
        forceReplace: true, // This is a fresh generation, so replace
        timestamp: new Date().toISOString()
      });

      console.log(`📤 Pushed shopping list (${allIngredients.length} items from ${recipeIds.length} recipes, version: ${version}) to all iPhones`);

      return sentCount;
    } catch (error) {
      console.error('Error pushing shopping list:', error);
      throw error;
    }
  }

  /**
   * Push pre-formatted shopping list items to all connected iPhones
   * This is used when the renderer has already generated a shopping list
   * @param {Array} items - Shopping list items
   * @param {Object} options - Optional settings
   * @param {boolean} options.forceReplace - If true, tells iPhone to replace entire list
   */
  async pushShoppingListItems(items, options = {}) {
    console.log('🔍 pushShoppingListItems: Starting with', items.length, 'items');
    try {
      // Generate a version identifier based on current timestamp and item count
      // This allows iPhone to track which version of the list it has
      const version = `${Date.now()}-${items.length}`;

      // Format items for iOS app
      const formattedItems = items.map((item, idx) => ({
        ItemId: item.id || `item-${idx}`,
        IngredientName: item.IngredientNorm || item.name || 'Unknown',
        QtyText: item.QtyText || item.quantity || '',
        Unit: item.Unit || item.unit || '',
        Category: item.Category || item.category || '',
        StoreName: item.StoreName || item.store || '',
        is_purchased: item.isPurchased ? 1 : 0
      }));

      const sentCount = this.pushToDeviceType('iphone', {
        type: 'shopping_list_update',
        data: formattedItems,
        version: version,
        forceReplace: options.forceReplace || false,
        timestamp: new Date().toISOString()
      });

      console.log(`📤 Pushed ${formattedItems.length} shopping items to ${sentCount} iPhone(s) (version: ${version})`);
      return sentCount;
    } catch (error) {
      console.error('Error pushing shopping list items:', error);
      throw error;
    }
  }

  async pushTodaysMealsToTablets() {
    try {
      const today = new Date().toISOString().split('T')[0];

      // Get active user (needed for user-specific meal plans)
      const activeUserRes = await handleApiCall({ fn: 'getActiveUser', payload: {}, store });
      const userId = (activeUserRes.ok && activeUserRes.userId) ? activeUserRes.userId : null;

      // Get today's meal plan
      const planResult = await handleApiCall({
        fn: 'getUserPlanMeals',
        payload: { start: today, end: today, userId },
        store
      });

      if (!planResult || !planResult.ok || !Array.isArray(planResult.plans) || planResult.plans.length === 0) {
        return this.pushToDeviceType('ipad', {
          type: 'meal_plan',
          data: [],
          timestamp: new Date().toISOString()
        });
      }

      const plan = planResult.plans[0];
      const meals = [];

      // Process each meal slot
      for (const slot of ['Breakfast', 'Lunch', 'Dinner']) {
        const mealArray = plan[slot];
        // getUserPlanMeals returns arrays for each slot (to support multiple meals)
        if (!Array.isArray(mealArray) || mealArray.length === 0) continue;

        const meal = mealArray[0];
        if (!meal || !meal.RecipeId) continue;

        const recipeId = meal.RecipeId;

        // Get recipe details
        const recipeResult = await handleApiCall({
          fn: 'getRecipe',
          payload: { recipeId },
          store
        });

        // Get ingredients
        const ingredientsResult = await handleApiCall({
          fn: 'listRecipeIngredients',
          payload: { recipeId },
          store
        });

        // PHASE 4.5.7: Get meal assignments
        const assignmentsResult = await handleApiCall({
          fn: 'getMealAssignments',
          payload: { date: today, slot },
          store
        });

        const assignedUsers = (assignmentsResult && assignmentsResult.ok && assignmentsResult.assignments)
          ? assignmentsResult.assignments.map(a => ({
            userId: a.userId,
            name: a.name,
            avatarEmoji: a.avatarEmoji || '👤',
            email: a.email || null
          }))
          : [];

        // PHASE 4.5.7: Get additional items
        const additionalResult = await handleApiCall({
          fn: 'getAdditionalItems',
          payload: { date: today, slot },
          store
        });

        const additionalItems = (additionalResult && additionalResult.ok && additionalResult.items)
          ? additionalResult.items.map(item => ({
            recipeId: item.RecipeId,
            title: item.Title,
            itemType: item.ItemType || 'side'
          }))
          : [];

        // Format recipe for iOS with ingredients embedded
        if (recipeResult && recipeResult.ok) {
          const serializedRecipe = this.serializeRecipe(recipeResult.recipe);
          const serializedIngredients = ingredientsResult && ingredientsResult.ok
            ? (ingredientsResult.items || []).map(ing => {
              const s = this.serializeIngredient(ing);
              return {
                IngredientId: `${recipeId}-${ing.idx || 0}`,
                IngredientName: s.IngredientNorm || s.IngredientRaw || 'Unknown',
                QtyText: s.QtyText || '',
                QtyNum: s.QtyNum,
                Unit: s.Unit || '',
                Category: s.Category || 'Other'
              };
            })
            : [];

          meals.push({
            slot: slot.toLowerCase(),
            recipeId: recipeId,
            title: serializedRecipe.Title,
            imageName: serializedRecipe.Image_Name || '',
            recipe: {
              ...serializedRecipe,
              ingredients: serializedIngredients
            },
            assignedUsers: assignedUsers,
            additionalItems: additionalItems
          });
        }
      }

      return this.pushToDeviceType('ipad', {
        type: 'meal_plan',
        data: meals,
        date: today,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Error pushing meals:', error);
      throw error;
    }
  }

  // ADDED: Send Single Recipe to Tablets (Instant Open)
  async pushRecipeToTablets(recipeId) {
    console.log('📱 Pushing recipe', recipeId, 'to tablets...');
    try {
      // 1. Get Recipe & Ingredients
      const recipeResult = await handleApiCall({
        fn: 'getRecipe',
        payload: { recipeId },
        store: this.store
      });

      const ingredientsResult = await handleApiCall({
        fn: 'listRecipeIngredients',
        payload: { recipeId },
        store: this.store
      });

      if (!recipeResult || !recipeResult.ok) {
        throw new Error('Recipe not found');
      }

      // 2. Serialize
      const serializedRecipe = this.serializeRecipe(recipeResult.recipe);

      // Embed ingredients
      const serializedIngredients = (ingredientsResult && ingredientsResult.ok && ingredientsResult.items)
        ? ingredientsResult.items.map(ing => {
          const s = this.serializeIngredient(ing);
          return {
            IngredientId: `${recipeId}-${ing.idx || 0}`,
            IngredientName: s.IngredientNorm || s.IngredientRaw || 'Unknown',
            QtyText: s.QtyText || '',
            QtyNum: s.QtyNum,
            Unit: s.Unit || '',
            Category: s.Category || 'Other'
          };
        })
        : [];

      const recipeData = {
        ...serializedRecipe,
        ingredients: serializedIngredients
      };

      // 3. Send to iPads
      // Use 'load_recipe' type for Instant Open behavior
      return this.pushToDeviceType('ipad', {
        type: 'recipe', // iOS ConnectionManager expects 'recipe' or 'load_recipe'
        data: recipeData, // Wrap in data for consistency with other messages
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('Error pushing recipe:', error);
      throw error;
    }
  }

  // ADDED: Sous Chef Query Handler
  async handleSousChefQuery(deviceId, message) {
    const client = this.clients.get(deviceId);
    if (!client) return;

    const query = message.query;
    console.log(`🤖 Sous Chef Query from ${client.name}: "${query}"`);

    // Acknowledge receipt
    client.ws.send(JSON.stringify({
      type: 'sous_chef_status',
      status: 'thinking'
    }));

    try {
      // TODO: Connect to local Ollama here
      // For now, simulate a response or basic logic

      // Simulate network delay
      await new Promise(r => setTimeout(r, 1000));

      let responseText = "I'm still learning to cook! Please check the recipe details on your screen.";

      // Simple offline keywords
      if (query.toLowerCase().includes('substitute') && query.toLowerCase().includes('milk')) {
        responseText = "You can usually substitute almond milk, soy milk, or oat milk in equal parts for regular milk. For baking, buttermilk (milk + vinegar) works great too!";
      } else if (query.toLowerCase().includes('timer')) {
        responseText = "I can set a timer for you. Just say 'Set timer for 10 minutes'.";
      }

      client.ws.send(JSON.stringify({
        type: 'sous_chef_response',
        query: query,
        response: responseText
      }));

    } catch (error) {
      console.error('Sous chef error:', error);
      client.ws.send(JSON.stringify({
        type: 'sous_chef_error',
        message: 'Sorry, I had trouble thinking of an answer.'
      }));
    }
  }

  async pushRecipeToTablet(recipeId) {
    try {
      const recipeResult = await handleApiCall({
        fn: 'getRecipe',
        payload: { recipeId },
        store
      });

      const ingredientsResult = await handleApiCall({
        fn: 'listRecipeIngredients',
        payload: { recipeId },
        store
      });

      if (recipeResult && recipeResult.ok && ingredientsResult && ingredientsResult.ok) {
        const serializedRecipe = this.serializeRecipe(recipeResult.recipe);
        const serializedIngredients = (ingredientsResult.items || []).map(ing => {
          const s = this.serializeIngredient(ing);
          return {
            IngredientId: `${recipeId}-${ing.idx || 0}`,
            IngredientName: s.IngredientNorm || s.IngredientRaw || 'Unknown',
            QtyText: s.QtyText || '',
            QtyNum: s.QtyNum,
            Unit: s.Unit || '',
            Category: s.Category || 'Other'
          };
        });

        this.pushToDeviceType('ipad', {
          type: 'recipe',
          data: {
            ...serializedRecipe,
            ingredients: serializedIngredients
          },
          timestamp: new Date().toISOString()
        });
        console.log(`📤 Pushed recipe to all iPads`);
        return true;
      }
    } catch (error) {
      console.error('Error pushing recipe:', error);
      return false;
    }
  }

  logLocalIPs() {
    const interfaces = os.networkInterfaces();
    console.log('\n📱 Connect iOS devices to:');

    for (const name of Object.keys(interfaces)) {
      for (const iface of interfaces[name]) {
        if (iface.family === 'IPv4' && !iface.internal) {
          console.log(`   ws://${iface.address}:8080`);
        }
      }
    }
    console.log('');
  }

  getConnectedDevices() {
    return Array.from(this.clients.entries()).map(([id, client]) => ({
      id,
      type: client.deviceType,
      name: client.deviceName || client.deviceType,
      ip: client.ip,
      authenticated: client.authenticated || false
    }));
  }

  notifyDevicesChanged() {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      const devices = this.getConnectedDevices();
      this.mainWindow.webContents.send('companion:devices-changed', devices);
    }
  }

  setMainWindow(win) {
    this.mainWindow = win;
  }

  stop() {
    if (this.wss) {
      this.wss.close();
      console.log('📱 Companion server stopped');
    }
  }
}

// Global companion server instance
let companionServer = null;

function getIndexPath() {
  // Support either src/renderer/index.html (common) or src/index.html
  const candidates = [
    path.join(__dirname, '..', 'renderer', 'index.html'),
    path.join(__dirname, '..', 'index.html'),
    path.join(__dirname, 'index.html'),
  ];
  for (const p of candidates) {
    try {
      // eslint-disable-next-line no-sync
      require('fs').accessSync(p);
      return p;
    } catch (_) { }
  }
  // Fall back to renderer path
  return candidates[0];
}

function buildMenu(win) {
  const template = [
    ...(process.platform === 'darwin'
      ? [{
        label: app.name,
        submenu: [
          { role: 'about' },
          { type: 'separator' },
          { role: 'services' },
          { type: 'separator' },
          { role: 'hide' },
          { role: 'hideOthers' },
          { role: 'unhide' },
          { type: 'separator' },
          { role: 'quit' },
        ],
      }]
      : []),
    {
      label: 'File',
      submenu: [
        {
          label: 'Select Database Folder…',
          accelerator: 'CmdOrCtrl+O',
          click: async () => {
            const res = await dialog.showOpenDialog(win, {
              title: 'Select Foodie data folder',
              properties: ['openDirectory', 'createDirectory'],
            });
            if (res.canceled || !res.filePaths || !res.filePaths[0]) return;
            const folder = res.filePaths[0];
            const filePath = path.join(folder, 'foodie.sqlite');
            setDbPath(filePath);
            if (store) store.set('dbPath', filePath);
            win.webContents.send('foodie-db-path-changed', { dbPath: filePath });
          },
        },
        { type: 'separator' },
        { role: 'close' },
      ],
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'pasteAndMatchStyle' },
        { role: 'delete' },
        { role: 'selectAll' },
      ],
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'togglefullscreen' },
        { type: 'separator' },
        {
          label: 'Toggle Developer Tools',
          accelerator: 'Alt+Command+I',
          click: () => {
            if (!win) return;
            win.webContents.toggleDevTools();
          },
        },
      ],
    },
    { role: 'windowMenu' },
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

async function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 820,
    show: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      webSecurity: true, // Enabled for security since we use foodie-image protocol
    },
  });

  buildMenu(win);

  // Always provide shortcuts (menu sometimes fails to appear in custom builds)
  try {
    globalShortcut.register('CommandOrControl+Shift+I', () => win.webContents.toggleDevTools());
    globalShortcut.register('F12', () => win.webContents.toggleDevTools());
  } catch (_) { }

  const indexPath = getIndexPath();
  await win.loadFile(indexPath);

  win.on('closed', () => {
    try { globalShortcut.unregisterAll(); } catch (_) { }
  });

  return win;
}

async function bootstrap() {
  await initStore();

  // Initialize DB location
  // Always use the default (userData) live DB; db.js will seed it from ./data/foodie.sqlite when needed.
  const dbPath = getDbPathDefault(app);
  try { store.set('dbPath', dbPath); } catch (_) { }
  setDbPath(dbPath);

  // Open DB and run migrations (db.js handles idempotence)
  createDb();

  // Register custom protocol to serve local images
  protocol.handle('foodie-image', (request) => {
    const url = request.url.replace('foodie-image://', '');
    const imagePath = path.join(app.getPath('userData'), 'images', url);

    console.log('[foodie-image] Request:', url);
    console.log('[foodie-image] Full path:', imagePath);
    console.log('[foodie-image] Exists:', fs.existsSync(imagePath));

    if (fs.existsSync(imagePath)) {
      return net.fetch('file://' + imagePath);
    } else {
      console.warn('[foodie-image] Image not found:', imagePath);
      return new Response('Not found', { status: 404 });
    }
  });

  // ========== PHASE 6.1: Run daily backup check ==========
  checkAndRunDailyBackup();

  // Set up periodic backup check (every 6 hours)
  setInterval(() => {
    checkAndRunDailyBackup();
  }, 6 * 60 * 60 * 1000); // 6 hours in milliseconds

  // Initialize companion server for iOS apps
  companionServer = new CompanionServer();
  companionServer.loadTrustedDevices(); // Load persisted trusted devices
  companionServer.start(8080);

  // IPC: API bridge
  ipcMain.handle('foodie-api', async (_evt, { fn, payload }) => {
    const result = await handleApiCall({ fn, payload, store });
    return result;
  });


  // IPC: Print recipe (native macOS dialog)
  ipcMain.handle('foodie-print-recipe', async (_evt, { recipeId }) => {
    try {
      const rid = String(recipeId || '').trim();
      if (!rid) return { ok: false, error: 'Missing recipeId' };

      const rRes = await handleApiCall({ fn: 'getRecipe', payload: { recipeId: rid }, store });
      if (!rRes || !rRes.ok) return { ok: false, error: rRes?.error || 'getRecipe failed' };
      const iRes = await handleApiCall({ fn: 'listRecipeIngredients', payload: { recipeId: rid }, store });
      const recipe = rRes.recipe || {};
      const ingredients = (iRes && iRes.ok && Array.isArray(iRes.items)) ? iRes.items : [];

      const esc = (s) => String(s ?? '')
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

      const html = `<!doctype html><html><head><meta charset="utf-8" />
        <title>${esc(recipe.Title || 'Recipe')}</title>
        <style>
          body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Arial;margin:24px;}
          h1{margin:0 0 8px 0;font-size:22px;}
          .meta{color:#555;margin-bottom:16px;}
          h2{margin:18px 0 8px;font-size:16px;}
          ul{padding-left:18px;}
          li{margin:4px 0;}
          pre{white-space:pre-wrap;}
          .muted{color:#666;}
        </style></head><body>
        <h1>${esc(recipe.Title || '')}</h1>
        <div class="meta">
          <span>${esc(recipe.MealType || 'Any')}</span>
          ${recipe.Cuisine ? ` • <span>${esc(recipe.Cuisine)}</span>` : ``}
          ${recipe.URL ? ` • <span class="muted">${esc(recipe.URL)}</span>` : ``}
        </div>
        <h2>Ingredients</h2>
        ${ingredients.length ? `<ul>${ingredients.map(it => {
        const qty = [it.QtyText || it.QtyNum || '', it.Unit || ''].filter(Boolean).join(' ').trim();
        const storeName = it.StoreName ? ` (${esc(it.StoreName)})` : '';
        const name = it.IngredientRaw || it.IngredientNorm || it.Name || '';
        return `<li>${esc((qty ? qty + ' ' : '') + name)}${storeName}</li>`;
      }).join('')}</ul>` : `<div class="muted">No ingredients.</div>`}
        <h2>Instructions</h2>
        ${recipe.Instructions ? `<pre>${esc(recipe.Instructions)}</pre>` : `<div class="muted">No instructions.</div>`}
        ${recipe.Notes ? `<h2>Notes</h2><pre>${esc(recipe.Notes)}</pre>` : ``}
        </body></html>`;

      const win = new BrowserWindow({ width: 900, height: 700, show: false, webPreferences: { sandbox: false } });
      await win.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html));

      return await new Promise((resolve) => {
        win.webContents.print({ silent: false, printBackground: true }, (success, failureReason) => {
          try { win.close(); } catch (_) { }
          if (!success) resolve({ ok: false, error: failureReason || 'Print failed' });
          else resolve({ ok: true });
        });
      });
    } catch (e) {
      return { ok: false, error: e && e.message ? e.message : String(e) };
    }
  });

  // IPC: Export / Import DB file for syncing across installations


  // IPC: Print shopping list (native macOS dialog)
  ipcMain.handle('foodie-print-shopping', async (_evt, { storeName, items }) => {
    try {
      const sn = String(storeName || '').trim() || 'Shopping List';
      const arr = Array.isArray(items) ? items : [];
      if (!arr.length) return { ok: false, error: 'No items to print.' };

      const esc = (s) => String(s ?? '')
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

      const rows = arr.map(it => {
        const name = esc(it.IngredientNorm || '');
        const qty = esc(it.QtyDisplay || it.QtyText || '');
        const unit = esc(it.Unit || '');
        const right = [qty, unit].filter(Boolean).join(' ').trim();
        return `<tr><td>${name}</td><td style="text-align:right; white-space:nowrap;">${right}</td></tr>`;
      }).join('');

      const html = `<!doctype html><html><head><meta charset="utf-8" />
        <title>${esc(sn)}</title>
        <style>
          body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Arial;margin:24px;}
          h1{margin:0 0 12px 0;font-size:20px;}
          table{width:100%;border-collapse:collapse;}
          th,td{padding:8px 6px;border-bottom:1px solid #ddd;vertical-align:top;}
          th{text-align:left;color:#444;font-weight:600;}
        </style></head><body>
        <h1>${esc(sn)}</h1>
        <table>
          <thead><tr><th>Item</th><th style="text-align:right;">Qty</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
        </body></html>`;

      const win = new BrowserWindow({ width: 900, height: 700, show: false, webPreferences: { sandbox: false } });
      await win.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html));

      return await new Promise((resolve) => {
        win.webContents.print({ silent: false, printBackground: true }, (success, failureReason) => {
          try { win.close(); } catch (_) { }
          if (!success) resolve({ ok: false, error: failureReason || 'Print failed' });
          else resolve({ ok: true });
        });
      });
    } catch (e) {
      return { ok: false, error: e && e.message ? e.message : String(e) };
    }
  });

  ipcMain.handle('foodie-print-pantry', async (_evt, { byCategory, title }) => {
    try {
      const printTitle = String(title || '').trim() || 'Pantry Inventory';
      const categories = byCategory || {};

      const esc = (s) => String(s ?? '')
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

      const categoryBlocks = Object.keys(categories).sort().map(cat => {
        const items = categories[cat] || [];
        const rows = items.map(it => `
          <tr>
            <td>${esc(it.Name)}</td>
            <td style="text-align:right;">${esc(it.Qty)}</td>
            <td>${esc(it.Store)}</td>
            <td style="font-size:0.85em;color:#666;">${esc(it.Notes)}</td>
          </tr>
        `).join('');

        return `
          <div style="margin-bottom:20px;">
            <h2 style="font-size:16px;margin:12px 0 8px 0;color:#333;border-bottom:2px solid #4da3ff;padding-bottom:4px;">${esc(cat)}</h2>
            <table>
              <thead>
                <tr>
                  <th>Item</th>
                  <th style="text-align:right;">Quantity</th>
                  <th>Store</th>
                  <th>Notes</th>
                </tr>
              </thead>
              <tbody>${rows}</tbody>
            </table>
          </div>
        `;
      }).join('');

      const html = `<!doctype html><html><head><meta charset="utf-8" />
        <title>${esc(printTitle)}</title>
        <style>
          body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Arial;margin:24px;}
          h1{margin:0 0 16px 0;font-size:22px;color:#111;}
          h2{font-size:16px;margin:12px 0 8px 0;color:#333;}
          table{width:100%;border-collapse:collapse;margin-bottom:12px;}
          th,td{padding:6px 8px;border-bottom:1px solid #e0e0e0;vertical-align:top;text-align:left;}
          th{color:#555;font-weight:600;background:#f5f5f5;}
          @media print { body { margin: 12px; } }
        </style></head><body>
        <h1>${esc(printTitle)}</h1>
        <div style="font-size:0.9em;color:#666;margin-bottom:16px;">Generated: ${new Date().toLocaleString()}</div>
        ${categoryBlocks}
        </body></html>`;

      const win = new BrowserWindow({ width: 900, height: 700, show: false, webPreferences: { sandbox: false } });
      await win.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html));

      return await new Promise((resolve) => {
        win.webContents.print({ silent: false, printBackground: true }, (success, failureReason) => {
          try { win.close(); } catch (_) { }
          if (!success) resolve({ ok: false, error: failureReason || 'Print failed' });
          else resolve({ ok: true });
        });
      });
    } catch (e) {
      return { ok: false, error: e && e.message ? e.message : String(e) };
    }
  });

  ipcMain.handle('foodie-export-data', async () => {
    try {
      const dbPathNow = String(store.get('dbPath') || '');
      const source = dbPathNow || getDbPathDefault(app);
      const res = await dialog.showSaveDialog({
        title: 'Export Foodie data',
        defaultPath: 'foodie.sqlite',
        filters: [{ name: 'SQLite Database', extensions: ['sqlite', 'db'] }, { name: 'All Files', extensions: ['*'] }],
      });
      if (res.canceled || !res.filePath) return { ok: false, error: 'Export canceled.' };
      require('fs').copyFileSync(source, res.filePath);
      return { ok: true };
    } catch (e) {
      return { ok: false, error: e && e.message ? e.message : String(e) };
    }
  });

  ipcMain.handle('foodie-import-data', async () => {
    try {
      const pick = await dialog.showOpenDialog({
        title: 'Import Foodie data',
        properties: ['openFile'],
        filters: [{ name: 'SQLite Database', extensions: ['sqlite', 'db'] }, { name: 'All Files', extensions: ['*'] }],
      });
      if (pick.canceled || !pick.filePaths || !pick.filePaths[0]) return { ok: false, error: 'Import canceled.' };
      const src = pick.filePaths[0];
      const dest = String(store.get('dbPath') || '') || getDbPathDefault(app);
      require('fs').copyFileSync(src, dest);
      setDbPath(dest);
      createDb();
      return { ok: true };
    } catch (e) {
      return { ok: false, error: e && e.message ? e.message : String(e) };
    }
  });


  // ========== PHASE 6.1: Automatic Backup System ==========

  // Get backup directory path
  function getBackupDir() {
    const homeDir = os.homedir();
    const backupDir = path.join(homeDir, 'Backups', 'Foodie');

    // Create directory if it doesn't exist
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }

    return backupDir;
  }

  // Create a backup
  async function createBackup(isAuto = false) {
    try {
      const dbPath = String(store.get('dbPath') || '') || getDbPathDefault(app);
      const backupDir = getBackupDir();

      // Generate backup filename with timestamp
      const timestamp = new Date().toISOString().replace(/:/g, '-').replace(/\..+/, '');
      const prefix = isAuto ? 'auto-backup' : 'manual-backup';
      const backupFileName = `${prefix}-${timestamp}.sqlite`;
      const backupPath = path.join(backupDir, backupFileName);

      // Copy database file
      fs.copyFileSync(dbPath, backupPath);

      // Update last backup time
      store.set('lastBackupTime', new Date().toISOString());

      return { ok: true, backupPath, fileName: backupFileName };
    } catch (e) {
      return { ok: false, error: e.message || String(e) };
    }
  }

  // List all backups
  function listBackups() {
    try {
      const backupDir = getBackupDir();
      const files = fs.readdirSync(backupDir)
        .filter(f => f.endsWith('.sqlite'))
        .map(f => {
          const filePath = path.join(backupDir, f);
          const stats = fs.statSync(filePath);
          return {
            fileName: f,
            filePath,
            size: stats.size,
            created: stats.birthtime.toISOString(),
            isAuto: f.startsWith('auto-backup')
          };
        })
        .sort((a, b) => new Date(b.created) - new Date(a.created));

      return { ok: true, backups: files };
    } catch (e) {
      return { ok: false, error: e.message || String(e), backups: [] };
    }
  }

  // Clean old backups (keep last 7)
  function cleanOldBackups() {
    try {
      const result = listBackups();
      if (!result.ok) return result;

      const autoBackups = result.backups.filter(b => b.isAuto);

      // Keep last 7 auto backups, delete older ones
      const toDelete = autoBackups.slice(7);
      let deletedCount = 0;

      for (const backup of toDelete) {
        try {
          fs.unlinkSync(backup.filePath);
          deletedCount++;
        } catch (e) {
          console.error(`Failed to delete backup ${backup.fileName}:`, e);
        }
      }

      return { ok: true, deletedCount };
    } catch (e) {
      return { ok: false, error: e.message || String(e) };
    }
  }

  // Restore from backup
  async function restoreFromBackup(backupPath) {
    try {
      const dbPath = String(store.get('dbPath') || '') || getDbPathDefault(app);

      // Verify backup file exists
      if (!fs.existsSync(backupPath)) {
        return { ok: false, error: 'Backup file not found' };
      }

      // Create a safety backup of current database before restoring
      const safetyBackupPath = path.join(getBackupDir(), `pre-restore-${Date.now()}.sqlite`);
      fs.copyFileSync(dbPath, safetyBackupPath);

      // Restore the backup
      fs.copyFileSync(backupPath, dbPath);

      // Reinitialize database
      setDbPath(dbPath);
      createDb();

      return { ok: true, safetyBackupPath };
    } catch (e) {
      return { ok: false, error: e.message || String(e) };
    }
  }

  // Check if daily backup is needed
  function shouldRunDailyBackup() {
    const lastBackup = store.get('lastBackupTime');
    if (!lastBackup) return true;

    const lastBackupDate = new Date(lastBackup);
    const now = new Date();

    // Check if last backup was more than 24 hours ago
    const hoursSinceLastBackup = (now - lastBackupDate) / (1000 * 60 * 60);
    return hoursSinceLastBackup >= 24;
  }

  // Run daily backup check
  async function checkAndRunDailyBackup() {
    if (shouldRunDailyBackup()) {
      console.log('🗄️ Running daily automatic backup...');
      const result = await createBackup(true);
      if (result.ok) {
        console.log(`✅ Daily backup created: ${result.fileName}`);
        cleanOldBackups();
      } else {
        console.error('❌ Daily backup failed:', result.error);
      }
    }
  }

  // IPC handlers for backup system
  ipcMain.handle('foodie-backup-create', async () => {
    const result = await createBackup(false);
    if (result.ok) {
      cleanOldBackups(); // Clean old backups after creating new one
    }
    return result;
  });

  ipcMain.handle('foodie-backup-list', async () => {
    return listBackups();
  });

  ipcMain.handle('foodie-backup-restore', async (_evt, { backupPath }) => {
    return await restoreFromBackup(backupPath);
  });

  ipcMain.handle('foodie-backup-delete', async (_evt, { backupPath }) => {
    try {
      if (!fs.existsSync(backupPath)) {
        return { ok: false, error: 'Backup file not found' };
      }
      fs.unlinkSync(backupPath);
      return { ok: true };
    } catch (e) {
      return { ok: false, error: e.message || String(e) };
    }
  });

  ipcMain.handle('foodie-backup-get-status', async () => {
    try {
      const lastBackupTime = store.get('lastBackupTime') || null;
      const backupDir = getBackupDir();
      const result = listBackups();

      return {
        ok: true,
        lastBackupTime,
        backupDir,
        backupCount: result.ok ? result.backups.length : 0,
        autoBackupEnabled: true // Always enabled in this implementation
      };
    } catch (e) {
      return { ok: false, error: e.message || String(e) };
    }
  });


  // ========== END PHASE 6.1 ==========

  // ========== SUPER WOW: AI Chef ==========
  ipcMain.handle('foodie-get-env-config', async () => {
    return {
      openaiApiKey: process.env.OPENAI_API_KEY || ''
    };
  });


  // ========== PHASE 6.2: Selective Export ==========

  // Export selected recipes to JSON
  ipcMain.handle('foodie-export-recipes', async (_evt, { recipeIds }) => {
    try {
      const { handleApiCall } = require('./api');
      const recipes = [];

      for (const recipeId of recipeIds) {
        // Get recipe details
        const recipeRes = await handleApiCall({ fn: 'getRecipe', payload: { recipeId }, store });
        if (!recipeRes.ok) continue;

        // Get recipe ingredients
        const ingredientsRes = await handleApiCall({ fn: 'listRecipeIngredients', payload: { recipeId }, store });

        recipes.push({
          recipe: recipeRes.recipe,
          ingredients: ingredientsRes.ok ? (ingredientsRes.items || []) : []
        });
      }

      // Save to file
      const res = await dialog.showSaveDialog({
        title: 'Export Recipes',
        defaultPath: `foodie-recipes-${new Date().toISOString().split('T')[0]}.json`,
        filters: [{ name: 'JSON Files', extensions: ['json'] }, { name: 'All Files', extensions: ['*'] }],
      });

      if (res.canceled || !res.filePath) return { ok: false, error: 'Export canceled' };

      const exportData = {
        exportDate: new Date().toISOString(),
        version: '1.0',
        type: 'recipes',
        count: recipes.length,
        data: recipes
      };

      fs.writeFileSync(res.filePath, JSON.stringify(exportData, null, 2), 'utf-8');

      return { ok: true, filePath: res.filePath, count: recipes.length };
    } catch (e) {
      return { ok: false, error: e.message || String(e) };
    }
  });

  // Export collection to JSON
  ipcMain.handle('foodie-export-collection', async (_evt, { collectionId }) => {
    try {
      const { handleApiCall } = require('./api');

      // Get collection details
      const collectionRes = await handleApiCall({ fn: 'getCollection', payload: { collectionId }, store });
      if (!collectionRes.ok) return { ok: false, error: 'Collection not found' };

      // Get collection recipes
      const recipesRes = await handleApiCall({ fn: 'listCollectionRecipes', payload: { collectionId }, store });
      if (!recipesRes.ok) return { ok: false, error: 'Failed to load collection recipes' };

      const recipes = [];
      for (const recipe of (recipesRes.recipes || [])) {
        const ingredientsRes = await handleApiCall({ fn: 'listRecipeIngredients', payload: { recipeId: recipe.RecipeId }, store });
        recipes.push({
          recipe,
          ingredients: ingredientsRes.ok ? (ingredientsRes.items || []) : []
        });
      }

      // Save to file
      const collectionName = (collectionRes.collection.Name || 'collection').replace(/[^a-z0-9]/gi, '-').toLowerCase();
      const res = await dialog.showSaveDialog({
        title: 'Export Collection',
        defaultPath: `foodie-collection-${collectionName}-${new Date().toISOString().split('T')[0]}.json`,
        filters: [{ name: 'JSON Files', extensions: ['json'] }, { name: 'All Files', extensions: ['*'] }],
      });

      if (res.canceled || !res.filePath) return { ok: false, error: 'Export canceled' };

      const exportData = {
        exportDate: new Date().toISOString(),
        version: '1.0',
        type: 'collection',
        collection: collectionRes.collection,
        recipeCount: recipes.length,
        data: recipes
      };

      fs.writeFileSync(res.filePath, JSON.stringify(exportData, null, 2), 'utf-8');

      return { ok: true, filePath: res.filePath, count: recipes.length };
    } catch (e) {
      return { ok: false, error: e.message || String(e) };
    }
  });

  // Export meal plan (date range) to JSON
  ipcMain.handle('foodie-export-meal-plan', async (_evt, { startDate, endDate }) => {
    try {
      const { handleApiCall } = require('./api');

      // Get plans for date range
      const plansRes = await handleApiCall({ fn: 'getPlansRange', payload: { start: startDate, end: endDate }, store });
      if (!plansRes.ok) return { ok: false, error: 'Failed to load meal plans' };

      const plans = plansRes.plans || [];
      const mealPlan = [];

      for (const plan of plans) {
        const dayMeals = {
          date: plan.Date,
          meals: []
        };

        for (const slot of ['Breakfast', 'Lunch', 'Dinner']) {
          const meal = plan[slot];
          if (meal && meal.RecipeId) {
            const ingredientsRes = await handleApiCall({ fn: 'listRecipeIngredients', payload: { recipeId: meal.RecipeId }, store });
            dayMeals.meals.push({
              slot,
              recipe: meal,
              ingredients: ingredientsRes.ok ? (ingredientsRes.items || []) : []
            });
          }
        }

        if (dayMeals.meals.length > 0) {
          mealPlan.push(dayMeals);
        }
      }

      // Save to file
      const res = await dialog.showSaveDialog({
        title: 'Export Meal Plan',
        defaultPath: `foodie-meal-plan-${startDate}-to-${endDate}.json`,
        filters: [{ name: 'JSON Files', extensions: ['json'] }, { name: 'All Files', extensions: ['*'] }],
      });

      if (res.canceled || !res.filePath) return { ok: false, error: 'Export canceled' };

      const exportData = {
        exportDate: new Date().toISOString(),
        version: '1.0',
        type: 'meal_plan',
        dateRange: { start: startDate, end: endDate },
        dayCount: mealPlan.length,
        data: mealPlan
      };

      fs.writeFileSync(res.filePath, JSON.stringify(exportData, null, 2), 'utf-8');

      return { ok: true, filePath: res.filePath, dayCount: mealPlan.length };
    } catch (e) {
      return { ok: false, error: e.message || String(e) };
    }
  });

  // ========== END PHASE 6.2 ==========

  // IPC: settings
  ipcMain.handle('foodie-get-settings', async () => {
    return {
      ok: true,
      dbPath: store.get('dbPath') || '',
      calendarName: store.get('calendarName') || 'Foodie Meal Planner',
      googleCalendarId: store.get('googleCalendarId') || 'primary',
    };
  });

  ipcMain.handle('foodie-set-db-path', async () => {
    // same as menu action
    return { ok: true, dbPath: store.get('dbPath') || '' };
  });

  ipcMain.handle('foodie-set-calendar-name', async (_evt, { calendarName }) => {
    const v = String(calendarName || '').trim() || 'Foodie Meal Planner';
    store.set('calendarName', v);
    return { ok: true, calendarName: v };
  });

  ipcMain.handle('foodie-set-google-calendar-id', async (_evt, { calendarId }) => {
    const v = String(calendarId || '').trim() || 'primary';
    store.set('googleCalendarId', v);
    return { ok: true, calendarId: v };
  });

  // IPC: Companion server actions
  ipcMain.handle('companion:send-shopping-list', async (_evt, payload) => {
    console.log('📱 IPC: companion:send-shopping-list called');
    if (!companionServer) {
      console.error('❌ Companion server not initialized');
      return { ok: false, error: 'Companion server not initialized' };
    }
    try {
      // If items are passed from renderer, use those directly
      const items = payload && payload.items;
      if (items && Array.isArray(items) && items.length > 0) {
        console.log(`📱 Sending ${items.length} items from renderer shopping list`);
        const count = await companionServer.pushShoppingListItems(items);
        console.log(`📱 pushShoppingListItems() returned count: ${count}`);
        return { ok: true, count };
      }

      // Fallback to generating from today's meals
      console.log('📱 No items passed, calling pushShoppingListToPhones()...');
      const count = await companionServer.pushShoppingListToPhones();
      console.log(`📱 pushShoppingListToPhones() returned count: ${count}`);
      return { ok: true, count };
    } catch (e) {
      console.error('❌ Error in pushShoppingListToPhones:', e);
      return { ok: false, error: e && e.message ? e.message : String(e) };
    }
  });

  ipcMain.handle('companion:send-todays-meals', async () => {
    console.log('📱 IPC: companion:send-todays-meals called');
    if (!companionServer) {
      console.error('❌ Companion server not initialized');
      return { ok: false, error: 'Companion server not initialized' };
    }
    try {
      console.log('📱 Calling pushTodaysMealsToTablets()...');
      const count = await companionServer.pushTodaysMealsToTablets();
      console.log(`📱 pushTodaysMealsToTablets() returned count: ${count}`);
      return { ok: true, count };
    } catch (e) {
      console.error('❌ Error in pushTodaysMealsToTablets:', e);
      return { ok: false, error: e && e.message ? e.message : String(e) };
    }
  });

  ipcMain.handle('companion:send-recipe', async (_evt, { recipeId }) => {
    if (!companionServer) return { ok: false, error: 'Companion server not initialized' };
    try {
      const success = await companionServer.pushRecipeToTablet(recipeId);
      return { ok: true, success };
    } catch (e) {
      return { ok: false, error: e && e.message ? e.message : String(e) };
    }
  });

  ipcMain.handle('companion:get-devices', async () => {
    if (!companionServer) return { ok: false, error: 'Companion server not initialized', devices: [] };
    try {
      const devices = companionServer.getConnectedDevices();
      return { ok: true, devices };
    } catch (e) {
      return { ok: false, error: e && e.message ? e.message : String(e), devices: [] };
    }
  });

  ipcMain.handle('companion:get-server-ip', async () => {
    try {
      const interfaces = os.networkInterfaces();
      const ips = [];

      for (const name of Object.keys(interfaces)) {
        for (const iface of interfaces[name]) {
          if (iface.family === 'IPv4' && !iface.internal) {
            ips.push(iface.address);
          }
        }
      }

      return { ok: true, ip: ips[0] || null, allIps: ips };
    } catch (e) {
      return { ok: false, error: e && e.message ? e.message : String(e) };
    }
  });

  // ========== PAIRING & TRUSTED DEVICES IPC HANDLERS ==========
  ipcMain.handle('companion:get-pairing-code', async () => {
    if (!companionServer) return { ok: false, error: 'Companion server not initialized' };
    return { ok: true, code: companionServer.getPairingCode() };
  });

  ipcMain.handle('companion:regenerate-pairing-code', async () => {
    if (!companionServer) return { ok: false, error: 'Companion server not initialized' };
    const code = companionServer.regeneratePairingCode();
    return { ok: true, code };
  });

  ipcMain.handle('companion:get-trusted-devices', async () => {
    if (!companionServer) return { ok: false, error: 'Companion server not initialized', devices: [] };
    const devices = companionServer.getTrustedDevices();
    return { ok: true, devices };
  });

  ipcMain.handle('companion:untrust-device', async (_evt, { deviceId }) => {
    if (!companionServer) return { ok: false, error: 'Companion server not initialized' };
    const result = companionServer.untrustDevice(deviceId);
    return { ok: result };
  });

  const win = await createWindow();

  // Set main window reference for companion server notifications
  if (companionServer) {
    companionServer.setMainWindow(win);
  }
}

app.whenReady().then(() => {
  bootstrap().catch(err => {
    console.error('Bootstrap failed:', err);
    app.quit();
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('will-quit', () => {
  if (companionServer) {
    companionServer.stop();
  }
});
