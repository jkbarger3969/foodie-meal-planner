import SwiftUI

struct VoiceCommandHelpView: View {
    @Environment(\.dismiss) var dismiss
    
    var body: some View {
        NavigationView {
            List {
                Section {
                    Text("Say \"Foodie\" followed by a command")
                        .font(.subheadline)
                        .foregroundColor(.secondary)
                } header: {
                    Label("How to Use", systemImage: "info.circle")
                }
                
                Section {
                    commandRow("show all stores", "View all stores")
                    commandRow("show [store name]", "Filter by store (e.g., \"show Walmart\")")
                    commandRow("how many stores", "Count available stores")
                    commandRow("list stores", "Read store names aloud")
                } header: {
                    Label("Store Commands", systemImage: "storefront")
                }
                
                Section {
                    commandRow("check [item]", "Mark item as purchased")
                    commandRow("uncheck [item]", "Mark item as needed")
                    commandRow("delete [item]", "Remove item from list")
                    commandRow("add [item]", "Add new item to list")
                } header: {
                    Label("Item Commands", systemImage: "checkmark.circle")
                }
                
                Section {
                    commandRow("check all", "Mark all items as purchased")
                    commandRow("uncheck all", "Mark all items as needed")
                    commandRow("clear checked", "Delete all purchased items")
                } header: {
                    Label("Bulk Actions", systemImage: "checklist")
                }
                
                Section {
                    commandRow("search for [term]", "Filter items by search")
                    commandRow("clear search", "Remove search filter")
                    commandRow("find [item]", "Search for specific item")
                } header: {
                    Label("Search Commands", systemImage: "magnifyingglass")
                }
                
                Section {
                    commandRow("how many items", "Count total items")
                    commandRow("read list", "Read unchecked items aloud")
                    commandRow("what's left", "Count remaining items")
                    commandRow("what's done", "Count purchased items")
                } header: {
                    Label("Information", systemImage: "info.circle")
                }
                
                Section {
                    commandRow("show [category]", "View items in category")
                    commandRow("list categories", "Read category names")
                    commandRow("how many categories", "Count categories")
                } header: {
                    Label("Category Commands", systemImage: "folder")
                }
            }
            .navigationTitle("Voice Commands")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button("Done") {
                        dismiss()
                    }
                }
            }
        }
    }
    
    private func commandRow(_ command: String, _ description: String) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Text("\"Foodie \(command)\"")
                .font(.system(.body, design: .monospaced))
                .foregroundColor(.blue)
            Text(description)
                .font(.caption)
                .foregroundColor(.secondary)
        }
        .padding(.vertical, 4)
    }
}

struct VoiceCommandHelpView_Previews: PreviewProvider {
    static var previews: some View {
        VoiceCommandHelpView()
    }
}
