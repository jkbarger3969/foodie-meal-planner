import SwiftUI

struct CookModeView: View {
    @Environment(\.dismiss) var dismiss
    @EnvironmentObject var recipeStore: RecipeStore
    @EnvironmentObject var timerManager: TimerManager
    @EnvironmentObject var voiceCommand: VoiceCommandManager
    
    @State private var showingIngredients = false
    @State private var showingSousChef = false
    
    var body: some View {
        ZStack {
            // Dark professional background
            Color(red: 0.05, green: 0.05, blue: 0.07)
                .ignoresSafeArea()
            
            // Subtle blur background from recipe image if available
            if let imageURL = recipeStore.currentRecipe?.imageURL {
                AsyncImage(url: imageURL) { phase in
                    if let image = phase.image {
                        image
                            .resizable()
                            .aspectRatio(contentMode: .fill)
                            .ignoresSafeArea()
                            .opacity(0.15)
                            .blur(radius: 50)
                    }
                }
            }
            
            VStack(spacing: 30) {
                // Header
                HStack {
                    Button(action: { dismiss() }) {
                        HStack {
                            Image(systemName: "xmark.circle.fill")
                            Text("Exit Cook Mode")
                        }
                        .font(.headline)
                        .foregroundColor(.white.opacity(0.8))
                        .padding(12)
                        .background(Color.white.opacity(0.1))
                        .cornerRadius(20)
                    }
                    
                    Spacer()
                    
                    Text(recipeStore.currentRecipe?.title ?? "Cooking")
                        .font(.title2)
                        .bold()
                        .foregroundColor(.white)
                    
                    Spacer()
                    
                    // Super Wow Phase 4: Sous Chef Button 👨‍🍳
                    Button(action: { showingSousChef.toggle() }) {
                        HStack {
                            Text("👨‍🍳")
                            Text("Sous Chef")
                                .bold()
                        }
                        .foregroundColor(.white)
                        .padding(12)
                        .background(Color.purple)
                        .clipShape(Capsule())
                    }
                    .padding(.trailing, 8)
                    
                    Button(action: { showingIngredients.toggle() }) {
                        Image(systemName: "list.bullet.clipboard.fill")
                            .font(.title2)
                            .foregroundColor(.white)
                            .padding(12)
                            .background(Color.blue)
                            .clipShape(Circle())
                    }
                }
                .padding(.horizontal, 30)
                .padding(.top, 20)
                
                Spacer()
                
                // Main Instruction Card
                VStack(spacing: 40) {
                    // Progress Indicator
                    ZStack {
                        Circle()
                            .stroke(Color.white.opacity(0.1), lineWidth: 12)
                            .frame(width: 140, height: 140)
                        
                        Circle()
                            .trim(from: 0, to: progress)
                            .stroke(
                                LinearGradient(colors: [.blue, .cyan], startPoint: .top, endPoint: .bottom),
                                style: StrokeStyle(lineWidth: 12, lineCap: .round)
                            )
                            .frame(width: 140, height: 140)
                            .rotationEffect(.degrees(-90))
                            .animation(.spring(), value: progress)
                        
                        VStack {
                            Text("\(recipeStore.currentInstructionStep + 1)")
                                .font(.system(size: 40, weight: .bold, design: .rounded))
                                .foregroundColor(.white)
                            Text("of \(recipeStore.instructionSteps.count)")
                                .font(.caption)
                                .foregroundColor(.white.opacity(0.6))
                        }
                    }
                    
                    // Instruction Text
                    ScrollView {
                        Text(currentInstruction)
                            .font(.system(size: 36, weight: .medium, design: .serif))
                            .foregroundColor(.white)
                            .multilineTextAlignment(.center)
                            .lineSpacing(8)
                            .padding(.horizontal, 40)
                            .animation(.easeInOut, value: recipeStore.currentInstructionStep)
                    }
                    .frame(maxHeight: 400)
                }
                
                Spacer()
                
                // Active Timers (if any)
                if !timerManager.timers.isEmpty {
                    ScrollView(.horizontal, showsIndicators: false) {
                        HStack(spacing: 20) {
                            ForEach(timerManager.timers) { timer in
                                CookModeTimerCard(timer: timer)
                            }
                        }
                        .padding(.horizontal, 30)
                    }
                    .frame(height: 100)
                }
                
                // Controls
                HStack(spacing: 60) {
                    Button(action: { 
                        recipeStore.previousStep() 
                        readCurrentStep()
                    }) {
                        Image(systemName: "arrow.left.circle.fill")
                            .font(.system(size: 70))
                            .foregroundColor(recipeStore.currentInstructionStep > 0 ? .white : .white.opacity(0.2))
                    }
                    .disabled(recipeStore.currentInstructionStep == 0)
                    
                    Button(action: { 
                        voiceCommand.voiceEnabled.toggle()
                        if voiceCommand.voiceEnabled {
                            voiceCommand.startListening()
                        } else {
                            voiceCommand.stopListening()
                        }
                    }) {
                        ZStack {
                            Circle()
                                .fill(voiceCommand.voiceEnabled ? Color.red : Color.white.opacity(0.1))
                                .frame(width: 90, height: 90)
                            
                            Image(systemName: voiceCommand.voiceEnabled ? "mic.fill" : "mic.slash.fill")
                                .font(.title)
                                .foregroundColor(.white)
                        }
                    }
                    
                    Button(action: { 
                        recipeStore.nextStep()
                        readCurrentStep()
                    }) {
                        Image(systemName: "arrow.right.circle.fill")
                            .font(.system(size: 70))
                            .foregroundColor(recipeStore.currentInstructionStep < recipeStore.instructionSteps.count - 1 ? .blue : .white.opacity(0.2))
                    }
                    .disabled(recipeStore.currentInstructionStep >= recipeStore.instructionSteps.count - 1)
                }
                .padding(.bottom, 40)
            }
        }
        .sheet(isPresented: $showingIngredients) {
            CookModeIngredientsView()
        }
        .sheet(isPresented: $showingSousChef) {
            SousChefView()
        }
        .onAppear {
            readCurrentStep()
        }
    }
    
