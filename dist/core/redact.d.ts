import type { HeaderMap } from '../types';
export declare const MASK: string;
/**
 * Heuristic, used only for styling a masked leaf differently in the JSON tree. A response
 * could legitimately contain eight bullets; a false positive costs nothing because this
 * never gates access to anything.
 */
export declare const isMasked: (value: string) => boolean;
/** Keeps the scheme prefix and length, which is usually all you need to diagnose. */
export declare function maskValue(value: string): string;
export declare function redactHeaderValue(name: string, value: string): string;
export declare function redactHeaders(headers: HeaderMap): HeaderMap;
/**
 * Redaction is applied when data is *shown or exported*, never when it is captured.
 * Masking at capture time would be destructive, which would make the "Reveal secrets"
 * toggle a lie and make generated cURL permanently un-runnable. The buffer therefore
 * holds raw values — see the security note in the README.
 */
export declare const viewHeaders: (headers: HeaderMap, reveal: boolean) => HeaderMap;
export declare const viewBody: (text: string | null, reveal: boolean) => string | null;
/** Shows enough of a key to recognise it without handing over the whole secret. */
export declare function maskEnvValue(value: string): string;
export declare function redactEnv(env: Record<string, string | undefined>): Record<string, string>;
/**
 * Best-effort redaction of a serialised body. Non-JSON input is returned as-is —
 * guessing at arbitrary text formats would mangle more than it protects.
 */
export declare function redactBodyText(text: string | null): string | null;
//# sourceMappingURL=redact.d.ts.map