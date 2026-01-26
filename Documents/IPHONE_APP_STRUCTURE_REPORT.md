# FoodieShoppingList (iPhone) - Comprehensive Structure Report

## Overview
FoodieShoppingList is a SwiftUI-based iOS companion app for the Foodie Meal Planner desktop application. It allows users to view and manage shopping lists synchronized from the desktop app via WebSocket, with voice command support for hands-free operation while shopping.

---

## 1. Swift Files Structure

### 1.1 Application Entry Point

#### **FoodieShoppingListApp.swift** (41 lines)
**Purpose**: Main app entry point, dependency injection container

**Responsibilities**:
- Creates and manages all StateObject managers:
  - `ConnectionManager` - WebSocket connection
  - `ShoppingListStore` - Shopping list data
  - `VoiceInputManager` - Voice input for add item
  - `VoiceCommandManager` - Voice commands for hands-free shopping
- Injects managers into SwiftUI environment
- Sets up cross-dependencies between managers
- Manages screen wake lock (keeps screen on while app is active)
- Triggers auto-connect on launch

**Key Features**:
- Dark mode support (`preferredColorScheme(nil)`)
- Automatic screen wake lock
- Bidirectional manager dependencies

---

### 1.2 Models (2 files)

#### **Models/Message.swift** (64 lines)
**Purpose**: WebSocket message data structures

**Components**:
1. `Message` struct:
   - `type: String` - Message type identifier
   - `data: AnyCodable?` - Payload
   - `timestamp: String` - ISO8601 timestamp

2. `AnyCodable` struct:
   - Type-erased wrapper for JSON encoding/decoding
   - Supports: Bool, Int, Double, String, Arrays, Dictionaries, NSNull
   - Handles dynamic JSON payloads from desktop

**Features**:
- `@unchecked Sendable` for async compatibility
- Automatic timestamp generation
- Flexible data encoding

---

#### **Models/ShoppingItem.swift** (103 lines)
**Purpose**: Shopping list item data model

**Properties**:
- `id: String` - Unique identifier
- `name: String` - Ingredient name
- `quantity: String` - Quantity text (e.g., "2 cups")
- `category: String` - Category (e.g., "Produce", "Dairy")
- `store: String?` - Store assignment (optional)
- `isPurchased: Bool` - Purchase status
- `receivedAt: Date` - Timestamp when received
- `isManuallyAdded: Bool` - Flag for items added while shopping
- `forUsers: [String]` - User assignments (PHASE 4.5.7)

**Initializers**:
1. `init?(from dict: [String: Any])` - From server data
2. `init(name:quantity:category:)` - For manual entry
3. `init(id:name:quantity:category:store:isPurchased:receivedAt:isManuallyAdded:forUsers:)` - Full initializer
4. `init(from decoder: Decoder)` - Codable support

**Category Ordering**:
```swift
static let categoryOrder = [
    "Produce", "Dairy", "Meat", "Seafood", "Bakery",
    "Frozen", "Pantry", "Beverages", "Snacks", "Other"
]
```

**Protocols**: `Identifiable`, `Codable`, `Equatable`

---

### 1.3 Services (4 files)

#### **Services/ConnectionManager.swift** (352 lines)
**Purpose**: WebSocket connection management and message handling

**Published Properties**:
- `@Published var isConnected: Bool` - Connection status
- `@Published var syncStatus: SyncStatus` - Sync operation status
- `@Published var serverAddress: String` - WebSocket URL (persisted to UserDefaults)

**Key Features**:
1. **WebSocket Management**:
   - `URLSessionWebSocketTask` for connection
   - Automatic reconnection with exponential backoff (max 5 attempts, up to 30s delay)
   - Ping/keep-alive every 30 seconds
   - Auto-connect on network availability

2. **Network Monitoring**:
   - `NWPathMonitor` for network status
   - Auto-reconnect when network becomes available

3. **Message Handling** (receives):
   - `connected` - Connection established
   - `pong` - Keep-alive response
   - `shopping_list` - Full shopping list
   - `shopping_list_update` - Incremental update
   - `sync_confirmed` - Sync acknowledgment

4. **Message Sending**:
   - `sendMessage(_ message: Message)` - Typed messages
   - `send(_ messageDict: [String: Any])` - Generic dictionary messages
   - `requestShoppingList()` - Request full list
   - `syncNow()` - Sync pending changes

5. **Sync Status**:
   ```swift
   enum SyncStatus: Equatable {
       case idle
       case syncing
       case success
       case failed(String)
   }
   ```

**Delegate**: `URLSessionWebSocketDelegate`

**Connection Headers**:
- `X-Device-ID`: Device UUID
- `X-Device-Type`: "iphone"

---

#### **Services/ShoppingListStore.swift** (304 lines)
**Purpose**: Shopping list state management, persistence, and business logic

