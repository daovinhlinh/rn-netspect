"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.toCurl = toCurl;
const config_1 = require("../config");
const redact_1 = require("../core/redact");
/** POSIX single-quote escaping: close, escape, reopen. */
const q = (value) => `'${String(value).replace(/'/g, `'\\''`)}'`;
function toCurl(entry, opts = {}) {
    const reveal = opts.reveal ?? false;
    const parts = [`curl -i -X ${entry.method} ${q(entry.url)}`];
    for (const [name, value] of Object.entries(entry.requestHeaders)) {
        const lower = name.toLowerCase();
        // curl recomputes these; passing the captured values produces broken requests.
        if (lower === 'content-length' || lower === 'host')
            continue;
        const shown = reveal ? value : (0, redact_1.redactHeaderValue)(name, value);
        parts.push(`-H ${q(`${name}: ${shown}`)}`);
    }
    if (entry.requestBodyKind === 'formdata') {
        for (const part of entry.formParts ?? []) {
            parts.push(part.filename
                ? `-F ${q(`${part.name}=@${part.filename}`)}`
                : `-F ${q(`${part.name}=${part.value ?? ''}`)}`);
        }
    }
    else if (entry.requestBody && entry.requestBodyKind !== 'binary') {
        // --data-raw, not -d: `-d` strips newlines, and `@`-prefixed values would be
        // interpreted as a filename to read from.
        const body = (0, redact_1.viewBody)(entry.requestBody, reveal) ?? '';
        parts.push(`--data-raw ${q(body)}`);
    }
    const out = parts.join(' \\\n  ');
    const warnings = [];
    if (entry.requestBodyTruncated) {
        warnings.push(`# WARNING: request body truncated to ${(0, config_1.getConfig)().maxBodyBytes} chars`);
    }
    if (!reveal) {
        // The body can carry secrets too, so a masked command is non-runnable even when
        // no header matched the deny list.
        const maskedHeader = Object.keys(entry.requestHeaders).some((name) => (0, config_1.getConfig)().redactHeaders.includes(name.toLowerCase()));
        const maskedBody = (0, redact_1.viewBody)(entry.requestBody, false) !== entry.requestBody;
        if (maskedHeader || maskedBody) {
            warnings.push('# NOTE: secrets masked — enable "Reveal secrets" to copy a runnable command');
        }
    }
    return warnings.length ? `${warnings.join('\n')}\n${out}` : out;
}
//# sourceMappingURL=curl.js.map