import SwiftUI

struct SousChefView: View {
    @Environment(\.dismiss) var dismiss
    @EnvironmentObject var voiceCommand: VoiceCommandManager
    @State private var chatHistory: [ChatMessage] = [
        ChatMessage(text: "Hi! I'm your Sous Chef. Ask me about substitutions, timers, or just say help!", isUser: false)
    ]
    @State private var userInput = ""
    @State private var isListening = false
    
    struct ChatMessage: Identifiable {
        let id = UUID()
        let text: String
        let isUser: Bool
    }
    
    var body: some View {
        NavigationView {
            VStack {
                ScrollViewReader { proxy in
                    ScrollView {
                        LazyVStack(spacing: 12) {
                            ForEach(chatHistory) { message in
                                ChatBubble(message: message)
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
                
                HStack {
                    TextField("Ask your Sous Chef...", text: $userInput)
                        .textFieldStyle(.roundedBorder)
                        .onSubmit {
                            sendMessage()
                        }
                    
                    Button(action: sendMessage) {
                        Image(systemName: "arrow.up.circle.fill")
                            .font(.title2)
                    }
                    .disabled(userInput.isEmpty)
                    
                    Button(action: toggleListening) {
                        Image(systemName: isListening ? "mic.fill" : "mic")
                            .font(.title2)
                            .foregroundColor(isListening ? .red : .blue)
                            .padding(8)
                            .background(isListening ? Color.red.opacity(0.1) : Color.blue.opacity(0.1))
                            .clipShape(Circle())
                    }
                }
                .padding()
            }
            .navigationTitle("👨‍🍳 Sous Chef")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarLeading) {
                    Button("Close") { dismiss() }
                }
            }
        }
    }
    
    private func sendMessage() {
        let text = userInput.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !text.isEmpty else { return }
        
        // Add user message
        chatHistory.append(ChatMessage(text: text, isUser: true))
        userInput = ""
        
        // Simulate response delay
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) {
            voiceCommand.askSousChef(text)
            
            // Hardcoded responses for visual feedback to match voice
            // In a real app, this would be a callback from VoiceCommandManager
            let response = getVisualResponse(for: text)
            chatHistory.append(ChatMessage(text: response, isUser: false))
        }
    }
    
    private func toggleListening() {
        isListening.toggle()
        if isListening {
            voiceCommand.startListening()
        } else {
            voiceCommand.stopListening()
        }
    }
    
    private func getVisualResponse(for query: String) -> String {
        let lower = query.lowercased()
        if lower.contains("substitute") {
             if lower.contains("milk") { return "You can substitute milk with yogurt, almond milk, or even water with a bit of butter." }
             if lower.contains("egg") { return "For eggs, try using applesauce, mashed banana, or a flax seed mix." }
             if lower.contains("butter") { return "Olive oil or coconut oil are great butter substitutes." }
             return "I can help with common substitutions like milk, eggs, or butter. Which one do you need?"
        } else if lower.contains("timer") {
            if lower.contains("egg") { return "Boil eggs for 7 minutes for soft, or 10 minutes for hard boiled." }
            return "I can suggest timers for eggs, steak, or pasta. Just ask!"
        } else if lower.contains("joke") {
            return "Why did the tomato turn red? Because it saw the salad dressing!"
        }
        return "I'm listening! Ask me something about cooking."
    }
}

struct ChatBubble: View {
    let message: SousChefView.ChatMessage
    
    var body: some View {
        HStack {
            if message.isUser { Spacer() }
            
            Text(message.text)
                .padding(12)
                .background(message.isUser ? Color.blue : Color(.systemGray5))
                .foregroundColor(message.isUser ? .white : .primary)
                .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
            
            if !message.isUser { Spacer() }
        }
    }
}
