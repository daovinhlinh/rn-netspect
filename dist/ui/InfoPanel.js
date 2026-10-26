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
exports.InfoPanel = InfoPanel;
const react_1 = __importStar(require("react"));
const react_native_1 = require("react-native");
const collect_1 = require("../info/collect");
const primitives_1 = require("./parts/primitives");
const theme_1 = require("./theme");
function InfoPanel() {
    // Collected once per mount: these values do not change while the panel is open,
    // and `getUniqueId`-style providers can be slow.
    const sections = (0, react_1.useMemo)(() => (0, collect_1.collectInfo)(), []);
    return (react_1.default.createElement(react_native_1.ScrollView, { contentContainerStyle: styles.body },
        sections.map((section) => (react_1.default.createElement(react_native_1.View, { key: section.title, style: styles.section },
            react_1.default.createElement(primitives_1.SectionTitle, null, section.title),
            react_1.default.createElement(primitives_1.KV, { rows: section.rows })))),
        react_1.default.createElement(react_native_1.Text, { style: styles.note }, "Values for keys that look like credentials are masked. Everything here comes from providers the host app supplies.")));
}
const styles = react_native_1.StyleSheet.create({
    body: { padding: theme_1.S.md, paddingBottom: theme_1.S.xl },
    section: { marginBottom: theme_1.S.xl },
    note: { color: theme_1.T.textDim, fontSize: 11, fontStyle: 'italic' },
});
//# sourceMappingURL=InfoPanel.js.map