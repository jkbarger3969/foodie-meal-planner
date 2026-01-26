# FoodieKitchen (iPad) App - Complete Architecture Analysis

## Executive Summary

The FoodieKitchen iPad companion app is a **SwiftUI-based** cooking assistant that uses **MVVM architecture** with environment objects for state management. It communicates with the desktop app via **WebSocket**, supports **voice commands**, and provides a hands-free cooking experience optimized for iPad landscape orientation.

---

## 1. Architecture Pattern: MVVM + Environment Objects

### Core Pattern
- **Model:** Data structures (Recipe, Ingredient, TimerItem, MealSlot, Message)
- **View:** SwiftUI views (ContentView, IngredientListView, InstructionsView, etc.)
- **ViewModel:** Observable services (ConnectionManager, RecipeStore, TimerManager, VoiceCommandManager)

### State Management
- Uses `@StateObject` in root app for service initialization
- Uses `@EnvironmentObject` for dependency injection throughout view hierarchy
- All managers conform to `ObservableObject` protocol
- State changes trigger automatic UI updates via `@Published` properties

---

## 2. Data Models

### Recipe Model (`Models/Recipe.swift`)
```swift
struct Recipe: Identifiable, Codable, Equatable {
    let id: String              // RecipeId from desktop
    var title: String
    var mealType: String        // breakfast, lunch, dinner, etc.
    var cuisine: String
    var instructions: String    // Newline-separated steps
    var notes: String
    var url: String?
    var servings: Int
    var ingredients: [Ingredient]
    let receivedAt: Date
    var currentScale: Double    // For recipe scaling (1.0 = original)
}
```

**Key Features:**
- Scaling support with `scaledIngredients()` method
- Parses from desktop API format (capitalized keys: "RecipeId", "Title", etc.)
- Stores original servings and allows dynamic scaling

### Ingredient Model
```swift
struct Ingredient: Identifiable, Codable, Equatable {
    let id: String              // IngredientId
    var name: String            // IngredientName
    var quantity: String        // QtyText
    var unit: String            // Unit
    var category: String        // Category
    var isChecked: Bool         // Local state for checklist
    private var numericQuantity: Double?
}
```

**Key Features:**
- Fraction parsing (½, ⅓, ¼, etc.) for display
- Scaling logic that converts fractions to numeric values
- Format quantities back to human-readable fractions
- Category-based grouping capability

### MealSlot Model (Phase 4.5.7 - Multi-User Meals)
```swift
struct MealSlot: Identifiable, Codable, Equatable {
    let id: String              // "{slot}-{recipeId}"
    let slot: String            // "breakfast", "lunch", "dinner"
    let recipeId: String
    let title: String
    var additionalItems: [AdditionalItem]  // Sides, desserts, etc.
    var assignedUsers: [AssignedUser]      // Who meal is for
}
```

**Key Features:**
- Supports additional items (sides, desserts, appetizers, beverages)
- Multi-user meal assignments with avatar emojis
- Hierarchical meal structure (main dish + additional items)

### AdditionalItem Model
```swift
struct AdditionalItem: Identifiable, Codable, Equatable {
    let id: String
    let recipeId: String
    let title: String
    let itemType: String  // "side", "dessert", "appetizer", "beverage"
}
```

### AssignedUser Model (Phase 4.5.7)
```swift
struct AssignedUser: Identifiable, Codable, Equatable {
    let id: String
    let userId: String
    let name: String
    let avatarEmoji: String
    let email: String?
}
```

### TimerItem Model
```swift
struct TimerItem: Identifiable, Equatable {
    let id: UUID
    var label: String
    var duration: TimeInterval
    var remaining: TimeInterval
    var isRunning: Bool
    var isPaused: Bool
}
```

**Key Features:**
- Progress calculation: `1.0 - (remaining / duration)`
- Formatted time display with hours:minutes:seconds
- Not persisted (ephemeral cooking session data)

### Message Model (WebSocket Protocol)
```swift
struct Message {
    let type: String            // Message type identifier
    let data: [String: Any]?    // Optional payload
}
```

**Serialization:**
- `toJSON()` → Data for sending
- `from(Data)` → Message for receiving
- `getRawJSON(Data)` → Special parser for meal_plan messages

---

## 3. Services & Managers

### ConnectionManager (`Services/ConnectionManager.swift`)

**Purpose:** WebSocket connection to desktop app

**Published Properties:**
- `isConnected: Bool` - Connection state
- `connectionStatus: ConnectionStatus` - Detailed status (.connected, .connecting, .disconnected, .error)
- `serverAddress: String` - Desktop IP address (e.g., "192.168.1.100")

**Key Features:**
1. **Auto-Reconnect Logic:**
   - Max 5 reconnect attempts
   - Exponential backoff (min 2s, max 10s)
   - Network path monitoring via `NWPathMonitor`
   - Rate limiting (minimum 5s between attempts)

