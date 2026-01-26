import Foundation
import Speech
import AVFoundation
import Combine

class VoiceCommandManager: ObservableObject {
    @Published var isListening = false
    @Published var isContinuousMode = false  // User setting: continuous vs single-command
    @Published var lastCommand = ""
    @Published var lastRecognizedText = ""
    @Published var isAuthorized = false
    
    weak var shoppingListStore: ShoppingListStore?
    
    private let speechRecognizer = SFSpeechRecognizer(locale: Locale(identifier: "en-US"))
    private var recognitionRequest: SFSpeechAudioBufferRecognitionRequest?
    private var recognitionTask: SFSpeechRecognitionTask?
    private let audioEngine = AVAudioEngine()
    private let speechSynthesizer = AVSpeechSynthesizer()
    
    private let wakeWord = "foodie"
    private var commandBuffer = ""
    private var lastCommandTime = Date()
    
    init() {
        requestAuthorization()
    }
    
    func requestAuthorization() {
        SFSpeechRecognizer.requestAuthorization { [weak self] status in
            DispatchQueue.main.async {
                self?.isAuthorized = status == .authorized
                if status == .authorized {
                    print("✅ Speech recognition authorized")
                } else {
                    print("❌ Speech recognition not authorized: \(status.rawValue)")
                }
            }
        }
    }
    
    func startListening() {
        guard isAuthorized else {
            print("⚠️ Speech recognition not authorized")
            requestAuthorization()
            return
        }
        
        if recognitionTask != nil {
            stopListening()
        }
        
        let audioSession = AVAudioSession.sharedInstance()
        do {
            try audioSession.setCategory(.playAndRecord, mode: .measurement, options: [.duckOthers, .defaultToSpeaker])
            try audioSession.setActive(true, options: .notifyOthersOnDeactivation)
        } catch {
            print("❌ Audio session error: \(error)")
            return
        }
        
        recognitionRequest = SFSpeechAudioBufferRecognitionRequest()
        
        let inputNode = audioEngine.inputNode
        guard let recognitionRequest = recognitionRequest else {
            print("❌ Unable to create recognition request")
            return
        }
        
        recognitionRequest.shouldReportPartialResults = true
        
        recognitionTask = speechRecognizer?.recognitionTask(with: recognitionRequest) { [weak self] result, error in
            guard let self = self else { return }
            
            if let result = result {
                let transcript = result.bestTranscription.formattedString.lowercased()
                
                DispatchQueue.main.async {
                    self.lastRecognizedText = transcript
                    
                    // Check for wake word
                    if transcript.contains(self.wakeWord) {
                        self.handleWakeWord(transcript: transcript)
                    }
                }
            }
            
            if error != nil {
                print("❌ Recognition error: \(String(describing: error))")
                if !self.isContinuousMode {
                    self.stopListening()
                }
            }
            
            if result?.isFinal == true && !self.isContinuousMode {
                self.stopListening()
            }
        }
        
        let recordingFormat = inputNode.outputFormat(forBus: 0)
        inputNode.installTap(onBus: 0, bufferSize: 1024, format: recordingFormat) { buffer, _ in
            recognitionRequest.append(buffer)
        }
        
        audioEngine.prepare()
        do {
            try audioEngine.start()
            isListening = true
            print("🎤 Voice recognition started (wake word: '\(wakeWord)')")
        } catch {
            print("❌ Audio engine start error: \(error)")
        }
    }
    
    func stopListening() {
        if audioEngine.isRunning {
            audioEngine.stop()
            audioEngine.inputNode.removeTap(onBus: 0)
        }
        recognitionRequest?.endAudio()
        recognitionTask?.cancel()
        recognitionRequest = nil
        recognitionTask = nil
        isListening = false
        print("🛑 Voice recognition stopped")
    }
    
