import { nextId } from "./id";

/**
 * Stamped by `attachAxios`, recorded by the XHR patch, and stripped before the request
 * is sent — it never reaches the server.
 */
export const CORRELATION_HEADER = "x-netspect-correlation";

type InterceptorHandle = number;

export type AxiosInstanceLike = {
  interceptors: {
    request: {
      use: (onFulfilled: (config: any) => any) => InterceptorHandle;
      eject: (handle: InterceptorHandle) => void;
    };
  };
};

function readHeader(headers: any): string | undefined {
  if (!headers) return undefined;
  if (typeof headers.get === "function")
    return headers.get(CORRELATION_HEADER) ?? undefined;
  return headers[CORRELATION_HEADER];
}

function writeHeader(headers: any, value: string): void {
  if (!headers) return;
  if (typeof headers.set === "function") headers.set(CORRELATION_HEADER, value);
  else headers[CORRELATION_HEADER] = value;
}

/**
 * Groups every attempt of one logical request under a single id, so a 401-refresh-replay
 * or a 3x network retry reads as one row with "attempt 2/4" rather than as unrelated
 * entries.
 *
 * Only stamping when the header is absent is load-bearing: all three retry paths in a
 * typical axios setup re-invoke `instance(originalRequest)` with the *same* config
 * object, so its headers already carry the id from the first attempt.
 */
export function attachAxios(instance: AxiosInstanceLike): () => void {
  const handle = instance.interceptors.request.use((config: any) => {
    try {
      if (!readHeader(config.headers)) writeHeader(config.headers, nextId());
    } catch {
      // Correlation is a nicety; never fail a request over it.
    }
    return config;
  });
  return () => instance.interceptors.request.eject(handle);
}
