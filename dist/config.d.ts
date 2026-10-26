import type { NetspectConfig } from './types';
export declare const DEFAULTS: NetspectConfig;
export declare const getConfig: () => NetspectConfig;
export declare function setConfig(patch: Partial<NetspectConfig>): void;
export declare function resetConfig(): void;
export declare const isIgnoredUrl: (url: string) => boolean;
export declare const isIgnoredContentType: (contentType: string | undefined) => boolean;
//# sourceMappingURL=config.d.ts.map