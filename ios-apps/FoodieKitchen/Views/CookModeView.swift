import SwiftUI

struct CookModeView: View {
    @Environment(\.dismiss) var dismiss
    @EnvironmentObject var recipeStore: RecipeStore
    @EnvironmentObject var timerManager: TimerManager
    @EnvironmentObject var voiceCommand: VoiceCommandManager
    
    @State private var showingIngredients = false
    @State private var showingSousChef = false
    @State private var showingVoiceHelp = false
    @State private var showMicPermissionAlert = false
    @State private var showJumpToStep = false
    
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
                // Header with voice status
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
                    
                    // Voice Status Indicator
                    if voiceCommand.voiceEnabled || voiceCommand.isPushToTalkActive {
                        VoiceStatusIndicator(isListening: voiceCommand.isListening || voiceCommand.isPushToTalkActive)
                    }
                    
                    Text(recipeStore.currentRecipe?.title ?? "Cooking")
                        .font(.title2)
                        .bold()
                        .foregroundColor(.white)
                        .lineLimit(1)
                    
                    Spacer()
                    
                    // Sous Chef Button
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
                    
                    // Jump to Step
                    Button(action: { showJumpToStep.toggle() }) {
                        Image(systemName: "list.number")
                            .font(.title2)
                            .foregroundColor(.white)
                            .padding(12)
                            .background(AppColors.accent)
                            .clipShape(Circle())
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
                                LinearGradient(colors: [AppColors.accent, AppColors.accentHover], startPoint: .top, endPoint: .bottom),
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
                        UIImpactFeedbackGenerator(style: .light).impactOccurred()
                        readCurrentStep()
                    }) {
                        Image(systemName: "arrow.left.circle.fill")
                            .font(.system(size: 70))
                            .foregroundColor(recipeStore.currentInstructionStep > 0 ? .white : .white.opacity(0.2))
                    }
                    .disabled(recipeStore.currentInstructionStep == 0)
                    
                    // Voice Control Section
                    VStack(spacing: 8) {
                        HStack(spacing: 12) {
                            // Command Help Button
                            Button(action: { showingVoiceHelp = true }) {
                                Image(systemName: "questionmark.circle")
                                    .font(.title2)
                                    .foregroundColor(.white.opacity(0.7))
                            }
                            
                            // Main Microphone Button
                            if voiceCommand.listeningMode == .pushToTalk {
                                // Push-to-Talk: Hold to speak
                                Button(action: {}) {
                                    ZStack {
                                        Circle()
                                            .fill(voiceCommand.isPushToTalkActive ? Color.red : Color.white.opacity(0.1))
                                            .frame(width: 90, height: 90)
                                        
                                        Image(systemName: voiceCommand.isPushToTalkActive ? "mic.fill" : "mic")
                                            .font(.title)
                                            .foregroundColor(.white)
                                    }
                                }
                                .simultaneousGesture(
                                    DragGesture(minimumDistance: 0)
                                        .onChanged { _ in
                                            if !voiceCommand.isPushToTalkActive {
                                                UIImpactFeedbackGenerator(style: .medium).impactOccurred()
                                                voiceCommand.startPushToTalk()
                                            }
                                        }
                                        .onEnded { _ in
                                            voiceCommand.stopPushToTalk()
                                        }
                                )
                            } else {
                                // Wake Word Mode: Toggle on/off
                                Button(action: { 
                                    if !voiceCommand.isAuthorized {
                                        showMicPermissionAlert = true
                                        return
                                    }
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
                                        
                                        // Countdown indicator when waiting for command
                                        if voiceCommand.isWaitingForCommand && voiceCommand.commandTimeRemaining > 0 {
                                            Circle()
                                                .trim(from: 0, to: voiceCommand.commandTimeRemaining / 8.0)
                                                .stroke(Color.yellow, lineWidth: 4)
                                                .frame(width: 100, height: 100)
                                                .rotationEffect(.degrees(-90))
                                        }
                                    }
                                }
                            }
                            
                            // Mode Toggle Button
                            Button(action: {
                                withAnimation {
                                    voiceCommand.listeningMode = voiceCommand.listeningMode == .wakeWord ? .pushToTalk : .wakeWord
                                    if voiceCommand.voiceEnabled {
                                        voiceCommand.stopListening()
                                        voiceCommand.voiceEnabled = false
                                    }
                                }
                            }) {
                                Image(systemName: voiceCommand.listeningMode == .pushToTalk ? "hand.raised.fill" : "waveform")
                                    .font(.title2)
                                    .foregroundColor(.white.opacity(0.7))
                            }
                        }
                        
                        // Voice Status Text
                        Text(voiceStatusText)
                            .font(.caption)
                            .foregroundColor(voiceStatusColor)
                            .animation(.easeInOut, value: voiceCommand.isWaitingForCommand)
                        
                        // Error with Retry
                        if let error = voiceCommand.voiceError {
                            Button(action: { voiceCommand.retryAfterError() }) {
                                Text(error)
                                    .font(.caption)
                                    .foregroundColor(.red)
                                    .underline()
                            }
                        }
                    }
                    
                    Button(action: { 
                        recipeStore.nextStep()
                        UIImpactFeedbackGenerator(style: .light).impactOccurred()
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
        .sheet(isPresented: $showingVoiceHelp) {
            VoiceCommandHelpView()
        }
        .sheet(isPresented: $showJumpToStep) {
            JumpToStepSheet()
        }
        .alert("Microphone Permission Required", isPresented: $showMicPermissionAlert) {
            Button("Open Settings") {
                if let url = URL(string: UIApplication.openSettingsURLString) {
                    UIApplication.shared.open(url)
                }
            }
            Button("Cancel", role: .cancel) {}
        } message: {
            Text("Voice commands require microphone access. Please enable in Settings.")
        }
        .onAppear {
            UIApplication.shared.isIdleTimerDisabled = true
            readCurrentStep()
        }
        .onDisappear {
            UIApplication.shared.isIdleTimerDisabled = false
        }
    }
    
    private var voiceStatusText: String {
        if let _ = voiceCommand.voiceError { return "" }
        if voiceCommand.listeningMode == .pushToTalk {
            return voiceCommand.isPushToTalkActive ? "Listening..." : "Hold to speak"
        }
        if !voiceCommand.voiceEnabled { return "Voice Off" }
        if voiceCommand.isWaitingForCommand { return "Listening... \(Int(voiceCommand.commandTimeRemaining))s" }
        if voiceCommand.isListening { return "Say 'Foodie'" }
        return "Starting..."
    }
    
    private var voiceStatusColor: Color {
        if voiceCommand.isWaitingForCommand || voiceCommand.isPushToTalkActive {
            return .yellow
        }
        return .white.opacity(0.6)
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

struct VoiceCommandHelpView: View {
    @Environment(\.dismiss) var dismiss
    
    var body: some View {
        NavigationView {
            List {
                Section(header: Text("How to Use")) {
                    VStack(alignment: .leading, spacing: 8) {
                        HStack {
                            Image(systemName: "waveform")
                            Text("Wake Word Mode")
                                .font(.headline)
                        }
                        Text("Say \"Foodie\" to activate, then speak your command within 8 seconds.")
                            .font(.caption)
                            .foregroundColor(.secondary)
                    }
                    .padding(.vertical, 4)
                    
                    VStack(alignment: .leading, spacing: 8) {
                        HStack {
                            Image(systemName: "hand.raised.fill")
                            Text("Push-to-Talk Mode")
                                .font(.headline)
                        }
                        Text("Press and hold the microphone button while speaking, release when done.")
                            .font(.caption)
                            .foregroundColor(.secondary)
                    }
                    .padding(.vertical, 4)
                }
                
                Section(header: Text("Navigation Commands")) {
                    CommandRow(command: "next step", description: "Go to next instruction")
                    CommandRow(command: "previous step", description: "Go back one step")
                    CommandRow(command: "go to step 3", description: "Jump to specific step")
                    CommandRow(command: "read step", description: "Read current instruction aloud")
                    CommandRow(command: "go home", description: "Exit cooking mode")
                }
                
                Section(header: Text("Timer Commands")) {
                    CommandRow(command: "set timer 5 minutes", description: "Start a countdown timer")
                    CommandRow(command: "stop timer", description: "Stop active timer")
                    CommandRow(command: "pause timer", description: "Pause active timer")
                    CommandRow(command: "resume timer", description: "Resume paused timer")
                }
                
                Section(header: Text("Other Commands")) {
                    CommandRow(command: "show ingredients", description: "Open ingredients list")
                    CommandRow(command: "show breakfast/lunch/dinner", description: "Switch to different meal")
                    CommandRow(command: "clear sent recipes", description: "Clear recipes queue")
                }
            }
            .navigationTitle("Voice Commands")
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button("Done") { dismiss() }
                }
            }
        }
    }
}

