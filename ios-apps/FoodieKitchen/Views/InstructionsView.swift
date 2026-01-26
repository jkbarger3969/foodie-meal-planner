import SwiftUI

struct InstructionsView: View {
    @EnvironmentObject var recipeStore: RecipeStore
    @EnvironmentObject var voiceCommand: VoiceCommandManager
    
    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack {
                Text(recipeStore.currentRecipe?.title ?? "Recipe")
                    .font(.title2)
                    .bold()
                
                Spacer()
                
                VoiceCommandButton()
            }
            .padding()
            
            Divider()
            
            ScrollViewReader { proxy in
                ScrollView {
                    LazyVStack(alignment: .leading, spacing: 20) {
                        ForEach(Array(recipeStore.instructionSteps.enumerated()), id: \.offset) { index, step in
                            StepView(
                                stepNumber: index + 1,
                                stepText: step,
                                isCurrent: index == recipeStore.currentInstructionStep
                            )
                            .id(index)
                        }
                    }
                    .padding()
                }
                .onChange(of: recipeStore.currentInstructionStep) { oldValue, newValue in
                    withAnimation {
                        proxy.scrollTo(newValue, anchor: .center)
                    }
                }
            }
            
            Divider()
            
            HStack(spacing: 20) {
                Button(action: {
                    recipeStore.previousStep()
                }) {
                    HStack {
                        Image(systemName: "chevron.left")
                        Text("Previous")
                    }
                    .frame(maxWidth: .infinity)
                    .frame(height: 100)
                }
                .buttonStyle(.bordered)
                .disabled(recipeStore.currentInstructionStep == 0)
                
                Button(action: {
                    let isLastStep = recipeStore.currentInstructionStep >= recipeStore.instructionSteps.count - 1
                    if isLastStep {
                        // Finish - go back to meal list
                        recipeStore.goHome()
                    } else {
                        recipeStore.nextStep()
                    }
                }) {
                    HStack {
                        Text(recipeStore.currentInstructionStep >= recipeStore.instructionSteps.count - 1 ? "Finish" : "Next")
                        Image(systemName: recipeStore.currentInstructionStep >= recipeStore.instructionSteps.count - 1 ? "checkmark.circle.fill" : "chevron.right")
                    }
                    .frame(maxWidth: .infinity)
                    .frame(height: 100)
                }
                .buttonStyle(.borderedProminent)
                .tint(recipeStore.currentInstructionStep >= recipeStore.instructionSteps.count - 1 ? .green : .blue)
            }
            .padding()
        }
        .background(Color(.systemBackground))
    }
}

struct StepView: View {
    let stepNumber: Int
    let stepText: String
    let isCurrent: Bool
    
    var body: some View {
        HStack(alignment: .top, spacing: 16) {
            Text("\(stepNumber)")
                .font(.title)
                .bold()
                .foregroundColor(isCurrent ? .white : .secondary)
                .frame(width: 60, height: 60)
                .background(isCurrent ? Color.blue : Color(.secondarySystemBackground))
                .clipShape(Circle())
            
            Text(stepText)
                .font(isCurrent ? .title3 : .body)
                .foregroundColor(isCurrent ? .primary : .secondary)
                .padding(.top, 12)
            
            Spacer()
        }
        .padding(16)
        .background(isCurrent ? Color.blue.opacity(0.1) : Color.clear)
        .cornerRadius(12)
    }
}
