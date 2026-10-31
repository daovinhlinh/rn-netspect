import { VERSION } from '../config';
import { viewBody, viewHeaders } from '../core/redact';
import { collectInfo } from '../info/collect';
import type { HeaderMap, NetspectEntry } from '../types';

const toNameValue = (headers: HeaderMap, reveal: boolean) =>
  Object.entries(viewHeaders(headers, reveal)).map(([name, value]) => ({ name, value }));

/**
 * HAR 1.2. Lossy by necessity — we have no per-phase timings and bodies may be
 * truncated or evicted — but valid enough for any HAR viewer to open.
 */
export function toHar(entries: NetspectEntry[], opts: { reveal?: boolean } = {}): string {
  const reveal = opts.reveal ?? false;
  const comment = collectInfo()
    .map((s) => `${s.title}: ${s.rows.map(([k, v]) => `${k}=${v}`).join(', ')}`)
    .join(' | ');

  return JSON.stringify(
    {
      log: {
        version: '1.2',
        creator: { name: 'rn-netspect', version: VERSION },
        comment: entries.some((entry) => entry.simulated)
          ? `${comment} | WARNING: some entries were simulated by rn-netspect, not real network behaviour`
          : comment,
        entries: entries
          .slice()
          .reverse()
          .map((entry) => {
            const query = (() => {
              const at = entry.url.indexOf('?');
              if (at < 0) return [];
              return entry.url
                .slice(at + 1)
                .split('&')
                .filter(Boolean)
                .map((pair) => {
                  const eq = pair.indexOf('=');
                  return eq < 0
                    ? { name: pair, value: '' }
                    : { name: pair.slice(0, eq), value: decodeURIComponent(pair.slice(eq + 1)) };
                });
            })();

            return {
              startedDateTime: new Date(entry.startedAt).toISOString(),
              time: entry.durationMs,
              request: {
                method: entry.method,
                url: entry.url,
                httpVersion: 'HTTP/1.1',
                cookies: [],
                headers: toNameValue(entry.requestHeaders, reveal),
                queryString: query,
                headersSize: -1,
                bodySize: entry.requestBody?.length ?? 0,
                ...(entry.requestBody
                  ? {
                      postData: {
                        mimeType: entry.requestHeaders['Content-Type'] ?? 'application/json',
                        text: viewBody(entry.requestBody, reveal) ?? '',
                      },
                    }
                  : {}),
              },
              response: {
                status: entry.status,
                statusText: entry.outcome === 'ok' ? '' : entry.outcome.toUpperCase(),
                httpVersion: 'HTTP/1.1',
                cookies: [],
                headers: toNameValue(entry.responseHeaders, reveal),
                content: {
                  size: entry.responseBodyBytes,
                  mimeType: entry.responseHeaders['content-type'] ?? 'application/json',
                  text: viewBody(entry.responseBody, reveal) ?? '',
                },
                redirectURL: '',
                headersSize: -1,
                bodySize: entry.responseBodyBytes,
              },
              cache: {},
              timings: { send: -1, wait: -1, receive: -1 },
              ...(entry.correlationId ? { _netspectCorrelation: entry.correlationId } : {}),
              ...(entry.responseBodyTruncated ? { _netspectTruncated: true } : {}),
              ...(entry.bodyEvicted ? { _netspectEvicted: true } : {}),
              // `comment` rather than only a `_netspect*` field: HAR viewers render it,
              // whereas custom underscore keys are usually hidden.
              ...(entry.simulated
                ? {
                    comment: `SIMULATED BY RN-NETSPECT (${entry.simulated}) — not real network behaviour`,
                    _netspectSimulated: entry.simulated,
                  }
                : {}),
            };
          }),
      },
    },
    null,
    2,
  );
}