2. **Connection Flow:**
   - URL: `ws://{serverAddress}:8080`
   - Custom headers: `X-Device-Id` (iPad UUID), `X-Device-Type` ("iPad")
   - 10-second connection timeout
   - Auto-ping every 30 seconds to keep alive

3. **Message Handling:**
   - `connected` → Set isConnected = true
   - `recipe` → Single recipe display
   - `todays_meals` → Array of recipes (old format)
   - `meal_plan` → MealSlots with additional items (new format)
   - `pong` → Keep-alive response

4. **Error Handling:**
   - Connection timeout detection
   - Failed connection prevents infinite retry
   - Graceful disconnect on network loss

**Hardcoded Values:**
- WebSocket port: `8080`
- Ping interval: `30 seconds`
- Max reconnect attempts: `5`
- Min retry interval: `5.0 seconds`
- Connection timeout: `10 seconds`

### RecipeStore (`Services/RecipeStore.swift`)

**Purpose:** Recipe state management and persistence

**Published Properties:**
- `currentRecipe: Recipe?` - Active recipe being cooked
- `availableRecipes: [Recipe]` - Today's meals (old format)
- `availableMealSlots: [MealSlot]` - Today's meals with additional items (new format)
- `currentInstructionStep: Int` - Current cooking step (0-based)
- `checkedIngredients: Set<String>` - Ingredient IDs that are checked off
- `shouldShowMealList: Bool` - Trigger for voice "go home" command

**Key Features:**
1. **Local Persistence:**
   - Uses `UserDefaults` for storage
   - Saves current recipe, checked ingredients, and cooking progress
   - Separate keys for recipes vs meal slots
   - Auto-restores on app launch

2. **Recipe Loading:**
   - `setCurrentRecipe()` → Display single recipe
   - `setAvailableRecipes()` → Store today's meals list
   - `setAvailableMealSlots()` → Store meal plan with additional items
   - `loadRecipeById()` → Send request to desktop to load specific recipe

3. **Cooking State:**
   - `nextStep()` / `previousStep()` → Navigate instructions
   - `toggleIngredientChecked()` → Check/uncheck ingredients
   - `scaleRecipe(by: Double)` → Adjust serving size
   - `goHome()` → Return to meal list (voice command support)

4. **Instruction Parsing:**
   - Splits `instructions` string by `\n`
   - Filters out empty lines
   - Returns array of step strings

**Storage Keys:**
- `FoodieKitchen_CurrentRecipe` - Active recipe
- `FoodieKitchen_CurrentRecipe_state` - Step + checked ingredients
- `FoodieKitchen_AvailableRecipes` - Recipe list (old)
- `FoodieKitchen_AvailableMealSlots` - Meal slots (new)

### TimerManager (`Services/TimerManager.swift`)

**Purpose:** Multiple cooking timer management

**Published Properties:**
- `timers: [TimerItem]` - All active timers

**Key Features:**
1. **Timer Lifecycle:**
   - `addTimer()` → Create and auto-start timer
   - `startTimer()` → Resume paused timer
   - `pauseTimer()` → Pause running timer
   - `removeTimer()` → Delete specific timer
   - `removeAllTimers()` → Clear all timers

2. **Update Loop:**
   - 1-second interval timer using `Timer.scheduledTimer`
   - Decrements `remaining` for running timers
   - Detects completion (remaining <= 0)
   - Triggers haptic feedback on completion

3. **Notifications:**
   - Requests notification permission on init
   - Schedules local notifications when timer completes
   - Notification title: "Timer Complete"
   - Notification body: Timer label

4. **Completion Handling:**
   - `UINotificationFeedbackGenerator` for haptic feedback
   - Timer stops but remains in list (user must dismiss)
   - Sound plays via system notification

**Hardcoded Values:**
- Update interval: `1.0 second`
- Notification trigger: `0.1 second` (immediate)

### VoiceCommandManager (`Services/VoiceCommandManager.swift`)

**Purpose:** Speech recognition and voice command processing

**Published Properties:**
- `isListening: Bool` - Currently listening for speech
- `isWaitingForCommand: Bool` - Wake word detected, awaiting command
- `voiceEnabled: Bool` - Master toggle for always-on listening
- `lastCommand: String` - Last executed command
- `lastRecognizedText: String` - Raw speech recognition output
- `isAuthorized: Bool` - Speech recognition permission status

**Key Features:**
1. **Wake Word Detection:**
   - Two-stage system: wake word → command
   - Wake word: **"Foodie"** (case-insensitive)
   - After wake word, 5-second timeout for command
   - Provides audio feedback: "Listening"

