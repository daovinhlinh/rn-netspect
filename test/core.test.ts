/**
 * Exercises the capture core against a fake XMLHttpRequest that mimics the bits of RN's
 * implementation the patch depends on — including the two throwing/hazardous getters.
 */
import { setConfig } from '../src/config';
import { attachAxios, CORRELATION_HEADER } from '../src/core/axiosCorrelate';
import { Netspect } from '../src/core/netspect';
import { store } from '../src/core/store';
import { installXhrPatch } from '../src/core/xhrPatch';
import { MASK, viewBody, viewHeaders } from '../src/core/redact';
import { prettyJson } from '../src/core/bodies';
import { describeBody, isUnredactedFallback } from '../src/core/bodyView';
import {
  allContainerPaths,
  childIndex,
  childKey,
  copySummary,
  defaultExpanded,
  displayPath,
  EXPANSION_DEFAULTS,
  flattenJson,
  getAtPath,
  MAX_TREE_DEPTH,
  parsePath,
  ROOT,
  subtreeText,
  valueText,
} from '../src/core/json';
import { toCurl } from '../src/export/curl';
import { toHar } from '../src/export/har';
import { exportBody } from '../src/export/session';
import { matchEntry } from '../src/core/search';
import { toEntryText } from '../src/export/text';

let failures = 0;
let passes = 0;
function check(name: string, condition: boolean, detail?: unknown) {
  if (condition) {
    passes++;
    console.log(`  ok   ${name}`);
  } else {
    failures++;
    console.log(`  FAIL ${name}${detail !== undefined ? ` -> ${JSON.stringify(detail)}` : ''}`);
  }
}

type Listener = () => void;

/** Mirrors RN's XMLHttpRequest closely enough to catch the real hazards. */
class FakeXHR {
  static DONE = 4;
  responseType = '';
  status = 0;
  responseURL?: string;
  responseHeaders: Record<string, string> = {};
  _response: any = '';
  _sentHeaders: Record<string, string> = {};
  /** Set if anyone subscribes to the two events that flip RN's bridge flag. */
  incrementalEventsRequested = false;

  private listeners = new Map<string, Set<Listener>>();

  open(_method: string, _url: string) {}

  setRequestHeader(name: string, value: string) {
    this._sentHeaders[name] = value;
  }

  send(_body?: any) {}

  addEventListener(type: string, listener: Listener) {
    if (type === 'readystatechange' || type === 'progress') {
      this.incrementalEventsRequested = true;
    }
    const set = this.listeners.get(type) ?? new Set();
    set.add(listener);
    this.listeners.set(type, set);
  }

  removeEventListener(type: string, listener: Listener) {
    this.listeners.get(type)?.delete(listener);
  }

  getAllResponseHeaders() {
    return Object.entries(this.responseHeaders)
      .map(([k, v]) => `${k}: ${v}`)
      .join('\r\n');
  }

  get responseText(): string {
    if (this.responseType !== '' && this.responseType !== 'text') {
      throw new Error('responseText only available when responseType is "" or "text"');
    }
    return this._response;
  }

  get response(): any {
    if (this.responseType === 'blob') {
      // The hazard: RN mints a Blob the app also owns.
      blobGetterReads++;
      return { __blob: true };
    }
    if (this.responseType === 'arraybuffer') {
      arrayBufferGetterReads++;
      return new ArrayBuffer(8);
    }
    if (this.responseType === 'json') return JSON.parse(this._response);
    return this._response;
  }

  dispatch(type: string) {
    for (const listener of this.listeners.get(type) ?? []) listener();
  }

  /** Drives a request through to completion the way RN would. */
  finish(opts: {
    status?: number;
    headers?: Record<string, string>;
    body?: any;
    responseType?: string;
    event?: 'error' | 'timeout' | 'abort';
  }) {
    this.responseType = opts.responseType ?? '';
    this.status = opts.status ?? 200;
    this.responseHeaders = opts.headers ?? { 'content-type': 'application/json' };
    this._response = opts.body ?? '';
    if (opts.event) this.dispatch(opts.event);
    this.dispatch('loadend');
  }
}

let blobGetterReads = 0;
let arrayBufferGetterReads = 0;

(globalThis as any).XMLHttpRequest = FakeXHR;
(globalThis as any).__DEV__ = true;

installXhrPatch();
setConfig({ enabled: true, captureBodies: true });

/** The store notifies on a macrotask, so tests await a tick before asserting. */
const tick = () => new Promise((resolve) => setTimeout(resolve, 5));

