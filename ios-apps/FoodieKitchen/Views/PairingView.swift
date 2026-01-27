import SwiftUI

struct PairingView: View {
    @ObservedObject var connectionManager: ConnectionManager
    @State private var pairingCode = ""
    @FocusState private var isCodeFocused: Bool
    
    var body: some View {
        GeometryReader { geometry in
            HStack(spacing: 0) {
                // Left side - instructions
                VStack(spacing: 24) {
                    Spacer()
                    
                    Image(systemName: "lock.shield")
                        .font(.system(size: 80))
                        .foregroundColor(.blue)
                    
                    Text("Pair with Desktop")
                        .font(.largeTitle)
                        .bold()
                    
                    VStack(alignment: .leading, spacing: 16) {
                        HStack(alignment: .top, spacing: 12) {
                            Text("1")
                                .font(.headline)
                                .foregroundColor(.white)
                                .frame(width: 28, height: 28)
                                .background(Color.blue)
                                .clipShape(Circle())
                            Text("Open Foodie on your Mac")
                                .font(.title3)
                        }
                        
                        HStack(alignment: .top, spacing: 12) {
                            Text("2")
                                .font(.headline)
                                .foregroundColor(.white)
                                .frame(width: 28, height: 28)
                                .background(Color.blue)
                                .clipShape(Circle())
                            Text("Click the phone icon in the header")
                                .font(.title3)
                        }
                        
                        HStack(alignment: .top, spacing: 12) {
                            Text("3")
                                .font(.headline)
                                .foregroundColor(.white)
                                .frame(width: 28, height: 28)
                                .background(Color.blue)
                                .clipShape(Circle())
                            Text("Enter the 6-digit pairing code shown")
                                .font(.title3)
                        }
                    }
                    .padding(32)
                    .background(Color(.systemGray6))
                    .cornerRadius(16)
                    
                    Spacer()
                }
                .frame(width: geometry.size.width * 0.5)
                .padding(40)
                
                // Right side - code entry
                VStack(spacing: 32) {
                    Spacer()
                    
                    Text("Enter Pairing Code")
                        .font(.title2)
                        .fontWeight(.semibold)
                    
                    TextField("000000", text: $pairingCode)
                        .keyboardType(.numberPad)
                        .font(.system(size: 56, weight: .bold, design: .monospaced))
                        .multilineTextAlignment(.center)
                        .frame(maxWidth: 320)
                        .padding(24)
                        .background(Color(.systemGray6))
                        .cornerRadius(16)
                        .focused($isCodeFocused)
                        .onChange(of: pairingCode) { oldValue, newValue in
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
                        .font(.body)
                    }
                    
                    Button(action: submitCode) {
                        HStack(spacing: 12) {
                            if connectionManager.connectionStatus == .connecting {
                                ProgressView()
                                    .progressViewStyle(CircularProgressViewStyle(tint: .white))
                            }
                            Text(connectionManager.connectionStatus == .connecting ? "Connecting..." : "Connect")
                                .font(.title3)
                                .bold()
                        }
                        .frame(width: 280, height: 56)
                        .background(pairingCode.count == 6 ? Color.blue : Color.gray.opacity(0.5))
                        .foregroundColor(.white)
                        .cornerRadius(12)
                    }
                    .disabled(pairingCode.count != 6 || connectionManager.connectionStatus == .connecting)
                    
                    Spacer()
                }
                .frame(width: geometry.size.width * 0.5)
                .padding(40)
                .background(Color(.systemBackground))
            }
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
