# Complete Guide: Building Foodie Kitchen iPad App in Xcode

This guide walks you through creating and building the **Foodie Kitchen** iPad companion app from scratch.

---

## Prerequisites

✅ Mac with Xcode installed  
✅ Apple ID (free - for code signing)  
✅ iPad connected via cable OR available on same network  
✅ Source files in: `ios-apps/FoodieKitchen/`

---

## Part 1: Create New Xcode Project (10 minutes)

### Step 1: Launch Xcode & Choose Template

1. **Open Xcode**
2. Click **"Create New Project"** (or File → New → Project)
3. **CRITICAL:** At the very top of the template chooser, click **iOS** (NOT macOS, NOT watchOS)
   ```
   ┌─────────────────────────────────────┐
   │  [iOS]  [watchOS]  [tvOS]  [macOS] │  ← Click iOS!
   └─────────────────────────────────────┘
   ```
4. Under "Application", select **"App"**
5. Click **Next**

### Step 2: Configure Project Details

Fill in the project settings:

| Field | Value |
|-------|-------|
| **Product Name** | `FoodieKitchen` |
| **Team** | Select your Apple ID (see below if empty) |
| **Organization Identifier** | `com.yourname.foodie` (or use `com.jkbarger.foodie`) |
| **Bundle Identifier** | Auto-fills to `com.yourname.foodie.FoodieKitchen` |
| **Interface** | SwiftUI |
| **Language** | Swift |
| **Storage** | None |
| **Include Tests** | Uncheck both boxes |

**If "Team" dropdown is empty:**
1. Xcode → Settings (or Preferences)
2. Click **Accounts** tab
3. Click **+** button → **Add Apple ID**
4. Sign in with your personal Apple ID (free account works)
5. Close Settings, return to project creation
6. Now select your name from Team dropdown

Click **Next**

### Step 3: Save Project Location

