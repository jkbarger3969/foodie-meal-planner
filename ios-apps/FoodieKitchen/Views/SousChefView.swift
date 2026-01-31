import SwiftUI
import SafariServices
import Speech

struct SousChefView: View {
    @Environment(\.dismiss) var dismiss
    @EnvironmentObject var connection: ConnectionManager
    @EnvironmentObject var recipeStore: RecipeStore
    @EnvironmentObject var voiceCommand: VoiceCommandManager
    
    @State private var chatHistory: [ChatMessage] = []
    @State private var userInput = ""
    @State private var isListening = false
    @State private var showWebFallback = false
    @State private var currentQuery = ""
    @State private var isTyping = false
    @State private var showSuggestions = true
    
    private let speechRecognizer = SFSpeechRecognizer(locale: Locale(identifier: "en-US"))
    @State private var recognitionRequest: SFSpeechAudioBufferRecognitionRequest?
    @State private var recognitionTask: SFSpeechRecognitionTask?
    private let audioEngine = AVAudioEngine()
    
    struct ChatMessage: Identifiable {
        let id = UUID()
        let text: String
        let isUser: Bool
        let timestamp: Date = Date()
    }
    
    private var suggestedQuestions: [String] {
        var suggestions = [
            "What can I substitute for eggs?",
            "How do I know when it's done?",
            "Can I make this ahead of time?"
        ]
        
        if let recipe = recipeStore.currentRecipe {
            suggestions.insert("Tips for making \(recipe.title)?", at: 0)
        }
        
        return suggestions
    }
    
