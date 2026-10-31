import type { Verdict } from '../types';

/**
 * The only module that touches XMLHttpRequest internals, kept apart so the blast radius of
 * that coupling is one small file with one job.
 *
 * Faults are injected through RN's *own* completion path rather than by dispatching events
 * by hand. `XMLHttpRequest.__didCompleteResponse` (commented `// exposed for testing` in
 * RN's source) sets `_hasError`/`_timedOut` and then calls `setReadyState(DONE)`, which
 * already knows to dispatch `abort` / `timeout` / `error` / `load` and then `loadend`, in
 * that order. So axios and `fetch` see exactly what a real failure looks like, and there is
 * no event ordering for us to get wrong.
 */

/** Fallback for `xhr.DONE`, which RN also exposes per-instance. */
const DONE = 4;

/** Marks a synthesised response so the fake is visible in the captured headers. */
const MARKER = 'x-netspect-simulated';

/**
 * Returns false when the fault could not be injected, which tells the caller to send the
 * request for real. That fallback matters: silently dropping a request would leave the app
 * waiting on a promise that never settles, which is far worse than not simulating.
 */
export function applyFault(xhr: any, verdict: Verdict): boolean {
  if (verdict.action !== 'fail' && verdict.action !== 'respond') return false;

  try {
    // The app may have cancelled, or another patcher completed it, while we sat in the
    // delay. Either way there is nothing left to do — and nothing left to send.
    if (xhr._aborted || xhr.readyState === (xhr.DONE ?? DONE)) return true;
    if (typeof xhr.__didCompleteResponse !== 'function') return false;

    if (verdict.action === 'respond') {
      const body = verdict.body ?? '';
      xhr.status = verdict.status;
      setResponseHeaders(xhr, {
        'Content-Type': 'application/json',
        [MARKER]: 'status',
      });
      // `responseText` reads this directly; it is the one private field needed, and
      // `core/bodies.ts` already depends on it for the blob size.
      xhr._response = body;
      // Empty error string -> RN treats it as success and dispatches `load`.
      xhr.__didCompleteResponse(xhr._requestId, '', false);
      return true;
    }

    const timedOut = verdict.kind === 'timeout';
    setResponseHeaders(xhr, { [MARKER]: verdict.kind });
    // The message RN itself passes for these two cases, so anything matching on it keeps
    // working. RN copies it into `_response` for text responses, exactly as it would for a
    // genuine failure.
    xhr.__didCompleteResponse(
      xhr._requestId,
      timedOut ? 'Request timed out' : 'Network request failed',
      timedOut,
    );
    return true;
  } catch {
    // A simulator bug must never strand a request.
    return false;
  }
}

function setResponseHeaders(xhr: any, headers: Record<string, string>): void {
  if (typeof xhr.setResponseHeaders === 'function') {
    xhr.setResponseHeaders(headers);
    return;
  }
  xhr.responseHeaders = headers;
}
