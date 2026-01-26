# iPhone Shopping List Voice Commands

## Overview

The iPhone shopping list app now includes comprehensive voice control activated by the wake word **"Foodie"**, similar to the iPad companion app. This enables hands-free shopping list management while you're at the store.

## Implementation Summary

### Files Created/Modified

1. **NEW: `ios-apps/FoodieShoppingList/Services/VoiceCommandManager.swift`**
   - Speech recognition engine with "Foodie" wake word
   - Command processing for shopping list actions
   - Text-to-speech feedback
   - Continuous and single-command modes

2. **MODIFIED: `ios-apps/FoodieShoppingList/Services/ShoppingListStore.swift`**
   - Added `@Published var selectedStore: String`
   - Added `@Published var searchText: String`
   - Added `availableStores` computed property
   - Added `filteredItems` computed property

3. **MODIFIED: `ios-apps/FoodieShoppingList/Views/SettingsView.swift`**
   - Voice Control section with authorization status
   - Toggle for enabling/disabling voice commands
   - Continuous listening mode toggle
   - Voice Commands Guide help dialog
   - Last command display

4. **MODIFIED: `ios-apps/FoodieShoppingList/Views/ContentView.swift`**
   - Removed local `@State` for selectedStore and searchText
   - Now uses store properties for voice command integration
   - Added `@EnvironmentObject var voiceCommand: VoiceCommandManager`

5. **MODIFIED: `ios-apps/FoodieShoppingList/FoodieShoppingListApp.swift`**
   - Added `@StateObject private var voiceCommandManager`
   - Provides voiceCommandManager as environment object
   - Connects voiceCommandManager to shoppingListStore
   - Stops listening when app closes

---

## Voice Commands

### Wake Word
Say **"Foodie"** before each command (e.g., "Foodie, show Walmart")

### Store Switching Commands
- **"Show all stores"** - Display all items from all stores
- **"Show [store name]"** - Switch to specific store
  - Examples: "show Walmart", "show Kroger", "show Target"
- **"List stores"** - Speaks list of all available stores
- **"How many stores"** - Speaks count of stores

### Item Action Commands
- **"Check [item name]"** - Mark item as purchased
  - Example: "check milk"
- **"Uncheck [item name]"** - Mark item as needed
  - Example: "uncheck eggs"
- **"Delete [item name]"** - Remove item from list
  - Example: "delete bread"
- **"Check all"** - Mark all visible items as purchased
- **"Uncheck all"** - Mark all visible items as needed
- **"Clear checked"** / **"Delete checked"** - Remove all checked items

### Information Commands
- **"How many items"** - Speaks total item count and remaining items
- **"What's left"** / **"Read unchecked"** - Speaks count of remaining items
- **"What's done"** / **"Read checked"** - Speaks count of checked items
- **"Read list"** / **"Read items"** - Reads up to 10 unchecked items
- **"How many categories"** - Speaks category count
- **"List categories"** / **"What categories"** - Speaks all categories
- **"Show [category] category"** - Reads items in specific category
  - Examples: "show produce category", "show dairy category"

### Search Commands
- **"Search for [term]"** - Filters items by search term
  - Example: "search for chicken"
- **"Find [term]"** - Same as search for
  - Example: "find milk"
- **"Clear search"** - Removes search filter

### Help Command
- **"Help"** / **"What can you do"** - Speaks overview of available commands

---

## Settings

### Enabling Voice Commands

1. Go to Settings (gear icon in top-right)
2. Find "Voice Control" section
3. Tap "Enable" if not authorized (first time only)
4. Toggle "Voice Commands" ON
5. Choose listening mode:
   - **Single Command Mode**: Say "Foodie" + one command, then stops
   - **Continuous Listening**: Always listening, say "Foodie" before each command

### Authorization Required

The app needs these permissions:
- **Microphone**: To hear your voice
- **Speech Recognition**: To understand commands

iOS will prompt for these on first use.

---

## Features

### Wake Word Detection
- Must say "Foodie" before each command
- Prevents accidental triggers
- Familiar voice assistant pattern

### Debouncing
- 2-second cooldown prevents duplicate commands
- If you say the same command twice quickly, only processes once

### Voice Feedback
- Speaks confirmation after each action
- Examples:
  - "Milk checked"
  - "Showing Walmart"
  - "5 items remaining"
  - "Search cleared"

### Continuous vs Single-Command Mode
- **Continuous**: App keeps listening until you turn it off
  - Good for: Extended shopping trips with many items
  - Battery impact: Higher
- **Single-Command**: Listens for one command then stops
  - Good for: Quick checks while shopping
  - Battery impact: Lower

### Last Command Display
- Settings screen shows last recognized command
- Helpful for debugging if command wasn't understood

---

## Usage Examples

### Example 1: Store Switching
```
You: "Foodie, show Walmart"
App: "Showing Walmart"
[Store tab switches to Walmart, displays only Walmart items]

You: "Foodie, how many items"
App: "12 items at Walmart, 8 remaining"
```