**Published Properties**:
- `@Published var items: [ShoppingItem]` - All shopping items
- `@Published var pendingSync: Set<String>` - Item IDs needing sync
- `@Published var selectedStore: String` - Current store filter
- `@Published var searchText: String` - Search filter

**Dependencies**:
- `weak var connectionManager: ConnectionManager?` - For WebSocket communication

**Storage Keys**:
- `savedShoppingList` - Items array
- `pendingSync` - Pending sync IDs
- `lastSyncDate` - Last successful sync

**Core Methods**:

1. **Server Updates**:
   - `updateFromServer(_ newItems: [ShoppingItem])` - Merge server items with local changes
   - Preserves local purchase state for pending items
   - Keeps manually added items

2. **Item Management**:
   - `togglePurchased(_ item: ShoppingItem)` - Toggle purchase status
   - `addItem(_ item: ShoppingItem)` - Add new item
   - `deleteItem(_ item: ShoppingItem)` - Delete item (notifies desktop to return to pantry)
   - `clearPurchased()` - Remove all purchased items

3. **Sync Management**:
   - `confirmSync()` - Clear pending changes after successful sync
   - `hasPendingChanges: Bool` - Check if sync needed

4. **Statistics** (computed properties):
   - `totalItems: Int`
   - `purchasedItems: Int`
   - `remainingItems: Int`
   - `progress: Double` (0.0-1.0)
   - `progressText: String` ("X of Y items")

5. **Grouping**:
   - `itemsGroupedByCategory()` - Group by category
   - `itemsGroupedByStore()` - Group by store

6. **Filtering** (computed):
   - `availableStores: [String]` - All stores + "All Stores"
   - `filteredItems: [ShoppingItem]` - Filtered by store and search

7. **Pantry Sync** (PHASE 5.4 - Return to Pantry):
   - `notifyItemRemoved(_ item: ShoppingItem)` - Send `item_removed` message
   - `notifyItemUnpurchased(_ item: ShoppingItem)` - Send `item_unpurchased` message
   - `parseQuantityAndUnit(_ text: String) -> (Double, String)` - Parse quantity text
   - `parseFraction(_ text: String) -> Double` - Parse fractions (e.g., "1/2", "1 1/2")

**Pantry Sync Messages**:
```swift
// When item is deleted (return to pantry)
{
    "type": "item_removed",
    "ingredient": "milk",
    "qty": 1.0,
    "unit": "gallon",
    "itemId": "abc123"
}

// When item is unmarked as purchased (return to pantry)
{
    "type": "item_unpurchased",
    "ingredient": "milk",
    "qty": 1.0,
    "unit": "gallon",
    "itemId": "abc123"
}
```

---

#### **Services/VoiceCommandManager.swift** (585 lines)
**Purpose**: Wake-word voice commands for hands-free shopping

**Published Properties**:
- `@Published var isListening: Bool` - Listening status
- `@Published var isContinuousMode: Bool` - Continuous vs single-command mode
- `@Published var lastCommand: String` - Last executed command
- `@Published var lastRecognizedText: String` - Last recognized speech
- `@Published var isAuthorized: Bool` - Speech recognition authorization

**Dependencies**:
- `weak var shoppingListStore: ShoppingListStore?` - Data store reference

**Voice Recognition**:
- Locale: `en-US`
- Wake word: `"foodie"`
- Debouncing: 2-second window for duplicate commands
- Text-to-speech feedback for all actions

**Supported Commands**:

1. **Store Switching**:
   - `"foodie show all stores"` - Show all stores
   - `"foodie show [store name]"` - Switch to specific store (e.g., "walmart", "kroger")
   - `"foodie list stores"` - List all stores
   - `"foodie how many stores"` - Count stores

2. **Item Actions**:
   - `"foodie check [item]"` - Mark item as purchased
   - `"foodie uncheck [item]"` - Unmark item
   - `"foodie delete [item]"` - Delete item
   - `"foodie add [item]"` - Add new item (NEW)
     - Supports store: `"add milk to walmart"`
     - Smart category detection

3. **Bulk Actions**:
   - `"foodie check all"` - Check all items
   - `"foodie uncheck all"` - Uncheck all items
   - `"foodie clear checked"` - Delete all checked items

4. **Information**:
   - `"foodie how many items"` - Count total/remaining items
   - `"foodie read list"` - Read unchecked items (up to 10)
   - `"foodie what's left"` - Count remaining items
   - `"foodie list categories"` - List all categories
   - `"foodie show [category]"` - Show items in category

5. **Search**:
   - `"foodie search for [term]"` - Search items
   - `"foodie clear search"` - Clear search

6. **Help**:
   - `"foodie help"` - List available commands

**Smart Category Detection** (for add item):
- Produce: apple, banana, lettuce, tomato, onion, potato, carrot, pepper, spinach, broccoli, cucumber
- Dairy: milk, cheese, yogurt, butter, cream, egg
- Meat: chicken, beef, pork, turkey, bacon, sausage, steak, ground
- Seafood: fish, salmon, tuna, shrimp, crab, lobster
- Bakery: bread, bagel, muffin, donut, cake, cookie, roll
- Frozen: frozen, ice cream, pizza
- Beverages: juice, soda, water, coffee, tea, beer, wine
- Snacks: chips, crackers, popcorn, candy, chocolate
- Default: Pantry