    var body: some View {
        NavigationView {
            VStack(spacing: 0) {
                // Recipe context bar if cooking
                if let recipe = recipeStore.currentRecipe {
                    HStack(spacing: AppSpacing.md) {
                        Image(systemName: "frying.pan.fill")
                            .foregroundColor(AppColors.accent)
                        Text("Cooking: \(recipe.title)")
                            .font(AppTypography.caption)
                            .foregroundColor(AppColors.textMuted)
                            .lineLimit(1)
                        Spacer()
                        Text("Step \(recipeStore.currentInstructionStep + 1)")
                            .font(AppTypography.captionBold)
                            .foregroundColor(AppColors.accent)
                    }
                    .padding(.horizontal, AppSpacing.lg)
                    .padding(.vertical, AppSpacing.sm)
                    .background(AppColors.accentMuted)
                }
                
                // Chat messages
                ScrollViewReader { proxy in
                    ScrollView {
                        LazyVStack(spacing: AppSpacing.md) {
                            // Welcome message if empty
                            if chatHistory.isEmpty {
                                WelcomeMessage()
                                    .padding(.top, AppSpacing.xl)
                            }
                            
                            ForEach(chatHistory) { message in
                                ChatBubble(message: message)
                            }
                            
                            // Typing indicator
                            if isTyping {
                                TypingIndicator()
                            }
                            
                            // Suggested questions
                            if showSuggestions && chatHistory.count < 3 {
                                SuggestedQuestionsView(suggestions: suggestedQuestions) { question in
                                    userInput = question
                                    sendMessage()
                                    showSuggestions = false
                                }
                            }
                        }
                        .padding()
                    }
                    .onChange(of: chatHistory.count) { oldValue, newValue in
                        if let lastId = chatHistory.last?.id {
                            withAnimation {
                                proxy.scrollTo(lastId, anchor: .bottom)
                            }
                        }
                    }
                }
                
                Divider()
                
                // Input area
                HStack(spacing: AppSpacing.md) {
                    TextField("Ask your Sous Chef...", text: $userInput)
                        .textFieldStyle(.roundedBorder)
                        .onSubmit { sendMessage() }
                    
                    // Send button
                    Button(action: sendMessage) {
                        Image(systemName: "arrow.up.circle.fill")
                            .font(.title2)
                            .foregroundColor(userInput.isEmpty ? AppColors.textMuted : AppColors.accent)
                    }
                    .disabled(userInput.isEmpty)
                    
                    // Microphone button with visual feedback
                    Button(action: toggleListening) {
                        ZStack {
                            if isListening {
                                Circle()
                                    .fill(AppColors.danger.opacity(0.2))
                                    .frame(width: 44, height: 44)
                                    .scaleEffect(isListening ? 1.2 : 1.0)
                                    .animation(Animation.easeInOut(duration: 0.5).repeatForever(autoreverses: true), value: isListening)
                            }
                            
                            Image(systemName: isListening ? "mic.fill" : "mic")
                                .font(.title2)
                                .foregroundColor(isListening ? AppColors.danger : AppColors.info)
                                .padding(AppSpacing.sm)
                                .background(isListening ? AppColors.danger.opacity(0.1) : AppColors.info.opacity(0.1))
                                .clipShape(Circle())
                        }
                    }
                }
                .padding()
            }
            .navigationTitle("Sous Chef")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarLeading) {
                    Button("Close") { dismiss() }
                }
                ToolbarItem(placement: .principal) {
                    HStack {
                        Text("👨‍🍳")
                        Text("Sous Chef")
                            .fontWeight(.semibold)
                    }
                }
            }
        }
        .onAppear {
            if chatHistory.isEmpty {
                chatHistory.append(ChatMessage(
                    text: "Hi! I'm your Sous Chef. Ask me anything about cooking, substitutions, or techniques!",
                    isUser: false
                ))
            }
        }
        .onChange(of: connection.sousChefResponse) { oldValue, newValue in
            isTyping = false
            if let response = newValue {
                chatHistory.append(ChatMessage(text: response, isUser: false))
            }
        }
        .sheet(isPresented: $showWebFallback) {
            SafariView(url: URL(string: "https://www.google.com/search?q=\(currentQuery.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? "")")!)
        }
    }
    
    private func sendMessage() {
        let text = userInput.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !text.isEmpty else { return }
        
        chatHistory.append(ChatMessage(text: text, isUser: true))
        currentQuery = text
        userInput = ""
        showSuggestions = false
        
        if connection.isConnected {
            isTyping = true
            connection.sendSousChefQuery(text)
        } else {
            chatHistory.append(ChatMessage(
                text: "I'm disconnected from the kitchen brain. Opening web search...",
                isUser: false
            ))
            DispatchQueue.main.asyncAfter(deadline: .now() + 1.0) {
                showWebFallback = true
            }
        }
    }
    
    private func toggleListening() {
        if isListening {
            stopListening()
        } else {
            startListening()
        }
    }
    
    private func startListening() {
        SFSpeechRecognizer.requestAuthorization { status in
            DispatchQueue.main.async {
                if status == .authorized {
                    do {
                        try startRecording()
                        isListening = true
                    } catch {
                        print("Speech recognition error: \(error)")
                    }
                }
            }
        }
    }
    
    private func stopListening() {
        audioEngine.stop()
        recognitionRequest?.endAudio()
        recognitionTask?.cancel()
        isListening = false
    }
    
    private func startRecording() throws {
        recognitionTask?.cancel()
        recognitionTask = nil
        
        let audioSession = AVAudioSession.sharedInstance()
        try audioSession.setCategory(.record, mode: .measurement, options: .duckOthers)
        try audioSession.setActive(true, options: .notifyOthersOnDeactivation)
        
        recognitionRequest = SFSpeechAudioBufferRecognitionRequest()
        guard let recognitionRequest = recognitionRequest else { return }
        
        recognitionRequest.shouldReportPartialResults = true
        
        let inputNode = audioEngine.inputNode
        
        recognitionTask = speechRecognizer?.recognitionTask(with: recognitionRequest) { result, error in
            if let result = result {
                userInput = result.bestTranscription.formattedString
            }
            
            if error != nil || (result?.isFinal ?? false) {
                audioEngine.stop()
                inputNode.removeTap(onBus: 0)
                self.recognitionRequest = nil
                self.recognitionTask = nil
                isListening = false
                
                if result?.isFinal == true && !userInput.isEmpty {
                    sendMessage()
                }
            }
        }
        
        let recordingFormat = inputNode.outputFormat(forBus: 0)
        inputNode.installTap(onBus: 0, bufferSize: 1024, format: recordingFormat) { buffer, _ in
            recognitionRequest.append(buffer)
        }
        
        audioEngine.prepare()
        try audioEngine.start()
    }
}

// MARK: - Supporting Views

struct WelcomeMessage: View {
    var body: some View {
        VStack(spacing: AppSpacing.md) {
            Text("👨‍🍳")
                .font(.system(size: 50))
            Text("Your AI Cooking Assistant")
                .font(AppTypography.titleSmall)
                .foregroundColor(AppColors.textPrimary)
            Text("Ask me about substitutions, techniques, timing, or any cooking questions!")
                .font(AppTypography.bodyMedium)
                .foregroundColor(AppColors.textMuted)
                .multilineTextAlignment(.center)
        }
        .padding()
    }
}