2. **Command Processing:**
   - Navigation: "next step", "previous step", "go back", "go home"
   - Timers: "start timer", "set timer", "pause timer", "resume timer", "cancel timer"
   - Reading: "read current step", "read ingredients"
   - Meal switching: "show breakfast", "show lunch", "show dinner", "show dessert", "show side"

3. **Error Handling:**
   - Debouncing: Max 3 errors in 10 seconds
   - Auto-stops after error threshold
   - Prevents infinite restart loops
   - Error count resets after 10 seconds

4. **Audio Management:**
   - Audio session category: `.playAndRecord`
   - Mode: `.measurement`
   - Options: `.duckOthers`, `.defaultToSpeaker`
   - Stops engine before processing command (prevents echo)

5. **Speech Synthesis:**
   - Text-to-speech feedback for commands
   - Rate: 0.5 for instructions, 0.55 for feedback
   - Language: en-US
   - Volume: 1.0

**Supported Voice Commands:**
| Command | Action |
|---------|--------|
| "Foodie next step" | Advance to next instruction |
| "Foodie previous step" | Go back one step |
| "Foodie go home" | Return to meal list |
| "Foodie start timer for X minutes" | Create timer |
| "Foodie pause timer" | Pause first active timer |
| "Foodie resume timer" | Resume first paused timer |
| "Foodie cancel timer" | Remove first timer |
| "Foodie read current step" | Speak current instruction |
| "Foodie read ingredients" | Speak all ingredients |
| "Foodie show breakfast/lunch/dinner" | Load that meal |
| "Foodie show dessert/side" | Load additional item |

**Hardcoded Values:**
- Wake word: `"foodie"`
- Command timeout: `5.0 seconds`
- Max errors before stop: `3`
- Error reset interval: `10.0 seconds`
- Speech rate: `0.5` (instructions), `0.55` (feedback)
- Locale: `en-US`

---

## 4. View Hierarchy

### FoodieKitchenApp (Root)
```swift
@main
struct FoodieKitchenApp: App {
    @StateObject private var connectionManager = ConnectionManager()
    @StateObject private var recipeStore = RecipeStore()
    @StateObject private var timerManager = TimerManager()
    @StateObject private var voiceCommandManager = VoiceCommandManager()
}
```

**Initialization:**
- Creates all manager instances
- Injects via `.environmentObject()`
- Sets up manager dependencies (recipeStore.connection = connectionManager)
- Disables idle timer (keeps screen awake)
- Calls `connectionManager.attemptAutoConnect()` on appear

### ContentView (Main Navigation)

**Structure:**
- NavigationView wrapper
- Conditional display: home screen vs. cooking mode
- Sheet presentations: SettingsView, RecipeListView
- Toolbar with Home button, "Today's Meals" button, Settings button

**Home Screen (No Recipe):**
- App icon (fork.knife)
- App title
- Connection status message
- "Settings" or "View Today's Meals" button

**Cooking Mode (Recipe Loaded):**
- Split-screen layout:
  - Left 40%: IngredientListView
  - Right 60%: InstructionsView
- Bottom overlay: TimerBar (if timers active)
- Home button to exit cooking mode

**Data Flow:**
- Watches `recipeStore.shouldShowMealList` for voice "go home" trigger
- Updates UI when connection status changes
- Shows meal count in connection message

### RecipeListView (Meal Selection)

**Structure:**
- NavigationView with List
- Two display modes:
  1. **New format:** MealSlots with expandable additional items
  2. **Old format:** Flat recipe list

**MealSlot Display:**
- Grouped by meal slot (breakfast, lunch, dinner)
- Main dish button with:
  - Title
  - "Main Dish" label
  - Assigned users (Phase 4.5.7): avatars + names
- DisclosureGroup for additional items:
  - Shows count: "+ X additional item(s)"
  - Expandable list with item type badges

**User Interaction:**
- Tap recipe → Loads via `recipeStore.loadRecipeById()`
- Sends `load_recipe` message to desktop
- Dismisses sheet after selection
- "Done" button to close without selection

### IngredientListView (Left Pane)

**Structure:**
- Header: "Ingredients" + Scale button
- ScrollView with LazyVStack
- Each ingredient as IngredientRow

**Features:**
- Scale picker shows current percentage (e.g., "100%")
- Scale options: 0.5x, 1.0x, 1.5x, 2.0x, 3.0x
- Auto-calculates servings for each scale
- All ingredients re-render when scaled

**IngredientRow:**
- Checkmark button (circle → checkmark.circle.fill)
- Ingredient name (strikethrough when checked)
- Quantity + unit in caption text
- Haptic feedback on toggle
- Background: secondarySystemBackground

### InstructionsView (Right Pane)

**Structure:**
- Header: Recipe title + VoiceCommandButton
- ScrollViewReader for auto-scrolling
- LazyVStack of StepView items
- Bottom navigation buttons

**Step Display:**
- StepView shows:
  - Step number in circle (blue if current, gray otherwise)
  - Step text (larger if current)
  - Blue highlight background if current