**Voice Feedback**:
- Speech rate: 0.55
- Volume: 1.0
- Language: en-US

---

#### **Services/VoiceInputManager.swift** (169 lines)
**Purpose**: Voice input for adding items (used in AddItemView)

**Published Properties**:
- `@Published var isListening: Bool` - Listening status
- `@Published var recognizedText: String` - Recognized speech
- `@Published var isAuthorized: Bool` - Authorization status
- `@Published var authorizationError: String?` - Error message

**Voice Recognition**:
- Locale: `en-US`
- Partial results enabled
- Automatic stop on final result

**Key Methods**:
1. `requestAuthorization()` - Request speech recognition permission
2. `startListening()` - Start voice input
3. `stopListening()` - Stop voice input
4. `parseItemFromText(_ text: String) -> (quantity: String, name: String)` - Parse quantity and name

**Quantity Parsing**:
- Regex pattern: `^(\d+(?:\.\d+)?(?:\s*(?:pounds?|lbs?|oz|ounces?|cups?|...)))\s+(.+)$`
- Supports: pounds, lbs, oz, ounces, cups, tbsp, tsp, gallons, quarts, pints, grams, kg, liters, ml
- Returns `(quantity: "", name: text)` if no quantity detected

---

### 1.4 Views (5 files)

#### **Views/ContentView.swift** (441 lines)
**Purpose**: Main shopping list view with store tabs, search, and grouping

**Environment Objects**:
- `@EnvironmentObject var connection: ConnectionManager`
- `@EnvironmentObject var store: ShoppingListStore`
- `@EnvironmentObject var voiceInput: VoiceInputManager`
- `@EnvironmentObject var voiceCommand: VoiceCommandManager`

**State**:
- `@State private var showSettings: Bool` - Settings sheet
- `@State private var showAddItem: Bool` - Add item sheet
- `@State private var groupBy: GroupBy` - Grouping mode

**Grouping Options**:
```swift
enum GroupBy: String, CaseIterable {
    case category = "Category"
    case none = "No Grouping"
}
```

**UI Components**:

1. **Sync Status Banner** (`SyncStatusBanner`):
   - Shows: syncing, success, failed states
   - Auto-dismisses after 3 seconds

2. **Progress Bar**:
   - Displays: `X of Y items`
   - Connection status indicator (green/gray dot)
   - Last sync timestamp (relative)

3. **Store Tabs** (horizontal scroll):
   - Shows: All Stores + individual stores
   - Item count badges
   - Store-specific icons:
     - Walmart: `building.2`
     - Target: `target`
     - Kroger: `cart`
     - Whole Foods: `leaf`
     - Trader Joe's: `storefront`
     - Default: `storefront.fill`

4. **Search Bar**:
   - Real-time filtering
   - Clear button when text present

5. **Shopping List**:
   - Grouped by category or ungrouped
   - Category headers with icons:
     - Produce: `leaf.fill`
     - Dairy: `drop.fill`
     - Meat: `hare.fill`
     - Seafood: `fish.fill`
     - Bakery: `birthday.cake.fill`
     - Frozen: `snowflake`
     - Pantry: `cabinet.fill`
     - Beverages: `cup.and.saucer.fill`
     - Snacks: `popcorn.fill`

6. **Swipe Actions**:
   - Leading: Check/Uncheck (full swipe)
   - Trailing: Delete (full swipe, destructive)

7. **Context Menu**:
   - Toggle purchase status
   - Delete item

**Toolbar**:
- **Leading**: Menu with grouping options and "Clear Purchased"
- **Trailing**: Sync button (disabled when offline or no pending changes)
- **Trailing**: Add item button
- **Trailing**: Settings button

**Empty States**:
- No items: "No Shopping List" with connect prompt
- No search results: "No Results" with suggestion

---

#### **Views/AddItemView.swift** (148 lines)
**Purpose**: Add new shopping item manually or via voice

**Environment Objects**:
- `@EnvironmentObject var store: ShoppingListStore`
- `@EnvironmentObject var voiceInput: VoiceInputManager`
- `@Environment(\.dismiss) var dismiss`

**State**:
- `@State private var itemName: String` - Item name
- `@State private var quantity: String` - Quantity (optional)
- `@State private var category: String` - Category (default: "Other")
- `@State private var useVoiceInput: Bool` - Voice input toggle

**UI Components**:
1. **Item Details Section**:
   - Text field for item name
   - Voice input button (if authorized)
   - Listening indicator (spinner + "Listening...")
   - Quantity field (optional)

2. **Category Section**:
   - Picker with all categories
   - Menu style

