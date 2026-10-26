import type { ManualEntry, NetspectConfig, NetspectEntry } from '../types';
import { type AxiosInstanceLike } from './axiosCorrelate';
import { uninstallXhrPatch } from './xhrPatch';
/**
 * Installs the XHR patch. Idempotent, and a no-op when `enabled` is false, so the host
 * can call it unconditionally at startup.
 */
declare function init(config?: Partial<NetspectConfig>): void;
/**
 * Records a request the XHR patch cannot see — anything using native networking
 * (`react-native-blob-util`, `ReactNativeBlobUtil`, a native SDK).
 */
declare function record(manual: ManualEntry): void;
export declare const Netspect: {
    init: typeof init;
    record: typeof record;
    attachAxios: (instance: AxiosInstanceLike) => () => void;
    configure: (config: Partial<NetspectConfig>) => void;
    /** Pause/resume capture without removing the patch. */
    pause: () => void;
    resume: () => void;
    clear: () => void;
    getEntries: () => NetspectEntry[];
    stats: () => {
        count: number;
        bodyBytes: number;
    };
    /** Restores the original prototype methods. Mainly for tests. */
    uninstall: typeof uninstallXhrPatch;
};
export {};
//# sourceMappingURL=netspect.d.ts.map