1. Choose location: **Desktop** (so it's easy to find)
2. **Uncheck** "Create Git repository" (not needed)
3. Click **Create**

### Step 4: Verify Platform (IMPORTANT!)

After project opens, look at the **toolbar at the top**:

```
[▶] [■] FoodieKitchen > [iPad Pro (12.9-inch)]
                         ^^^^^^^^^^^^^^^^^^^^
                         Should show iPad, NOT "My Mac"
```

✅ **CORRECT:** Shows "iPad Pro", "iPad Air", or "Any iPad Device"  
❌ **WRONG:** Shows "My Mac (Designed for iPad)" or "My Mac"

**If wrong:** You created a macOS app by mistake. Delete project and start over, ensuring you click **iOS** in Step 1.3.

---

## Part 2: Set Up Project Structure (5 minutes)

### Step 5: Create Folder Groups

In the **left navigator** (Project Navigator), you'll see:

```
FoodieKitchen/
├── FoodieKitchenApp.swift
├── ContentView.swift
└── Assets.xcassets
```

**Right-click on `FoodieKitchen` folder** → **New Group** and create these folders (one at a time):

- `Models`
- `Services`
- `Views`
- `Extensions`

Your structure should look like:

```
FoodieKitchen/
├── Models/
├── Services/
├── Views/
├── Extensions/
├── FoodieKitchenApp.swift
├── ContentView.swift  ← Will delete this later
└── Assets.xcassets
```

---

## Part 3: Copy Swift Files (15 minutes)

### Step 6: Prepare Source Files in Finder

1. **Open Finder**
2. Navigate to: `/Users/keithbarger/Projects/foodie-meal-planner-desktop/ios-apps/FoodieKitchen/`
3. **Keep this Finder window open** - you'll drag files from here

### Step 7: Drag Files into Xcode

**For EACH category below, drag the files from Finder into the corresponding Xcode folder:**

#### A. Models (3 files)

Drag these files into the **Models** folder in Xcode:
- `Recipe.swift`
- `TimerItem.swift`
- `Message.swift`

**When you drag:**
- ✅ Check **"Copy items if needed"**
- ✅ Check **"Create groups"** (NOT "Create folder references")
- ✅ Target: Check **FoodieKitchen**
- Click **Finish**

#### B. Services (4 files)

Drag into **Services** folder:
- `ConnectionManager.swift`
- `RecipeStore.swift`
- `TimerManager.swift`
- `VoiceCommandManager.swift`

#### C. Views (6 files)

Drag into **Views** folder:
- `RecipeDetailView.swift`
- `RecipeStepView.swift`
- `TodaysMealsView.swift`
- `TimerView.swift`
- `SettingsView.swift`
- `VoiceCommandView.swift`

#### D. Extensions (1 file)

Drag into **Extensions** folder:
- `String+Extensions.swift`

#### E. App File (1 file - REPLACE)

**Special handling for this one:**

1. In Xcode, find **`FoodieKitchenApp.swift`** at the root (NOT in any folder)
2. Click it to open in editor
3. **Delete it:** Right-click → Delete → Move to Trash
4. From Finder, drag **`FoodieKitchenApp.swift`** to the **root level** (same level as Assets, NOT in any folder)

### Step 8: Delete Default ContentView

1. In Xcode, find **`ContentView.swift`** (at root level)
2. Right-click → Delete → Move to Trash

### Step 9: Verify All Files Present

**Check Build Phases to confirm files are added:**

1. Click project name (blue icon at top of navigator)
2. Select **FoodieKitchen** target
3. Click **Build Phases** tab
4. Expand **Compile Sources**

**You should see 15 files:**
- 3 Model files
- 4 Service files
- 6 View files
- 1 Extensions file
- 1 App file
- **Total: 15 .swift files**

If any are missing, go back to Step 7 and drag them again.

---

## Part 4: Configure Privacy Permissions (5 minutes)

### Step 10: Add Required Privacy Keys

The iPad app uses **microphone** and **speech recognition** for voice commands.

1. Click **project name** (blue icon) at top of navigator
2. Select **FoodieKitchen** target
3. Click **Info** tab
4. Look for the list of keys (or click **+** to add new)

**Add these two keys:**

| Key | Value |
|-----|-------|
| `Privacy - Microphone Usage Description` | `Foodie Kitchen needs microphone access for voice commands while cooking` |
| `Privacy - Speech Recognition Usage Description` | `Foodie Kitchen uses speech recognition to control timers and navigate recipes hands-free` |

**How to add:**
1. Hover over any existing key, click **+** button
2. Start typing "Microphone" - autocomplete will show "Privacy - Microphone Usage Description"
3. Select it
4. In **Value** column, paste the description
5. Repeat for Speech Recognition

---

## Part 5: Add App Icon (5 minutes)

### Step 11: Use Same Icon as iPhone App

1. In Xcode, click **Assets** in left navigator
2. Click **AppIcon**
3. Open Finder to: `/Users/keithbarger/Projects/foodie-meal-planner-desktop/ios-apps/assets/AppIcon.appiconset/`

**Drag these 3 icon files into Xcode AppIcon slots:**
- `icon-60@2x.png` → **iPad App 76pt 2x** slot (or iPhone slot if iPad not shown)
- `icon-60@3x.png` → (only for iPhone, skip if not shown)
- `icon-1024.png` → **App Store 1024pt** slot

> **Note:** iPad uses different sizes (76pt), but the 60pt icons will work for testing. For production, you'd generate 76pt and 83.5pt sizes.

---

## Part 6: Build & Test (10 minutes)

### Step 12: First Build Attempt

1. Press **Command+B** (or Product → Build)
2. **Watch for errors** in the Issues Navigator (⚠️ icon on left)

**Common errors and fixes:**

#### Error: "Cannot find type 'ConnectionManager'" (or similar)

**Fix:** Files missing target membership
1. Click the affected file (e.g., `ConnectionManager.swift`)
2. Open **File Inspector** (right panel, 📄 icon)
3. Under "Target Membership", check ✅ **FoodieKitchen**
4. Repeat for any other files showing errors
5. Clean: Product → Clean Build Folder (Shift+Cmd+K)
6. Rebuild: Command+B

#### Error: "Multiple commands produce ContentView.stringsdata"

**Fix:** Duplicate files
1. Press Command+Shift+F (Find in Project)
2. Search for the duplicate filename (e.g., `ContentView`)
3. If you see two files with same name, delete one
4. Clean Build Folder, rebuild

#### Error: "Missing import 'Combine'" or "'UIKit'"

**Fix:** Add missing import
1. Open the file showing the error
2. At the top, add the missing import:
   ```swift
   import Combine  // For @Published, ObservableObject
   import UIKit    // For UIDevice, UIApplication
   ```
3. Save and rebuild

### Step 13: Configure Code Signing

If you see code signing errors:

1. Click project (blue icon)
2. Select **FoodieKitchen** target
3. Click **Signing & Capabilities** tab
4. Check ✅ **Automatically manage signing**
5. Select your **Team** (Apple ID)
6. Xcode will auto-generate provisioning profile

### Step 14: Build for iPad Device

#### Option A: Using Physical iPad (Recommended)

1. **Connect iPad** to Mac with cable
2. **On iPad:** Settings → Privacy & Security → Developer Mode → **ON** (requires restart)
3. **In Xcode:** Device dropdown at top should show your iPad's name
4. **Select your iPad** from dropdown
5. **Click ▶ Run button** (or Command+R)
6. **On iPad:** Settings → General → VPN & Device Management → Trust [Your Name] → Trust

#### Option B: Using iPad Simulator (For Testing Only)

1. Device dropdown → Select **iPad Pro (12.9-inch)** or any iPad simulator
2. Click ▶ Run
3. Simulator will launch with your app

> **Note:** Simulator can't test microphone/speech features or connect to real network WebSocket server.

---

## Part 7: Configure Connection Settings (First Launch)

### Step 15: Set Up Desktop Connection

When app launches for the first time:

1. **Tap the gear icon** (Settings) in top-right
2. **Enter your Mac's IP address:**
   - On Mac: Open Foodie desktop app → Click 📱 companion button
   - Copy just the IP part: `192.168.1.100` (NOT the full ws://... address)
   - Paste into iPad app Settings
3. **Tap "Save & Connect"**
4. **Status should turn green:** "Connected"

### Step 16: Test Connection

**From Desktop App:**
1. Click 📱 companion button
2. Your iPad should appear in "Connected Tablets" list
3. Click "Send Today's Meals to Tablets"

**On iPad:**
- Today's Meals view should populate with recipes
- Tap a recipe to see details and cooking steps

---

## Part 8: Multi-Mac Support (Switching Between Your Mac and Wife's Mac)

### How IP Configuration Works

The iPad app **saves the server IP to UserDefaults** and persists it across launches. You can switch between your Mac and your wife's Mac anytime.

### Switching Between Macs

**Your Mac:**
1. Open Foodie desktop → Click 📱 companion
2. Note IP (e.g., `192.168.1.100`)

**Wife's Mac:**
1. Open Foodie desktop → Click 📱 companion
2. Note IP (e.g., `192.168.1.105`)

**On iPad - To Switch:**
1. Tap Settings (gear icon)
2. Change IP address to the other Mac's IP
3. Tap "Save & Connect"
4. Done! Now connected to the other Mac

**Pro Tip:** Keep both IPs written down somewhere (Notes app, sticky note on fridge) for quick switching.

---

## Part 9: Troubleshooting

### App Crashes Immediately on Launch

**Cause:** Missing environment objects in `FoodieKitchenApp.swift`

**Fix:** Open `FoodieKitchenApp.swift` and verify it looks like this:

```swift
import SwiftUI

@main
struct FoodieKitchenApp: App {
    @StateObject private var connectionManager = ConnectionManager()
    @StateObject private var recipeStore = RecipeStore()
    @StateObject private var timerManager = TimerManager()
    @StateObject private var voiceCommandManager = VoiceCommandManager()
    
    var body: some Scene {
        WindowGroup {
            TodaysMealsView()
                .environmentObject(connectionManager)
                .environmentObject(recipeStore)
                .environmentObject(timerManager)
                .environmentObject(voiceCommandManager)
                // ... rest of configuration
        }
    }
}
```

### Connection Fails / Shows "Not Connected"

**Check:**
1. ✅ Both iPad and Mac on **same WiFi network**
2. ✅ Desktop app companion server **running** (📱 button clicked)
3. ✅ IP address **correct** (check desktop app for current IP)
4. ✅ Port 8080 not blocked by firewall

**Test:**
- On Mac terminal: `nc -l 8080` (starts listener)
- On iPad: Try connecting
- If connection works, issue is with desktop app server

### Voice Commands Not Working

**Check:**
1. ✅ Privacy keys added (Step 10)
2. ✅ Microphone permission granted (iPad Settings → Foodie Kitchen → Microphone)
3. ✅ Speech Recognition permission granted

**Fix:**
- iPad Settings → Privacy & Security → Microphone → FoodieKitchen → **ON**
- iPad Settings → Privacy & Security → Speech Recognition → FoodieKitchen → **ON**

### Build Errors After Xcode Update

**Fix:**
1. Product → Clean Build Folder (Shift+Cmd+K)
2. Close Xcode completely
3. Delete Derived Data:
   - Xcode → Settings → Locations
   - Click arrow next to Derived Data path
   - Delete `FoodieKitchen-...` folder
4. Reopen Xcode, rebuild

---

## Quick Reference: File Checklist

Use this to verify all files are present:

### Models (3 files)
- [ ] Recipe.swift
- [ ] TimerItem.swift
- [ ] Message.swift

### Services (4 files)
- [ ] ConnectionManager.swift
- [ ] RecipeStore.swift
- [ ] TimerManager.swift
- [ ] VoiceCommandManager.swift

### Views (6 files)
- [ ] RecipeDetailView.swift
- [ ] RecipeStepView.swift
- [ ] TodaysMealsView.swift
- [ ] TimerView.swift
- [ ] SettingsView.swift
- [ ] VoiceCommandView.swift

### Extensions (1 file)
- [ ] String+Extensions.swift

### App (1 file)
- [ ] FoodieKitchenApp.swift

### Assets (1 folder)
- [ ] AppIcon.appiconset (with 3 PNG files)

**Total: 15 Swift files + 1 asset folder**

---

## Summary

After completing this guide, you will have:

✅ Working Foodie Kitchen iPad app installed on your iPad  
✅ Connection to desktop Mac via WebSocket  
✅ Ability to receive today's meals and view recipes  
✅ Voice command support for hands-free cooking  
✅ Timer management for multiple cooking tasks  
✅ Persistent IP configuration to switch between your Mac and wife's Mac  

**Estimated Total Time:** 50 minutes

---

## Next Steps After Build Success

1. **Test all features:**
   - Send meals from desktop → iPad
   - Open recipe detail view
   - Navigate cooking steps
   - Start/stop timers
   - Try voice commands ("next step", "set timer 10 minutes")

2. **Configure both Macs:**
   - Get IP from your Mac, save in iPad
   - Get IP from wife's Mac, save in Notes
   - Test switching between them

3. **Optional: Generate proper iPad icons:**
   - iPad uses 76pt and 83.5pt icons (not just 60pt)
   - Use same process as iPhone but generate these sizes:
     - 76@2x = 152x152
     - 83.5@2x = 167x167

4. **Read companion docs:**
   - `SWITCHING_BETWEEN_MACS.md` - Detailed multi-Mac guide
   - `COMPANION_APPS_COMPLETE.md` - Full companion app overview

---

**Need Help?**

- If stuck at any step, check the Troubleshooting section
- For connection issues, see `GOOGLE_CALENDAR_QUICK_START.md` network troubleshooting
- For general iOS build issues, see `XCODE_STEP_BY_STEP.md`

**Happy Cooking! 👨‍🍳📱**
