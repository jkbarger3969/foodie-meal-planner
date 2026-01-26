# Xcode Setup - Step by Step (With Screenshots Descriptions)

## Problem: "Next" Button Disabled

If you can't click **Next** in Xcode project creation, it's because **Team** is not selected.

### Solution: Add Your Apple ID

**Step 1: Add Apple ID to Xcode**
```
Xcode Menu Bar → Xcode → Preferences (or Settings)
→ Accounts Tab
→ Click the + button (bottom left)
→ Choose "Apple ID"
→ Sign in with your personal Apple ID
→ Click "Done"
```

**Step 2: Go Back to Project Creation**
```
File → New → Project
→ iOS → App → Next
→ Fill in:
   Product Name: FoodieShoppingList
   Team: [Select your Apple ID] ← This is now available!
   Organization Identifier: com.yourname.foodie
   Interface: SwiftUI
   Language: Swift
→ Next button is now enabled! ✅
```

---

## Complete Xcode Setup Process

### Part 1: Create iPhone Project

**Screen 1: Choose Template**
```
┌─────────────────────────────────────┐
│ Choose a template                   │
├─────────────────────────────────────┤
│ iOS    watchOS    tvOS    macOS     │
│                                     │
│ ┌─────┐  ┌─────┐  ┌─────┐         │
│ │ App │  │Game │  │ ... │         │
│ └─────┘  └─────┘  └─────┘         │
│   ↑                                 │
│  Click this one!                    │
└─────────────────────────────────────┘

Action: Click "App" → Click "Next"
```

**Screen 2: Project Options**
```
┌─────────────────────────────────────────────┐
│ Product Name:         FoodieShoppingList    │ ← Type this
│ Team:                 [Your Apple ID]       │ ← Select from dropdown
│ Organization ID:      com.yourname.foodie   │ ← Any text
│ Interface:            SwiftUI               │ ← Must be SwiftUI
│ Language:             Swift                 │ ← Must be Swift
│                                             │
│ ☐ Use Core Data                            │ ← Unchecked
│ ☐ Include Tests                            │ ← Unchecked
└─────────────────────────────────────────────┘

Action: Fill in all fields → Click "Next"
```

**Screen 3: Save Location**
```
Where: Choose Desktop or Documents
       (Easy to find later)

Recommended:
  Desktop/FoodieShoppingList/

Action: Choose location → Click "Create"
```

### Part 2: Organize Project Files

**Xcode opens, you see:**
```
FoodieShoppingList (folder)
├── FoodieShoppingListApp.swift
├── ContentView.swift          ← DELETE THIS
└── Assets.xcassets
```

**Step 1: Delete Default ContentView**
```
1. Right-click on "ContentView.swift"
2. Choose "Delete"
3. In dialog, choose "Move to Trash" (not just Remove Reference)
```

**Step 2: Create Folder Groups**
```
Right-click on "FoodieShoppingList" folder (blue icon):
→ New Group → Name: Models
→ New Group → Name: Services  
→ New Group → Name: Views
→ New Group → Name: Extensions

Result:
FoodieShoppingList (folder)
├── Models/            ← New!
├── Services/          ← New!
├── Views/             ← New!
├── Extensions/        ← New!
├── FoodieShoppingListApp.swift
└── Assets.xcassets
```

### Part 3: Copy Files (3 Methods)

#### Method A: Drag and Drop (Easiest!)

**Step 1: Open Finder**
```
Command + Space → Type "Finder" → Enter

Navigate to:
/Users/keithbarger/Projects/foodie-meal-planner-desktop/ios-apps/FoodieShoppingList/
```

**Step 2: Position Windows**
```
Arrange so you can see:
  - Finder window (with Swift files)
  - Xcode window (with your project)
  
Side by side like this:
┌─────────────┬─────────────┐
│   Finder    │    Xcode    │
│             │             │
│ Models/     │ Models/     │
│ Services/   │ Services/   │
│ Views/      │ Views/      │
│             │             │
└─────────────┴─────────────┘
```

**Step 3: Drag Files**
```
From Finder → To Xcode:

Models folder → Models group:
  - ShoppingItem.swift
  - Message.swift

Services folder → Services group:
  - ShoppingListStore.swift
  - ConnectionManager.swift
  - VoiceInputManager.swift

Views folder → Views group:
  - ContentView.swift
  - ShoppingItemRow.swift
  - AddItemView.swift
  - SettingsView.swift
  - SyncStatusBanner.swift

Extensions folder → Extensions group:
  - View+Extensions.swift

Root folder → Root FoodieShoppingList:
  - FoodieShoppingListApp.swift (will replace existing)
```

**Step 4: When Dialog Appears**
```
┌─────────────────────────────────────────┐
│ Choose options for adding these files:  │
├─────────────────────────────────────────┤
│ ☑ Copy items if needed       ← CHECK!  │
│ ○ Create groups               ← Select  │
│                                         │
│ Add to targets:                         │
│ ☑ FoodieShoppingList         ← CHECK!  │
│                                         │
│           [Cancel]  [Finish]            │
└─────────────────────────────────────────┘

Action: 
1. ✅ Check "Copy items if needed"
2. ✅ Make sure "FoodieShoppingList" target is checked
3. Click "Finish"
```

#### Method B: Terminal Script

```bash
# From your project directory
./copy-iphone-files.sh ~/Desktop/FoodieShoppingList/FoodieShoppingList.xcodeproj

# Then in Xcode:
# Right-click FoodieShoppingList folder
# → "Add Files to FoodieShoppingList..."
# → Select all folders (Models, Services, Views, Extensions)
# → Check "Copy items if needed"
# → Add
```

