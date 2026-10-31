/** How a request ended. `pending` entries have not reached a terminal event yet. */
export type Outcome = 'pending' | 'ok' | 'error' | 'timeout' | 'cancelled';

/** What a captured body actually is, so the UI knows whether to pretty-print it. */
export type BodyKind = 'none' | 'text' | 'json' | 'formdata' | 'binary';

export type HeaderMap = Record<string, string>;

/** One multipart field, described without ever reading file bytes. */
export type FormPart = {
  name: string;
  value?: string;
  filename?: string;
  type?: string;
};

export type NetspectEntry = {
  id: string;
  /** Shared by every attempt of one logical request. Requires `attachAxios`. */
  correlationId?: string;

  method: string;
  url: string;
  requestHeaders: HeaderMap;
  requestBody: string | null;
  requestBodyKind: BodyKind;
  requestBodyTruncated: boolean;
  formParts?: FormPart[];

  outcome: Outcome;
  status: number;
  responseHeaders: HeaderMap;
  responseUrl?: string;
  responseBody: string | null;
  responseBodyKind: BodyKind;
  responseBodyTruncated: boolean;
  /** Length of the captured body before truncation, in UTF-16 units. */
  responseBodyBytes: number;
  /** True once the body was dropped to stay under the global byte budget. */
  bodyEvicted: boolean;

  /**
   * Set when netspect interfered with this request instead of just watching it. Carried
   * into every export: a report full of network errors must not be mistaken for a real
   * outage by whoever receives it.
   */
  simulated?: SimulatedFault;
  /** Delay netspect added before the request left JS. Present alongside any `simulated`. */
  simulatedLatencyMs?: number;

  /** Wall-clock start, for display and HAR export. */
  startedAt: number;
  durationMs: number;
};

/** What the simulator did to a request. `latency` still went to the real server. */
export type SimulatedFault = 'latency' | 'offline' | 'timeout' | 'status';

export type NetworkProfileId =
  | 'online'
  | 'offline'
  | 'slow-3g'
  | 'fast-3g'
  | 'timeout'
  | 'status'
  | 'custom';

export type NetworkFault = 'none' | 'offline' | 'timeout' | 'status';

/** The single active simulation. In-memory only — an app restart is always a clean slate. */
export type NetworkCondition = {
  profile: NetworkProfileId;
  /** Delay before the request leaves JS. Applies whether or not it is faulted. */
  latencyMs: number;
  /** 0..1 probability that a matching request is faulted. 1 for the named fault profiles. */
  failureRate: number;
  fault: NetworkFault;
  /** For `fault: 'status'`. */
  status: number;
  statusBody: string | null;
  /** Substring matched against the URL. Blank means every request. */
  urlFilter: string | null;
};

/** What to do with one request. The only thing `decide` returns. */
export type Verdict =
  | { action: 'pass' }
  | { action: 'delay'; ms: number }
  | { action: 'fail'; kind: 'offline' | 'timeout'; afterMs: number }
  | { action: 'respond'; status: number; body: string | null; afterMs: number };

/** Everything the host app hands in. The library itself reads no native modules. */
export type InfoProviders = {
  /** Raw env map, e.g. `react-native-config`'s default export. */
  env?: () => Record<string, string | undefined>;
  /** Device / build facts, e.g. from `react-native-device-info`. */
  device?: () => Record<string, string | number | boolean | undefined>;
};

export type ExportSinks = {
  copy?: (text: string) => void | Promise<void>;
  share?: (text: string, filename: string) => void | Promise<void>;
  /** Supplied by an adapter when a filesystem package is available. */
  writeFile?: (text: string, filename: string) => Promise<string>;
};

export type NetspectConfig = {
  /** Master switch. When false, capture is a no-op and the overlay renders null. */
  enabled: boolean;
  /** Capture request/response bodies at all. Toggleable at runtime. */
  captureBodies: boolean;
  maxEntries: number;
  /** Per-body cap, in UTF-16 units. */
  maxBodyBytes: number;
  /** Global ceiling across all retained bodies; oldest bodies evicted first. */
  maxTotalBodyBytes: number;
  ignoreUrls: RegExp[];
  ignoreContentTypes: RegExp[];
  /** Header names (lower-cased) whose values are masked. */
  redactHeaders: string[];
  /** Matched against JSON body keys, case-insensitively. */
  redactBodyKeys: RegExp;
  /** Matched against env keys; matching values are masked in the info panel. */
  redactEnvKeys: RegExp;
  providers: InfoProviders;
  sinks: ExportSinks;
};

/** A request the XHR patch cannot see (native networking), reported by the host. */
export type ManualEntry = {
  method: string;
  url: string;
  requestHeaders?: HeaderMap;
  requestBody?: string | null;
  status?: number;
  responseHeaders?: HeaderMap;
  responseBody?: string | null;
  outcome?: Outcome;
  durationMs?: number;
  note?: string;
};