- Auto-scrolls to current step with animation

**Navigation Buttons:**
- Previous button (disabled on step 0)
- Next/Finish button:
  - Shows "Next" on steps 0 to n-2
  - Shows "Finish" on last step
  - Finish calls `recipeStore.goHome()`
- Buttons are 100pt tall (large touch targets)

### SettingsView (Configuration)

**Sections:**

1. **Status Section:**
   - Connection indicator (green checkmark or red X)
   - "Connected" / "Not Connected" text

2. **Desktop Mac Section:**
   - Server IP address text field
   - Example: "192.168.1.100"
   - Help button with instructions
   - Explanation for switching between Macs

3. **Action Buttons:**
   - "Save & Connect" (primary)
   - "Disconnect" (destructive, if connected)

4. **Voice Control Section:**
   - Authorization status indicator
   - "Enable Voice Commands" toggle
   - Usage instructions when enabled
   - Real-time feedback:
     - "Listening for command..." indicator (red dot)
     - "Last heard:" text display
   - Wake word explanation

5. **About Section:**
   - App version: "1.0.0"
   - Device ID (first 8 chars of UUID)

**User Flows:**
- Save address → Auto-connect → Auto-dismiss after 2s if successful
- Toggle voice → Start/stop listening immediately
- Help alert shows multi-Mac instructions

### TimerBar (Bottom Overlay)

**Structure:**
- Header bar: Timer icon + "Active Timers" label (blue background)
- Horizontal ScrollView of TimerCard items
- Shadow for elevation

**TimerCard:**
- Timer label (truncated to 1 line)
- X button to remove
- Formatted time display (title2, bold)
- Red color if < 10 seconds remaining
- Progress bar (red if < 10s)
- 160pt fixed width
- Card background with shadow

### VoiceCommandButton (Microphone Toggle)

**Display:**
- Mic icon (filled when listening)
- "Listening..." text when active
- Red background when listening
- Blue background when idle

**Behavior:**
- Tap to toggle listening
- Visual feedback for listening state
- Embedded in InstructionsView header

---

## 5. WebSocket Communication Protocol

### Connection Details
- **URL Format:** `ws://{serverAddress}:8080`
- **Protocol:** WebSocket (RFC 6455)
- **Headers:**
  - `X-Device-Id`: iPad UUID (persistent per device)
  - `X-Device-Type`: "iPad" (identifies client type)

### Message Format
```json
{
  "type": "message_type",
  "data": {
    // Message-specific payload
  }
}
```

### Outbound Messages (iPad → Desktop)

#### 1. Ping (Keep-Alive)
```json
{
  "type": "ping"
}
```
- Sent every 30 seconds
- Desktop responds with "pong"

#### 2. Load Recipe Request
```json
{
  "type": "load_recipe",
  "data": {
    "recipeId": "recipe-uuid"
  }
}
```
- Triggers when user selects meal from list
- Desktop fetches full recipe and sends back

### Inbound Messages (Desktop → iPad)

#### 1. Connected Acknowledgment
```json
{
  "type": "connected"
}
```
- Sent immediately after WebSocket handshake
- Confirms successful connection

#### 2. Pong (Keep-Alive Response)
```json
{
  "type": "pong"
}
```
- Response to ping

#### 3. Single Recipe
```json
{
  "type": "recipe",
  "data": {
    "RecipeId": "uuid",
    "Title": "Recipe Name",
    "MealType": "dinner",
    "Cuisine": "Italian",
    "Instructions": "Step 1\nStep 2\nStep 3",
    "Notes": "Optional notes",
    "URL": "https://...",
    "Servings": 4,
    "ingredients": [
      {
        "IngredientId": "uuid",
        "IngredientName": "Flour",
        "QtyText": "2",
        "QtyNum": 2.0,
        "Unit": "cups",
        "Category": "Baking"
      }
    ]
  }
}
```
- Sent when desktop user clicks "Send to iPad"
- Immediately displays recipe in cooking mode

#### 4. Today's Meals (Old Format)
```json
{
  "type": "todays_meals",
  "data": {
    "recipes": [
      { /* Recipe object */ }
    ]
  }
}
```
- Sent on connection or when meal plan changes
- Shows in meal list

#### 5. Meal Plan (New Format - Phase 4.5.7)
```json
{
  "type": "meal_plan",
  "data": [
    {
      "slot": "breakfast",
      "recipeId": "main-recipe-uuid",
      "title": "Pancakes",
      "additionalItems": [
        {
          "recipeId": "side-recipe-uuid",
          "title": "Fruit Salad",
          "itemType": "side"
        }
      ],
      "assignedUsers": [
        {
          "userId": "user-uuid",
          "name": "John",
          "avatarEmoji": "👨",
          "email": "john@example.com"
        }
      ]
    }
  ]
}
```
- Sent when using multi-user meal planning
- Supports additional items and user assignments

