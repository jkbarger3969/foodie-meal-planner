# Quick Visual Walkthrough - Building iOS Apps in Xcode

## Your Server IP: 192.168.2.115
**Write this down!** You'll need it to configure both iOS apps.

---

## Part 1: Create iPhone Shopping List App (15 minutes)

### 1. Open Xcode
- Press **Command + Space** (Spotlight)
- Type: **Xcode**
- Press **Enter**

### 2. Create New Project
- Click: **"Create a new Xcode project"**
- Template: Choose **iOS** → **App** → Click **Next**

### 3. Project Settings
Fill in these EXACT values:

| Field | Value |
|-------|-------|
| Product Name | `FoodieShoppingList` |
| Team | (Select your Apple ID) |
| Organization Identifier | `com.yourname.foodie` |
| Interface | **SwiftUI** |
| Language | **Swift** |
| Storage | None (uncheck all) |

- Click **Next**
- Save Location: Navigate to `/Users/keithbarger/Projects/foodie-meal-planner-desktop/ios-apps/`
- Click **Create**

### 4. Clean Up Default Files
In the left sidebar (Navigator):
- Right-click `ContentView.swift`
- Choose **Delete** → **Move to Trash**

### 5. Create Folder Structure
Right-click on `FoodieShoppingList` folder (the one with the blue icon):
- **New Group** → Name it: `Models`
- **New Group** → Name it: `Services`
- **New Group** → Name it: `Views`
- **New Group** → Name it: `Extensions`

### 6. Add Swift Files
For each folder, drag the corresponding .swift files:

**Drag to Models folder:**
- `ios-apps/FoodieShoppingList/Models/ShoppingItem.swift`
- `ios-apps/FoodieShoppingList/Models/Message.swift`

**Drag to Services folder:**
- `ios-apps/FoodieShoppingList/Services/ShoppingListStore.swift`
- `ios-apps/FoodieShoppingList/Services/ConnectionManager.swift`
- `ios-apps/FoodieShoppingList/Services/VoiceInputManager.swift`

**Drag to Views folder:**
- `ios-apps/FoodieShoppingList/Views/ContentView.swift`
- `ios-apps/FoodieShoppingList/Views/ShoppingItemRow.swift`
- `ios-apps/FoodieShoppingList/Views/AddItemView.swift`
- `ios-apps/FoodieShoppingList/Views/SettingsView.swift`

**Drag to Extensions folder:**
- `ios-apps/FoodieShoppingList/Extensions/View+Extensions.swift`

**Drag to FoodieShoppingList root folder:**
- `ios-apps/FoodieShoppingList/FoodieShoppingListApp.swift` (replace existing)

**When dragging:** Check "Copy items if needed" → Click **Add**

### 7. Configure Privacy Permissions
- Click on `FoodieShoppingList` (blue icon at top of navigator)
- Select **FoodieShoppingList** under TARGETS
- Click **Info** tab
- Click the **+** button next to "Custom iOS Target Properties"

Add these two entries:

| Key | Type | Value |
|-----|------|-------|
| Privacy - Speech Recognition Usage Description | String | Foodie needs speech recognition to add items by voice |
| Privacy - Microphone Usage Description | String | Foodie needs microphone access for voice input |

### 8. Build on iPhone
- **Connect your iPhone** via USB cable
- At the top of Xcode (toolbar), click the device selector (says "iPhone 13" or similar)
- Select **your connected iPhone**
- Click the **Play button ▶** (or press Command+R)

**First time:**
- Xcode may ask to register device → Click **Register**
- On iPhone: Settings → General → VPN & Device Management → Trust your developer account
- Click **Run ▶** again

**App should launch on your iPhone!**

### 9. Configure Server Address
On iPhone:
- Tap **Settings** (gear icon)
- Enter Server IP: **192.168.2.115**
- Tap **Connect**
- Should see green **"Connected"**

---

## Part 2: Create iPad Kitchen App (15 minutes)

### 1. Create New Project (in Xcode)
- Close iPhone project: **File → Close Project**
- **File → New → Project**
- Template: **iOS** → **App** → **Next**

### 2. Project Settings

| Field | Value |
|-------|-------|
| Product Name | `FoodieKitchen` |
| Team | (Select your Apple ID) |
| Organization Identifier | `com.yourname.foodie` |
| Interface | **SwiftUI** |
| Language | **Swift** |
| Storage | None |

- **Next** → Save in: `/Users/keithbarger/Projects/foodie-meal-planner-desktop/ios-apps/`
- **Create**

