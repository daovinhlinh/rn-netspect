"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Netspect = void 0;
const config_1 = require("../config");
const axiosCorrelate_1 = require("./axiosCorrelate");
const id_1 = require("./id");
const store_1 = require("./store");
const xhrPatch_1 = require("./xhrPatch");
/**
 * Installs the XHR patch. Idempotent, and a no-op when `enabled` is false, so the host
 * can call it unconditionally at startup.
 */
function init(config = {}) {
    (0, config_1.setConfig)(config);
    if (!(0, config_1.getConfig)().enabled)
        return;
    (0, xhrPatch_1.installXhrPatch)();
}
/**
 * Records a request the XHR patch cannot see — anything using native networking
 * (`react-native-blob-util`, `ReactNativeBlobUtil`, a native SDK).
 */
function record(manual) {
    if (!(0, config_1.getConfig)().enabled)
        return;
    const entry = {
        id: (0, id_1.nextId)(),
        method: manual.method.toUpperCase(),
        url: manual.url,
        requestHeaders: { ...(manual.requestHeaders ?? {}) },
        requestBody: manual.requestBody ?? null,
        requestBodyKind: manual.requestBody ? 'text' : 'none',
        requestBodyTruncated: false,
        outcome: manual.outcome ?? 'ok',
        status: manual.status ?? 0,
        responseHeaders: manual.responseHeaders ?? {},
        responseBody: manual.responseBody ?? null,
        responseBodyKind: manual.responseBody ? 'text' : 'none',
        responseBodyTruncated: false,
        responseBodyBytes: manual.responseBody?.length ?? 0,
        bodyEvicted: false,
        startedAt: Date.now() - (manual.durationMs ?? 0),
        durationMs: manual.durationMs ?? 0,
    };
    store_1.store.push(entry);
}
exports.Netspect = {
    init,
    record,
    attachAxios: (instance) => (0, axiosCorrelate_1.attachAxios)(instance),
    configure: (config) => (0, config_1.setConfig)(config),
    /** Pause/resume capture without removing the patch. */
    pause: xhrPatch_1.pauseCapture,
    resume: xhrPatch_1.resumeCapture,
    clear: () => store_1.store.clear(),
    getEntries: () => store_1.store.getSnapshot(),
    stats: () => store_1.store.stats(),
    /** Restores the original prototype methods. Mainly for tests. */
    uninstall: xhrPatch_1.uninstallXhrPatch,
};
//# sourceMappingURL=netspect.js.map