### Data Mapping (Desktop → iPad)

**Desktop API (Capitalized):**
- `RecipeId` → `id`
- `Title` → `title`
- `MealType` → `mealType`
- `Cuisine` → `cuisine`
- `Instructions` → `instructions`
- `Notes` → `notes`
- `URL` → `url`
- `Servings` → `servings`
- `IngredientName` → `name`
- `QtyText` → `quantity`
- `QtyNum` → `numericQuantity`
- `Unit` → `unit`
- `Category` → `category`

**Special Parsing:**
- Instructions split by `\n` for step-by-step display
- QtyNum used for scaling calculations
- QtyText displayed to user (preserves fractions)

---

## 6. Voice Command Implementation

### Architecture Flow

```
User Speech → Microphone
              ↓
       AVAudioEngine
              ↓
    SFSpeechRecognizer
              ↓
     Recognition Task
              ↓
   VoiceCommandManager
              ↓
    Parse Command
         ↓          ↓
   RecipeStore  TimerManager
         ↓          ↓
      UI Updates
```

### Two-Stage Detection

**Stage 1: Wake Word Listening**
- Continuously listens for "Foodie"
- Low CPU usage (single recognition task)
- No action until wake word detected
- Shows nothing in UI

**Stage 2: Command Capture**
- Activated after "Foodie" detected
- 5-second window to speak command
- Visual indicator: "Listening for command..."
- Audio feedback: "Listening"
- Processes first non-wake-word phrase

### Command Parsing Logic

```swift
private func processCommand(_ command: String) {
    let normalized = command.lowercased().trimmingCharacters(in: .whitespaces)
    
    if normalized.contains("next step") || normalized == "next" {
        recipeStore?.nextStep()
        speakFeedback("Next step")
    }
    else if normalized.contains("set timer") {
        if let minutes = extractMinutes(from: normalized) {
            timerManager?.addTimer(label: "Voice Timer", duration: TimeInterval(minutes * 60))
            speakFeedback("Timer started for \(minutes) minute\(minutes == 1 ? "" : "s")")
        }
    }
    // ... more commands
}
```

### Timer Extraction
- Parses natural language: "5 minutes", "1 hour", "30 seconds"
- Converts hours → minutes, seconds → minutes
- Defaults to minutes if unit not specified
- Minimum 1 minute for seconds-based input

### Meal Navigation
- Searches `availableMealSlots` for matching slot name
- Loads recipe by ID via `loadRecipeById()`
- Supports: breakfast, lunch, dinner
- Supports additional items: dessert, side, appetizer, beverage

### Speech Synthesis
- Uses `AVSpeechSynthesizer`
- Confirmation feedback for all commands
- Reads instructions/ingredients on request
- Slower rate for cooking instructions (0.5x)

### Error Recovery
- Tracks error count and timing
- Resets count after 10 seconds of normal operation
- Disables voice after 3 errors in 10 seconds
- Provides user feedback: "Voice recognition stopped due to errors"
- User must toggle off/on to restart

---

## 7. Timer Functionality

### Multi-Timer System

**Data Structure:**
```swift
struct TimerItem {
    let id: UUID          // Unique identifier
    var label: String     // User-defined or "Voice Timer"
    var duration: TimeInterval
    var remaining: TimeInterval
    var isRunning: Bool
    var isPaused: Bool
}
```

### Timer Lifecycle

1. **Creation:**
   - Voice command: "set timer for X minutes"
   - Auto-starts immediately
   - No manual creation UI (voice-only for MVP)

2. **Running:**
   - 1-second update loop
   - Decrements `remaining` by 1.0
   - Updates progress bar
   - Continues until remaining <= 0

3. **Completion:**
   - Sets `isRunning = false`
   - Haptic feedback (UINotificationFeedbackGenerator)
   - Local notification with sound
   - Timer remains visible (must be manually dismissed)

4. **Removal:**
   - Tap X button on timer card
   - Voice command: "cancel timer" (removes first timer)
   - Cancels associated notification

### Visual Display

**TimerBar:**
- Appears at bottom when any timers exist
- Blue header bar: "Active Timers"
- Horizontal scrolling (supports unlimited timers)
- Cards show:
  - Label
  - Formatted time (H:MM:SS or M:SS)
  - Progress bar
  - Remove button

**Color Coding:**
- Normal: Blue progress bar
- Urgent (< 10s): Red text + red progress bar

**Formatting:**
```swift
var formattedTime: String {
    let hours = Int(remaining) / 3600
    let minutes = (Int(remaining) % 3600) / 60
    let seconds = Int(remaining) % 60
    
    if hours > 0 {
        return String(format: "%d:%02d:%02d", hours, minutes, seconds)
    } else {
        return String(format: "%d:%02d", minutes, seconds)
    }
}
```

