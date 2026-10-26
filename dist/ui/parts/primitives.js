"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Btn = Btn;
exports.Chip = Chip;
exports.Segmented = Segmented;
exports.KV = KV;
exports.CodeBlock = CodeBlock;
exports.SearchInput = SearchInput;
exports.SectionTitle = SectionTitle;
exports.Collapsible = Collapsible;
const react_1 = __importDefault(require("react"));
const react_native_1 = require("react-native");
const theme_1 = require("../theme");
const mono = react_native_1.Platform.OS === 'ios' ? theme_1.FONT.mono : theme_1.FONT.monoAndroid;
function Btn({ label, onPress, tone = 'default', disabled, }) {
    const color = tone === 'accent' ? theme_1.T.accent : tone === 'danger' ? theme_1.T.error : theme_1.T.text;
    return (react_1.default.createElement(react_native_1.Pressable, { onPress: onPress, disabled: disabled, style: ({ pressed }) => [
            styles.btn,
            { borderColor: color, opacity: disabled ? 0.4 : pressed ? 0.6 : 1 },
        ], hitSlop: 6 },
        react_1.default.createElement(react_native_1.Text, { style: [styles.btnLabel, { color }] }, label)));
}
function Chip({ label, active, onPress, }) {
    return (react_1.default.createElement(react_native_1.Pressable, { onPress: onPress, style: [styles.chip, active && { backgroundColor: theme_1.T.accent, borderColor: theme_1.T.accent }], hitSlop: 4 },
        react_1.default.createElement(react_native_1.Text, { style: [styles.chipLabel, active && { color: theme_1.T.bg, fontWeight: '700' }] }, label)));
}
function Segmented({ tabs, value, onChange, }) {
    return (react_1.default.createElement(react_native_1.View, { style: styles.segmented }, tabs.map((tab) => (react_1.default.createElement(react_native_1.Pressable, { key: tab, onPress: () => onChange(tab), style: [styles.segment, tab === value && styles.segmentActive] },
        react_1.default.createElement(react_native_1.Text, { style: [styles.segmentLabel, tab === value && { color: theme_1.T.text }], numberOfLines: 1 }, tab))))));
}
function KV({ rows, empty = '(none)' }) {
    if (rows.length === 0)
        return react_1.default.createElement(react_native_1.Text, { style: styles.dim }, empty);
    return (react_1.default.createElement(react_native_1.View, null, rows.map(([key, value], i) => (react_1.default.createElement(react_native_1.View, { key: `${key}-${i}`, style: styles.kvRow },
        react_1.default.createElement(react_native_1.Text, { style: styles.kvKey, selectable: true }, key),
        react_1.default.createElement(react_native_1.Text, { style: styles.kvValue, selectable: true }, value))))));
}
/**
 * Horizontal scroll is deliberate: long URLs and minified JSON must not be
 * soft-wrapped into an unreadable block, and the page itself must never scroll sideways.
 */
function CodeBlock({ text }) {
    if (!text)
        return react_1.default.createElement(react_native_1.Text, { style: styles.dim }, "(empty)");
    return (react_1.default.createElement(react_native_1.ScrollView, { horizontal: true, style: styles.code, contentContainerStyle: styles.codeInner },
        react_1.default.createElement(react_native_1.Text, { style: styles.codeText, selectable: true }, text)));
}
function SearchInput({ value, onChangeText, placeholder, }) {
    return (react_1.default.createElement(react_native_1.TextInput, { value: value, onChangeText: onChangeText, placeholder: placeholder, placeholderTextColor: theme_1.T.textDim, autoCapitalize: "none", autoCorrect: false, style: styles.search }));
}
function SectionTitle({ children }) {
    return react_1.default.createElement(react_native_1.Text, { style: styles.sectionTitle }, children);
}
/** A section whose body can be tucked away, with the item count kept visible when closed. */
function Collapsible({ title, count, open, onToggle, children, }) {
    return (react_1.default.createElement(react_native_1.View, null,
        react_1.default.createElement(react_native_1.Pressable, { onPress: onToggle, style: ({ pressed }) => [styles.collapsibleHead, pressed && { opacity: 0.6 }], hitSlop: 6, accessibilityRole: "button", accessibilityState: { expanded: open } },
            react_1.default.createElement(react_native_1.Text, { style: styles.twisty }, open ? '▾' : '▸'),
            react_1.default.createElement(react_native_1.Text, { style: [styles.sectionTitle, styles.sectionTitleInline] }, title),
            react_1.default.createElement(react_native_1.Text, { style: styles.collapsibleCount }, count)),
        open ? children : null));
}
const styles = react_native_1.StyleSheet.create({
    btn: {
        borderWidth: 1,
        borderRadius: 8,
        paddingHorizontal: theme_1.S.md,
        paddingVertical: theme_1.S.sm,
    },
    btnLabel: { fontSize: 13, fontWeight: '600' },
    chip: {
        borderWidth: 1,
        borderColor: theme_1.T.border,
        borderRadius: 999,
        paddingHorizontal: theme_1.S.md,
        paddingVertical: theme_1.S.xs + 1,
    },
    chipLabel: { color: theme_1.T.textDim, fontSize: 12 },
    segmented: {
        flexDirection: 'row',
        backgroundColor: theme_1.T.surfaceAlt,
        borderRadius: 8,
        padding: 2,
        gap: 2,
    },
    segment: { flex: 1, paddingVertical: theme_1.S.sm, borderRadius: 6, alignItems: 'center' },
    segmentActive: { backgroundColor: theme_1.T.surface },
    segmentLabel: { color: theme_1.T.textDim, fontSize: 12, fontWeight: '600' },
    kvRow: { flexDirection: 'row', paddingVertical: 3, gap: theme_1.S.sm },
    kvKey: { color: theme_1.T.textDim, fontSize: 12, flex: 4, fontFamily: mono },
    kvValue: { color: theme_1.T.text, fontSize: 12, flex: 6, fontFamily: mono },
    code: {
        backgroundColor: theme_1.T.bg,
        borderRadius: 6,
        borderWidth: 1,
        borderColor: theme_1.T.border,
        maxHeight: 320,
    },
    codeInner: { padding: theme_1.S.sm },
    codeText: { color: theme_1.T.text, fontSize: 11, fontFamily: mono, lineHeight: 16 },
    search: {
        backgroundColor: theme_1.T.surfaceAlt,
        borderRadius: 8,
        paddingHorizontal: theme_1.S.md,
        paddingVertical: theme_1.S.sm,
        color: theme_1.T.text,
        fontSize: 13,
    },
    sectionTitle: {
        color: theme_1.T.textDim,
        fontSize: 11,
        fontWeight: '700',
        letterSpacing: 0.8,
        textTransform: 'uppercase',
        marginBottom: theme_1.S.xs,
    },
    // The twisty row supplies its own vertical padding, so drop the standalone margin.
    sectionTitleInline: { marginBottom: 0 },
    collapsibleHead: { flexDirection: 'row', alignItems: 'center', gap: theme_1.S.sm, paddingVertical: theme_1.S.sm },
    twisty: { color: theme_1.T.textDim, fontSize: 11, width: 12 },
    collapsibleCount: { marginLeft: 'auto', color: theme_1.T.textDim, fontSize: 11, fontFamily: mono },
    dim: { color: theme_1.T.textDim, fontSize: 12, fontStyle: 'italic' },
});
//# sourceMappingURL=primitives.js.map