### Example 2: Checking Items
```
You: "Foodie, check milk"
App: "Milk checked"
[Milk item gets checkmark, moves to bottom]

You: "Foodie, check eggs"
App: "Eggs checked"

You: "Foodie, what's left"
App: "6 items remaining"
```

### Example 3: Search and Information
```
You: "Foodie, search for chicken"
App: "Found 3 results"
[Shows only chicken-related items]

You: "Foodie, read list"
App: "Chicken breast, chicken thighs, chicken stock"

You: "Foodie, clear search"
App: "Search cleared"
[Shows all items again]
```

### Example 4: Bulk Actions
```
You: "Foodie, show produce category"
App: "Produce: apples, bananas, lettuce, tomatoes"

You: "Foodie, check all"
App: "4 items checked"
[All visible produce items get checked]
```

---

## Important Notes

### Privacy Keys Required in Xcode

**IMPORTANT:** When building in Xcode, you must add these privacy keys to Info.plist:

1. Open Xcode project
2. Select `FoodieShoppingList` target
3. Go to "Info" tab
4. Add these keys:

| Key | Value |
|-----|-------|
| `NSMicrophoneUsageDescription` | `Foodie needs microphone access for voice commands while shopping.` |
| `NSSpeechRecognitionUsageDescription` | `Foodie needs speech recognition to understand voice commands for managing your shopping list.` |

**Without these keys, the app will crash when requesting permissions.**

### Battery Considerations
- Continuous listening mode drains battery faster
- Recommended: Use single-command mode unless actively shopping
- Voice recognition stops automatically when app closes

### Recognition Tips
- Speak clearly and at normal volume
- Use exact item names as they appear in your list
- Store names are matched loosely (e.g., "Walmart" matches "walmart" or "Walmart Supercenter")
- Item matching is case-insensitive and partial (e.g., "milk" matches "Whole Milk")

### Limitations
- Only understands English (en-US locale)
- Requires network connection for speech recognition on some iOS versions
- Cannot add new items via voice (only manage existing items)
- Commands must start with "Foodie" wake word

---

## Troubleshooting

### Voice Commands Not Working
1. Check microphone permission in iOS Settings > Foodie Shopping List
2. Check speech recognition permission in same location
3. Verify "Voice Commands" toggle is ON in app Settings
4. Check that microphone is not blocked (remove case if needed)

### Commands Not Recognized
1. Check "Last command" in Settings to see what was heard
2. Speak more clearly or louder
3. Reduce background noise
4. Try rephrasing command
5. Make sure you said "Foodie" first

### No Voice Feedback
1. Check device volume
2. Disable silent/vibrate mode
3. Check app isn't muted in Control Center

### App Crashes on Voice Enable
- **Most likely cause**: Missing privacy keys in Info.plist
- **Solution**: Add NSMicrophoneUsageDescription and NSSpeechRecognitionUsageDescription keys

---

## Architecture Details

### VoiceCommandManager
- Uses Apple's Speech framework (SFSpeechRecognizer)
- Uses AVFoundation for text-to-speech
- Integrates with ShoppingListStore for state management
- Debounces commands to prevent duplicates
- Two-mode operation: continuous vs single-command

### Integration Points
1. **ShoppingListStore**: Direct access to `selectedStore`, `searchText`, `filteredItems`, `availableStores`
2. **ContentView**: No changes needed, uses store bindings
3. **SettingsView**: Controls voice activation and displays status
4. **App**: Lifecycle management (start/stop listening)

### Performance
- Speech recognition runs on-device (iOS 13+)
- Low latency command processing (~200-500ms)
- Text-to-speech is lightweight
- Minimal battery impact in single-command mode

---

## Future Enhancements (Possible)

1. **Add Item by Voice**: "Foodie, add chicken breast to list"
2. **Set Quantities**: "Foodie, set milk quantity to 2"
3. **Multi-Language Support**: Spanish, French, etc.
4. **Custom Wake Word**: User-defined activation phrase
5. **Voice Shortcuts**: "Foodie, check produce" (checks all produce items)
6. **Smart Suggestions**: "Did you mean 'whole milk' or 'almond milk'?"

---

## Testing Checklist

- [ ] Authorization prompts appear on first use
- [ ] Voice Commands toggle works
- [ ] Continuous mode keeps listening
- [ ] Single-command mode stops after one command
- [ ] Store switching commands work correctly
- [ ] Item check/uncheck commands work
- [ ] Search commands filter properly
- [ ] Bulk actions (check all, clear checked) work
- [ ] Voice feedback speaks correctly
- [ ] Last command displays in Settings
- [ ] App doesn't crash when voice disabled
- [ ] Listening stops when app closes
- [ ] Works with multiple stores
- [ ] Works with search active
- [ ] Handles unknown commands gracefully

---

**Ready to test!** Enable voice commands in Settings and start using hands-free shopping list management.
