import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { getConfig } from '../config';
import { describeCondition } from '../core/networkConditions';
import { isCapturing } from '../core/xhrPatch';
import { FloatingBubble } from './FloatingBubble';
import { InfoPanel } from './InfoPanel';
import { NetworkConditionsPanel } from './NetworkConditionsPanel';
import { Btn, Segmented } from './parts/primitives';
import { RequestDetail } from './RequestDetail';
import { RequestList } from './RequestList';
import { SettingsPanel } from './SettingsPanel';
import { S, T } from './theme';
import { useEntries, useEntry, useNetworkCondition } from './useNetspect';

const TABS = ['Network', 'Simulate', 'Info', 'Settings'] as const;
type Tab = (typeof TABS)[number];

/**
 * The single component a host app renders. Mount it last in the tree so it paints above
 * the navigator; it renders nothing at all when `enabled` is false.
 */
export function NetspectOverlay() {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<Tab>('Network');
  const [selected, setSelected] = useState<string | null>(null);
  const [reveal, setReveal] = useState(false);
  const [capturing, setCapturing] = useState(isCapturing);
  const [toast, setToast] = useState<string | null>(null);

  const entries = useEntries();
  const entry = useEntry(selected);
  const condition = useNetworkCondition();
  // A forgotten simulation looks exactly like a real bug, so it is surfaced on the bubble
  // and in the top bar rather than only on the tab that set it.
  const simulating = describeCondition(condition);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((message: string) => {
    setToast(message);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2200);
  }, []);

  useEffect(
    () => () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
    },
    [],
  );

  // `enabled` is read at render so a host can flip it before first mount; it is not
  // expected to change at runtime.
  if (!getConfig().enabled) return null;

  return (
    <>
      <FloatingBubble
        count={entries.length}
        alert={simulating !== null}
        onPress={() => setOpen(true)}
      />

      <Modal
        visible={open}
        animationType="slide"
        transparent
        onRequestClose={() => setOpen(false)}
        statusBarTranslucent
        // Lets the sheet grow to full height on iOS instead of being letterboxed.
        presentationStyle="overFullScreen"
      >
        <View style={styles.backdrop}>
          <Pressable style={styles.dismissArea} onPress={() => setOpen(false)} />

          <View style={styles.sheet}>
            <View style={styles.grabber} />

            <View style={styles.topBar}>
              <Text style={styles.title}>netspect</Text>
              {!capturing && <Text style={styles.paused}>paused</Text>}
              {simulating && (
                <Text style={styles.simulating} numberOfLines={1}>
                  ⚡ {simulating}
                </Text>
              )}
              <View style={styles.topBarRight}>
                <Btn label="Close" onPress={() => setOpen(false)} />
              </View>
            </View>

            {/* Kept mounted (just hidden) behind the detail view, so switching back
                preserves RequestList's scroll position instead of remounting it. */}
            <View style={[styles.flexFill, selected && entry ? styles.hidden : null]}>
              <View style={styles.tabs}>
                <Segmented
                  tabs={TABS}
                  value={tab}
                  onChange={(next) => {
                    setTab(next);
                    setSelected(null);
                  }}
                />
              </View>

              {tab === 'Network' && <RequestList entries={entries} onSelect={setSelected} />}
              {tab === 'Simulate' && <NetworkConditionsPanel onToast={showToast} />}
              {tab === 'Info' && <InfoPanel />}
              {tab === 'Settings' && (
                <SettingsPanel
                  reveal={reveal}
                  onRevealChange={setReveal}
                  capturing={capturing}
                  onCapturingChange={setCapturing}
                  onToast={showToast}
                />
              )}
            </View>

            {selected && entry && (
              <RequestDetail
                entry={entry}
                reveal={reveal}
                onBack={() => setSelected(null)}
                onToast={showToast}
              />
            )}

            {toast && (
              <View style={styles.toast} pointerEvents="none">
                <Text style={styles.toastLabel}>{toast}</Text>
              </View>
            )}
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: T.overlay, justifyContent: 'flex-end' },
  // A tap above the sheet dismisses it, matching the bottom-sheet idiom.
  dismissArea: { height: 56 },
  sheet: {
    flex: 1,
    backgroundColor: T.surface,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    borderTopWidth: 1,
    borderColor: T.border,
    overflow: 'hidden',
    // Leaves the home indicator / nav bar reachable without a safe-area dependency.
    paddingBottom: Platform.OS === 'ios' ? 24 : 8,
  },
  grabber: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: T.border,
    marginTop: S.sm,
    marginBottom: S.xs,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: S.sm,
    paddingHorizontal: S.md,
    paddingVertical: S.sm,
  },
  title: { color: T.text, fontSize: 15, fontWeight: '800', letterSpacing: 0.5 },
  paused: { color: T.warn, fontSize: 11, fontWeight: '700' },
  // flexShrink so a long URL filter is ellipsised rather than pushing Close off-screen.
  simulating: { color: T.warn, fontSize: 11, fontWeight: '700', flexShrink: 1 },
  topBarRight: { marginLeft: 'auto' },
  tabs: { paddingHorizontal: S.md, paddingBottom: S.md },
  flexFill: { flex: 1 },
  hidden: { display: 'none' },

  toast: {
    position: 'absolute',
    left: S.lg,
    right: S.lg,
    bottom: S.xl,
    backgroundColor: T.bg,
    borderWidth: 1,
    borderColor: T.accent,
    borderRadius: 8,
    paddingHorizontal: S.md,
    paddingVertical: S.sm,
  },
  toastLabel: { color: T.text, fontSize: 12, textAlign: 'center' },
});
