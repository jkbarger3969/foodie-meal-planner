import SwiftUI

struct ShoppingItemRow: View {
    let item: ShoppingItem
    let onToggle: () -> Void
    
    var body: some View {
        HStack(alignment: .center, spacing: 16) {
            // Checkbox
            Button(action: onToggle) {
                Image(systemName: item.isPurchased ? "checkmark.circle.fill" : "circle")
                    .font(.system(size: 32))
                    .foregroundColor(item.isPurchased ? .green : .gray)
                    .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            
            // Item details
            VStack(alignment: .leading, spacing: 4) {
                Text(item.name)
                    .font(.body)
                    .strikethrough(item.isPurchased, color: .gray)
                    .foregroundColor(item.isPurchased ? .secondary : .primary)
                
                HStack(spacing: 8) {
                    if !item.quantity.isEmpty {
                        Text(item.quantity)
                            .font(.caption)
                            .foregroundColor(.secondary)
                    }
                    
                    // PHASE 4.5.7: Show user assignments
                    if !item.forUsers.isEmpty {
                        if !item.quantity.isEmpty {
                            Text("•")
                                .font(.caption)
                                .foregroundColor(.secondary)
                        }
                        
                        Text("For: \(item.forUsers.joined(separator: ", "))")
                            .font(.caption)
                            .foregroundColor(.blue)
                    }
                    
                    if item.isManuallyAdded {
                        Text("•")
                            .font(.caption)
                            .foregroundColor(.secondary)
                        
                        Text("Added while shopping")
                            .font(.caption)
                            .foregroundColor(.blue)
                    }
                }
            }
            
            Spacer()
            
            // Category badge
            if !item.category.isEmpty {
                Text(item.category)
                    .font(.caption2)
                    .fontWeight(.medium)
                    .padding(.horizontal, 8)
                    .padding(.vertical, 4)
                    .background(Color.gray.opacity(0.2))
                    .cornerRadius(8)
            }
        }
        .padding(.vertical, 4)
        .contentShape(Rectangle())
        .onTapGesture {
            onToggle()
        }
        // Accessibility
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
