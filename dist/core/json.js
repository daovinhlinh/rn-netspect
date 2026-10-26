"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.copySummary = exports.EXPANSION_DEFAULTS = exports.childIndex = exports.childKey = exports.MAX_TREE_DEPTH = exports.ROOT = void 0;
exports.displayPath = displayPath;
exports.parsePath = parsePath;
exports.getAtPath = getAtPath;
exports.kindOf = kindOf;
exports.countChildren = countChildren;
exports.previewOf = previewOf;
exports.flattenJson = flattenJson;
exports.defaultExpanded = defaultExpanded;
exports.allContainerPaths = allContainerPaths;
exports.valueText = valueText;
exports.subtreeText = subtreeText;
const redact_1 = require("./redact");
/**
 * Root sentinel. Paths are '$'-rooted so a node whose own key is literally '$'
 * (giving '$.$') can never collide with the root itself.
 */
exports.ROOT = '$';
/** Containers deeper than this render as leaves rather than recursing forever. */
exports.MAX_TREE_DEPTH = 24;
const PREVIEW_MAX = 120;
const DEFAULT_MAX_ROWS = 5000;
/** Keys that can be written after a dot; anything else needs bracket + quote. */
const IDENT = /^[A-Za-z_$][A-Za-z0-9_$]*$/;
// ─── Paths ────────────────────────────────────────────────────────────────────
const childKey = (parentId, key) => IDENT.test(key) ? `${parentId}.${key}` : `${parentId}[${JSON.stringify(key)}]`;
exports.childKey = childKey;
const childIndex = (parentId, index) => `${parentId}[${index}]`;
exports.childIndex = childIndex;
/** '$.data.items[0]' -> 'data.items[0]'; '$["a-b"]' -> '["a-b"]'; '$' stays '$'. */
function displayPath(id) {
    if (id === exports.ROOT)
        return exports.ROOT;
    if (id.startsWith(`${exports.ROOT}.`))
        return id.slice(2);
    if (id.startsWith(exports.ROOT))
        return id.slice(1);
    return id;
}
/** Tokenises a '$'-rooted path. Returns null on anything it cannot fully consume. */
function parsePath(id) {
    if (!id.startsWith(exports.ROOT))
        return null;
    const segments = [];
    let at = 1;
    while (at < id.length) {
        const char = id[at];
        if (char === '.') {
            at += 1;
            const start = at;
            while (at < id.length && id[at] !== '.' && id[at] !== '[')
                at += 1;
            if (at === start)
                return null;
            segments.push({ kind: 'key', key: id.slice(start, at) });
            continue;
        }
        if (char === '[') {
            const close = id.indexOf(']', at);
            if (close < 0)
                return null;
            const inner = id.slice(at + 1, close);
            if (inner.startsWith('"')) {
                try {
                    segments.push({ kind: 'key', key: JSON.parse(inner) });
                }
                catch {
                    return null;
                }
            }
            else {
                const index = Number(inner);
                if (!Number.isInteger(index) || index < 0)
                    return null;
                segments.push({ kind: 'index', index });
            }
            at = close + 1;
            continue;
        }
        return null;
    }
    return segments;
}
/** Distinguishes "present and null" from "absent", which a bare value cannot express. */
function getAtPath(root, id) {
    const segments = parsePath(id);
    if (!segments)
        return { found: false, value: undefined };
    let current = root;
    for (const segment of segments) {
        if (current === null || typeof current !== 'object')
            return { found: false, value: undefined };
        if (segment.kind === 'index') {
            if (!Array.isArray(current) || segment.index >= current.length) {
                return { found: false, value: undefined };
            }
            current = current[segment.index];
        }
        else {
            const record = current;
            if (!Object.prototype.hasOwnProperty.call(record, segment.key)) {
                return { found: false, value: undefined };
            }
            current = record[segment.key];
        }
    }
    return { found: true, value: current };
}
// ─── Shape helpers ────────────────────────────────────────────────────────────
const isContainer = (value) => value !== null && typeof value === 'object';
function kindOf(value) {
    if (value === null)
        return 'null';
    if (Array.isArray(value))
        return 'array';
    switch (typeof value) {
        case 'object':
            return 'object';
        case 'number':
            return 'number';
        case 'boolean':
            return 'boolean';
        default:
            return 'string';
    }
}
function countChildren(value) {
    if (Array.isArray(value))
        return value.length;
    if (isContainer(value))
        return Object.keys(value).length;
    return 0;
}
function previewOf(value) {
    switch (kindOf(value)) {
        case 'object': {
            const n = Object.keys(value).length;
            return { text: n === 0 ? '{}' : `{…} ${n} ${n === 1 ? 'key' : 'keys'}`, truncated: false };
        }
        case 'array': {
            const n = value.length;
            return { text: n === 0 ? '[]' : `[…] ${n} ${n === 1 ? 'item' : 'items'}`, truncated: false };
        }
        case 'string': {
            // Newlines would break the fixed row height; the full value survives on row.value.
            const flat = value.replace(/[\n\r\t]+/g, ' ');
            const cut = flat.length > PREVIEW_MAX;
            return { text: `"${cut ? `${flat.slice(0, PREVIEW_MAX)}…` : flat}"`, truncated: cut };
        }
        default:
            return { text: String(value), truncated: false };
    }
}
/**
 * Depth-first walk producing only the rows whose ancestors are all expanded, so cost is
 * proportional to what is visible rather than to the whole document. Uses an explicit
 * stack: a 32 KB body can nest deeply enough to matter, and recursion would risk the
 * JS stack. Children are pushed in reverse so they pop in source order.
 */
