import type { NetspectEntry } from '../types';
export declare const statusLabel: (entry: NetspectEntry) => string;
export declare function toEntryText(entry: NetspectEntry, opts?: {
    reveal?: boolean;
}): string;
export declare function toSessionText(entries: NetspectEntry[], opts?: {
    reveal?: boolean;
}): string;
//# sourceMappingURL=text.d.ts.map