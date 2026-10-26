"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isUnredactedFallback = void 0;
exports.describeBody = describeBody;
const redact_1 = require("./redact");
/**
 * `redactBodyText` returns its input unchanged when it cannot parse the body, so a
 * truncated or non-JSON payload is shown and copied *unredacted* even with `reveal` off.
 * Comparing the two strings is how we detect that, so the UI can say so out loud.
 */
const redactionApplied = (raw, shown) => shown !== raw;
function describeBody(entry, which, reveal) {
    if (which === 'response' && entry.bodyEvicted)
        return { mode: 'evicted' };
    const raw = which === 'request' ? entry.requestBody : entry.responseBody;
    if (!raw)
        return { mode: 'none' };
    const kind = which === 'request' ? entry.requestBodyKind : entry.responseBodyKind;
    const truncated = which === 'request' ? entry.requestBodyTruncated : entry.responseBodyTruncated;
    // Placeholders like '<blob 48122 bytes application/pdf>' — nothing to parse or redact.
    if (kind === 'binary')
        return { mode: 'binary', text: raw };
    const shown = (0, redact_1.viewBody)(raw, reveal) ?? '';
    const trimmed = shown.trimStart();
    const looksJson = kind === 'json' || trimmed.startsWith('{') || trimmed.startsWith('[');
    if (looksJson) {
        try {
            return { mode: 'tree', value: JSON.parse(shown), text: shown, truncated };
        }
        catch {
            // Truncation is the overwhelmingly likely cause when the flag is set.
            return { mode: 'truncated', text: shown, redacted: redactionApplied(raw, shown) };
        }
    }
    return { mode: 'text', text: shown, redacted: redactionApplied(raw, shown) };
}
/**
 * True when a body is being shown in the clear despite `reveal` being off, because
 * redaction could not parse it. The UI surfaces this rather than letting it pass silently.
 */
const isUnredactedFallback = (view, reveal) => !reveal && (view.mode === 'text' || view.mode === 'truncated') && !view.redacted;
exports.isUnredactedFallback = isUnredactedFallback;
//# sourceMappingURL=bodyView.js.map