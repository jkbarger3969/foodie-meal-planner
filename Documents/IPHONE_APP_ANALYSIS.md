# FoodieShoppingList (iPhone) - Complete Code Analysis

## App Architecture

### SwiftUI MVVM Architecture
- **Main Entry**: `FoodieShoppingListApp.swift` - App lifecycle and dependency injection
- **Services Layer**: Managers for WebSocket, data storage, and voice control
- **Views Layer**: SwiftUI views for UI presentation
- **Models Layer**: Data structures for shopping items and messages

### Dependency Injection Pattern
All services are injected as `@EnvironmentObject`:
- `ConnectionManager` - WebSocket communication
- `ShoppingListStore` - Data management and business logic
- `VoiceInputManager` - Voice-to-text for manual item entry
- `VoiceCommandManager` - Wake word voice commands for hands-free control

---

## Data Models

### 1. ShoppingItem (`Models/ShoppingItem.swift`)

**Core Properties:**
```swift
struct ShoppingItem: Identifiable, Codable, Equatable {
    let id: String                  // Unique identifier
    var name: String                // Item name (e.g., "Milk")
    var quantity: String            // Quantity text (e.g., "2 cups", "1 lb")
    var category: String            // Category for grouping
    var store: String?              // Optional store name
    var isPurchased: Bool           // Purchase status
    let receivedAt: Date            // Timestamp when received
    var isManuallyAdded: Bool       // Added during shopping vs from desktop
    var forUsers: [String]          // PHASE 4.5.7: User assignments (names)
}
```

**Initialization:**
- `init?(from dict: [String: Any])` - Parse from server WebSocket data
  - Maps `ItemId`, `IngredientName`, `QtyText`, `Category`, `StoreName`, `is_purchased`, `forUsers`
- `init(name: String, quantity: String, category: String)` - Manual entry constructor
- Full initializer with all fields for voice commands

**Category Ordering:**
```swift
static let categoryOrder = [
    "Produce", "Dairy", "Meat", "Seafood", 
    "Bakery", "Frozen", "Pantry", "Beverages", 
    "Snacks", "Other"
]
```

### 2. Message (`Models/Message.swift`)

**WebSocket Message Wrapper:**
```swift
struct Message: Codable, @unchecked Sendable {
    let type: String        // Message type (e.g., "sync_changes")
    let data: AnyCodable?   // Payload (type-erased)
    let timestamp: String   // ISO8601 timestamp
}
```

**AnyCodable Type-Erasure:**
- Handles heterogeneous JSON data
- Supports: Bool, Int, Double, String, Arrays, Dictionaries
- Enables flexible message payloads

---

## Services and Managers

### 1. ConnectionManager (`Services/ConnectionManager.swift`)

**Responsibilities:**
- WebSocket connection management
- Network monitoring and auto-reconnect
- Message serialization/deserialization
- Sync coordination with desktop

**Key Properties:**
```swift
@Published var isConnected: Bool = false
@Published var syncStatus: SyncStatus = .idle
@Published var serverAddress: String  // Persisted to UserDefaults
var shoppingListStore: ShoppingListStore?
```

**Sync Status Enum:**
```swift
enum SyncStatus: Equatable {
    case idle
    case syncing
    case success
    case failed(String)
}
```

**WebSocket Protocol:**

**Connection Handshake:**
```
Client → Server: WebSocket connection with headers:
  - X-Device-ID: UUID
  - X-Device-Type: "iphone"
  
Server → Client: { type: "connected", ... }
```

**Message Types Sent:**
- `"request_shopping_list"` - Request full list on connect
- `"ping"` - Keep-alive every 30 seconds
- `"sync_changes"` - Send local changes to desktop
  ```json
  {
    "type": "sync_changes",
    "data": [
      {
        "id": "item-uuid",
        "isPurchased": true,
        "isManuallyAdded": false,
        "name": "Milk",
        "quantity": "1 gallon",
        "category": "Dairy"
      },
      {
        "id": "deleted-uuid",
        "isDeleted": true
      }
    ]
  }
  ```
