# Companion App Files Ready to Copy

## 📱 Files Updated (January 20, 2026)

### FoodieShoppingList (iPhone) - 3 Files

1. **`Services/ConnectionManager.swift`**
   - **What changed:** Added `send(_ message: [String: Any])` method
   - **Why:** Enables ShoppingListStore to send WebSocket messages for pantry sync
   - **Lines:** 253-273

2. **`Services/ShoppingListStore.swift`**
   - **What changed:** Added pantry sync notification methods
   - **New methods:**
     - `notifyItemRemoved()` - lines 208-227
     - `notifyItemUnpurchased()` - lines 229-248
     - `parseQuantityAndUnit()` - lines 250-276
     - `parseFraction()` - lines 278-303
   - **Why:** Sends WebSocket messages when items removed/unchecked to restore pantry

3. **`FoodieShoppingListApp.swift`**
   - **What changed:** Injected `connectionManager` into `store`
   - **Line:** 24 - `shoppingListStore.connectionManager = connectionManager`
   - **Why:** Enables ShoppingListStore to access ConnectionManager for sending messages

---

## 🚀 How to Copy

### Option 1: Quick Copy with Backup (Recommended)
```bash
./quick-copy.sh
```
- Automatically backs up existing files
- Copies all 3 updated files
- Shows exactly what was done

### Option 2: Full Copy (All Apps)
```bash
./copy-all-companion-files.sh
```
- Copies both iPhone and iPad app files
- More comprehensive but may copy unnecessary files

### Option 3: Preview First
```bash
./verify-copy.sh
```
- Shows what will be copied without making changes
- Good for verification

---

## ✅ After Copying

### In Xcode:

1. **Open Project:**
   ```
   ~/Desktop/FoodieShoppingList/FoodieShoppingList.xcodeproj
   ```

2. **Clean Build Folder:**
   - Press `⌘ + Shift + K`
   - Or: Product → Clean Build Folder

3. **Build:**
   - Press `⌘ + B`
   - Watch for any compilation errors (there shouldn't be any)

4. **Run on iPhone:**
   - Connect your iPhone
   - Press `⌘ + R`

---

## 🧪 Testing the New Pantry Sync Feature

### Desktop Setup:
1. Make sure desktop app is running
2. Check that companion server is started (port 8080)
3. Open Developer Tools console to see sync logs

### iPhone Testing:

**Test 1: Remove Item from Shopping List**
1. Open shopping list on iPhone
2. Swipe left on any item
3. Tap "Delete"
4. ✅ **Expected:** Desktop console shows "Item removed" → "Returned to pantry"
5. ✅ **Expected:** Pantry quantity increases on desktop

**Test 2: Uncheck Purchased Item**
1. Check an item as purchased on iPhone
2. Then uncheck it (toggle off)
3. ✅ **Expected:** Desktop console shows "Item unpurchased" → "Returned to pantry"
4. ✅ **Expected:** Pantry quantity increases on desktop

**Console Messages to Watch For:**

Desktop (Node.js):
```
📥 Item removed from iphone: chicken breast (1.5 lb)
✅ Returned to pantry: chicken breast (1.5 lb)
```

iPhone (Xcode Debug Area):
```
📤 Sent item_removed: chicken breast (1.5 lb)
📊 Parsed '1.5 lb' → qty: 1.5, unit: 'lb'
```

---

## 🐛 Troubleshooting

### Build Errors in Xcode:
- **Clean build folder:** ⌘ + Shift + K
- **Restart Xcode:** Sometimes needed after file changes
- **Check Code Signing:** Ensure your development team is selected

### No Pantry Updates:
- **Check connection:** iPhone should show "Connected" in header
- **Check desktop logs:** Open DevTools → Console
- **Restart companion server:** Restart desktop app

### WebSocket Connection Issues:
- **Check IP address:** Make sure server address is correct in iPhone settings
- **Check firewall:** macOS firewall may block port 8080
- **Check network:** iPhone and Mac must be on same WiFi

---

## 📊 File Sizes & Checksums

```
ConnectionManager.swift    11 KB  (Jan 20 10:19)
ShoppingListStore.swift   9.6 KB  (Jan 20 10:15)
FoodieShoppingListApp.swift 1.7 KB  (Jan 20 10:19)
```

---

## 🔄 Rollback Instructions

If you need to restore the previous version:

1. **Find your backup:**
   ```bash
   ls -lt ~/Desktop/companion-backup-* | head -1
   ```

2. **Copy backup files back:**
   ```bash
   BACKUP_DIR="<path_from_step_1>"
   cp "$BACKUP_DIR/FoodieShoppingList/"* \
      ~/Desktop/FoodieShoppingList/FoodieShoppingList/Services/
   ```

3. **Rebuild in Xcode**

---

## 📝 Change Log

### v1.1.0 (Jan 20, 2026) - Pantry Sync Integration

**Added:**
- WebSocket `send()` method in ConnectionManager
- Pantry return notifications when items removed
- Pantry return notifications when items unchecked
- Quantity parsing with fraction support
- Real-time pantry updates across devices

**Modified:**
- ShoppingListStore now requires ConnectionManager injection
- FoodieShoppingListApp now injects connectionManager into store

**Backend:**
- Desktop main.js now handles `item_removed` messages
- Desktop main.js now handles `item_unpurchased` messages
- Desktop sends confirmation messages back to iPhone

---

## 🎯 What's Next?

After successful testing, you mentioned wanting to "look at what to do next."

Possible next steps:
1. **Test the pantry sync feature end-to-end**
2. **Review any bugs or issues that arise**
3. **Plan additional features or improvements**
4. **Work on the iPad companion app enhancements**
5. **Address any items from your earlier TODO list**

Let me know what you'd like to tackle!
