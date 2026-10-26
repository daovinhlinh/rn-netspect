/**
 * Stamped by `attachAxios`, recorded by the XHR patch, and stripped before the request
 * is sent — it never reaches the server.
 */
export declare const CORRELATION_HEADER = "x-netspect-correlation";
type InterceptorHandle = number;
export type AxiosInstanceLike = {
    interceptors: {
        request: {
            use: (onFulfilled: (config: any) => any) => InterceptorHandle;
            eject: (handle: InterceptorHandle) => void;
        };
    };
};
/**
 * Groups every attempt of one logical request under a single id, so a 401-refresh-replay
 * or a 3x network retry reads as one row with "attempt 2/4" rather than as unrelated
 * entries.
 *
 * Only stamping when the header is absent is load-bearing: all three retry paths in a
 * typical axios setup re-invoke `instance(originalRequest)` with the *same* config
 * object, so its headers already carry the id from the first attempt.
 */
export declare function attachAxios(instance: AxiosInstanceLike): () => void;
export {};
//# sourceMappingURL=axiosCorrelate.d.ts.map