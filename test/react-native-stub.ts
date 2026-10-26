/** Minimal stand-in so the core/export modules can be exercised under plain node. */
export const Platform = { OS: 'ios', Version: '18.0', isPad: false };
export const Dimensions = { get: () => ({ width: 390, height: 844, scale: 3 }) };
export const Share = { share: async () => ({ action: 'sharedAction' }) };
export const Clipboard = { getString: async () => '', setString: (_: string) => {} };
