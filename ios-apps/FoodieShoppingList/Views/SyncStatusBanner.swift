import SwiftUI

struct SyncStatusBanner: View {
    let status: ConnectionManager.SyncStatus
    
    var body: some View {
        HStack(spacing: 12) {
            statusIcon
            
            Text(status.message)
                .font(.callout)
                .foregroundColor(.white)
            
            Spacer()
        }
        .padding(.horizontal)
        .padding(.vertical, 12)
        .background(backgroundColor)
        .transition(.move(edge: .top).combined(with: .opacity))
    }
    
    @ViewBuilder
    private var statusIcon: some View {
        switch status {
        case .syncing:
            ProgressView()
                .progressViewStyle(.circular)
                .tint(.white)
                .controlSize(.small)
            
        case .success:
            Image(systemName: "checkmark.circle.fill")
                .foregroundColor(.white)
            
        case .failed:
            Image(systemName: "exclamationmark.triangle.fill")
                .foregroundColor(.white)
            
        case .idle:
            EmptyView()
        }
    }
    
    private var backgroundColor: Color {
        switch status {
        case .syncing:
            return .blue
        case .success:
            return .green
        case .failed:
            return .red
        case .idle:
            return .clear
        }
    }
}

// MARK: - Preview

struct SyncStatusBanner_Previews: PreviewProvider {
    static var previews: some View {
        VStack {
            SyncStatusBanner(status: .syncing)
            SyncStatusBanner(status: .success)
            SyncStatusBanner(status: .failed("Connection lost"))
        }
    }
}
