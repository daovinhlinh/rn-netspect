"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BODY_SEARCH_MIN_LENGTH = void 0;
exports.matchEntry = matchEntry;
/** Scanning every retained body on each keystroke is wasteful for a single character. */
exports.BODY_SEARCH_MIN_LENGTH = 2;
function safeDecode(value) {
    try {
        return decodeURIComponent(value);
    }
    catch {
        // A malformed percent-escape in a captured URL must not break the filter.
        return value;
    }
}
/**
 * Searches URL, method, status, decoded query params, and both bodies.
 *
 * Bodies are searched raw — the buffer holds raw values — so you can find a request by a
 * token or id you already know. The list never renders body content, so a match reveals
 * nothing the detail view would not already gate behind "Reveal secrets".
 *
 * Returns `null` for an empty query (everything matches), `'none'` for no match, or the
 * field that hit.
 */
function matchEntry(entry, needle) {
    if (!needle)
        return null;
    if (entry.url.toLowerCase().includes(needle) ||
        entry.method.toLowerCase().includes(needle) ||
        String(entry.status).includes(needle)) {
        return 'url';
    }
    // Percent-encoded params only match once decoded.
    const decoded = safeDecode(entry.url);
    if (decoded !== entry.url && decoded.toLowerCase().includes(needle))
        return 'params';
    if (needle.length >= exports.BODY_SEARCH_MIN_LENGTH) {
        if (entry.requestBody?.toLowerCase().includes(needle))
            return 'request body';
        if (entry.responseBody?.toLowerCase().includes(needle))
            return 'response body';
    }
    return 'none';
}
//# sourceMappingURL=search.js.map