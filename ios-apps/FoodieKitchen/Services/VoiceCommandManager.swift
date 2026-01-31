import Foundation
import Speech
import AVFoundation
import Combine

enum ListeningMode: String, CaseIterable {
    case wakeWord = "Wake Word"
    case pushToTalk = "Push to Talk"
    case disabled = "Disabled"
}

class VoiceCommandManager: ObservableObject {
    @Published var isListening = false
    @Published var isWaitingForCommand = false  // After wake word detected
    @Published var voiceEnabled = false  // Master toggle - enables always-on listening
    @Published var lastCommand = ""
    @Published var lastRecognizedText = ""
    @Published var isAuthorized = false
    @Published var listeningMode: ListeningMode = .wakeWord
    @Published var isPushToTalkActive = false
    @Published var voiceError: String? = nil  // Show error to user
    @Published var commandTimeRemaining: Double = 0  // For countdown display
    @Published var isDictationMode = false  // For SousChefView dictation
    @Published var dictatedText = ""  // Text captured during dictation
    @Published var dictationText = ""  // Alias for SousChefView compatibility
    
    weak var recipeStore: RecipeStore?
    weak var timerManager: TimerManager?
    
    private let speechRecognizer = SFSpeechRecognizer(locale: Locale(identifier: "en-US"))
    private var recognitionRequest: SFSpeechAudioBufferRecognitionRequest?
    private var recognitionTask: SFSpeechRecognitionTask?
    private let audioEngine = AVAudioEngine()
    private let speechSynthesizer = AVSpeechSynthesizer()
    
    private let wakeWord = "foodie"
    private let alternateWakeWords = ["hey foodie", "kitchen", "hey kitchen", "food"]
    private var commandBuffer = ""
    private var lastCommandTime = Date()
    private var autoStopTimer: Timer?
    private var countdownTimer: Timer?
    private var wakeWordDetected = false
    private let commandTimeout: TimeInterval = 8.0  // Extended from 5 to 8 seconds
    
    // Error debouncing to prevent infinite restart loops
    private var errorCount = 0
    private var lastErrorTime = Date.distantPast
    private let maxErrorsBeforeStop = 3
    private let errorResetInterval: TimeInterval = 10.0
    
    init() {
        requestAuthorization()
    }
    
    func requestAuthorization() {
        SFSpeechRecognizer.requestAuthorization { [weak self] status in
            DispatchQueue.main.async {
                self?.isAuthorized = status == .authorized
                if status == .authorized {
                    print("✅ Speech recognition authorized")
                } else {
                    print("❌ Speech recognition not authorized: \(status.rawValue)")
                }
            }
        }
    }
    
