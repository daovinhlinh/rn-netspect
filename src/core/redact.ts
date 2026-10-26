import { getConfig } from '../config';
import type { HeaderMap } from '../types';

export const MASK = '•'.repeat(8);

/**
 * Heuristic, used only for styling a masked leaf differently in the JSON tree. A response
 * could legitimately contain eight bullets; a false positive costs nothing because this
 * never gates access to anything.
 */
export const isMasked = (value: string): boolean => value.includes(MASK);

/** Keeps the scheme prefix and length, which is usually all you need to diagnose. */
export function maskValue(value: string): string {
  if (!value) return value;
  const spaceAt = value.indexOf(' ');
  // "Bearer eyJ…" -> "Bearer ••••••••(len 847)"
  if (spaceAt > 0 && spaceAt < 12) {
    return `${value.slice(0, spaceAt)} ${MASK}(len ${value.length - spaceAt - 1})`;
  }
  return `${MASK}(len ${value.length})`;
}

export function redactHeaderValue(name: string, value: string): string {
  return getConfig().redactHeaders.includes(name.toLowerCase()) ? maskValue(value) : value;
}

export function redactHeaders(headers: HeaderMap): HeaderMap {
  const out: HeaderMap = {};
  for (const name of Object.keys(headers)) {
    out[name] = redactHeaderValue(name, headers[name] ?? '');
  }
  return out;
}

/**
 * Redaction is applied when data is *shown or exported*, never when it is captured.
 * Masking at capture time would be destructive, which would make the "Reveal secrets"
 * toggle a lie and make generated cURL permanently un-runnable. The buffer therefore
 * holds raw values — see the security note in the README.
 */
export const viewHeaders = (headers: HeaderMap, reveal: boolean): HeaderMap =>
  reveal ? headers : redactHeaders(headers);

export const viewBody = (text: string | null, reveal: boolean): string | null =>
  reveal ? text : redactBodyText(text);

/** Shows enough of a key to recognise it without handing over the whole secret. */
export function maskEnvValue(value: string): string {
  if (value.length <= 8) return MASK;
  return `${value.slice(0, 4)}…${value.slice(-4)} (len ${value.length})`;
}

export function redactEnv(
  env: Record<string, string | undefined>,
): Record<string, string> {
  const { redactEnvKeys } = getConfig();
  const out: Record<string, string> = {};
  for (const key of Object.keys(env).sort()) {
    const value = env[key];
    if (value == null) continue;
    out[key] = redactEnvKeys.test(key) ? maskEnvValue(value) : value;
  }
  return out;
}

const MAX_DEPTH = 8;

/**
 * Walks a parsed JSON body and masks values whose key looks sensitive. Returns the
 * input untouched when nothing matched, so the common case allocates nothing.
 */
function redactNode(node: unknown, depth: number): unknown {
  if (depth > MAX_DEPTH || node == null || typeof node !== 'object') return node;

  const { redactBodyKeys } = getConfig();

  if (Array.isArray(node)) {
    let changed = false;
    const next = node.map((item) => {
      const redacted = redactNode(item, depth + 1);
      if (redacted !== item) changed = true;
      return redacted;
    });
    return changed ? next : node;
  }

  let changed = false;
  const next: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
    if (redactBodyKeys.test(key) && typeof value === 'string') {
      next[key] = maskValue(value);
      changed = true;
      continue;
    }
    const redacted = redactNode(value, depth + 1);
    if (redacted !== value) changed = true;
    next[key] = redacted;
  }
  return changed ? next : node;
}

/**
 * Best-effort redaction of a serialised body. Non-JSON input is returned as-is —
 * guessing at arbitrary text formats would mangle more than it protects.
 */
export function redactBodyText(text: string | null): string | null {
  if (!text) return text;
  const trimmed = text.trimStart();
  if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) return text;
  try {
    const parsed: unknown = JSON.parse(text);
    const redacted = redactNode(parsed, 0);
    return redacted === parsed ? text : JSON.stringify(redacted);
  } catch {
    return text;
  }
}
