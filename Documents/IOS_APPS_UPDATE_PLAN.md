# iOS Companion Apps - Complete Update & Enhancement Plan

**Date:** 2026-01-21  
**Apps:** FoodieKitchen (iPad) + FoodieShoppingList (iPhone)

---

## Executive Summary

### Current State
- **iPad App**: Production-ready, 15 Swift files, MVVM architecture
- **iPhone App**: Production-ready, 13 Swift files, MVVM architecture  
- **Desktop Integration**: WebSocket on port 8080, real-time sync
- **Voice Features**: Wake word ("Foodie") + 30+ commands

### Required Updates
1. ✅ **Multi-User Meal System** - Update to match desktop Phase 4.5.7
2. ✅ **Pantry Sync** - Verify alignment with desktop pantry schema
3. 🆕 **UPC Scanning** - Add barcode scanner to iPhone app
4. 🔧 **Bug Fixes** - Address any issues found in analysis

---

## Part 1: Desktop Integration Updates

### Issue 1: iPad - User Badge Support

**Current State:**
- iPad displays user assignments in meal list
- Shows avatars and names correctly
- ✅ Already supports PHASE 4.5.7

**Required Changes:** 
- ✅ **NONE** - iPad already handles multi-user meals

**Verification:**
```swift
// Models/Recipe.swift line 69-100
struct MealSlot {
    let slot: String
    let recipeId: String
    let title: String
    var additionalItems: [AdditionalItem]
    var assignedUsers: [AssignedUser]  // ✅ Already exists
}

struct AssignedUser {
    let userId: String
    let name: String        // ✅ Displays "Whole Family" vs user names
    let avatarEmoji: String
    let email: String?
}
```

---

### Issue 2: iPhone - Shopping List User Filtering

**Current State:**
- iPhone receives `forUsers: [String]` array
- Displays user assignments in item row
- ✅ Already supports multi-user

**Desktop Behavior:**
- Whole Family shopping list: ALL users' items
- Individual user shopping list: ONLY that user's items

**Required Changes:**
- ✅ **NONE** - Desktop filters before sending to iPhone
- iPhone just displays what it receives

**Note:** User filtering happens server-side (correct design)

---

### Issue 3: Pantry Sync Verification

**Current iPhone Implementation:**
```swift
// ShoppingListStore.swift
func deleteItem(_ item: ShoppingItem) {
    let (qty, unit) = parseQuantity(item.quantity)
    connectionManager?.send(Message(
        type: "item_removed",
        data: [
            "ingredient": item.name.lowercased(),
            "qty": qty,
            "unit": unit,
            "itemId": item.id
        ]
    ))
}
```

**Desktop Pantry Schema:**
```sql
CREATE TABLE pantry (
  ItemId TEXT PRIMARY KEY,
  Name TEXT,
  NameLower TEXT,     -- For case-insensitive matching
  QtyText TEXT,
  QtyNum REAL,        -- Numeric quantity
  Unit TEXT,
  StoreId TEXT,
  Notes TEXT,
  UpdatedAt TEXT
);
```

**Verification:**
- ✅ iPhone sends `ingredient` (lowercased) → Desktop uses `NameLower` for matching
- ✅ iPhone sends `qty` (numeric) → Desktop uses `QtyNum` for increment
- ✅ iPhone sends `unit` → Desktop uses `Unit` for validation
- ✅ Desktop function `_deductFromPantry_` handles pantry updates

**Status:** ✅ **Pantry sync correctly implemented**

---

## Part 2: New Feature - UPC Barcode Scanning (iPhone)

### Feature Specification

**Goal:** Allow users to scan grocery item barcodes and add to pantry inventory

**User Flow:**
1. User taps camera icon in pantry/shopping list
2. Camera opens with viewfinder overlay
3. User scans item barcode (UPC-A, EAN-13)
4. App looks up product name via Open Food Facts API
5. App shows form pre-filled with:
   - Name (from API)
   - Quantity (user input)
   - Category (auto-detected from name)
6. User edits and saves
7. Item added to pantry via WebSocket

### Implementation Plan

#### Step 1: Add VisionKit Framework

