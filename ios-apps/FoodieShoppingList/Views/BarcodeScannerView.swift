import SwiftUI
import AVFoundation

/// Barcode scanner view for adding pantry items via UPC/EAN codes
/// Uses AVFoundation to scan barcodes and Open Food Facts API for product lookup
struct BarcodeScannerView: View {
    @Environment(\.dismiss) var dismiss
    @EnvironmentObject var connectionManager: ConnectionManager
    
    @State private var scannedCode: String?
    @State private var isLoading = false
    @State private var productInfo: ProductInfo?
    @State private var errorMessage: String?
    @State private var showAddForm = false
    
    var body: some View {
        ZStack {
            // Camera preview
            CameraPreviewView(scannedCode: $scannedCode)
                .ignoresSafeArea()
            
            // Viewfinder overlay
            VStack {
                Spacer()
                
                // Scanning frame
                Rectangle()
                    .strokeBorder(Color.green, lineWidth: 3)
                    .frame(width: 280, height: 180)
                    .overlay(
                        VStack {
                            if isLoading {
                                ProgressView()
                                    .scaleEffect(1.5)
                                    .tint(.green)
                                Text("Looking up product...")
                                    .font(.caption)
                                    .foregroundColor(.white)
                                    .padding(.top, 8)
                            }
                        }
                    )
                
                Spacer()
            }
            
            // Top overlay
            VStack {
                HStack {
                    Text("Scan Barcode")
                        .font(.title2)
                        .fontWeight(.semibold)
                        .foregroundColor(.white)
                    
                    Spacer()
                    
                    Button {
                        dismiss()
                    } label: {
                        Image(systemName: "xmark.circle.fill")
                            .font(.title2)
                            .foregroundColor(.white)
                    }
                }
                .padding()
                .background(.ultraThinMaterial)
                
                Spacer()
            }
            
            // Bottom instructions
            VStack {
                Spacer()
                
                Text("Center barcode in frame")
                    .font(.subheadline)
                    .foregroundColor(.white)
                    .padding()
                    .background(.ultraThinMaterial)
                    .cornerRadius(10)
                    .padding(.bottom, 30)
            }
        }
        .onChange(of: scannedCode) {
            if let code = scannedCode, !isLoading {
                lookupProduct(barcode: code)
            }
        }
        .sheet(item: $productInfo) { info in
            AddPantryItemView(
                barcode: info.barcode,
                productName: info.name,
                category: info.suggestedCategory
            )
            .environmentObject(connectionManager)
        }
        .alert("Product Not Found", isPresented: .constant(errorMessage != nil)) {
            Button("Enter Manually") {
                if let code = scannedCode {
                    productInfo = ProductInfo(
                        barcode: code,
                        name: "",
                        suggestedCategory: "Pantry"
                    )
                }
                errorMessage = nil
            }
            Button("Scan Again") {
                scannedCode = nil
                errorMessage = nil
            }
            Button("Cancel", role: .cancel) {
                errorMessage = nil
                scannedCode = nil
                dismiss()
            }
        } message: {
            Text(errorMessage ?? "")
        }
    }
    
    /// Lookup product information from Open Food Facts API
    private func lookupProduct(barcode: String) {
        isLoading = true
        
        let urlString = "https://world.openfoodfacts.org/api/v0/product/\(barcode).json"
        guard let url = URL(string: urlString) else {
            errorMessage = "Invalid barcode format"
            isLoading = false
            return
        }
        
        URLSession.shared.dataTask(with: url) { data, response, error in
            DispatchQueue.main.async {
                isLoading = false
                
                if let error = error {
                    errorMessage = "Network error: \(error.localizedDescription)"
                    return
                }
                
                guard let data = data else {
                    errorMessage = "No data received from server"
                    return
                }
                
                do {
                    if let json = try JSONSerialization.jsonObject(with: data) as? [String: Any] {
                        let status = json["status"] as? Int ?? 0
                        
                        if status == 1, let product = json["product"] as? [String: Any] {
                            // Extract product information
                            let name = product["product_name"] as? String ?? ""
                            let brands = product["brands"] as? String ?? ""
                            let categories = product["categories"] as? String ?? ""
                            
                            // Combine name and brand
                            var fullName = name
                            if !brands.isEmpty && !name.contains(brands) {
                                fullName = "\(brands) \(name)"
                            }
                            
                            // Suggest category based on Open Food Facts categories
                            let suggestedCategory = detectCategory(
                                from: fullName,
                                categories: categories
                            )
                            
                            if !fullName.isEmpty {
                                productInfo = ProductInfo(
                                    barcode: barcode,
                                    name: fullName.trimmingCharacters(in: .whitespaces),
                                    suggestedCategory: suggestedCategory
                                )
                            } else {
                                errorMessage = "Product found but missing name (UPC: \(barcode))"
                            }
                        } else {
                            // Product not found (status = 0)
                            errorMessage = "Product not found in Open Food Facts database (UPC: \(barcode))"
                        }
                    } else {
                        errorMessage = "Invalid response from server"
                    }
                } catch {
                    errorMessage = "Failed to parse response: \(error.localizedDescription)"
                }
            }
        }.resume()
    }
    
