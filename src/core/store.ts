import { getConfig } from '../config';
import type { NetspectEntry } from '../types';

/** Newest first. Identity changes only on mutation, so it is safe as a snapshot. */
let entries: NetspectEntry[] = [];
const index = new Map<string, NetspectEntry>();
const listeners = new Set<() => void>();

let bodyBudget = 0;
let flushQueued = false;

/**
 * A login flow fires half a dozen requests in one tick, each producing a start and a
 * finish. Without coalescing that is a dozen renders of the list for one user action.
 */
function emit(): void {
  if (flushQueued) return;
  flushQueued = true;
  setTimeout(() => {
    flushQueued = false;
    for (const listener of listeners) {
      try {
        listener();
      } catch {
        // A throwing subscriber must not stop the others, and must never reach the host app.
      }
    }
  }, 0);
}

function bodyLength(entry: NetspectEntry): number {
  return (entry.requestBody?.length ?? 0) + (entry.responseBody?.length ?? 0);
}

/**
 * Drops the oldest retained bodies until we are back under the ceiling. Metadata
 * (method, url, status, timing) is never evicted, so the list stays navigable even
 * after a heavy session — only the payloads go.
 */
function evictBodies(protectedId: string): void {
  const { maxTotalBodyBytes } = getConfig();
  for (let i = entries.length - 1; i >= 0 && bodyBudget > maxTotalBodyBytes; i--) {
    const entry = entries[i];
    if (!entry || entry.id === protectedId || entry.bodyEvicted) continue;
    const freed = bodyLength(entry);
    if (freed === 0) continue;
    const evicted: NetspectEntry = { ...entry, requestBody: null, responseBody: null, bodyEvicted: true };
    entries[i] = evicted;
    index.set(evicted.id, evicted);
    bodyBudget -= freed;
  }
}

export const store = {
  subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },

  /** Stable identity between mutations — required by `useSyncExternalStore`. */
  getSnapshot(): NetspectEntry[] {
    return entries;
  },

  get(id: string): NetspectEntry | undefined {
    return index.get(id);
  },

  push(entry: NetspectEntry): void {
    const next = [entry, ...entries];
    if (next.length > getConfig().maxEntries) {
      for (const dropped of next.splice(getConfig().maxEntries)) {
        index.delete(dropped.id);
        bodyBudget -= bodyLength(dropped);
      }
    }
    entries = next;
    index.set(entry.id, entry);
    bodyBudget += bodyLength(entry);
    emit();
  },

  update(id: string, patch: Partial<NetspectEntry>): void {
    const prev = index.get(id);
    if (!prev) return;
    const at = entries.indexOf(prev);
    if (at < 0) return; // Already rotated out of the ring buffer.

    const updated: NetspectEntry = { ...prev, ...patch };
    bodyBudget += bodyLength(updated) - bodyLength(prev);

    entries = entries.slice();
    entries[at] = updated;
    index.set(id, updated);

    evictBodies(id);
    emit();
  },

  clear(): void {
    entries = [];
    index.clear();
    bodyBudget = 0;
    emit();
  },

  /** Diagnostics for the settings panel. */
  stats(): { count: number; bodyBytes: number } {
    return { count: entries.length, bodyBytes: bodyBudget };
  },
};