    private func handleWakeWord(transcript: String) {
        // Extract command after wake word
        guard let range = transcript.range(of: wakeWord) else { return }
        let afterWakeWord = String(transcript[range.upperBound...]).trimmingCharacters(in: .whitespaces)
        
        // Debounce: ignore if same command within 2 seconds
        let now = Date()
        if afterWakeWord == commandBuffer && now.timeIntervalSince(lastCommandTime) < 2.0 {
            return
        }
        
        commandBuffer = afterWakeWord
        lastCommandTime = now
        
        if !afterWakeWord.isEmpty {
            processCommand(afterWakeWord)
        }
    }
    
    private func processCommand(_ command: String) {
        DispatchQueue.main.async {
            self.lastCommand = "foodie \(command)"
            print("🎤 Processing command: '\(command)'")
            
            let normalized = command.lowercased().trimmingCharacters(in: .whitespaces)
            
            guard let store = self.shoppingListStore else {
                self.speakFeedback("Shopping list not available")
                return
            }
            
            // Store switching commands
            if normalized.contains("show all stores") || normalized == "all stores" {
                store.selectedStore = "All Stores"
                self.speakFeedback("Showing all stores")
            }
            else if normalized.contains("show") && (normalized.contains("store") || normalized.contains("shop")) {
                // Extract store name (e.g., "show walmart", "show kroger", "show target")
                if let storeName = self.extractStoreName(from: normalized) {
                    if let matchedStore = store.availableStores.first(where: { $0.lowercased().contains(storeName.lowercased()) }) {
                        store.selectedStore = matchedStore
                        self.speakFeedback("Showing \(matchedStore)")
                    } else {
                        self.speakFeedback("\(storeName) not found")
                    }
                } else {
                    self.speakFeedback("Which store?")
                }
            }
            
            // Item count and summary commands
            else if normalized.contains("how many items") || normalized.contains("item count") {
                let count = store.filteredItems.count
                let purchasedCount = store.filteredItems.filter { $0.isPurchased }.count
                let remainingCount = count - purchasedCount
                
                if store.selectedStore == "All Stores" {
                    self.speakFeedback("\(count) total items, \(remainingCount) remaining")
                } else {
                    self.speakFeedback("\(count) items at \(store.selectedStore), \(remainingCount) remaining")
                }
            }
            else if normalized.contains("how many stores") || normalized.contains("store count") {
                let storeCount = store.availableStores.count - 1  // Exclude "All Stores"
                self.speakFeedback("\(storeCount) store\(storeCount == 1 ? "" : "s")")
            }
            else if normalized.contains("list stores") || normalized.contains("what stores") {
                let stores = store.availableStores.filter { $0 != "All Stores" }
                if stores.isEmpty {
                    self.speakFeedback("No stores available")
                } else {
                    let storeList = stores.joined(separator: ", ")
                    self.speakFeedback("Stores: \(storeList)")
                }
            }
            
            // Category commands
            else if normalized.contains("how many categories") {
                let categories = Set(store.filteredItems.map { $0.category }).count
                self.speakFeedback("\(categories) categor\(categories == 1 ? "y" : "ies")")
            }
            else if normalized.contains("list categories") || normalized.contains("what categories") {
                let categories = Set(store.filteredItems.map { $0.category }).sorted()
                if categories.isEmpty {
                    self.speakFeedback("No categories")
                } else {
                    let categoryList = categories.joined(separator: ", ")
                    self.speakFeedback("Categories: \(categoryList)")
                }
            }
            else if normalized.contains("show") && normalized.contains("category") {
                // Extract category name
                if let category = self.extractCategory(from: normalized) {
                    let items = store.filteredItems.filter { $0.category.lowercased() == category.lowercased() }
                    if items.isEmpty {
                        self.speakFeedback("No items in \(category)")
                    } else {
                        let itemNames = items.map { $0.name }.joined(separator: ", ")
                        self.speakFeedback("\(category): \(itemNames)")
                    }
                }
            }
            
            // Item reading commands
            else if normalized.contains("read list") || normalized.contains("read items") {
                let unchecked = store.filteredItems.filter { !$0.isPurchased }
                if unchecked.isEmpty {
                    self.speakFeedback("All items checked")
                } else {
                    let itemNames = unchecked.prefix(10).map { $0.name }.joined(separator: ", ")
                    let total = unchecked.count
                    if total > 10 {
                        self.speakFeedback("\(itemNames), and \(total - 10) more")
                    } else {
                        self.speakFeedback(itemNames)
                    }
                }
            }
            else if normalized.contains("read unchecked") || normalized.contains("what's left") {
                let unchecked = store.filteredItems.filter { !$0.isPurchased }
                if unchecked.isEmpty {
                    self.speakFeedback("All items checked")
                } else {
                    self.speakFeedback("\(unchecked.count) item\(unchecked.count == 1 ? "" : "s") remaining")
                }
            }
            else if normalized.contains("read checked") || normalized.contains("what's done") {
                let checked = store.filteredItems.filter { $0.isPurchased }
                if checked.isEmpty {
                    self.speakFeedback("No items checked")
                } else {
                    self.speakFeedback("\(checked.count) item\(checked.count == 1 ? "" : "s") checked")
                }
            }
            
            // Add item command (NEW)
            else if normalized.contains("add") && !normalized.contains("add timer") {
                self.handleAddItem(from: normalized, store: store)
            }
            
            // Item actions (check/uncheck by name)
            else if normalized.contains("check") || normalized.contains("mark") {
                // Extract item name (e.g., "check milk", "mark eggs")
                let itemName = self.extractItemName(from: normalized, keywords: ["check", "mark"])
                if let item = store.filteredItems.first(where: { $0.name.lowercased().contains(itemName.lowercased()) }) {
                    if !item.isPurchased {
                        store.togglePurchased(item)
                        self.speakFeedback("\(item.name) checked")
                    } else {
                        self.speakFeedback("\(item.name) already checked")
                    }
                } else if !itemName.isEmpty {
                    self.speakFeedback("\(itemName) not found")
                } else {
                    self.speakFeedback("What item?")
                }
            }
            else if normalized.contains("uncheck") {
                let itemName = self.extractItemName(from: normalized, keywords: ["uncheck"])
                if let item = store.filteredItems.first(where: { $0.name.lowercased().contains(itemName.lowercased()) }) {
                    if item.isPurchased {
                        store.togglePurchased(item)
                        self.speakFeedback("\(item.name) unchecked")
                    } else {
                        self.speakFeedback("\(item.name) already unchecked")
                    }
                } else if !itemName.isEmpty {
                    self.speakFeedback("\(itemName) not found")
                } else {
                    self.speakFeedback("What item?")
                }
            }
            else if normalized.contains("delete") || normalized.contains("remove") {
                let itemName = self.extractItemName(from: normalized, keywords: ["delete", "remove"])
                if let item = store.filteredItems.first(where: { $0.name.lowercased().contains(itemName.lowercased()) }) {
                    store.deleteItem(item)
                    self.speakFeedback("\(item.name) deleted")
                } else if !itemName.isEmpty {
                    self.speakFeedback("\(itemName) not found")
                } else {
                    self.speakFeedback("What item?")
                }
            }
            
            // Bulk actions
            else if normalized.contains("check all") || normalized.contains("mark all") {
                let unchecked = store.filteredItems.filter { !$0.isPurchased }
                for item in unchecked {
                    store.togglePurchased(item)
                }
                self.speakFeedback("\(unchecked.count) item\(unchecked.count == 1 ? "" : "s") checked")
            }
            else if normalized.contains("uncheck all") {
                let checked = store.filteredItems.filter { $0.isPurchased }
                for item in checked {
                    store.togglePurchased(item)
                }
                self.speakFeedback("\(checked.count) item\(checked.count == 1 ? "" : "s") unchecked")
            }
            else if normalized.contains("clear checked") || normalized.contains("delete checked") {
                let checked = store.filteredItems.filter { $0.isPurchased }
                for item in checked {
                    store.deleteItem(item)
                }
                self.speakFeedback("\(checked.count) item\(checked.count == 1 ? "" : "s") deleted")
            }
            
            // Search commands
            else if normalized.contains("search for") || normalized.contains("find") {
                let searchTerm = self.extractSearchTerm(from: normalized)
                if !searchTerm.isEmpty {
                    store.searchText = searchTerm
                    let results = store.filteredItems.count
                    self.speakFeedback("Found \(results) result\(results == 1 ? "" : "s")")
                } else {
                    self.speakFeedback("What to search?")
                }
            }
            else if normalized.contains("clear search") {
                store.searchText = ""
                self.speakFeedback("Search cleared")
            }
            
            // Help command
            else if normalized.contains("help") || normalized.contains("what can you do") {
                self.speakFeedback("I can switch stores, count items, check or uncheck items, read your list, and more. Try saying 'Foodie, show Walmart' or 'Foodie, how many items'")
            }
            
            else {
                self.speakFeedback("Command not recognized")
                print("⚠️ Unknown command: '\(command)'")
            }
            
            // If single-command mode, stop listening after processing
            if !self.isContinuousMode {
                DispatchQueue.main.asyncAfter(deadline: .now() + 1.0) {
                    self.stopListening()
                }
            }
        }
    }
    
