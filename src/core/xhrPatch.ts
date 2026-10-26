import { getConfig, isIgnoredContentType, isIgnoredUrl } from '../config';
import type { HeaderMap, NetspectEntry, Outcome } from '../types';
import { CORRELATION_HEADER } from './axiosCorrelate';
import { readRequestBody, readResponseBody, readResponseHeaders } from './bodies';
import { nextId, now } from './id';
import { store } from './store';

const MARK = '__netspect_patched__';

type Meta = {
  id: string;
  method: string;
  url: string;
  headers: HeaderMap;
  correlationId?: string;
  t0: number;
  startedAt: number;
  tracked: boolean;
};

/**
 * Keyed off the XHR instance so a request that is dropped before `send` leaves nothing
 * behind, and so we never add an enumerable property to objects the app owns.
 */
const metas = new WeakMap<object, Meta>();

let uninstall: (() => void) | null = null;
let paused = false;

export const isCapturing = (): boolean => uninstall !== null && !paused;
export const pauseCapture = (): void => {
  paused = true;
};
export const resumeCapture = (): void => {
  paused = false;
};

/**
 * Patches `XMLHttpRequest.prototype` in place. Deliberately patches the prototype
 * rather than replacing the global constructor: that preserves `instanceof` and the
 * statics (`XMLHttpRequest.DONE`), composes with other patchers like Reactotron
 * (each captures the previous function), and also covers code that deep-imports
 * `react-native/Libraries/Network/XMLHttpRequest` instead of using the global.
 */
export function installXhrPatch(): () => void {
  if (uninstall) return uninstall;

  const XHR: any = (globalThis as any).XMLHttpRequest;
  if (!XHR?.prototype || XHR.prototype[MARK]) return () => {};

  const originalOpen = XHR.prototype.open;
  const originalSend = XHR.prototype.send;
  const originalSetRequestHeader = XHR.prototype.setRequestHeader;

  XHR.prototype.open = function patchedOpen(method: string, url: string, ...rest: any[]) {
    try {
      metas.set(this, {
        id: nextId(),
        method: String(method ?? 'GET').toUpperCase(),
        url: String(url ?? ''),
        headers: {},
        t0: 0,
        startedAt: 0,
        tracked: false,
      });
    } catch {
      // Never let instrumentation break a real request.
    }
    return originalOpen.call(this, method, url, ...rest);
  };

  XHR.prototype.setRequestHeader = function patchedSetRequestHeader(name: string, value: any) {
    try {
      const meta = metas.get(this);
      if (meta) {
        if (String(name).toLowerCase() === CORRELATION_HEADER) {
          // Record it for grouping, then swallow it — this header must never
          // reach the server.
          meta.correlationId = String(value);
          return;
        }
        // Original casing is kept so generated cURL looks like the real request.
        meta.headers[name] = String(value);
      }
    } catch {
      /* ignore */
    }
    return originalSetRequestHeader.call(this, name, value);
  };

  XHR.prototype.send = function patchedSend(body?: any) {
    try {
      const meta = metas.get(this);
      if (meta && getConfig().enabled && !paused && !isIgnoredUrl(meta.url)) {
        track(this, meta, body);
      }
    } catch {
      /* ignore */
    }
    return originalSend.call(this, body);
  };

  Object.defineProperty(XHR.prototype, MARK, {
    value: true,
    enumerable: false,
    configurable: true,
  });

  uninstall = () => {
    XHR.prototype.open = originalOpen;
    XHR.prototype.send = originalSend;
    XHR.prototype.setRequestHeader = originalSetRequestHeader;
    delete XHR.prototype[MARK];
    uninstall = null;
  };
  return uninstall;
}

export function uninstallXhrPatch(): void {
  uninstall?.();
}

function track(xhr: any, meta: Meta, body: unknown): void {
  const request = readRequestBody(body);

  meta.t0 = now();
  meta.startedAt = Date.now();
  meta.tracked = true;

  const entry: NetspectEntry = {
    id: meta.id,
    correlationId: meta.correlationId,
    method: meta.method,
    url: meta.url,
    requestHeaders: { ...meta.headers },
    requestBody: request.text,
    requestBodyKind: request.kind,
    requestBodyTruncated: request.truncated,
    formParts: request.formParts,
    outcome: 'pending',
    status: 0,
    responseHeaders: {},
    responseBody: null,
    responseBodyKind: 'none',
    responseBodyTruncated: false,
    responseBodyBytes: 0,
    bodyEvicted: false,
    startedAt: meta.startedAt,
    durationMs: 0,
  };
  store.push(entry);

  let outcome: Outcome = 'ok';
  const tag = (value: Outcome) => () => {
    outcome = value;
  };

  // Only terminal events. Subscribing to 'readystatechange' or 'progress' would flip
  // RN's `_incrementalEvents` flag, which changes native->JS bridge traffic for every
  // request in the app — a real performance regression, not just noise.
  xhr.addEventListener('error', tag('error'));
  xhr.addEventListener('timeout', tag('timeout'));
  xhr.addEventListener('abort', tag('cancelled'));

  const finish = () => {
    try {
      xhr.removeEventListener('loadend', finish);
      const responseHeaders = readResponseHeaders(xhr);

      if (isIgnoredContentType(responseHeaders['content-type'] ?? responseHeaders['Content-Type'])) {
        store.update(meta.id, {
          outcome,
          status: xhr.status ?? 0,
          responseHeaders,
          responseBody: null,
          responseBodyKind: 'binary',
          durationMs: Math.round(now() - meta.t0),
        });
        return;
      }

      const response = readResponseBody(xhr, outcome);
      store.update(meta.id, {
        outcome,
        status: xhr.status ?? 0,
        responseHeaders,
        responseUrl: xhr.responseURL,
        responseBody: response.text,
        responseBodyKind: response.kind,
        responseBodyTruncated: response.truncated,
        responseBodyBytes: response.bytes,
        durationMs: Math.round(now() - meta.t0),
      });
    } catch {
      store.update(meta.id, { outcome: 'error', durationMs: Math.round(now() - meta.t0) });
    }
  };
  xhr.addEventListener('loadend', finish);
}
