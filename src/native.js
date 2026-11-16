// The native iPhone app. There the game runs in a web view (Capacitor),
// and this file is the bridge to the native side: haptics and the iCloud
// save. In a browser, `isNative` is false and `native()` does nothing.

const cap = globalThis.Capacitor;

export const isNative = Boolean(cap?.isNativePlatform?.());

// Call a method of a native plugin. Resolves to its result, or to null in
// a browser or if the call fails: the game must never stop for it.
export function native(plugin, method, options = {}) {
  if (!isNative) return Promise.resolve(null);
  try {
    const own = cap.Plugins?.[plugin]?.[method];
    const call = own ? cap.Plugins[plugin][method](options) : cap.nativePromise(plugin, method, options);
    return Promise.resolve(call).catch(() => null);
  } catch {
    return Promise.resolve(null);
  }
}
