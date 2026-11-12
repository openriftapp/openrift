import type { Fetch } from "../../../../io.js";
import type { PacingGate } from "./paced-http.js";
import { createPacedHttp } from "./paced-http.js";
import { httpFailureMessage, SourceHttpError } from "./source-http.js";

// Only v2 endpoints are reachable through this client: the legacy endpoints
// hand back players' real names and email addresses. The event detail still
// carries the store's contact address, which the deep fetch strips before
// anything is stored.
export const MAX_PAGE_SIZE = 250;

const REQUEST_SPACING_MS = 600;

const REQUEST_JITTER_MS = 200;
const BLOCK_RETRY_DELAY_MS = 15_000;

/** DRF's page-number envelope. */
export interface UvsPage<T> {
  results: T[];
  count: number;
  nextPage: number | null;
}

export type UvsQuery = Record<string, string | number | boolean | undefined>;

export class UvsHttpError extends SourceHttpError {
  constructor(status: number, url: string, body: string) {
    super(status, httpFailureMessage(status, url, body));
    this.name = "UvsHttpError";
  }
}

export interface UvsClientOptions {
  fetch: Fetch;
  baseUrl: string;
  gate?: PacingGate;
  waitOnThrottle?: boolean;
  userAgent?: string;
  sleep?: (ms: number) => Promise<void>;
  random?: () => number;
  now?: () => number;
}

export interface UvsClient {
  get: <T>(path: string, query?: UvsQuery) => Promise<T>;
  page: <T>(path: string, query: UvsQuery, page: number, pageSize?: number) => Promise<UvsPage<T>>;
  readonly requests: number;
}

function buildUrl(baseUrl: string, path: string, query: UvsQuery | undefined): string {
  const url = new URL(path, baseUrl);
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== undefined) {
      url.searchParams.set(key, String(value));
    }
  }
  return url.toString();
}

function readPage<T>(body: unknown): UvsPage<T> {
  const row = (typeof body === "object" && body !== null ? body : {}) as Record<string, unknown>;
  const results = Array.isArray(row.results) ? (row.results as T[]) : [];
  const count = row.count;
  return {
    results,
    count: typeof count === "number" && Number.isFinite(count) ? count : results.length,
    nextPage: typeof row.next_page_number === "number" ? row.next_page_number : null,
  };
}

export function createUvsClient(options: UvsClientOptions): UvsClient {
  const http = createPacedHttp({
    fetch: options.fetch,
    gate: options.gate,
    waitOnThrottle: options.waitOnThrottle,
    userAgent: options.userAgent,
    sleep: options.sleep,
    random: options.random,
    now: options.now,
    spacingMs: REQUEST_SPACING_MS,
    jitterMs: REQUEST_JITTER_MS,
    blockRetryDelayMs: BLOCK_RETRY_DELAY_MS,
    refusedError: (status, url, body) => new UvsHttpError(status, url, body),
  });

  function getJson(url: string): Promise<unknown> {
    return http.request(
      url,
      { expectsJson: true, headers: { accept: "application/json" } },
      (text) => JSON.parse(text) as unknown,
    );
  }

  return {
    get: async <T>(path: string, query?: UvsQuery): Promise<T> =>
      (await getJson(buildUrl(options.baseUrl, path, query))) as T,

    page: async <T>(path: string, query: UvsQuery, page: number, pageSize = MAX_PAGE_SIZE) =>
      readPage<T>(
        await getJson(buildUrl(options.baseUrl, path, { ...query, page, page_size: pageSize })),
      ),

    get requests() {
      return http.requests;
    },
  };
}