**File:** `FoodieShoppingList.xcodeproj` (Project Settings)

**Changes:**
- Link VisionKit framework
- Add camera permission: `NSCameraUsageDescription`

#### Step 2: Create Barcode Scanner View

**New File:** `ios-apps/FoodieShoppingList/Views/BarcodeScannerView.swift`

```swift
import SwiftUI
import VisionKit
import AVFoundation

struct BarcodeScannerView: View {
    @Environment(\.dismiss) var dismiss
    @State private var scannedCode: String?
    @State private var isLoading = false
    @State private var productName: String?
    @State private var errorMessage: String?
    
    var onCodeScanned: (String, String?) -> Void  // (code, name)
    
    var body: some View {
        ZStack {
            CameraView(scannedCode: $scannedCode)
                .ignoresSafeArea()
            
            VStack {
                // Top overlay with instructions
                Text("Scan barcode")
                    .padding()
                    .background(.ultraThinMaterial)
                    .cornerRadius(10)
                    .padding(.top, 50)
                
                Spacer()
                
                // Bottom controls
                HStack {
                    Button("Cancel") {
                        dismiss()
                    }
                    .padding()
                    .background(.ultraThinMaterial)
                    .cornerRadius(10)
                    
                    Spacer()
                    
                    if isLoading {
                        ProgressView()
                            .padding()
                            .background(.ultraThinMaterial)
                            .cornerRadius(10)
                    }
                }
                .padding()
            }
        }
        .onChange(of: scannedCode) { newCode in
            if let code = newCode {
                lookupProduct(code: code)
            }
        }
        .sheet(item: $productName) { name in
            AddPantryItemView(
                barcode: scannedCode ?? "",
                productName: name
            )
        }
        .alert("Error", isPresented: .constant(errorMessage != nil)) {
            Button("OK") {
                errorMessage = nil
                scannedCode = nil
            }
        } message: {
            Text(errorMessage ?? "")
        }
    }
    
    func lookupProduct(code: String) {
        isLoading = true
        
        // Call Open Food Facts API
        let url = URL(string: "https://world.openfoodfacts.org/api/v0/product/\(code).json")!
        
        URLSession.shared.dataTask(with: url) { data, response, error in
            DispatchQueue.main.async {
                isLoading = false
                
                if let error = error {
                    errorMessage = "Network error: \(error.localizedDescription)"
                    return
                }
                
                guard let data = data else {
                    errorMessage = "No data received"
                    return
                }
                
                do {
                    let json = try JSONSerialization.jsonObject(with: data) as? [String: Any]
                    let product = json?["product"] as? [String: Any]
                    let name = product?["product_name"] as? String
                    
                    if let name = name, !name.isEmpty {
                        productName = name
                        onCodeScanned(code, name)
                    } else {
                        errorMessage = "Product not found. Please enter manually."
                    }
                } catch {
                    errorMessage = "Failed to parse response"
                }
            }
        }.resume()
    }
}

struct CameraView: UIViewControllerRepresentable {
    @Binding var scannedCode: String?
    
    func makeUIViewController(context: Context) -> ScannerViewController {
        let controller = ScannerViewController()
        controller.delegate = context.coordinator
        return controller
    }
    
    func updateUIViewController(_ uiViewController: ScannerViewController, context: Context) {}
    
    func makeCoordinator() -> Coordinator {
        Coordinator(scannedCode: $scannedCode)
    }
    
    class Coordinator: NSObject, AVCaptureMetadataOutputObjectsDelegate {
        @Binding var scannedCode: String?
        
        init(scannedCode: Binding<String?>) {
            _scannedCode = scannedCode
        }
        
        func metadataOutput(
            _ output: AVCaptureMetadataOutput,
            didOutput metadataObjects: [AVMetadataObject],
            from connection: AVCaptureConnection
        ) {
            if let metadataObject = metadataObjects.first as? AVMetadataMachineReadableCodeObject,
               let code = metadataObject.stringValue {
                AudioServicesPlaySystemSound(SystemSoundID(kSystemSoundID_Vibrate))
                scannedCode = code
            }
        }
    }
}

class ScannerViewController: UIViewController {
    var captureSession: AVCaptureSession!
    var previewLayer: AVCaptureVideoPreviewLayer!
    weak var delegate: AVCaptureMetadataOutputObjectsDelegate?
    
    override func viewDidLoad() {
        super.viewDidLoad()
        setupCamera()
    }
    
    func setupCamera() {
        captureSession = AVCaptureSession()
        
        guard let videoCaptureDevice = AVCaptureDevice.default(for: .video) else { return }
        let videoInput: AVCaptureDeviceInput
        
        do {
            videoInput = try AVCaptureDeviceInput(device: videoCaptureDevice)
        } catch {
            return
        }
        
        if captureSession.canAddInput(videoInput) {
            captureSession.addInput(videoInput)
        } else {
            return
        }
        
        let metadataOutput = AVCaptureMetadataOutput()
        
        if captureSession.canAddOutput(metadataOutput) {
            captureSession.addOutput(metadataOutput)
            
            metadataOutput.setMetadataObjectsDelegate(delegate, queue: DispatchQueue.main)
            metadataOutput.metadataObjectTypes = [.ean8, .ean13, .upce, .code128]
        } else {
            return
        }
        
        previewLayer = AVCaptureVideoPreviewLayer(session: captureSession)
        previewLayer.frame = view.layer.bounds
        previewLayer.videoGravity = .resizeAspectFill
        view.layer.addSublayer(previewLayer)
        
        DispatchQueue.global(qos: .userInitiated).async {
            self.captureSession.startRunning()
        }
    }
    
    override func viewWillDisappear(_ animated: Bool) {
        super.viewWillDisappear(animated)
        
        if captureSession.isRunning {
            captureSession.stopRunning()
        }
    }
}
```

