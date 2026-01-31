import SwiftUI

struct ShoppingItemRow: View {
    let item: ShoppingItem
    let onToggle: () -> Void
    
    private var categoryColor: Color {
        switch item.category.lowercased() {
        case "produce": return AppColors.categoryProduce
        case "dairy": return AppColors.categoryDairy
        case "meat": return AppColors.categoryMeat
        case "seafood": return AppColors.categorySeafood
        case "bakery": return AppColors.categoryBakery
        case "pantry": return AppColors.categoryPantry
        case "frozen": return AppColors.categoryFrozen
        case "beverage": return AppColors.categoryBeverage
        case "spice", "spices": return AppColors.categorySpice
        default: return AppColors.textMuted
        }
    }
    
    var body: some View {
        HStack(alignment: .center, spacing: AppSpacing.lg) {
            // Checkbox with animation
            Button(action: {
                withAnimation(AppAnimation.spring) {
                    onToggle()
                }
            }) {
                ZStack {
                    Circle()
                        .stroke(item.isPurchased ? AppColors.success : AppColors.textMuted, lineWidth: 2)
                        .frame(width: 28, height: 28)
                    
                    if item.isPurchased {
                        Circle()
                            .fill(AppColors.success)
                            .frame(width: 28, height: 28)
                        
                        Image(systemName: "checkmark")
                            .font(.system(size: 14, weight: .bold))
                            .foregroundColor(.white)
                    }
                }
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            
            // Item details
            VStack(alignment: .leading, spacing: AppSpacing.xs) {
                Text(item.name)
                    .font(AppTypography.bodyLarge)
                    .strikethrough(item.isPurchased, color: AppColors.textMuted)
                    .foregroundColor(item.isPurchased ? AppColors.textMuted : AppColors.textPrimary)
                
                HStack(spacing: AppSpacing.sm) {
                    if !item.quantity.isEmpty {
                        Text(item.quantity)
                            .font(AppTypography.caption)
                            .foregroundColor(AppColors.textMuted)
                    }
                    
                    if !item.forUsers.isEmpty {
                        if !item.quantity.isEmpty {
                            Text("•")
                                .font(AppTypography.caption)
                                .foregroundColor(AppColors.textMuted)
                        }
                        
                        Text("For: \(item.forUsers.joined(separator: ", "))")
                            .font(AppTypography.caption)
                            .foregroundColor(AppColors.info)
                    }
                    
                    if item.isManuallyAdded {
                        Text("•")
                            .font(AppTypography.caption)
                            .foregroundColor(AppColors.textMuted)
                        
                        Text("Added while shopping")
                            .font(AppTypography.caption)
                            .foregroundColor(AppColors.info)
                    }
                }
            }
            
            Spacer()
            
            // Category badge with color
            if !item.category.isEmpty {
                Text(item.category)
                    .font(AppTypography.captionBold)
                    .foregroundColor(categoryColor)
                    .padding(.horizontal, AppSpacing.sm)
                    .padding(.vertical, AppSpacing.xs)
                    .background(categoryColor.opacity(0.15))
                    .cornerRadius(AppRadius.sm)
            }
        }
        .padding(.vertical, AppSpacing.xs)
        .contentShape(Rectangle())
        .onTapGesture {
            withAnimation(AppAnimation.spring) {
                onToggle()
            }
        }
        .accessibilityElement(children: .combine)
        .accessibilityLabel("\(item.name), \(item.quantity)")
        .accessibilityAddTraits(item.isPurchased ? .isSelected : [])
        .accessibilityHint(item.isPurchased ? "Tap to unmark" : "Tap to mark as purchased")
    }
}

// MARK: - Preview

struct ShoppingItemRow_Previews: PreviewProvider {
    static var previews: some View {
        List {
            ShoppingItemRow(
                item: ShoppingItem(name: "Bananas", quantity: "2 lbs", category: "Produce"),
                onToggle: {}
            )
            
            ShoppingItemRow(
                item: ShoppingItem(name: "Milk", quantity: "1 gallon", category: "Dairy"),
                onToggle: {}
            )
            .previewDisplayName("Unchecked")
            
            ShoppingItemRow(
                item: {
                    var item = ShoppingItem(name: "Bread", quantity: "1 loaf", category: "Bakery")
                    item.isPurchased = true
                    return item
                }(),
                onToggle: {}
            )
            .previewDisplayName("Checked")
        }
    }
}