- `"item_removed"` - Notify desktop to return item to pantry
  ```json
  {
    "type": "item_removed",
    "ingredient": "milk",
    "qty": 1.0,
    "unit": "gallon",
    "itemId": "uuid"
  }
  ```
- `"item_unpurchased"` - Notify desktop to return item to pantry
  ```json
  {
    "type": "item_unpurchased",
    "ingredient": "milk",
    "qty": 1.0,
    "unit": "gallon",
    "itemId": "uuid"
  }
  ```

**Message Types Received:**
- `"connected"` - Connection established
- `"pong"` - Keep-alive response
- `"shopping_list"` - Full shopping list data
- `"shopping_list_update"` - Incremental update
- `"sync_confirmed"` - Desktop acknowledged sync

**Network Monitoring:**
- Uses `NWPathMonitor` to detect network availability
- Auto-reconnects when network becomes available
- Exponential backoff: min(attempt * 2, 30) seconds
- Max 5 reconnect attempts before giving up

**Connection Lifecycle:**
```
1. connect() → Create URLSessionWebSocketTask
2. Connected → Start ping timer (30s interval)
3. Request shopping list
4. receiveMessage() → Process incoming messages
5. Disconnect/Error → Schedule reconnect
```

### 2. ShoppingListStore (`Services/ShoppingListStore.swift`)

**Responsibilities:**
- Shopping list data management
- Local persistence (UserDefaults)
- Sync state tracking
- Business logic for item operations
- Pantry sync communication

**Key Properties:**
```swift
@Published var items: [ShoppingItem] = []
@Published var pendingSync: Set<String> = []  // Item IDs needing sync
@Published var selectedStore: String = "All Stores"
@Published var searchText: String = ""
weak var connectionManager: ConnectionManager?
```

**Local Storage Keys:**
- `"savedShoppingList"` - JSON encoded items array
- `"pendingSync"` - Array of item IDs with pending changes
- `"lastSyncDate"` - Last successful sync timestamp

**Core Operations:**

**Server Updates:**
```swift
func updateFromServer(_ newItems: [ShoppingItem])
```
- Merges server items with local items
- Preserves local changes for items in `pendingSync`
- Keeps manually-added items not in server list

**Item Management:**
```swift
func togglePurchased(_ item: ShoppingItem)
  - Toggles isPurchased flag
  - Adds to pendingSync
  - Sends item_unpurchased message if unmarking
  - Haptic feedback

func addItem(_ item: ShoppingItem)
  - Appends to items array
  - Marks for sync

func deleteItem(_ item: ShoppingItem)
  - Sends item_removed to desktop (returns to pantry)
  - Removes from items
  - Marks for sync

func clearPurchased()
  - Removes all purchased items
  - Marks each for sync
```

**Sync Management:**
```swift
func confirmSync()
  - Clears pendingSync set
  - Updates lastSyncDate
```

**Filtering & Grouping:**
```swift
var filteredItems: [ShoppingItem]
  - Filters by selectedStore
  - Filters by searchText

func itemsGroupedByCategory() -> [(key: String, value: [ShoppingItem])]
  - Groups by category
  - Sorts by categoryOrder
```

**Statistics:**
```swift
var totalItems: Int
var purchasedItems: Int
var remainingItems: Int
var progress: Double  // 0.0 to 1.0
var progressText: String  // "5 of 10 items"
```

**Pantry Sync Protocol:**
- When item removed or unpurchased, parses quantity string
- Extracts numeric quantity and unit (e.g., "2 cups" → 2.0, "cups")
- Sends to desktop via `connectionManager.send()`
- Supports fractions: "1/2", "1 1/2"

### 3. VoiceCommandManager (`Services/VoiceCommandManager.swift`)

**Responsibilities:**
- Wake word detection ("Foodie")
- Command processing and execution
- Speech synthesis feedback
- Hands-free shopping list control

