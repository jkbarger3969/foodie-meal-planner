# 🧪 Pantry Sync Testing Guide

## ✅ Files Updated Successfully

**Location:** `/Users/keithbarger/Desktop/FoodieShoppingList/`

**Backup:** `/Users/keithbarger/Desktop/companion-backup-20260120-102515/`

---

## 🔨 Build in Xcode

Xcode should now be open. Follow these steps:

### 1. Clean Build Folder
- Press: `⌘ + Shift + K`
- Or: Product → Clean Build Folder
- Wait for completion

### 2. Build Project
- Press: `⌘ + B`
- Watch build output for errors (should be none)
- Wait for "Build Succeeded"

### 3. Select iPhone Device
- Top toolbar: Click device selector
- Choose your connected iPhone
- Or choose iPhone simulator

### 4. Run on iPhone
- Press: `⌘ + R`
- App will install and launch on iPhone

---

## 🧪 Test Pantry Sync Feature

### Prerequisite: Desktop App Running

1. **Start Desktop App:**
   ```bash
   cd /Users/keithbarger/Projects/foodie-meal-planner-desktop
   npm start
   ```

2. **Open DevTools:**
   - In desktop app: `View → Toggle Developer Tools`
   - Or press: `⌥ + ⌘ + I`
   - Go to Console tab

3. **Verify Companion Server:**
   - Look for: `📱 Companion server started on port 8080`
   - Note the IP addresses shown

### Test Case 1: Remove Item from Shopping List

**Steps:**
1. On **iPhone**: Open FoodieShoppingList app
2. Verify connection status (should show "Connected" in header)
3. Swipe left on any shopping list item
4. Tap "Delete"

**Expected Results:**

**iPhone (Xcode Debug Area):**
```
📤 Sent item_removed: chicken breast (1.5 lb)
📊 Parsed '1.5 lb' → qty: 1.5, unit: 'lb'
⚠️ No connection manager - cannot notify item removal  // Should NOT see this
```

**Desktop (DevTools Console):**
```
📥 Item removed from iphone: chicken breast (1.5 lb)
[DEDUCT] ... pantry update logs ...
✅ Returned to pantry: chicken breast (1.5 lb)
```

**Desktop UI:**
- Go to Pantry tab
- Find "chicken breast"
- Quantity should have **increased** by 1.5 lb

---

### Test Case 2: Uncheck Purchased Item

**Steps:**
1. On **iPhone**: Check an item as purchased (tap checkbox)
2. Wait 1 second
3. Uncheck the same item (tap checkbox again)

**Expected Results:**

**iPhone (Xcode Debug Area):**
```
📤 Sent item_unpurchased: tomatoes (3 cup)
📊 Parsed '3 cup' → qty: 3.0, unit: 'cup'
```

**Desktop (DevTools Console):**
```
📥 Item unmarked as purchased from iphone: tomatoes (3.0 cup)
✅ Returned to pantry: tomatoes (3.0 cup)
```

**Desktop UI:**
- Pantry tab → "tomatoes" quantity increases by 3 cups

---

### Test Case 3: Fractional Quantities

**Steps:**
1. Add item with fraction to shopping list (e.g., "1 1/2 cups flour")
2. On **iPhone**: Remove this item

**Expected Results:**

**iPhone logs should show:**
```
📊 Parsed '1 1/2 cups' → qty: 1.5, unit: 'cups'
```

**Desktop should restore 1.5 cups to pantry**

---

## 🐛 Troubleshooting

### iPhone Shows "Not Connected"

**Check:**
- Desktop app is running
- Both devices on same WiFi
- iPhone Settings → Server Address matches desktop IP
- Desktop firewall not blocking port 8080

**Fix:**
- In iPhone app: Settings → Server Address
- Enter: `ws://[DESKTOP_IP]:8080`
- Tap "Connect Now"

---

### No Pantry Updates on Desktop

**Check Console for Errors:**

**If you see:** `⚠️ No connection manager - cannot notify item removal`
- **Problem:** ConnectionManager not injected into store
- **Fix:** Rebuild iPhone app (files should be correct now)

**If you see:** `❌ Failed to return to pantry`
- **Problem:** API error
- **Check:** Desktop console for API error details

**If you see nothing:**
- **Problem:** WebSocket message not received
- **Check:** 
  - iPhone connection status
  - Desktop companion server is running
  - Check `handleMessage()` in main.js

