# 🎉 Foodie Meal Planner - Ready for Testing

**Status**: All implementation complete ✅  
**Build Date**: January 19, 2026  
**Build Size**: 106 MB (DMG), 102 MB (ZIP)

---

## 📦 Installation Steps

### Desktop App (Both Macs)

1. **Install on Mac #1** (where you built the app):
   ```bash
   open "dist/Foodie Meal Planner-1.0.0-arm64.dmg"
   ```
   - Drag "Foodie Meal Planner" to Applications
   - Launch from Applications folder
   - If blocked by Gatekeeper: System Settings → Privacy & Security → "Open Anyway"

2. **Install on Mac #2** (your other Mac):
   - Copy `dist/Foodie Meal Planner-1.0.0-arm64.dmg` to Mac #2 via AirDrop/USB/cloud
   - Follow same installation steps as Mac #1

3. **Sync Database Between Macs**:
   - On Mac #1: In app menu → Export Data → Save to cloud folder
   - On Mac #2: In app menu → Import Data → Select exported file
   - Repeat whenever you want to sync data between machines

### iPhone App

1. **Open Xcode**:
   ```bash
   open ios-apps/FoodieShoppingList/FoodieShoppingList.xcodeproj
   ```

2. **Set Bundle ID** (if not already done):
   - Select project in navigator → Target "FoodieShoppingList" → General
   - Change Bundle Identifier to your unique ID: `com.yourname.foodieshoppinglist`

3. **Privacy Keys** (CRITICAL - app will crash without these):
   - Select `Info.plist` in Xcode
   - Add these keys if missing:
     - **Privacy - Speech Recognition Usage Description**: "Foodie uses speech recognition for hands-free item management while shopping"
     - **Privacy - Microphone Usage Description**: "Foodie needs microphone access for voice commands"

4. **Connect iPhone**:
   - Connect via USB
   - Select your iPhone from device dropdown (top toolbar)
   - Click ▶️ Run

5. **Trust Developer** (first install only):
   - Settings → General → VPN & Device Management → Trust "[Your Name]"

### iPad App

1. **Open Xcode**:
   ```bash
   open ios-apps/FoodieKitchen/FoodieKitchen.xcodeproj
   ```

2. **Set Bundle ID**:
   - Change to `com.yourname.foodiekitchen`

3. **Privacy Keys** (same as iPhone):
   - Add speech recognition and microphone usage descriptions to Info.plist

4. **Build & Run**:
   - Connect iPad via USB
   - Select iPad from device dropdown
   - Click ▶️ Run
   - Trust developer certificate on iPad

---

## 🧪 Testing Checklist

### Desktop App Features

#### Multi-Recipe Meal Planning
- [ ] Open meal planner (List View or Grid View)
- [ ] Click on a meal slot → verify recipe displays
- [ ] Add additional items (sides/desserts):
  - [ ] Click "Add Side/Dessert" button on any meal
  - [ ] Select recipe, choose item type (side/dessert/appetizer)
  - [ ] Verify item appears under main recipe
- [ ] Remove additional item → verify it disappears
- [ ] Switch to Grid View → verify badge shows "+2" for meals with additional items
- [ ] Click expand button (⌄) on grid meal → verify popover shows additional items

#### Google Calendar Sync
- [ ] Settings → Connect Google Calendar → complete OAuth flow
- [ ] Verify calendar events created for today's meals
- [ ] Add/remove meal plan item → verify calendar updates
- [ ] Check Google Calendar web interface → verify events appear

#### Shopping List
- [ ] Generate shopping list for date range → verify includes ingredients from:
  - [ ] Main meal recipes
  - [ ] Additional items (sides/desserts)
- [ ] Check items off → verify state persists
- [ ] Print shopping list → verify native print dialog works

#### Companion Server
- [ ] Desktop shows "Companion server started on port 8080" in DevTools console
- [ ] Note your Mac's IP address from startup logs (e.g., `ws://192.168.1.100:8080`)

### iPhone App Features

#### Connection
- [ ] Launch app → tap Settings (gear icon)
- [ ] Enter your Mac's WebSocket address: `ws://192.168.1.XXX:8080`
- [ ] Tap "Connect"
- [ ] Verify green checkmark appears
- [ ] Verify shopping list items appear (synced from desktop)

#### Store Tabs
- [ ] Verify store tabs appear at top (All Stores, Walmart, Kroger, etc.)
- [ ] Tap different store tabs → verify items filter correctly
- [ ] Items without a store appear in "All Stores" only

