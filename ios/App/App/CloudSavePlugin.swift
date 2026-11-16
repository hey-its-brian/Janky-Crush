import Foundation
import Capacitor

/// The game's save in iCloud key-value storage. The web code calls this
/// from src/cloud.js. A save is a few kilobytes of JSON text; iCloud allows
/// 1 MB for each app.
@objc(CloudSavePlugin)
public class CloudSavePlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "CloudSavePlugin"
    public let jsName = "CloudSave"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "get", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "set", returnType: CAPPluginReturnPromise)
    ]

    private let store = NSUbiquitousKeyValueStore.default

    /// True if the phone is signed in to iCloud.
    private var available: Bool {
        return FileManager.default.ubiquityIdentityToken != nil
    }

    override public func load() {
        // Ask iCloud for the newest values at the start.
        store.synchronize()
    }

    /// get({ key }) gives { value, available }. `value` is null if there is none.
    @objc func get(_ call: CAPPluginCall) {
        guard let key = call.getString("key") else {
            call.reject("key is required")
            return
        }
        store.synchronize()
        var result: [String: Any] = ["available": available]
        if let value = store.string(forKey: key) {
            result["value"] = value
        } else {
            result["value"] = NSNull()
        }
        call.resolve(result)
    }

    /// set({ key, value }) keeps the text and sends it to iCloud.
    @objc func set(_ call: CAPPluginCall) {
        guard let key = call.getString("key"), let value = call.getString("value") else {
            call.reject("key and value are required")
            return
        }
        store.set(value, forKey: key)
        store.synchronize()
        call.resolve(["available": available])
    }
}

/// The app's one screen: the web view with the game. It adds the plugins
/// that are a part of this app (not npm packages).
class MainViewController: CAPBridgeViewController {
    override open func capacitorDidLoad() {
        bridge?.registerPluginInstance(CloudSavePlugin())
    }

    // The game is full screen: no status bar over the top bar.
    override var prefersStatusBarHidden: Bool {
        return true
    }
}
