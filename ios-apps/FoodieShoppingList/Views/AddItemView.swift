import SwiftUI

struct AddItemView: View {
    @EnvironmentObject var store: ShoppingListStore
    @EnvironmentObject var voiceInput: VoiceInputManager
    @Environment(\.dismiss) var dismiss
    
    @State private var itemName = ""
    @State private var quantity = ""
    @State private var category = "Other"
    @State private var useVoiceInput = false
    
    let categories = ShoppingItem.categoryOrder
    
    var body: some View {
        NavigationView {
            Form {
                Section("Item Details") {
                    HStack {
                        TextField("Item name", text: $itemName)
                            .textInputAutocapitalization(.words)
                            .disabled(voiceInput.isListening)
                        
                        if voiceInput.isAuthorized {
                            Button(action: toggleVoiceInput) {
                                Image(systemName: voiceInput.isListening ? "mic.fill" : "mic")
                                    .foregroundColor(voiceInput.isListening ? .red : .blue)
                                    .imageScale(.large)
                            }
                            .buttonStyle(.plain)
                        }
                    }
                    
                    if voiceInput.isListening {
                        HStack {
                            ProgressView()
                                .progressViewStyle(.circular)
                                .controlSize(.small)
                            
                            Text("Listening...")
                                .font(.caption)
                                .foregroundColor(.secondary)
                        }
                    }
                    
                    TextField("Quantity (optional)", text: $quantity)
                        .textInputAutocapitalization(.never)
                        .keyboardType(.default)
                }
                
                Section("Category") {
                    Picker("Category", selection: $category) {
                        ForEach(categories, id: \.self) { cat in
                            Text(cat).tag(cat)
                        }
                    }
                    .pickerStyle(.menu)
                }
                
                if !voiceInput.isAuthorized, let error = voiceInput.authorizationError {
                    Section {
                        HStack {
                            Image(systemName: "exclamationmark.triangle.fill")
                                .foregroundColor(.orange)
                            
                            Text(error)
                                .font(.caption)
                                .foregroundColor(.secondary)
                        }
                    }
                }
            }
            .navigationTitle("Add Item")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarLeading) {
                    Button("Cancel") {
                        if voiceInput.isListening {
                            voiceInput.stopListening()
                        }
                        dismiss()
                    }
                }
                
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button("Add") {
                        addItem()
                    }
                    .fontWeight(.semibold)
                    .disabled(itemName.trimmingCharacters(in: .whitespaces).isEmpty)
                }
            }
            .onChange(of: voiceInput.recognizedText) { oldValue, newValue in
                if !newValue.isEmpty && voiceInput.isListening {
                    // Parse voice input
                    let parsed = voiceInput.parseItemFromText(newValue)
                    itemName = parsed.name
                    if !parsed.quantity.isEmpty {
                        quantity = parsed.quantity
                    }
                }
            }
        }
    }
    
    private func toggleVoiceInput() {
        if voiceInput.isListening {
            voiceInput.stopListening()
        } else {
            itemName = ""
            quantity = ""
            voiceInput.startListening()
        }
    }
    
    private func addItem() {
        let trimmedName = itemName.trimmingCharacters(in: .whitespaces)
        guard !trimmedName.isEmpty else { return }
        
        let newItem = ShoppingItem(
            name: trimmedName,
            quantity: quantity.trimmingCharacters(in: .whitespaces),
            category: category
        )
        
        store.addItem(newItem)
        
        // Haptic feedback
        let generator = UINotificationFeedbackGenerator()
        generator.notificationOccurred(.success)
        
        if voiceInput.isListening {
            voiceInput.stopListening()
        }
        
        dismiss()
    }
}

// MARK: - Preview

struct AddItemView_Previews: PreviewProvider {
    static var previews: some View {
        AddItemView()
            .environmentObject(ShoppingListStore())
            .environmentObject(VoiceInputManager())
    }
}
