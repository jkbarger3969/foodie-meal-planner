import Foundation

struct TimerItem: Identifiable, Equatable {
    let id: UUID
    var label: String
    var duration: TimeInterval
    var remaining: TimeInterval
    var isRunning: Bool
    var isPaused: Bool
    
    init(label: String, duration: TimeInterval) {
        self.id = UUID()
        self.label = label
        self.duration = duration
        self.remaining = duration
        self.isRunning = false
        self.isPaused = false
    }
    
    var progress: Double {
        guard duration > 0 else { return 0 }
        return 1.0 - (remaining / duration)
    }
    
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
}
