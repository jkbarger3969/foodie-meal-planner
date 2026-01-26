import SwiftUI

@main
struct FoodieKitchenApp: App {
    @StateObject private var connectionManager = ConnectionManager()
    @StateObject private var recipeStore = RecipeStore()
    @StateObject private var timerManager = TimerManager()
    @StateObject private var voiceCommandManager = VoiceCommandManager()
    
    var body: some Scene {
        WindowGroup {
            ContentView()
                .environmentObject(connectionManager)
                .environmentObject(recipeStore)
                .environmentObject(timerManager)
                .environmentObject(voiceCommandManager)
                .preferredColorScheme(nil)
                .onAppear {
                    connectionManager.recipeStore = recipeStore
                    recipeStore.connection = connectionManager
                    timerManager.connection = connectionManager
                    voiceCommandManager.recipeStore = recipeStore
                    voiceCommandManager.timerManager = timerManager
                    UIApplication.shared.isIdleTimerDisabled = true
                    connectionManager.attemptAutoConnect()
                }
                .onDisappear {
                    UIApplication.shared.isIdleTimerDisabled = false
                }
        }
    }
}
