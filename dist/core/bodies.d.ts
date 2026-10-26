import type { BodyKind, FormPart, HeaderMap, Outcome } from '../types';
export type CapturedBody = {
    text: string | null;
    kind: BodyKind;
    truncated: boolean;
    /** Length before truncation, in UTF-16 units. */
    bytes: number;
    formParts?: FormPart[];
};
export declare function readRequestBody(body: unknown): CapturedBody;
/**
 * Reads a finished XHR's response without perturbing it. Three RN-specific hazards
 * drive the shape of this function:
 *
 * 1. The `responseText` getter THROWS unless `responseType` is '' or 'text'.
 * 2. The `response` getter for 'blob' calls `BlobManager.createFromOptions()`, handing
 *    out a Blob the app also owns — a double-release would free the native blob out
 *    from under the app. So we never touch it; we read the private descriptor instead.
 * 3. The `response` getter for 'arraybuffer' base64-decodes the entire payload on every
 *    read. Also avoided.
 */
export declare function readResponseBody(xhr: any, outcome: Outcome): CapturedBody;
export declare function readResponseHeaders(xhr: any): HeaderMap;
/** Pretty-prints JSON for display, falling back to the original text. */
export declare function prettyJson(text: string | null): string;
//# sourceMappingURL=bodies.d.ts.map