### 3. Configure for iPad Only
- Click on `FoodieKitchen` (blue icon)
- Select **FoodieKitchen** target
- **General** tab
- Under **Deployment Info**:
  - **Supported Destinations**: Uncheck iPhone, check only **iPad**
  - **Device Orientation**: 
    - ✅ Landscape Left
    - ✅ Landscape Right
    - ❌ Portrait (uncheck)
    - ❌ Upside Down (uncheck)

### 4. Create Folder Structure
- Right-click `FoodieKitchen` folder
- Create groups: `Models`, `Services`, `Views`, `Extensions`

### 5. Add Swift Files

**Drag to Models:**
- `ios-apps/FoodieKitchen/Models/Recipe.swift`
- `ios-apps/FoodieKitchen/Models/TimerItem.swift`
- `ios-apps/FoodieKitchen/Models/Message.swift`

**Drag to Services:**
- `ios-apps/FoodieKitchen/Services/ConnectionManager.swift`
- `ios-apps/FoodieKitchen/Services/RecipeStore.swift`
- `ios-apps/FoodieKitchen/Services/TimerManager.swift`
- `ios-apps/FoodieKitchen/Services/VoiceCommandManager.swift`

**Drag to Views:**
- `ios-apps/FoodieKitchen/Views/ContentView.swift`
- `ios-apps/FoodieKitchen/Views/IngredientListView.swift`
- `ios-apps/FoodieKitchen/Views/InstructionsView.swift`
- `ios-apps/FoodieKitchen/Views/TimerBar.swift`
- `ios-apps/FoodieKitchen/Views/SettingsView.swift`
- `ios-apps/FoodieKitchen/Views/VoiceCommandButton.swift`

**Drag to Extensions:**
- `ios-apps/FoodieKitchen/Extensions/View+Extensions.swift`

**Drag to FoodieKitchen root:**
- `ios-apps/FoodieKitchen/FoodieKitchenApp.swift` (replace)

### 6. Configure Privacy Permissions
Same as iPhone:

| Key | Type | Value |
|-----|------|-------|
| Privacy - Speech Recognition Usage Description | String | Foodie Kitchen needs speech recognition for voice commands |
| Privacy - Microphone Usage Description | String | Foodie Kitchen needs microphone for hands-free operation |

### 7. Build on iPad
- **Connect iPad** via USB
- Select **your iPad** in device menu
- Click **Play ▶**
- Trust developer on iPad if needed

**App launches in landscape!**

### 8. Configure Server Address
On iPad:
- Tap **Settings**
- Enter: **192.168.2.115**
- Tap **Connect**
- Green **"Connected"**

---

## Part 3: Test Everything (10 minutes)

### Test 1: Shopping List Sync

**Desktop (Foodie app):**
1. Launch Foodie desktop app
2. Go to **Shopping** tab
3. Add a few items
4. Click **📱 button** (bottom right)
5. Click **"Send Shopping List to iPhone"**

**iPhone:**
- List should appear instantly
- Tap checkboxes to mark purchased
- Tap **+** to add "Milk"
- Tap sync button
- Desktop should receive "Milk"

### Test 2: Recipe to iPad

**Desktop:**
1. Go to **Planner** tab
2. Add recipes for today
3. Click **📱** → **"Send Today's Meals to iPad"**

**iPad:**
- Recipe list appears
- Tap a recipe
- See split screen:
  - Left: Ingredients (40%)
  - Right: Instructions (60%)
- Tap **mic button**
- Say: "Next step" → instruction advances
- Say: "Set timer 5 minutes" → timer appears

---

## Troubleshooting

### "Build Failed" in Xcode
- **Product → Clean Build Folder** (Shift+Cmd+K)
- **Product → Build** (Cmd+B)
- Check error messages in red

### "Code Signing Error"
- Click project (blue icon)
- **Signing & Capabilities** tab
- Check "Automatically manage signing"
- Select your Team

### "Cannot Connect" on iOS
- Verify iPhone/iPad on same WiFi as Mac
- Check IP: **192.168.2.115**
- Desktop Foodie app must be running

### Device Not Showing in Xcode
- Unplug and replug USB cable
- Unlock device
- Trust this computer on device
- **Window → Devices and Simulators** in Xcode

---

## Success! 🎉

You should now have:
- ✅ Desktop app with 📱 companion panel
- ✅ iPhone app receiving shopping lists
- ✅ iPad app with split-screen cooking mode
- ✅ All devices connected on local WiFi

**Total Time:** ~40 minutes

**Questions?** Review `ios-apps/INSTALLATION_GUIDE.md` for more details.

Enjoy your companion apps! 🛒👨‍🍳
