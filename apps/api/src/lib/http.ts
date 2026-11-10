import { setTimeout as sleep } from "node:timers/promises";

import type { Fetch } from "../io.js";

export const DEFAULT_TIMEOUT_MS = 10_000;
const DEFAULT_RETRY_DELAY_MS = 250;

interface FetchOkOptions {
  headers?: Record<string, string>;
  timeoutMs?: number;
  retries?: number;
  retryDelayMs?: number;
  label?: string;
}

export interface FetchJsonOptions<T> extends FetchOkOptions {
  transform?: (body: unknown) => T;
}

type Attempt = { response: Response } | { error: unknown; retryable: boolean };

async function attemptGet(
  fetchFn: Fetch,
  url: string,
  label: string,
  init: { signal: AbortSignal; headers?: Record<string, string> },
): Promise<Attempt> {
  try {
    const res = await fetchFn(url, init);
    if (res.ok) {
      return { response: res };
    }
    return {
      error: new Error(`HTTP ${res.status} for ${label}: ${await res.text()}`),
      retryable: res.status >= 500,
    };
  } catch (error) {
    return { error, retryable: !init.signal.aborted };
  }
}

/** Retries a network error or 5xx up to `retries` times, all attempts within one `timeoutMs`. */
export async function fetchOk(
  fetchFn: Fetch,
  url: string,
  options?: FetchOkOptions,
): Promise<Response> {
  const timeoutMs = options?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const retries = options?.retries ?? 0;
  const retryDelayMs = options?.retryDelayMs ?? DEFAULT_RETRY_DELAY_MS;
  const deadline = Date.now() + timeoutMs;
  const init = { signal: AbortSignal.timeout(timeoutMs), headers: options?.headers };

  for (let attempt = 0; ; attempt++) {
    const outcome = await attemptGet(fetchFn, url, options?.label ?? url, init);
    if ("response" in outcome) {
      return outcome.response;
    }
    const delayMs = retryDelayMs * 2 ** attempt;
    if (!outcome.retryable || attempt >= retries || Date.now() + delayMs >= deadline) {
      throw outcome.error;
    }
    await sleep(delayMs);
  }
}

export async function fetchJson<T>(
  fetchFn: Fetch,
  url: string,
  options?: FetchJsonOptions<T>,
): Promise<{ data: T; lastModified: Date | null }> {
  const res = await fetchOk(fetchFn, url, options);
  const lm = res.headers.get("last-modified");
  const lastModified = lm ? new Date(lm) : null;
  const body: unknown = await res.json();
  return { data: options?.transform ? options.transform(body) : (body as T), lastModified };
}
