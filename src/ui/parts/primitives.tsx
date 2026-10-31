import React from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { FONT, S, T } from '../theme';

const mono = Platform.OS === 'ios' ? FONT.mono : FONT.monoAndroid;

export function Btn({
  label,
  onPress,
  tone = 'default',
  disabled,
}: {
  label: string;
  onPress: () => void;
  tone?: 'default' | 'accent' | 'danger';
  disabled?: boolean;
}) {
  const color = tone === 'accent' ? T.accent : tone === 'danger' ? T.error : T.text;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.btn,
        { borderColor: color, opacity: disabled ? 0.4 : pressed ? 0.6 : 1 },
      ]}
      hitSlop={6}
    >
      <Text style={[styles.btnLabel, { color }]}>{label}</Text>
    </Pressable>
  );
}

export function Chip({
  label,
  active,
  onPress,
}: {
  label: string;
  active?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.chip, active && { backgroundColor: T.accent, borderColor: T.accent }]}
      hitSlop={4}
    >
      <Text style={[styles.chipLabel, active && { color: T.bg, fontWeight: '700' }]}>{label}</Text>
    </Pressable>
  );
}

export function Segmented<Tab extends string>({
  tabs,
  value,
  onChange,
}: {
  tabs: readonly Tab[];
  value: Tab;
  onChange: (tab: Tab) => void;
}) {
  return (
    <View style={styles.segmented}>
      {tabs.map((tab) => (
        <Pressable
          key={tab}
          onPress={() => onChange(tab)}
          style={[styles.segment, tab === value && styles.segmentActive]}
        >
          <Text style={[styles.segmentLabel, tab === value && { color: T.text }]} numberOfLines={1}>
            {tab}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

export function KV({ rows, empty = '(none)' }: { rows: Array<[string, string]>; empty?: string }) {
  if (rows.length === 0) return <Text style={styles.dim}>{empty}</Text>;
  return (
    <View>
      {rows.map(([key, value], i) => (
        <View key={`${key}-${i}`} style={styles.kvRow}>
          <Text style={styles.kvKey} selectable>
            {key}
          </Text>
          <Text style={styles.kvValue} selectable>
            {value}
          </Text>
        </View>
      ))}
    </View>
  );
}

/**
 * Horizontal scroll is deliberate: long URLs and minified JSON must not be
 * soft-wrapped into an unreadable block, and the page itself must never scroll sideways.
 */
export function CodeBlock({ text }: { text: string }) {
  if (!text) return <Text style={styles.dim}>(empty)</Text>;
  return (
    <ScrollView horizontal style={styles.code} contentContainerStyle={styles.codeInner}>
      <Text style={styles.codeText} selectable>
        {text}
      </Text>
    </ScrollView>
  );
}

export function SearchInput({
  value,
  onChangeText,
  placeholder,
}: {
  value: string;
  onChangeText: (next: string) => void;
  placeholder: string;
}) {
  return (
    <TextInput
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor={T.textDim}
      autoCapitalize="none"
      autoCorrect={false}
      style={styles.search}
    />
  );
}

export function SectionTitle({ children }: { children: string }) {
  return <Text style={styles.sectionTitle}>{children}</Text>;
}

/** A vertical single-choice row. `Segmented` is horizontal and runs out of width past ~4. */
export function RadioRow({
  label,
  hint,
  selected,
  onPress,
}: {
  label: string;
  hint?: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.radioRow, pressed && { opacity: 0.6 }]}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
    >
      <Text style={[styles.radioDot, selected && { color: T.accent }]}>
        {selected ? '◉' : '○'}
      </Text>
      <View style={styles.radioText}>
        <Text style={[styles.radioLabel, selected && { color: T.text }]}>{label}</Text>
        {hint ? <Text style={styles.radioHint}>{hint}</Text> : null}
      </View>
    </Pressable>
  );
}

/**
 * A labelled numeric field. Keeps its own draft string so a half-typed value is not
 * round-tripped through `Number()` on every keystroke — that would make "20" unreachable by
 * rewriting it to 2 the moment you typed the first digit.
 */
export function NumField({
  label,
  value,
  suffix,
  onCommit,
}: {
  label: string;
  value: number;
  suffix?: string;
  onCommit: (next: number) => void;
}) {
  const [draft, setDraft] = React.useState<string | null>(null);

  const commit = () => {
    if (draft === null) return;
    const parsed = Number(draft);
    setDraft(null);
    if (Number.isFinite(parsed) && parsed >= 0) onCommit(parsed);
  };

  return (
    <View style={styles.fieldRow}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        value={draft ?? String(value)}
        onChangeText={setDraft}
        onEndEditing={commit}
        onBlur={commit}
        onSubmitEditing={commit}
        keyboardType="number-pad"
        returnKeyType="done"
        selectTextOnFocus
        placeholderTextColor={T.textDim}
        style={styles.fieldInput}
      />
      {suffix ? <Text style={styles.fieldSuffix}>{suffix}</Text> : null}
    </View>
  );
}

/** A labelled free-text field, for things like the URL filter. */
export function TextField({
  label,
  value,
  placeholder,
  onChangeText,
}: {
  label: string;
  value: string;
  placeholder?: string;
  onChangeText: (next: string) => void;
}) {
  return (
    <View style={styles.fieldRow}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={T.textDim}
        autoCapitalize="none"
        autoCorrect={false}
        style={[styles.fieldInput, styles.fieldInputWide]}
      />
    </View>
  );
}

/** A section whose body can be tucked away, with the item count kept visible when closed. */
export function Collapsible({
  title,
  count,
  open,
  onToggle,
  children,
}: {
  title: string;
  count: number;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <View>
      <Pressable
        onPress={onToggle}
        style={({ pressed }) => [styles.collapsibleHead, pressed && { opacity: 0.6 }]}
        hitSlop={6}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
      >
        <Text style={styles.twisty}>{open ? '▾' : '▸'}</Text>
        <Text style={[styles.sectionTitle, styles.sectionTitleInline]}>{title}</Text>
        <Text style={styles.collapsibleCount}>{count}</Text>
      </Pressable>
      {open ? children : null}
    </View>
  );
}

const styles = StyleSheet.create({
  btn: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: S.md,
    paddingVertical: S.sm,
  },
  btnLabel: { fontSize: 13, fontWeight: '600' },

  chip: {
    borderWidth: 1,
    borderColor: T.border,
    borderRadius: 999,
    paddingHorizontal: S.md,
    paddingVertical: S.xs + 1,
  },
  chipLabel: { color: T.textDim, fontSize: 12 },

  segmented: {
    flexDirection: 'row',
    backgroundColor: T.surfaceAlt,
    borderRadius: 8,
    padding: 2,
    gap: 2,
  },
  segment: { flex: 1, paddingVertical: S.sm, borderRadius: 6, alignItems: 'center' },
  segmentActive: { backgroundColor: T.surface },
  segmentLabel: { color: T.textDim, fontSize: 12, fontWeight: '600' },

  kvRow: { flexDirection: 'row', paddingVertical: 3, gap: S.sm },
  kvKey: { color: T.textDim, fontSize: 12, flex: 4, fontFamily: mono },
  kvValue: { color: T.text, fontSize: 12, flex: 6, fontFamily: mono },

  code: {
    backgroundColor: T.bg,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: T.border,
    maxHeight: 320,
  },
  codeInner: { padding: S.sm },
  codeText: { color: T.text, fontSize: 11, fontFamily: mono, lineHeight: 16 },

  search: {
    backgroundColor: T.surfaceAlt,
    borderRadius: 8,
    paddingHorizontal: S.md,
    paddingVertical: S.sm,
    color: T.text,
    fontSize: 13,
  },

  sectionTitle: {
    color: T.textDim,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: S.xs,
  },
  // The twisty row supplies its own vertical padding, so drop the standalone margin.
  sectionTitleInline: { marginBottom: 0 },

  radioRow: { flexDirection: 'row', alignItems: 'center', gap: S.md, paddingVertical: S.sm },
  radioDot: { color: T.textDim, fontSize: 14, width: 16 },
  radioText: { flex: 1, gap: 1 },
  radioLabel: { color: T.textDim, fontSize: 13, fontWeight: '600' },
  radioHint: { color: T.textDim, fontSize: 11, opacity: 0.8 },

  fieldRow: { flexDirection: 'row', alignItems: 'center', gap: S.sm, paddingVertical: S.xs },
  fieldLabel: { color: T.textDim, fontSize: 12, flex: 1 },
  fieldInput: {
    backgroundColor: T.surfaceAlt,
    borderRadius: 6,
    paddingHorizontal: S.sm,
    paddingVertical: S.xs,
    color: T.text,
    fontSize: 13,
    fontFamily: mono,
    minWidth: 72,
    textAlign: 'right',
  },
  fieldInputWide: { flex: 2, textAlign: 'left' },
  fieldSuffix: { color: T.textDim, fontSize: 11, width: 24 },

  collapsibleHead: { flexDirection: 'row', alignItems: 'center', gap: S.sm, paddingVertical: S.sm },
  twisty: { color: T.textDim, fontSize: 11, width: 12 },
  collapsibleCount: { marginLeft: 'auto', color: T.textDim, fontSize: 11, fontFamily: mono },
  dim: { color: T.textDim, fontSize: 12, fontStyle: 'italic' },
});
