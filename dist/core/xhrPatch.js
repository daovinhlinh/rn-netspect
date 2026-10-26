"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resumeCapture = exports.pauseCapture = exports.isCapturing = void 0;
exports.installXhrPatch = installXhrPatch;
exports.uninstallXhrPatch = uninstallXhrPatch;
const config_1 = require("../config");
const axiosCorrelate_1 = require("./axiosCorrelate");
const bodies_1 = require("./bodies");
const id_1 = require("./id");
const store_1 = require("./store");
const MARK = '__netspect_patched__';
/**
 * Keyed off the XHR instance so a request that is dropped before `send` leaves nothing
 * behind, and so we never add an enumerable property to objects the app owns.
 */
const metas = new WeakMap();
let uninstall = null;
let paused = false;
const isCapturing = () => uninstall !== null && !paused;
exports.isCapturing = isCapturing;
const pauseCapture = () => {
    paused = true;
};
exports.pauseCapture = pauseCapture;
const resumeCapture = () => {
    paused = false;
};
exports.resumeCapture = resumeCapture;
/**
 * Patches `XMLHttpRequest.prototype` in place. Deliberately patches the prototype
 * rather than replacing the global constructor: that preserves `instanceof` and the
 * statics (`XMLHttpRequest.DONE`), composes with other patchers like Reactotron
 * (each captures the previous function), and also covers code that deep-imports
 * `react-native/Libraries/Network/XMLHttpRequest` instead of using the global.
 */
function installXhrPatch() {
    if (uninstall)
        return uninstall;
    const XHR = globalThis.XMLHttpRequest;
    if (!XHR?.prototype || XHR.prototype[MARK])
        return () => { };
    const originalOpen = XHR.prototype.open;
    const originalSend = XHR.prototype.send;
    const originalSetRequestHeader = XHR.prototype.setRequestHeader;
    XHR.prototype.open = function patchedOpen(method, url, ...rest) {
        try {
            metas.set(this, {
                id: (0, id_1.nextId)(),
                method: String(method ?? 'GET').toUpperCase(),
                url: String(url ?? ''),
                headers: {},
                t0: 0,
                startedAt: 0,
                tracked: false,
            });
        }
        catch {
            // Never let instrumentation break a real request.
        }
        return originalOpen.call(this, method, url, ...rest);
    };
    XHR.prototype.setRequestHeader = function patchedSetRequestHeader(name, value) {
        try {
            const meta = metas.get(this);
            if (meta) {
                if (String(name).toLowerCase() === axiosCorrelate_1.CORRELATION_HEADER) {
                    // Record it for grouping, then swallow it — this header must never
                    // reach the server.
                    meta.correlationId = String(value);
                    return;
                }
                // Original casing is kept so generated cURL looks like the real request.
                meta.headers[name] = String(value);
            }
        }
        catch {
            /* ignore */
        }
        return originalSetRequestHeader.call(this, name, value);
    };
    XHR.prototype.send = function patchedSend(body) {
        try {
            const meta = metas.get(this);
            if (meta && (0, config_1.getConfig)().enabled && !paused && !(0, config_1.isIgnoredUrl)(meta.url)) {
                track(this, meta, body);
            }
        }
        catch {
            /* ignore */
        }
        return originalSend.call(this, body);
    };
    Object.defineProperty(XHR.prototype, MARK, {
        value: true,
        enumerable: false,
        configurable: true,
    });
    uninstall = () => {
        XHR.prototype.open = originalOpen;
        XHR.prototype.send = originalSend;
        XHR.prototype.setRequestHeader = originalSetRequestHeader;
        delete XHR.prototype[MARK];
        uninstall = null;
    };
    return uninstall;
}
function uninstallXhrPatch() {
    uninstall?.();
}
function track(xhr, meta, body) {
    const request = (0, bodies_1.readRequestBody)(body);
    meta.t0 = (0, id_1.now)();
    meta.startedAt = Date.now();
    meta.tracked = true;
    const entry = {
        id: meta.id,
        correlationId: meta.correlationId,
        method: meta.method,
        url: meta.url,
        requestHeaders: { ...meta.headers },
        requestBody: request.text,
        requestBodyKind: request.kind,
        requestBodyTruncated: request.truncated,
        formParts: request.formParts,
        outcome: 'pending',
        status: 0,
        responseHeaders: {},
        responseBody: null,
        responseBodyKind: 'none',
        responseBodyTruncated: false,
        responseBodyBytes: 0,
        bodyEvicted: false,
        startedAt: meta.startedAt,
        durationMs: 0,
    };
    store_1.store.push(entry);
    let outcome = 'ok';
    const tag = (value) => () => {
        outcome = value;
    };
    // Only terminal events. Subscribing to 'readystatechange' or 'progress' would flip
    // RN's `_incrementalEvents` flag, which changes native->JS bridge traffic for every
    // request in the app — a real performance regression, not just noise.
    xhr.addEventListener('error', tag('error'));
    xhr.addEventListener('timeout', tag('timeout'));
    xhr.addEventListener('abort', tag('cancelled'));
    const finish = () => {
        try {
            xhr.removeEventListener('loadend', finish);
            const responseHeaders = (0, bodies_1.readResponseHeaders)(xhr);
            if ((0, config_1.isIgnoredContentType)(responseHeaders['content-type'] ?? responseHeaders['Content-Type'])) {
                store_1.store.update(meta.id, {
                    outcome,
                    status: xhr.status ?? 0,
                    responseHeaders,
                    responseBody: null,
                    responseBodyKind: 'binary',
                    durationMs: Math.round((0, id_1.now)() - meta.t0),
                });
                return;
            }
            const response = (0, bodies_1.readResponseBody)(xhr, outcome);
            store_1.store.update(meta.id, {
                outcome,
                status: xhr.status ?? 0,
                responseHeaders,
                responseUrl: xhr.responseURL,
                responseBody: response.text,
                responseBodyKind: response.kind,
                responseBodyTruncated: response.truncated,
                responseBodyBytes: response.bytes,
                durationMs: Math.round((0, id_1.now)() - meta.t0),
            });
        }
        catch {
            store_1.store.update(meta.id, { outcome: 'error', durationMs: Math.round((0, id_1.now)() - meta.t0) });
        }
    };
    xhr.addEventListener('loadend', finish);
}
//# sourceMappingURL=xhrPatch.js.map