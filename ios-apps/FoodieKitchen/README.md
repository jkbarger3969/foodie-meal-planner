# Foodie Kitchen - iPad Companion App

## Features

### Must-Have Features (Implemented)
- ✅ Hands-free mode with large buttons (tap with elbow/knuckle)
- ✅ Built-in timer integration with multiple timers
- ✅ Split-screen layout (ingredients + instructions)
- ✅ Recipe scaling (adjust servings)
- ✅ Step navigation with swipe gestures
- ✅ Progress tracking through recipe
- ✅ Keep screen awake while cooking
- ✅ Voice commands ("Next step", "Set timer", "Done")
- ✅ Ingredient checklist
- ✅ Dark mode support
- ✅ Large, readable text for kitchen use

## Setup Instructions

### 1. Create New Xcode Project
1. Open Xcode
2. File → New → Project
3. iOS → App
4. Product Name: `FoodieKitchen`
5. Interface: SwiftUI
6. Language: Swift
7. **Device:** iPad only
8. Click Next and save

### 2. Enable Required Capabilities
1. Select project in navigator
2. Select target → Signing & Capabilities
3. Add capability: **Speech Recognition** (for voice commands)
4. Add capability: **Background Modes** → Enable "Audio, AirPlay, and Picture in Picture"

### 3. Update Info.plist
Add these keys:
- `NSSpeechRecognitionUsageDescription`: "We use speech recognition for hands-free cooking commands"
- `NSMicrophoneUsageDescription`: "We use the microphone for voice commands while cooking"
- `UIRequiresFullScreen`: YES (iPad fullscreen)

### 4. Configure for iPad
1. Select target → General → Deployment Info
2. Supported Destinations: iPad only
3. Supported Orientations: Landscape Left, Landscape Right
4. Requires full screen: YES

### 5. File Structure
```
FoodieKitchen/
├── FoodieKitchenApp.swift              (Main app entry)
├── Models/
│   ├── Recipe.swift                     (Recipe data model)
│   ├── TimerItem.swift                  (Timer model)
│   └── Message.swift                    (WebSocket message)
├── Services/
│   ├── ConnectionManager.swift          (WebSocket + sync)
│   ├── RecipeStore.swift                (Persistence)
│   ├── TimerManager.swift               (Multiple timers)
│   └── VoiceCommandManager.swift        (Speech recognition)
├── Views/
│   ├── ContentView.swift                (Main view)
│   ├── RecipeDetailView.swift           (Cooking mode)
│   ├── IngredientListView.swift         (Left pane)
│   ├── InstructionsView.swift           (Right pane)
│   ├── TimerBar.swift                   (Active timers)
│   ├── SettingsView.swift               (Connection settings)
│   └── VoiceCommandButton.swift         (Microphone button)
└── Extensions/
    └── View+Extensions.swift            (Helper extensions)
```

## Usage

### First Time Setup
1. Launch app on iPad
2. Tap Settings (gear icon)
3. Enter desktop server address
   - Example: `ws://192.168.1.100:8080`
4. Tap "Save & Connect"

### Receiving Recipes
1. Desktop app sends recipe
2. iPad receives and displays in cooking mode
3. Ready to start cooking!

### Cooking Mode
1. **Left Side:** Ingredient checklist
   - Tap ingredients to check off as you add them
   - See quantities at a glance

2. **Right Side:** Step-by-step instructions
   - Large text for easy reading
   - One step at a time
   - Progress indicator

3. **Navigation:**
   - Swipe left/right to change steps
   - Tap "Next"/"Previous" buttons
   - Voice command: "Next step", "Previous step", "Done"

4. **Timers:**
   - Tap timer button in step
   - Or say "Set timer for 10 minutes"
   - Multiple timers run simultaneously
   - Shows remaining time for all timers

5. **Scaling:**
   - Tap serving count at top
   - Select new serving size
   - All quantities auto-adjust

### Voice Commands
- "Next step" - Move to next instruction
- "Previous step" - Go back one step
- "Set timer for [X] minutes" - Start timer
- "Done" - Mark current step complete
- "What's next" - Read next step aloud
- "Repeat" - Repeat current step

### Hands-Free Tips
- Use knuckle or elbow to tap buttons
- Voice commands work even with wet hands
- Screen stays awake automatically
- Large buttons (100pt) easy to hit

## Features Detail

### Split-Screen Layout
- **Ingredients (Left 40%):** Always visible, scrollable
- **Instructions (Right 60%):** Large, focused on current step
- **Proportions optimized for iPad landscape**

### Timer System
- **Multiple Timers:** Run unlimited timers simultaneously
- **Labels:** Each timer shows what it's for
- **Notifications:** Alert when timer finishes
- **Quick Access:** Timer bar at bottom shows all active timers
- **One-Tap:** Add timer from instruction step

### Recipe Scaling
- Original servings shown
- Tap to adjust (1-20 servings)
- All ingredient quantities recalculate instantly
- Fractional amounts handled properly (1½ cups, etc.)

### Voice Commands
- Wake word not required (always listening in cooking mode)
- Works offline after initial authorization
- Multiple languages supported
- Handles kitchen noise well

### Accessibility
- VoiceOver support
- Dynamic type
- High contrast mode
- Large tap targets (100pt minimum)
- Haptic feedback

## Testing

### Test Connection
1. Start desktop app
2. Note WebSocket address
3. Launch iPad app
4. Enter address in settings
5. Should show "Connected"

### Test Recipe Receive
1. In desktop, select a recipe
2. Click "Send Recipe to iPad"
3. iPad should immediately show recipe in cooking mode

### Test Voice Commands
1. In cooking mode, say "Next step"
2. Should advance to next instruction
3. Say "Set timer for 5 minutes"
4. Timer should appear in timer bar

### Test Timers
1. Tap timer button (🕐)
2. Select duration
3. Timer starts and shows in bottom bar
4. Test multiple timers simultaneously

### Test Scaling
1. Tap serving count
2. Change from 4 to 2
3. Verify all quantities halve correctly

## Troubleshooting

### Voice Commands Not Working
- Check microphone permission
- Check speech recognition permission
- Ensure not muted
- Speak clearly and pause between commands

### Screen Dims While Cooking
- Check "Keep Screen Awake" setting is on
- iPad auto-lock should be disabled while app is open

### Timers Not Alerting
- Check notification permissions
- Check volume is up
- Ensure app is in foreground

## Code Architecture

### Data Flow
```
Desktop → WebSocket → ConnectionManager → RecipeStore → ContentView
                                              ↓
                                         RecipeDetailView
                                        /               \
                              IngredientListView   InstructionsView
                                                          ↓
                                                      TimerManager
```

### Voice Command Flow
```
Microphone → VoiceCommandManager → Parse Command → Execute Action
                                                         ↓
                                            Update UI / Start Timer / Navigate
```

## Development Notes

- Minimum iOS version: 16.0
- iPad only (not iPhone compatible)
- Landscape orientation optimized
- Requires WiFi for initial sync
- Recipes stored locally for offline cooking
- Auto-reconnect on network changes