    private var currentInstruction: String {
        let steps = recipeStore.instructionSteps
        guard steps.indices.contains(recipeStore.currentInstructionStep) else {
            return "No instruction found"
        }
        return steps[recipeStore.currentInstructionStep]
    }
    
    private var progress: CGFloat {
        let total = CGFloat(recipeStore.instructionSteps.count)
        guard total > 0 else { return 0 }
        return CGFloat(recipeStore.currentInstructionStep + 1) / total
    }
    
    private func readCurrentStep() {
        // Only read if voice feedback is desired or enabled
        // For "Wow" factor, we read it once upon entering the step
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) {
            voiceCommand.speakText(currentInstruction)
        }
    }
}

struct CookModeIngredientsView: View {
    @EnvironmentObject var recipeStore: RecipeStore
    @Environment(\.dismiss) var dismiss
    
    var body: some View {
        NavigationView {
            List(recipeStore.currentRecipe?.scaledIngredients() ?? []) { ingredient in
                HStack {
                    VStack(alignment: .leading, spacing: 4) {
                        HStack {
                            Text(ingredient.name)
                                .font(.headline)
                            
                            if ingredient.hasInPantry {
                                Image(systemName: "box.truck.fill")
                                    .font(.caption2)
                                    .foregroundColor(.blue)
                            }
                        }
                        
                        if !ingredient.hasInPantry {
                            Button(action: { /* Mock AI Substitution */ }) {
                                Text("💡 Suggest substitution")
                                    .font(.caption)
                                    .foregroundColor(.blue)
                            }
                            .buttonStyle(.plain)
                        }
                    }
                    
                    Spacer()
                    
                    Text("\(ingredient.quantity) \(ingredient.unit)")
                        .foregroundColor(.secondary)
                    
                    Image(systemName: recipeStore.checkedIngredients.contains(ingredient.id) ? "checkmark.circle.fill" : "circle")
                        .foregroundColor(recipeStore.checkedIngredients.contains(ingredient.id) ? .green : .secondary)
                        .onTapGesture {
                            recipeStore.toggleIngredientChecked(ingredient.id)
                        }
                }
                .padding(.vertical, 8)
            }
            .navigationTitle("Ingredients")
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button("Done") { dismiss() }
                }
            }
        }
    }
}

struct CookModeTimerCard: View {
    let timer: TimerItem
    @EnvironmentObject var timerManager: TimerManager
    
    var body: some View {
        HStack(spacing: 12) {
            VStack(alignment: .leading, spacing: 4) {
                Text(timer.label)
                    .font(.caption)
                    .foregroundColor(.white.opacity(0.7))
                Text(formatTime(timer.remaining))
                    .font(.system(size: 24, weight: .bold, design: .monospaced))
                    .foregroundColor(timer.remaining < 10 ? .red : .white)
            }
            
            Button(action: {
                timerManager.removeTimer(timer.id)
            }) {
                Image(systemName: "xmark.circle.fill")
                    .foregroundColor(.white.opacity(0.5))
            }
        }
        .padding(.horizontal, 20)
        .padding(.vertical, 12)
        .background(Color.white.opacity(0.1))
        .cornerRadius(15)
    }
    
    private func formatTime(_ time: TimeInterval) -> String {
        let mins = Int(time) / 60
        let secs = Int(time) % 60
        return String(format: "%02d:%02d", mins, secs)
    }
}
