import SwiftUI

/// Form view for adding scanned items to pantry inventory
/// Supports manual editing of barcode-scanned product information
struct AddPantryItemView: View {
    @Environment(\.dismiss) var dismiss
    @EnvironmentObject var connectionManager: ConnectionManager
    
    let barcode: String
    @State var productName: String
    @State var category: String
    
    @State private var quantity: String = "1"
    @State private var unit: String = "item"
    @State private var selectedStore: String = ""
    @State private var notes: String = ""
    @State private var isSending = false
    @State private var showSuccess = false
    
    // Common pantry units
    let units = [
        "item", "count",
        "lb", "lbs", "oz", "kg", "g",
        "gallon", "quart", "pint", "cup", "tbsp", "tsp",
        "liter", "ml", "fl oz",
        "box", "bag", "can", "jar", "bottle", "package"
    ]
    
    // All categories from ShoppingItem
    let categories = ShoppingItem.categoryOrder
    
    var body: some View {
        NavigationView {
            Form {
                Section {
                    TextField("Product Name", text: $productName)
                        .textInputAutocapitalization(.words)
                    
                    HStack {
                        Text("Barcode")
                            .foregroundColor(.secondary)
                        Spacer()
                        Text(barcode)
                            .font(.system(.body, design: .monospaced))
                            .foregroundColor(.secondary)
                    }
                } header: {
                    Label("Product Details", systemImage: "tag.fill")
                }
                
                Section {
                    HStack(spacing: 12) {
                        TextField("Amount", text: $quantity)
                            .keyboardType(.decimalPad)
                            .frame(maxWidth: 100)
                            .textFieldStyle(.roundedBorder)
                        
                        Picker("Unit", selection: $unit) {
                            ForEach(units, id: \.self) { unitOption in
                                Text(unitOption).tag(unitOption)
                            }
                        }
                        .pickerStyle(.menu)
                    }
                    
                    HStack {
                        Text("Example")
                            .foregroundColor(.secondary)
                        Spacer()
                        Text("\(quantity) \(unit)")
                            .font(.caption)
                            .padding(.horizontal, 8)
                            .padding(.vertical, 4)
                            .background(Color.blue.opacity(0.1))
                            .cornerRadius(6)
                    }
                } header: {
                    Label("Quantity", systemImage: "number")
                } footer: {
                    Text("How much to add to your pantry inventory")
                        .font(.caption)
                }
                
                Section {
                    Picker("Category", selection: $category) {
                        ForEach(categories, id: \.self) { cat in
                            HStack {
                                Image(systemName: categoryIcon(for: cat))
                                Text(cat)
                            }
                            .tag(cat)
                        }
                    }
                } header: {
                    Label("Category", systemImage: "square.grid.2x2")
                } footer: {
                    Text("Category suggestion based on product type")
                        .font(.caption)
                }
                
                Section {
                    if connectionManager.availableStores.isEmpty {
                        TextField("Store (optional)", text: $selectedStore)
                            .textInputAutocapitalization(.words)
                    } else {
                        Picker("Store", selection: $selectedStore) {
                            Text("None").tag("")
                            ForEach(connectionManager.availableStores, id: \.self) { storeName in
                                Text(storeName).tag(storeName)
                            }
                        }
                    }
                    
                    TextField("Notes (optional)", text: $notes, axis: .vertical)
                        .lineLimit(2...4)
                } header: {
                    Label("Optional Information", systemImage: "info.circle")
                }
            }
            .navigationTitle("Add to Pantry")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") {
                        dismiss()
                    }
                    .disabled(isSending)
                }
                
                ToolbarItem(placement: .confirmationAction) {
                    Button {
                        addToPantry()
                    } label: {
                        if isSending {
                            ProgressView()
                        } else {
                            Text("Add")
                                .fontWeight(.semibold)
                        }
                    }
                    .disabled(productName.isEmpty || quantity.isEmpty || isSending)
                }
            }
            .alert("Added to Pantry", isPresented: $showSuccess) {
                Button("OK") {
                    dismiss()
                }
            } message: {
                Text("\(productName) has been added to your pantry inventory on the desktop app.")
            }
        }
    }
    
    /// Send pantry item to desktop via WebSocket
    private func addToPantry() {
        guard let qtyNum = Double(quantity) else {
            return
        }
        
        isSending = true
        
        let qtyText = quantity.trimmingCharacters(in: .whitespaces) + " " + unit
        
        // Build message dictionary for WebSocket
        let messageDict: [String: Any] = [
            "type": "add_pantry_item",
            "data": [
                "name": productName,
                "qtyText": qtyText,
                "qtyNum": qtyNum,
                "unit": unit,
                "category": category,
                "store": selectedStore.isEmpty ? nil : selectedStore,
                "barcode": barcode,
                "notes": notes.isEmpty ? "Scanned via iPhone" : "Scanned via iPhone: \(notes)"
            ] as [String: Any?],
            "timestamp": ISO8601DateFormatter().string(from: Date())
        ]
        
        connectionManager.send(messageDict)
        
        // Haptic feedback
        let generator = UINotificationFeedbackGenerator()
        generator.notificationOccurred(.success)
        
        // Show success after short delay
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) {
            isSending = false
            showSuccess = true
        }
    }
    
    /// Get SF Symbol for category
    private func categoryIcon(for category: String) -> String {
        switch category {
        case "Produce": return "leaf.fill"
        case "Dairy": return "drop.fill"
        case "Meat": return "hare.fill"
        case "Seafood": return "fish.fill"
        case "Bakery": return "birthday.cake.fill"
        case "Frozen": return "snowflake"
        case "Pantry": return "cabinet.fill"
        case "Beverages": return "cup.and.saucer.fill"
        case "Snacks": return "popcorn.fill"
        default: return "square.grid.2x2"
        }
    }
}

// Preview
#Preview {
    AddPantryItemView(
        barcode: "012345678901",
        productName: "Sample Product",
        category: "Pantry"
    )
    .environmentObject(ConnectionManager())
}
