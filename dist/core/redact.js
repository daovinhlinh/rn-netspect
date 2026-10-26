"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.viewBody = exports.viewHeaders = exports.isMasked = exports.MASK = void 0;
exports.maskValue = maskValue;
exports.redactHeaderValue = redactHeaderValue;
exports.redactHeaders = redactHeaders;
exports.maskEnvValue = maskEnvValue;
exports.redactEnv = redactEnv;
exports.redactBodyText = redactBodyText;
const config_1 = require("../config");
exports.MASK = '•'.repeat(8);
/**
 * Heuristic, used only for styling a masked leaf differently in the JSON tree. A response
 * could legitimately contain eight bullets; a false positive costs nothing because this
 * never gates access to anything.
 */
const isMasked = (value) => value.includes(exports.MASK);
exports.isMasked = isMasked;
/** Keeps the scheme prefix and length, which is usually all you need to diagnose. */
function maskValue(value) {
    if (!value)
        return value;
    const spaceAt = value.indexOf(' ');
    // "Bearer eyJ…" -> "Bearer ••••••••(len 847)"
    if (spaceAt > 0 && spaceAt < 12) {
        return `${value.slice(0, spaceAt)} ${exports.MASK}(len ${value.length - spaceAt - 1})`;
    }
    return `${exports.MASK}(len ${value.length})`;
}
function redactHeaderValue(name, value) {
    return (0, config_1.getConfig)().redactHeaders.includes(name.toLowerCase()) ? maskValue(value) : value;
}
function redactHeaders(headers) {
    const out = {};
    for (const name of Object.keys(headers)) {
        out[name] = redactHeaderValue(name, headers[name] ?? '');
    }
    return out;
}
/**
 * Redaction is applied when data is *shown or exported*, never when it is captured.
 * Masking at capture time would be destructive, which would make the "Reveal secrets"
 * toggle a lie and make generated cURL permanently un-runnable. The buffer therefore
 * holds raw values — see the security note in the README.
 */
const viewHeaders = (headers, reveal) => reveal ? headers : redactHeaders(headers);
exports.viewHeaders = viewHeaders;
const viewBody = (text, reveal) => reveal ? text : redactBodyText(text);
exports.viewBody = viewBody;
/** Shows enough of a key to recognise it without handing over the whole secret. */
function maskEnvValue(value) {
    if (value.length <= 8)
        return exports.MASK;
    return `${value.slice(0, 4)}…${value.slice(-4)} (len ${value.length})`;
}
function redactEnv(env) {
    const { redactEnvKeys } = (0, config_1.getConfig)();
    const out = {};
    for (const key of Object.keys(env).sort()) {
        const value = env[key];
        if (value == null)
            continue;
        out[key] = redactEnvKeys.test(key) ? maskEnvValue(value) : value;
    }
    return out;
}
const MAX_DEPTH = 8;
/**
 * Walks a parsed JSON body and masks values whose key looks sensitive. Returns the
 * input untouched when nothing matched, so the common case allocates nothing.
 */
function redactNode(node, depth) {
    if (depth > MAX_DEPTH || node == null || typeof node !== 'object')
        return node;
    const { redactBodyKeys } = (0, config_1.getConfig)();
    if (Array.isArray(node)) {
        let changed = false;
        const next = node.map((item) => {
            const redacted = redactNode(item, depth + 1);
            if (redacted !== item)
                changed = true;
            return redacted;
        });
        return changed ? next : node;
    }
    let changed = false;
    const next = {};
    for (const [key, value] of Object.entries(node)) {
        if (redactBodyKeys.test(key) && typeof value === 'string') {
            next[key] = maskValue(value);
            changed = true;
            continue;
        }
        const redacted = redactNode(value, depth + 1);
        if (redacted !== value)
            changed = true;
        next[key] = redacted;
    }
    return changed ? next : node;
}
/**
 * Best-effort redaction of a serialised body. Non-JSON input is returned as-is —
 * guessing at arbitrary text formats would mangle more than it protects.
 */
function redactBodyText(text) {
    if (!text)
        return text;
    const trimmed = text.trimStart();
    if (!trimmed.startsWith('{') && !trimmed.startsWith('['))
        return text;
    try {
        const parsed = JSON.parse(text);
        const redacted = redactNode(parsed, 0);
        return redacted === parsed ? text : JSON.stringify(redacted);
    }
    catch {
        return text;
    }
}
//# sourceMappingURL=redact.js.map