"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.RequestList = RequestList;
const react_1 = __importStar(require("react"));
const react_native_1 = require("react-native");
const search_1 = require("../core/search");
const text_1 = require("../export/text");
const primitives_1 = require("./parts/primitives");
const theme_1 = require("./theme");
const FILTERS = [
    { key: 'all', label: 'All' },
    { key: 'errors', label: 'Errors' },
    { key: 'pending', label: 'In flight' },
];
const isError = (entry) => entry.outcome === 'error' ||
    entry.outcome === 'timeout' ||
    (entry.outcome === 'ok' && entry.status >= 400);
function shortPath(url) {
    // Strip scheme + host so the path (what you actually scan for) leads the row.
    const withoutScheme = url.replace(/^[a-z]+:\/\//i, '');
    const slash = withoutScheme.indexOf('/');
    return slash < 0 ? `/${withoutScheme}` : withoutScheme.slice(slash);
}
function Row({ entry, onPress, attempt, match, }) {
    const color = (0, theme_1.statusColor)(entry.status, entry.outcome);
    return (react_1.default.createElement(react_native_1.Pressable, { onPress: onPress, style: ({ pressed }) => [styles.row, pressed && styles.rowPressed] },
        react_1.default.createElement(react_native_1.View, { style: [styles.status, { borderColor: color }] },
            react_1.default.createElement(react_native_1.Text, { style: [styles.statusLabel, { color }], numberOfLines: 1 }, (0, text_1.statusLabel)(entry))),
        react_1.default.createElement(react_native_1.View, { style: styles.rowBody },
            react_1.default.createElement(react_native_1.View, { style: styles.rowTop },
                react_1.default.createElement(react_native_1.Text, { style: styles.method }, entry.method),
                react_1.default.createElement(react_native_1.Text, { style: styles.path, numberOfLines: 1, ellipsizeMode: "head" }, shortPath(entry.url))),
            react_1.default.createElement(react_native_1.Text, { style: styles.meta, numberOfLines: 1 },
                entry.outcome === 'pending' ? 'in flight' : `${entry.durationMs}ms`,
                entry.responseBodyBytes > 0 ? ` · ${formatBytes(entry.responseBodyBytes)}` : '',
                attempt ? ` · ${attempt}` : '',
                entry.bodyEvicted ? ' · body evicted' : '',
                match && match !== 'url' ? react_1.default.createElement(react_native_1.Text, { style: styles.match },
                    " \u00B7 matched ",
                    match) : null))));
}
function formatBytes(n) {
    if (n < 1024)
        return `${n}B`;
    if (n < 1024 * 1024)
        return `${(n / 1024).toFixed(1)}KB`;
    return `${(n / 1024 / 1024).toFixed(1)}MB`;
}
function RequestList({ entries, onSelect, }) {
    const [query, setQuery] = (0, react_1.useState)('');
    const [filter, setFilter] = (0, react_1.useState)('all');
    /** Counts attempts per correlation group so retries can be badged in the row. */
    const attempts = (0, react_1.useMemo)(() => {
        const groups = new Map();
        // Oldest first, so attempt 1 really is the first attempt.
        for (let i = entries.length - 1; i >= 0; i--) {
            const entry = entries[i];
            if (!entry?.correlationId)
                continue;
            const ids = groups.get(entry.correlationId) ?? [];
            ids.push(entry.id);
            groups.set(entry.correlationId, ids);
        }
        const labels = new Map();
        for (const ids of groups.values()) {
            if (ids.length < 2)
                continue;
            ids.forEach((id, i) => labels.set(id, `attempt ${i + 1}/${ids.length}`));
        }
        return labels;
    }, [entries]);
    const visible = (0, react_1.useMemo)(() => {
        const needle = query.trim().toLowerCase();
        const out = [];
        for (const entry of entries) {
            if (filter === 'errors' && !isError(entry))
                continue;
            if (filter === 'pending' && entry.outcome !== 'pending')
                continue;
            const match = (0, search_1.matchEntry)(entry, needle);
            if (match === 'none')
                continue;
            out.push({ entry, match });
        }
        return out;
    }, [entries, query, filter]);
    return (react_1.default.createElement(react_native_1.View, { style: styles.container },
        react_1.default.createElement(react_native_1.View, { style: styles.controls },
            react_1.default.createElement(primitives_1.SearchInput, { value: query, onChangeText: setQuery, placeholder: "Filter by URL, params, status, body\u2026" }),
            react_1.default.createElement(react_native_1.View, { style: styles.chips },
                FILTERS.map(({ key, label }) => (react_1.default.createElement(primitives_1.Chip, { key: key, label: label, active: filter === key, onPress: () => setFilter(key) }))),
                react_1.default.createElement(react_native_1.Text, { style: styles.count },
                    visible.length,
                    "/",
                    entries.length))),
        react_1.default.createElement(react_native_1.FlatList, { data: visible, keyExtractor: (item) => item.entry.id, renderItem: ({ item }) => (react_1.default.createElement(Row, { entry: item.entry, match: item.match, attempt: attempts.get(item.entry.id), onPress: () => onSelect(item.entry.id) })), ItemSeparatorComponent: () => react_1.default.createElement(react_native_1.View, { style: styles.separator }), ListEmptyComponent: react_1.default.createElement(react_native_1.Text, { style: styles.empty }, entries.length === 0
                ? 'No requests captured yet. Use the app and they will appear here.'
                : 'Nothing matches this filter.'), contentContainerStyle: visible.length === 0 ? styles.emptyContainer : undefined, keyboardShouldPersistTaps: "handled", initialNumToRender: 14, windowSize: 7 })));
}
const styles = react_native_1.StyleSheet.create({
    container: { flex: 1 },
    controls: { paddingHorizontal: theme_1.S.md, paddingBottom: theme_1.S.sm, gap: theme_1.S.sm },
    chips: { flexDirection: 'row', alignItems: 'center', gap: theme_1.S.sm },
    count: { marginLeft: 'auto', color: theme_1.T.textDim, fontSize: 11 },
    row: { flexDirection: 'row', paddingHorizontal: theme_1.S.md, paddingVertical: theme_1.S.sm, gap: theme_1.S.md },
    rowPressed: { backgroundColor: theme_1.T.surfaceAlt },
    status: {
        width: 46,
        borderWidth: 1,
        borderRadius: 6,
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 3,
    },
    statusLabel: { fontSize: 12, fontWeight: '700' },
    rowBody: { flex: 1, gap: 2 },
    rowTop: { flexDirection: 'row', alignItems: 'center', gap: theme_1.S.sm },
    method: { color: theme_1.T.accent, fontSize: 11, fontWeight: '800' },
    path: { color: theme_1.T.text, fontSize: 13, flex: 1 },
    meta: { color: theme_1.T.textDim, fontSize: 11 },
    match: { color: theme_1.T.accent },
    separator: { height: react_native_1.StyleSheet.hairlineWidth, backgroundColor: theme_1.T.border, marginLeft: theme_1.S.md + 46 },
    empty: { color: theme_1.T.textDim, fontSize: 13, textAlign: 'center', paddingHorizontal: theme_1.S.xl },
    emptyContainer: { flexGrow: 1, justifyContent: 'center' },
});
//# sourceMappingURL=RequestList.js.map