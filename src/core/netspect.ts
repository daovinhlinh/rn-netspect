import { getConfig, setConfig } from '../config';
import type { ManualEntry, NetspectConfig, NetspectEntry } from '../types';
import { attachAxios, type AxiosInstanceLike } from './axiosCorrelate';
import { nextId } from './id';
import { store } from './store';
import { installXhrPatch, pauseCapture, resumeCapture, uninstallXhrPatch } from './xhrPatch';

/**
 * Installs the XHR patch. Idempotent, and a no-op when `enabled` is false, so the host
 * can call it unconditionally at startup.
 */
function init(config: Partial<NetspectConfig> = {}): void {
  setConfig(config);
  if (!getConfig().enabled) return;
  installXhrPatch();
}

/**
 * Records a request the XHR patch cannot see — anything using native networking
 * (`react-native-blob-util`, `ReactNativeBlobUtil`, a native SDK).
 */
function record(manual: ManualEntry): void {
  if (!getConfig().enabled) return;
  const entry: NetspectEntry = {
    id: nextId(),
    method: manual.method.toUpperCase(),
    url: manual.url,
    requestHeaders: { ...(manual.requestHeaders ?? {}) },
    requestBody: manual.requestBody ?? null,
    requestBodyKind: manual.requestBody ? 'text' : 'none',
    requestBodyTruncated: false,
    outcome: manual.outcome ?? 'ok',
    status: manual.status ?? 0,
    responseHeaders: manual.responseHeaders ?? {},
    responseBody: manual.responseBody ?? null,
    responseBodyKind: manual.responseBody ? 'text' : 'none',
    responseBodyTruncated: false,
    responseBodyBytes: manual.responseBody?.length ?? 0,
    bodyEvicted: false,
    startedAt: Date.now() - (manual.durationMs ?? 0),
    durationMs: manual.durationMs ?? 0,
  };
  store.push(entry);
}

export const Netspect = {
  init,
  record,
  attachAxios: (instance: AxiosInstanceLike) => attachAxios(instance),
  configure: (config: Partial<NetspectConfig>) => setConfig(config),
  /** Pause/resume capture without removing the patch. */
  pause: pauseCapture,
  resume: resumeCapture,
  clear: () => store.clear(),
  getEntries: (): NetspectEntry[] => store.getSnapshot(),
  stats: () => store.stats(),
  /** Restores the original prototype methods. Mainly for tests. */
  uninstall: uninstallXhrPatch,
};
