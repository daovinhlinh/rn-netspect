"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FONT = exports.S = exports.T = void 0;
exports.statusColor = statusColor;
/**
 * A fixed dark palette of plain literals. Deliberately not wired to any theming
 * library — a debug overlay should look the same in every host app, and depending on
 * the host's theme is what would make this module non-portable.
 */
exports.T = {
    bg: '#0B0F14',
    surface: '#141A21',
    surfaceAlt: '#1B232C',
    border: '#27323D',
    text: '#E6EDF3',
    textDim: '#8B98A5',
    accent: '#4C9AFF',
    ok: '#3FB950',
    warn: '#D29922',
    error: '#F85149',
    pending: '#8B98A5',
    bubble: '#1F6FEB',
    overlay: 'rgba(0,0,0,0.6)',
    // JSON syntax, kept in the same GitHub-dark family as the tokens above.
    jsonKey: '#79C0FF',
    jsonString: '#A5D6FF',
    jsonNumber: '#FFA657',
    jsonBool: '#D2A8FF',
    jsonNull: '#8B98A5',
    /** Selected tree row. Readable against `bg` without washing out the text on it. */
    selected: '#13283F',
};
exports.S = {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 24,
};
exports.FONT = {
    mono: 'Menlo',
    monoAndroid: 'monospace',
};
/** Status colour by HTTP class, with non-ok outcomes taking precedence. */
function statusColor(status, outcome) {
    if (outcome === 'pending')
        return exports.T.pending;
    if (outcome !== 'ok')
        return exports.T.error;
    if (status >= 500)
        return exports.T.error;
    if (status >= 400)
        return exports.T.warn;
    if (status >= 200 && status < 300)
        return exports.T.ok;
    return exports.T.textDim;
}
//# sourceMappingURL=theme.js.map