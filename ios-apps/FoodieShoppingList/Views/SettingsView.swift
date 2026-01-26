import SwiftUI

struct SettingsView: View {
    @EnvironmentObject var connection: ConnectionManager
    @EnvironmentObject var voiceCommand: VoiceCommandManager
    @Environment(\.dismiss) var dismiss
    
    @State private var serverAddress: String = ""
    @State private var showingConnectionHelp = false
    @State private var showingVoiceHelp = false
    
    var body: some View {
        NavigationView {
            Form {
                Section {
                    HStack {
                        Image(systemName: connection.isConnected ? "checkmark.circle.fill" : "xmark.circle.fill")
                            .foregroundColor(connection.isConnected ? .green : .red)
                        
                        Text(connection.isConnected ? "Connected" : "Not Connected")
                            .fontWeight(.medium)
                    }
                } header: {
                    Text("Status")
                }
                
                Section {
                    TextField("WebSocket Address", text: $serverAddress)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()
                        .keyboardType(.URL)
                        .font(.system(.body, design: .monospaced))
                    
                    Text("Example: ws://192.168.1.100:8080")
                        .font(.caption)
                        .foregroundColor(.secondary)
                    
                    Button(action: { showingConnectionHelp = true }) {
                        Label("How to find this address", systemImage: "questionmark.circle")
                            .font(.caption)
                    }
                } header: {
                    Text("Desktop Mac")
                } footer: {
                    Text("Enter the WebSocket address from the Foodie desktop app. To switch between your Mac and your wife's Mac, just change this address and reconnect.")
                }
                
                Section {
                    Button(action: saveAndConnect) {
                        HStack {
                            Spacer()
                            Text(connection.isConnected ? "Reconnect" : "Save & Connect")
                                .fontWeight(.semibold)
                            Spacer()
                        }
                    }
                    .disabled(serverAddress.isEmpty)
                    
                    if connection.isConnected {
                        Button(role: .destructive, action: connection.disconnect) {
                            HStack {
                                Spacer()
                                Text("Disconnect")
                                Spacer()
                            }
                        }
                    }
                }
                
                // Voice Control Section
                Section {
                    HStack {
                        Image(systemName: voiceCommand.isAuthorized ? "checkmark.circle.fill" : "xmark.circle.fill")
                            .foregroundColor(voiceCommand.isAuthorized ? .green : .orange)
                        
                        Text(voiceCommand.isAuthorized ? "Authorized" : "Not Authorized")
                            .fontWeight(.medium)
                        
                        Spacer()
                        
                        if !voiceCommand.isAuthorized {
                            Button("Enable") {
                                voiceCommand.requestAuthorization()
                            }
                            .buttonStyle(.bordered)
                            .controlSize(.small)
                        }
                    }
                    
                    Toggle("Voice Commands", isOn: Binding(
                        get: { voiceCommand.isListening },
                        set: { enabled in
                            if enabled {
                                voiceCommand.startListening()
                            } else {
                                voiceCommand.stopListening()
                            }
                        }
                    ))
                    .disabled(!voiceCommand.isAuthorized)
                    
                    if voiceCommand.isListening {
                        Toggle("Continuous Listening", isOn: $voiceCommand.isContinuousMode)
                        
                        VStack(alignment: .leading, spacing: 8) {
                            Text("Wake word: \"Foodie\"")
                                .font(.caption)
                                .foregroundColor(.secondary)
                            
                            if voiceCommand.isContinuousMode {
                                Text("Always listening - say 'Foodie' before each command")
                                    .font(.caption)
                                    .foregroundColor(.secondary)
                            } else {
                                Text("Single command mode - say 'Foodie' then one command")
                                    .font(.caption)
                                    .foregroundColor(.secondary)
                            }
                            
                            if !voiceCommand.lastCommand.isEmpty {
                                HStack {
                                    Image(systemName: "mic.fill")
                                        .foregroundColor(.blue)
                                        .font(.caption)
                                    Text("Last: \"\(voiceCommand.lastCommand)\"")
                                        .font(.caption)
                                        .foregroundColor(.blue)
                                }
                                .padding(.top, 4)
                            }
                        }
                    }
                    
                    Button(action: { showingVoiceHelp = true }) {
                        Label("Voice Commands Guide", systemImage: "questionmark.circle")
                            .font(.caption)
                    }
                } header: {
                    Text("Voice Control")
                } footer: {
                    Text("Control your shopping list hands-free while shopping. Say 'Foodie' followed by a command like 'check milk' or 'show Walmart'.")
                }
                
                Section {
                    HStack {
                        Text("App Version")
                        Spacer()
                        Text("1.0.0")
                            .foregroundColor(.secondary)
                    }
                    
                    HStack {
                        Text("Device ID")
                        Spacer()
                        Text(UIDevice.current.identifierForVendor?.uuidString.prefix(8) ?? "Unknown")
                            .foregroundColor(.secondary)
                            .font(.system(.caption, design: .monospaced))
                    }
                } header: {
                    Text("About")
                }
            }
            .navigationTitle("Settings")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button("Done") {
                        dismiss()
                    }
                    .fontWeight(.semibold)
                }
            }
            .alert("Finding Desktop Address", isPresented: $showingConnectionHelp) {
                Button("OK", role: .cancel) { }
            } message: {
                Text("""
                Your Mac:
                1. Open Foodie desktop app
                2. Click the 📱 companion button
                3. Copy the WebSocket address (e.g., ws://192.168.1.100:8080)
                4. Paste it here
                
                Wife's Mac:
                Follow the same steps on her Mac. Switch between Macs anytime by changing this address!
                
                Both devices must be on the same WiFi network.
                """)
            }
            .alert("Voice Commands Guide", isPresented: $showingVoiceHelp) {
                Button("OK", role: .cancel) { }
            } message: {
                Text("""
                Say "Foodie" followed by:
                
                Store Switching:
                • "Show Walmart" / "Show all stores"
                • "List stores" / "How many stores"
                
                Item Actions:
                • "Check milk" / "Uncheck eggs"
                • "Delete bread" / "Clear checked"
                • "Check all" / "Uncheck all"
                
                Information:
                • "How many items" / "What's left"
                • "Read list" / "List categories"
                
                Search:
                • "Search for chicken"
                • "Clear search"
                
                Say "Foodie help" for this list.
                """)
            }
        }
        .onAppear {
            serverAddress = connection.serverAddress
        }
    }
    
    private func saveAndConnect() {
        connection.serverAddress = serverAddress
        connection.connect()
        
        // Haptic feedback
        let generator = UINotificationFeedbackGenerator()
        generator.notificationOccurred(.success)
        
        // Auto-dismiss after a delay if connection succeeds
        DispatchQueue.main.asyncAfter(deadline: .now() + 2) {
            if connection.isConnected {
                dismiss()
            }
        }
    }
}

// MARK: - Preview

struct SettingsView_Previews: PreviewProvider {
    static var previews: some View {
        SettingsView()
            .environmentObject(ConnectionManager())
    }
}
