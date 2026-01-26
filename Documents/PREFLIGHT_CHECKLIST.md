# Pre-Flight Checklist - Companion Apps

Before you start installing the iOS apps, verify everything is ready:

## ✅ Desktop App Verification

Run these checks to ensure the desktop integration is complete:

### 1. File Changes Confirmed

```bash
# Check that main.js has companion server
grep -q "class CompanionServer" src/main/main.js && echo "✅ CompanionServer class exists" || echo "❌ Missing CompanionServer"

# Check server initialization
grep -q "companionServer = new CompanionServer()" src/main/main.js && echo "✅ Server initialized" || echo "❌ Server not initialized"

# Check IPC handlers
grep -q "companion:send-shopping-list" src/main/main.js && echo "✅ IPC handlers added" || echo "❌ IPC handlers missing"

# Check preload API
grep -q "sendShoppingListToPhones" src/main/preload.js && echo "✅ Preload APIs added" || echo "❌ Preload APIs missing"

# Check HTML UI
grep -q "companion-float-btn" src/renderer/index.html && echo "✅ UI components added" || echo "❌ UI components missing"
```

### 2. Syntax Check

```bash
# Verify JavaScript syntax
node -c src/main/main.js && echo "✅ main.js syntax OK" || echo "❌ Syntax error in main.js"
```

### 3. Dependencies Check

```bash
# Verify ws package is installed
npm list ws && echo "✅ ws package installed" || echo "❌ Need to run: npm install ws"
```

---

## 🚀 Desktop App Runtime Check

After starting the Foodie app, verify:

### Console Output

You should see:
```
📱 Companion server started on port 8080
📱 Connect iOS devices to:
   ws://192.168.1.100:8080
```

### UI Check

1. Launch Foodie desktop app
2. Look for **📱 button** in bottom-right corner
3. Click the button
4. Panel should appear with:
   - ✅ Connection status
   - ✅ "Server ready (no devices)"
   - ✅ Three action buttons
   - ✅ Server address displayed

### Network Check

```bash
# Verify server is listening on port 8080
lsof -i :8080 | grep LISTEN && echo "✅ Server listening on port 8080" || echo "❌ Port 8080 not open"

# Find your local IP
ifconfig | grep "inet " | grep -v 127.0.0.1
# Should show something like: inet 192.168.1.100
```

---

## 📱 iOS App Files Ready

### iPhone App Files

Check that all files exist:

```bash
# List iPhone app files
ls -R ios-apps/FoodieShoppingList/

# Should show:
# FoodieShoppingListApp.swift
# Models/ShoppingItem.swift
# Models/Message.swift
# Services/ShoppingListStore.swift
# Services/ConnectionManager.swift
# Services/VoiceInputManager.swift
# Views/ContentView.swift
# Views/ShoppingItemRow.swift
# Views/AddItemView.swift
# Views/SettingsView.swift
# Extensions/View+Extensions.swift
```

Expected count: **12 Swift files**

```bash
find ios-apps/FoodieShoppingList -name "*.swift" | wc -l
# Should show: 12
```

### iPad App Files

```bash
# List iPad app files
ls -R ios-apps/FoodieKitchen/

# Should show 14 .swift files plus README.md
```

Expected count: **14 Swift files**

```bash
find ios-apps/FoodieKitchen -name "*.swift" | wc -l
# Should show: 14
```

---

## 📚 Documentation Ready

```bash
# Check installation guide exists
test -f ios-apps/INSTALLATION_GUIDE.md && echo "✅ Installation guide ready" || echo "❌ Missing guide"

# Check summary docs
test -f COMPANION_APPS_COMPLETE.md && echo "✅ Summary ready" || echo "❌ Missing summary"
test -f START_HERE_COMPANION_APPS.md && echo "✅ Quick start ready" || echo "❌ Missing quick start"
```

---

## 🔧 Development Environment Check

Before building iOS apps, verify:

### macOS Requirements

```bash
# Check Xcode is installed
xcode-select -p && echo "✅ Xcode installed" || echo "❌ Install Xcode from App Store"

# Check Xcode version (need 14.0+)
xcodebuild -version
# Should show: Xcode 14.x or higher
```

### Device Requirements

For iPhone app:
- [ ] iPhone with iOS 16.0 or later
- [ ] USB cable to connect to Mac
- [ ] iPhone and Mac on same WiFi network

For iPad app:
- [ ] iPad with iOS 16.0 or later
- [ ] USB cable to connect to Mac
- [ ] iPad and Mac on same WiFi network

### Apple Developer Account

- [ ] Apple ID signed in to Xcode
- [ ] Developer certificate available (free or paid)
- [ ] Device registered (Xcode does this automatically)

---