struct CommandRow: View {
    let command: String
    let description: String
    
    var body: some View {
        HStack {
            Text("\"\(command)\"")
                .font(.system(.body, design: .monospaced))
                .foregroundColor(.blue)
            Spacer()
            Text(description)
                .font(.caption)
                .foregroundColor(.secondary)
        }
    }
}

// MARK: - Voice Status Indicator

struct VoiceStatusIndicator: View {
    var isListening: Bool
    @State private var isPulsing = false
    
    var body: some View {
        HStack(spacing: AppSpacing.sm) {
            ZStack {
                if isListening {
                    Circle()
                        .fill(AppColors.danger.opacity(0.3))
                        .frame(width: 24, height: 24)
                        .scaleEffect(isPulsing ? 1.3 : 1.0)
                        .opacity(isPulsing ? 0 : 0.8)
                }
                
                Circle()
                    .fill(isListening ? AppColors.danger : AppColors.accent)
                    .frame(width: 12, height: 12)
                
                Image(systemName: "mic.fill")
                    .font(.system(size: 6))
                    .foregroundColor(.white)
            }
            
            Text(isListening ? "Listening..." : "Voice On")
                .font(AppTypography.caption)
                .foregroundColor(.white.opacity(0.8))
        }
        .padding(.horizontal, AppSpacing.md)
        .padding(.vertical, AppSpacing.sm)
        .background(Color.white.opacity(0.1))
        .cornerRadius(AppRadius.full)
        .onAppear {
            withAnimation(Animation.easeInOut(duration: 0.8).repeatForever(autoreverses: true)) {
                isPulsing = true
            }
        }
    }
}