3. **Authorization Error**:
   - Warning icon + error message (if not authorized)

**Voice Integration**:
- `onChange(of: voiceInput.recognizedText)` - Auto-populate fields from speech
- Uses `parseItemFromText()` to extract quantity and name
- Automatically stops listening after adding item

**Toolbar**:
- **Leading**: Cancel button (stops listening if active)
- **Trailing**: Add button (disabled if name is empty)

**Haptic Feedback**:
- Success notification on add

---

#### **Views/SettingsView.swift** (245 lines)
**Purpose**: App settings, connection management, voice control

**Environment Objects**:
- `@EnvironmentObject var connection: ConnectionManager`
- `@EnvironmentObject var voiceCommand: VoiceCommandManager`
- `@Environment(\.dismiss) var dismiss`

**State**:
- `@State private var serverAddress: String` - WebSocket URL
- `@State private var showingConnectionHelp: Bool` - Help alert
- `@State private var showingVoiceHelp: Bool` - Voice commands help alert

**Sections**:

1. **Status**:
   - Connection indicator (green/red)
   - Connected/Not Connected text

2. **Desktop Mac**:
   - WebSocket address field (URL keyboard, monospaced font)
   - Example: `ws://192.168.1.100:8080`
   - Help button: "How to find this address"
   - Footer: Instructions for switching between Macs

3. **Actions**:
   - "Save & Connect" / "Reconnect" button
   - "Disconnect" button (destructive, if connected)

4. **Voice Control**:
   - Authorization status (green checkmark / orange X)
   - "Enable" button (if not authorized)
   - "Voice Commands" toggle
   - "Continuous Listening" toggle (if listening)
   - Wake word display: "Foodie"
   - Mode explanation (continuous vs single-command)
   - Last command display
   - "Voice Commands Guide" button

5. **About**:
   - App version: 1.0.0
   - Device ID (first 8 chars of UUID)

**Help Alerts**:

1. **Connection Help**:
   ```
   Your Mac:
   1. Open Foodie desktop app
   2. Click the 📱 companion button
   3. Copy the WebSocket address (e.g., ws://192.168.1.100:8080)
   4. Paste it here
   
   Wife's Mac:
   Follow the same steps on her Mac. Switch between Macs anytime by changing this address!
   
   Both devices must be on the same WiFi network.
   ```

2. **Voice Commands Guide**:
   ```
   Say "Foodie" followed by:
   
   Store Switching:
   • "Show Walmart" / "Show all stores"
   • "List stores" / "How many stores"
   
   Item Actions:
   • "Check milk" / "Uncheck eggs"
   • "Delete bread" / "Clear checked"
   • "Check all" / "Uncheck all"
   
   Information:
   • "How many items" / "What's left"
   • "Read list" / "List categories"
   
   Search:
   • "Search for chicken"
   • "Clear search"
   
   Say "Foodie help" for this list.
   ```

**Auto-Dismiss**:
- Dismisses 2 seconds after successful connection

**Haptic Feedback**:
- Success notification on connect

---

#### **Views/ShoppingItemRow.swift** (110 lines)
**Purpose**: Individual shopping item row component

**Props**:
- `let item: ShoppingItem` - Item data
- `let onToggle: () -> Void` - Toggle callback

**Layout**:
1. **Checkbox** (left):
   - Circle (unchecked) / Checkmark circle (checked)
   - 32pt font size
   - Gray (unchecked) / Green (checked)
   - Tappable

2. **Item Details** (center):
   - Item name (strikethrough if purchased)
   - Quantity (caption, secondary color)
   - User assignments (PHASE 4.5.7): `"For: Alice, Bob"` (blue)
   - Manual flag: `"Added while shopping"` (blue)

3. **Category Badge** (right):
   - Category name
   - Gray background
   - Rounded corners

**Accessibility**:
- Combined accessibility element
- Label: `"[name], [quantity]"`
- Trait: `.isSelected` (if purchased)
- Hint: "Tap to mark as purchased" / "Tap to unmark"

**Tap Gesture**:
- Full row tappable to toggle purchase status

---

#### **Views/SyncStatusBanner.swift** (68 lines)
**Purpose**: Sync status notification banner

**Props**:
- `let status: ConnectionManager.SyncStatus`

**Layout**:
- Icon + message text
- Background color based on status
- Horizontal padding
- Vertical padding (12pt)

**Status Styling**:
- **Syncing**: Blue background, spinner icon
- **Success**: Green background, checkmark icon
- **Failed**: Red background, warning triangle icon
- **Idle**: Transparent (no display)

**Transition**:
- `.move(edge: .top).combined(with: .opacity)`

---

### 1.5 Extensions (1 file)

#### **Extensions/View+Extensions.swift** (61 lines)
**Purpose**: SwiftUI view utilities and date formatting

**View Extensions**:
```swift
func placeholder<Content: View>(
    when shouldShow: Bool,
    alignment: Alignment = .leading,
    @ViewBuilder placeholder: () -> Content
) -> some View
```
- Shows placeholder when text is empty

