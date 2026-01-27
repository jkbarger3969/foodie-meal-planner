import SwiftUI

struct SousChefView: View {
    @Environment(\.dismiss) var dismiss
    @EnvironmentObject var connection: ConnectionManager
    @State private var chatHistory: [ChatMessage] = [
        ChatMessage(text: "Hi! I'm your Sous Chef. Ask me anything or say help!", isUser: false)
    ]
    @State private var userInput = ""
    @State private var isListening = false
    @State private var showWebFallback = false
    @State private var currentQuery = ""
    
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
        .onChange(of: connection.sousChefResponse) { oldValue, newValue in
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
        
        // Add user message
        chatHistory.append(ChatMessage(text: text, isUser: true))
        currentQuery = text
        userInput = ""
        
        if connection.isConnected {
            // Send to Desktop
            connection.sendSousChefQuery(text)
        } else {
             // Fallback to Web Search directly if offline
            chatHistory.append(ChatMessage(text: "I'm disconnected from the kitchen brain. Opening web search...", isUser: false))
            DispatchQueue.main.asyncAfter(deadline: .now() + 1.0) {
                showWebFallback = true
            }
        }
    }
    
    private func toggleListening() {
        isListening.toggle()
        if isListening {
            // voiceCommand.startListening() // Re-enable when voice command is implemented
        } else {
            // voiceCommand.stopListening() // Re-enable when voice command is implemented
        }
    }
}

// Fallback Safari View
import SafariServices
struct SafariView: UIViewControllerRepresentable {
    let url: URL
    func makeUIViewController(context: Context) -> SFSafariViewController { SFSafariViewController(url: url) }
    func updateUIViewController(_ uiViewController: SFSafariViewController, context: Context) {}
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