    /// Detect pantry category from product name and categories
    private func detectCategory(from name: String, categories: String) -> String {
        let searchText = "\(name.lowercased()) \(categories.lowercased())"
        
        // Category keywords (matching VoiceCommandManager logic)
        if searchText.contains(anyOf: ["milk", "cheese", "yogurt", "butter", "cream", "egg"]) {
            return "Dairy"
        } else if searchText.contains(anyOf: ["apple", "banana", "lettuce", "tomato", "onion", "carrot", "pepper", "fruit", "vegetable"]) {
            return "Produce"
        } else if searchText.contains(anyOf: ["chicken", "beef", "pork", "turkey", "bacon", "sausage", "meat"]) {
            return "Meat"
        } else if searchText.contains(anyOf: ["fish", "salmon", "tuna", "shrimp", "crab", "seafood"]) {
            return "Seafood"
        } else if searchText.contains(anyOf: ["bread", "bagel", "muffin", "donut", "cake", "bakery"]) {
            return "Bakery"
        } else if searchText.contains(anyOf: ["frozen", "ice cream", "pizza"]) {
            return "Frozen"
        } else if searchText.contains(anyOf: ["juice", "soda", "water", "coffee", "tea", "drink", "beverage"]) {
            return "Beverages"
        } else if searchText.contains(anyOf: ["chips", "crackers", "popcorn", "candy", "chocolate", "snack"]) {
            return "Snacks"
        } else {
            return "Pantry"
        }
    }
}

/// Camera preview using AVFoundation for barcode scanning
struct CameraPreviewView: UIViewControllerRepresentable {
    @Binding var scannedCode: String?
    
    func makeUIViewController(context: Context) -> ScannerViewController {
        let controller = ScannerViewController()
        controller.delegate = context.coordinator
        return controller
    }
    
    func updateUIViewController(_ uiViewController: ScannerViewController, context: Context) {}
    
    func makeCoordinator() -> Coordinator {
        Coordinator(scannedCode: $scannedCode)
    }
    
    class Coordinator: NSObject, AVCaptureMetadataOutputObjectsDelegate {
        @Binding var scannedCode: String?
        private var lastScanTime: Date?
        
        init(scannedCode: Binding<String?>) {
            _scannedCode = scannedCode
        }
        
        func metadataOutput(
            _ output: AVCaptureMetadataOutput,
            didOutput metadataObjects: [AVMetadataObject],
            from connection: AVCaptureConnection
        ) {
            // Debounce: Only process one scan per 2 seconds
            if let lastTime = lastScanTime, Date().timeIntervalSince(lastTime) < 2.0 {
                return
            }
            
            if let metadataObject = metadataObjects.first as? AVMetadataMachineReadableCodeObject,
               let code = metadataObject.stringValue {
                // Haptic feedback
                AudioServicesPlaySystemSound(SystemSoundID(kSystemSoundID_Vibrate))
                
                lastScanTime = Date()
                scannedCode = code
            }
        }
    }
}

/// UIKit view controller for camera capture
class ScannerViewController: UIViewController {
    var captureSession: AVCaptureSession!
    var previewLayer: AVCaptureVideoPreviewLayer!
    weak var delegate: AVCaptureMetadataOutputObjectsDelegate?
    
    override func viewDidLoad() {
        super.viewDidLoad()
        setupCamera()
    }
    
    override func viewWillAppear(_ animated: Bool) {
        super.viewWillAppear(animated)
        
        if captureSession?.isRunning == false {
            DispatchQueue.global(qos: .userInitiated).async {
                self.captureSession.startRunning()
            }
        }
    }
    
    override func viewWillDisappear(_ animated: Bool) {
        super.viewWillDisappear(animated)
        
        if captureSession?.isRunning == true {
            captureSession.stopRunning()
        }
    }
    
    private func setupCamera() {
        captureSession = AVCaptureSession()
        
        guard let videoCaptureDevice = AVCaptureDevice.default(for: .video) else {
            showCameraError()
            return
        }
        
        let videoInput: AVCaptureDeviceInput
        
        do {
            videoInput = try AVCaptureDeviceInput(device: videoCaptureDevice)
        } catch {
            showCameraError()
            return
        }
        
        if captureSession.canAddInput(videoInput) {
            captureSession.addInput(videoInput)
        } else {
            showCameraError()
            return
        }
        
        let metadataOutput = AVCaptureMetadataOutput()
        
        if captureSession.canAddOutput(metadataOutput) {
            captureSession.addOutput(metadataOutput)
            
            metadataOutput.setMetadataObjectsDelegate(delegate, queue: DispatchQueue.main)
            // Support common barcode types
            metadataOutput.metadataObjectTypes = [
                .ean8,     // EAN-8
                .ean13,    // EAN-13 (most common)
                .upce,     // UPC-E
                .code128,  // Code 128
                .code39,   // Code 39
                .code93    // Code 93
            ]
        } else {
            showCameraError()
            return
        }
        
        previewLayer = AVCaptureVideoPreviewLayer(session: captureSession)
        previewLayer.frame = view.layer.bounds
        previewLayer.videoGravity = .resizeAspectFill
        view.layer.addSublayer(previewLayer)
    }
    
    override func viewDidLayoutSubviews() {
        super.viewDidLayoutSubviews()
        previewLayer?.frame = view.layer.bounds
    }
    
    private func showCameraError() {
        let alert = UIAlertController(
            title: "Camera Error",
            message: "Unable to access camera. Please check permissions in Settings.",
            preferredStyle: .alert
        )
        alert.addAction(UIAlertAction(title: "OK", style: .default))
        present(alert, animated: true)
    }
}

/// Product information from barcode lookup
struct ProductInfo: Identifiable {
    let id = UUID()
    let barcode: String
    let name: String
    let suggestedCategory: String
}

/// Helper extension for multi-keyword matching
extension String {
    func contains(anyOf keywords: [String]) -> Bool {
        keywords.contains { self.contains($0) }
    }
}
