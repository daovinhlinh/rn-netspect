import { useSyncExternalStore } from 'react';

import { getNetworkCondition, onNetworkConditionChange } from '../core/networkConditions';
import { store } from '../core/store';
import type { NetspectEntry, NetworkCondition } from '../types';

/** `getSnapshot` returns a stable identity between mutations, so this is strict-mode safe. */
export const useEntries = (): NetspectEntry[] =>
  useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);

/**
 * The active simulation. `setNetworkCondition` replaces the object wholesale, so its
 * identity is stable between changes — the same contract `store.getSnapshot` relies on.
 *
 * Exported for host apps too: this is how you gate something the library cannot reach
 * itself, such as a native WebSocket.
 */
export const useNetworkCondition = (): NetworkCondition =>
  useSyncExternalStore(subscribeCondition, getNetworkCondition, getNetworkCondition);

/** `useSyncExternalStore` hands its subscriber no arguments; the listener takes one. */
const subscribeCondition = (onChange: () => void): (() => void) =>
  onNetworkConditionChange(() => onChange());

export function useEntry(id: string | null): NetspectEntry | undefined {
  const entries = useEntries();
  if (!id) return undefined;
  // Reading through the snapshot (rather than `store.get`) keeps this subscribed to
  // updates, so the detail view live-updates while a request is still pending.
  return entries.find((entry) => entry.id === id);
}