struct TypingIndicator: View {
    @State private var dotOpacity: [Double] = [0.3, 0.3, 0.3]
    
    var body: some View {
        HStack {
            HStack(spacing: 4) {
                ForEach(0..<3) { index in
                    Circle()
                        .fill(AppColors.textMuted)
                        .frame(width: 8, height: 8)
                        .opacity(dotOpacity[index])
                }
            }
            .padding(AppSpacing.md)
            .background(Color(.systemGray5))
            .clipShape(RoundedRectangle(cornerRadius: AppRadius.lg))
            
            Spacer()
        }
        .onAppear {
            animateDots()
        }
    }
    
    private func animateDots() {
        for i in 0..<3 {
            withAnimation(Animation.easeInOut(duration: 0.4).repeatForever().delay(Double(i) * 0.15)) {
                dotOpacity[i] = 1.0
            }
        }
    }
}

struct SuggestedQuestionsView: View {
    let suggestions: [String]
    let onSelect: (String) -> Void
    
    var body: some View {
        VStack(alignment: .leading, spacing: AppSpacing.sm) {
            Text("Suggestions")
                .font(AppTypography.captionBold)
                .foregroundColor(AppColors.textMuted)
            
            FlowLayout(spacing: AppSpacing.sm) {
                ForEach(suggestions, id: \.self) { question in
                    Button(action: { onSelect(question) }) {
                        Text(question)
                            .font(AppTypography.caption)
                            .foregroundColor(AppColors.accent)
                            .padding(.horizontal, AppSpacing.md)
                            .padding(.vertical, AppSpacing.sm)
                            .background(AppColors.accentMuted)
                            .cornerRadius(AppRadius.full)
                    }
                }
            }
        }
        .padding(.top, AppSpacing.lg)
    }
}

struct FlowLayout: Layout {
    var spacing: CGFloat = 8
    
    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
        let result = arrangement(proposal: proposal, subviews: subviews)
        return result.size
    }
    
    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        let result = arrangement(proposal: proposal, subviews: subviews)
        for (index, position) in result.positions.enumerated() {
            subviews[index].place(at: CGPoint(x: bounds.minX + position.x, y: bounds.minY + position.y), proposal: .unspecified)
        }
    }
    
    private func arrangement(proposal: ProposedViewSize, subviews: Subviews) -> (positions: [CGPoint], size: CGSize) {
        var positions: [CGPoint] = []
        var currentX: CGFloat = 0
        var currentY: CGFloat = 0
        var lineHeight: CGFloat = 0
        var maxWidth: CGFloat = 0
        
        let maxX = proposal.width ?? .infinity
        
        for subview in subviews {
            let size = subview.sizeThatFits(.unspecified)
            
            if currentX + size.width > maxX && currentX > 0 {
                currentX = 0
                currentY += lineHeight + spacing
                lineHeight = 0
            }
            
            positions.append(CGPoint(x: currentX, y: currentY))
            lineHeight = max(lineHeight, size.height)
            currentX += size.width + spacing
            maxWidth = max(maxWidth, currentX)
        }
        
        return (positions, CGSize(width: maxWidth, height: currentY + lineHeight))
    }
}

struct ChatBubble: View {
    let message: SousChefView.ChatMessage
    
    var body: some View {
        HStack {
            if message.isUser { Spacer() }
            
            VStack(alignment: message.isUser ? .trailing : .leading, spacing: AppSpacing.xs) {
                Text(message.text)
                    .padding(AppSpacing.md)
                    .background(message.isUser ? AppColors.accent : Color(.systemGray5))
                    .foregroundColor(message.isUser ? .white : .primary)
                    .clipShape(RoundedRectangle(cornerRadius: AppRadius.lg, style: .continuous))
                
                Text(timeString(from: message.timestamp))
                    .font(AppTypography.caption)
                    .foregroundColor(AppColors.textMuted)
            }
            
            if !message.isUser { Spacer() }
        }
    }
    
    private func timeString(from date: Date) -> String {
        let formatter = DateFormatter()
        formatter.timeStyle = .short
        return formatter.string(from: date)
    }
}

struct SafariView: UIViewControllerRepresentable {
    let url: URL
    func makeUIViewController(context: Context) -> SFSafariViewController { SFSafariViewController(url: url) }
    func updateUIViewController(_ uiViewController: SFSafariViewController, context: Context) {}
}
