import Foundation

struct Message {
    let type: String
    let data: [String: Any]?
    
    init(type: String, data: [String: Any]? = nil) {
        self.type = type
        self.data = data
    }
    
    func toJSON() -> Data? {
        var dict: [String: Any] = ["type": type]
        if let data = data {
            dict["data"] = data
        }
        return try? JSONSerialization.data(withJSONObject: dict)
    }
    
    static func from(_ data: Data) -> Message? {
        guard let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
              let type = json["type"] as? String else {
            return nil
        }
        return Message(type: type, data: json["data"] as? [String: Any])
    }
    
    // NEW: Get raw JSON for special parsing
    static func getRawJSON(_ data: Data) -> [String: Any]? {
        return try? JSONSerialization.jsonObject(with: data) as? [String: Any]
    }
}
