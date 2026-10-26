"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CORRELATION_HEADER = void 0;
exports.attachAxios = attachAxios;
const id_1 = require("./id");
/**
 * Stamped by `attachAxios`, recorded by the XHR patch, and stripped before the request
 * is sent — it never reaches the server.
 */
exports.CORRELATION_HEADER = 'x-netspect-correlation';
function readHeader(headers) {
    if (!headers)
        return undefined;
    if (typeof headers.get === 'function')
        return headers.get(exports.CORRELATION_HEADER) ?? undefined;
    return headers[exports.CORRELATION_HEADER];
}
function writeHeader(headers, value) {
    if (!headers)
        return;
    if (typeof headers.set === 'function')
        headers.set(exports.CORRELATION_HEADER, value);
    else
        headers[exports.CORRELATION_HEADER] = value;
}
/**
 * Groups every attempt of one logical request under a single id, so a 401-refresh-replay
 * or a 3x network retry reads as one row with "attempt 2/4" rather than as unrelated
 * entries.
 *
 * Only stamping when the header is absent is load-bearing: all three retry paths in a
 * typical axios setup re-invoke `instance(originalRequest)` with the *same* config
 * object, so its headers already carry the id from the first attempt.
 */
function attachAxios(instance) {
    const handle = instance.interceptors.request.use((config) => {
        try {
            if (!readHeader(config.headers))
                writeHeader(config.headers, (0, id_1.nextId)());
        }
        catch {
            // Correlation is a nicety; never fail a request over it.
        }
        return config;
    });
    return () => instance.interceptors.request.eject(handle);
}
//# sourceMappingURL=axiosCorrelate.js.map