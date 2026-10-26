import React, { useCallback, useMemo, useState } from 'react';
import { FlatList, Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import {
  allContainerPaths,
  copySummary,
  defaultExpanded,
  flattenJson,
  subtreeText,
  valueText,
  type JsonRow,
} from '../core/json';
import { copyToClipboard } from '../export/session';
import { Btn } from './parts/primitives';
import { FONT, S, T } from './theme';

const INDENT = 10;
/** Past this, further indenting just pushes content off-screen. */
const MAX_INDENT_DEPTH = 10;
const EXPAND_ALL_LIMIT = 2000;

const mono = Platform.OS === 'ios' ? FONT.mono : FONT.monoAndroid;

function valueStyle(row: JsonRow) {
  if (row.masked) return styles.masked;
  switch (row.kind) {
    case 'string':
      return styles.vString;
    case 'number':
      return styles.vNumber;
    case 'boolean':
      return styles.vBool;
    case 'null':
      return styles.vNull;
    default:
      return styles.vContainer;
  }
}

/** Containers copy as a subtree; leaves copy as the bare value. */
const rowCopyText = (row: JsonRow): string =>
  row.kind === 'object' || row.kind === 'array' ? subtreeText(row.value) : valueText(row.value);

type RowProps = {
  row: JsonRow;
  expanded: boolean;
  selected: boolean;
  onPress: (row: JsonRow) => void;
  onLongPress: (row: JsonRow) => void;
  onCopy: (row: JsonRow) => void;
};

const Row = React.memo(function Row({
  row,
  expanded,
  selected,
  onPress,
  onLongPress,
  onCopy,
}: RowProps) {
  const indent = S.sm + Math.min(row.depth, MAX_INDENT_DEPTH) * INDENT;

  return (
    <View style={[styles.row, selected && styles.rowSelected]}>
      <Pressable
        onPress={() => onPress(row)}
        onLongPress={() => onLongPress(row)}
        delayLongPress={300}
        style={({ pressed }) => [styles.rowMain, { paddingLeft: indent }, pressed && styles.pressed]}
        accessibilityRole="button"
        accessibilityState={{ expanded: row.expandable ? expanded : undefined, selected }}
        accessibilityLabel={`${row.path} ${row.preview}`}
      >
        <Text style={styles.twisty}>{row.expandable ? (expanded ? '▾' : '▸') : ' '}</Text>
        {row.keyLabel ? (
          <Text style={styles.key} numberOfLines={1}>
            {row.keyLabel}
          </Text>
        ) : null}
        {row.keyLabel ? <Text style={styles.colon}>: </Text> : null}
        <Text style={[styles.value, valueStyle(row)]} numberOfLines={1} ellipsizeMode="tail">
          {row.preview}
        </Text>
        {row.atDepthLimit ? <Text style={styles.flag}> depth limit</Text> : null}
      </Pressable>

      {/* One-tap copy for this node, no selection needed. */}
      <Pressable
        onPress={() => onCopy(row)}
        hitSlop={8}
        style={({ pressed }) => [styles.copyBtn, pressed && styles.pressed]}
        accessibilityRole="button"
        accessibilityLabel={`Copy ${row.path}`}
      >
        <Text style={styles.copyGlyph}>⧉</Text>
      </Pressable>
    </View>
  );
});

export function JsonTree({
  root,
  truncated,
  listHeader,
  onToast,
  onCopyWhole,
}: {
  root: unknown;
  truncated?: boolean;
  listHeader?: React.ReactNode;
  onToast: (message: string) => void;
  onCopyWhole: () => void;
}) {
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(() => defaultExpanded(root));
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const rows = useMemo(() => flattenJson(root, expanded), [root, expanded]);
  // Re-resolved from the visible rows, so collapsing a selected node's parent dismisses
  // the action bar on its own rather than leaving it pointing at something off-screen.
  const selected = useMemo(
    () => rows.find((row) => row.id === selectedId) ?? null,
    [rows, selectedId],
  );

  const copy = useCallback(
    async (text: string, path: string) => {
      const result = await copyToClipboard(text, copySummary(path, text));
      onToast(result.message);
    },
    [onToast],
  );

  const onPressRow = useCallback((row: JsonRow) => {
    if (!row.expandable) {
      setSelectedId(row.id);
      return;
    }
    setExpanded((prev) => {
      const next = new Set(prev);
      if (!next.delete(row.id)) next.add(row.id);
      return next;
    });
  }, []);

  // Long-press selects a container without toggling it — RN suppresses onPress when a
  // long press fires, so the two never both run.
  const onLongPressRow = useCallback((row: JsonRow) => setSelectedId(row.id), []);

  const onCopyRow = useCallback((row: JsonRow) => copy(rowCopyText(row), row.path), [copy]);

  const expandAll = useCallback(() => {
    const all = allContainerPaths(root, EXPAND_ALL_LIMIT);
    if (!all) {
      onToast('Too large to expand all');
      return;
    }
    setExpanded(all);
  }, [root, onToast]);

  return (
    <View style={styles.wrap}>
      <FlatList
        data={rows}
        extraData={selectedId}
        keyExtractor={(row) => row.id}
        ListHeaderComponent={
          // Padded here rather than on the list, so tree rows can still indent from the
          // very edge while the header block lines up with the other tabs.
          <View style={styles.headerPad}>
            {listHeader}
            {truncated ? (
              <Text style={styles.warn}>Truncated — the tail of this body is missing.</Text>
            ) : null}
            <View style={styles.tools}>
              <Btn label="Collapse all" onPress={() => setExpanded(new Set())} />
              <Btn label="Expand all" onPress={expandAll} />
              <Btn label="Copy all" onPress={onCopyWhole} tone="accent" />
            </View>
          </View>
        }
        renderItem={({ item }) => (
          <Row
            row={item}
            expanded={expanded.has(item.id)}
            selected={item.id === selectedId}
            onPress={onPressRow}
            onLongPress={onLongPressRow}
            onCopy={onCopyRow}
          />
        )}
        keyboardShouldPersistTaps="handled"
        initialNumToRender={30}
        maxToRenderPerBatch={20}
        updateCellsBatchingPeriod={50}
        windowSize={10}
        // Deliberately not setting removeClippedSubviews: with Pressable rows on Android
        // it has a history of blanking text on fast scroll.
      />

      {selected ? (
        <View style={styles.actionBar}>
          <Text style={styles.actionPath} numberOfLines={1} ellipsizeMode="head">
            {selected.path}
          </Text>
          <View style={styles.actionBtns}>
            <Btn
              label="Value"
              tone="accent"
              onPress={() => copy(valueText(selected.value), selected.path)}
            />
            <Btn
              label="Subtree"
              tone="accent"
              onPress={() => copy(subtreeText(selected.value), selected.path)}
            />
            <Btn label="Path" onPress={() => copy(selected.path, selected.path)} />
            <Btn label="✕" onPress={() => setSelectedId(null)} />
          </View>
        </View>
      ) : (
        <Text style={styles.hint}>Tap ⧉ to copy a node · tap to expand · long-press to select</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1 },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    // Every row reserves the accent bar so selecting one never shifts its text sideways.
    borderLeftWidth: 3,
    borderLeftColor: 'transparent',
  },
  rowSelected: { backgroundColor: T.selected, borderLeftColor: T.accent },
  // Weaker than the selected state, so "touching" and "selected" never look alike.
  pressed: { backgroundColor: T.surfaceAlt },
  rowMain: { flex: 1, flexDirection: 'row', alignItems: 'center', paddingVertical: 3 },

  twisty: { color: T.textDim, fontSize: 10, width: 12 },
  key: { color: T.jsonKey, fontSize: 11, fontFamily: mono, flexShrink: 1 },
  colon: { color: T.textDim, fontSize: 11, fontFamily: mono },
  value: { fontSize: 11, fontFamily: mono, flexShrink: 1 },
  vString: { color: T.jsonString },
  vNumber: { color: T.jsonNumber },
  vBool: { color: T.jsonBool },
  vNull: { color: T.jsonNull, fontStyle: 'italic' },
  vContainer: { color: T.textDim },
  masked: { color: T.warn, fontStyle: 'italic' },
  flag: { color: T.warn, fontSize: 10 },

  copyBtn: { paddingHorizontal: S.sm, paddingVertical: 3 },
  copyGlyph: { color: T.textDim, fontSize: 13 },

  headerPad: { paddingHorizontal: S.md },
  tools: { flexDirection: 'row', gap: S.sm, paddingVertical: S.sm, flexWrap: 'wrap' },
  warn: { color: T.warn, fontSize: 11, paddingTop: S.xs },

  actionBar: {
    borderTopWidth: 1,
    borderTopColor: T.border,
    backgroundColor: T.surfaceAlt,
    paddingHorizontal: S.md,
    paddingVertical: S.sm,
    gap: S.sm,
  },
  actionPath: { color: T.text, fontSize: 11, fontFamily: mono },
  actionBtns: { flexDirection: 'row', gap: S.sm, flexWrap: 'wrap' },
  hint: {
    color: T.textDim,
    fontSize: 10,
    textAlign: 'center',
    paddingVertical: S.sm,
    borderTopWidth: 1,
    borderTopColor: T.border,
  },
});