#### Method C: Menu Add Files

```
In Xcode:
File → Add Files to "FoodieShoppingList"
→ Navigate to: ios-apps/FoodieShoppingList/Models/
→ Select both .swift files
→ Check "Copy items if needed"
→ Add

Repeat for Services, Views, Extensions folders
```

---

## Part 4: Add Privacy Permissions

**Step 1: Click Project**
```
In left sidebar, click the blue "FoodieShoppingList" icon
(The very top one, with blue app icon)
```

**Step 2: Select Target**
```
Under "TARGETS" (not PROJECTS!):
→ Click "FoodieShoppingList"
```

**Step 3: Info Tab**
```
Top tabs: General | Signing | ... | Info
→ Click "Info"
```

**Step 4: Add Keys**
```
Find section: "Custom iOS Target Properties"

Click the + button next to it

Add first key:
  Key:   Privacy - Speech Recognition Usage Description
  Type:  String
  Value: Foodie needs speech recognition to add items by voice

Click + again, add second key:
  Key:   Privacy - Microphone Usage Description
  Type:  String  
  Value: Foodie needs microphone access for voice input
```

**Visual:**
```
Custom iOS Target Properties
├─ Bundle Identifier: com.yourname.foodie.FoodieShoppingList
├─ Bundle Name: $(PRODUCT_NAME)
├─ Privacy - Speech Recognition Usage Description: Foodie needs...
└─ Privacy - Microphone Usage Description: Foodie needs...
```

---

## Part 5: Build and Run

**Step 1: Connect iPhone**
```
Connect iPhone to Mac with USB cable

iPhone may show: "Trust This Computer?"
→ Tap "Trust"
→ Enter iPhone passcode
```

**Step 2: Select Device**
```
In Xcode toolbar (top):

┌────────────────────────────────────────┐
│ ▶ FoodieShoppingList  │  iPhone 13    │
│                       ↑                │
│                  Click here            │
└────────────────────────────────────────┘

Dropdown shows:
  Keith's iPhone        ← Select your connected iPhone
  iOS Simulators
  Add Additional Simulators...
```

**Step 3: First Build (Trust Certificate)**
```
Click ▶ (Play button) or press Command + R

You may see error:
"Signing for FoodieShoppingList requires a development team"

Solution:
  Signing & Capabilities tab
  → Team: Select your Apple ID
  → Xcode auto-creates certificate
```

**Step 4: Trust on iPhone**
```
First time only:

On iPhone:
  Settings → General → VPN & Device Management
  → Developer App
  → Tap your email
  → Tap "Trust [Your Email]"
  → Tap "Trust" again in popup
```

**Step 5: Run Again**
```
In Xcode: Click ▶ again

Watch build progress:
┌────────────────────────────────┐
│ Building FoodieShoppingList... │
│ ████████░░░░░░░░ 50%          │
└────────────────────────────────┘

Success:
┌────────────────────────────────┐
│ Build Succeeded                │
│ Running FoodieShoppingList...  │
└────────────────────────────────┘

App launches on your iPhone! 🎉
```

---

## Part 6: Configure App

**On iPhone:**
```
1. App opens (empty state)
2. Tap Settings (⚙️ icon)
3. Enter Server Address:
   ws://192.168.2.115:8080
   (Use YOUR Mac's IP - get from desktop app)
4. Tap "Save & Connect"
5. See green "Connected" ✅
```

**On Desktop:**
```
1. Launch Foodie app
2. Click 📱 button (bottom right)
3. See "1 device connected"
4. Try "Send Shopping List to iPhone"
```

---

## Troubleshooting

### "Next" Still Disabled

**Cause:** Missing required field

**Check:**
- Product Name filled in? ✓
- Team selected? ✓
- Organization Identifier filled? ✓
- Interface = SwiftUI? ✓
- Language = Swift? ✓

### "No Team Available"

**Solution:**
```
Xcode → Preferences → Accounts
→ Click +
→ Apple ID
→ Sign in
→ Close preferences
→ Retry project creation
```

### "Build Failed"

**Solution:**
```
Product → Clean Build Folder (Shift+Cmd+K)
Product → Build (Cmd+B)
Check errors in red in left panel
```

### "Device Not Found"

**Solution:**
```
1. Unplug and replug iPhone
2. Unlock iPhone
3. Trust computer again
4. Window → Devices and Simulators
   → Check iPhone appears
```

---

## Quick Checklist

Creating iPhone App:
- [ ] Xcode → New Project → iOS → App
- [ ] Team: Select your Apple ID
- [ ] Product Name: FoodieShoppingList
- [ ] Interface: SwiftUI, Language: Swift
- [ ] Click Next → Choose location → Create
- [ ] Delete default ContentView.swift
- [ ] Create groups: Models, Services, Views, Extensions
- [ ] Drag all .swift files from Finder
- [ ] Check "Copy items if needed" when adding
- [ ] Add privacy keys in Info tab
- [ ] Connect iPhone
- [ ] Select iPhone in device menu
- [ ] Click ▶ to build and run
- [ ] Trust developer on iPhone
- [ ] Configure server IP in app Settings

**Time estimate: 15 minutes**

---

## Next: iPad App

Same process, but:
- Product Name: **FoodieKitchen**
- General tab → Supported Destinations: **iPad only**
- Orientations: **Landscape Left + Right only**
- Copy files from: `ios-apps/FoodieKitchen/`

Use: `./copy-ipad-files.sh` script if preferred

---

**Need help?** See `XCODE_VISUAL_WALKTHROUGH.md` for more details!