    func startListening() {
        guard isAuthorized else {
            print("⚠️ Speech recognition not authorized")
            requestAuthorization()
            return
        }
        
        if recognitionTask != nil {
            stopListening()
        }
        
        wakeWordDetected = false
        isWaitingForCommand = false
        
        // Reset error count on successful start
        errorCount = 0
        
        let audioSession = AVAudioSession.sharedInstance()
        do {
            try audioSession.setCategory(.playAndRecord, mode: .measurement, options: [.duckOthers, .defaultToSpeaker])
            try audioSession.setActive(true, options: .notifyOthersOnDeactivation)
        } catch {
            print("❌ Audio session error: \(error)")
            return
        }
        
        recognitionRequest = SFSpeechAudioBufferRecognitionRequest()
        
        let inputNode = audioEngine.inputNode
        guard let recognitionRequest = recognitionRequest else {
            print("❌ Unable to create recognition request")
            return
        }
        
        recognitionRequest.shouldReportPartialResults = true
        
        recognitionTask = speechRecognizer?.recognitionTask(with: recognitionRequest) { [weak self] result, error in
            guard let self = self else { return }
            
            if let result = result {
                let transcript = result.bestTranscription.formattedString.lowercased()
                
                DispatchQueue.main.async {
                    self.lastRecognizedText = transcript
                    
                    // Two-stage detection: wake word, then command
                    if !self.wakeWordDetected {
                        // Stage 1: Listen for wake words
                        let detectedWakeWord = self.detectWakeWord(in: transcript)
                        if detectedWakeWord != nil {
                            print("🎤 Wake word detected! Listening for command...")
                            self.wakeWordDetected = true
                            self.isWaitingForCommand = true
                            self.speakFeedback("Listening")
                            self.voiceError = nil  // Clear any previous errors
                            
                            // Clear buffer and start fresh for command
                            self.commandBuffer = ""
                            self.lastRecognizedText = ""
                            
                            // Start countdown timer for command after wake word
                            self.autoStopTimer?.invalidate()
                            self.countdownTimer?.invalidate()
                            self.commandTimeRemaining = self.commandTimeout
                            
                            self.countdownTimer = Timer.scheduledTimer(withTimeInterval: 0.1, repeats: true) { _ in
                                self.commandTimeRemaining -= 0.1
                                if self.commandTimeRemaining <= 0 {
                                    self.countdownTimer?.invalidate()
                                }
                            }
                            
                            self.autoStopTimer = Timer.scheduledTimer(withTimeInterval: self.commandTimeout, repeats: false) { _ in
                                print("⏱️ Command timeout")
                                self.countdownTimer?.invalidate()
                                self.commandTimeRemaining = 0
                                self.speakFeedback("No command heard")
                                self.resetListening()
                            }
                        }
                    } else {
                        // Stage 2: Capture command after wake word
                        if !transcript.isEmpty && transcript != self.wakeWord {
                            // Got a command - process it
                            let command = transcript.replacingOccurrences(of: self.wakeWord, with: "").trimmingCharacters(in: .whitespaces)
                            if !command.isEmpty && command != self.commandBuffer {
                                print("🎤 Command received: '\(command)'")
                                self.commandBuffer = command
                                
                                // Stop listening IMMEDIATELY before processing
                                self.audioEngine.stop()
                                self.audioEngine.inputNode.removeTap(onBus: 0)
                                
                                self.processCommand(command)
                                
                                // Full reset after a delay
                                self.autoStopTimer?.invalidate()
                                self.autoStopTimer = Timer.scheduledTimer(withTimeInterval: 2.0, repeats: false) { _ in
                                    self.recognitionRequest?.endAudio()
                                    self.recognitionTask?.cancel()
                                    self.recognitionRequest = nil
                                    self.recognitionTask = nil
                                    self.resetListening()
                                }
                            }
                        }
                    }
                }
            }
            
            if error != nil {
                print("❌ Recognition error: \(String(describing: error))")
                self.handleRecognitionError()
            }
        }
        
        let recordingFormat = inputNode.outputFormat(forBus: 0)
        inputNode.installTap(onBus: 0, bufferSize: 1024, format: recordingFormat) { buffer, _ in
            recognitionRequest.append(buffer)
        }
        
        audioEngine.prepare()
        do {
            try audioEngine.start()
            isListening = true
            print("🎤 Voice recognition started - say 'Foodie' to activate")
        } catch {
            print("❌ Audio engine start error: \(error)")
        }
    }
    
    func stopListening() {
        autoStopTimer?.invalidate()
        autoStopTimer = nil
        countdownTimer?.invalidate()
        countdownTimer = nil
        commandTimeRemaining = 0
        
        if audioEngine.isRunning {
            audioEngine.stop()
            audioEngine.inputNode.removeTap(onBus: 0)
        }
        recognitionRequest?.endAudio()
        recognitionTask?.cancel()
        recognitionRequest = nil
        recognitionTask = nil
        isListening = false
        isWaitingForCommand = false
        wakeWordDetected = false
        isPushToTalkActive = false
        isDictationMode = false
        lastRecognizedText = ""
        print("🛑 Voice recognition stopped")
    }
    
    // MARK: - Wake Word Detection
    
    private func detectWakeWord(in transcript: String) -> String? {
        let lowercased = transcript.lowercased()
        
        // Check primary wake word first
        if lowercased.contains(wakeWord) {
            return wakeWord
        }
        
        // Check alternate wake words
        for alternate in alternateWakeWords {
            if lowercased.contains(alternate) {
                return alternate
            }
        }
        
        return nil
    }
    
    // MARK: - Dictation Mode (for SousChefView)
    
