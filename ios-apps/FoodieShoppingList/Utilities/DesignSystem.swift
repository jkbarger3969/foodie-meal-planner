import SwiftUI

// MARK: - Design System
// Shared design tokens matching desktop app CSS variables

// MARK: - Colors

struct AppColors {
    // Primary accent (emerald green)
    static let accent = Color(hex: "#10b981")
    static let accentHover = Color(hex: "#34d399")
    static let accentMuted = Color(hex: "#10b981").opacity(0.2)
    
    // Semantic colors
    static let danger = Color(hex: "#f43f5e")
    static let dangerMuted = Color(hex: "#f43f5e").opacity(0.2)
    static let warning = Color(hex: "#f59e0b")
    static let warningMuted = Color(hex: "#f59e0b").opacity(0.2)
    static let info = Color(hex: "#3b82f6")
    static let infoMuted = Color(hex: "#3b82f6").opacity(0.2)
    static let success = Color(hex: "#22c55e")
    static let successMuted = Color(hex: "#22c55e").opacity(0.2)
    
    // Backgrounds
    static let cardBg = Color(hex: "#171f2e")
    static let cardBgLight = Color(hex: "#1e293b")
    static let glassBg = Color.white.opacity(0.03)
    static let overlayBg = Color.black.opacity(0.5)
    
    // Text
    static let textPrimary = Color(hex: "#f1f5f9")
    static let textSecondary = Color(hex: "#cbd5e1")
    static let textMuted = Color(hex: "#94a3b8")
    static let textDisabled = Color(hex: "#64748b")
    
    // Borders
    static let border = Color(hex: "#334155")
    static let borderStrong = Color(hex: "#475569")
    
    // Meal type colors
    static let breakfast = Color(hex: "#fbbf24")  // Yellow/amber
    static let lunch = Color(hex: "#22c55e")      // Green
    static let dinner = Color(hex: "#a855f7")     // Purple
    static let snack = Color(hex: "#f97316")      // Orange
    
    // Category colors (for shopping/pantry)
    static let categoryProduce = Color(hex: "#22c55e")
    static let categoryDairy = Color(hex: "#3b82f6")
    static let categoryMeat = Color(hex: "#ef4444")
    static let categorySeafood = Color(hex: "#06b6d4")
    static let categoryBakery = Color(hex: "#f59e0b")
    static let categoryPantry = Color(hex: "#8b5cf6")
    static let categoryFrozen = Color(hex: "#6366f1")
    static let categoryBeverage = Color(hex: "#ec4899")
    static let categorySpice = Color(hex: "#84cc16")
}

// MARK: - Spacing

struct AppSpacing {
    static let xs: CGFloat = 4
    static let sm: CGFloat = 8
    static let md: CGFloat = 12
    static let lg: CGFloat = 16
    static let xl: CGFloat = 24
    static let xxl: CGFloat = 32
}

// MARK: - Typography

struct AppTypography {
    static let titleLarge = Font.system(size: 28, weight: .bold)
    static let titleMedium = Font.system(size: 22, weight: .semibold)
    static let titleSmall = Font.system(size: 18, weight: .semibold)
    static let bodyLarge = Font.system(size: 17, weight: .regular)
    static let bodyMedium = Font.system(size: 15, weight: .regular)
    static let bodySmall = Font.system(size: 13, weight: .regular)
    static let caption = Font.system(size: 12, weight: .regular)
    static let captionBold = Font.system(size: 12, weight: .semibold)
}

// MARK: - Corner Radius

struct AppRadius {
    static let sm: CGFloat = 6
    static let md: CGFloat = 8
    static let lg: CGFloat = 12
    static let xl: CGFloat = 16
    static let full: CGFloat = 9999
}

// MARK: - Shadows

struct AppShadows {
    static let small = ShadowStyle(color: .black.opacity(0.1), radius: 4, x: 0, y: 2)
    static let medium = ShadowStyle(color: .black.opacity(0.15), radius: 8, x: 0, y: 4)
    static let large = ShadowStyle(color: .black.opacity(0.2), radius: 16, x: 0, y: 8)
}

struct ShadowStyle {
    let color: Color
    let radius: CGFloat
    let x: CGFloat
    let y: CGFloat
}

// MARK: - Animation

struct AppAnimation {
    static let fast = Animation.easeOut(duration: 0.15)
    static let normal = Animation.easeOut(duration: 0.2)
    static let slow = Animation.easeOut(duration: 0.3)
    static let spring = Animation.spring(response: 0.3, dampingFraction: 0.7)
    static let bouncy = Animation.spring(response: 0.4, dampingFraction: 0.6)
}

// MARK: - Color Extension

extension Color {
    init(hex: String) {
        let hex = hex.trimmingCharacters(in: CharacterSet.alphanumerics.inverted)
        var int: UInt64 = 0
        Scanner(string: hex).scanHexInt64(&int)
        let a, r, g, b: UInt64
        switch hex.count {
        case 3: // RGB (12-bit)
            (a, r, g, b) = (255, (int >> 8) * 17, (int >> 4 & 0xF) * 17, (int & 0xF) * 17)
        case 6: // RGB (24-bit)
            (a, r, g, b) = (255, int >> 16, int >> 8 & 0xFF, int & 0xFF)
        case 8: // ARGB (32-bit)
            (a, r, g, b) = (int >> 24, int >> 16 & 0xFF, int >> 8 & 0xFF, int & 0xFF)
        default:
            (a, r, g, b) = (255, 0, 0, 0)
        }
        self.init(
            .sRGB,
            red: Double(r) / 255,
            green: Double(g) / 255,
            blue: Double(b) / 255,
            opacity: Double(a) / 255
        )
    }
}

