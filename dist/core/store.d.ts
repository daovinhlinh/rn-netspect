import type { NetspectEntry } from '../types';
export declare const store: {
    subscribe(listener: () => void): () => void;
    /** Stable identity between mutations — required by `useSyncExternalStore`. */
    getSnapshot(): NetspectEntry[];
    get(id: string): NetspectEntry | undefined;
    push(entry: NetspectEntry): void;
    update(id: string, patch: Partial<NetspectEntry>): void;
    clear(): void;
    /** Diagnostics for the settings panel. */
    stats(): {
        count: number;
        bodyBytes: number;
    };
};
//# sourceMappingURL=store.d.ts.map