## 📋 Pre-Installation Checklist

Run through this before starting installation:

### Desktop
- [ ] Foodie desktop app runs without errors
- [ ] Can see 📱 button in UI
- [ ] Clicking button shows companion panel
- [ ] Console shows server started message
- [ ] Know your Mac's local IP address (write it here: ________________)

### iPhone
- [ ] All 12 Swift files exist in `ios-apps/FoodieShoppingList/`
- [ ] Xcode installed on Mac
- [ ] iPhone connected via USB
- [ ] iPhone and Mac on same WiFi

### iPad
- [ ] All 14 Swift files exist in `ios-apps/FoodieKitchen/`
- [ ] iPad connected via USB
- [ ] iPad and Mac on same WiFi

### Documentation
- [ ] Read `START_HERE_COMPANION_APPS.md` (overview)
- [ ] Have `ios-apps/INSTALLATION_GUIDE.md` open (step-by-step)
- [ ] 30-60 minutes available for installation

---

## 🎯 Success Criteria

After installation, you should be able to:

### Desktop → iPhone
- [ ] Click "Send Shopping List to iPhone"
- [ ] See alert: "Shopping list sent to 1 device(s)"
- [ ] iPhone app shows items immediately
- [ ] Check off items on iPhone (haptic feedback)
- [ ] Add new item on iPhone manually
- [ ] Sync back to desktop
- [ ] Desktop receives the new item

### Desktop → iPad
- [ ] Click "Send Today's Meals to iPad"
- [ ] See alert: "Today's meals sent to 1 device(s)"
- [ ] iPad shows recipe list
- [ ] Tap recipe → split screen appears
- [ ] Ingredients on left, instructions on right
- [ ] Voice command "Next step" works
- [ ] Voice command "Set timer 5 minutes" works
- [ ] Timer appears in bottom bar

### Connection
- [ ] Desktop companion panel shows 2 devices connected
- [ ] Each device shows correct type (iPhone/iPad)
- [ ] Each device shows IP address
- [ ] Green connection status on all devices

---

## 🚨 Common Issues (Before You Start)

### "Port 8080 already in use"

```bash
# Find what's using port 8080
lsof -i :8080

# Kill the process if needed
kill -9 <PID>
```

### "Can't find my IP address"

```bash
# List all network interfaces
ifconfig

# Or use this to filter:
ifconfig | grep "inet " | grep -v 127.0.0.1 | awk '{print $2}'
```

### "Xcode command line tools not found"

```bash
# Install command line tools
xcode-select --install
```

### "Device not trusted"

On iPhone/iPad:
1. Settings → General → VPN & Device Management
2. Tap your developer profile
3. Tap "Trust"

---

## 📞 Quick Reference

**Your Mac's IP**: ________________ (write it down!)

**Server Address**: `ws://[your-ip]:8080`

**Installation Time**:
- iPhone app: ~15 minutes
- iPad app: ~15 minutes
- Testing: ~10 minutes
- **Total**: ~40 minutes

**Files to Read**:
1. This checklist (you are here!)
2. `START_HERE_COMPANION_APPS.md` - Overview
3. `ios-apps/INSTALLATION_GUIDE.md` - Step-by-step

**Ready?** → Open `ios-apps/INSTALLATION_GUIDE.md` and start with "iPhone App Installation"

---

## ✅ Final Verification

Before proceeding to installation, confirm:

```bash
# Run all checks
echo "Desktop Files:"
grep -q "CompanionServer" src/main/main.js && echo "  ✅ Server class" || echo "  ❌ Server class"
grep -q "sendShoppingListToPhones" src/main/preload.js && echo "  ✅ APIs" || echo "  ❌ APIs"
grep -q "companion-float-btn" src/renderer/index.html && echo "  ✅ UI" || echo "  ❌ UI"

echo "iPhone Files:"
test -f ios-apps/FoodieShoppingList/FoodieShoppingListApp.swift && echo "  ✅ App file" || echo "  ❌ App file"
count=$(find ios-apps/FoodieShoppingList -name "*.swift" | wc -l | tr -d ' ')
echo "  Swift files: $count/12"

echo "iPad Files:"
test -f ios-apps/FoodieKitchen/FoodieKitchenApp.swift && echo "  ✅ App file" || echo "  ❌ App file"
count=$(find ios-apps/FoodieKitchen -name "*.swift" | wc -l | tr -d ' ')
echo "  Swift files: $count/14"

echo "Documentation:"
test -f ios-apps/INSTALLATION_GUIDE.md && echo "  ✅ Installation guide" || echo "  ❌ Installation guide"
```

**All checks passing?** → You're ready to install! 🚀

**Any failures?** → Review the failed items before proceeding.