**Key Properties:**
```swift
@Published var isListening: Bool = false
@Published var isContinuousMode: Bool = false  // User preference
@Published var lastCommand: String = ""
@Published var lastRecognizedText: String = ""
@Published var isAuthorized: Bool = false
weak var shoppingListStore: ShoppingListStore?
```

**Speech Recognition:**
- Uses Apple `Speech` framework
- Locale: `en-US`
- Continuous or single-command mode
- Partial results enabled for responsiveness

**Wake Word System:**
- Triggers on "foodie" in transcript
- Debouncing: ignores duplicate commands within 2 seconds
- Extracts command text after wake word

**Command Categories:**

**1. Store Switching:**
- `"show all stores"` / `"all stores"`
- `"show walmart"` / `"show kroger"` / `"show target"`
- Fuzzy matching on store names

**2. Item Count & Summary:**
- `"how many items"` - Total and remaining count
- `"how many stores"` - Store count
- `"list stores"` - Read store names
- `"how many categories"` - Category count
- `"list categories"` - Read category names

**3. Item Reading:**
- `"read list"` - Read first 10 unchecked items
- `"read unchecked"` / `"what's left"` - Remaining count
- `"read checked"` / `"what's done"` - Checked count

**4. Add Items (Voice):**
- `"add milk"` - Add item with auto-category detection
- `"add chicken breast"` - Multi-word items
- `"add milk to walmart"` - Item with store assignment
- Smart category detection based on keywords:
  - Produce: apple, banana, lettuce, tomato, onion, etc.
  - Dairy: milk, cheese, yogurt, butter, cream, egg
  - Meat: chicken, beef, pork, turkey, bacon, sausage
  - Seafood: fish, salmon, tuna, shrimp, crab
  - Bakery: bread, bagel, muffin, donut, cake
  - Frozen: frozen, ice cream, pizza
  - Beverages: juice, soda, water, coffee, tea
  - Snacks: chips, crackers, popcorn, candy
  - Default: Pantry

**5. Item Actions:**
- `"check milk"` / `"mark eggs"` - Mark as purchased
- `"uncheck bread"` - Mark as not purchased
- `"delete chicken"` / `"remove chicken"` - Delete item

**6. Bulk Actions:**
- `"check all"` / `"mark all"` - Check all items
- `"uncheck all"` - Uncheck all items
- `"clear checked"` / `"delete checked"` - Delete checked items

**7. Search:**
- `"search for chicken"` - Set search filter
- `"clear search"` - Clear search filter

**8. Help:**
- `"help"` / `"what can you do"` - Voice guide

**Text-to-Speech Feedback:**
- AVSpeechSynthesizer
- Rate: 0.55
- Volume: 1.0
- Confirms each action verbally

**Command Lifecycle:**
```
1. Start listening → Audio engine + speech recognition
2. Detect wake word "foodie" in transcript
3. Extract command after wake word
4. Process command (update store state)
5. Speak feedback
6. If single-command mode, stop listening after 1 second
```

### 4. VoiceInputManager (`Services/VoiceInputManager.swift`)

**Responsibilities:**
- Voice-to-text for manual item entry
- Speech recognition authorization
- Quantity and item name parsing

**Key Properties:**
```swift
@Published var isListening: Bool = false
@Published var recognizedText: String = ""
@Published var isAuthorized: Bool = false
@Published var authorizationError: String?
```

**Authorization States:**
- `.authorized` - Ready to use
- `.denied` - User denied permission
- `.restricted` - Device restrictions
- `.notDetermined` - Not yet requested

**Parsing Algorithm:**
```swift
func parseItemFromText(_ text: String) -> (quantity: String, name: String)
```
- Regex pattern: `^(\d+(?:\.\d+)?(?:\s*unit)?)\s+(.+)$`
- Supported units: pounds, lbs, oz, cups, tbsp, tsp, gallons, quarts, pints, grams, kg, liters, ml
- Examples:
  - "2 cups flour" → ("2 cups", "flour")
  - "1.5 lbs chicken" → ("1.5 lbs", "chicken")
  - "bananas" → ("", "bananas")

