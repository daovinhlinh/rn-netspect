import { useSyncExternalStore } from 'react';

import { store } from '../core/store';
import type { NetspectEntry } from '../types';

/** `getSnapshot` returns a stable identity between mutations, so this is strict-mode safe. */
export const useEntries = (): NetspectEntry[] =>
  useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);

export function useEntry(id: string | null): NetspectEntry | undefined {
  const entries = useEntries();
  if (!id) return undefined;
  // Reading through the snapshot (rather than `store.get`) keeps this subscribed to
  // updates, so the detail view live-updates while a request is still pending.
  return entries.find((entry) => entry.id === id);
}