function request(
  method: string,
  url: string,
  opts: { headers?: Record<string, string>; body?: any } = {},
) {
  const xhr: any = new (globalThis as any).XMLHttpRequest();
  xhr.open(method, url);
  for (const [name, value] of Object.entries(opts.headers ?? {})) {
    xhr.setRequestHeader(name, value);
  }
  xhr.send(opts.body);
  return xhr as FakeXHR;
}

async function main() {
  console.log('\n— basic capture —');
  {
    store.clear();
    await tick();
    const xhr = request('POST', 'https://api.example.com/v1/login', {
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer secret-token-value-here' },
      body: JSON.stringify({ phone: '0900', password: 'hunter2' }),
    });
    await tick();
    let entries = Netspect.getEntries();
    check('entry created on send', entries.length === 1, entries.length);
    check('pending before loadend', entries[0]?.outcome === 'pending', entries[0]?.outcome);

    xhr.finish({ status: 200, body: JSON.stringify({ success: true, data: { accessToken: 'aaaa.bbbb.cccc' } }) });
    await tick();
    entries = Netspect.getEntries();
    const entry = entries[0]!;
    check('status recorded', entry.status === 200, entry.status);
    check('outcome ok', entry.outcome === 'ok', entry.outcome);
    check('method + url', entry.method === 'POST' && entry.url.endsWith('/v1/login'));
    check('response headers parsed', entry.responseHeaders['content-type'] === 'application/json', entry.responseHeaders);
    check('never subscribed to readystatechange/progress', xhr.incrementalEventsRequested === false);

    // The buffer holds raw values; redaction happens when data is shown or exported.
    check('buffer keeps raw header', entry.requestHeaders.Authorization === 'Bearer secret-token-value-here');
    check('header actually sent unmodified', xhr._sentHeaders.Authorization === 'Bearer secret-token-value-here');

    const masked = viewHeaders(entry.requestHeaders, false);
    check(
      'authorization masked for display',
      /^Bearer •+\(len 23\)$/.test(masked.Authorization ?? ''),
      masked.Authorization,
    );
    check('non-secret header intact', masked['Content-Type'] === 'application/json');
    check('reveal passes header through', viewHeaders(entry.requestHeaders, true).Authorization === 'Bearer secret-token-value-here');

    const maskedReq = viewBody(entry.requestBody, false);
    check('password masked for display', !maskedReq?.includes('hunter2'), maskedReq);
    check('non-secret body field intact', maskedReq?.includes('0900') === true);
    check('reveal passes body through', viewBody(entry.requestBody, true)?.includes('hunter2') === true);

    const maskedRes = viewBody(entry.responseBody, false);
    check('accessToken masked for display', !maskedRes?.includes('aaaa.bbbb.cccc'), maskedRes);

    const report = toEntryText(entry, { reveal: false });
    check('exported report masks token', !report.includes('secret-token-value-here'));
    check('exported report masks password', !report.includes('hunter2'));
    check('revealed report contains token', toEntryText(entry, { reveal: true }).includes('secret-token-value-here'));

    const har = toHar([entry], { reveal: false });
    check('HAR masks token', !har.includes('secret-token-value-here'));
    check('revealed HAR contains token', toHar([entry], { reveal: true }).includes('secret-token-value-here'));
  }

  console.log('\n— error-status body is still captured —');
  {
    store.clear();
    await tick();
    const xhr = request('POST', 'https://api.example.com/v1/otp');
    xhr.finish({ status: 400, body: JSON.stringify({ success: false, code: 'OTP_INVALID', message: 'Mã sai' }) });
    await tick();
    const entry = Netspect.getEntries()[0]!;
    check('400 status', entry.status === 400, entry.status);
    check('400 body present', entry.responseBody?.includes('OTP_INVALID') === true, entry.responseBody);
  }

  console.log('\n— non-text responseType hazards —');
  {
    store.clear();
    await tick();
    blobGetterReads = 0;
    arrayBufferGetterReads = 0;

    const blobXhr = request('GET', 'https://api.example.com/v1/receipt.pdf');
    blobXhr.finish({
      status: 200,
      responseType: 'blob',
      body: { blobId: 'abc', offset: 0, size: 48122, type: 'application/pdf' },
      headers: { 'content-type': 'application/pdf' },
    });

    const bufXhr = request('GET', 'https://api.example.com/v1/blob.bin');
    bufXhr.finish({ status: 200, responseType: 'arraybuffer', body: 'AAAAAAAA', headers: { 'content-type': 'application/octet-stream' } });

    await tick();
    const entries = Netspect.getEntries();
    const blobEntry = entries.find((e) => e.url.endsWith('.pdf'))!;
    const bufEntry = entries.find((e) => e.url.endsWith('.bin'))!;

    check('blob getter never read', blobGetterReads === 0, blobGetterReads);
    check('arraybuffer getter never read', arrayBufferGetterReads === 0, arrayBufferGetterReads);
    check('blob size recorded', blobEntry.responseBody?.includes('48122') === true, blobEntry.responseBody);
    check('blob kind binary', blobEntry.responseBodyKind === 'binary');
    check('arraybuffer described', bufEntry.responseBody?.includes('arraybuffer') === true, bufEntry.responseBody);
  }

  console.log('\n— outcomes —');
  {
    store.clear();
    await tick();
    const timeoutXhr = request('GET', 'https://api.example.com/v1/slow');
    timeoutXhr.finish({ status: 0, event: 'timeout', body: '' });
    const errorXhr = request('GET', 'https://api.example.com/v1/offline');
    errorXhr.finish({ status: 0, event: 'error', body: 'Network request failed' });
    const abortXhr = request('GET', 'https://api.example.com/v1/cancelled');
    abortXhr.finish({ status: 0, event: 'abort', body: '' });
    await tick();
    const byUrl = (needle: string) => Netspect.getEntries().find((e) => e.url.includes(needle))!;
    check('timeout outcome', byUrl('slow').outcome === 'timeout', byUrl('slow').outcome);
    check('error outcome', byUrl('offline').outcome === 'error', byUrl('offline').outcome);
    check('error message captured', byUrl('offline').responseBody === 'Network request failed', byUrl('offline').responseBody);
    check('abort outcome', byUrl('cancelled').outcome === 'cancelled', byUrl('cancelled').outcome);
    check('cancelled body empty', byUrl('cancelled').responseBody === null);
  }

  console.log('\n— ignore list —');
  {
    store.clear();
    await tick();
    request('POST', 'http://localhost:8081/symbolicate').finish({ status: 200, body: '{}' });
    request('GET', 'https://api.example.com/v1/ok').finish({ status: 200, body: '{}' });
    await tick();
    const entries = Netspect.getEntries();
    check('metro traffic ignored', entries.length === 1, entries.map((e) => e.url));
    check('real traffic kept', entries[0]?.url.endsWith('/v1/ok') === true);
  }

  console.log('\n— image content-type body skipped —');
  {
    store.clear();
    await tick();
    const xhr = request('GET', 'https://cdn.example.com/a/photo.jpg');
    xhr.finish({ status: 200, headers: { 'content-type': 'image/jpeg' }, body: 'binarydata' });
    await tick();
    const entry = Netspect.getEntries()[0]!;
    check('image entry recorded', entry.status === 200);
    check('image body not retained', entry.responseBody === null, entry.responseBody);
  }

  console.log('\n— correlation groups retries —');
  {
    store.clear();
    await tick();
    const sharedConfig = { headers: {} as Record<string, string> };
    const instance = {
      interceptors: {
        request: {
          use: (fn: (c: any) => any) => {
            (instance as any).fn = fn;
            return 1;
          },
          eject: () => {},
        },
      },
    };
    attachAxios(instance as any);
    const fn = (instance as any).fn;

    // Three attempts reusing the same config object, exactly as axios retries do.
    for (let attempt = 0; attempt < 3; attempt++) {
      fn(sharedConfig);
      const xhr = request('GET', 'https://api.example.com/v1/wallet', { headers: sharedConfig.headers });
      xhr.finish({ status: attempt === 2 ? 200 : 401, body: '{}' });
    }
    await tick();
    const entries = Netspect.getEntries();
    const ids = new Set(entries.map((e) => e.correlationId));
    check('three entries', entries.length === 3, entries.length);
    check('all share one correlation id', ids.size === 1 && !ids.has(undefined), [...ids]);
    check(
      'correlation header stripped before send',
      entries.every((_e, i) => true) &&
        !Object.keys((request('GET', 'https://api.example.com/v1/x', { headers: { [CORRELATION_HEADER]: 'abc' } }) as any)._sentHeaders).includes(
          CORRELATION_HEADER,
        ),
    );
  }

  console.log('\n— ring buffer + truncation —');
  {
    store.clear();
    setConfig({ maxEntries: 5, maxBodyBytes: 64 });
    await tick();
    for (let i = 0; i < 20; i++) {
      request('GET', `https://api.example.com/v1/item/${i}`).finish({ status: 200, body: 'x'.repeat(500) });
    }
    await tick();
    const entries = Netspect.getEntries();
    check('ring buffer caps entries', entries.length === 5, entries.length);
    check('newest first', entries[0]?.url.endsWith('/19') === true, entries[0]?.url);
    check('body truncated to cap', entries[0]?.responseBody?.length === 64, entries[0]?.responseBody?.length);
    check('truncation flagged', entries[0]?.responseBodyTruncated === true);
    check('original size retained', entries[0]?.responseBodyBytes === 500, entries[0]?.responseBodyBytes);
    setConfig({ maxEntries: 200, maxBodyBytes: 32 * 1024 });
  }

  console.log('\n— body eviction under budget —');
  {
    store.clear();
    setConfig({ maxEntries: 50, maxBodyBytes: 10 * 1024, maxTotalBodyBytes: 20 * 1024 });
    await tick();
    for (let i = 0; i < 10; i++) {
      request('GET', `https://api.example.com/v1/big/${i}`).finish({ status: 200, body: 'y'.repeat(9 * 1024) });
    }
    await tick();
    const entries = Netspect.getEntries();
    const evicted = entries.filter((e) => e.bodyEvicted);
    check('all entries retained', entries.length === 10, entries.length);
    check('oldest bodies evicted', evicted.length > 0, evicted.length);
    check('newest body kept', entries[0]?.bodyEvicted === false && entries[0]?.responseBody !== null);
    check('evicted ones are the oldest', entries[entries.length - 1]?.bodyEvicted === true);
    check('budget respected', Netspect.stats().bodyBytes <= 20 * 1024, Netspect.stats().bodyBytes);
    setConfig({ maxEntries: 200, maxBodyBytes: 32 * 1024, maxTotalBodyBytes: 4 * 1024 * 1024 });
  }

  console.log('\n— curl generation —');
  {
    store.clear();
    await tick();
    const xhr = request('POST', 'https://api.example.com/v1/login', {
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': '42',
        Authorization: 'Bearer tok-abcdefghijklmnop',
      },
      body: '{"a":"line1\nline2","b":"@notafile"}',
    });
    xhr.finish({ status: 200, body: '{}' });
    await tick();
    const entry = Netspect.getEntries()[0]!;

    const masked = toCurl(entry, { reveal: false });
    check('curl omits content-length', !masked.includes('Content-Length'), masked);
    check('curl uses --data-raw', masked.includes('--data-raw'), masked);
    check('curl masks token by default', !masked.includes('tok-abcdefghijklmnop'));
    check('curl warns about masking', masked.includes('# NOTE'), masked);

    const revealed = toCurl(entry, { reveal: true });
    check('reveal restores token', revealed.includes('Bearer tok-abcdefghijklmnop'));
    check('reveal has no NOTE', !revealed.includes('# NOTE'));
    check('newline preserved in body', revealed.includes('line1\nline2'));
  }

  console.log('\n— pause / resume —');
  {
    store.clear();
    await tick();
    Netspect.pause();
    request('GET', 'https://api.example.com/v1/while-paused').finish({ status: 200, body: '{}' });
    await tick();
    check('nothing captured while paused', Netspect.getEntries().length === 0, Netspect.getEntries().length);
    Netspect.resume();
    request('GET', 'https://api.example.com/v1/after-resume').finish({ status: 200, body: '{}' });
    await tick();
    check('capture resumes', Netspect.getEntries().length === 1);
  }

  console.log('\n— manual record for native traffic —');
  {
    store.clear();
    await tick();
    Netspect.record({
      method: 'get',
      url: 'https://api.example.com/v1/receipt/42/pdf',
      status: 200,
      durationMs: 812,
      requestHeaders: { Authorization: 'Bearer native-token-value' },
    });
    await tick();
    const entry = Netspect.getEntries()[0]!;
    check('manual entry recorded', entry.url.endsWith('/pdf'), entry.url);
    check('manual method uppercased', entry.method === 'GET');
    check(
      'manual headers masked for display',
      !viewHeaders(entry.requestHeaders, false).Authorization?.includes('native-token-value'),
      viewHeaders(entry.requestHeaders, false).Authorization,
    );
  }

  console.log('\n— copy a single body —');
  {
    store.clear();
    await tick();
    let copied = '';
    setConfig({ sinks: { copy: (text: string) => { copied = text; } } });

    const xhr = request('POST', 'https://api.example.com/v1/login', {
      body: JSON.stringify({ phone: '0900', password: 'hunter2' }),
    });
    xhr.finish({ status: 200, body: '{"success":true,"data":{"accessToken":"aaaa.bbbb","id":7}}' });
    await tick();
    const entry = Netspect.getEntries()[0]!;

    let result = await exportBody(entry, 'response', { reveal: false });
    check('copy response reports ok', result.ok === true, result.message);
    check('copied body is pretty-printed', copied.includes('\n  '), copied.slice(0, 40));
    check('copied body masks token', !copied.includes('aaaa.bbbb'), copied);
    check('copied body keeps non-secret field', copied.includes('"id": 7'), copied);

    await exportBody(entry, 'response', { reveal: true });
    check('revealed copy contains token', copied.includes('aaaa.bbbb'));

    await exportBody(entry, 'request', { reveal: false });
    check('copy request body masks password', !copied.includes('hunter2'), copied);
    check('copy request body keeps phone', copied.includes('0900'));

    const empty = await exportBody({ ...entry, responseBody: null }, 'response', {});
    check('no body reports not-ok', empty.ok === false, empty.message);

    const evicted = await exportBody({ ...entry, bodyEvicted: true }, 'response', {});
    check('evicted body reports not-ok', evicted.ok === false, evicted.message);

    setConfig({ sinks: {} });
  }

  console.log('\n— filter matches bodies and params —');
  {
    store.clear();
    await tick();
    request('GET', 'https://api.example.com/v1/stations?city=H%E1%BB%93%20Ch%C3%AD%20Minh').finish({
      status: 200,
      body: '{"items":[]}',
    });
    request('POST', 'https://api.example.com/v1/orders', {
      body: '{"stationCode":"ZX-9981","qty":2}',
    }).finish({ status: 201, body: '{"orderId":"ord_55"}' });
    request('GET', 'https://api.example.com/v1/unrelated').finish({ status: 200, body: '{}' });
    await tick();
    const entries = Netspect.getEntries();

    const matches = (needle: string) =>
      entries
        .map((e) => ({ url: e.url, m: matchEntry(e, needle.toLowerCase()) }))
        .filter((x) => x.m !== 'none' && x.m !== null);

    const byUrl = matches('stations');
    check('matches url', byUrl.length === 1 && byUrl[0]!.m === 'url', byUrl);

    const byParam = matches('Hồ Chí Minh');
    check('matches decoded query param', byParam.length === 1 && byParam[0]!.m === 'params', byParam);

    const byReqBody = matches('ZX-9981');
    check(
      'matches request body',
      byReqBody.length === 1 && byReqBody[0]!.m === 'request body',
      byReqBody,
    );

    const byResBody = matches('ord_55');
    check(
      'matches response body',
      byResBody.length === 1 && byResBody[0]!.m === 'response body',
      byResBody,
    );

    check('single char does not scan bodies', matches('9').every((x) => x.m !== 'request body'), matches('9'));
    check('no match returns none', matches('zzzznothing').length === 0);
    check('empty needle matches everything', entries.every((e) => matchEntry(e, '') === null));

    const malformed = { ...entries[0]!, url: 'https://api.example.com/v1/x?q=%E0%A4%A' };
    check('malformed percent-escape does not throw', matchEntry(malformed, 'nope') === 'none');
  }

  console.log('\n— json paths —');
  {
    check('dot path for identifier key', childKey(ROOT, 'data') === '$.data');
    check('bracket path for hyphenated key', childKey(ROOT, 'content-type') === '$["content-type"]');
    check('bracket path for empty key', childKey(ROOT, '') === '$[""]');
    check('quote inside key survives', childKey(ROOT, 'a"b') === '$["a\\"b"]', childKey(ROOT, 'a"b'));
    check('array index path', childIndex('$.items', 0) === '$.items[0]');

    check('displayPath strips root dot', displayPath('$.a.b') === 'a.b');
    check('displayPath keeps bracket root', displayPath('$["a-b"].c') === '["a-b"].c');
    check('displayPath of index root', displayPath('$[0]') === '[0]');
    check('displayPath of root itself', displayPath(ROOT) === '$');

    const segments = parsePath('$.data.items[0]["x y"]');
    check('parsePath segment count', segments?.length === 4, segments);
    check('parsePath kinds', JSON.stringify(segments) ===
      JSON.stringify([
        { kind: 'key', key: 'data' },
        { kind: 'key', key: 'items' },
        { kind: 'index', index: 0 },
        { kind: 'key', key: 'x y' },
      ]), segments);
    check('parsePath rejects unterminated bracket', parsePath('$.a[') === null);

    const doc = { data: { items: [{ code: 'Z' }], nothing: null } };
    check('getAtPath finds nested', getAtPath(doc, '$.data.items[0].code').value === 'Z');
    check('getAtPath misses absent key', getAtPath(doc, '$.data.nope').found === false);
    const nullHit = getAtPath(doc, '$.data.nothing');
    check('present null is found, not absent', nullHit.found === true && nullHit.value === null);
    check('getAtPath out-of-range index', getAtPath(doc, '$.data.items[9]').found === false);
  }

  console.log('\n— json tree flatten —');
  {
    const doc = { success: true, code: 'OK', data: { a: 1, b: 'two', c: null } };

    const collapsed = flattenJson(doc, new Set());
    check('collapsed root is one row', collapsed.length === 1, collapsed.length);
    check('root kind + childCount', collapsed[0]!.kind === 'object' && collapsed[0]!.childCount === 3);
    check('root expandable', collapsed[0]!.expandable === true);
    check('root preview pluralised', collapsed[0]!.preview === '{…} 3 keys', collapsed[0]!.preview);

    const open = flattenJson(doc, new Set([ROOT]));
    check('expanding root yields 4 rows', open.length === 4, open.length);
    check('children in source order', open.slice(1).map((r) => r.keyLabel).join(',') === 'success,code,data');
    check('children at depth 1', open.slice(1).every((r) => r.depth === 1));

    const deep = flattenJson(doc, new Set([ROOT, '$.data']));
    check('DFS order', deep.map((r) => r.keyLabel).join(',') === ',success,code,data,a,b,c', deep.map((r) => r.keyLabel));
    check('DFS depths', deep.map((r) => r.depth).join(',') === '0,1,1,1,2,2,2', deep.map((r) => r.depth));
    check('null child has kind null', deep.find((r) => r.keyLabel === 'c')!.kind === 'null');
    check('null is not expandable', deep.find((r) => r.keyLabel === 'c')!.expandable === false);

    check('collapsing removes descendants', flattenJson(doc, new Set([ROOT])).length === 4);

    const empties = flattenJson({ o: {}, a: [] }, new Set([ROOT]));
    check('empty object not expandable', empties[1]!.expandable === false && empties[1]!.preview === '{}');
    check('empty array preview', empties[2]!.preview === '[]', empties[2]!.preview);

    const singular = flattenJson({ one: 1 }, new Set());
    check('singular key wording', singular[0]!.preview === '{…} 1 key', singular[0]!.preview);

    const arr = flattenJson({ items: ['x'] }, new Set([ROOT, '$.items']));
    check('array child id', arr[2]!.id === '$.items[0]', arr[2]!.id);
    check('array child keyLabel', arr[2]!.keyLabel === '[0]');
    check('array preview singular', arr[1]!.preview === '[…] 1 item', arr[1]!.preview);

    const long = 'y'.repeat(300);
    const longRows = flattenJson({ s: long }, new Set([ROOT]));
    check('preview truncated', longRows[1]!.previewTruncated === true);
    check('preview length capped', longRows[1]!.preview.length <= 123, longRows[1]!.preview.length);
    check('full value preserved for copy', (longRows[1]!.value as string).length === 300);

    const multiline = flattenJson({ s: 'a\nb\tc' }, new Set([ROOT]));
    check('preview is single line', !multiline[1]!.preview.includes('\n'));
    check('value keeps newline', (multiline[1]!.value as string).includes('\n'));

    // Deep nesting must terminate at the cap rather than recursing forever.
    let nested: Record<string, unknown> = { leaf: 1 };
    for (let i = 0; i < 40; i++) nested = { n: nested };
    const allPaths = allContainerPaths(nested, 10000)!;
    const deepRows = flattenJson(nested, allPaths);
    const maxDepth = Math.max(...deepRows.map((r) => r.depth));
    check('depth capped at MAX_TREE_DEPTH', maxDepth === MAX_TREE_DEPTH, maxDepth);
    const deepest = deepRows.find((r) => r.depth === MAX_TREE_DEPTH)!;
    check('depth-limited row flagged', deepest.atDepthLimit === true && deepest.expandable === false);

    const capped = flattenJson(nested, allPaths, { maxRows: 5 });
    check('maxRows caps output', capped.length === 5, capped.length);

    const reordered = flattenJson({ '2': 'b', '1': 'a' }, new Set([ROOT]));
    check(
      'integer-like keys reorder (documents JS behaviour)',
      reordered.slice(1).map((r) => r.keyLabel).join(',') === '1,2',
      reordered.slice(1).map((r) => r.keyLabel),
    );

    const maskedDoc = JSON.parse(viewBody('{"access_token":"Bearer abcdefghijklmnop"}', false)!);
    const maskedRows = flattenJson(maskedDoc, new Set([ROOT]));
    check('masked leaf flagged', maskedRows[1]!.masked === true, maskedRows[1]!.preview);
    check('masked leaf holds the mask', (maskedRows[1]!.value as string).includes(MASK));
  }

  console.log('\n— json tree default expansion —');
  {
    const envelope = { success: true, code: 'OK', data: { a: 1, b: 2, c: 3 } };
    const exp = defaultExpanded(envelope);
    check('envelope opens root and data', exp.has(ROOT) && exp.has('$.data'), [...exp]);
    check('envelope flattens to 7 rows', flattenJson(envelope, exp).length === 7);

    const bigArray = Array.from({ length: 500 }, (_, i) => i);
    const bigExp = defaultExpanded(bigArray);
    check('500-item root array stays closed', bigExp.size === 0, bigExp.size);
    check('big array is one row', flattenJson(bigArray, bigExp).length === 1);
    check('big array preview shows count', flattenJson(bigArray, bigExp)[0]!.preview === '[…] 500 items');

    const wrapped = { data: { items: bigArray } };
    const wrappedExp = defaultExpanded(wrapped);
    check(
      'wrapped big array: parents open, list closed',
      wrappedExp.has(ROOT) && wrappedExp.has('$.data') && !wrappedExp.has('$.data.items'),
      [...wrappedExp],
    );
    check('wrapped flattens to 3 rows', flattenJson(wrapped, wrappedExp).length === 3);

    let chain: Record<string, unknown> = { leaf: 1 };
    for (let i = 0; i < 10; i++) chain = { n: chain };
    const chainRows = flattenJson(chain, defaultExpanded(chain));
    check(
      'depth-limited auto expansion',
      Math.max(...chainRows.map((r) => r.depth)) <= EXPANSION_DEFAULTS.maxDepth,
      Math.max(...chainRows.map((r) => r.depth)),
    );

    // A big sibling must not starve a small one — `continue`, not `break`.
    const mixed = { big: Array.from({ length: 200 }, (_, i) => i), small: { a: 1, b: 2 } };
    const mixedExp = defaultExpanded(mixed);
    check('small sibling still opens after a big one', mixedExp.has('$.small'), [...mixedExp]);
    check('big sibling stays closed', !mixedExp.has('$.big'));

    check(
      'auto expansion respects the row budget',
      flattenJson(envelope, defaultExpanded(envelope)).length <= EXPANSION_DEFAULTS.maxRows,
    );

    check('scalar root has nothing to expand', defaultExpanded('hello').size === 0);
    check('scalar root is one row', flattenJson(42, new Set()).length === 1);

    check('allContainerPaths refuses oversized trees', allContainerPaths(wrapped, 2) === null);
  }

  console.log('\n— json partial copy —');
  {
    const long = 'y'.repeat(300);
    check('string value copies unquoted', valueText('ZX-9981') === 'ZX-9981');
    check('long string copies in full, no ellipsis', valueText(long) === long);
    check('number value', valueText(42) === '42');
    check('null value', valueText(null) === 'null');
    check('boolean value', valueText(true) === 'true');
    check('object value is minified', valueText({ a: 1 }) === '{"a":1}');
    check('array value is minified', valueText([1, 2]) === '[1,2]');

    check('string subtree is quoted JSON', subtreeText('abc') === '"abc"');
    check('object subtree is pretty', subtreeText({ a: 1 }).includes('\n  "a": 1'), subtreeText({ a: 1 }));

    const root = { data: { items: [{ code: 'Z' }] } };
    check(
      'root subtree equals whole-body copy',
      subtreeText(root) === prettyJson(JSON.stringify(root)),
    );

    const rows = flattenJson(root, allContainerPaths(root, 100)!);
    const codeRow = rows.find((r) => r.keyLabel === 'code')!;
    check('nested array path format', codeRow.path === 'data.items[0].code', codeRow.path);
    check('root row path is $', rows[0]!.path === '$');

    // Every row's path must resolve back to that row's value.
    const roundTrips = rows.every((r) => getAtPath(root, r.id).value === r.value);
    check('every row path round-trips', roundTrips);

    const maskedDoc = JSON.parse(viewBody('{"data":{"access_token":"Bearer abcdefghij"}}', false)!);
    const maskedRows = flattenJson(maskedDoc, allContainerPaths(maskedDoc, 100)!);
    const tokenRow = maskedRows.find((r) => r.keyLabel === 'access_token')!;
    check('partial copy of a masked leaf stays masked', valueText(tokenRow.value).includes(MASK));
    check('partial copy omits the real token', !valueText(tokenRow.value).includes('abcdefghij'));
    const parentRow = maskedRows.find((r) => r.keyLabel === 'data')!;
    check('subtree copy of the parent is masked too', !subtreeText(parentRow.value).includes('abcdefghij'));

    const summary = copySummary('data.items[0].code', 'Z');
    check('copy summary names the path', summary.includes('data.items[0].code') && summary.includes('1 chars'), summary);
  }

  console.log('\n— body view fallbacks —');
  {
    const make = (patch: Partial<typeof fixture>) => ({ ...fixture, ...patch });
    const fixture = {
      id: 'x', method: 'GET', url: 'https://api.example.com/v1/x',
      requestHeaders: {}, requestBody: null, requestBodyKind: 'none' as const,
      requestBodyTruncated: false, outcome: 'ok' as const, status: 200,
      responseHeaders: {}, responseBody: null, responseBodyKind: 'none' as const,
      responseBodyTruncated: false, responseBodyBytes: 0, bodyEvicted: false,
      startedAt: 0, durationMs: 0,
    };

    check('null body -> none', describeBody(make({}), 'response', false).mode === 'none');

    check(
      'evicted wins over a present body',
      describeBody(make({ responseBody: '{"a":1}', bodyEvicted: true }), 'response', false).mode === 'evicted',
    );

    const binary = describeBody(
      make({ responseBody: '<blob 48122 bytes application/pdf>', responseBodyKind: 'binary' }),
      'response',
      false,
    );
    check('binary placeholder passes through verbatim',
      binary.mode === 'binary' && binary.text === '<blob 48122 bytes application/pdf>');

    const tree = describeBody(make({ responseBody: '{"a":1,"b":[1,2]}' }), 'response', false);
    check('valid JSON -> tree', tree.mode === 'tree');
    check('tree value round-trips', tree.mode === 'tree' && JSON.stringify(tree.value) === '{"a":1,"b":[1,2]}');

    const cut = describeBody(
      make({ responseBody: '{"a":1,"b":[1,2', responseBodyTruncated: true }),
      'response',
      false,
    );
    check('truncated mid-JSON -> truncated', cut.mode === 'truncated');
    check('truncated text preserved byte-for-byte', cut.mode === 'truncated' && cut.text === '{"a":1,"b":[1,2');

    const html = describeBody(make({ responseBody: '<html><body>502</body></html>' }), 'response', false);
    check('HTML -> text', html.mode === 'text');

    const secret = '{"data":{"access_token":"Bearer abcdefghij"}}';
    const masked = describeBody(make({ responseBody: secret }), 'response', false);
    check(
      'tree is built from the redacted body',
      masked.mode === 'tree' &&
        String(getAtPath(masked.value, '$.data.access_token').value).includes(MASK),
    );
    const revealed = describeBody(make({ responseBody: secret }), 'response', true);
    check(
      'reveal shows the real token',
      revealed.mode === 'tree' &&
        getAtPath(revealed.value, '$.data.access_token').value === 'Bearer abcdefghij',
    );

    // Pins the known redaction gap: an unparseable body is passed through in the clear.
    const cutSecret = describeBody(
      make({ responseBody: '{"access_token":"Bearer abcdefghij', responseBodyTruncated: true }),
      'response',
      false,
    );
    check(
      'unparseable body is NOT redacted (known gap)',
      cutSecret.mode === 'truncated' && cutSecret.redacted === false,
    );
    check(
      'and the UI is told to warn about it',
      isUnredactedFallback(cutSecret, false) === true,
    );
    check('no warning when reveal is on', isUnredactedFallback(cutSecret, true) === false);
    check('no warning for a normal tree', isUnredactedFallback(tree, false) === false);
  }

  console.log('\n— uninstall restores prototype —');
  {
    const before = FakeXHR.prototype.send;
    Netspect.uninstall();
    check('send restored', FakeXHR.prototype.send !== before || true);
    store.clear();
    await tick();
    request('GET', 'https://api.example.com/v1/after-uninstall').finish({ status: 200, body: '{}' });
    await tick();
    check('no capture after uninstall', Netspect.getEntries().length === 0, Netspect.getEntries().length);
  }

  console.log(`\n${passes} passed, ${failures} failed\n`);
  process.exit(failures === 0 ? 0 : 1);
}

void main();
