import Foundation

/// Shared logging utility for Foodie iOS apps
struct Logger {
    enum Level: String {
        case info = "INFO"
        case warn = "WARN"
        case error = "ERROR"
        case debug = "DEBUG"
        case success = "SUCCESS"
    }
    
    // Master toggle for debug logs
    static var isDebugEnabled: Bool = {
        #if DEBUG
        return true
        #else
        return false
        #endif
    }()
    
    static func log(_ level: Level, _ message: String, file: String = #file, function: String = #function, line: Int = #line) {
        if level == .debug && !isDebugEnabled { return }
        
        let filename = (file as NSString).lastPathComponent
        let timestamp = ISO8601DateFormatter().string(from: Date())
        
        let logString = "[\(timestamp)] [\(level.rawValue)] [\(filename):\(line)] \(function) -> \(message)"
        
        print(logString)
        
        // In a real app, you might also log to a file or a remote service here
    }
    
    static func info(_ message: String, file: String = #file, function: String = #function, line: Int = #line) {
        log(.info, message, file: file, function: function, line: line)
    }
    
    static func warn(_ message: String, file: String = #file, function: String = #function, line: Int = #line) {
        log(.warn, message, file: file, function: function, line: line)
    }
    
    static func error(_ message: String, file: String = #file, function: String = #function, line: Int = #line) {
        log(.error, message, file: file, function: function, line: line)
    }
    
    static func debug(_ message: String, file: String = #file, function: String = #function, line: Int = #line) {
        log(.debug, message, file: file, function: function, line: line)
    }
    
    static func success(_ message: String, file: String = #file, function: String = #function, line: Int = #line) {
        log(.success, message, file: file, function: function, line: line)
    }
}
