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
exports.RequestDetail = RequestDetail;
const react_1 = __importStar(require("react"));
const react_native_1 = require("react-native");
const bodies_1 = require("../core/bodies");
const bodyView_1 = require("../core/bodyView");
const redact_1 = require("../core/redact");
const curl_1 = require("../export/curl");
const session_1 = require("../export/session");
const text_1 = require("../export/text");
const JsonTree_1 = require("./JsonTree");
const primitives_1 = require("./parts/primitives");
const theme_1 = require("./theme");
const TABS = ['Summary', 'Request', 'Response', 'cURL'];
const VIEWS = ['Tree', 'Raw'];
/**
 * Header sections remember their state for the session, the way `FloatingBubble` keeps
 * its position. Defaults differ per tab: response headers are mostly noise, while request
 * headers (auth, device, version) are more often what you opened the entry to check.
 */
const headersOpen = { request: true, response: false };
function RequestDetail({ entry, reveal, onBack, onToast, }) {
    const [tab, setTab] = (0, react_1.useState)('Summary');
    const color = (0, theme_1.statusColor)(entry.status, entry.outcome);
    const run = async (format) => {
        const result = await (0, session_1.exportEntry)(entry, format, { reveal });
        onToast(result.message);
    };
    const copyBody = async (which) => {
        const result = await (0, session_1.exportBody)(entry, which, { reveal });
        onToast(result.message);
    };
    return (react_1.default.createElement(react_native_1.View, { style: styles.container },
        react_1.default.createElement(react_native_1.View, { style: styles.header },
            react_1.default.createElement(primitives_1.Btn, { label: "\u2039 Back", onPress: onBack }),
            react_1.default.createElement(react_native_1.View, { style: [styles.statusPill, { borderColor: color }] },
                react_1.default.createElement(react_native_1.Text, { style: [styles.statusText, { color }] }, (0, text_1.statusLabel)(entry))),
            react_1.default.createElement(react_native_1.Text, { style: styles.duration },
                entry.durationMs,
                "ms")),
        react_1.default.createElement(react_native_1.Text, { style: styles.url, selectable: true },
            react_1.default.createElement(react_native_1.Text, { style: styles.method },
                entry.method,
                " "),
            entry.url),
        react_1.default.createElement(react_native_1.View, { style: styles.tabs },
            react_1.default.createElement(primitives_1.Segmented, { tabs: TABS, value: tab, onChange: setTab })),
        tab === 'Summary' && react_1.default.createElement(SummaryTab, { entry: entry, onRun: run, onCopyBody: copyBody }),
        tab === 'Request' && (react_1.default.createElement(BodyTab, { which: "request", entry: entry, reveal: reveal, onToast: onToast, onCopyBody: copyBody })),
        tab === 'Response' && (react_1.default.createElement(BodyTab, { which: "response", entry: entry, reveal: reveal, onToast: onToast, onCopyBody: copyBody })),
        tab === 'cURL' && react_1.default.createElement(CurlTab, { entry: entry, reveal: reveal, onRun: run })));
}
function SummaryTab({ entry, onRun, onCopyBody, }) {
    return (react_1.default.createElement(react_native_1.ScrollView, { style: styles.pane, contentContainerStyle: styles.paneContent },
        react_1.default.createElement(primitives_1.SectionTitle, null, "Overview"),
        react_1.default.createElement(primitives_1.KV, { rows: [
                ['outcome', entry.outcome],
                ['status', String(entry.status || '—')],
                ['duration', `${entry.durationMs}ms`],
                ['started', new Date(entry.startedAt).toISOString()],
                ['response size', `${entry.responseBodyBytes} chars`],
                ...(entry.responseUrl && entry.responseUrl !== entry.url
                    ? [['redirected to', entry.responseUrl]]
                    : []),
                ...(entry.correlationId
                    ? [['correlation', entry.correlationId]]
                    : []),
            ] }),
        react_1.default.createElement(react_native_1.View, { style: styles.actions },
            react_1.default.createElement(primitives_1.Btn, { label: "Copy response", onPress: () => onCopyBody('response'), tone: "accent", disabled: !entry.responseBody || entry.bodyEvicted }),
            react_1.default.createElement(primitives_1.Btn, { label: "Copy report", onPress: () => onRun('text'), tone: "accent" }),
            react_1.default.createElement(primitives_1.Btn, { label: "Copy cURL", onPress: () => onRun('curl'), tone: "accent" }),
            react_1.default.createElement(primitives_1.Btn, { label: "Share HAR", onPress: () => onRun('har') }))));
}
function BodyTab({ which, entry, reveal, onToast, onCopyBody, }) {
    const [openHeaders, setOpenHeaders] = (0, react_1.useState)(headersOpen[which]);
    const [view, setView] = (0, react_1.useState)('Tree');
    const headers = which === 'request' ? entry.requestHeaders : entry.responseHeaders;
    const headerRows = (0, react_1.useMemo)(() => Object.entries((0, redact_1.viewHeaders)(headers, reveal)), [headers, reveal]);
    const body = (0, react_1.useMemo)(() => (0, bodyView_1.describeBody)(entry, which, reveal), [entry, which, reveal]);
    const toggleHeaders = () => {
        const next = !openHeaders;
        headersOpen[which] = next;
        setOpenHeaders(next);
    };
    const isFormData = which === 'request' && entry.requestBodyKind === 'formdata';
    const headerBlock = (react_1.default.createElement(react_1.default.Fragment, null,
        react_1.default.createElement(primitives_1.Collapsible, { title: "Headers", count: headerRows.length, open: openHeaders, onToggle: toggleHeaders },
            react_1.default.createElement(primitives_1.KV, { rows: headerRows })),
        react_1.default.createElement(react_native_1.View, { style: styles.gap }),
        react_1.default.createElement(primitives_1.SectionTitle, null, "Body")));
    // The tree owns its own FlatList, so it replaces the pane's scroll container entirely.
    if (body.mode === 'tree' && view === 'Tree' && !isFormData) {
        return (react_1.default.createElement(react_native_1.View, { style: styles.pane },
            react_1.default.createElement(react_native_1.View, { style: styles.toolbar },
                react_1.default.createElement(react_native_1.View, { style: styles.toolbarSeg },
                    react_1.default.createElement(primitives_1.Segmented, { tabs: VIEWS, value: view, onChange: setView }))),
            react_1.default.createElement(JsonTree_1.JsonTree
            // Resets expansion and selection when the entry or the reveal state changes.
            , { 
                // Resets expansion and selection when the entry or the reveal state changes.
                key: `${entry.id}:${which}:${reveal}`, root: body.value, truncated: body.truncated, listHeader: headerBlock, onToast: onToast, onCopyWhole: () => onCopyBody(which) })));
    }
    return (react_1.default.createElement(react_native_1.ScrollView, { style: styles.pane, contentContainerStyle: styles.paneContent },
        body.mode === 'tree' && !isFormData && (react_1.default.createElement(react_native_1.View, { style: styles.toolbarSeg },
            react_1.default.createElement(primitives_1.Segmented, { tabs: VIEWS, value: view, onChange: setView }))),
        headerBlock,
        react_1.default.createElement(RawBody, { which: which, entry: entry, body: body, reveal: reveal, isFormData: isFormData, onCopyBody: onCopyBody })));
}
function RawBody({ which, entry, body, reveal, isFormData, onCopyBody, }) {
    if (isFormData) {
        return (react_1.default.createElement(primitives_1.KV, { rows: (entry.formParts ?? []).map((part) => [part.name, part.filename ? `<file ${part.filename}>` : (part.value ?? '')]) }));
    }
    if (body.mode === 'evicted') {
        return (react_1.default.createElement(react_native_1.Text, { style: styles.warn }, "Body was dropped to stay under the memory budget. Metadata above is intact."));
    }
    if (body.mode === 'none')
        return react_1.default.createElement(react_native_1.Text, { style: styles.dim }, "(empty)");
    if (body.mode === 'binary')
        return react_1.default.createElement(react_native_1.Text, { style: styles.dim }, body.text);
    const bytes = which === 'request' ? entry.requestBody?.length ?? 0 : entry.responseBodyBytes;
    return (react_1.default.createElement(react_1.default.Fragment, null,
        react_1.default.createElement(primitives_1.CodeBlock, { text: (0, bodies_1.prettyJson)(body.text) }),
        body.mode === 'truncated' && (react_1.default.createElement(react_native_1.Text, { style: styles.warn },
            "Truncated mid-JSON at ",
            bytes.toLocaleString(),
            " chars \u2014 cannot build a tree.")),
        body.mode === 'tree' && body.truncated && (react_1.default.createElement(react_native_1.Text, { style: styles.warn }, "Truncated \u2014 the tail of this body is missing.")),
        (0, bodyView_1.isUnredactedFallback)(body, reveal) && (react_1.default.createElement(react_native_1.Text, { style: styles.warn }, "Not redacted \u2014 this body could not be parsed as JSON.")),
        react_1.default.createElement(react_native_1.View, { style: styles.actions },
            react_1.default.createElement(primitives_1.Btn, { label: "Copy JSON", onPress: () => onCopyBody(which), tone: "accent" }))));
}
function CurlTab({ entry, reveal, onRun, }) {
    return (react_1.default.createElement(react_native_1.ScrollView, { style: styles.pane, contentContainerStyle: styles.paneContent },
        react_1.default.createElement(primitives_1.SectionTitle, null, reveal ? 'Runnable' : 'Secrets masked'),
        react_1.default.createElement(primitives_1.CodeBlock, { text: (0, curl_1.toCurl)(entry, { reveal }) }),
        react_1.default.createElement(react_native_1.View, { style: styles.actions },
            react_1.default.createElement(primitives_1.Btn, { label: "Copy cURL", onPress: () => onRun('curl'), tone: "accent" })),
        !reveal && (react_1.default.createElement(react_native_1.Text, { style: styles.warn }, "Turn on \u201CReveal secrets\u201D in Settings to copy a command that will actually authenticate."))));
}
const styles = react_native_1.StyleSheet.create({
    container: { flex: 1 },
    header: { flexDirection: 'row', alignItems: 'center', gap: theme_1.S.md, paddingHorizontal: theme_1.S.md },
    statusPill: { borderWidth: 1, borderRadius: 6, paddingHorizontal: theme_1.S.sm, paddingVertical: 2 },
    statusText: { fontSize: 12, fontWeight: '700' },
    duration: { marginLeft: 'auto', color: theme_1.T.textDim, fontSize: 12 },
    url: { color: theme_1.T.text, fontSize: 12, paddingHorizontal: theme_1.S.md, paddingTop: theme_1.S.sm },
    method: { color: theme_1.T.accent, fontWeight: '800' },
    tabs: { padding: theme_1.S.md },
    pane: { flex: 1 },
    paneContent: { paddingHorizontal: theme_1.S.md, paddingBottom: theme_1.S.xl },
    toolbar: { paddingHorizontal: theme_1.S.md },
    toolbarSeg: { maxWidth: 180 },
    gap: { height: theme_1.S.lg },
    actions: { flexDirection: 'row', gap: theme_1.S.sm, marginTop: theme_1.S.lg, flexWrap: 'wrap' },
    warn: { color: theme_1.T.warn, fontSize: 12, marginTop: theme_1.S.sm },
    dim: { color: theme_1.T.textDim, fontSize: 12, fontStyle: 'italic' },
});
//# sourceMappingURL=RequestDetail.js.map