#### Voice Commands

**First-Time Setup**:
- [ ] App prompts for Speech Recognition permission → Allow
- [ ] App prompts for Microphone permission → Allow

**Add Item Voice Command** (NEW):
- [ ] Tap microphone icon in top-right (or say "Foodie, add...")
- [ ] Say: **"Foodie, add milk"** → verify "milk" appears in list (Dairy category)
- [ ] Say: **"Foodie, add apples to Walmart"** → verify appears with Walmart store tag
- [ ] Say: **"Foodie, add chicken"** → verify appears in Meat category
- [ ] Try edge cases:
  - [ ] "Foodie, add tomatoes" → Produce
  - [ ] "Foodie, add ice cream to Kroger" → Frozen, Kroger store
  - [ ] "Foodie, add random_item_xyz" → should default to Pantry

**Manage Items**:
- [ ] Say: **"Foodie, check off milk"** → verify item checked
- [ ] Say: **"Foodie, uncheck milk"** → verify unchecked
- [ ] Swipe item left → Delete → verify removed from list

#### Search & Filter
- [ ] Tap search bar, type "egg" → verify filters to egg items only
- [ ] Clear search → verify all items reappear

#### Sync
- [ ] Check off items on iPhone
- [ ] Open desktop app → verify items marked as purchased
- [ ] Add item on desktop → verify appears on iPhone within 30 seconds

### iPad App Features

#### Connection
- [ ] Launch app → Settings → enter Mac WebSocket address
- [ ] Connect → verify green status

#### Today's Meals Display
- [ ] Verify today's meals appear (Breakfast/Lunch/Dinner)
- [ ] Tap meal → verify recipe loads with ingredients
- [ ] If meal has additional items:
  - [ ] Verify DisclosureGroup shows "+2 additional items"
  - [ ] Tap to expand → verify sides/desserts listed
  - [ ] Tap additional item → verify loads that recipe

#### Voice Commands (NEW)

**First-Time Setup**:
- [ ] App prompts for Speech Recognition → Allow
- [ ] App prompts for Microphone → Allow

**Navigation**:
- [ ] Open a recipe with instructions
- [ ] Say: **"Foodie, next step"** → verify scrolls to next instruction
- [ ] Say: **"Foodie, previous step"** → verify scrolls back
- [ ] Say: **"Foodie, go to ingredients"** → verify shows ingredients tab
- [ ] Say: **"Foodie, go home"** → verify returns to meal list

**Timers**:
- [ ] Say: **"Foodie, start timer for 10 minutes"** → verify timer starts
- [ ] Say: **"Foodie, pause timer"** → verify pauses
- [ ] Say: **"Foodie, cancel timer"** → verify stops

**Reading**:
- [ ] Say: **"Foodie, read current step"** → verify speaks instruction aloud
- [ ] Say: **"Foodie, read ingredients"** → verify speaks ingredient list

**Meal Switching**:
- [ ] Say: **"Foodie, show lunch"** → verify switches to lunch recipe
- [ ] Say: **"Foodie, show dessert"** → verify loads dessert from additional items

**Settings**:
- [ ] Settings → Toggle "Continuous Listening Mode"
  - [ ] ON: App listens continuously, say "Foodie" before each command
  - [ ] OFF: Tap mic icon, say one command, auto-stops

---

## 🔧 Troubleshooting

### Desktop App Won't Open
- **Symptom**: Icon flickers but app doesn't launch
- **Fix**: 
  1. Open Console.app
  2. Filter for "Foodie"
  3. Look for error messages
  4. Check `~/Library/Application Support/Foodie Meal Planner/error.log`

### Missing Dependencies Error
- **Symptom**: Error about missing modules (googleapis, extend, etc.)
- **Status**: ✅ FIXED in current build (includes all node_modules)
- **If still occurs**: Rebuild with `./clean-build.sh`

### iOS App Build Errors
- **"Cannot find type 'VoiceCommandManager'"**:
  - In Xcode: Select `VoiceCommandManager.swift` → File Inspector → Target Membership → check "FoodieShoppingList"

- **Speech Recognition Not Working**:
  - Settings → Privacy → Speech Recognition → Enable for Foodie app
  - Settings → Privacy → Microphone → Enable for Foodie app

