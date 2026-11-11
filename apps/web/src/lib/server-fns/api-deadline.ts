import { ApiError } from "./api-error";

export const API_TIMEOUT_MS = 8000;
export const API_RETRY_BUDGET_MS = 3000;
const RETRY_BACKOFF_MS = [100, 200, 400, 800] as const;

const RETRYABLE_METHODS = new Set(["GET", "HEAD"]);
const CONNECTION_ERROR_CODES = new Set([
  "ECONNREFUSED",
  "ECONNRESET",
  "EHOSTUNREACH",
  "ENETUNREACH",
  "ENOTFOUND",
  "EAI_AGAIN",
]);

function isConnectionError(error: unknown): boolean {
  const code = (error as { code?: unknown } | null)?.code;
  return typeof code === "string" && CONNECTION_ERROR_CODES.has(code);
}

function sleep(ms: number, signal: AbortSignal): Promise<void> {
  // oxlint-disable-next-line promise/avoid-new -- wrapping the callback-based setTimeout
  return new Promise((resolve, reject) => {
    const onAbort = () => {
      clearTimeout(timer);
      // oxlint-disable-next-line typescript/prefer-promise-reject-errors -- the caller's own abort reason
      reject(signal.reason);
    };
    const timer = setTimeout(() => {
      signal.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    signal.addEventListener("abort", onAbort, { once: true });
  });
}

/**
 * Bounds the wait for response headers, so a stuck API call fails as a 504
 * {@link ApiError}. A caller's own abort still rejects with its own reason.
 */
export async function fetchWithDeadline(
  input: string | Request,
  init: RequestInit,
  message: string,
): Promise<Response> {
  const url = typeof input === "string" ? input : input.url;
  const method = (init.method ?? (typeof input === "string" ? "GET" : input.method)).toUpperCase();
  const retryable = RETRYABLE_METHODS.has(method);
  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, API_TIMEOUT_MS);
  const callerSignal = init.signal ?? (typeof input === "string" ? undefined : input.signal);
  const forwardAbort = () => controller.abort(callerSignal?.reason);
  if (callerSignal?.aborted) {
    forwardAbort();
  } else {
    callerSignal?.addEventListener("abort", forwardAbort, { once: true });
  }
  const startedAt = Date.now();
  let retries = 0;
  let answered = false;
  try {
    for (;;) {
      try {
        const response = await fetch(input, { ...init, signal: controller.signal });
        answered = true;
        return response;
      } catch (error) {
        const delay = RETRY_BACKOFF_MS[Math.min(retries, RETRY_BACKOFF_MS.length - 1)] ?? 0;
        const withinBudget = Date.now() - startedAt + delay <= API_RETRY_BUDGET_MS;
        if (!retryable || controller.signal.aborted || !isConnectionError(error) || !withinBudget) {
          throw error;
        }
        retries += 1;
        await sleep(delay, controller.signal);
      }
    }
  } catch (error) {
    if (!timedOut) {
      throw error;
    }
    const diagnostic = `${method} ${url} → no response after ${API_TIMEOUT_MS} ms`;
    console.error(`[${message || "API request"}]`, { url, method, timeoutMs: API_TIMEOUT_MS });
    throw new ApiError(message, { status: 504, diagnostic });
  } finally {
    clearTimeout(timer);
    if (retries > 0) {
      const outcome = answered ? "answered" : "failed";
      console.warn(`[API retry] ${method} ${url} ${outcome} after ${retries} retries`);
    }
    callerSignal?.removeEventListener("abort", forwardAbort);
  }
}
