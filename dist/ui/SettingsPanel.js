"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SettingsPanel = SettingsPanel;
const react_1 = __importDefault(require("react"));
const react_native_1 = require("react-native");
const config_1 = require("../config");
const netspect_1 = require("../core/netspect");
const session_1 = require("../export/session");
const primitives_1 = require("./parts/primitives");
const theme_1 = require("./theme");
function SettingsPanel({ reveal, onRevealChange, capturing, onCapturingChange, onToast, }) {
    const config = (0, config_1.getConfig)();
    const stats = netspect_1.Netspect.stats();
    const run = async (format) => {
        const result = await (0, session_1.exportSession)(format, { reveal });
        onToast(result.message);
    };
    return (react_1.default.createElement(react_native_1.ScrollView, { contentContainerStyle: styles.body },
        react_1.default.createElement(primitives_1.SectionTitle, null, "Capture"),
        react_1.default.createElement(Toggle, { label: "Capturing", hint: "Pauses recording without removing the interceptor.", value: capturing, onChange: (next) => {
                if (next)
                    netspect_1.Netspect.resume();
                else
                    netspect_1.Netspect.pause();
                onCapturingChange(next);
            } }),
        react_1.default.createElement(Toggle, { label: "Capture bodies", hint: "Turn off on screens that stream large payloads.", value: config.captureBodies, onChange: (next) => {
                (0, config_1.setConfig)({ captureBodies: next });
                onToast(next ? 'Bodies on' : 'Bodies off');
            } }),
        react_1.default.createElement(Toggle, { label: "Reveal secrets", hint: "Unmasks tokens so copied cURL commands actually run. In-memory only \u2014 resets when the app restarts.", value: reveal, onChange: onRevealChange }),
        react_1.default.createElement(react_native_1.View, { style: styles.gap }),
        react_1.default.createElement(primitives_1.SectionTitle, null, "Session"),
        react_1.default.createElement(primitives_1.KV, { rows: [
                ['entries', `${stats.count} / ${config.maxEntries}`],
                ['retained bodies', `${(stats.bodyBytes / 1024).toFixed(1)} KB / ${(config.maxTotalBodyBytes / 1024 / 1024).toFixed(0)} MB`],
                ['per-body cap', `${(config.maxBodyBytes / 1024).toFixed(0)} KB`],
            ] }),
        react_1.default.createElement(react_native_1.View, { style: styles.actions },
            react_1.default.createElement(primitives_1.Btn, { label: "Export report", onPress: () => run('text'), tone: "accent" }),
            react_1.default.createElement(primitives_1.Btn, { label: "Export HAR", onPress: () => run('har'), tone: "accent" }),
            react_1.default.createElement(primitives_1.Btn, { label: "Clear", tone: "danger", onPress: () => {
                    netspect_1.Netspect.clear();
                    onToast('Cleared');
                } })),
        react_1.default.createElement(react_native_1.View, { style: styles.gap }),
        react_1.default.createElement(primitives_1.SectionTitle, null, "Not captured"),
        react_1.default.createElement(react_native_1.Text, { style: styles.note },
            "Requests made by native code never reach JavaScript, so they cannot appear here: file downloads via blob-util or similar, WebSocket frames, map tiles, push messaging, and native image loading. Use ",
            'Netspect.record()',
            " from the host app to log those manually.")));
}
function Toggle({ label, hint, value, onChange, }) {
    return (react_1.default.createElement(react_native_1.View, { style: styles.toggle },
        react_1.default.createElement(react_native_1.View, { style: styles.toggleText },
            react_1.default.createElement(react_native_1.Text, { style: styles.toggleLabel }, label),
            react_1.default.createElement(react_native_1.Text, { style: styles.toggleHint }, hint)),
        react_1.default.createElement(react_native_1.Switch, { value: value, onValueChange: onChange, trackColor: { false: theme_1.T.border, true: theme_1.T.accent }, thumbColor: theme_1.T.text })));
}
const styles = react_native_1.StyleSheet.create({
    body: { padding: theme_1.S.md, paddingBottom: theme_1.S.xl },
    gap: { height: theme_1.S.xl },
    toggle: { flexDirection: 'row', alignItems: 'center', gap: theme_1.S.md, paddingVertical: theme_1.S.sm },
    toggleText: { flex: 1, gap: 2 },
    toggleLabel: { color: theme_1.T.text, fontSize: 14, fontWeight: '600' },
    toggleHint: { color: theme_1.T.textDim, fontSize: 11, lineHeight: 15 },
    actions: { flexDirection: 'row', gap: theme_1.S.sm, marginTop: theme_1.S.lg, flexWrap: 'wrap' },
    note: { color: theme_1.T.textDim, fontSize: 11, lineHeight: 16 },
});
//# sourceMappingURL=SettingsPanel.js.map