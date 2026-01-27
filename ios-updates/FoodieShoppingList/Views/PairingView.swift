import SwiftUI

struct PairingView: View {
    @ObservedObject var connectionManager: ConnectionManager
    @State private var pairingCode = ""
    @FocusState private var isCodeFocused: Bool
    
    var body: some View {
        VStack(spacing: 24) {
            Spacer()
            
            Image(systemName: "lock.shield")
                .font(.system(size: 60))
                .foregroundColor(.blue)
            
            Text("Pair with Desktop")
                .font(.title)
                .bold()
            
            Text("Enter the 6-digit code shown in the Foodie desktop app's Companion panel")
                .multilineTextAlignment(.center)
                .foregroundColor(.secondary)
                .padding(.horizontal, 32)
            
            TextField("000000", text: $pairingCode)
                .keyboardType(.numberPad)
                .font(.system(size: 36, weight: .bold, design: .monospaced))
                .multilineTextAlignment(.center)
                .frame(maxWidth: 220)
                .padding()
                .background(Color(.systemGray6))
                .cornerRadius(12)
                .focused($isCodeFocused)
                .onChange(of: pairingCode) { newValue in
                    let filtered = newValue.filter { $0.isNumber }
                    if filtered.count > 6 {
                        pairingCode = String(filtered.prefix(6))
                    } else if filtered != newValue {
                        pairingCode = filtered
                    }
                    if pairingCode.count == 6 {
                        submitCode()
                    }
                }
            
            if let error = connectionManager.pairingError {
                HStack {
                    Image(systemName: "exclamationmark.triangle.fill")
                        .foregroundColor(.red)
                    Text(error)
                        .foregroundColor(.red)
                }
                .font(.footnote)
                .padding(.horizontal)
            }
            
            Button(action: submitCode) {
                HStack {
                    if connectionManager.syncStatus == .syncing {
                        ProgressView()
                            .progressViewStyle(CircularProgressViewStyle(tint: .white))
                            .scaleEffect(0.8)
                    }
                    Text(connectionManager.syncStatus == .syncing ? "Connecting..." : "Connect")
                        .bold()
                }
                .frame(maxWidth: .infinity)
                .padding()
                .background(pairingCode.count == 6 ? Color.blue : Color.gray.opacity(0.5))
                .foregroundColor(.white)
                .cornerRadius(12)
            }
            .disabled(pairingCode.count != 6 || connectionManager.syncStatus == .syncing)
            .padding(.horizontal, 40)
            
            Spacer()
            
            VStack(spacing: 8) {
                Text("How to find the pairing code:")
                    .font(.footnote)
                    .fontWeight(.semibold)
                    .foregroundColor(.secondary)
                
                Text("1. Open Foodie on your computer\n2. Click the phone icon in the header\n3. The 6-digit code is shown at the top")
                    .font(.caption)
                    .foregroundColor(.secondary)
                    .multilineTextAlignment(.center)
            }
            .padding()
            .background(Color(.systemGray6))
            .cornerRadius(12)
            .padding(.horizontal, 24)
            .padding(.bottom, 40)
        }
        .onAppear {
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) {
                isCodeFocused = true
            }
        }
    }
    
    private func submitCode() {
        guard pairingCode.count == 6 else { return }
        connectionManager.sendPairingCode(pairingCode)
    }
}

#Preview {
    PairingView(connectionManager: ConnectionManager())
}