**Audio Configuration:**
- Category: `.record`
- Mode: `.measurement`
- Options: `.duckOthers`

---

## View Components

### 1. ContentView (`Views/ContentView.swift`)

**Main Shopping List Screen**

**Layout Structure:**
```
NavigationView
  └─ VStack
      ├─ SyncStatusBanner (conditional)
      ├─ Progress bar + stats
      ├─ Store tabs (horizontal scroll)
      ├─ Search bar
      └─ Shopping list (grouped or ungrouped)
```

**Features:**
- Store tabs with item counts and icons
- Search filtering
- Grouping options: Category or None
- Swipe actions: Check/Uncheck, Delete
- Context menu for item actions
- Empty states for no items and no search results

**Toolbar Actions:**
- Ellipsis menu: Group by picker, Clear purchased
- Sync button: Disabled if no pending changes
- Add item button
- Settings button

**Store Tab UI:**
- Selected: Blue background, white text, indicator line
- Item count badge
- Custom icons based on store name

**Category Icons:**
- Produce: leaf.fill
- Dairy: drop.fill
- Meat: hare.fill
- Seafood: fish.fill
- Bakery: birthday.cake.fill
- Frozen: snowflake
- Pantry: cabinet.fill
- Beverages: cup.and.saucer.fill
- Snacks: popcorn.fill

### 2. ShoppingItemRow (`Views/ShoppingItemRow.swift`)

**Individual Item Display**

**Layout:**
```
HStack
  ├─ Checkbox button (circle/checkmark.circle.fill)
  ├─ VStack
  │   ├─ Item name (strikethrough if purchased)
  │   └─ HStack
  │       ├─ Quantity (optional)
  │       ├─ User assignments (PHASE 4.5.7)
  │       └─ "Added while shopping" badge
  └─ Category badge
```

**User Assignments Display:**
- Shows "For: Alice, Bob" if `forUsers` is not empty
- Blue text color
- Separated by bullet points

**Accessibility:**
- Combined element with descriptive label
- Selected trait for purchased items
- Hint: "Tap to mark as purchased" / "Tap to unmark"

### 3. AddItemView (`Views/AddItemView.swift`)

**Manual Item Entry Sheet**

**Form Sections:**
1. **Item Details:**
   - Name text field with voice input button
   - "Listening..." indicator when recording
   - Quantity text field (optional)

2. **Category Picker:**
   - Menu picker with all categories

3. **Authorization Error:**
   - Warning if voice not authorized

**Voice Input Integration:**
- Mic button toggles `VoiceInputManager`
- Real-time text display from `recognizedText`
- Auto-parses quantity and name
- Clears fields when starting new recording

**Validation:**
- Add button disabled if name is empty

**Haptic Feedback:**
- Success notification on add

### 4. SettingsView (`Views/SettingsView.swift`)

**Configuration and Status Screen**

**Form Sections:**

1. **Status:**
   - Connection status (green checkmark / red X)

2. **Desktop Mac:**
   - Server address text field (monospaced)
   - Example: `ws://192.168.1.100:8080`
   - "How to find this address" help button
   - Footer: Switching between Macs instructions

3. **Connection Actions:**
   - "Save & Connect" / "Reconnect" button
   - "Disconnect" button (if connected)

4. **Voice Control:**
   - Authorization status
   - "Enable" button if not authorized
   - Voice Commands toggle
   - Continuous Listening toggle
   - Wake word display
   - Last command display
   - Voice Commands Guide button

5. **About:**
   - App version: 1.0.0
   - Device ID (first 8 chars of UUID)

**Help Alerts:**
- Connection help: How to find WebSocket address
- Voice commands guide: Full command list

### 5. SyncStatusBanner (`Views/SyncStatusBanner.swift`)

