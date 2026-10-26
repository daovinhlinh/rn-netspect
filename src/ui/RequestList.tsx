import React, { useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import { matchEntry, type MatchField } from '../core/search';
import { statusLabel } from '../export/text';
import type { NetspectEntry } from '../types';
import { Chip, SearchInput } from './parts/primitives';
import { S, statusColor, T } from './theme';

type Filter = 'all' | 'errors' | 'pending';
const FILTERS: Array<{ key: Filter; label: string }> = [
  { key: 'all', label: 'All' },
  { key: 'errors', label: 'Errors' },
  { key: 'pending', label: 'In flight' },
];

const isError = (entry: NetspectEntry) =>
  entry.outcome === 'error' ||
  entry.outcome === 'timeout' ||
  (entry.outcome === 'ok' && entry.status >= 400);


function shortPath(url: string): string {
  // Strip scheme + host so the path (what you actually scan for) leads the row.
  const withoutScheme = url.replace(/^[a-z]+:\/\//i, '');
  const slash = withoutScheme.indexOf('/');
  return slash < 0 ? `/${withoutScheme}` : withoutScheme.slice(slash);
}

function Row({
  entry,
  onPress,
  attempt,
  match,
}: {
  entry: NetspectEntry;
  onPress: () => void;
  attempt?: string;
  match?: MatchField;
}) {
  const color = statusColor(entry.status, entry.outcome);
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}>
      <View style={[styles.status, { borderColor: color }]}>
        <Text style={[styles.statusLabel, { color }]} numberOfLines={1}>
          {statusLabel(entry)}
        </Text>
      </View>
      <View style={styles.rowBody}>
        <View style={styles.rowTop}>
          <Text style={styles.method}>{entry.method}</Text>
          <Text style={styles.path} numberOfLines={1} ellipsizeMode="head">
            {shortPath(entry.url)}
          </Text>
        </View>
        <Text style={styles.meta} numberOfLines={1}>
          {entry.outcome === 'pending' ? 'in flight' : `${entry.durationMs}ms`}
          {entry.responseBodyBytes > 0 ? ` · ${formatBytes(entry.responseBodyBytes)}` : ''}
          {attempt ? ` · ${attempt}` : ''}
          {entry.bodyEvicted ? ' · body evicted' : ''}
          {/* Without this, a body/param hit looks like an unrelated row. */}
          {match && match !== 'url' ? <Text style={styles.match}> · matched {match}</Text> : null}
        </Text>
      </View>
    </Pressable>
  );
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n}B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)}KB`;
  return `${(n / 1024 / 1024).toFixed(1)}MB`;
}

export function RequestList({
  entries,
  onSelect,
}: {
  entries: NetspectEntry[];
  onSelect: (id: string) => void;
}) {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');

  /** Counts attempts per correlation group so retries can be badged in the row. */
  const attempts = useMemo(() => {
    const groups = new Map<string, string[]>();
    // Oldest first, so attempt 1 really is the first attempt.
    for (let i = entries.length - 1; i >= 0; i--) {
      const entry = entries[i];
      if (!entry?.correlationId) continue;
      const ids = groups.get(entry.correlationId) ?? [];
      ids.push(entry.id);
      groups.set(entry.correlationId, ids);
    }
    const labels = new Map<string, string>();
    for (const ids of groups.values()) {
      if (ids.length < 2) continue;
      ids.forEach((id, i) => labels.set(id, `attempt ${i + 1}/${ids.length}`));
    }
    return labels;
  }, [entries]);

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const out: Array<{ entry: NetspectEntry; match: MatchField }> = [];
    for (const entry of entries) {
      if (filter === 'errors' && !isError(entry)) continue;
      if (filter === 'pending' && entry.outcome !== 'pending') continue;
      const match = matchEntry(entry, needle);
      if (match === 'none') continue;
      out.push({ entry, match });
    }
    return out;
  }, [entries, query, filter]);

  return (
    <View style={styles.container}>
      <View style={styles.controls}>
        <SearchInput
          value={query}
          onChangeText={setQuery}
          placeholder="Filter by URL, params, status, body…"
        />
        <View style={styles.chips}>
          {FILTERS.map(({ key, label }) => (
            <Chip key={key} label={label} active={filter === key} onPress={() => setFilter(key)} />
          ))}
          <Text style={styles.count}>
            {visible.length}/{entries.length}
          </Text>
        </View>
      </View>

      <FlatList
        data={visible}
        keyExtractor={(item) => item.entry.id}
        renderItem={({ item }) => (
          <Row
            entry={item.entry}
            match={item.match}
            attempt={attempts.get(item.entry.id)}
            onPress={() => onSelect(item.entry.id)}
          />
        )}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListEmptyComponent={
          <Text style={styles.empty}>
            {entries.length === 0
              ? 'No requests captured yet. Use the app and they will appear here.'
              : 'Nothing matches this filter.'}
          </Text>
        }
        contentContainerStyle={visible.length === 0 ? styles.emptyContainer : undefined}
        keyboardShouldPersistTaps="handled"
        initialNumToRender={14}
        windowSize={7}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  controls: { paddingHorizontal: S.md, paddingBottom: S.sm, gap: S.sm },
  chips: { flexDirection: 'row', alignItems: 'center', gap: S.sm },
  count: { marginLeft: 'auto', color: T.textDim, fontSize: 11 },

  row: { flexDirection: 'row', paddingHorizontal: S.md, paddingVertical: S.sm, gap: S.md },
  rowPressed: { backgroundColor: T.surfaceAlt },
  status: {
    width: 46,
    borderWidth: 1,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 3,
  },
  statusLabel: { fontSize: 12, fontWeight: '700' },
  rowBody: { flex: 1, gap: 2 },
  rowTop: { flexDirection: 'row', alignItems: 'center', gap: S.sm },
  method: { color: T.accent, fontSize: 11, fontWeight: '800' },
  path: { color: T.text, fontSize: 13, flex: 1 },
  meta: { color: T.textDim, fontSize: 11 },
  match: { color: T.accent },

  separator: { height: StyleSheet.hairlineWidth, backgroundColor: T.border, marginLeft: S.md + 46 },
  empty: { color: T.textDim, fontSize: 13, textAlign: 'center', paddingHorizontal: S.xl },
  emptyContainer: { flexGrow: 1, justifyContent: 'center' },
});
