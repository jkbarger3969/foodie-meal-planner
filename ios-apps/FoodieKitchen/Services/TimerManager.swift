import Foundation
import UserNotifications
import Combine
import UIKit

class TimerManager: ObservableObject {
    @Published var timers: [TimerItem] = []
    
    weak var connection: ConnectionManager?
    
    private var updateTimer: Timer?
    
    init() {
        requestNotificationPermission()
        startUpdateTimer()
    }
    
    private func requestNotificationPermission() {
        UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .sound]) { granted, _ in
            print("Notification permission: \(granted)")
        }
    }
    
    func addTimer(label: String, duration: TimeInterval) {
        var timer = TimerItem(label: label, duration: duration)
        timer.isRunning = true
        timers.append(timer)
        broadcastTimers()
    }
    
    func startTimer(_ id: UUID) {
        if let index = timers.firstIndex(where: { $0.id == id }) {
            timers[index].isRunning = true
            timers[index].isPaused = false
        }
    }
    
    func pauseTimer(_ id: UUID) {
        if let index = timers.firstIndex(where: { $0.id == id }) {
            timers[index].isRunning = false
            timers[index].isPaused = true
        }
    }
    
    func removeTimer(_ id: UUID) {
        timers.removeAll { $0.id == id }
        cancelNotification(for: id)
        broadcastTimers()
    }
    
    func removeAllTimers() {
        timers.removeAll()
        UNUserNotificationCenter.current().removeAllPendingNotificationRequests()
    }
    
    private func startUpdateTimer() {
        updateTimer = Timer.scheduledTimer(withTimeInterval: 1.0, repeats: true) { [weak self] _ in
            self?.updateTimers()
        }
    }
    
    private func updateTimers() {
        var updatedTimers: [TimerItem] = []
        var completedTimers: [TimerItem] = []
        
        for var timer in timers {
            if timer.isRunning && timer.remaining > 0 {
                timer.remaining -= 1.0
                
                if timer.remaining <= 0 {
                    timer.remaining = 0
                    timer.isRunning = false
                    completedTimers.append(timer)
                    scheduleNotification(for: timer)
                }
            }
            updatedTimers.append(timer)
        }
        
        DispatchQueue.main.async {
            self.timers = updatedTimers
            
            for timer in completedTimers {
                self.handleTimerCompletion(timer)
            }
            
            // Broadcast every 5 seconds to avoid flooding, or when something completes
            if !completedTimers.isEmpty {
                self.broadcastTimers()
            }
        }
    }
    
    private func broadcastTimers() {
        guard let conn = connection else { return }
        
        // Map timers to dictionary for JSON
        let data = timers.map { [
            "id": $0.id.uuidString,
            "label": $0.label,
            "duration": $0.duration,
            "remaining": $0.remaining,
            "isRunning": $0.isRunning,
            "isPaused": $0.isPaused
        ] }
        
        let message = Message(type: "timer_update", data: ["timers": data])
        conn.sendMessage(message)
    }
    
    private func handleTimerCompletion(_ timer: TimerItem) {
        let generator = UINotificationFeedbackGenerator()
        generator.notificationOccurred(.success)
    }
    
    private func scheduleNotification(for timer: TimerItem) {
        let content = UNMutableNotificationContent()
        content.title = "Timer Complete"
        content.body = timer.label
        content.sound = .default
        
        let trigger = UNTimeIntervalNotificationTrigger(timeInterval: 0.1, repeats: false)
        let request = UNNotificationRequest(
            identifier: timer.id.uuidString,
            content: content,
            trigger: trigger
        )
        
        UNUserNotificationCenter.current().add(request)
    }
    
    private func cancelNotification(for id: UUID) {
        UNUserNotificationCenter.current().removePendingNotificationRequests(withIdentifiers: [id.uuidString])
    }
}
