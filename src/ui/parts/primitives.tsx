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

  collapsibleHead: { flexDirection: 'row', alignItems: 'center', gap: S.sm, paddingVertical: S.sm },
  twisty: { color: T.textDim, fontSize: 11, width: 12 },
  collapsibleCount: { marginLeft: 'auto', color: T.textDim, fontSize: 11, fontFamily: mono },
  dim: { color: T.textDim, fontSize: 12, fontStyle: 'italic' },
});
