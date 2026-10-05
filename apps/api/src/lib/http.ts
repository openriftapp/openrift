import type { Fetch } from "../io.js";

const DEFAULT_TIMEOUT_MS = 10_000;

export interface FetchJsonOptions<T> {
  headers?: Record<string, string>;
  timeoutMs?: number;
  transform?: (body: unknown) => T;
}

/** Throws on a non-2xx response, with the status, URL and body in the message. */
export async function fetchJson<T>(
  fetchFn: Fetch,
  url: string,
  options?: FetchJsonOptions<T>,
): Promise<{ data: T; lastModified: Date | null }> {
  const res = await fetchFn(url, {
    signal: AbortSignal.timeout(options?.timeoutMs ?? DEFAULT_TIMEOUT_MS),
    headers: options?.headers,
  });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} for ${url}: ${await res.text()}`);
  }
  const lm = res.headers.get("last-modified");
  const lastModified = lm ? new Date(lm) : null;
  const body: unknown = await res.json();
  return { data: options?.transform ? options.transform(body) : (body as T), lastModified };
}