### WebSocket Connection Issues
- **iPhone shows "Disconnected"**:
  - Verify iPhone and Mac on same Wi-Fi network
  - Check Mac firewall settings (allow port 8080)
  - Restart desktop app (WebSocket server auto-starts)
  - Try Mac's IP address from System Settings → Network → Wi-Fi → Details

- **Items not syncing**:
  - Check desktop DevTools console for errors
  - Verify companion server running (look for "📱 Companion server started")
  - Disconnect/reconnect iPhone app

### Voice Commands Not Recognized
- **iPad doesn't respond to "Foodie"**:
  - Check microphone icon shows listening (should be active)
  - Speak clearly and wait 1 second after wake word
  - Try Settings → toggle Continuous Listening Mode

- **Permission Denied**:
  - iOS Settings → Privacy & Security → Speech Recognition → Enable for app
  - iOS Settings → Privacy & Security → Microphone → Enable for app

---

## 📂 Key Files Reference

### Desktop App
- **Main executable**: `/Applications/Foodie Meal Planner.app`
- **Database**: `~/Library/Application Support/Foodie Meal Planner/foodie.sqlite`
- **Logs**: `~/Library/Application Support/Foodie Meal Planner/error.log`
- **Settings**: `~/Library/Application Support/Foodie Meal Planner/foodie-settings.json`

### iOS Apps
- **iPhone source**: `ios-apps/FoodieShoppingList/`
- **iPad source**: `ios-apps/FoodieKitchen/`
- **Voice manager**: `Services/VoiceCommandManager.swift`
- **Connection**: `Services/ConnectionManager.swift`

### Documentation
- **Privacy keys setup**: `IPHONE_PRIVACY_KEYS_SETUP.md`
- **Voice commands reference**: `VOICE_COMMANDS_QUICK_REF.md`
- **Build troubleshooting**: `BUILD_FIX_GUIDE.md`
- **Database sync**: `SWITCHING_MACS_QUICK_REF.md`

---

## 🎯 What to Test First

**Quick Validation Path** (15 minutes):

1. **Desktop**: Install DMG → open app → verify meal planner loads
2. **Desktop**: Add a meal with a side dish → verify both appear
3. **iPhone**: Build in Xcode → connect to desktop → verify shopping list syncs
4. **iPhone**: Say "Foodie, add bread" → verify appears in list
5. **iPad**: Build in Xcode → connect → verify today's meals appear
6. **iPad**: Say "Foodie, next step" → verify navigation works

---

## 📝 Known Limitations

- **Voice commands**: English only (US locale)
- **Category detection**: Limited to ~50 food keywords (extensible)
- **Quantity parsing**: Voice "add 2 gallons milk" → quantity ignored (add manually)
- **Database sync**: Manual export/import between Macs (no auto-sync)
- **Companion server**: Mac must be on same network as iOS devices

---

## 🚀 Next Steps After Testing

If everything works:
1. Use desktop app daily to build meal plans
2. Sync to iOS devices while cooking/shopping
3. Report any bugs or feature requests

If issues found:
1. Check troubleshooting section above
2. Review error logs in `error.log`
3. Check DevTools console in desktop app (View → Toggle Developer Tools)

---

## 📚 Complete Feature List

### Desktop App
✅ Multi-recipe meal planning (main + sides/desserts)  
✅ Collections support  
✅ Google Calendar integration  
✅ Shopping list generation (includes additional items)  
✅ Recipe import/scraping  
✅ Print recipes & shopping lists  
✅ Companion WebSocket server (port 8080)  
✅ Database export/import for multi-Mac sync  
✅ List view & grid view  

### iPhone App
✅ WebSocket connection to desktop  
✅ Shopping list with auto-sync  
✅ Store tabs & filtering  
✅ Search functionality  
✅ Swipe to delete  
✅ **Voice commands** (add item, check/uncheck)  
✅ Smart category detection (Produce, Dairy, Meat, etc.)  
✅ Optional store assignment via voice  

### iPad App
✅ WebSocket connection to desktop  
✅ Today's meals display  
✅ Additional items with DisclosureGroups  
✅ Recipe viewing with ingredients  
✅ **Voice activation** with "Foodie" wake word  
✅ **11+ voice commands**:
  - Navigation (next/previous step, go home, go to ingredients)
  - Timers (start/pause/cancel)
  - Reading (read step, read ingredients)
  - Meal switching (show breakfast/lunch/dinner/dessert)  
✅ Single-trigger & continuous listening modes  

---

**Ready to test! 🎉**