    // MARK: - Add Item Handler
    
    private func handleAddItem(from command: String, store: ShoppingListStore) {
        // Extract item name from command
        // Patterns: "add milk", "add chicken breast", "add milk to walmart", "add bread to the list"
        var itemName = command
        
        // Remove trigger words
        let triggerWords = ["add", "to the list", "to list", "to my list"]
        for trigger in triggerWords {
            itemName = itemName.replacingOccurrences(of: trigger, with: "")
        }
        
        // Extract store if mentioned (e.g., "milk to walmart")
        var storeName: String? = nil
        let storeKeywords = ["to walmart", "to kroger", "to target", "to costco", "at walmart", "at kroger", "at target", "at costco"]
        
        for keyword in storeKeywords {
            if let range = itemName.range(of: keyword, options: .caseInsensitive) {
                // Extract store name
                let storeString = String(itemName[range])
                let storeComponents = storeString.components(separatedBy: .whitespaces)
                if storeComponents.count >= 2 {
                    let extractedStore = storeComponents[1].capitalized
                    // Check if it matches an existing store
                    if let matchedStore = store.availableStores.first(where: { $0.lowercased().contains(extractedStore.lowercased()) }) {
                        storeName = matchedStore
                    } else {
                        storeName = extractedStore
                    }
                }
                // Remove store portion from item name
                itemName = itemName.replacingCharacters(in: range, with: "")
                break
            }
        }
        
        // Clean up item name
        itemName = itemName.trimmingCharacters(in: .whitespaces)
        
        guard !itemName.isEmpty else {
            speakFeedback("What item should I add?")
            return
        }
        
        // Smart category detection based on keywords
        let category = detectCategory(for: itemName)
        
        // Create the new item
        let newItem = ShoppingItem(name: itemName, quantity: "", category: category)
        
        // If we extracted a store, create a mutable copy with the store
        let finalItem: ShoppingItem
        if let storeName = storeName {
            finalItem = ShoppingItem(
                id: newItem.id,
                name: newItem.name,
                quantity: newItem.quantity,
                category: newItem.category,
                store: storeName,
                isPurchased: false,
                receivedAt: newItem.receivedAt,
                isManuallyAdded: true
            )
        } else {
            finalItem = newItem
        }
        
        // Add to store
        store.addItem(finalItem)
        
        // Voice feedback
        if let storeName = storeName {
            speakFeedback("Added \(itemName) to \(storeName)")
        } else {
            speakFeedback("Added \(itemName)")
        }
        
        print("✅ Added item: \(itemName) (category: \(category)\(storeName.map { ", store: \($0)" } ?? ""))")
    }
    
