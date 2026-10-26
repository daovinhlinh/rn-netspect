/**
 * A fixed dark palette of plain literals. Deliberately not wired to any theming
 * library — a debug overlay should look the same in every host app, and depending on
 * the host's theme is what would make this module non-portable.
 */
export declare const T: {
    readonly bg: "#0B0F14";
    readonly surface: "#141A21";
    readonly surfaceAlt: "#1B232C";
    readonly border: "#27323D";
    readonly text: "#E6EDF3";
    readonly textDim: "#8B98A5";
    readonly accent: "#4C9AFF";
    readonly ok: "#3FB950";
    readonly warn: "#D29922";
    readonly error: "#F85149";
    readonly pending: "#8B98A5";
    readonly bubble: "#1F6FEB";
    readonly overlay: "rgba(0,0,0,0.6)";
    readonly jsonKey: "#79C0FF";
    readonly jsonString: "#A5D6FF";
    readonly jsonNumber: "#FFA657";
    readonly jsonBool: "#D2A8FF";
    readonly jsonNull: "#8B98A5";
    /** Selected tree row. Readable against `bg` without washing out the text on it. */
    readonly selected: "#13283F";
};
export declare const S: {
    readonly xs: 4;
    readonly sm: 8;
    readonly md: 12;
    readonly lg: 16;
    readonly xl: 24;
};
export declare const FONT: {
    readonly mono: "Menlo";
    readonly monoAndroid: "monospace";
};
/** Status colour by HTTP class, with non-ok outcomes taking precedence. */
export declare function statusColor(status: number, outcome: string): string;
//# sourceMappingURL=theme.d.ts.map