**Transient Status Display**

**States:**
- `.syncing` - Blue background, spinner, "Syncing..."
- `.success` - Green background, checkmark, "Auto-sync successful"
- `.failed(error)` - Red background, warning icon, error message
- `.idle` - Hidden

**Animations:**
- Slide in from top
- Fade out after 3 seconds (for success)

---

## WebSocket Communication Protocol

### Client-to-Server Messages

| Type | Data | Purpose |
|------|------|---------|
| `request_shopping_list` | null | Request full list on connect |
| `ping` | null | Keep-alive every 30s |
| `sync_changes` | Array of changes | Sync local modifications |
| `item_removed` | `{ ingredient, qty, unit, itemId }` | Return item to pantry |
| `item_unpurchased` | `{ ingredient, qty, unit, itemId }` | Return item to pantry |

### Server-to-Client Messages

| Type | Data | Purpose |
|------|------|---------|
| `connected` | Connection info | Handshake confirmation |
| `pong` | null | Keep-alive response |
| `shopping_list` | Array of items | Full list data |
| `shopping_list_update` | Array of items | Incremental update |
| `sync_confirmed` | null | Sync acknowledged |

### Item Data Format (Server → Client)

```json
{
  "ItemId": "uuid-string",
  "IngredientName": "Milk",
  "QtyText": "1 gallon",
  "Category": "Dairy",
  "StoreName": "Walmart",
  "is_purchased": 0,
  "forUsers": ["Alice", "Bob"]
}
```

### Change Data Format (Client → Server)

**Update:**
```json
{
  "id": "uuid",
  "isPurchased": true,
  "isManuallyAdded": false,
  "name": "Milk",
  "quantity": "1 gallon",
  "category": "Dairy"
}
```

**Delete:**
```json
{
  "id": "uuid",
  "isDeleted": true
}
```

---

## Voice Command/Input Features

### Two Voice Systems

1. **VoiceCommandManager** - Hands-free wake word control
   - Always listening for "Foodie"
   - Continuous or single-command mode
   - No UI interaction needed
   - Ideal for shopping

2. **VoiceInputManager** - Manual entry assistant
   - Activated via mic button in AddItemView
   - One-time transcription
   - Stops automatically when speech ends
   - Parses quantity and item name

### Wake Word Detection
- Substring match on "foodie" in transcript
- Case-insensitive
- Extracts command after wake word
- Debouncing prevents duplicate processing

### Command Processing
1. Normalize to lowercase
2. Match against command patterns
3. Execute action on ShoppingListStore
4. Provide voice feedback
5. Auto-stop if single-command mode

### Category Auto-Detection
Uses keyword matching to assign categories:
- **Produce**: apple, banana, lettuce, tomato, etc. (12+ keywords)
- **Dairy**: milk, cheese, yogurt, butter, cream, egg
- **Meat**: chicken, beef, pork, turkey, bacon, sausage, steak, ground
- **Seafood**: fish, salmon, tuna, shrimp, crab, lobster
- **Bakery**: bread, bagel, muffin, donut, cake, cookie, roll
- **Frozen**: frozen, ice cream, pizza
- **Beverages**: juice, soda, water, coffee, tea, beer, wine
- **Snacks**: chips, crackers, popcorn, candy, chocolate
- **Default**: Pantry

---

## Shopping List Functionality

### Item Lifecycle

1. **Received from Desktop**
   - WebSocket message with item data
   - Parsed into ShoppingItem
   - Merged with existing items
   - `isManuallyAdded = false`

2. **Added During Shopping**
   - Manual entry via AddItemView
   - Voice command "add [item]"
   - `isManuallyAdded = true`
   - Marked for sync

3. **Purchased**
   - Toggle via checkbox tap
   - Swipe action
   - Voice command "check [item]"
   - Marked for sync
   - Haptic feedback

4. **Unpurchased**
   - Toggle again
   - Sends `item_unpurchased` to desktop
   - Returns to pantry on desktop
   - Marked for sync

