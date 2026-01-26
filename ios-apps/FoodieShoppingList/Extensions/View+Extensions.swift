import SwiftUI

// MARK: - View Extensions

extension View {
    /// Shows a placeholder when text is empty
    func placeholder<Content: View>(
        when shouldShow: Bool,
        alignment: Alignment = .leading,
        @ViewBuilder placeholder: () -> Content
    ) -> some View {
        ZStack(alignment: alignment) {
            placeholder().opacity(shouldShow ? 1 : 0)
            self
        }
    }
}

// MARK: - Date Extensions

extension Date {
    func formatted(_ style: RelativeFormatStyle) -> String {
        return style.format(self)
    }
}

struct RelativeFormatStyle {
    enum Presentation {
        case named
        case numeric
    }
    
    let presentation: Presentation
    
    static func relative(presentation: Presentation) -> RelativeFormatStyle {
        RelativeFormatStyle(presentation: presentation)
    }
    
    func format(_ date: Date) -> String {
        let now = Date()
        let interval = now.timeIntervalSince(date)
        
        if interval < 60 {
            return "just now"
        } else if interval < 3600 {
            let minutes = Int(interval / 60)
            return "\(minutes)m ago"
        } else if interval < 86400 {
            let hours = Int(interval / 3600)
            return "\(hours)h ago"
        } else if interval < 604800 {
            let days = Int(interval / 86400)
            return "\(days)d ago"
        } else {
            let formatter = DateFormatter()
            formatter.dateStyle = .short
            formatter.timeStyle = .none
            return formatter.string(from: date)
        }
    }
}