// MARK: - View Modifiers

struct CardStyle: ViewModifier {
    var padding: CGFloat = AppSpacing.lg
    
    func body(content: Content) -> some View {
        content
            .padding(padding)
            .background(AppColors.cardBg)
            .cornerRadius(AppRadius.lg)
            .shadow(color: .black.opacity(0.2), radius: 8, x: 0, y: 4)
    }
}

struct AccentButtonStyle: ButtonStyle {
    var isDestructive: Bool = false
    
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(AppTypography.bodyMedium.weight(.semibold))
            .foregroundColor(.white)
            .padding(.horizontal, AppSpacing.lg)
            .padding(.vertical, AppSpacing.md)
            .background(isDestructive ? AppColors.danger : AppColors.accent)
            .cornerRadius(AppRadius.md)
            .scaleEffect(configuration.isPressed ? 0.97 : 1.0)
            .animation(AppAnimation.fast, value: configuration.isPressed)
    }
}

struct GhostButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(AppTypography.bodyMedium)
            .foregroundColor(AppColors.accent)
            .padding(.horizontal, AppSpacing.md)
            .padding(.vertical, AppSpacing.sm)
            .background(configuration.isPressed ? AppColors.accentMuted : Color.clear)
            .cornerRadius(AppRadius.md)
            .animation(AppAnimation.fast, value: configuration.isPressed)
    }
}

struct MealTypeBadge: View {
    let mealType: String
    
    var color: Color {
        switch mealType.lowercased() {
        case "breakfast": return AppColors.breakfast
        case "lunch": return AppColors.lunch
        case "dinner": return AppColors.dinner
        case "snack": return AppColors.snack
        default: return AppColors.textMuted
        }
    }
    
    var body: some View {
        Text(mealType.capitalized)
            .font(AppTypography.captionBold)
            .foregroundColor(color)
            .padding(.horizontal, AppSpacing.sm)
            .padding(.vertical, AppSpacing.xs)
            .background(color.opacity(0.15))
            .cornerRadius(AppRadius.sm)
    }
}

// MARK: - View Extensions

extension View {
    func cardStyle(padding: CGFloat = AppSpacing.lg) -> some View {
        modifier(CardStyle(padding: padding))
    }
    
    func appShadow(_ style: ShadowStyle) -> some View {
        self.shadow(color: style.color, radius: style.radius, x: style.x, y: style.y)
    }
}

// MARK: - Pulsing Animation (for voice/connection indicators)

struct PulsingView: View {
    @State private var isPulsing = false
    var color: Color = AppColors.accent
    var size: CGFloat = 12
    
    var body: some View {
        Circle()
            .fill(color)
            .frame(width: size, height: size)
            .overlay(
                Circle()
                    .stroke(color, lineWidth: 2)
                    .scaleEffect(isPulsing ? 2 : 1)
                    .opacity(isPulsing ? 0 : 0.8)
            )
            .onAppear {
                withAnimation(Animation.easeOut(duration: 1.0).repeatForever(autoreverses: false)) {
                    isPulsing = true
                }
            }
    }
}

// MARK: - Connection Status Indicator

struct ConnectionStatusView: View {
    var isConnected: Bool
    var isConnecting: Bool = false
    
    var body: some View {
        HStack(spacing: AppSpacing.sm) {
            if isConnecting {
                PulsingView(color: AppColors.warning, size: 8)
                Text("Connecting...")
                    .font(AppTypography.caption)
                    .foregroundColor(AppColors.warning)
            } else if isConnected {
                Circle()
                    .fill(AppColors.success)
                    .frame(width: 8, height: 8)
                Text("Connected")
                    .font(AppTypography.caption)
                    .foregroundColor(AppColors.success)
            } else {
                Circle()
                    .fill(AppColors.danger)
                    .frame(width: 8, height: 8)
                Text("Disconnected")
                    .font(AppTypography.caption)
                    .foregroundColor(AppColors.danger)
            }
        }
        .padding(.horizontal, AppSpacing.md)
        .padding(.vertical, AppSpacing.xs)
        .background(AppColors.glassBg)
        .cornerRadius(AppRadius.full)
    }
}

// MARK: - Empty State View

struct EmptyStateView: View {
    var icon: String
    var title: String
    var message: String
    var actionTitle: String? = nil
    var action: (() -> Void)? = nil
    
    var body: some View {
        VStack(spacing: AppSpacing.lg) {
            Image(systemName: icon)
                .font(.system(size: 48))
                .foregroundColor(AppColors.textMuted)
            
            Text(title)
                .font(AppTypography.titleSmall)
                .foregroundColor(AppColors.textPrimary)
            
            Text(message)
                .font(AppTypography.bodyMedium)
                .foregroundColor(AppColors.textMuted)
                .multilineTextAlignment(.center)
                .padding(.horizontal, AppSpacing.xl)
            
            if let actionTitle = actionTitle, let action = action {
                Button(action: action) {
                    Text(actionTitle)
                }
                .buttonStyle(AccentButtonStyle())
                .padding(.top, AppSpacing.md)
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
}
