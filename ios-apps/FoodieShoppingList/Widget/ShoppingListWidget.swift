import WidgetKit
import SwiftUI
import AppIntents

struct Provider: TimelineProvider {
    func placeholder(in context: Context) -> SimpleEntry {
        SimpleEntry(date: Date(), items: [])
    }

    func getSnapshot(in context: Context, completion: @escaping (SimpleEntry) -> ()) {
        let entry = SimpleEntry(date: Date(), items: loadItems())
        completion(entry)
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<Entry>) -> ()) {
        let items = loadItems()
        let entry = SimpleEntry(date: Date(), items: items)
        let timeline = Timeline(entries: [entry], policy: .atEnd)
        completion(timeline)
    }
    
    // Load from App Group
    private func loadItems() -> [ShoppingItem] {
        guard let userDefaults = UserDefaults(suiteName: "group.com.foodie") else { return [] }
        guard let data = userDefaults.data(forKey: "widget_shopping_items") else { return [] }
        guard let items = try? JSONDecoder().decode([ShoppingItem].self, from: data) else { return [] }
        return items.filter { !$0.isPurchased }.prefix(5).map { $0 }
    }
}

struct SimpleEntry: TimelineEntry {
    let date: Date
    let items: [ShoppingItem]
}

struct ShoppingListWidgetEntryView : View {
    var entry: Provider.Entry

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack {
                Image(systemName: "cart.fill")
                    .foregroundColor(.orange)
                Text("Shopping List")
                    .font(.headline)
                    .foregroundColor(.orange)
                Spacer()
                Text("\(entry.items.count)")
                    .font(.caption)
                    .padding(5)
                    .background(Color.orange.opacity(0.1))
                    .clipShape(Circle())
            }
            Divider()
            
            if entry.items.isEmpty {
                Text("All done! 🎉")
                    .font(.caption)
                    .foregroundColor(.secondary)
            } else {
                ForEach(entry.items.prefix(4)) { item in
                    HStack {
                        Toggle(isOn: false, intent: ToggleItemIntent(id: item.id)) {
                            Text(item.name)
                                .font(.system(size: 13, weight: .medium, design: .rounded))
                                .strikethrough(item.isPurchased)
                        }
                        .toggleStyle(CheckCircleToggleStyle())
                        Spacer()
                    }
                }
            }
            Spacer()
        }
        .padding()
        .containerBackground(for: .widget) {
            Color(.systemBackground)
        }
    }
}

struct CheckCircleToggleStyle: ToggleStyle {
    func makeBody(configuration: Configuration) -> some View {
        Button(action: {
            configuration.isOn.toggle()
        }) {
            HStack {
                Image(systemName: configuration.isOn ? "checkmark.circle.fill" : "circle")
                    .foregroundColor(configuration.isOn ? .green : .gray)
                configuration.label
            }
        }
        .buttonStyle(.plain)
    }
}

// Interactive Intent
struct ToggleItemIntent: AppIntent {
    static var title: LocalizedStringResource = "Toggle Item"
    
    @Parameter(title: "Item ID")
    var id: String
    
    init() {}
    
    init(id: String) {
        self.id = id
    }
    
    func perform() async throws -> some IntentResult {
        // Here we would ideally update the shared UserDefaults
        // In a real app, this would also verify with the main app logic
        if let userDefaults = UserDefaults(suiteName: "group.com.foodie") {
            if let data = userDefaults.data(forKey: "widget_shopping_items"),
               var items = try? JSONDecoder().decode([ShoppingItem].self, from: data) {
                
                if let index = items.firstIndex(where: { $0.id == id }) {
                    items[index].isPurchased.toggle()
                    
                    if let encoded = try? JSONEncoder().encode(items) {
                        userDefaults.set(encoded, forKey: "widget_shopping_items")
                    }
                }
            }
        }
        return .result()
    }
}

struct ShoppingListWidget: Widget {
    let kind: String = "ShoppingListWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: Provider()) { entry in
            ShoppingListWidgetEntryView(entry: entry)
        }
        .configurationDisplayName("Foodie List")
        .description("Check off items from your home screen.")
        .supportedFamilies([.systemSmall, .systemMedium])
    }
}
