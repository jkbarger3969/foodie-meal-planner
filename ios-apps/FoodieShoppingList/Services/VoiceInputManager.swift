import Foundation
import Speech
import AVFoundation
import Combine

class VoiceInputManager: NSObject, ObservableObject {
    @Published var isListening = false
    @Published var recognizedText = ""
    @Published var isAuthorized = false
    @Published var authorizationError: String?
    
    private let speechRecognizer = SFSpeechRecognizer(locale: Locale(identifier: "en-US"))
    private var recognitionRequest: SFSpeechAudioBufferRecognitionRequest?
    private var recognitionTask: SFSpeechRecognitionTask?
    private let audioEngine = AVAudioEngine()
    
    override init() {
        super.init()
        requestAuthorization()
    }
    
    // MARK: - Authorization
    
    func requestAuthorization() {
        SFSpeechRecognizer.requestAuthorization { [weak self] status in
            DispatchQueue.main.async {
                switch status {
                case .authorized:
                    self?.isAuthorized = true
                    print("✅ Speech recognition authorized")
                    
                case .denied:
                    self?.isAuthorized = false
                    self?.authorizationError = "Speech recognition access denied. Please enable in Settings."
                    
                case .restricted:
                    self?.isAuthorized = false
                    self?.authorizationError = "Speech recognition is restricted on this device."
                    
                case .notDetermined:
                    self?.isAuthorized = false
                    self?.authorizationError = "Speech recognition not yet authorized."
                    
                @unknown default:
                    self?.isAuthorized = false
                    self?.authorizationError = "Unknown authorization status."
                }
            }
        }
    }
    
    // MARK: - Recording
    
    func startListening() {
        guard isAuthorized else {
            requestAuthorization()
            return
        }
        
        // Cancel any ongoing recognition
        if recognitionTask != nil {
            stopListening()
        }
        
        // Configure audio session
        let audioSession = AVAudioSession.sharedInstance()
        do {
            try audioSession.setCategory(.record, mode: .measurement, options: .duckOthers)
            try audioSession.setActive(true, options: .notifyOthersOnDeactivation)
        } catch {
            print("❌ Audio session error: \(error.localizedDescription)")
            return
        }
        
        // Create recognition request
        recognitionRequest = SFSpeechAudioBufferRecognitionRequest()
        guard let recognitionRequest = recognitionRequest else {
            print("❌ Unable to create recognition request")
            return
        }
        
        recognitionRequest.shouldReportPartialResults = true
        
        // Get audio input
        let inputNode = audioEngine.inputNode
        
        // Start recognition task
        recognitionTask = speechRecognizer?.recognitionTask(with: recognitionRequest) { [weak self] result, error in
            var isFinal = false
            
            if let result = result {
                DispatchQueue.main.async {
                    self?.recognizedText = result.bestTranscription.formattedString
                }
                isFinal = result.isFinal
            }
            
            if error != nil || isFinal {
                self?.audioEngine.stop()
                inputNode.removeTap(onBus: 0)
                
                self?.recognitionRequest = nil
                self?.recognitionTask = nil
                
                DispatchQueue.main.async {
                    self?.isListening = false
                }
            }
        }
        
        // Configure microphone input
        let recordingFormat = inputNode.outputFormat(forBus: 0)
        inputNode.installTap(onBus: 0, bufferSize: 1024, format: recordingFormat) { buffer, _ in
            recognitionRequest.append(buffer)
        }
        
        // Start audio engine
        audioEngine.prepare()
        do {
            try audioEngine.start()
            DispatchQueue.main.async {
                self.isListening = true
                self.recognizedText = ""
            }
            print("🎤 Listening...")
        } catch {
            print("❌ Audio engine error: \(error.localizedDescription)")
        }
    }
    
    func stopListening() {
        audioEngine.stop()
        audioEngine.inputNode.removeTap(onBus: 0)
        recognitionRequest?.endAudio()
        recognitionTask?.cancel()
        
        recognitionRequest = nil
        recognitionTask = nil
        
        DispatchQueue.main.async {
            self.isListening = false
        }
        
        print("🛑 Stopped listening")
    }
    
    // MARK: - Parsing
    
    func parseItemFromText(_ text: String) -> (quantity: String, name: String) {
        let trimmed = text.trimmingCharacters(in: .whitespaces)
        
        // Try to extract quantity (numbers and units at start)
        let quantityPattern = #"^(\d+(?:\.\d+)?(?:\s*(?:pounds?|lbs?|oz|ounces?|cups?|tbsp|tsp|teaspoons?|tablespoons?|gallons?|quarts?|pints?|grams?|kg|kilograms?|liters?|ml|milliliters?))?)\s+(.+)$"#
        
        if let regex = try? NSRegularExpression(pattern: quantityPattern, options: .caseInsensitive),
           let match = regex.firstMatch(in: trimmed, range: NSRange(trimmed.startIndex..., in: trimmed)) {
            
            if let quantityRange = Range(match.range(at: 1), in: trimmed),
               let nameRange = Range(match.range(at: 2), in: trimmed) {
                let quantity = String(trimmed[quantityRange])
                let name = String(trimmed[nameRange])
                return (quantity, name)
            }
        }
        
        // No quantity found, use whole text as name
        return ("", trimmed)
    }
}