### Notifications

**Permission Request:**
- On TimerManager init
- Options: `.alert`, `.sound`
- Falls back gracefully if denied

**Notification Content:**
- Title: "Timer Complete"
- Body: Timer label
- Sound: Default system sound
- Trigger: 0.1 second (immediate)

---

## 8. Current Features Summary

### Core Cooking Features
- ✅ Split-screen layout (40% ingredients, 60% instructions)
- ✅ Step-by-step navigation with auto-scroll
- ✅ Ingredient checklist with haptic feedback
- ✅ Recipe scaling (0.5x, 1.0x, 1.5x, 2.0x, 3.0x)
- ✅ Multiple simultaneous timers
- ✅ Voice commands (wake word + command)
- ✅ Hands-free mode (large 100pt buttons)
- ✅ Keep screen awake during cooking
- ✅ Dark mode support

### Connection Features
- ✅ WebSocket real-time sync with desktop
- ✅ Auto-reconnect with exponential backoff
- ✅ Network path monitoring
- ✅ Connection status indicators
- ✅ Multi-Mac support (switchable server address)

### Meal Planning Features (Phase 4.5.7)
- ✅ Today's meals list
- ✅ Meal slots (breakfast, lunch, dinner)
- ✅ Additional items (sides, desserts, appetizers, beverages)
- ✅ Multi-user meal assignments
- ✅ User avatars and names display
- ✅ Load any recipe from meal plan

### Persistence Features
- ✅ Current recipe saved locally
- ✅ Cooking progress persisted (step + checked ingredients)
- ✅ Available meals cached
- ✅ Server address saved
- ✅ Survives app restart

### Voice Commands
- ✅ Navigation: next, previous, go home
- ✅ Timers: set, pause, resume, cancel
- ✅ Reading: read step, read ingredients
- ✅ Meal switching: show breakfast/lunch/dinner/dessert/side
- ✅ Wake word: "Foodie"
- ✅ Audio feedback for all commands

---

## 9. Data Flow

### Connection Flow
```
App Launch
    ↓
Load server address from UserDefaults
    ↓
ConnectionManager.attemptAutoConnect()
    ↓
WebSocket connection to ws://{address}:8080
    ↓
Desktop sends "connected" message
    ↓
Desktop sends "meal_plan" with today's meals
    ↓
RecipeStore.setAvailableMealSlots()
    ↓
UI shows meal count
```

### Recipe Loading Flow
```
User taps recipe in RecipeListView
    ↓
RecipeStore.loadRecipeById()
    ↓
Send "load_recipe" message to desktop
    ↓
Desktop responds with "recipe" message
    ↓
ConnectionManager receives message
    ↓
RecipeStore.setCurrentRecipe()
    ↓
ContentView switches to cooking mode
    ↓
IngredientListView + InstructionsView render
```

### Voice Command Flow
```
User says "Foodie"
    ↓
VoiceCommandManager detects wake word
    ↓
isWaitingForCommand = true
    ↓
Speak "Listening"
    ↓
User says "next step"
    ↓
processCommand() called
    ↓
RecipeStore.nextStep()
    ↓
currentInstructionStep incremented
    ↓
InstructionsView scrolls to new step
    ↓
Speak "Next step"
    ↓
Reset to listening for wake word
```

### Timer Flow
```
Voice command: "set timer for 5 minutes"
    ↓
extractMinutes() → 5
    ↓
TimerManager.addTimer(label: "Voice Timer", duration: 300)
    ↓
TimerItem created with isRunning = true
    ↓
1-second update loop decrements remaining
    ↓
TimerBar displays timer card with progress
    ↓
When remaining <= 0:
    ↓
Haptic feedback
    ↓
Local notification
    ↓
Timer stops (remains visible)
```

### Scaling Flow
```
User taps scale button
    ↓
ScalePickerView sheet appears
    ↓
User selects 2.0x
    ↓
RecipeStore.scaleRecipe(by: 2.0)
    ↓
currentRecipe.currentScale = 2.0
    ↓
IngredientListView calls scaledIngredients()
    ↓
Each ingredient.scale(by: 2.0)
    ↓
numericQuantity * 2.0
    ↓
formatQuantity() converts to fractions
    ↓
UI updates with new quantities
```

---

## 10. Desktop App Integration Points

### Desktop Responsibilities

1. **WebSocket Server:**
   - Listens on port 8080
   - Accepts connections from multiple iPads
   - Broadcasts meal plan updates
   - Responds to load_recipe requests

2. **Data Formatting:**
   - Sends recipes with capitalized keys (API format)
   - Includes full ingredient arrays with QtyNum for scaling
   - Sends meal_plan with additional items and user assignments
   - Provides instructions as newline-separated string