function flattenJson(root, expanded, opts = {}) {
    const maxRows = opts.maxRows ?? DEFAULT_MAX_ROWS;
    const rows = [];
    const stack = [{ id: exports.ROOT, depth: 0, keyLabel: '', value: root }];
    while (stack.length > 0) {
        const frame = stack.pop();
        if (!frame)
            break;
        const kind = kindOf(frame.value);
        const container = kind === 'object' || kind === 'array';
        const childCount = countChildren(frame.value);
        const atDepthLimit = container && frame.depth >= exports.MAX_TREE_DEPTH;
        const { text, truncated } = previewOf(frame.value);
        rows.push({
            id: frame.id,
            path: displayPath(frame.id),
            depth: frame.depth,
            keyLabel: frame.keyLabel,
            value: frame.value,
            kind,
            expandable: container && childCount > 0 && !atDepthLimit,
            childCount,
            preview: text,
            previewTruncated: truncated,
            masked: typeof frame.value === 'string' && (0, redact_1.isMasked)(frame.value),
            atDepthLimit,
        });
        if (rows.length >= maxRows)
            break;
        if (!container || childCount === 0 || atDepthLimit)
            continue;
        if (!expanded.has(frame.id))
            continue;
        if (kind === 'array') {
            const arr = frame.value;
            for (let i = arr.length - 1; i >= 0; i--) {
                stack.push({
                    id: (0, exports.childIndex)(frame.id, i),
                    depth: frame.depth + 1,
                    keyLabel: `[${i}]`,
                    value: arr[i],
                });
            }
        }
        else {
            const obj = frame.value;
            const keys = Object.keys(obj);
            for (let i = keys.length - 1; i >= 0; i--) {
                const key = keys[i];
                if (key === undefined)
                    continue;
                stack.push({
                    id: (0, exports.childKey)(frame.id, key),
                    depth: frame.depth + 1,
                    keyLabel: key,
                    value: obj[key],
                });
            }
        }
    }
    return rows;
}
// ─── Default expansion ────────────────────────────────────────────────────────
exports.EXPANSION_DEFAULTS = { maxRows: 120, maxDepth: 4, maxChildren: 40 };
/**
 * Breadth-first with a node budget. BFS rather than DFS is what makes a
 * `{success, code, data:{…}}` envelope open all the way to the useful level instead of
 * spending the whole budget inside the first branch.
 */
function defaultExpanded(root, opts = {}) {
    const { maxRows, maxDepth, maxChildren } = { ...exports.EXPANSION_DEFAULTS, ...opts };
    const expanded = new Set();
    if (!isContainer(root))
        return expanded;
    let rows = 1; // the root row itself
    const queue = [
        { id: exports.ROOT, depth: 0, value: root },
    ];
    for (let head = 0; head < queue.length; head++) {
        const node = queue[head];
        if (!node)
            continue;
        if (!isContainer(node.value) || node.depth >= maxDepth)
            continue;
        const isArray = Array.isArray(node.value);
        const entries = isArray
            ? node.value.map((value, i) => [String(i), value])
            : Object.entries(node.value);
        if (entries.length === 0)
            continue;
        // Never auto-open a long list, and stop once the budget is spent. `continue` rather
        // than `break`: a later sibling that is small should still open.
        if (entries.length > maxChildren)
            continue;
        if (rows + entries.length > maxRows)
            continue;
        expanded.add(node.id);
        rows += entries.length;
        for (const [key, value] of entries) {
            queue.push({
                id: isArray ? (0, exports.childIndex)(node.id, Number(key)) : (0, exports.childKey)(node.id, key),
                depth: node.depth + 1,
                value,
            });
        }
    }
    return expanded;
}
/** Every container path, or null when the tree is larger than `limit`. */
function allContainerPaths(root, limit = 2000) {
    const out = new Set();
    const stack = [{ id: exports.ROOT, value: root }];
    while (stack.length > 0) {
        const node = stack.pop();
        if (!node)
            break;
        if (!isContainer(node.value) || countChildren(node.value) === 0)
            continue;
        out.add(node.id);
        if (out.size > limit)
            return null;
        if (Array.isArray(node.value)) {
            node.value.forEach((value, i) => stack.push({ id: (0, exports.childIndex)(node.id, i), value }));
        }
        else {
            for (const [key, value] of Object.entries(node.value)) {
                stack.push({ id: (0, exports.childKey)(node.id, key), value });
            }
        }
    }
    return out;
}
// ─── Copy text ────────────────────────────────────────────────────────────────
/**
 * "The thing itself" — a string comes back unquoted and in full, so it can be pasted
 * straight into a query or a grep. That unquoting is the whole point of having a
 * separate `value` action alongside `subtree`.
 */
function valueText(value) {
    if (typeof value === 'string')
        return value;
    try {
        return JSON.stringify(value) ?? String(value);
    }
    catch {
        return String(value);
    }
}
/** Valid, pretty JSON — pasteable into a file. */
function subtreeText(value) {
    try {
        return JSON.stringify(value, null, 2) ?? String(value);
    }
    catch {
        return String(value);
    }
}
/** Names what landed on the clipboard; "Copied 18 chars" alone is meaningless for a path. */
const copySummary = (path, text) => `Copied ${path} · ${text.length.toLocaleString()} chars`;
exports.copySummary = copySummary;
//# sourceMappingURL=json.js.map