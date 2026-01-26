# Desktop App Updates for iPhone Shopping List Sync

## New WebSocket Message Handlers

Add these handlers to the `CompanionServer.handleMessage()` method in `src/main/main.js`:

```javascript
handleMessage(deviceId, message) {
  const client = this.clients.get(deviceId);
  
  switch (message.type) {
    case 'ping':
      client.ws.send(JSON.stringify({ type: 'pong', timestamp: Date.now() }));
      break;
    
    case 'request_shopping_list':
      this.sendShoppingList(deviceId);
      break;
    
    case 'sync_changes':
      // NEW: Handle batch sync from iPhone
      this.handleSyncChanges(deviceId, message.data);
      break;
      
    // ... other existing cases
  }
}

// NEW METHOD: Handle sync changes from iPhone
handleSyncChanges(deviceId, changes) {
  const client = this.clients.get(deviceId);
  if (!client || !Array.isArray(changes)) return;

  console.log(`📥 Syncing ${changes.length} changes from ${client.deviceType}`);

  const now = new Date().toISOString();
  let updatedCount = 0;
  let addedCount = 0;
  let deletedCount = 0;

  for (const change of changes) {
    const { id, isPurchased, isManuallyAdded, isDeleted, name, quantity, category } = change;

    if (isDeleted) {
      // Item was deleted on iPhone
      const result = this.db.prepare(`
        DELETE FROM shopping_items WHERE ItemId = ?
      `).run(id);
      
      if (result.changes > 0) {
        deletedCount++;
      }
      continue;
    }

    if (isManuallyAdded) {
      // New item added while shopping
      try {
        this.db.prepare(`
          INSERT INTO shopping_items (ItemId, IngredientName, QtyText, Category, is_purchased, manually_added, created_at)
          VALUES (?, ?, ?, ?, ?, 1, ?)
        `).run(id, name, quantity || '', category || 'Other', isPurchased ? 1 : 0, now);
        addedCount++;
      } catch (error) {
        // Item might already exist, update instead
        this.db.prepare(`
          UPDATE shopping_items 
          SET is_purchased = ?, QtyText = ?, Category = ?, updated_at = ?
          WHERE ItemId = ?
        `).run(isPurchased ? 1 : 0, quantity || '', category || 'Other', now, id);
        updatedCount++;
      }
    } else {
      // Existing item status changed
      const result = this.db.prepare(`
        UPDATE shopping_items 
        SET is_purchased = ?, 
            purchased_at = CASE WHEN ? = 1 THEN ? ELSE purchased_at END,
            updated_at = ?
        WHERE ItemId = ?
      `).run(isPurchased ? 1 : 0, isPurchased ? 1 : 0, now, now, id);
      
      if (result.changes > 0) {
        updatedCount++;
      }
    }
  }

  console.log(`✅ Sync complete: ${updatedCount} updated, ${addedCount} added, ${deletedCount} deleted`);

  // Send confirmation back to iPhone
  client.ws.send(JSON.stringify({
    type: 'sync_confirmed',
    data: {
      updated: updatedCount,
      added: addedCount,
      deleted: deletedCount
    },
    timestamp: new Date().toISOString()
  }));

  // Notify desktop UI to refresh shopping list
  if (this.mainWindow) {
    this.mainWindow.webContents.send('shopping-list-updated', {
      updated: updatedCount,
      added: addedCount,
      deleted: deletedCount
    });
  }
}
```

## Database Schema Update

Add the `manually_added` column to track items added while shopping:

```javascript
// In initDb() method, add this migration:

// Add manually_added column if it doesn't exist
try {
  db.prepare(`
    ALTER TABLE shopping_items ADD COLUMN manually_added INTEGER DEFAULT 0
  `).run();
  console.log('✅ Added manually_added column to shopping_items');
} catch (error) {
  // Column already exists or other error - safe to ignore
}

// Add updated_at column if it doesn't exist
try {
  db.prepare(`
    ALTER TABLE shopping_items ADD COLUMN updated_at TEXT
  `).run();
  console.log('✅ Added updated_at column to shopping_items');
} catch (error) {
  // Column already exists or other error - safe to ignore
}
```

## Desktop UI Updates

### Show Sync Notification

Update the shopping list UI to show when items were synced from iPhone:

