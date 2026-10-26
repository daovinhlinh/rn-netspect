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
exports.JsonTree = JsonTree;
const react_1 = __importStar(require("react"));
const react_native_1 = require("react-native");
const json_1 = require("../core/json");
const session_1 = require("../export/session");
const primitives_1 = require("./parts/primitives");
const theme_1 = require("./theme");
const INDENT = 10;
/** Past this, further indenting just pushes content off-screen. */
const MAX_INDENT_DEPTH = 10;
const EXPAND_ALL_LIMIT = 2000;
const mono = react_native_1.Platform.OS === 'ios' ? theme_1.FONT.mono : theme_1.FONT.monoAndroid;
function valueStyle(row) {
    if (row.masked)
        return styles.masked;
    switch (row.kind) {
        case 'string':
            return styles.vString;
        case 'number':
            return styles.vNumber;
        case 'boolean':
            return styles.vBool;
        case 'null':
            return styles.vNull;
        default:
            return styles.vContainer;
    }
}
/** Containers copy as a subtree; leaves copy as the bare value. */
const rowCopyText = (row) => row.kind === 'object' || row.kind === 'array' ? (0, json_1.subtreeText)(row.value) : (0, json_1.valueText)(row.value);
const Row = react_1.default.memo(function Row({ row, expanded, selected, onPress, onLongPress, onCopy, }) {
    const indent = theme_1.S.sm + Math.min(row.depth, MAX_INDENT_DEPTH) * INDENT;
    return (react_1.default.createElement(react_native_1.View, { style: [styles.row, selected && styles.rowSelected] },
        react_1.default.createElement(react_native_1.Pressable, { onPress: () => onPress(row), onLongPress: () => onLongPress(row), delayLongPress: 300, style: ({ pressed }) => [styles.rowMain, { paddingLeft: indent }, pressed && styles.pressed], accessibilityRole: "button", accessibilityState: { expanded: row.expandable ? expanded : undefined, selected }, accessibilityLabel: `${row.path} ${row.preview}` },
            react_1.default.createElement(react_native_1.Text, { style: styles.twisty }, row.expandable ? (expanded ? '▾' : '▸') : ' '),
            row.keyLabel ? (react_1.default.createElement(react_native_1.Text, { style: styles.key, numberOfLines: 1 }, row.keyLabel)) : null,
            row.keyLabel ? react_1.default.createElement(react_native_1.Text, { style: styles.colon }, ": ") : null,
            react_1.default.createElement(react_native_1.Text, { style: [styles.value, valueStyle(row)], numberOfLines: 1, ellipsizeMode: "tail" }, row.preview),
            row.atDepthLimit ? react_1.default.createElement(react_native_1.Text, { style: styles.flag }, " depth limit") : null),
        react_1.default.createElement(react_native_1.Pressable, { onPress: () => onCopy(row), hitSlop: 8, style: ({ pressed }) => [styles.copyBtn, pressed && styles.pressed], accessibilityRole: "button", accessibilityLabel: `Copy ${row.path}` },
            react_1.default.createElement(react_native_1.Text, { style: styles.copyGlyph }, "\u29C9"))));
});
function JsonTree({ root, truncated, listHeader, onToast, onCopyWhole, }) {
    const [expanded, setExpanded] = (0, react_1.useState)(() => (0, json_1.defaultExpanded)(root));
    const [selectedId, setSelectedId] = (0, react_1.useState)(null);
    const rows = (0, react_1.useMemo)(() => (0, json_1.flattenJson)(root, expanded), [root, expanded]);
    // Re-resolved from the visible rows, so collapsing a selected node's parent dismisses
    // the action bar on its own rather than leaving it pointing at something off-screen.
    const selected = (0, react_1.useMemo)(() => rows.find((row) => row.id === selectedId) ?? null, [rows, selectedId]);
    const copy = (0, react_1.useCallback)(async (text, path) => {
        const result = await (0, session_1.copyToClipboard)(text, (0, json_1.copySummary)(path, text));
        onToast(result.message);
    }, [onToast]);
    const onPressRow = (0, react_1.useCallback)((row) => {
        if (!row.expandable) {
            setSelectedId(row.id);
            return;
        }
        setExpanded((prev) => {
            const next = new Set(prev);
            if (!next.delete(row.id))
                next.add(row.id);
            return next;
        });
    }, []);
    // Long-press selects a container without toggling it — RN suppresses onPress when a
    // long press fires, so the two never both run.
    const onLongPressRow = (0, react_1.useCallback)((row) => setSelectedId(row.id), []);
    const onCopyRow = (0, react_1.useCallback)((row) => copy(rowCopyText(row), row.path), [copy]);
    const expandAll = (0, react_1.useCallback)(() => {
        const all = (0, json_1.allContainerPaths)(root, EXPAND_ALL_LIMIT);
        if (!all) {
            onToast('Too large to expand all');
            return;
        }
        setExpanded(all);
    }, [root, onToast]);
    return (react_1.default.createElement(react_native_1.View, { style: styles.wrap },
        react_1.default.createElement(react_native_1.FlatList, { data: rows, extraData: selectedId, keyExtractor: (row) => row.id, ListHeaderComponent: 
            // Padded here rather than on the list, so tree rows can still indent from the
            // very edge while the header block lines up with the other tabs.
            react_1.default.createElement(react_native_1.View, { style: styles.headerPad },
                listHeader,
                truncated ? (react_1.default.createElement(react_native_1.Text, { style: styles.warn }, "Truncated \u2014 the tail of this body is missing.")) : null,
                react_1.default.createElement(react_native_1.View, { style: styles.tools },
                    react_1.default.createElement(primitives_1.Btn, { label: "Collapse all", onPress: () => setExpanded(new Set()) }),
                    react_1.default.createElement(primitives_1.Btn, { label: "Expand all", onPress: expandAll }),
                    react_1.default.createElement(primitives_1.Btn, { label: "Copy all", onPress: onCopyWhole, tone: "accent" }))), renderItem: ({ item }) => (react_1.default.createElement(Row, { row: item, expanded: expanded.has(item.id), selected: item.id === selectedId, onPress: onPressRow, onLongPress: onLongPressRow, onCopy: onCopyRow })), keyboardShouldPersistTaps: "handled", initialNumToRender: 30, maxToRenderPerBatch: 20, updateCellsBatchingPeriod: 50, windowSize: 10 }),
        selected ? (react_1.default.createElement(react_native_1.View, { style: styles.actionBar },
            react_1.default.createElement(react_native_1.Text, { style: styles.actionPath, numberOfLines: 1, ellipsizeMode: "head" }, selected.path),
            react_1.default.createElement(react_native_1.View, { style: styles.actionBtns },
                react_1.default.createElement(primitives_1.Btn, { label: "Value", tone: "accent", onPress: () => copy((0, json_1.valueText)(selected.value), selected.path) }),
                react_1.default.createElement(primitives_1.Btn, { label: "Subtree", tone: "accent", onPress: () => copy((0, json_1.subtreeText)(selected.value), selected.path) }),
                react_1.default.createElement(primitives_1.Btn, { label: "Path", onPress: () => copy(selected.path, selected.path) }),
                react_1.default.createElement(primitives_1.Btn, { label: "\u2715", onPress: () => setSelectedId(null) })))) : (react_1.default.createElement(react_native_1.Text, { style: styles.hint }, "Tap \u29C9 to copy a node \u00B7 tap to expand \u00B7 long-press to select"))));
}
const styles = react_native_1.StyleSheet.create({
    wrap: { flex: 1 },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        // Every row reserves the accent bar so selecting one never shifts its text sideways.
        borderLeftWidth: 3,
        borderLeftColor: 'transparent',
    },
    rowSelected: { backgroundColor: theme_1.T.selected, borderLeftColor: theme_1.T.accent },
    // Weaker than the selected state, so "touching" and "selected" never look alike.
    pressed: { backgroundColor: theme_1.T.surfaceAlt },
    rowMain: { flex: 1, flexDirection: 'row', alignItems: 'center', paddingVertical: 3 },
    twisty: { color: theme_1.T.textDim, fontSize: 10, width: 12 },
    key: { color: theme_1.T.jsonKey, fontSize: 11, fontFamily: mono, flexShrink: 1 },
    colon: { color: theme_1.T.textDim, fontSize: 11, fontFamily: mono },
    value: { fontSize: 11, fontFamily: mono, flexShrink: 1 },
    vString: { color: theme_1.T.jsonString },
    vNumber: { color: theme_1.T.jsonNumber },
    vBool: { color: theme_1.T.jsonBool },
    vNull: { color: theme_1.T.jsonNull, fontStyle: 'italic' },
    vContainer: { color: theme_1.T.textDim },
    masked: { color: theme_1.T.warn, fontStyle: 'italic' },
    flag: { color: theme_1.T.warn, fontSize: 10 },
    copyBtn: { paddingHorizontal: theme_1.S.sm, paddingVertical: 3 },
    copyGlyph: { color: theme_1.T.textDim, fontSize: 13 },
    headerPad: { paddingHorizontal: theme_1.S.md },
    tools: { flexDirection: 'row', gap: theme_1.S.sm, paddingVertical: theme_1.S.sm, flexWrap: 'wrap' },
    warn: { color: theme_1.T.warn, fontSize: 11, paddingTop: theme_1.S.xs },
    actionBar: {
        borderTopWidth: 1,
        borderTopColor: theme_1.T.border,
        backgroundColor: theme_1.T.surfaceAlt,
        paddingHorizontal: theme_1.S.md,
        paddingVertical: theme_1.S.sm,
        gap: theme_1.S.sm,
    },
    actionPath: { color: theme_1.T.text, fontSize: 11, fontFamily: mono },
    actionBtns: { flexDirection: 'row', gap: theme_1.S.sm, flexWrap: 'wrap' },
    hint: {
        color: theme_1.T.textDim,
        fontSize: 10,
        textAlign: 'center',
        paddingVertical: theme_1.S.sm,
        borderTopWidth: 1,
        borderTopColor: theme_1.T.border,
    },
});
//# sourceMappingURL=JsonTree.js.map