import SwiftUI

struct VoiceCommandButton: View {
    @EnvironmentObject var voiceCommand: VoiceCommandManager
    
    var body: some View {
        Button(action: {
            if voiceCommand.isListening {
                voiceCommand.stopListening()
            } else {
                voiceCommand.startListening()
            }
        }) {
            HStack {
                Image(systemName: voiceCommand.isListening ? "mic.fill" : "mic")
                    .font(.title2)
                
                if voiceCommand.isListening {
                    Text("Listening...")
                        .font(.caption)
                }
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 12)
            .background(voiceCommand.isListening ? Color.red.opacity(0.2) : Color.blue.opacity(0.2))
            .foregroundColor(voiceCommand.isListening ? .red : .blue)
            .cornerRadius(12)
        }
    }
}