    func startDictation() {
        guard isAuthorized else {
            print("⚠️ Speech recognition not authorized for dictation")
            requestAuthorization()
            return
        }
        
        if recognitionTask != nil {
            stopListening()
        }
        
        isDictationMode = true
        dictatedText = ""
        
        let audioSession = AVAudioSession.sharedInstance()
        do {
            try audioSession.setCategory(.playAndRecord, mode: .measurement, options: [.duckOthers, .defaultToSpeaker])
            try audioSession.setActive(true, options: .notifyOthersOnDeactivation)
        } catch {
            print("❌ Audio session error (dictation): \(error)")
            isDictationMode = false
            return
        }
        
        recognitionRequest = SFSpeechAudioBufferRecognitionRequest()
        
        let inputNode = audioEngine.inputNode
        guard let recognitionRequest = recognitionRequest else {
            print("❌ Unable to create recognition request (dictation)")
            isDictationMode = false
            return
        }
        
        recognitionRequest.shouldReportPartialResults = true
        
        recognitionTask = speechRecognizer?.recognitionTask(with: recognitionRequest) { [weak self] result, error in
            guard let self = self else { return }
            
            if let result = result {
                let transcript = result.bestTranscription.formattedString
                DispatchQueue.main.async {
                    self.dictatedText = transcript
                    self.dictationText = transcript
                    self.lastRecognizedText = transcript
                }
            }
            
            if error != nil {
                print("❌ Dictation recognition error: \(String(describing: error))")
            }
        }
        
        let recordingFormat = inputNode.outputFormat(forBus: 0)
        inputNode.installTap(onBus: 0, bufferSize: 1024, format: recordingFormat) { buffer, _ in
            recognitionRequest.append(buffer)
        }
        
        audioEngine.prepare()
        do {
            try audioEngine.start()
            isListening = true
            print("🎤 Dictation started")
        } catch {
            print("❌ Audio engine start error (dictation): \(error)")
            isDictationMode = false
        }
    }
    
    func stopDictation() -> String {
        let finalText = dictationText
        dictationText = ""
        dictatedText = ""
        stopListening()
        return finalText
    }
    