    // Helper: Detect category from item name
    private func detectCategory(for itemName: String) -> String {
        let lower = itemName.lowercased()
        
        // Produce
        if lower.contains("apple") || lower.contains("banana") || lower.contains("orange") ||
           lower.contains("lettuce") || lower.contains("tomato") || lower.contains("onion") ||
           lower.contains("potato") || lower.contains("carrot") || lower.contains("pepper") ||
           lower.contains("spinach") || lower.contains("broccoli") || lower.contains("cucumber") {
            return "Produce"
        }
        
        // Dairy
        if lower.contains("milk") || lower.contains("cheese") || lower.contains("yogurt") ||
           lower.contains("butter") || lower.contains("cream") || lower.contains("egg") {
            return "Dairy"
        }
        
        // Meat
        if lower.contains("chicken") || lower.contains("beef") || lower.contains("pork") ||
           lower.contains("turkey") || lower.contains("bacon") || lower.contains("sausage") ||
           lower.contains("steak") || lower.contains("ground") {
            return "Meat"
        }
        
        // Seafood
        if lower.contains("fish") || lower.contains("salmon") || lower.contains("tuna") ||
           lower.contains("shrimp") || lower.contains("crab") || lower.contains("lobster") {
            return "Seafood"
        }
        
        // Bakery
        if lower.contains("bread") || lower.contains("bagel") || lower.contains("muffin") ||
           lower.contains("donut") || lower.contains("cake") || lower.contains("cookie") ||
           lower.contains("roll") {
            return "Bakery"
        }
        
        // Frozen
        if lower.contains("frozen") || lower.contains("ice cream") || lower.contains("pizza") {
            return "Frozen"
        }
        
        // Beverages
        if lower.contains("juice") || lower.contains("soda") || lower.contains("water") ||
           lower.contains("coffee") || lower.contains("tea") || lower.contains("beer") ||
           lower.contains("wine") {
            return "Beverages"
        }
        
        // Snacks
        if lower.contains("chips") || lower.contains("crackers") || lower.contains("popcorn") ||
           lower.contains("candy") || lower.contains("chocolate") {
            return "Snacks"
        }
        
        // Default to Pantry
        return "Pantry"
    }
    
