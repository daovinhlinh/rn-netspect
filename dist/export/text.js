"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.statusLabel = void 0;
exports.toEntryText = toEntryText;
exports.toSessionText = toSessionText;
const bodies_1 = require("../core/bodies");
const redact_1 = require("../core/redact");
const collect_1 = require("../info/collect");
const curl_1 = require("./curl");
const headerBlock = (headers, reveal) => Object.entries((0, redact_1.viewHeaders)(headers, reveal))
    .map(([name, value]) => `  ${name}: ${value}`)
    .join('\n') || '  (none)';
const statusLabel = (entry) => {
    switch (entry.outcome) {
        case 'pending':
            return '···';
        case 'error':
            return 'ERR';
        case 'timeout':
            return 'TMO';
        case 'cancelled':
            return 'CNX';
        default:
            return String(entry.status || '—');
    }
};
exports.statusLabel = statusLabel;
function toEntryText(entry, opts = {}) {
    const reveal = opts.reveal ?? false;
    const lines = [
        `${entry.method} ${entry.url}`,
        `${(0, exports.statusLabel)(entry)} · ${entry.durationMs}ms · ${new Date(entry.startedAt).toISOString()}`,
    ];
    if (entry.correlationId)
        lines.push(`correlation: ${entry.correlationId}`);
    lines.push('', 'REQUEST HEADERS', headerBlock(entry.requestHeaders, reveal));
    if (entry.requestBody) {
        lines.push('', 'REQUEST BODY', (0, bodies_1.prettyJson)((0, redact_1.viewBody)(entry.requestBody, reveal)));
        if (entry.requestBodyTruncated)
            lines.push('[truncated]');
    }
    lines.push('', 'RESPONSE HEADERS', headerBlock(entry.responseHeaders, reveal));
    if (entry.bodyEvicted) {
        lines.push('', 'RESPONSE BODY', '[evicted to stay under the memory budget]');
    }
    else if (entry.responseBody) {
        lines.push('', 'RESPONSE BODY', (0, bodies_1.prettyJson)((0, redact_1.viewBody)(entry.responseBody, reveal)));
        if (entry.responseBodyTruncated) {
            lines.push(`[truncated — ${entry.responseBodyBytes} chars total]`);
        }
    }
    lines.push('', 'CURL', (0, curl_1.toCurl)(entry, opts));
    return lines.join('\n');
}
function toSessionText(entries, opts = {}) {
    const info = (0, collect_1.collectInfo)()
        .map((section) => `${section.title}\n${section.rows.map(([k, v]) => `  ${k}: ${v}`).join('\n')}`)
        .join('\n\n');
    const body = entries
        .slice()
        .reverse() // Oldest first reads chronologically in a report.
        .map((entry, i) => `${'='.repeat(70)}\n#${i + 1}\n${toEntryText(entry, opts)}`)
        .join('\n\n');
    return [
        `rn-netspect session · ${new Date().toISOString()}`,
        `${entries.length} request(s)`,
        '',
        info,
        '',
        body,
    ].join('\n');
}
//# sourceMappingURL=text.js.map