```javascript
// In renderer process (index.html or shopping list component)

window.api.onShoppingListUpdated((data) => {
  if (data && (data.added > 0 || data.updated > 0 || data.deleted > 0)) {
    showNotification(
      `Synced from iPhone: ${data.added} added, ${data.updated} updated, ${data.deleted} deleted`,
      'success'
    );
    refreshShoppingList();
  }
});

function showNotification(message, type) {
  const banner = document.createElement('div');
  banner.className = `notification ${type}`;
  banner.textContent = message;
  banner.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    padding: 12px 20px;
    background: ${type === 'success' ? '#4caf50' : '#2196f3'};
    color: white;
    border-radius: 8px;
    box-shadow: 0 2px 10px rgba(0,0,0,0.2);
    z-index: 10000;
    animation: slideIn 0.3s ease-out;
  `;
  
  document.body.appendChild(banner);
  
  setTimeout(() => {
    banner.style.animation = 'slideOut 0.3s ease-out';
    setTimeout(() => banner.remove(), 300);
  }, 3000);
}
```

### Highlight Manually Added Items

In the shopping list UI, show which items were added while shopping:

```javascript
function renderShoppingItem(item) {
  const row = document.createElement('div');
  row.className = 'shopping-item-row';
  
  let badge = '';
  if (item.manually_added === 1) {
    badge = '<span class="badge manually-added">Added while shopping</span>';
  }
  
  row.innerHTML = `
    <input type="checkbox" 
           ${item.is_purchased ? 'checked' : ''}
           onchange="togglePurchased('${item.ItemId}', this.checked)">
    <span class="${item.is_purchased ? 'purchased' : ''}">
      ${item.IngredientName}
      ${item.QtyText ? `<small>(${item.QtyText})</small>` : ''}
    </span>
    ${badge}
    <span class="category-badge">${item.Category}</span>
  `;
  
  return row;
}
```

CSS for the badge:

```css
.badge.manually-added {
  background: #2196f3;
  color: white;
  padding: 2px 8px;
  border-radius: 12px;
  font-size: 11px;
  margin-left: 8px;
}
```

## Testing the Sync

### Test Auto-Sync
1. Start desktop app
2. Send shopping list to iPhone
3. Go to grocery store (disconnect from WiFi)
4. Check off items and add new items on iPhone
5. Return home (reconnect to WiFi)
6. iPhone should auto-sync within 30 seconds
7. Desktop should show notification

### Test Manual Sync
1. With iPhone connected to desktop
2. Make changes on iPhone
3. Tap sync button (circular arrows icon)
4. "Syncing..." banner should appear
5. Then "Auto-sync successful" banner
6. Desktop receives updates immediately

### Test Conflict Resolution
1. Check off item A on desktop
2. Check off item B on iPhone (offline)
3. iPhone reconnects and syncs
4. Both items should be marked as purchased
5. No duplicates or lost data

## Message Flow Diagram

```
iPhone Shopping App ←→ Desktop App

1. Initial Connection:
   iPhone: { type: "ping" }
   Desktop: { type: "pong" }
   Desktop: { type: "connected" }

2. Request Shopping List:
   iPhone: { type: "request_shopping_list" }
   Desktop: { type: "shopping_list", data: [...] }

3. Desktop Sends Update:
   Desktop: { type: "shopping_list_update", data: [...] }
   iPhone: Updates local storage

4. iPhone Syncs Changes:
   iPhone: { 
     type: "sync_changes", 
     data: [
       { id: "123", isPurchased: true },
       { id: "456", isManuallyAdded: true, name: "Milk", ... }
     ]
   }
   Desktop: Updates database
   Desktop: { type: "sync_confirmed", data: { updated: 1, added: 1 } }
   iPhone: Clears pending changes
```

## Summary

✅ **Auto-sync on reconnect** - iPhone automatically syncs when returning home  
✅ **Manual sync button** - User can force sync anytime  
✅ **No duplicates** - Proper conflict resolution using item IDs  
✅ **Bidirectional** - Desktop → iPhone and iPhone → Desktop  
✅ **Batch updates** - Efficient sync of multiple changes  
✅ **Visual feedback** - Banners on both devices  
✅ **Manually added items** - Tracked with special badge  
✅ **Offline support** - All changes saved locally first  

The sync is robust and prevents duplicates by using unique ItemIds and batch updates with confirmation messages.
