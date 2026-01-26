import SwiftUI

struct TimerBar: View {
    @EnvironmentObject var timerManager: TimerManager
    
    var body: some View {
        VStack(spacing: 0) {
            // Header bar for better visibility
            HStack {
                Image(systemName: "timer")
                    .foregroundColor(.white)
                Text("Active Timers")
                    .font(.headline)
                    .foregroundColor(.white)
                Spacer()
            }
            .padding(.horizontal)
            .padding(.vertical, 8)
            .background(Color.blue)
            
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 12) {
                    ForEach(timerManager.timers) { timer in
                        TimerCard(timer: timer)
                    }
                }
                .padding()
            }
            .background(Color(.secondarySystemBackground))
        }
        .shadow(color: .black.opacity(0.3), radius: 8, x: 0, y: -4)
    }
}

struct TimerCard: View {
    let timer: TimerItem
    @EnvironmentObject var timerManager: TimerManager
    
    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Text(timer.label)
                    .font(.caption)
                    .lineLimit(1)
                
                Spacer()
                
                Button(action: {
                    timerManager.removeTimer(timer.id)
                }) {
                    Image(systemName: "xmark.circle.fill")
                        .foregroundColor(.secondary)
                }
            }
            
            Text(timer.formattedTime)
                .font(.title2)
                .bold()
                .foregroundColor(timer.remaining < 10 ? .red : .primary)
            
            ProgressView(value: timer.progress)
                .tint(timer.remaining < 10 ? .red : .blue)
        }
        .padding(12)
        .frame(width: 160)
        .background(Color(.systemBackground))
        .cornerRadius(12)
        .shadow(radius: 2)
    }
}
