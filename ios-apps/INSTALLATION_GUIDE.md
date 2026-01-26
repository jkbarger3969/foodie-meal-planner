# Foodie iOS Apps Installation Guide

Complete step-by-step guide to install both iPhone Shopping List and iPad Kitchen apps on your devices.

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Desktop App Setup](#desktop-app-setup)
3. [iPhone App Installation](#iphone-app-installation)
4. [iPad App Installation](#ipad-app-installation)
5. [Configuration](#configuration)
6. [Testing the Connection](#testing-the-connection)
7. [Troubleshooting](#troubleshooting)

---

## Prerequisites

### Required Software

- **macOS** with Xcode 14.0 or later
- **iOS 16.0+** on iPhone and iPad
- **Apple Developer Account** (free or paid)
- **Same WiFi network** for all devices

### What You'll Need

- Mac with Foodie desktop app installed
- iPhone (for shopping list)
- iPad (for kitchen cooking mode)
- USB cables to connect devices to Mac
- 30-60 minutes for initial setup

---

## Desktop App Setup

The desktop app has already been updated with the companion server. When you run the app:

1. **Start the Foodie app** - The WebSocket server will automatically start on port 8080
2. **Check the console logs** - You'll see:
   ```
   📱 Companion server started on port 8080
   📡 Server available at:
      ws://192.168.1.100:8080
   ```
3. **Note your IP address** - Write down the `192.168.x.x` address shown

### Finding Your IP Address

If you don't see it in logs, find it manually:
- **macOS**: System Preferences → Network → WiFi → IP Address
- Should look like: `192.168.1.100` or `10.0.0.5`

---

## iPhone App Installation

### Step 1: Create Xcode Project

1. **Open Xcode** (from Applications or Spotlight)
2. Click **"Create a new Xcode project"**
3. Choose **iOS** → **App** → Next
4. Fill in project details:
   - **Product Name**: `FoodieShoppingList`
   - **Team**: Select your Apple ID
   - **Organization Identifier**: `com.yourname.foodie` (use your name)
   - **Interface**: SwiftUI
   - **Language**: Swift
   - **Storage**: None (uncheck all boxes)
5. Click **Next** → Choose location (Desktop or Documents) → **Create**

### Step 2: Add Swift Files

1. **Delete default `ContentView.swift`** (right-click → Delete → Move to Trash)
2. **Create folder structure**:
   - Right-click on `FoodieShoppingList` folder in left sidebar
   - New Group → name it `Models`
   - Repeat for: `Services`, `Views`, `Extensions`

3. **Add all Swift files** from `ios-apps/FoodieShoppingList/`:

   **In Models folder:**
   - `ShoppingItem.swift`
   - `Message.swift`

   **In Services folder:**
   - `ShoppingListStore.swift`
   - `ConnectionManager.swift`
   - `VoiceInputManager.swift`

   **In Views folder:**
   - `ContentView.swift`
   - `ShoppingItemRow.swift`
   - `AddItemView.swift`
   - `SettingsView.swift`

   **In Extensions folder:**
   - `View+Extensions.swift`

   **In root FoodieShoppingList folder:**
   - Replace `FoodieShoppingListApp.swift` with the new version

**How to add files:**
- Right-click on each folder → Add Files to "FoodieShoppingList"
- Browse to `ios-apps/FoodieShoppingList/[folder]/[file].swift`
- Check "Copy items if needed"
- Click Add

### Step 3: Configure Permissions

1. Click on **FoodieShoppingList** (top of file navigator, blue icon)
2. Select **FoodieShoppingList** target (under TARGETS)
3. Go to **Info** tab
4. Click **+** next to "Custom iOS Target Properties"
5. Add these privacy keys:

   | Key | Value |
   |-----|-------|
   | Privacy - Speech Recognition Usage Description | "Foodie needs speech recognition to add items by voice" |
   | Privacy - Microphone Usage Description | "Foodie needs microphone access for voice input" |

### Step 4: Build and Install

1. **Connect your iPhone** with USB cable
2. **Select your device** in Xcode toolbar (top left, next to Run button)
3. Click **Run** button (▶) or press `Cmd+R`
4. **First time only**: Xcode may ask to "Register Device" - click Register
5. Wait for build to complete (1-2 minutes first time)
6. **On iPhone**: Trust this Mac if prompted
7. **On iPhone**: Settings → General → VPN & Device Management → Trust "Apple Development: [your email]"

The app should now launch on your iPhone!

---

## iPad App Installation

### Step 1: Create Xcode Project

1. **Open Xcode** (close iPhone project first if needed)
2. Click **"Create a new Xcode project"**
3. Choose **iOS** → **App** → Next
4. Fill in project details:
   - **Product Name**: `FoodieKitchen`
   - **Team**: Select your Apple ID
   - **Organization Identifier**: `com.yourname.foodie`
   - **Interface**: SwiftUI
   - **Language**: Swift
   - **Storage**: None
5. Click **Next** → Choose location → **Create**

### Step 2: Configure iPad-Specific Settings

1. Click on **FoodieKitchen** (blue icon at top)
2. Select **FoodieKitchen** target
3. Go to **General** tab
4. Under **Deployment Info**:
   - **Supported Destinations**: Check only **iPad**
   - **Orientation**: Check only **Landscape Left** and **Landscape Right**
   - Uncheck Portrait orientations

### Step 3: Add Swift Files

Create folders and add files from `ios-apps/FoodieKitchen/`:

**Folder structure:**
- `Models/`
  - `Recipe.swift`
  - `TimerItem.swift`
  - `Message.swift`

- `Services/`
  - `ConnectionManager.swift`
  - `RecipeStore.swift`
  - `TimerManager.swift`
  - `VoiceCommandManager.swift`

- `Views/`
  - `ContentView.swift`
  - `RecipeDetailView.swift` (if exists)
  - `IngredientListView.swift`
  - `InstructionsView.swift`
  - `TimerBar.swift`
  - `SettingsView.swift`
  - `VoiceCommandButton.swift`

- `Extensions/`
  - `View+Extensions.swift`

- **Root folder:**
  - `FoodieKitchenApp.swift`

### Step 4: Configure Permissions

In **Info** tab, add these keys:

| Key | Value |
|-----|-------|
| Privacy - Speech Recognition Usage Description | "Foodie Kitchen needs speech recognition for voice commands while cooking" |
| Privacy - Microphone Usage Description | "Foodie Kitchen needs microphone access for hands-free operation" |

### Step 5: Build and Install

1. **Connect your iPad** with USB cable
2. **Select iPad** in device menu
3. Click **Run** (▶)
4. **On iPad**: Settings → General → VPN & Device Management → Trust "Apple Development: [your email]"
5. App launches in landscape mode!

---

## Configuration

### Desktop App Configuration

1. **Launch Foodie desktop app**
2. **Check console** for WebSocket server address
3. **Click floating 📱 button** (bottom right) to open companion panel
4. You should see "Server ready (no devices)"

### iPhone Configuration

1. **Open FoodieShoppingList app**
2. Tap **Settings** (gear icon)
3. **Enter Server IP Address**: `192.168.1.100` (use YOUR Mac's IP)
4. Tap **Connect**
5. Status should change to green "Connected"

### iPad Configuration

1. **Open FoodieKitchen app**
2. Tap **Settings** (gear icon)
3. **Enter Server IP Address**: Same as iPhone
4. Tap **Connect**
5. Should see "Connected" message

---

## Testing the Connection

### Test 1: Shopping List Sync

**On Desktop:**
1. Go to **Shopping** tab
2. Add some items to shopping list
3. Click 📱 button → "Send Shopping List to iPhone"

**On iPhone:**
1. App should receive items immediately
2. List populates with categories
3. Tap checkboxes to mark items purchased

### Test 2: Today's Meals

**On Desktop:**
1. Go to **Planner** tab
2. Add meals for today
3. Click 📱 → "Send Today's Meals to iPad"

**On iPad:**
1. Should see recipe list
2. Tap a recipe to view it
3. Split screen shows ingredients (left) and instructions (right)

### Test 3: Voice Commands (iPad)

**On iPad:**
1. Open a recipe
2. Tap microphone button
3. Say "Next step" → instruction advances
4. Say "Set timer 5 minutes" → timer appears in bottom bar
5. Say "Done" → stops listening

### Test 4: Manual Sync (iPhone)

**On iPhone:**
1. While shopping, tap ➕ to add item
2. Enter "Milk" → Add
3. Item appears with "Added while shopping" badge
4. Tap sync button when back home
5. Desktop receives the new item

---

## Troubleshooting

### Desktop App Issues

**Server won't start:**
- Check port 8080 isn't in use: `lsof -i :8080` in Terminal
- Restart Foodie app
- Check firewall settings (System Preferences → Security → Firewall)

**Can't see IP address:**
- Check WiFi connection (menu bar WiFi icon)
- Run `ifconfig | grep "inet "` in Terminal

### iPhone/iPad Connection Issues

**"Disconnected" status:**
- ✅ Both devices on **same WiFi network**
- ✅ IP address typed correctly (no spaces, correct dots)
- ✅ Desktop Foodie app is running
- ✅ Try airplane mode off/on to refresh network

**App crashes on launch:**
- Check Xcode console for errors
- Verify all Swift files were added correctly
- Clean build: Xcode → Product → Clean Build Folder
- Rebuild: Cmd+B

**Voice not working:**
- Settings → Privacy → Speech Recognition → Enable for Foodie
- Settings → Privacy → Microphone → Enable for Foodie
- Internet required for first-time voice recognition setup

**iPad stuck in portrait:**
- Double-check Deployment Info settings (iPad only, landscape only)
- Delete app from iPad, rebuild and reinstall

### Network Issues

**Devices can't see server:**
```bash
# On Mac, check firewall:
sudo /usr/libexec/ApplicationFirewall/socketfilterfw --add /path/to/Foodie.app
sudo /usr/libexec/ApplicationFirewall/socketfilterfw --unblockapp /path/to/Foodie.app
```

**Find correct IP:**
```bash
# On Mac Terminal:
ifconfig | grep "inet " | grep -v 127.0.0.1
# Use the 192.168.x.x or 10.0.x.x address
```

---

## Advanced: TestFlight Distribution (Optional)

To share apps without cables:

1. **Enroll in Apple Developer Program** ($99/year)
2. **Archive the app**: Xcode → Product → Archive
3. **Upload to App Store Connect**: Distribute App → App Store Connect
4. **Create app in App Store Connect**: apps.apple.com
5. **Add to TestFlight**: Select build → Add to TestFlight
6. **Invite testers**: Email addresses → Send invite
7. **Testers download**: TestFlight app → Install Foodie

---

## Quick Reference Card

### iPhone Shopping List

**Main Actions:**
- ✅ Tap checkbox to mark purchased
- ➕ Add button for manual items
- 🔄 Sync button when returning home
- ⚙️ Settings for server address

**Voice Input:**
- Tap 🎤 in Add Item screen
- Say "2 pounds chicken"
- Auto-parses quantity and name

### iPad Kitchen

**Main Features:**
- Left panel: Ingredients with checkboxes
- Right panel: Step-by-step instructions
- Bottom bar: Active timers
- 🎤 Voice commands always available

**Voice Commands:**
- "Next step" → Advance instruction
- "Previous step" → Go back
- "Set timer 10 minutes" → Start timer
- "Done" → Stop listening

**Navigation:**
- Large Previous/Next buttons (100pt tall)
- Swipe gestures on instructions
- Tap servings to scale recipe

---

## Getting Help

**Desktop app issues:**
- Check `src/main/main.js` logs in developer console
- Look for "Companion server started" message

**iOS app issues:**
- View Xcode console while running
- Check for error messages in red
- Verify file structure matches guide

**Connection issues:**
- Confirm same WiFi network
- Ping test: `ping 192.168.1.100` from Terminal
- Check desktop app is running

**Need more help?**
- Review `ios-apps/IMPLEMENTATION_SUMMARY.md` for architecture
- Check `ios-apps/QUICK_START.md` for development guide

---

## Summary

✅ **Desktop app**: Automatically runs WebSocket server on port 8080  
✅ **iPhone app**: Shopping list with offline support and voice input  
✅ **iPad app**: Hands-free cooking mode with timers and voice commands  
✅ **No cloud**: Everything works on local WiFi  
✅ **No subscriptions**: One-time setup, works forever  

**Total setup time**: 30-60 minutes  
**After setup**: Instant sync whenever on home WiFi  

Enjoy your new companion apps! 🎉
