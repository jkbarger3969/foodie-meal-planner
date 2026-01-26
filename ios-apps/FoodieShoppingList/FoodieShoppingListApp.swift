import SwiftUI

@main
struct FoodieShoppingListApp: App {
    @StateObject private var connectionManager = ConnectionManager()
    @StateObject private var shoppingListStore = ShoppingListStore()
    @StateObject private var voiceInputManager = VoiceInputManager()
    @StateObject private var voiceCommandManager = VoiceCommandManager()
    
    var body: some Scene {
        WindowGroup {
            ContentView()
                .environmentObject(connectionManager)
                .environmentObject(shoppingListStore)
                .environmentObject(voiceInputManager)
                .environmentObject(voiceCommandManager)
                .preferredColorScheme(nil) // Respects system dark mode
                .onAppear {
                    // Set up connection between managers
                    connectionManager.shoppingListStore = shoppingListStore
                    voiceCommandManager.shoppingListStore = shoppingListStore
                    
                    // Inject connectionManager into store for pantry sync
                    shoppingListStore.connectionManager = connectionManager
                    
                    // Keep screen awake while app is active
                    UIApplication.shared.isIdleTimerDisabled = true
                    
                    // Try to auto-connect on launch
                    connectionManager.attemptAutoConnect()
                }
                .onDisappear {
                    // Re-enable screen timeout when app closes
                    UIApplication.shared.isIdleTimerDisabled = false
                    
                    // Stop voice listening when app closes
                    voiceCommandManager.stopListening()
                }
        }
    }
}