    private func resetListening() {
        // Reset to listening for wake word again (if voice is enabled)
        wakeWordDetected = false
        isWaitingForCommand = false
        lastRecognizedText = ""
        commandBuffer = ""
        countdownTimer?.invalidate()
        commandTimeRemaining = 0
        
        if voiceEnabled && listeningMode == .wakeWord {
            // Fully restart recognition
            print("🔄 Restarting recognition for next 'Foodie' wake word")
            stopListening()
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) {
                self.startListening()
            }
        } else {
            stopListening()
        }
    }
    
    // MARK: - Push to Talk Mode
    
    func startPushToTalk() {
        guard isAuthorized else {
            voiceError = "Microphone permission required. Please enable in Settings."
            return
        }
        
        voiceError = nil
        isPushToTalkActive = true
        isWaitingForCommand = true
        wakeWordDetected = true  // Skip wake word detection
        
        startListening()
        speakFeedback("Listening")
        print("🎤 Push-to-talk started - speak your command")
    }
    
    func stopPushToTalk() {
        isPushToTalkActive = false
        
        // Process any pending command
        if !commandBuffer.isEmpty {
            processCommand(commandBuffer)
        }
        
        stopListening()
        print("🎤 Push-to-talk stopped")
    }
    
    func retryAfterError() {
        voiceError = nil
        errorCount = 0
        if listeningMode == .wakeWord {
            voiceEnabled = true
            startListening()
        }
    }
    
    private func handleRecognitionError() {
        // Track error timing to prevent infinite restart loops
        let now = Date()
        
        // Reset error count if it's been a while since last error
        if now.timeIntervalSince(lastErrorTime) > errorResetInterval {
            errorCount = 0
        }
        
        lastErrorTime = now
        errorCount += 1
        
        print("⚠️ Error count: \(errorCount)/\(maxErrorsBeforeStop)")
        
        if errorCount >= maxErrorsBeforeStop {
            print("🛑 Too many errors - stopping voice recognition. Tap to retry.")
            voiceEnabled = false
            stopListening()
            
            DispatchQueue.main.async {
                self.voiceError = "Voice recognition stopped due to errors. Tap to retry."
            }
        } else {
            resetListening()
        }
    }
    
    private func processCommand(_ command: String) {
        DispatchQueue.main.async {
            self.lastCommand = "foodie \(command)"
            print("🎤 Processing command: '\(command)'")
            
            let normalized = command.lowercased().trimmingCharacters(in: .whitespaces)
            
            // Navigation commands
            if normalized.contains("next step") || normalized == "next" {
                self.recipeStore?.nextStep()
                if let recipeStore = self.recipeStore,
                   recipeStore.currentInstructionStep < recipeStore.instructionSteps.count {
                    let instruction = recipeStore.instructionSteps[recipeStore.currentInstructionStep]
                    self.speakText(instruction)
                }
            }
            else if normalized.contains("previous step") || normalized.contains("go back") || normalized == "back" {
                self.recipeStore?.previousStep()
                if let recipeStore = self.recipeStore,
                   recipeStore.currentInstructionStep < recipeStore.instructionSteps.count {
                    let instruction = recipeStore.instructionSteps[recipeStore.currentInstructionStep]
                    self.speakText(instruction)
                }
            }
            else if normalized.contains("what's next") || normalized.contains("what is next") {
                if let recipeStore = self.recipeStore,
                   recipeStore.currentInstructionStep < recipeStore.instructionSteps.count {
                    let instruction = recipeStore.instructionSteps[recipeStore.currentInstructionStep]
                    self.speakText(instruction)
                } else {
                    self.speakFeedback("You've finished the recipe!")
                }
            }
            else if normalized.contains("go to ingredients") || normalized.contains("show ingredients") {
                // Jump to ingredients view (already on ingredients side in split view)
                self.speakFeedback("Showing ingredients")
            }
            else if normalized.contains("go home") || normalized == "home" {
                self.recipeStore?.goHome()
                self.speakFeedback("Going home")
            }
            
            // Timer commands
            else if normalized.contains("start timer") || normalized.contains("set timer") {
                if let minutes = self.extractMinutes(from: normalized) {
                    self.timerManager?.addTimer(label: "Voice Timer", duration: TimeInterval(minutes * 60))
                    self.speakFeedback("Timer started for \(minutes) minute\(minutes == 1 ? "" : "s")")
                } else {
                    self.speakFeedback("How many minutes?")
                }
            }
            else if normalized.contains("pause timer") || normalized.contains("stop timer") {
                if let timer = self.timerManager?.timers.first {
                    self.timerManager?.pauseTimer(timer.id)
                    self.speakFeedback("Timer paused")
                } else {
                    self.speakFeedback("No active timer")
                }
            }
            else if normalized.contains("resume timer") {
                if let timer = self.timerManager?.timers.first {
                    self.timerManager?.startTimer(timer.id)
                    self.speakFeedback("Timer resumed")
                } else {
                    self.speakFeedback("No timer to resume")
                }
            }
            else if normalized.contains("cancel timer") {
                if let timer = self.timerManager?.timers.first {
                    self.timerManager?.removeTimer(timer.id)
                    self.speakFeedback("Timer cancelled")
                } else {
                    self.speakFeedback("No timer to cancel")
                }
            }
            
            // Reading commands
            else if normalized.contains("read current step") || normalized.contains("read step") {
                if let recipeStore = self.recipeStore,
                   recipeStore.currentRecipe != nil,
                   recipeStore.currentInstructionStep < recipeStore.instructionSteps.count {
                    let instruction = recipeStore.instructionSteps[recipeStore.currentInstructionStep]
                    self.speakText(instruction)
                } else {
                    self.speakFeedback("No current step")
                }
            }
            else if normalized.contains("read ingredients") {
                if let recipe = self.recipeStore?.currentRecipe {
                    let ingredientList = recipe.ingredients.map { $0.name }.joined(separator: ", ")
                    self.speakText("Ingredients: \(ingredientList)")
                } else {
                    self.speakFeedback("No recipe loaded")
                }
            }
            
            // Meal switching commands
            else if normalized.contains("show breakfast") {
                self.showMealSlot("breakfast")
            }
            else if normalized.contains("show lunch") {
                self.showMealSlot("lunch")
            }
            else if normalized.contains("show dinner") {
                self.showMealSlot("dinner")
            }
            else if normalized.contains("show dessert") || normalized.contains("show side") {
                self.showAdditionalItem(type: normalized.contains("dessert") ? "dessert" : "side")
            }
            
            // Sent recipes management
            else if normalized.contains("clear sent") || normalized.contains("clear recipes") {
                self.recipeStore?.clearSentRecipes()
                self.speakFeedback("Sent recipes cleared")
            }
            else if normalized.contains("go home") || normalized.contains("home") {
                self.recipeStore?.currentRecipe = nil
                self.recipeStore?.currentInstructionStep = 0
                self.speakFeedback("Going home")
            }
            
            else {
                self.speakFeedback("Command not recognized")
                print("⚠️ Unknown command: '\(command)'")
            }
        }
    }
    
    private func extractMinutes(from command: String) -> Int? {
        let components = command.components(separatedBy: .whitespaces)
        for (index, word) in components.enumerated() {
            if let number = Int(word) {
                // Check if next word indicates minutes/hours
                if index + 1 < components.count {
                    let unit = components[index + 1].lowercased()
                    if unit.contains("hour") {
                        return number * 60  // Convert hours to minutes
                    } else if unit.contains("minute") {
                        return number
                    } else if unit.contains("second") {
                        return max(1, number / 60)  // Convert seconds to minutes (min 1)
                    }
                }
                // Default to minutes
                return number
            }
        }
        return nil
    }
    
    private func showMealSlot(_ slot: String) {
        guard let recipeStore = recipeStore else { return }
        
        // Find meal slot
        if let mealSlot = recipeStore.availableMealSlots.first(where: { $0.slot.lowercased() == slot.lowercased() }) {
            recipeStore.loadRecipeById(mealSlot.recipeId)
            speakFeedback("Loading \(slot)")
        } else {
            speakFeedback("No \(slot) meal available")
        }
    }
    
    private func showAdditionalItem(type: String) {
        guard let recipeStore = recipeStore else { return }
        
        // Find first additional item of this type across all meal slots
        for mealSlot in recipeStore.availableMealSlots {
            if let item = mealSlot.additionalItems.first(where: { $0.itemType.lowercased() == type.lowercased() }) {
                recipeStore.loadRecipeById(item.recipeId)
                speakFeedback("Loading \(item.title)")
                return
            }
        }
        
        speakFeedback("No \(type) available")
    }
    
    func speakText(_ text: String) {
        let utterance = AVSpeechUtterance(string: text)
        utterance.voice = AVSpeechSynthesisVoice(language: "en-US")
        utterance.rate = 0.5  // Slightly slower for cooking instructions
        speechSynthesizer.speak(utterance)
    }
    
    // Super Wow Phase 4: Sous Chef Brain 🧠
    func askSousChef(_ query: String) {
        let lowerQuery = query.lowercased()
        
        if lowerQuery.contains("substitute") || lowerQuery.contains("replace") {
            handleSubstitution(lowerQuery)
        } else if lowerQuery.contains("timer") {
            handleTimerHelp(lowerQuery)
        } else if lowerQuery.contains("joke") {
            speakText("Why did the tomato turn red? Because it saw the salad dressing!")
        } else if lowerQuery.contains("hello") || lowerQuery.contains("hi") {
            speakText("Hello! I'm ready to help you cook.")
        } else {
            speakText("I'm not sure about that yet, but I'm learning every day.")
        }
    }
    
    private func handleSubstitution(_ query: String) {
        if query.contains("milk") {
            speakText("You can substitute milk with yogurt, almond milk, or even water with a bit of butter.")
        } else if query.contains("egg") {
            speakText("For eggs, try using applesauce, mashed banana, or a flax seed mix.")
        } else if query.contains("butter") {
            speakText("Olive oil or coconut oil are great butter substitutes.")
        } else {
            speakText("I can help with common substitutions like milk, eggs, or butter. Which one do you need?")
        }
    }
    
    private func handleTimerHelp(_ query: String) {
        if query.contains("egg") {
            speakText("Boil eggs for 7 minutes for soft, or 10 minutes for hard boiled.")
        } else if query.contains("steak") {
            speakText("For medium-rare steak, cook for about 3 minutes each side.")
        } else {
            speakText("I can suggest timers for eggs, steak, or pasta. Just ask!")
        }
    }

    func speakFeedback(_ feedback: String) {
        let utterance = AVSpeechUtterance(string: feedback)
        utterance.voice = AVSpeechSynthesisVoice(language: "en-US")
        utterance.rate = 0.55
        utterance.volume = 1.0
        speechSynthesizer.speak(utterance)
    }
}
