import { prettyJson } from '../core/bodies';
import { viewBody, viewHeaders } from '../core/redact';
import { collectInfo } from '../info/collect';
import type { HeaderMap, NetspectEntry } from '../types';
import { toCurl } from './curl';

const headerBlock = (headers: HeaderMap, reveal: boolean): string =>
  Object.entries(viewHeaders(headers, reveal))
    .map(([name, value]) => `  ${name}: ${value}`)
    .join('\n') || '  (none)';

export const statusLabel = (entry: NetspectEntry): string => {
  switch (entry.outcome) {
    case 'pending':
      return '···';
    case 'error':
      return 'ERR';
    case 'timeout':
      return 'TMO';
    case 'cancelled':
      return 'CNX';
    default:
      return String(entry.status || '—');
  }
};

export function toEntryText(entry: NetspectEntry, opts: { reveal?: boolean } = {}): string {
  const reveal = opts.reveal ?? false;
  const lines: string[] = [
    `${entry.method} ${entry.url}`,
    `${statusLabel(entry)} · ${entry.durationMs}ms · ${new Date(entry.startedAt).toISOString()}`,
  ];
  if (entry.correlationId) lines.push(`correlation: ${entry.correlationId}`);
  lines.push('', 'REQUEST HEADERS', headerBlock(entry.requestHeaders, reveal));
  if (entry.requestBody) {
    lines.push('', 'REQUEST BODY', prettyJson(viewBody(entry.requestBody, reveal)));
    if (entry.requestBodyTruncated) lines.push('[truncated]');
  }
  lines.push('', 'RESPONSE HEADERS', headerBlock(entry.responseHeaders, reveal));
  if (entry.bodyEvicted) {
    lines.push('', 'RESPONSE BODY', '[evicted to stay under the memory budget]');
  } else if (entry.responseBody) {
    lines.push('', 'RESPONSE BODY', prettyJson(viewBody(entry.responseBody, reveal)));
    if (entry.responseBodyTruncated) {
      lines.push(`[truncated — ${entry.responseBodyBytes} chars total]`);
    }
  }
  lines.push('', 'CURL', toCurl(entry, opts));
  return lines.join('\n');
}

export function toSessionText(entries: NetspectEntry[], opts: { reveal?: boolean } = {}): string {
  const info = collectInfo()
    .map((section) => `${section.title}\n${section.rows.map(([k, v]) => `  ${k}: ${v}`).join('\n')}`)
    .join('\n\n');

  const body = entries
    .slice()
    .reverse() // Oldest first reads chronologically in a report.
    .map((entry, i) => `${'='.repeat(70)}\n#${i + 1}\n${toEntryText(entry, opts)}`)
    .join('\n\n');

  return [
    `rn-netspect session · ${new Date().toISOString()}`,
    `${entries.length} request(s)`,
    '',
    info,
    '',
    body,
  ].join('\n');
}
