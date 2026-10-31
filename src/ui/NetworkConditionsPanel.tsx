import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import {
  describeCondition,
  PROFILE_IDS,
  PROFILE_LABELS,
  PROFILE_PRESETS,
  setNetworkCondition,
} from '../core/networkConditions';
import type { NetworkProfileId } from '../types';
import { Btn, NumField, RadioRow, SectionTitle, TextField } from './parts/primitives';
import { S, T } from './theme';
import { useNetworkCondition } from './useNetspect';

/** The statuses worth one tap. Each maps to a branch in a typical axios error handler. */
const QUICK_STATUSES = [400, 401, 403, 429, 500, 503];

const HINTS: Record<NetworkProfileId, string> = {
  online: 'No interference.',
  offline: 'Fails immediately with a network error — no request is sent.',
  'slow-3g': 'Real request, delayed 2000ms.',
  'fast-3g': 'Real request, delayed 400ms.',
  timeout: 'Fires the timeout event, which is a different error class to offline.',
  status: 'Returns a synthetic response with the status below.',
  custom: 'Set latency and failure rate by hand.',
};

export function NetworkConditionsPanel({ onToast }: { onToast: (message: string) => void }) {
  const condition = useNetworkCondition();
  const active = describeCondition(condition);
  const showsStatus = condition.fault === 'status';
  const showsRate = condition.fault !== 'none';

  return (
    <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
      <View style={[styles.banner, active ? styles.bannerOn : styles.bannerOff]}>
        <Text style={[styles.bannerLabel, active ? styles.bannerLabelOn : null]}>
          {active ? `Simulating ${active}` : 'Not simulating — traffic is untouched'}
        </Text>
      </View>

      <SectionTitle>Profile</SectionTitle>
      {PROFILE_IDS.map((id) => (
        <RadioRow
          key={id}
          label={PROFILE_LABELS[id]}
          hint={HINTS[id]}
          selected={condition.profile === id}
          onPress={() => {
            setNetworkCondition(
              // 'custom' has no preset — it keeps whatever is set and just stops pretending
              // a named profile describes it. Give it the current values so the switch is
              // visually a no-op rather than a reset to zero.
              id === 'custom' ? { profile: 'custom' } : { profile: id, ...PROFILE_PRESETS[id] },
            );
            onToast(id === 'online' ? 'Simulation off' : `${PROFILE_LABELS[id]} on`);
          }}
        />
      ))}

      <View style={styles.gap} />
      <SectionTitle>Tuning</SectionTitle>
      <NumField
        label="Latency"
        value={condition.latencyMs}
        suffix="ms"
        onCommit={(latencyMs) => setNetworkCondition({ latencyMs })}
      />
      {showsRate && (
        <NumField
          label="Failure rate"
          value={Math.round(condition.failureRate * 100)}
          suffix="%"
          onCommit={(percent) =>
            setNetworkCondition({ failureRate: Math.min(100, percent) / 100 })
          }
        />
      )}
      {showsStatus && (
        <>
          <NumField
            label="Status"
            value={condition.status}
            onCommit={(status) => setNetworkCondition({ status })}
          />
          <View style={styles.quick}>
            {QUICK_STATUSES.map((status) => (
              <Btn
                key={status}
                label={String(status)}
                tone={condition.status === status ? 'accent' : 'default'}
                onPress={() => setNetworkCondition({ profile: 'status', status })}
              />
            ))}
          </View>
        </>
      )}

      <View style={styles.gap} />
      <SectionTitle>Scope</SectionTitle>
      <TextField
        label="URL contains"
        value={condition.urlFilter ?? ''}
        placeholder="every request"
        onChangeText={(text) => setNetworkCondition({ urlFilter: text.trim() || null })}
      />
      <Text style={styles.note}>
        Leave blank to affect everything. Narrowing to one path — {'/v1/stations'} — is
        usually what you want: a global outage also breaks token refresh, so you cannot reach
        the screen you meant to test. Metro{"'"}s own traffic is never affected.
      </Text>

      <View style={styles.actions}>
        <Btn
          label="Stop simulating"
          tone="danger"
          disabled={!active}
          onPress={() => {
            setNetworkCondition({ profile: 'online', ...PROFILE_PRESETS.online });
            onToast('Simulation off');
          }}
        />
      </View>

      <View style={styles.gap} />
      <SectionTitle>Notes</SectionTitle>
      <Text style={styles.note}>
        Faulted requests still appear in the log, badged {'SIM'}, and retries of one logical
        call stay grouped by correlation id — so a single tap that fans out into several
        attempts reads as one story.
        {'\n\n'}
        Latency delays the request on its way out, which means it cannot trip a client-side
        timeout: that clock starts when the request actually leaves. Use the Timeout profile
        for that path.
        {'\n\n'}
        Nothing here survives an app restart, and WebSocket traffic is native — it is
        unaffected unless the host app subscribes to{' '}
        {'Netspect.onNetworkConditionChange()'} and drops its own connection.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  body: { padding: S.md, paddingBottom: S.xl },
  gap: { height: S.xl },

  banner: { borderRadius: 8, borderWidth: 1, padding: S.md, marginBottom: S.lg },
  bannerOff: { borderColor: T.border, backgroundColor: T.surfaceAlt },
  bannerOn: { borderColor: T.warn, backgroundColor: T.surfaceAlt },
  bannerLabel: { color: T.textDim, fontSize: 12, fontWeight: '600' },
  bannerLabelOn: { color: T.warn },

  quick: { flexDirection: 'row', gap: S.sm, flexWrap: 'wrap', paddingTop: S.sm },
  actions: { flexDirection: 'row', gap: S.sm, marginTop: S.lg, flexWrap: 'wrap' },
  note: { color: T.textDim, fontSize: 11, lineHeight: 16, paddingTop: S.xs },
});
