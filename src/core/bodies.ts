import { getConfig } from '../config';
import type { BodyKind, FormPart, HeaderMap, Outcome } from '../types';

export type CapturedBody = {
  text: string | null;
  kind: BodyKind;
  truncated: boolean;
  /** Length before truncation, in UTF-16 units. */
  bytes: number;
  formParts?: FormPart[];
};

const EMPTY: CapturedBody = { text: null, kind: 'none', truncated: false, bytes: 0 };

function cap(raw: string): { text: string; truncated: boolean; bytes: number } {
  const max = getConfig().maxBodyBytes;
  if (raw.length <= max) return { text: raw, truncated: false, bytes: raw.length };
  return { text: raw.slice(0, max), truncated: true, bytes: raw.length };
}

/**
 * `FormData` is described, never read. Pulling file bytes into a log buffer would
 * defeat the point of streaming an upload.
 */
function describeFormData(form: any): CapturedBody {
  const parts: FormPart[] = [];
  // `getParts()` is RN's public-ish accessor; `_parts` is the older shape.
  const raw: any[] = typeof form.getParts === 'function' ? form.getParts() : (form._parts ?? []);

  for (const part of raw) {
    if (Array.isArray(part)) {
      // `_parts` shape: [name, value | { uri, name, type }]
      const [name, value] = part;
      if (value && typeof value === 'object') {
        parts.push({ name: String(name), filename: value.name ?? value.uri, type: value.type });
      } else {
        parts.push({ name: String(name), value: String(value) });
      }
      continue;
    }
    // `getParts()` shape: { headers, string } | { headers, uri, name, type }
    const disposition: string = part?.headers?.['content-disposition'] ?? '';
    const name = /name="([^"]*)"/.exec(disposition)?.[1] ?? '';
    const filename = /filename="([^"]*)"/.exec(disposition)?.[1];
    if (filename != null) {
      parts.push({ name, filename, type: part?.headers?.['content-type'] });
    } else {
      parts.push({ name, value: part?.string != null ? String(part.string) : undefined });
    }
  }

  return {
    text: parts
      .map((p) => (p.filename ? `${p.name}: <file ${p.filename}>` : `${p.name}: ${p.value ?? ''}`))
      .join('\n'),
    kind: 'formdata',
    truncated: false,
    bytes: 0,
    formParts: parts,
  };
}

export function readRequestBody(body: unknown): CapturedBody {
  if (!getConfig().captureBodies) return EMPTY;
  if (body == null) return EMPTY;

  if (typeof body === 'string') {
    const { text, truncated, bytes } = cap(body);
    const trimmed = body.trimStart();
    return {
      text,
      kind: trimmed.startsWith('{') || trimmed.startsWith('[') ? 'json' : 'text',
      truncated,
      bytes,
    };
  }

  const ctor = (body as any)?.constructor?.name;

  if (ctor === 'FormData' || typeof (body as any)?.getParts === 'function') {
    return describeFormData(body);
  }

  if (ctor === 'Blob') {
    const size = (body as any).size ?? 0;
    return { text: `<blob ${size} bytes ${(body as any).type ?? ''}>`, kind: 'binary', truncated: false, bytes: size };
  }

  if (body instanceof ArrayBuffer) {
    return { text: `<arraybuffer ${body.byteLength} bytes>`, kind: 'binary', truncated: false, bytes: body.byteLength };
  }

  if (ArrayBuffer.isView(body as any)) {
    const view = body as ArrayBufferView;
    return { text: `<${ctor ?? 'typedarray'} ${view.byteLength} bytes>`, kind: 'binary', truncated: false, bytes: view.byteLength };
  }

  // URLSearchParams and anything else with a sane toString.
  try {
    const { text, truncated, bytes } = cap(String(body));
    return { text, kind: 'text', truncated, bytes };
  } catch {
    return { text: `<${ctor ?? 'unknown'}>`, kind: 'binary', truncated: false, bytes: 0 };
  }
}

/**
 * Reads a finished XHR's response without perturbing it. Three RN-specific hazards
 * drive the shape of this function:
 *
 * 1. The `responseText` getter THROWS unless `responseType` is '' or 'text'.
 * 2. The `response` getter for 'blob' calls `BlobManager.createFromOptions()`, handing
 *    out a Blob the app also owns — a double-release would free the native blob out
 *    from under the app. So we never touch it; we read the private descriptor instead.
 * 3. The `response` getter for 'arraybuffer' base64-decodes the entire payload on every
 *    read. Also avoided.
 */
export function readResponseBody(xhr: any, outcome: Outcome): CapturedBody {
  if (outcome === 'cancelled') {
    // `abort()` runs `_reset()` before dispatching 'abort'/'loadend', so status and
    // `_response` are already wiped. There is genuinely nothing left to read.
    return EMPTY;
  }
  if (!getConfig().captureBodies) return EMPTY;

  const responseType: string = xhr.responseType ?? '';

  if (responseType === '' || responseType === 'text') {
    // `_response` is the string RN already materialised for the app, so reading it
    // costs one slice and avoids the throwing getter. On a network failure RN stuffs
    // the error message in here, which is exactly what we want to surface.
    const raw = typeof xhr._response === 'string' ? xhr._response : '';
    if (!raw) return EMPTY;
    const { text, truncated, bytes } = cap(raw);
    const trimmed = raw.trimStart();
    return {
      text,
      kind: trimmed.startsWith('{') || trimmed.startsWith('[') ? 'json' : 'text',
      truncated,
      bytes,
    };
  }

  if (responseType === 'json') {
    try {
      const serialised = JSON.stringify(xhr.response);
      if (!serialised) return EMPTY;
      const { text, truncated, bytes } = cap(serialised);
      return { text, kind: 'json', truncated, bytes };
    } catch {
      return { text: '<unserializable json>', kind: 'binary', truncated: false, bytes: 0 };
    }
  }

  if (responseType === 'arraybuffer' || responseType === 'base64') {
    const b64 = typeof xhr._response === 'string' ? xhr._response : '';
    const bytes = Math.floor((b64.length * 3) / 4);
    return { text: `<${responseType} ${bytes} bytes>`, kind: 'binary', truncated: false, bytes };
  }

  if (responseType === 'blob') {
    const descriptor = xhr._response;
    const size =
      descriptor && typeof descriptor === 'object' && typeof descriptor.size === 'number'
        ? descriptor.size
        : 0;
    const type = descriptor?.type ? ` ${descriptor.type}` : '';
    return { text: `<blob ${size} bytes${type}>`, kind: 'binary', truncated: false, bytes: size };
  }

  return { text: `<${responseType}>`, kind: 'binary', truncated: false, bytes: 0 };
}

export function readResponseHeaders(xhr: any): HeaderMap {
  // RN exposes the parsed object directly; no need to re-parse the raw string.
  const parsed = xhr.responseHeaders;
  if (parsed && typeof parsed === 'object') {
    const out: HeaderMap = {};
    for (const [key, value] of Object.entries(parsed)) out[key] = String(value);
    return out;
  }
  const raw: string | undefined = xhr.getAllResponseHeaders?.();
  if (!raw) return {};
  const out: HeaderMap = {};
  for (const line of raw.split(/\r?\n/)) {
    const at = line.indexOf(':');
    if (at > 0) out[line.slice(0, at).trim()] = line.slice(at + 1).trim();
  }
  return out;
}

/** Pretty-prints JSON for display, falling back to the original text. */
export function prettyJson(text: string | null): string {
  if (!text) return '';
  try {
    return JSON.stringify(JSON.parse(text), null, 2);
  } catch {
    return text;
  }
}