    // MARK: - Helper Methods
    
    // Helper: Extract store name from command
    private func extractStoreName(from command: String) -> String? {
        let words = command.components(separatedBy: .whitespaces)
        var storeName = ""
        var foundShow = false
        
        for word in words {
            if word == "show" {
                foundShow = true
            } else if foundShow && word != "store" && word != "shop" {
                storeName += " \(word)"
            }
        }
        
        return storeName.trimmingCharacters(in: .whitespaces).isEmpty ? nil : storeName.trimmingCharacters(in: .whitespaces)
    }
    
    // Helper: Extract category from command
    private func extractCategory(from command: String) -> String? {
        // Common categories: produce, dairy, meat, seafood, bakery, frozen, pantry, beverages, snacks
        let categories = ["produce", "dairy", "meat", "seafood", "bakery", "frozen", "pantry", "beverages", "snacks"]
        
        for category in categories {
            if command.contains(category) {
                return category
            }
        }
        
        return nil
    }
    
    // Helper: Extract item name from command
    private func extractItemName(from command: String, keywords: [String]) -> String {
        var result = command
        
        // Remove keywords
        for keyword in keywords {
            result = result.replacingOccurrences(of: keyword, with: "")
        }
        
        return result.trimmingCharacters(in: .whitespaces)
    }
    
    // Helper: Extract search term from command
    private func extractSearchTerm(from command: String) -> String {
        let patterns = ["search for", "find"]
        var result = command
        
        for pattern in patterns {
            if let range = result.range(of: pattern) {
                result = String(result[range.upperBound...])
                break
            }
        }
        
        return result.trimmingCharacters(in: .whitespaces)
    }
    
    private func speakText(_ text: String) {
        let utterance = AVSpeechUtterance(string: text)
        utterance.voice = AVSpeechSynthesisVoice(language: "en-US")
        utterance.rate = 0.5
        speechSynthesizer.speak(utterance)
    }
    
    private func speakFeedback(_ feedback: String) {
        let utterance = AVSpeechUtterance(string: feedback)
        utterance.voice = AVSpeechSynthesisVoice(language: "en-US")
        utterance.rate = 0.55
        utterance.volume = 1.0
        speechSynthesizer.speak(utterance)
    }
}