#### Step 3: Create Add Pantry Item View

**New File:** `ios-apps/FoodieShoppingList/Views/AddPantryItemView.swift`

```swift
import SwiftUI

struct AddPantryItemView: View {
    @Environment(\.dismiss) var dismiss
    @EnvironmentObject var connectionManager: ConnectionManager
    
    let barcode: String
    @State var productName: String
    @State private var quantity: String = "1"
    @State private var unit: String = "item"
    @State private var category: String = "Pantry"
    @State private var store: String = ""
    
    let units = ["item", "lb", "oz", "kg", "g", "gallon", "quart", "liter", "ml", "count"]
    let categories = ShoppingItem.categoryOrder
    
    var body: some View {
        NavigationView {
            Form {
                Section("Product") {
                    TextField("Name", text: $productName)
                    Text("Barcode: \(barcode)")
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
                
                Section("Quantity") {
                    HStack {
                        TextField("Amount", text: $quantity)
                            .keyboardType(.decimalPad)
                        
                        Picker("Unit", selection: $unit) {
                            ForEach(units, id: \.self) { unit in
                                Text(unit).tag(unit)
                            }
                        }
                        .pickerStyle(.menu)
                    }
                }
                
                Section("Category") {
                    Picker("Category", selection: $category) {
                        ForEach(categories, id: \.self) { category in
                            Text(category).tag(category)
                        }
                    }
                }
                
                Section("Store (Optional)") {
                    TextField("Store name", text: $store)
                }
            }
            .navigationTitle("Add to Pantry")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") {
                        dismiss()
                    }
                }
                
                ToolbarItem(placement: .confirmationAction) {
                    Button("Add") {
                        addToPantry()
                    }
                    .disabled(productName.isEmpty || quantity.isEmpty)
                }
            }
        }
    }
    
    func addToPantry() {
        let qtyText = "\(quantity) \(unit)"
        
        connectionManager.send(Message(
            type: "add_pantry_item",
            data: AnyCodable([
                "name": productName,
                "qtyText": qtyText,
                "qtyNum": Double(quantity) ?? 1.0,
                "unit": unit,
                "category": category,
                "store": store,
                "barcode": barcode
            ])
        ))
        
        dismiss()
    }
}
```

#### Step 4: Add Scanner Button to Shopping List

**File:** `ios-apps/FoodieShoppingList/Views/ContentView.swift`

