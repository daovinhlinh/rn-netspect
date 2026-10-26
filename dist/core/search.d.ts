import type { NetspectEntry } from '../types';
/** Which field a search hit, so a row whose visible text lacks the query still makes sense. */
export type MatchField = 'url' | 'params' | 'request body' | 'response body' | null;
/** Scanning every retained body on each keystroke is wasteful for a single character. */
export declare const BODY_SEARCH_MIN_LENGTH = 2;
/**
 * Searches URL, method, status, decoded query params, and both bodies.
 *
 * Bodies are searched raw — the buffer holds raw values — so you can find a request by a
 * token or id you already know. The list never renders body content, so a match reveals
 * nothing the detail view would not already gate behind "Reveal secrets".
 *
 * Returns `null` for an empty query (everything matches), `'none'` for no match, or the
 * field that hit.
 */
export declare function matchEntry(entry: NetspectEntry, needle: string): MatchField | 'none';
//# sourceMappingURL=search.d.ts.map