export declare const isCapturing: () => boolean;
export declare const pauseCapture: () => void;
export declare const resumeCapture: () => void;
/**
 * Patches `XMLHttpRequest.prototype` in place. Deliberately patches the prototype
 * rather than replacing the global constructor: that preserves `instanceof` and the
 * statics (`XMLHttpRequest.DONE`), composes with other patchers like Reactotron
 * (each captures the previous function), and also covers code that deep-imports
 * `react-native/Libraries/Network/XMLHttpRequest` instead of using the global.
 */
export declare function installXhrPatch(): () => void;
export declare function uninstallXhrPatch(): void;
//# sourceMappingURL=xhrPatch.d.ts.map