// MARK: - Jump to Step Sheet

struct JumpToStepSheet: View {
    @EnvironmentObject var recipeStore: RecipeStore
    @Environment(\.dismiss) var dismiss
    
    var body: some View {
        NavigationView {
            List {
                ForEach(Array(recipeStore.instructionSteps.enumerated()), id: \.offset) { index, step in
                    Button(action: {
                        recipeStore.currentInstructionStep = index
                        dismiss()
                    }) {
                        HStack(alignment: .top, spacing: AppSpacing.md) {
                            ZStack {
                                Circle()
                                    .fill(index == recipeStore.currentInstructionStep ? AppColors.accent : AppColors.textMuted.opacity(0.3))
                                    .frame(width: 32, height: 32)
                                Text("\(index + 1)")
                                    .font(AppTypography.captionBold)
                                    .foregroundColor(index == recipeStore.currentInstructionStep ? .white : AppColors.textPrimary)
                            }
                            
                            Text(step)
                                .font(AppTypography.bodyMedium)
                                .foregroundColor(AppColors.textPrimary)
                                .lineLimit(2)
                            
                            Spacer()
                            
                            if index == recipeStore.currentInstructionStep {
                                Image(systemName: "checkmark.circle.fill")
                                    .foregroundColor(AppColors.accent)
                            }
                        }
                        .padding(.vertical, AppSpacing.xs)
                    }
                }
            }
            .navigationTitle("Jump to Step")
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button("Done") { dismiss() }
                }
            }
        }
    }
}
