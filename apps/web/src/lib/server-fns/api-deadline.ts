import { ApiError } from "./api-error";

export const API_TIMEOUT_MS = 15_000;

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
  const method = init.method ?? (typeof input === "string" ? "GET" : input.method);
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
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } catch (error) {
    if (!timedOut) {
      throw error;
    }
    const diagnostic = `${method} ${url} → no response after ${API_TIMEOUT_MS} ms`;
    console.error(`[${message || "API request"}]`, { url, method, timeoutMs: API_TIMEOUT_MS });
    throw new ApiError(message, { status: 504, diagnostic });
  } finally {
    clearTimeout(timer);
    callerSignal?.removeEventListener("abort", forwardAbort);
  }
}
