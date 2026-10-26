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
exports.NetspectOverlay = NetspectOverlay;
const react_1 = __importStar(require("react"));
const react_native_1 = require("react-native");
const config_1 = require("../config");
const xhrPatch_1 = require("../core/xhrPatch");
const FloatingBubble_1 = require("./FloatingBubble");
const InfoPanel_1 = require("./InfoPanel");
const primitives_1 = require("./parts/primitives");
const RequestDetail_1 = require("./RequestDetail");
const RequestList_1 = require("./RequestList");
const SettingsPanel_1 = require("./SettingsPanel");
const theme_1 = require("./theme");
const useNetspect_1 = require("./useNetspect");
const TABS = ['Network', 'Info', 'Settings'];
/**
 * The single component a host app renders. Mount it last in the tree so it paints above
 * the navigator; it renders nothing at all when `enabled` is false.
 */
function NetspectOverlay() {
    const [open, setOpen] = (0, react_1.useState)(false);
    const [tab, setTab] = (0, react_1.useState)('Network');
    const [selected, setSelected] = (0, react_1.useState)(null);
    const [reveal, setReveal] = (0, react_1.useState)(false);
    const [capturing, setCapturing] = (0, react_1.useState)(xhrPatch_1.isCapturing);
    const [toast, setToast] = (0, react_1.useState)(null);
    const entries = (0, useNetspect_1.useEntries)();
    const entry = (0, useNetspect_1.useEntry)(selected);
    const toastTimer = (0, react_1.useRef)(null);
    const showToast = (0, react_1.useCallback)((message) => {
        setToast(message);
        if (toastTimer.current)
            clearTimeout(toastTimer.current);
        toastTimer.current = setTimeout(() => setToast(null), 2200);
    }, []);
    (0, react_1.useEffect)(() => () => {
        if (toastTimer.current)
            clearTimeout(toastTimer.current);
    }, []);
    // `enabled` is read at render so a host can flip it before first mount; it is not
    // expected to change at runtime.
    if (!(0, config_1.getConfig)().enabled)
        return null;
    return (react_1.default.createElement(react_1.default.Fragment, null,
        react_1.default.createElement(FloatingBubble_1.FloatingBubble, { count: entries.length, onPress: () => setOpen(true) }),
        react_1.default.createElement(react_native_1.Modal, { visible: open, animationType: "slide", transparent: true, onRequestClose: () => setOpen(false), statusBarTranslucent: true, 
            // Lets the sheet grow to full height on iOS instead of being letterboxed.
            presentationStyle: "overFullScreen" },
            react_1.default.createElement(react_native_1.View, { style: styles.backdrop },
                react_1.default.createElement(react_native_1.Pressable, { style: styles.dismissArea, onPress: () => setOpen(false) }),
                react_1.default.createElement(react_native_1.View, { style: styles.sheet },
                    react_1.default.createElement(react_native_1.View, { style: styles.grabber }),
                    react_1.default.createElement(react_native_1.View, { style: styles.topBar },
                        react_1.default.createElement(react_native_1.Text, { style: styles.title }, "netspect"),
                        !capturing && react_1.default.createElement(react_native_1.Text, { style: styles.paused }, "paused"),
                        react_1.default.createElement(react_native_1.View, { style: styles.topBarRight },
                            react_1.default.createElement(primitives_1.Btn, { label: "Close", onPress: () => setOpen(false) }))),
                    selected && entry ? (react_1.default.createElement(RequestDetail_1.RequestDetail, { entry: entry, reveal: reveal, onBack: () => setSelected(null), onToast: showToast })) : (react_1.default.createElement(react_1.default.Fragment, null,
                        react_1.default.createElement(react_native_1.View, { style: styles.tabs },
                            react_1.default.createElement(primitives_1.Segmented, { tabs: TABS, value: tab, onChange: (next) => {
                                    setTab(next);
                                    setSelected(null);
                                } })),
                        tab === 'Network' && react_1.default.createElement(RequestList_1.RequestList, { entries: entries, onSelect: setSelected }),
                        tab === 'Info' && react_1.default.createElement(InfoPanel_1.InfoPanel, null),
                        tab === 'Settings' && (react_1.default.createElement(SettingsPanel_1.SettingsPanel, { reveal: reveal, onRevealChange: setReveal, capturing: capturing, onCapturingChange: setCapturing, onToast: showToast })))),
                    toast && (react_1.default.createElement(react_native_1.View, { style: styles.toast, pointerEvents: "none" },
                        react_1.default.createElement(react_native_1.Text, { style: styles.toastLabel }, toast))))))));
}
const styles = react_native_1.StyleSheet.create({
    backdrop: { flex: 1, backgroundColor: theme_1.T.overlay, justifyContent: 'flex-end' },
    // A tap above the sheet dismisses it, matching the bottom-sheet idiom.
    dismissArea: { height: 56 },
    sheet: {
        flex: 1,
        backgroundColor: theme_1.T.surface,
        borderTopLeftRadius: 16,
        borderTopRightRadius: 16,
        borderTopWidth: 1,
        borderColor: theme_1.T.border,
        overflow: 'hidden',
        // Leaves the home indicator / nav bar reachable without a safe-area dependency.
        paddingBottom: react_native_1.Platform.OS === 'ios' ? 24 : 8,
    },
    grabber: {
        alignSelf: 'center',
        width: 36,
        height: 4,
        borderRadius: 2,
        backgroundColor: theme_1.T.border,
        marginTop: theme_1.S.sm,
        marginBottom: theme_1.S.xs,
    },
    topBar: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme_1.S.sm,
        paddingHorizontal: theme_1.S.md,
        paddingVertical: theme_1.S.sm,
    },
    title: { color: theme_1.T.text, fontSize: 15, fontWeight: '800', letterSpacing: 0.5 },
    paused: { color: theme_1.T.warn, fontSize: 11, fontWeight: '700' },
    topBarRight: { marginLeft: 'auto' },
    tabs: { paddingHorizontal: theme_1.S.md, paddingBottom: theme_1.S.md },
    toast: {
        position: 'absolute',
        left: theme_1.S.lg,
        right: theme_1.S.lg,
        bottom: theme_1.S.xl,
        backgroundColor: theme_1.T.bg,
        borderWidth: 1,
        borderColor: theme_1.T.accent,
        borderRadius: 8,
        paddingHorizontal: theme_1.S.md,
        paddingVertical: theme_1.S.sm,
    },
    toastLabel: { color: theme_1.T.text, fontSize: 12, textAlign: 'center' },
});
//# sourceMappingURL=NetspectOverlay.js.map