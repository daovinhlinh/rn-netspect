export type JsonKind = 'object' | 'array' | 'string' | 'number' | 'boolean' | 'null';
/**
 * Root sentinel. Paths are '$'-rooted so a node whose own key is literally '$'
 * (giving '$.$') can never collide with the root itself.
 */
export declare const ROOT = "$";
/** Containers deeper than this render as leaves rather than recursing forever. */
export declare const MAX_TREE_DEPTH = 24;
export type JsonRow = {
    /** '$'-rooted canonical path. Stable across expand/collapse — used as the list key. */
    id: string;
    /** Copy-ready path with the root stripped ('data.items[0].code'). */
    path: string;
    depth: number;
    /** 'data' for object members, '[0]' for array members, '' for the root. */
    keyLabel: string;
    /** Reference into the parsed tree. Never truncated — this is what copy reads. */
    value: unknown;
    kind: JsonKind;
    expandable: boolean;
    childCount: number;
    /** Single-line and truncated, for display only. */
    preview: string;
    previewTruncated: boolean;
    /** Value looks like a redaction mask, so the UI can style it as hidden, not as data. */
    masked: boolean;
    /** Container that hit MAX_TREE_DEPTH; rendered as a leaf. */
    atDepthLimit: boolean;
};
export declare const childKey: (parentId: string, key: string) => string;
export declare const childIndex: (parentId: string, index: number) => string;
/** '$.data.items[0]' -> 'data.items[0]'; '$["a-b"]' -> '["a-b"]'; '$' stays '$'. */
export declare function displayPath(id: string): string;
export type PathSeg = {
    kind: 'key';
    key: string;
} | {
    kind: 'index';
    index: number;
};
/** Tokenises a '$'-rooted path. Returns null on anything it cannot fully consume. */
export declare function parsePath(id: string): PathSeg[] | null;
/** Distinguishes "present and null" from "absent", which a bare value cannot express. */
export declare function getAtPath(root: unknown, id: string): {
    found: boolean;
    value: unknown;
};
export declare function kindOf(value: unknown): JsonKind;
export declare function countChildren(value: unknown): number;
export declare function previewOf(value: unknown): {
    text: string;
    truncated: boolean;
};
/**
 * Depth-first walk producing only the rows whose ancestors are all expanded, so cost is
 * proportional to what is visible rather than to the whole document. Uses an explicit
 * stack: a 32 KB body can nest deeply enough to matter, and recursion would risk the
 * JS stack. Children are pushed in reverse so they pop in source order.
 */
export declare function flattenJson(root: unknown, expanded: ReadonlySet<string>, opts?: {
    maxRows?: number;
}): JsonRow[];
export declare const EXPANSION_DEFAULTS: {
    readonly maxRows: 120;
    readonly maxDepth: 4;
    readonly maxChildren: 40;
};
/**
 * Breadth-first with a node budget. BFS rather than DFS is what makes a
 * `{success, code, data:{…}}` envelope open all the way to the useful level instead of
 * spending the whole budget inside the first branch.
 */
export declare function defaultExpanded(root: unknown, opts?: Partial<typeof EXPANSION_DEFAULTS>): Set<string>;
/** Every container path, or null when the tree is larger than `limit`. */
export declare function allContainerPaths(root: unknown, limit?: number): Set<string> | null;
/**
 * "The thing itself" — a string comes back unquoted and in full, so it can be pasted
 * straight into a query or a grep. That unquoting is the whole point of having a
 * separate `value` action alongside `subtree`.
 */
export declare function valueText(value: unknown): string;
/** Valid, pretty JSON — pasteable into a file. */
export declare function subtreeText(value: unknown): string;
/** Names what landed on the clipboard; "Copied 18 chars" alone is meaningless for a path. */
export declare const copySummary: (path: string, text: string) => string;
//# sourceMappingURL=json.d.ts.map