# Foodie Shopping List - iPhone Companion App

## Features

### Must-Have Features (Implemented)
- ✅ Offline storage with sync back to desktop
- ✅ Check off items with haptic feedback
- ✅ Progress tracking (X of Y items)
- ✅ Group by category
- ✅ Dark mode support
- ✅ Large tap targets for easy shopping
- ✅ Keep screen awake while shopping
- ✅ Sort by category/aisle
- ✅ Voice-over accessibility
- ✅ Voice input for adding items
- ✅ Manual quick-add items while shopping
- ✅ Auto-sync when returning home + manual sync button
- ✅ Sync status notifications

## Setup Instructions

### 1. Create New Xcode Project
1. Open Xcode
2. File → New → Project
3. iOS → App
4. Product Name: `FoodieShoppingList`
5. Interface: SwiftUI
6. Language: Swift
7. Click Next and save

### 2. Enable Required Capabilities
1. Select project in navigator
2. Select target → Signing & Capabilities
3. Add capability: **Speech Recognition** (for voice input)
4. Add capability: **Background Modes** → Enable "Audio, AirPlay, and Picture in Picture" (for voice recognition)

### 3. Update Info.plist
Add these keys:
- `NSSpeechRecognitionUsageDescription`: "We use speech recognition to let you add items to your shopping list hands-free"
- `NSMicrophoneUsageDescription`: "We use the microphone for voice input when adding shopping items"

### 4. Add Files
Copy all `.swift` files from this directory to your Xcode project.

### 5. File Structure
```
FoodieShoppingList/
├── FoodieShoppingListApp.swift          (Main app entry)
├── Models/
│   ├── ShoppingItem.swift               (Data model)
│   └── Message.swift                    (WebSocket message)
├── Services/
│   ├── ConnectionManager.swift          (WebSocket + sync)
│   ├── ShoppingListStore.swift          (Persistence)
│   └── VoiceInputManager.swift          (Speech recognition)
├── Views/
│   ├── ContentView.swift                (Main view)
│   ├── ShoppingItemRow.swift            (List item)
│   ├── SettingsView.swift               (Connection settings)
│   ├── AddItemView.swift                (Quick-add sheet)
│   └── SyncStatusBanner.swift           (Sync notifications)
└── Extensions/
    └── View+Extensions.swift            (Helper extensions)
```

### 6. Build and Run
1. Connect iPhone or select simulator
2. Click Run (⌘R)
3. Grant microphone/speech permissions when prompted

## Usage

### First Time Setup
1. Launch app
2. Tap Settings (gear icon)
3. Enter desktop server address (shown in desktop app)
   - Example: `ws://192.168.1.100:8080`
4. Tap "Save & Connect"

### At Home
1. Desktop app sends shopping list
2. iPhone receives and saves offline
3. "List updated" banner appears

### At Grocery Store (Offline)
1. Open app - list loads from local storage
2. Tap items to check off (haptic feedback)
3. Progress bar shows completion
4. Add forgotten items:
   - Tap + button
   - Type or use microphone for voice input
   - Item saved locally

### Back Home (Auto-Sync)
1. App detects WiFi connection to desktop
2. Automatically syncs checked items
3. "Auto-sync successful" banner appears
4. Or tap sync button for manual sync

## Features Detail

### Voice Input
- Tap microphone button when adding items
- Say item name: "Milk", "Two pounds of chicken"
- Automatically parsed into quantity + name
- Works offline after initial permission

### Progress Tracking
- Visual progress bar at top
- "5 of 12 items" counter
- Percentage complete

### Category Grouping
- Items grouped by category (Produce, Dairy, etc.)
- Collapse/expand sections
- Quick navigation

### Dark Mode
- Automatically follows iOS system setting
- OLED-optimized for battery saving
- High contrast for store visibility

### Accessibility
- VoiceOver support
- Dynamic type (scales with iOS text size)
- High contrast mode support
- Haptic feedback for actions

## Testing

### Test Connection
1. Start desktop app
2. Note WebSocket address in companion panel
3. Launch iPhone app
4. Enter address in settings
5. Should show "Connected" with green dot

### Test Offline
1. Receive list from desktop
2. Enable Airplane Mode
3. List should still be visible
4. Check off items
5. Disable Airplane Mode
6. Should auto-sync

### Test Voice Input
1. Tap + button
2. Tap microphone
3. Say "Bananas"
4. Should appear in text field
5. Tap Add

## Troubleshooting

### "Not Connected"
- Ensure iPhone and desktop on same WiFi
- Check firewall isn't blocking port 8080
- Verify server address is correct
- Try manual reconnect

### Voice Input Not Working
- Check microphone permission in Settings → Privacy
- Check speech recognition permission
- Ensure device not muted
- Try restarting app

### Items Not Syncing
- Check connection status (green dot = connected)
- Tap manual sync button
- Check desktop app is running
- Verify network connection

## Code Architecture

### Data Flow
```
Desktop → WebSocket → ConnectionManager → ShoppingListStore → UserDefaults
                                              ↓
                                         ContentView
                                              ↓
                                      ShoppingItemRow
```

### Sync Flow
```
Local Changes → ShoppingListStore.pendingChanges
                        ↓
                ConnectionManager.syncPurchasedItems()
                        ↓
                WebSocket → Desktop
                        ↓
                Confirmation → Clear pendingChanges
```

## Development Notes

- Minimum iOS version: 16.0
- Requires WiFi for initial sync
- Local storage limit: ~1MB (thousands of items)
- WebSocket timeout: 30 seconds
- Auto-reconnect: Enabled with exponential backoff
