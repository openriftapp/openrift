import type { Fetch } from "../../../../io.js";
import type { PacingGate } from "./paced-http.js";
import { createPacedHttp } from "./paced-http.js";
import { httpFailureMessage, SourceBlockedError, SourceHttpError } from "./source-http.js";

/**
 * The list endpoints' safe page ceiling: bigger pages return empty. A full
 * page on the event listing means the window was cut short, not exhausted.
 */
export const MAX_PAGE_SIZE = 10_000;

const REQUEST_SPACING_MS = 400;
const REQUEST_JITTER_MS = 200;
const WAF_RETRY_DELAY_MS = 15_000;

export class PlayloltcgBlockedError extends SourceBlockedError {
  constructor(url: string, response?: string) {
    super(
      `playloltcg WAF blocked the request: ${url}${response === undefined ? "" : ` (${response})`}`,
    );
    this.name = "PlayloltcgBlockedError";
  }
}

export class PlayloltcgRefusedError extends SourceHttpError {
  constructor(message: string, status = 400) {
    super(status, message);
    this.name = "PlayloltcgRefusedError";
  }
}

type PlayloltcgBody = Record<string, unknown>;

/** A list response, normalized across the source's two shapes. */
export interface PlayloltcgList<T> {
  items: T[];
  /** Null when the source answered with a bare array; not the page's own length. */
  total: number | null;
}

export interface PlayloltcgClientOptions {
  fetch: Fetch;
  baseUrl: string;
  gate?: PacingGate;
  userAgent?: string;
  sleep?: (ms: number) => Promise<void>;
  random?: () => number;
  now?: () => number;
}

type PlayloltcgQuery = Record<string, string | number>;

export interface PlayloltcgClient {
  /** Returns the unwrapped `result`, whatever its shape. */
  post: <T>(path: string, body: PlayloltcgBody) => Promise<T>;
  /** Normalizes `result` (array or `{list,total}`) into a PlayloltcgList. */
  postList: <T>(path: string, body: PlayloltcgBody) => Promise<PlayloltcgList<T>>;
  get: <T>(path: string, query?: PlayloltcgQuery) => Promise<T>;
  readonly requests: number;
  readonly blocked: boolean;
}

/** The WAF answers a burst with a 403 or an HTML interstitial, never JSON. */
function isWafBlock(status: number): boolean {
  return status === 403;
}

const REFUSING_CODES: ReadonlySet<number> = new Set([401, 403, 404, 410]);

/** The source's envelope. `code === 0` is success; `result` shape varies by endpoint. */
function unwrap(body: unknown, url: string): unknown {
  const row = (typeof body === "object" && body !== null ? body : {}) as Record<string, unknown>;
  if (typeof row.code === "number" && row.code !== 0) {
    const detail =
      typeof row.message === "string" ? row.message : JSON.stringify(row.message ?? "");
    const message = `playloltcg code ${row.code} for ${url}: ${detail}`;
    throw REFUSING_CODES.has(row.code)
      ? new PlayloltcgRefusedError(message, row.code)
      : new Error(message);
  }
  return row.result;
}

function asList<T>(result: unknown): PlayloltcgList<T> {
  if (Array.isArray(result)) {
    return { items: result as T[], total: null };
  }
  const row = (typeof result === "object" && result !== null ? result : {}) as Record<
    string,
    unknown
  >;
  const items = Array.isArray(row.list) ? (row.list as T[]) : [];
  const total = typeof row.total === "number" ? row.total : null;
  return { items, total };
}

export function createPlayloltcgClient(options: PlayloltcgClientOptions): PlayloltcgClient {
  const baseUrl = options.baseUrl;
  const http = createPacedHttp({
    fetch: options.fetch,
    gate: options.gate,
    userAgent: options.userAgent,
    sleep: options.sleep,
    random: options.random,
    now: options.now,
    spacingMs: REQUEST_SPACING_MS,
    jitterMs: REQUEST_JITTER_MS,
    blockRetryDelayMs: WAF_RETRY_DELAY_MS,
    isBlock: isWafBlock,
    blockedError: (url, detail) => new PlayloltcgBlockedError(url, detail),
    refusedError: (status, url, body) =>
      new PlayloltcgRefusedError(httpFailureMessage(status, url, body), status),
  });

  function buildUrl(path: string, query?: PlayloltcgQuery): string {
    const u = new URL(path, baseUrl);
    for (const [key, value] of Object.entries(query ?? {})) {
      u.searchParams.set(key, String(value));
    }
    return u.toString();
  }

  async function postJson(path: string, body: PlayloltcgBody): Promise<unknown> {
    const url = buildUrl(path);
    return await http.request(
      url,
      {
        expectsJson: true,
        method: "POST",
        headers: { "content-type": "application/json", accept: "application/json" },
        body: JSON.stringify(body),
      },
      (text) => unwrap(JSON.parse(text), url),
    );
  }

  return {
    post: async <T>(path: string, body: PlayloltcgBody): Promise<T> =>
      (await postJson(path, body)) as T,

    postList: async <T>(path: string, body: PlayloltcgBody): Promise<PlayloltcgList<T>> =>
      asList<T>(await postJson(path, body)),

    get: async <T>(path: string, query?: PlayloltcgQuery): Promise<T> => {
      const url = buildUrl(path, query);
      return (await http.request(
        url,
        { expectsJson: true, headers: { accept: "application/json" } },
        (text) => unwrap(JSON.parse(text), url),
      )) as T;
    },

    get requests() {
      return http.requests;
    },
    get blocked() {
      return http.blocked;
    },
  };
}
