import type { NetspectEntry } from '../types';
/**
 * HAR 1.2. Lossy by necessity — we have no per-phase timings and bodies may be
 * truncated or evicted — but valid enough for any HAR viewer to open.
 */
export declare function toHar(entries: NetspectEntry[], opts?: {
    reveal?: boolean;
}): string;
//# sourceMappingURL=har.d.ts.map