3. **Recipe Loading:**
   - Receives `load_recipe` request with recipeId
   - Fetches full recipe from database
   - Sends back as `recipe` message
   - Handles multiple concurrent requests

4. **Connection Management:**
   - Sends "connected" on handshake
   - Responds to ping with pong
   - Handles disconnections gracefully
   - Tracks connected devices by X-Device-Id

### Shared Assumptions

1. **Recipe ID Format:**
   - UUIDs as strings
   - Consistent between desktop database and WebSocket messages

2. **Ingredient Quantities:**
   - Both QtyText (display) and QtyNum (calculation) provided
   - Desktop handles fraction parsing for initial send
   - iPad handles scaling calculations

3. **Instructions Format:**
   - Steps separated by `\n`
   - Empty lines filtered by iPad
   - No HTML or special formatting

4. **Meal Slot Names:**
   - Standardized: "breakfast", "lunch", "dinner"
   - Case-insensitive comparison on iPad
   - Used for voice command matching

5. **Additional Item Types:**
   - Standardized: "side", "dessert", "appetizer", "beverage"
   - Case-insensitive matching
   - Extensible (iPad shows any type sent)

---

## 11. Hardcoded Values & Assumptions

### Network
- WebSocket port: `8080` (not configurable)
- Ping interval: `30 seconds`
- Connection timeout: `10 seconds`
- Max reconnect attempts: `5`
- Reconnect backoff: `2s → 4s → 6s → 8s → 10s`
- Min retry interval: `5 seconds`

### Voice
- Wake word: `"foodie"` (hardcoded)
- Command timeout: `5 seconds` after wake word
- Max errors: `3` in `10 seconds`
- Speech rate: `0.5` (instructions), `0.55` (feedback)
- Locale: `en-US` only

### Timers
- Update interval: `1.0 second`
- Urgent threshold: `10 seconds` (red display)
- Notification delay: `0.1 second`

### UI
- Ingredient pane width: `40%`
- Instructions pane width: `60%`
- Button height: `100pt` (hands-free optimized)
- Timer card width: `160pt`
- Timer bar height: `120pt`

### Scaling
- Available options: `[0.5, 1.0, 1.5, 2.0, 3.0]`
- Default: `1.0`
- Precision: `0.01` for equality checks

### Persistence Keys
- `FoodieKitchen_CurrentRecipe`
- `FoodieKitchen_CurrentRecipe_state`
- `FoodieKitchen_AvailableRecipes`
- `FoodieKitchen_AvailableMealSlots`
- `serverAddress` (UserDefaults)

### App Configuration
- Minimum iOS: `16.0` (inferred from SwiftUI features)
- Device: iPad only
- Orientation: Landscape (left/right)
- Idle timer: Disabled during cooking
- Color scheme: System (supports dark mode)

---

## 12. Dependencies

### Apple Frameworks
- **SwiftUI** - UI framework
- **Combine** - Reactive state management
- **Foundation** - Core utilities
- **Network** - Network path monitoring (NWPathMonitor)
- **Speech** - Speech recognition (SFSpeechRecognizer)
- **AVFoundation** - Audio engine + speech synthesis
- **UserNotifications** - Timer completion alerts
- **UIKit** - Device info, haptics, idle timer

### Third-Party Libraries
- None (pure Apple frameworks)

---

## 13. Security & Privacy

### Permissions Required
1. **Speech Recognition** (`NSSpeechRecognitionUsageDescription`)
   - Required for voice commands
   - Requested on first VoiceCommandManager init
   - Can be denied (voice features disabled)

2. **Microphone** (`NSMicrophoneUsageDescription`)
   - Required for voice commands
   - System prompts on first audio engine start
   - Must be granted for voice to work

3. **Notifications** (optional)
   - Requested on TimerManager init
   - Falls back gracefully if denied
   - Timers still work (no alert on completion)

### Data Privacy
- No analytics or tracking
- No data sent to third parties
- Speech recognition happens on-device
- All data stored locally in UserDefaults
- WebSocket communication is unencrypted (local network only)

### Network Security
- **WARNING:** WebSocket uses `ws://` (not encrypted)
- **Assumption:** Local network is trusted
- **Mitigation:** Requires same WiFi network
- **Risk:** Traffic could be intercepted on compromised network
- **Recommendation:** Add `wss://` (TLS) for production

---

## 14. Known Limitations

### Technical
1. **Single User:** No multi-device sync of cooking progress
2. **No Offline Recipe Loading:** Must be connected to load new recipes
3. **English Only:** Voice commands only in en-US
4. **No Timer Creation UI:** Voice-only timer creation
5. **No Recipe Editing:** Read-only display from desktop
6. **No Image Display:** Text-only recipe display
7. **No Step Timers:** Timers not automatically linked to steps
8. **No Undo:** Can't undo ingredient checks or step navigation

