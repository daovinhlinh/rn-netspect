import type { NetspectEntry } from '../types';
export type ExportFormat = 'text' | 'har' | 'curl';
export type ExportResult = {
    ok: boolean;
    message: string;
};
/**
 * Copies arbitrary text through the host's configured sink. Exists so the JSON tree can
 * copy one node without re-implementing the `sinks.copy ?? Clipboard` fallback above.
 * `message` is overridable because a partial copy wants to name what it copied.
 */
export declare function copyToClipboard(text: string, message?: string): Promise<ExportResult>;
export declare function exportEntry(entry: NetspectEntry, format: ExportFormat, opts?: {
    reveal?: boolean;
}): Promise<ExportResult>;
/**
 * Copies just one body, pretty-printed. The common case is grabbing a response payload
 * to paste into a ticket or a JSON viewer, without the surrounding report.
 */
export declare function exportBody(entry: NetspectEntry, which: 'request' | 'response', opts?: {
    reveal?: boolean;
}): Promise<ExportResult>;
export declare function exportSession(format: ExportFormat, opts?: {
    reveal?: boolean;
}): Promise<ExportResult>;
//# sourceMappingURL=session.d.ts.map