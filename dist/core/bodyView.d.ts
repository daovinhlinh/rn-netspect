import type { NetspectEntry } from '../types';
/**
 * One resolver for every way a body can fail to be a JSON tree, so the component has no
 * branching logic of its own and each branch is testable without a renderer.
 */
export type BodyView = {
    mode: 'evicted';
} | {
    mode: 'none';
} | {
    mode: 'binary';
    text: string;
} | {
    mode: 'text';
    text: string;
    redacted: boolean;
} | {
    mode: 'truncated';
    text: string;
    redacted: boolean;
} | {
    mode: 'tree';
    value: unknown;
    text: string;
    truncated: boolean;
};
export declare function describeBody(entry: NetspectEntry, which: 'request' | 'response', reveal: boolean): BodyView;
/**
 * True when a body is being shown in the clear despite `reveal` being off, because
 * redaction could not parse it. The UI surfaces this rather than letting it pass silently.
 */
export declare const isUnredactedFallback: (view: BodyView, reveal: boolean) => boolean;
//# sourceMappingURL=bodyView.d.ts.map