### Design Decisions
1. **Manual Timer Dismissal:** Completed timers stay visible until removed
2. **First Timer Only:** Voice commands affect first timer in list
3. **No Step Gestures:** Swipe gestures mentioned in README but not implemented
4. **No Categories:** Ingredients not grouped by category (data exists but unused)
5. **Fixed Proportions:** 40/60 split not adjustable
6. **No Search:** Can't search meal list (assumes small daily list)

### Scaling
1. **Fixed Options:** Can't enter custom serving count
2. **Precision Loss:** Fractional conversions may round
3. **No Unit Conversion:** Doesn't convert cups ↔ ml, etc.

---

## 15. Potential Improvements

### User Experience
1. Add swipe gestures for step navigation
2. Ingredient grouping by category with collapsible sections
3. Custom timer labels and durations
4. Step-linked timers (auto-create from instruction text)
5. Recipe images display
6. Adjustable pane split ratio
7. Portrait mode support
8. Search/filter in meal list

### Features
1. Offline recipe caching with full sync
2. Manual recipe editing on iPad
3. Notes/substitutions per ingredient
4. Cooking history and favorites
5. Multi-language voice support
6. Custom wake word
7. Gesture control (wave to advance)
8. Apple Watch companion for timers

### Technical
1. Encrypted WebSocket (wss://)
2. Certificate pinning for security
3. Automatic timer detection in instructions
4. Better error messages with recovery actions
5. Network quality indicator
6. Reconnection progress indicator
7. Voice command confidence scores
8. Undo/redo system

### Performance
1. Virtualized meal list (if list grows large)
2. Image caching and lazy loading
3. Background recipe pre-loading
4. Reduce UserDefaults writes (debounce saves)

---

## 16. File Structure Summary

```
ios-apps/FoodieKitchen/
├── FoodieKitchenApp.swift              Main app entry point
├── Models/
│   ├── Message.swift                   WebSocket message protocol
│   ├── Recipe.swift                    Recipe, Ingredient, MealSlot, AdditionalItem, AssignedUser
│   └── TimerItem.swift                 Timer data model
├── Services/
│   ├── ConnectionManager.swift         WebSocket client + auto-reconnect
│   ├── RecipeStore.swift               Recipe state + persistence
│   ├── TimerManager.swift              Multi-timer management
│   └── VoiceCommandManager.swift       Speech recognition + commands
├── Views/
│   ├── ContentView.swift               Main navigation + home screen + RecipeListView
│   ├── IngredientListView.swift        Left pane + ScalePickerView + IngredientRow
│   ├── InstructionsView.swift          Right pane + StepView
│   ├── SettingsView.swift              Connection + voice settings
│   ├── TimerBar.swift                  Bottom overlay + TimerCard
│   └── VoiceCommandButton.swift        Microphone toggle button
├── Extensions/
│   └── View+Extensions.swift           Custom corner radius helper
└── README.md                           Documentation
```

**Total Files:** 15 Swift files
**Lines of Code:** ~2,500 (estimated)
**Architecture:** MVVM with ObservableObject

---

## 17. Testing Recommendations

### Unit Tests (Missing)
- Recipe scaling calculations
- Ingredient quantity parsing (fractions)
- Timer countdown logic
- Voice command parsing
- Message serialization/deserialization

### Integration Tests (Missing)
- WebSocket connection/reconnection
- Recipe loading flow
- Voice command → UI updates
- Timer completion notifications

### Manual Testing Checklist
1. ✅ Connect to desktop app
2. ✅ Load recipe from meal list
3. ✅ Navigate through steps
4. ✅ Check off ingredients
5. ✅ Scale recipe (verify quantities update)
6. ✅ Create timer via voice
7. ✅ Test all voice commands
8. ✅ Disconnect/reconnect network
9. ✅ Kill app and verify state restoration
10. ✅ Test with multiple timers
11. ✅ Test meal plan with additional items
12. ✅ Test user assignments display
13. ✅ Test switching between Macs (change server address)

---

## Conclusion

The FoodieKitchen iPad app is a well-structured SwiftUI application optimized for hands-free cooking. It uses MVVM architecture with environment objects for clean dependency injection, implements robust WebSocket communication with auto-reconnect, and provides advanced features like wake word voice commands and multi-timer management.

**Key Strengths:**
- Clean separation of concerns (MVVM)
- Robust error handling and auto-reconnect
- Hands-free optimized (voice + large buttons)
- Multi-user meal planning support (Phase 4.5.7)
- Local persistence for offline cooking
- Professional UX (haptics, animations, accessibility)

**Key Areas for Enhancement:**
- Add unit and integration tests
- Implement wss:// encryption for production
- Add multi-language voice support
- Improve timer management UI
- Add recipe image display
- Implement undo/redo system

The codebase is production-ready for local network use with room for enhancement based on user feedback and usage patterns.
