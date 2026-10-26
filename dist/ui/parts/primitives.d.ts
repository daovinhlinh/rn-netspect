import React from 'react';
export declare function Btn({ label, onPress, tone, disabled, }: {
    label: string;
    onPress: () => void;
    tone?: 'default' | 'accent' | 'danger';
    disabled?: boolean;
}): React.JSX.Element;
export declare function Chip({ label, active, onPress, }: {
    label: string;
    active?: boolean;
    onPress: () => void;
}): React.JSX.Element;
export declare function Segmented<Tab extends string>({ tabs, value, onChange, }: {
    tabs: readonly Tab[];
    value: Tab;
    onChange: (tab: Tab) => void;
}): React.JSX.Element;
export declare function KV({ rows, empty }: {
    rows: Array<[string, string]>;
    empty?: string;
}): React.JSX.Element;
/**
 * Horizontal scroll is deliberate: long URLs and minified JSON must not be
 * soft-wrapped into an unreadable block, and the page itself must never scroll sideways.
 */
export declare function CodeBlock({ text }: {
    text: string;
}): React.JSX.Element;
export declare function SearchInput({ value, onChangeText, placeholder, }: {
    value: string;
    onChangeText: (next: string) => void;
    placeholder: string;
}): React.JSX.Element;
export declare function SectionTitle({ children }: {
    children: string;
}): React.JSX.Element;
/** A section whose body can be tucked away, with the item count kept visible when closed. */
export declare function Collapsible({ title, count, open, onToggle, children, }: {
    title: string;
    count: number;
    open: boolean;
    onToggle: () => void;
    children: React.ReactNode;
}): React.JSX.Element;
//# sourceMappingURL=primitives.d.ts.map