---

### Build Errors in Xcode

**"Use of unresolved identifier 'connectionManager'"**
- **Problem:** File not updated correctly
- **Fix:** Re-run `./quick-copy.sh`

**"Cannot find 'send' in scope"**
- **Problem:** ConnectionManager.swift missing send() method
- **Fix:** Check file was copied, re-run copy script

**Code signing errors**
- **Fix:** Xcode → Signing & Capabilities → Select your team

---

## 📊 Verification Checklist

After testing, verify:

- [ ] iPhone app builds without errors
- [ ] iPhone app connects to desktop (shows "Connected")
- [ ] Removing item sends WebSocket message
- [ ] Desktop receives message and logs it
- [ ] Desktop calls `returnItemToPantry` API
- [ ] Pantry quantity increases on desktop
- [ ] Unchecking item sends WebSocket message
- [ ] Pantry quantity increases for unchecked items
- [ ] Fractional quantities parse correctly (1 1/2 → 1.5)

---

## 📝 Console Log Reference

### Normal Operation

**iPhone (Xcode Debug Area):**
```
✅ Connected to desktop
📤 Sent item_removed: [item] ([qty] [unit])
📊 Parsed '[text]' → qty: [number], unit: '[unit]'
```

**Desktop (DevTools Console):**
```
📱 iphone connected: device-[id] ([ip])
📥 Item removed from iphone: [item] ([qty] [unit])
[ADD-BACK] Called for [item]: adding [qty] [unit]
✅ Returned to pantry: [item] ([qty] [unit])
```

### Error Patterns

**iPhone:**
```
⚠️ No connection manager - cannot notify item removal
```
→ Store not initialized properly, rebuild app

**Desktop:**
```
❌ Failed to return to pantry: [error]
```
→ Check API logs, pantry database state

---

## 🎯 Success Criteria

✅ **Test passes if:**
1. No build errors
2. iPhone connects to desktop
3. Removing items increases pantry quantities
4. Unchecking items increases pantry quantities
5. Console logs show proper message flow
6. Fractions parse correctly (1 1/2 → 1.5)

❌ **Test fails if:**
- Build errors
- Connection errors
- Pantry quantities don't change
- Console errors appear
- App crashes

---

## 🔄 If Tests Fail

1. **Check file contents:**
   ```bash
   grep "func send" /Users/keithbarger/Desktop/FoodieShoppingList/FoodieShoppingList/Services/ConnectionManager.swift
   grep "connectionManager" /Users/keithbarger/Desktop/FoodieShoppingList/FoodieShoppingList/FoodieShoppingListApp.swift
   ```

2. **Re-copy files:**
   ```bash
   cd /Users/keithbarger/Projects/foodie-meal-planner-desktop
   ./quick-copy.sh
   ```

3. **Clean rebuild:**
   - Xcode: Product → Clean Build Folder (⌘ + Shift + K)
   - Delete derived data: Xcode → Preferences → Locations → Derived Data → Delete
   - Rebuild: ⌘ + B

4. **Check desktop app:**
   - Restart desktop app
   - Verify companion server started
   - Check firewall settings

---

## 📖 Code Reference

### Files Modified

1. **ConnectionManager.swift** (line 256)
   ```swift
   func send(_ messageDict: [String: Any])
   ```

2. **ShoppingListStore.swift** (lines 208-303)
   ```swift
   private func notifyItemRemoved(_ item: ShoppingItem)
   private func notifyItemUnpurchased(_ item: ShoppingItem)
   private func parseQuantityAndUnit(_ text: String) -> (Double, String)
   private func parseFraction(_ text: String) -> Double
   ```

3. **FoodieShoppingListApp.swift** (line 24)
   ```swift
   shoppingListStore.connectionManager = connectionManager
   ```

4. **main.js** (desktop, lines 167-173, 423-515)
   ```javascript
   case 'item_removed': await this.handleItemRemoved(deviceId, message);
   case 'item_unpurchased': await this.handleItemUnpurchased(deviceId, message);
   ```

---

## ✅ When Tests Pass

Congratulations! The pantry sync feature is working. You now have:

- ✅ Real-time pantry sync between iPhone and desktop
- ✅ Automatic pantry restoration when items removed
- ✅ Automatic pantry restoration when items unchecked
- ✅ Smart quantity parsing with fraction support

**Next:** Test with real meal planning workflow!
