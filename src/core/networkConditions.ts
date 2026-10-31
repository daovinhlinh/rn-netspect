import { getConfig, isIgnoredUrl } from '../config';
import type { NetworkCondition, NetworkFault, NetworkProfileId, Verdict } from '../types';

/**
 * Named profiles, in the order the panel lists them. Each one is a patch over the current
 * condition rather than a whole condition, so switching profiles leaves `urlFilter` alone —
 * you pick a scope once and then try several conditions against it.
 */
export const PROFILE_PRESETS: Record<
  Exclude<NetworkProfileId, 'custom'>,
  Pick<NetworkCondition, 'latencyMs' | 'failureRate' | 'fault'>
> = {
  online: { latencyMs: 0, failureRate: 0, fault: 'none' },
  offline: { latencyMs: 0, failureRate: 1, fault: 'offline' },
  'slow-3g': { latencyMs: 2000, failureRate: 0, fault: 'none' },
  'fast-3g': { latencyMs: 400, failureRate: 0, fault: 'none' },
  // Fires immediately rather than after a realistic wait: the point is to reach the app's
  // timeout branch, and the latency field is right there if you want the real feel.
  timeout: { latencyMs: 0, failureRate: 1, fault: 'timeout' },
  status: { latencyMs: 0, failureRate: 1, fault: 'status' },
};

export const PROFILE_IDS: NetworkProfileId[] = [
  'online',
  'offline',
  'slow-3g',
  'fast-3g',
  'timeout',
  'status',
  'custom',
];

export const PROFILE_LABELS: Record<NetworkProfileId, string> = {
  online: 'Online',
  offline: 'Offline',
  'slow-3g': 'Slow 3G',
  'fast-3g': 'Fast 3G',
  timeout: 'Timeout',
  status: 'Forced status',
  custom: 'Custom',
};

export const DEFAULT_CONDITION: NetworkCondition = {
  profile: 'online',
  latencyMs: 0,
  failureRate: 0,
  fault: 'none',
  status: 500,
  statusBody: null,
  urlFilter: null,
};

/** Shared because a `Verdict` is only ever read. */
const PASS: Verdict = { action: 'pass' };

/**
 * Editing any of these directly means the named profile no longer describes the state, so
 * the profile flips to `custom`. `urlFilter` is deliberately absent — narrowing the scope
 * of "Offline" leaves it Offline.
 */
const KNOBS = ['latencyMs', 'failureRate', 'fault', 'status', 'statusBody'] as const;

let current: NetworkCondition = { ...DEFAULT_CONDITION };
const listeners = new Set<(condition: NetworkCondition) => void>();

export const getNetworkCondition = (): NetworkCondition => current;

export function setNetworkCondition(patch: Partial<NetworkCondition>): void {
  const preset =
    patch.profile && patch.profile !== 'custom' ? PROFILE_PRESETS[patch.profile] : undefined;

  // Preset first, explicit patch second: `{ profile: 'status', status: 401 }` must take the
  // preset's `fault: 'status'` and the caller's 401.
  const next: NetworkCondition = { ...current, ...preset, ...patch };
  if (patch.profile === undefined && KNOBS.some((key) => key in patch)) {
    next.profile = 'custom';
  }

  current = next;
  for (const listener of listeners) {
    try {
      listener(current);
    } catch {
      // A throwing subscriber must not stop the others, and must never reach the host app.
    }
  }
}

export function onNetworkConditionChange(
  listener: (condition: NetworkCondition) => void,
): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function resetNetworkCondition(): void {
  setNetworkCondition(DEFAULT_CONDITION);
}

/**
 * True only for an *unfiltered* simulated outage. With a URL filter set the device is not
 * offline — one endpoint is — so a host that drops its WebSocket on this would be lying.
 */
export const isGlobalOffline = (): boolean =>
  getConfig().enabled && current.fault === 'offline' && current.failureRate >= 1 && !current.urlFilter;

/**
 * A short label for the overlay badge, or null when nothing is being simulated. Lives here
 * rather than in the panel so the bubble, the top bar, and the export all agree.
 */
export function describeCondition(condition: NetworkCondition): string | null {
  const parts: string[] = [];

  if (condition.fault === 'offline') parts.push('offline');
  else if (condition.fault === 'timeout') parts.push('timeout');
  else if (condition.fault === 'status') parts.push(`HTTP ${condition.status}`);

  if (condition.fault !== 'none' && condition.failureRate < 1) {
    parts.push(`${Math.round(condition.failureRate * 100)}%`);
  }
  if (condition.latencyMs > 0) parts.push(`+${condition.latencyMs}ms`);
  if (parts.length === 0) return null;
  if (condition.urlFilter) parts.push(`· ${condition.urlFilter}`);

  return parts.join(' ');
}

export const isConditionActive = (): boolean =>
  getConfig().enabled && describeCondition(current) !== null;

/**
 * Decides what to do with one request. Pure, with randomness injected, so the
 * probabilistic branch is deterministic under test.
 */
export function decide(url: string, condition: NetworkCondition, rand: () => number): Verdict {
  if (!getConfig().enabled) return PASS;
  if (condition.profile === 'online') return PASS;
  // Never fault Metro's own traffic — breaking the bundler from inside the debug overlay
  // would be a very confusing afternoon.
  if (isIgnoredUrl(url)) return PASS;
  if (condition.urlFilter && !url.includes(condition.urlFilter)) return PASS;

  const delayed: Verdict =
    condition.latencyMs > 0 ? { action: 'delay', ms: condition.latencyMs } : PASS;

  if (condition.fault === 'none') return delayed;
  // `>= 1` short-circuits before consuming randomness, so a deterministic profile stays
  // deterministic no matter what `rand` is.
  if (!(condition.failureRate >= 1 || rand() < condition.failureRate)) return delayed;

  if (condition.fault === 'status') {
    return {
      action: 'respond',
      status: condition.status,
      body: condition.statusBody,
      afterMs: condition.latencyMs,
    };
  }

  // Narrowed to 'offline' | 'timeout' by the two checks above.
  const kind: Exclude<NetworkFault, 'none' | 'status'> = condition.fault;
  return { action: 'fail', kind, afterMs: condition.latencyMs };
}