**Date Extensions**:
```swift
extension Date {
    func formatted(_ style: RelativeFormatStyle) -> String
}

struct RelativeFormatStyle {
    enum Presentation { case named, case numeric }
    static func relative(presentation: Presentation) -> RelativeFormatStyle
    func format(_ date: Date) -> String
}
```
- Formats dates as relative strings:
  - `< 60s`: "just now"
  - `< 1h`: "Xm ago"
  - `< 1d`: "Xh ago"
  - `< 1w`: "Xd ago"
  - `>= 1w`: Short date format

---

## 2. Main Components Summary

### 2.1 Connection Manager
**File**: `Services/ConnectionManager.swift`

**Key Responsibilities**:
- WebSocket connection lifecycle
- Network monitoring and auto-reconnect
- Message sending/receiving
- Keep-alive pings
- Connection state management

**Connection Flow**:
1. Load saved server address from UserDefaults
2. Start network monitoring
3. Auto-connect on app launch (if address exists)
4. Send device ID and type in headers
5. Receive `connected` message
6. Start ping timer (30s intervals)
7. Request shopping list

**Reconnection Strategy**:
- Exponential backoff: delay = min(attempt * 2, 30)s
- Max 5 attempts
- Resets on successful connection
- Triggers on network availability

---

### 2.2 Shopping List Store
**File**: `Services/ShoppingListStore.swift`

**Key Responsibilities**:
- Shopping list state management
- Local persistence (UserDefaults)
- Pending sync tracking
- Server data merging
- Item filtering and grouping
- Pantry sync notifications

**Persistence**:
- `savedShoppingList` - JSON encoded items
- `pendingSync` - Array of item IDs
- `lastSyncDate` - Date of last sync

**Merge Strategy**:
1. Process server items
2. Preserve local changes for pending items
3. Keep manually added items not in server list
4. Update items array
5. Save to local storage

---

### 2.3 Data Models
**Files**: `Models/Message.swift`, `Models/ShoppingItem.swift`

**Message**:
- Generic WebSocket message container
- Type-erased data payload
- ISO8601 timestamp

**ShoppingItem**:
- Complete shopping item representation
- Server initialization (from dict)
- Manual initialization (for add item)
- Category ordering system
- User assignment support (PHASE 4.5.7)

---

### 2.4 View Controllers
**Files**: `Views/*.swift`

**ContentView** - Main UI:
- Store tabs
- Search bar
- Shopping list (grouped/ungrouped)
- Sync status banner
- Progress bar
- Settings/Add item sheets

**AddItemView** - Add item:
- Manual text entry
- Voice input integration
- Category picker
- Haptic feedback

**SettingsView** - Configuration:
- Connection settings
- Voice control settings
- Help alerts
- Device info

---

### 2.5 WebSocket Message Handlers

**Received Messages** (from desktop):
1. `connected` - Connection established
   - Sets `isConnected = true`
   - Starts ping timer
   - Requests shopping list

2. `pong` - Keep-alive response
   - No action (just maintains connection)

3. `shopping_list` - Full shopping list
   - Updates store with new items
   - Shows success banner

4. `shopping_list_update` - Incremental update
   - Updates store with new items
   - Shows success banner

5. `sync_confirmed` - Sync acknowledgment
   - Clears pending sync
   - Shows success banner

**Sent Messages** (to desktop):

1. `ping` - Keep-alive
   ```json
   { "type": "ping", "timestamp": "..." }
   ```

2. `request_shopping_list` - Request full list
   ```json
   { "type": "request_shopping_list", "timestamp": "..." }
   ```

3. `sync_changes` - Sync local changes
   ```json
   {
       "type": "sync_changes",
       "data": [
           {
               "id": "abc123",
               "isPurchased": true,
               "isManuallyAdded": false,
               "name": "milk",
               "quantity": "1 gallon",
               "category": "Dairy"
           },
           {
               "id": "def456",
               "isDeleted": true
           }
       ],
       "timestamp": "..."
   }
   ```

4. `item_removed` - Item deleted (return to pantry)
   ```json
   {
       "type": "item_removed",
       "ingredient": "milk",
       "qty": 1.0,
       "unit": "gallon",
       "itemId": "abc123"
   }
   ```

5. `item_unpurchased` - Item unmarked (return to pantry)
   ```json
   {
       "type": "item_unpurchased",
       "ingredient": "milk",
       "qty": 1.0,
       "unit": "gallon",
       "itemId": "abc123"
   }
   ```

---

## 3. All WebSocket Message Types

### 3.1 iPhone App Handles (Receives)
| Type | Handler | Purpose |
|------|---------|---------|
| `connected` | `handleMessage()` | Connection established |
| `pong` | `handleMessage()` | Keep-alive response |
| `shopping_list` | `handleMessage()` | Full shopping list |
| `shopping_list_update` | `handleMessage()` | Incremental update |
| `sync_confirmed` | `handleMessage()` | Sync acknowledgment |

