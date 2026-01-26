import SwiftUI

struct IngredientListView: View {
    @EnvironmentObject var recipeStore: RecipeStore
    
    @State private var showScalePicker = false
    
    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack {
                Text("Ingredients")
                    .font(.title2)
                    .bold()
                
                Spacer()
                
                Button(action: { showScalePicker = true }) {
                    HStack(spacing: 4) {
                        Image(systemName: "arrow.up.left.and.arrow.down.right")
                        Text("\(Int((recipeStore.currentRecipe?.currentScale ?? 1.0) * 100))%")
                    }
                    .font(.caption)
                    .padding(.horizontal, 12)
                    .padding(.vertical, 6)
                    .background(Color.blue.opacity(0.2))
                    .cornerRadius(8)
                }
            }
            .padding()
            
            Divider()
            
            ScrollView {
                LazyVStack(spacing: 12) {
                    ForEach(recipeStore.currentRecipe?.scaledIngredients() ?? []) { ingredient in
                        IngredientRow(ingredient: ingredient)
                    }
                }
                .padding()
            }
        }
        .background(Color(.systemBackground))
        .sheet(isPresented: $showScalePicker) {
            ScalePickerView()
        }
    }
}

struct IngredientRow: View {
    let ingredient: Ingredient
    @EnvironmentObject var recipeStore: RecipeStore
    
    var isChecked: Bool {
        recipeStore.checkedIngredients.contains(ingredient.id)
    }
    
    var body: some View {
        HStack(alignment: .top, spacing: 16) {
            Button(action: {
                recipeStore.toggleIngredientChecked(ingredient.id)
                let generator = UIImpactFeedbackGenerator(style: .medium)
                generator.impactOccurred()
            }) {
                Image(systemName: isChecked ? "checkmark.circle.fill" : "circle")
                    .font(.system(size: 32))
                    .foregroundColor(isChecked ? .green : .gray)
            }
            .frame(width: 44, height: 44)
            
            VStack(alignment: .leading, spacing: 4) {
                Text(ingredient.name)
                    .font(.body)
                    .strikethrough(isChecked)
                    .foregroundColor(isChecked ? .secondary : .primary)
                
                if !ingredient.quantity.isEmpty || !ingredient.unit.isEmpty {
                    Text("\(ingredient.quantity) \(ingredient.unit)".trimmingCharacters(in: .whitespaces))
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
            }
            
            Spacer()
        }
        .padding(12)
        .background(Color(.secondarySystemBackground))
        .cornerRadius(12)
    }
}

struct ScalePickerView: View {
    @EnvironmentObject var recipeStore: RecipeStore
    @Environment(\.dismiss) var dismiss
    
    let scaleOptions = [0.5, 1.0, 1.5, 2.0, 3.0]
    
    var body: some View {
        NavigationView {
            List(scaleOptions, id: \.self) { scale in
                Button(action: {
                    recipeStore.scaleRecipe(by: scale)
                    dismiss()
                }) {
                    HStack {
                        Text(scaleLabel(for: scale))
                        Spacer()
                        if abs((recipeStore.currentRecipe?.currentScale ?? 1.0) - scale) < 0.01 {
                            Image(systemName: "checkmark")
                                .foregroundColor(.blue)
                        }
                    }
                }
            }
            .navigationTitle("Scale Recipe")
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button("Done") { dismiss() }
                }
            }
        }
    }
    
    private func scaleLabel(for scale: Double) -> String {
        let servings = Int(Double(recipeStore.currentRecipe?.servings ?? 4) * scale)
        return "\(Int(scale * 100))% (\(servings) servings)"
    }
}
