# iOS Apps Build Checklist

**Your Server IP: 192.168.2.115** ← Use this in both apps!

---

## iPhone Shopping List App

### Setup
- [ ] Open Xcode (Command+Space → "Xcode")
- [ ] Create new iOS App project
- [ ] Name: `FoodieShoppingList`
- [ ] Interface: SwiftUI, Language: Swift
- [ ] Save in: `ios-apps/` folder

### File Organization
- [ ] Delete default ContentView.swift
- [ ] Create folder: Models
- [ ] Create folder: Services
- [ ] Create folder: Views
- [ ] Create folder: Extensions

### Add Files (12 files)
- [ ] Models/ShoppingItem.swift
- [ ] Models/Message.swift
- [ ] Services/ShoppingListStore.swift
- [ ] Services/ConnectionManager.swift
- [ ] Services/VoiceInputManager.swift
- [ ] Views/ContentView.swift
- [ ] Views/ShoppingItemRow.swift
- [ ] Views/AddItemView.swift
- [ ] Views/SettingsView.swift
- [ ] Extensions/View+Extensions.swift
- [ ] FoodieShoppingListApp.swift (root, replace existing)

### Permissions
- [ ] Add: Privacy - Speech Recognition Usage Description
- [ ] Add: Privacy - Microphone Usage Description

### Build
- [ ] Connect iPhone via USB
- [ ] Select iPhone in device menu
- [ ] Click Run ▶ (Command+R)
- [ ] Trust developer on iPhone
- [ ] App launches successfully

### Configure
- [ ] Open app → Settings
- [ ] Enter IP: 192.168.2.115
- [ ] Tap Connect
- [ ] See green "Connected" status

---

## iPad Kitchen App

### Setup
- [ ] Close iPhone project
- [ ] File → New → Project
- [ ] Name: `FoodieKitchen`
- [ ] Interface: SwiftUI, Language: Swift
- [ ] Save in: `ios-apps/` folder

### iPad-Specific Settings
- [ ] General tab → Supported Destinations → iPad only
- [ ] Orientations → Landscape Left + Right only (uncheck Portrait)

### File Organization
- [ ] Delete default ContentView.swift
- [ ] Create folder: Models
- [ ] Create folder: Services
- [ ] Create folder: Views
- [ ] Create folder: Extensions

### Add Files (15 files)
- [ ] Models/Recipe.swift
- [ ] Models/TimerItem.swift
- [ ] Models/Message.swift
- [ ] Services/ConnectionManager.swift
- [ ] Services/RecipeStore.swift
- [ ] Services/TimerManager.swift
- [ ] Services/VoiceCommandManager.swift
- [ ] Views/ContentView.swift
- [ ] Views/IngredientListView.swift
- [ ] Views/InstructionsView.swift
- [ ] Views/TimerBar.swift
- [ ] Views/SettingsView.swift
- [ ] Views/VoiceCommandButton.swift
- [ ] Extensions/View+Extensions.swift
- [ ] FoodieKitchenApp.swift (root, replace existing)

### Permissions
- [ ] Add: Privacy - Speech Recognition Usage Description
- [ ] Add: Privacy - Microphone Usage Description

### Build
- [ ] Connect iPad via USB
- [ ] Select iPad in device menu
- [ ] Click Run ▶
- [ ] Trust developer on iPad
- [ ] App launches in landscape

### Configure
- [ ] Open app → Settings
- [ ] Enter IP: 192.168.2.115
- [ ] Tap Connect
- [ ] See green "Connected" status

---

## Desktop App

### Verify
- [ ] Launch Foodie desktop app
- [ ] See 📱 button (bottom right)
- [ ] Click button → panel opens
- [ ] See "Server ready" message

---

## Testing

### Shopping List
- [ ] Desktop: Add items to shopping list
- [ ] Desktop: Click 📱 → "Send Shopping List to iPhone"
- [ ] iPhone: Items appear
- [ ] iPhone: Check off items (haptic feedback)
- [ ] iPhone: Add "Milk" manually
- [ ] iPhone: Tap sync button
- [ ] Desktop: "Milk" appears

### Recipe Cooking
- [ ] Desktop: Add recipe to today's plan
- [ ] Desktop: Click 📱 → "Send Today's Meals to iPad"
- [ ] iPad: Recipe list appears
- [ ] iPad: Tap recipe → split screen
- [ ] iPad: See ingredients (left) + instructions (right)
- [ ] iPad: Tap mic → say "Next step"
- [ ] iPad: Say "Set timer 5 minutes"
- [ ] iPad: Timer appears in bottom bar

---

## Troubleshooting

### Build Errors
- [ ] Product → Clean Build Folder
- [ ] Check all files are added to target
- [ ] Verify no syntax errors

### Connection Issues
- [ ] Both devices on WiFi: (check network name matches)
- [ ] IP correct: 192.168.2.115
- [ ] Desktop app running
- [ ] Firewall allows port 8080

### Voice Not Working
- [ ] Settings → Privacy → Speech Recognition → Enable
- [ ] Settings → Privacy → Microphone → Enable

---

**Estimated Time:**
- iPhone app: 15 minutes
- iPad app: 15 minutes  
- Testing: 10 minutes
- **Total: 40 minutes**

**Detailed Help:** `XCODE_VISUAL_WALKTHROUGH.md`