5. **Deleted**
   - Swipe to delete
   - Voice command "delete [item]"
   - Sends `item_removed` to desktop
   - Returns to pantry on desktop
   - Marked for sync

6. **Synced**
   - Pending changes sent to desktop
   - Desktop responds with `sync_confirmed`
   - `pendingSync` cleared
   - `lastSyncDate` updated

### Sync Mechanism

**Optimistic Updates:**
- Local changes applied immediately
- UI updates instantly
- No waiting for server confirmation

**Pending Sync Tracking:**
- `Set<String>` of item IDs with changes
- Persisted to UserDefaults
- Survives app restarts

**Conflict Resolution:**
- Server updates preserve local changes for items in `pendingSync`
- Local changes take precedence until synced

**Manual Sync:**
- Sync button in toolbar
- Disabled if no pending changes or not connected
- Shows sync status banner

**Auto-Sync on Connect:**
- Request full list immediately
- Server may auto-push updates

### Filtering and Grouping

**Store Filter:**
- "All Stores" shows everything
- Individual stores filter by `item.store`
- Voice command: "show walmart"

**Search Filter:**
- Filters by item name (substring match)
- Filters by category name
- Case-insensitive
- Voice command: "search for chicken"

**Grouping:**
- **By Category**: Sections with category headers and icons
- **No Grouping**: Flat list

**Sort Order:**
- Categories: Predefined `categoryOrder`
- Within category: Received order (by `receivedAt`)

---

## Current Features Summary

### Core Functionality
- ✅ WebSocket connection to desktop Mac
- ✅ Real-time shopping list sync
- ✅ Multi-store support with filtering
- ✅ Multi-user meal assignments (PHASE 4.5.7)
- ✅ Category-based organization
- ✅ Search filtering
- ✅ Purchase tracking with progress bar
- ✅ Offline support with local persistence
- ✅ Network monitoring and auto-reconnect
- ✅ Pantry sync (return items to pantry on delete/unpurchase)

### Voice Features
- ✅ Wake word detection ("Foodie")
- ✅ 30+ voice commands
- ✅ Continuous and single-command modes
- ✅ Voice-to-text for manual item entry
- ✅ Speech synthesis feedback
- ✅ Auto-category detection for voice-added items
- ✅ Store assignment via voice ("add milk to walmart")

### UI/UX Features
- ✅ Store tabs with item counts
- ✅ Category grouping with icons
- ✅ Swipe actions (check/uncheck, delete)
- ✅ Context menus
- ✅ Progress tracking
- ✅ Sync status banner
- ✅ Connection status indicator
- ✅ Empty states
- ✅ Haptic feedback
- ✅ Accessibility support
- ✅ Dark mode support

### Settings
- ✅ Server address configuration
- ✅ Multi-Mac support (switch by changing address)
- ✅ Voice control toggle
- ✅ Continuous listening mode
- ✅ Help guides for connection and voice commands

---

## Data Flow

### App Launch
```
1. FoodieShoppingListApp initializes services
2. Services injected as EnvironmentObjects
3. ConnectionManager loads saved serverAddress
4. ShoppingListStore loads items from UserDefaults
5. Network monitor starts
6. Auto-connect attempt
7. On connect: Request shopping list
8. Screen remains awake (isIdleTimerDisabled = true)
```

### Receiving Items from Desktop
```
1. Desktop sends "shopping_list" or "shopping_list_update"
2. ConnectionManager.handleMessage() receives JSON
3. Parse items array: [[String: Any]]
4. Map to [ShoppingItem] via init(from:)
5. ShoppingListStore.updateFromServer()
6. Merge with local items, preserve pending changes
7. Save to UserDefaults
8. UI updates via @Published
9. Show success banner (3 second auto-dismiss)
```