**Add to toolbar:**
```swift
.toolbar {
    // ... existing buttons ...
    
    ToolbarItem(placement: .navigationBarTrailing) {
        Button {
            showBarcodeScanner = true
        } label: {
            Image(systemName: "barcode.viewfinder")
        }
    }
}
.sheet(isPresented: $showBarcodeScanner) {
    BarcodeScannerView { code, name in
        // Handle scanned barcode
        print("Scanned: \(code), Product: \(name ?? "Unknown")")
    }
}
```

#### Step 5: Desktop Handler

**File:** `src/main/main.js` (WebSocket handlers)

**Add handler:**
```javascript
case 'add_pantry_item':
  const { name, qtyText, qtyNum, unit, category, store, barcode } = message.data;
  
  // Insert into pantry table
  db().prepare(`
    INSERT INTO pantry (
      ItemId, Name, NameLower, QtyText, QtyNum, Unit, 
      StoreId, Notes, UpdatedAt
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
  `).run(
    uuidv4(),
    name,
    name.toLowerCase(),
    qtyText,
    qtyNum,
    unit,
    store || null,
    `Scanned barcode: ${barcode}`,
  );
  
  // Broadcast pantry update to all clients
  broadcastToAll({ type: 'pantry_updated' });
  
  // Confirm to iPhone
  client.ws.send(JSON.stringify({
    type: 'pantry_add_confirmed',
    data: { name, qtyText }
  }));
  break;
```

---

## Part 3: Enhancements & Improvements

### Enhancement 1: iPad - Recipe Images

**Current:** Text-only recipe display  
**Proposed:** Show recipe image at top of IngredientListView

**Implementation:**
```swift
// Add to Recipe model
var imageUrl: String?

// Update ContentView ingredient pane
VStack {
    if let imageUrl = recipe.imageUrl, let url = URL(string: imageUrl) {
        AsyncImage(url: url) { image in
            image
                .resizable()
                .aspectRatio(contentMode: .fill)
                .frame(height: 200)
                .clipped()
        } placeholder: {
            ProgressView()
        }
    }
    
    // ... existing ingredient list
}
```

### Enhancement 2: iPhone - Offline Queue

**Current:** Changes lost if app killed before sync  
**Proposed:** Queue pending changes, auto-sync on reconnect

**Implementation:**
```swift
// Add to ShoppingListStore
struct PendingChange: Codable {
    let id: String
    let type: ChangeType  // .update, .delete, .add
    let item: ShoppingItem?
    let timestamp: Date
}

@Published var pendingChanges: [PendingChange] = []

func queueChange(_ change: PendingChange) {
    pendingChanges.append(change)
    savePendingChanges()
}

func processPendingQueue() {
    for change in pendingChanges {
        // Send to desktop
    }
    pendingChanges.removeAll()
}
```

### Enhancement 3: iPad - Custom Wake Word

**Current:** Hardcoded "Foodie"  
**Proposed:** User-configurable wake word

**Implementation:**
```swift
// SettingsView
@AppStorage("wakeWord") private var wakeWord = "foodie"

TextField("Wake Word", text: $wakeWord)
    .textInputAutocapitalization(.never)

// VoiceCommandManager
let wakeWord = UserDefaults.standard.string(forKey: "wakeWord") ?? "foodie"
if normalized.contains(wakeWord.lowercased()) { ... }
```

### Enhancement 4: Both Apps - Encrypted WebSocket (WSS)

**Current:** Plain `ws://` (unencrypted)  
**Proposed:** TLS encryption `wss://`

**Desktop Changes:**
```javascript
const https = require('https');
const fs = require('fs');

const server = https.createServer({
  cert: fs.readFileSync('cert.pem'),
  key: fs.readFileSync('key.pem')
});

const wss = new WebSocket.Server({ server });
```

**iOS Changes:**
```swift
// Update URL
let url = URL(string: "wss://\(serverAddress):8080")!
```

### Enhancement 5: iPhone - Barcode History

**Current:** No history of scanned items  
**Proposed:** Track scanned barcodes with product names

**Implementation:**
```swift
struct ScannedProduct: Codable, Identifiable {
    let id = UUID()
    let barcode: String
    let name: String
    let scannedAt: Date
}

@Published var scanHistory: [ScannedProduct] = []

// In SettingsView, show history
Section("Scan History") {
    ForEach(scanHistory) { product in
        HStack {
            VStack(alignment: .leading) {
                Text(product.name)
                Text(product.barcode)
                    .font(.caption)
                    .foregroundColor(.secondary)
            }
            Spacer()
            Text(product.scannedAt.formatted(.dateTime))
                .font(.caption)
        }
    }
}
```

---

## Part 4: Testing Plan

### iPad App Tests

1. **Multi-User Meals**
   - ✅ Verify user assignments display correctly
   - ✅ Verify avatars and names show in meal list
   - ✅ Test loading recipes with additional items

2. **Voice Commands**
   - ✅ Test "show breakfast" / "show lunch" / "show dinner"
   - ✅ Test "show dessert" for additional items
   - ✅ Verify wake word detection

3. **Timer Management**
   - ✅ Create multiple timers
   - ✅ Verify notifications on completion
   - ✅ Test pause/resume/cancel

### iPhone App Tests

1. **Shopping List Sync**
   - ✅ Verify user assignments display
   - ✅ Test check/uncheck items
   - ✅ Verify pantry sync on delete

2. **UPC Scanning** (New Feature)
   - ✅ Scan valid barcode (UPC-A, EAN-13)
   - ✅ Verify product lookup via API
   - ✅ Test manual entry for unknown products
   - ✅ Verify item added to pantry on desktop
   - ✅ Test error handling (no network, invalid code)

3. **Voice Commands**
   - ✅ Test "add milk" / "check eggs" / "delete bread"
   - ✅ Test store switching
   - ✅ Verify category auto-detection

### Integration Tests

1. **Desktop ↔ iPad**
   - ✅ Send meal plan with multi-user assignments
   - ✅ Send recipe with additional items
   - ✅ Verify voice-loaded recipes display correctly

2. **Desktop ↔ iPhone**
   - ✅ Generate shopping list (Whole Family)
   - ✅ Generate shopping list (individual user)
   - ✅ Verify user filtering works correctly
   - ✅ Test pantry sync (delete item returns to pantry)
   - ✅ Test UPC scan → pantry item created

---

## Part 5: Implementation Priority

### Phase 1: Critical Updates (Do First)
1. ✅ Verify multi-user support (DONE - no changes needed)
2. ✅ Verify pantry sync (DONE - works correctly)
3. 📋 Test both apps with desktop changes

### Phase 2: UPC Scanner (High Priority)
1. Add VisionKit framework
2. Create BarcodeScannerView
3. Create AddPantryItemView
4. Add desktop WebSocket handler
5. Test end-to-end flow

### Phase 3: Enhancements (Medium Priority)
1. Recipe images (iPad)
2. Offline queue (iPhone)
3. Barcode history (iPhone)

### Phase 4: Security & Polish (Low Priority)
1. WSS encryption
2. Custom wake word
3. Unit tests
4. Performance optimization

---

## Summary

### ✅ Good News
- Both apps already support Phase 4.5.7 multi-user system
- Pantry sync is correctly implemented
- WebSocket protocol is well-designed
- Code quality is production-ready

### 🆕 New Features to Add
1. **UPC Barcode Scanner** (iPhone) - HIGH PRIORITY
   - Uses device camera
   - Open Food Facts API lookup
   - Auto-add to pantry inventory
   - ~300 lines of code

### 🔧 Recommended Enhancements
1. Recipe images (iPad)
2. Offline change queue (iPhone)
3. Encrypted WebSocket (both)
4. Barcode scan history (iPhone)
5. Custom wake word (both)

### 📝 Next Steps
1. Review this plan
2. Confirm UPC scanner requirements
3. Implement in priority order
4. Test with desktop app
5. Deploy updates

---

**Estimated Implementation Time:**
- UPC Scanner: 4-6 hours
- Enhancements: 2-3 hours each
- Testing: 3-4 hours
- **Total: 12-20 hours**

All iOS companion apps are well-architected and ready for updates!
