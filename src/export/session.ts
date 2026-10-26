// `Clipboard` from the root logs a one-time deprecation warning (`react-native/index.js`
// suggests `@react-native-clipboard/clipboard`). Deep-importing the module skips the
// warning, but its `.d.ts` declares no default export, so a consuming app's tsconfig
// cannot typecheck it without seeing this package's internal shims. The root import is
// the portable choice; the warning is cosmetic and stripped from production bundles.
// Swap in `@react-native-clipboard/clipboard` here if it is ever removed from core.
import { Clipboard, Share } from 'react-native';

import { getConfig } from '../config';
import { prettyJson } from '../core/bodies';
import { viewBody } from '../core/redact';
import { store } from '../core/store';
import type { NetspectEntry } from '../types';
import { toCurl } from './curl';
import { toHar } from './har';
import { toEntryText, toSessionText } from './text';

export type ExportFormat = 'text' | 'har' | 'curl';
export type ExportResult = { ok: boolean; message: string };

/**
 * Android's binder transaction limit makes `Share` throw TransactionTooLargeException
 * well before 1 MB, so anything big goes to a file (when a filesystem adapter is
 * installed) and falls back to the clipboard otherwise.
 */
const SHARE_LIMIT = 400 * 1024;

const stamp = () => new Date().toISOString().replace(/[:.]/g, '-');

async function copy(text: string): Promise<ExportResult> {
  const sink = getConfig().sinks.copy ?? ((value: string) => Clipboard.setString(value));
  await sink(text);
  return { ok: true, message: `Copied ${text.length.toLocaleString()} chars` };
}

async function deliver(text: string, filename: string): Promise<ExportResult> {
  const { sinks } = getConfig();

  if (text.length > SHARE_LIMIT && sinks.writeFile) {
    const path = await sinks.writeFile(text, filename);
    return { ok: true, message: `Saved to ${path}` };
  }

  if (text.length > SHARE_LIMIT) {
    const result = await copy(text);
    return { ok: result.ok, message: `${result.message} (too large to share)` };
  }

  const share = sinks.share ?? ((value: string) => Share.share({ message: value }));
  try {
    await share(text, filename);
    return { ok: true, message: 'Shared' };
  } catch (error) {
    // A user dismissing the share sheet lands here too; fall back rather than
    // reporting a failure they caused on purpose.
    const result = await copy(text);
    return { ok: result.ok, message: `${result.message} (share unavailable: ${String(error)})` };
  }
}

/**
 * Copies arbitrary text through the host's configured sink. Exists so the JSON tree can
 * copy one node without re-implementing the `sinks.copy ?? Clipboard` fallback above.
 * `message` is overridable because a partial copy wants to name what it copied.
 */
export async function copyToClipboard(text: string, message?: string): Promise<ExportResult> {
  const result = await copy(text);
  return message ? { ok: result.ok, message } : result;
}

export async function exportEntry(
  entry: NetspectEntry,
  format: ExportFormat,
  opts: { reveal?: boolean } = {},
): Promise<ExportResult> {
  if (format === 'curl') return copy(toCurl(entry, opts));
  if (format === 'har') return deliver(toHar([entry], opts), `netspect-${stamp()}.har`);
  return copy(toEntryText(entry, opts));
}

/**
 * Copies just one body, pretty-printed. The common case is grabbing a response payload
 * to paste into a ticket or a JSON viewer, without the surrounding report.
 */
export async function exportBody(
  entry: NetspectEntry,
  which: 'request' | 'response',
  opts: { reveal?: boolean } = {},
): Promise<ExportResult> {
  if (which === 'response' && entry.bodyEvicted) {
    return { ok: false, message: 'Body was evicted to stay under the memory budget' };
  }
  const raw = which === 'request' ? entry.requestBody : entry.responseBody;
  if (!raw) return { ok: false, message: `No ${which} body` };

  const text = prettyJson(viewBody(raw, opts.reveal ?? false));
  const result = await copy(text);
  const truncated = which === 'request' ? entry.requestBodyTruncated : entry.responseBodyTruncated;
  return truncated ? { ok: result.ok, message: `${result.message} (truncated)` } : result;
}

export async function exportSession(
  format: ExportFormat,
  opts: { reveal?: boolean } = {},
): Promise<ExportResult> {
  const entries = store.getSnapshot();
  if (entries.length === 0) return { ok: false, message: 'Nothing captured yet' };

  if (format === 'har') return deliver(toHar(entries, opts), `netspect-${stamp()}.har`);
  return deliver(toSessionText(entries, opts), `netspect-${stamp()}.txt`);
}