### Checking Off an Item
```
1. User taps checkbox or says "foodie check milk"
2. ShoppingListStore.togglePurchased()
3. Update isPurchased flag
4. Add item.id to pendingSync
5. Save to UserDefaults
6. Haptic feedback
7. UI updates (strikethrough, progress bar)
8. User manually syncs or auto-sync on next connect
```

### Deleting an Item
```
1. User swipes to delete or says "foodie delete milk"
2. ShoppingListStore.deleteItem()
3. Parse quantity: "1 gallon" → (1.0, "gallon")
4. Send item_removed message to desktop
5. Remove from items array
6. Add item.id to pendingSync
7. Save to UserDefaults
8. UI updates
9. Desktop receives message, returns item to pantry
```

### Adding Item via Voice
```
1. User says "foodie add chicken breast"
2. VoiceCommandManager.handleAddItem()
3. Extract item name: "chicken breast"
4. Detect category: "Meat" (keyword: "chicken")
5. Create ShoppingItem with isManuallyAdded = true
6. ShoppingListStore.addItem()
7. Add to pendingSync
8. Save to UserDefaults
9. Speak feedback: "Added chicken breast"
10. UI updates
```

### Sync to Desktop
```
1. User taps sync button
2. ConnectionManager.syncNow()
3. Gather all items in pendingSync
4. Build changes array (updates + deletions)
5. Send "sync_changes" message
6. Show syncing banner
7. Desktop processes changes
8. Desktop responds with "sync_confirmed"
9. ShoppingListStore.confirmSync()
10. Clear pendingSync, update lastSyncDate
11. Show success banner (3 second)
```

---

## Desktop App Integration Points

### WebSocket Server Requirements
Desktop must implement WebSocket server on port 8080 with:

1. **Connection Handling:**
   - Accept WebSocket connections
   - Read headers: `X-Device-ID`, `X-Device-Type`
   - Send `connected` message on handshake
   - Handle reconnections gracefully

2. **Message Handlers:**
   - `request_shopping_list` → Send current list
   - `sync_changes` → Apply changes, respond with `sync_confirmed`
   - `item_removed` → Return item to pantry inventory
   - `item_unpurchased` → Return item to pantry inventory
   - `ping` → Respond with `pong`

3. **Pantry Integration:**
   - Parse ingredient name, quantity, unit
   - Locate pantry item (case-insensitive match)
   - Increment quantity
   - Update database

4. **Multi-User Support (PHASE 4.5.7):**
   - Include `forUsers` array in item data
   - Filter items by selected users before sending

### Expected Item Data Format
Desktop should send items with these fields:
```json
{
  "ItemId": "uuid",           // Required
  "IngredientName": "Milk",   // Required
  "QtyText": "1 gallon",      // Optional
  "Category": "Dairy",        // Optional (default "Other")
  "StoreName": "Walmart",     // Optional
  "is_purchased": 0,          // Optional (0 or 1)
  "forUsers": ["Alice"]       // Optional (PHASE 4.5.7)
}
```

### Sync Protocol
1. iPhone sends changes
2. Desktop applies to database
3. Desktop broadcasts update to all connected devices
4. Desktop sends `sync_confirmed` to iPhone
5. iPhone clears pending sync

---

## Hardcoded Values and Assumptions

### Network Configuration
- **Default Server**: `ws://192.168.1.100:8080`
- **Port**: 8080 (hardcoded in example)
- **Ping Interval**: 30 seconds
- **Reconnect Max Attempts**: 5
- **Reconnect Backoff**: min(attempt * 2, 30) seconds

### Voice Recognition
- **Wake Word**: "foodie" (lowercase only)
- **Locale**: `en-US`
- **Speech Rate**: 0.55
- **Debounce Window**: 2 seconds
- **Max Items Read**: 10 (for "read list")

### Category System
- **Predefined Categories**: 10 categories (Produce, Dairy, etc.)
- **Default Category**: "Other" for manual entry, "Pantry" for voice
- **Category Order**: Fixed array (not user-configurable)