### 3.2 iPhone App Sends
| Type | Method | Purpose |
|------|--------|---------|
| `ping` | `sendPing()` | Keep-alive |
| `request_shopping_list` | `requestShoppingList()` | Request full list |
| `sync_changes` | `syncNow()` | Sync local changes |
| `item_removed` | `notifyItemRemoved()` | Item deleted (pantry sync) |
| `item_unpurchased` | `notifyItemUnpurchased()` | Item unmarked (pantry sync) |

### 3.3 Desktop Handles (From iPhone)
Based on `main.js` analysis:
| Type | Handler | Purpose |
|------|---------|---------|
| `ping` | `handleMessage()` | Keep-alive |
| `request_shopping_list` | `sendShoppingList()` | Send full list |
| `sync_changes` | `handleSyncChanges()` | Update items |
| `item_removed` | `handleItemRemoved()` | Return to pantry |
| `item_unpurchased` | `handleItemUnpurchased()` | Return to pantry |

**Missing from iPhone** (desktop can send, but iPhone doesn't use):
- `request_meal_plan` - iPad only
- `request_recipe` - iPad only

---

## 4. All Data Models and Properties

### 4.1 ShoppingItem
```swift
struct ShoppingItem: Identifiable, Codable, Equatable {
    let id: String                // Unique identifier
    var name: String              // Ingredient name
    var quantity: String          // Quantity text (e.g., "2 cups")
    var category: String          // Category name
    var store: String?            // Store assignment (optional)
    var isPurchased: Bool         // Purchase status
    let receivedAt: Date          // Timestamp when received
    var isManuallyAdded: Bool     // Added while shopping flag
    var forUsers: [String]        // User assignments (PHASE 4.5.7)
}
```

**Static Properties**:
- `categoryOrder: [String]` - Ordered categories for sorting

**Computed Properties**:
- `categoryIndex: Int` - Index in category order

---

### 4.2 Message
```swift
struct Message: Codable, @unchecked Sendable {
    let type: String              // Message type identifier
    let data: AnyCodable?         // Payload (any JSON-compatible type)
    let timestamp: String         // ISO8601 timestamp
}
```

---

### 4.3 AnyCodable
```swift
struct AnyCodable: Codable, @unchecked Sendable {
    let value: Any                // Type-erased value
}
```

**Supported Types**:
- `Bool`, `Int`, `Double`, `String`
- `[Any]` (arrays)
- `[String: Any]` (dictionaries)
- `NSNull` (null values)

---

### 4.4 ConnectionManager.SyncStatus
```swift
enum SyncStatus: Equatable {
    case idle
    case syncing
    case success
    case failed(String)
    
    var message: String { ... }
}
```

---

### 4.5 RelativeFormatStyle
```swift
struct RelativeFormatStyle {
    enum Presentation {
        case named
        case numeric
    }
    let presentation: Presentation
}
```

---

## 5. Missing Features (Compared to Desktop)

### 5.1 Features Present in Desktop but Missing in iPhone

1. **Recipe Management**:
   - No recipe browsing
   - No recipe viewing
   - No recipe search
   - No recipe import/scraping
   - **Reason**: iPhone is shopping-focused, not meal planning

2. **Meal Planning**:
   - No meal plan view
   - No drag-and-drop planning
   - No calendar integration
   - **Reason**: Meal planning is desktop/iPad feature

3. **Pantry Management**:
   - No pantry view/editing
   - Can only return items to pantry (one-way)
   - **Reason**: Shopping-focused app

4. **Multi-User Management**:
   - Cannot create/edit users
   - Can only see user assignments on items
   - **Reason**: Configuration is desktop-only

5. **Store Management**:
   - Cannot add/edit stores
   - Can only filter by existing stores
   - **Reason**: Configuration is desktop-only

6. **Settings/Preferences**:
   - No recipe scraper configuration
   - No database management
   - No app preferences
   - **Reason**: Desktop manages all configuration

7. **Printing**:
   - No print functionality
   - **Reason**: Mobile device limitation

8. **Google Calendar Sync**:
   - No calendar integration
   - **Reason**: Desktop-only feature

9. **Advanced Editing**:
   - Cannot edit item details (quantity, category, store)
   - Can only add/delete/toggle purchase
   - **Reason**: Simplified shopping experience

10. **Statistics/Reports**:
    - No analytics
    - No usage reports
    - **Reason**: Desktop feature

---

### 5.2 Features Present in iPhone but Missing/Different in Desktop

1. **Voice Commands**:
   - Wake-word voice control ("Foodie")
   - Hands-free shopping navigation
   - Voice item addition
   - **Status**: iPhone-specific feature

2. **Swipe Gestures**:
   - Full swipe to check/delete
   - **Status**: Mobile-specific interaction

3. **Store Tabs**:
   - Horizontal scrolling store selector
   - **Status**: Mobile-optimized UI (desktop uses different layout)

4. **Screen Wake Lock**:
   - Keeps screen on while app active
   - **Status**: Mobile-specific feature for hands-free shopping

5. **Offline-First Design**:
   - Full local persistence
   - Pending sync queue
   - Graceful offline operation
   - **Status**: Mobile-optimized for unreliable connections

---

### 5.3 Feature Parity Status

| Feature | Desktop | iPhone | iPad | Notes |
|---------|---------|--------|------|-------|
| **Shopping List** | ✅ | ✅ | ❌ | iPhone is primary shopping companion |
| **Recipe Viewing** | ✅ | ❌ | ✅ | iPad is kitchen companion |
| **Meal Planning** | ✅ | ❌ | ✅ | Desktop/iPad only |
| **Pantry Management** | ✅ | ⚠️ | ❌ | iPhone can return items only |
| **Voice Commands** | ❌ | ✅ | ✅ | Mobile-only feature |
| **WebSocket Sync** | ✅ | ✅ | ✅ | All platforms |
| **User Assignments** | ✅ | ✅ | ✅ | PHASE 4.5.7 complete |
| **Store Management** | ✅ | ⚠️ | ⚠️ | View only on mobile |
| **Google Calendar** | ✅ | ❌ | ❌ | Desktop-only |
| **Recipe Scraping** | ✅ | ❌ | ❌ | Desktop-only |

**Legend**:
- ✅ Full support
- ⚠️ Partial/read-only support
- ❌ Not supported

---

## 6. Architecture Highlights

### 6.1 SwiftUI + Combine
- Reactive UI with `@Published` properties
- Environment objects for dependency injection
- Declarative view composition

### 6.2 Offline-First Design
- Local persistence via UserDefaults
- Pending sync queue
- Optimistic UI updates
- Graceful degradation when offline

### 6.3 WebSocket Communication
- Real-time bidirectional sync
- Automatic reconnection
- Keep-alive mechanism
- Network monitoring

### 6.4 Voice Integration
- Wake-word detection ("Foodie")
- Natural language command parsing
- Text-to-speech feedback
- Smart category detection

### 6.5 Pantry Sync
- Automatic return to pantry on delete
- Automatic return to pantry on uncheck
- Quantity parsing (fractions, decimals)
- Unit extraction

### 6.6 Multi-Mac Support
- Single server address field
- Easy switching between Macs
- Auto-connect on network change
- Persistent connection settings

---

## 7. Technical Specifications

### 7.1 iOS Requirements
- **Minimum iOS Version**: Not specified (likely iOS 15+)
- **Language**: Swift 5.x
- **Framework**: SwiftUI
- **Reactive**: Combine

### 7.2 Privacy Requirements (Info.plist)
Based on usage, app requires:
1. **Speech Recognition** (`NSSpeechRecognitionUsageDescription`):
   - "We need access to speech recognition for voice commands while shopping."

2. **Microphone** (`NSMicrophoneUsageDescription`):
   - "We need access to your microphone for voice input and commands."

3. **Local Network** (if using mDNS):
   - "We need access to your local network to connect to the Foodie desktop app."

### 7.3 Capabilities Required
- Network access (WebSocket)
- Speech recognition
- Microphone
- Background audio (optional, for voice commands)

### 7.4 Third-Party Dependencies
**None** - Pure Swift/SwiftUI implementation with Apple frameworks:
- Foundation
- SwiftUI
- Combine
- Speech
- AVFoundation
- Network

---

## 8. Code Quality Observations

### 8.1 Strengths
1. **Clean Architecture**: Clear separation of concerns (Models, Views, Services)
2. **Type Safety**: Strong use of Swift's type system
3. **Reactive Design**: Proper use of Combine and SwiftUI publishers
4. **Error Handling**: Graceful fallbacks and error states
5. **Accessibility**: VoiceOver support in ShoppingItemRow
6. **Documentation**: Comprehensive comments and PHASE markers

### 8.2 Potential Improvements
1. **Hardcoded Strings**: Category names, commands, etc. could be localized
2. **Magic Numbers**: Some constants (30s ping, 2s debounce) could be extracted
3. **Parsing Logic**: Voice command parsing is fragile (string matching)
4. **Error Recovery**: Some error states don't notify user
5. **Testing**: No unit tests visible (test target may exist)

---

## 9. File Count and Lines of Code

| Category | Files | Total Lines | Avg Lines/File |
|----------|-------|-------------|----------------|
| **Models** | 2 | 167 | 84 |
| **Services** | 4 | 1,410 | 353 |
| **Views** | 5 | 1,012 | 202 |
| **Extensions** | 1 | 61 | 61 |
| **App** | 1 | 41 | 41 |
| **TOTAL** | **13** | **2,691** | **207** |

---

## 10. Dependency Graph

```
FoodieShoppingListApp (entry point)
├── ConnectionManager (state)
│   └── ShoppingListStore (weak reference)
├── ShoppingListStore (state)
│   └── ConnectionManager (weak reference)
├── VoiceInputManager (state)
├── VoiceCommandManager (state)
│   └── ShoppingListStore (weak reference)
└── ContentView (UI)
    ├── ConnectionManager (environment)
    ├── ShoppingListStore (environment)
    ├── VoiceInputManager (environment)
    ├── VoiceCommandManager (environment)
    ├── SettingsView (sheet)
    │   ├── ConnectionManager (environment)
    │   └── VoiceCommandManager (environment)
    ├── AddItemView (sheet)
    │   ├── ShoppingListStore (environment)
    │   └── VoiceInputManager (environment)
    ├── ShoppingItemRow (component)
    └── SyncStatusBanner (component)
```

---

## 11. WebSocket Protocol Summary

### 11.1 Connection Flow
```
1. iPhone → Desktop: WebSocket connection
   Headers: X-Device-ID, X-Device-Type: "iphone"

2. Desktop → iPhone: {"type": "connected", ...}
   iPhone sets isConnected = true

3. iPhone → Desktop: {"type": "request_shopping_list", ...}

4. Desktop → iPhone: {"type": "shopping_list", "data": [...], ...}
   iPhone updates local store

5. Every 30s: iPhone → Desktop: {"type": "ping", ...}
   Desktop → iPhone: {"type": "pong", ...}
```

### 11.2 Sync Flow
```
1. User checks/unchecks/deletes item
   → Item ID added to pendingSync set
   → Local storage updated

2. User taps sync button (or auto-sync)
   iPhone → Desktop: {"type": "sync_changes", "data": [...], ...}

3. Desktop processes changes, updates database

4. Desktop → iPhone: {"type": "sync_confirmed", "data": {...}, ...}
   iPhone clears pendingSync

5. Desktop → All devices: {"type": "shopping_list_update", "data": [...], ...}
   All devices update their local state
```

### 11.3 Pantry Sync Flow
```
1. User deletes item or unchecks item
   → Item removed/updated in local store
   → Item ID added to pendingSync

2. Pantry notification sent:
   iPhone → Desktop: {"type": "item_removed" or "item_unpurchased", ...}
   Includes: ingredient name, quantity, unit

3. Desktop returns item to pantry:
   - Parses quantity and unit
   - Finds matching pantry item (ingredient + unit)
   - Adds quantity back to pantry

4. Desktop sends update:
   Desktop → iPhone: {"type": "sync_confirmed", ...}
```

---

## 12. Voice Command Examples

### 12.1 Store Switching
```
"Foodie show all stores"        → selectedStore = "All Stores"
"Foodie show Walmart"           → selectedStore = "Walmart"
"Foodie list stores"            → Speaks: "Stores: Walmart, Target, Kroger"
"Foodie how many stores"        → Speaks: "3 stores"
```

### 12.2 Item Actions
```
"Foodie check milk"             → Marks milk as purchased
"Foodie uncheck eggs"           → Unmarks eggs
"Foodie delete bread"           → Deletes bread (returns to pantry)
"Foodie add chicken"            → Adds chicken to list (Meat category)
"Foodie add milk to Walmart"    → Adds milk to Walmart store
```

### 12.3 Bulk Actions
```
"Foodie check all"              → Marks all items as purchased
"Foodie uncheck all"            → Unmarks all items
"Foodie clear checked"          → Deletes all purchased items
```

### 12.4 Information
```
"Foodie how many items"         → Speaks: "15 total items, 8 remaining"
"Foodie read list"              → Reads first 10 unchecked items
"Foodie what's left"            → Speaks: "8 items remaining"
"Foodie list categories"        → Speaks: "Categories: Produce, Dairy, Meat"
```

### 12.5 Search
```
"Foodie search for chicken"     → searchText = "chicken"
"Foodie clear search"           → searchText = ""
```

---

## 13. Conclusion

The FoodieShoppingList iPhone app is a well-architected, focused companion app for grocery shopping. It excels in:

1. **Real-time sync** with desktop via WebSocket
2. **Voice commands** for hands-free shopping
3. **Offline-first** design with pending sync queue
4. **Pantry integration** (return items to pantry)
5. **Clean SwiftUI** architecture with Combine

The app deliberately limits features to focus on the shopping experience, deferring meal planning, recipe management, and configuration to the desktop app. This creates a clear separation of concerns and optimal UX for each platform.

**Key Differentiators**:
- Wake-word voice control ("Foodie")
- Store-based organization and filtering
- Full offline support with sync queue
- Pantry return mechanism (unique to iPhone)
- Multi-Mac support (easy switching)

**Missing Desktop Features** (by design):
- Recipe management
- Meal planning
- Pantry editing
- User management
- Store configuration
- Google Calendar sync

The iPhone app is **production-ready** and feature-complete for its intended purpose: hands-free grocery shopping with real-time sync to the desktop meal planning system.
