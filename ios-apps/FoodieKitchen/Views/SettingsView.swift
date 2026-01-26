import SwiftUI

struct SettingsView: View {
    @EnvironmentObject var connection: ConnectionManager
    @EnvironmentObject var voiceCommand: VoiceCommandManager
    @Environment(\.dismiss) var dismiss
    
    @State private var serverAddress: String = ""
    @State private var showingConnectionHelp = false
    
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
                    TextField("Server IP Address", text: $serverAddress)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()
                        .keyboardType(.decimalPad)
                        .font(.system(.body, design: .monospaced))
                    
                    Text("Example: 192.168.1.100")
                        .font(.caption)
                        .foregroundColor(.secondary)
                    
                    Button(action: { showingConnectionHelp = true }) {
                        Label("How to find this address", systemImage: "questionmark.circle")
                            .font(.caption)
                    }
                } header: {
                    Text("Desktop Mac")
                } footer: {
                    Text("Enter the IP address shown in the Foodie desktop app. To switch between your Mac and your wife's Mac, just change this address and reconnect.")
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
                
                // NEW: Voice Control Section
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
                    
                    Toggle("Enable Voice Commands", isOn: Binding(
                        get: { voiceCommand.voiceEnabled },
                        set: { enabled in
                            voiceCommand.voiceEnabled = enabled
                            if enabled && voiceCommand.isAuthorized {
                                voiceCommand.startListening()
                            } else {
                                voiceCommand.stopListening()
                            }
                        }
                    ))
                    .disabled(!voiceCommand.isAuthorized)
                    
                    if voiceCommand.voiceEnabled {
                        VStack(alignment: .leading, spacing: 8) {
                            Text("Say 'Foodie' to activate, then say your command:")
                                .font(.caption)
                                .foregroundColor(.secondary)
                            
                            Text("Example: Say 'Foodie' → iPad says 'Listening' → Say 'next step'")
                                .font(.caption2)
                                .foregroundColor(.blue)
                                .italic()
                        }
                        .padding(.vertical, 4)
                        
                        if voiceCommand.isWaitingForCommand {
                            HStack {
                                Circle()
                                    .fill(Color.red)
                                    .frame(width: 12, height: 12)
                                Text("Listening for command...")
                                    .font(.caption)
                                    .foregroundColor(.red)
                            }
                        }
                        
                        if !voiceCommand.lastRecognizedText.isEmpty {
                            VStack(alignment: .leading, spacing: 4) {
                                Text("Last heard:")
                                    .font(.caption)
                                    .foregroundColor(.secondary)
                                Text(voiceCommand.lastRecognizedText)
                                    .font(.caption2)
                                    .foregroundColor(.blue)
                                    .italic()
                            }
                        }
                    }
                } header: {
                    Text("Voice Control")
                } footer: {
                    Text("When enabled, always listening for 'Foodie' wake word. Say 'Foodie' to activate, then speak your command.")
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
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button("Done") {
                        dismiss()
                    }
                    .fontWeight(.semibold)
                }
            }
            .alert("Finding Desktop IP Address", isPresented: $showingConnectionHelp) {
                Button("OK", role: .cancel) { }
            } message: {
                Text("""
                Your Mac:
                1. Open Foodie desktop app
                2. Click the 📱 companion button
                3. Look for "Server running on: ws://192.168.x.x:8080"
                4. Enter just the IP part here (e.g., 192.168.1.100)
                
                Wife's Mac:
                Follow the same steps on her Mac. You can switch between Macs anytime by changing this address!
                
                Both devices must be on the same WiFi network.
                """)
            }
            .onAppear {
                serverAddress = connection.serverAddress
            }
        }
    }
    
    private func saveAndConnect() {
        connection.saveServerAddress(serverAddress)
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

// MARK: - Command Group View

struct CommandGroup: View {
    let title: String
    let commands: [String]
    
    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(title)
                .font(.caption)
                .fontWeight(.semibold)
                .foregroundColor(.secondary)
            
            ForEach(commands, id: \.self) { command in
                HStack(spacing: 4) {
                    Image(systemName: "mic.fill")
                        .font(.caption2)
                        .foregroundColor(.blue)
                    Text(command)
                        .font(.caption2)
                        .foregroundColor(.primary)
                }
            }
        }
    }
}

// MARK: - Preview

struct SettingsView_Previews: PreviewProvider {
    static var previews: some View {
        SettingsView()
            .environmentObject(ConnectionManager())
            .environmentObject(VoiceCommandManager())
    }
}