### UI Constants
- **App Version**: "1.0.0"
- **Success Banner Duration**: 3 seconds
- **Haptic Styles**: `.medium` for toggle, `.success` for add

### Assumptions
1. **Network**: iPhone and Mac on same WiFi network
2. **Single Desktop**: One Mac connection at a time (can switch)
3. **No Authentication**: Open WebSocket (local network only)
4. **No Encryption**: Plain WebSocket (not WSS)
5. **No Offline Queue**: Sync requires active connection
6. **Case-Insensitive**: Ingredient matching for pantry sync
7. **Unit Parsing**: Limited to common units (cups, lbs, etc.)
8. **Fraction Support**: Simple fractions only (1/2, 1 1/2)
9. **Voice Commands**: English only
10. **Category Keywords**: Fixed lists (not learned)

---

## Potential Issues and Limitations

### 1. Security
- No authentication on WebSocket
- No encryption (plain ws://)
- Device ID is UUID (not verified)
- Assumes trusted local network

### 2. Sync Conflicts
- No CRDTs or vector clocks
- Local changes always win until synced
- Concurrent edits on multiple devices may conflict
- No merge resolution UI

### 3. Network
- No retry on failed sync (manual only)
- Max 5 reconnect attempts (requires app restart)
- No offline queue (changes lost if app killed before sync)
- No connection quality indicator

### 4. Voice Recognition
- Requires microphone permission
- English only
- Noisy environments may fail
- Wake word false positives possible
- No command history or undo

### 5. Pantry Sync
- Case-sensitive ingredient matching may fail
- Fraction parsing limited to simple formats
- No validation of pantry item existence
- No feedback if pantry update fails
- Quantity parsing may fail on complex strings

### 6. Data Persistence
- UserDefaults (not ideal for large datasets)
- No database (SQLite would be better)
- No data migration strategy
- No backup/restore

### 7. Accessibility
- Voice commands require hearing (no visual feedback)
- No VoiceOver optimization
- No dynamic type support
- No high contrast mode

### 8. Multi-User
- forUsers is display-only on iPhone
- No filtering by user on iPhone
- Assumes desktop handles user selection
- No user management on iPhone

---

## Files Summary

| File | Lines | Purpose |
|------|-------|---------|
| `FoodieShoppingListApp.swift` | 41 | App entry point, DI setup |
| `Models/Message.swift` | 64 | WebSocket message wrapper |
| `Models/ShoppingItem.swift` | 103 | Shopping item data model |
| `Services/ConnectionManager.swift` | 352 | WebSocket client, network monitor |
| `Services/ShoppingListStore.swift` | 304 | Data management, business logic |
| `Services/VoiceCommandManager.swift` | 585 | Wake word commands, TTS |
| `Services/VoiceInputManager.swift` | 169 | Voice-to-text for manual entry |
| `Views/ContentView.swift` | 441 | Main shopping list UI |
| `Views/AddItemView.swift` | 148 | Manual item entry sheet |
| `Views/SettingsView.swift` | 245 | Configuration screen |
| `Views/ShoppingItemRow.swift` | 110 | Item row component |
| `Views/SyncStatusBanner.swift` | 68 | Sync status UI |
| `Extensions/View+Extensions.swift` | 61 | SwiftUI helpers, date formatting |
| **Total** | **2,691** | **13 files** |

---

## Conclusion

The FoodieShoppingList iPhone app is a well-architected SwiftUI application with:

- **Solid Architecture**: MVVM with clear separation of concerns
- **Robust Sync**: WebSocket-based real-time sync with offline support
- **Advanced Voice**: Two voice systems (wake word + manual entry)
- **Rich UX**: Store filtering, category grouping, search, haptics
- **Pantry Integration**: Bidirectional sync with desktop inventory
- **Multi-User Support**: PHASE 4.5.7 user assignments

The codebase is clean, well-documented, and follows iOS best practices. It integrates seamlessly with the desktop app via WebSocket and provides a hands-free shopping experience with 30+ voice commands.
