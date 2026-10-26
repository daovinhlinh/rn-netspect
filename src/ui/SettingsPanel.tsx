import React from 'react';
import { ScrollView, StyleSheet, Switch, Text, View } from 'react-native';

import { getConfig, setConfig } from '../config';
import { Netspect } from '../core/netspect';
import { exportSession } from '../export/session';
import { Btn, KV, SectionTitle } from './parts/primitives';
import { S, T } from './theme';

export function SettingsPanel({
  reveal,
  onRevealChange,
  capturing,
  onCapturingChange,
  onToast,
}: {
  reveal: boolean;
  onRevealChange: (next: boolean) => void;
  capturing: boolean;
  onCapturingChange: (next: boolean) => void;
  onToast: (message: string) => void;
}) {
  const config = getConfig();
  const stats = Netspect.stats();

  const run = async (format: 'text' | 'har') => {
    const result = await exportSession(format, { reveal });
    onToast(result.message);
  };

  return (
    <ScrollView contentContainerStyle={styles.body}>
      <SectionTitle>Capture</SectionTitle>
      <Toggle
        label="Capturing"
        hint="Pauses recording without removing the interceptor."
        value={capturing}
        onChange={(next) => {
          if (next) Netspect.resume();
          else Netspect.pause();
          onCapturingChange(next);
        }}
      />
      <Toggle
        label="Capture bodies"
        hint="Turn off on screens that stream large payloads."
        value={config.captureBodies}
        onChange={(next) => {
          setConfig({ captureBodies: next });
          onToast(next ? 'Bodies on' : 'Bodies off');
        }}
      />
      <Toggle
        label="Reveal secrets"
        hint="Unmasks tokens so copied cURL commands actually run. In-memory only — resets when the app restarts."
        value={reveal}
        onChange={onRevealChange}
      />

      <View style={styles.gap} />
      <SectionTitle>Session</SectionTitle>
      <KV
        rows={[
          ['entries', `${stats.count} / ${config.maxEntries}`],
          ['retained bodies', `${(stats.bodyBytes / 1024).toFixed(1)} KB / ${(config.maxTotalBodyBytes / 1024 / 1024).toFixed(0)} MB`],
          ['per-body cap', `${(config.maxBodyBytes / 1024).toFixed(0)} KB`],
        ]}
      />
      <View style={styles.actions}>
        <Btn label="Export report" onPress={() => run('text')} tone="accent" />
        <Btn label="Export HAR" onPress={() => run('har')} tone="accent" />
        <Btn
          label="Clear"
          tone="danger"
          onPress={() => {
            Netspect.clear();
            onToast('Cleared');
          }}
        />
      </View>

      <View style={styles.gap} />
      <SectionTitle>Not captured</SectionTitle>
      <Text style={styles.note}>
        Requests made by native code never reach JavaScript, so they cannot appear here:
        file downloads via blob-util or similar, WebSocket frames, map tiles, push
        messaging, and native image loading. Use {'Netspect.record()'} from the host app to
        log those manually.
      </Text>
    </ScrollView>
  );
}

function Toggle({
  label,
  hint,
  value,
  onChange,
}: {
  label: string;
  hint: string;
  value: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <View style={styles.toggle}>
      <View style={styles.toggleText}>
        <Text style={styles.toggleLabel}>{label}</Text>
        <Text style={styles.toggleHint}>{hint}</Text>
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ false: T.border, true: T.accent }}
        thumbColor={T.text}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  body: { padding: S.md, paddingBottom: S.xl },
  gap: { height: S.xl },
  toggle: { flexDirection: 'row', alignItems: 'center', gap: S.md, paddingVertical: S.sm },
  toggleText: { flex: 1, gap: 2 },
  toggleLabel: { color: T.text, fontSize: 14, fontWeight: '600' },
  toggleHint: { color: T.textDim, fontSize: 11, lineHeight: 15 },
  actions: { flexDirection: 'row', gap: S.sm, marginTop: S.lg, flexWrap: 'wrap' },
  note: { color: T.textDim, fontSize: 11, lineHeight: 16 },
});
