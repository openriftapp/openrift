import type { Fetch } from "../../../../io.js";
import type { PacingGate } from "./paced-http.js";
import { createPacedHttp, settled } from "./paced-http.js";

/**
 * The source answers only persisted queries, and their ids are not hashes of
 * the query text, so they are read from the manifest the events page ships.
 */

const EVENTS_PAGE_PATH = "/en-US/events";
const GQL_PATH = "/api/gql";
const MANIFEST_MARKER = '{"format":"apollo-persisted-query-manifest"';

const REQUEST_SPACING_MS = 500;
const REQUEST_JITTER_MS = 250;
const BLOCK_RETRY_DELAY_MS = 15_000;

const MAX_DISCOVERY_DEPTH = 3;
const MAX_DISCOVERY_CHUNKS = 120;

export class PlayriftboundBlockedError extends Error {
  constructor(url: string, response?: string) {
    super(
      `playriftbound refused further requests: ${url}${response === undefined ? "" : ` (${response})`}`,
    );
    this.name = "PlayriftboundBlockedError";
  }
}

/** The source answered and said no; asking again cannot change the answer. */
export class PlayriftboundRefusedError extends Error {
  readonly stopsRun: boolean;

  constructor(message: string, stopsRun = false) {
    super(message);
    this.name = "PlayriftboundRefusedError";
    this.stopsRun = stopsRun;
  }
}

/** The query list could not be read; a later run may succeed. */
export class PlayriftboundUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PlayriftboundUnavailableError";
  }
}

const STALE_QUERY = /persisted[\s_-]?query/iu;
const VALIDATION = /ValidationError/u;

/** A block, or a refused query: no other call this run can succeed. */
export function isRunStopping(error: unknown): boolean {
  return (
    error instanceof PlayriftboundBlockedError ||
    error instanceof PlayriftboundUnavailableError ||
    (error instanceof PlayriftboundRefusedError && error.stopsRun)
  );
}

interface PlayriftboundQueryIds {
  ids: ReadonlyMap<string, string>;
}

/** Shared across runs so each one does not re-download the page's scripts. */
export interface PlayriftboundManifestCache {
  get: () => PlayriftboundQueryIds | null;
  set: (value: PlayriftboundQueryIds | null) => void;
}

export function createManifestCache(): PlayriftboundManifestCache {
  let value: PlayriftboundQueryIds | null = null;
  return {
    get: () => value,
    set: (next) => {
      value = next;
    },
  };
}

export interface PlayriftboundClientOptions {
  fetch: Fetch;
  baseUrl: string;
  gate?: PacingGate;
  cache?: PlayriftboundManifestCache;
  userAgent?: string;
  sleep?: (ms: number) => Promise<void>;
  random?: () => number;
  now?: () => number;
}

export interface PlayriftboundClient {
  /** Returns the response's `data`. */
  query: <T>(operationName: string, variables: Record<string, unknown>) => Promise<T>;
  readonly requests: number;
  readonly blocked: boolean;
}

// The events page is HTML by design, so only the status can signal a block there.
function isBlock(status: number): boolean {
  return status === 403 || status === 429;
}

// The API answers JSON; an HTML page in its place is an edge challenge. An
// HTML 5xx is a gateway error page and is retried like any other 5xx.
function isApiBlock(status: number, text: string): boolean {
  return isBlock(status) || (status < 500 && text.trimStart().startsWith("<"));
}

/** Decodes the body of a single-quoted JS string literal. */
export function decodeJsString(body: string): string {
  let out = "";
  for (let index = 0; index < body.length; index++) {
    const char = body.charAt(index);
    if (char !== "\\") {
      out += char;
      continue;
    }
    const next = body[index + 1] ?? "";
    index++;
    if (next === "n") {
      out += "\n";
    } else if (next === "t") {
      out += "\t";
    } else if (next === "r") {
      out += "\r";
    } else if (next === "b") {
      out += "\b";
    } else if (next === "f") {
      out += "\f";
    } else if (next === "u") {
      out += String.fromCodePoint(Number.parseInt(body.slice(index + 1, index + 5), 16));
      index += 4;
    } else if (next === "x") {
      out += String.fromCodePoint(Number.parseInt(body.slice(index + 1, index + 3), 16));
      index += 2;
    } else {
      out += next;
    }
  }
  return out;
}

/** The persisted-query ids by operation name, or null when the script holds no manifest. */
export function extractManifest(script: string): Map<string, string> | null {
  const start = script.indexOf(MANIFEST_MARKER);
  if (start === -1) {
    return null;
  }
  const quote = script[start - 1];
  if (quote !== "'" && quote !== '"' && quote !== "`") {
    return null;
  }
  let end = start;
  while (end < script.length && script[end] !== quote) {
    end += script[end] === "\\" ? 2 : 1;
  }
  const parsed = JSON.parse(decodeJsString(script.slice(start, end))) as {
    operations?: { id?: unknown; name?: unknown }[];
  };
  const ids = new Map<string, string>();
  for (const operation of parsed.operations ?? []) {
    if (typeof operation.id === "string" && typeof operation.name === "string") {
      ids.set(operation.name, operation.id);
    }
  }
  return ids;
}

/** Absolute chunk URLs in the page, and `static/chunks/…` references inside scripts. */
export function chunkUrls(source: string, assetBase: string): string[] {
  const urls = new Set<string>();
  for (const match of source.matchAll(
    /https?:\/\/[^"'\s]+?\/_next\/static\/chunks\/[\w.~%/[\]-]+\.js/gu,
  )) {
    urls.add(match[0]);
  }
  for (const match of source.matchAll(
    /["'](?:\/_next\/)?(?<path>static\/chunks\/[\w.~%/[\]-]+\.js)["']/gu,
  )) {
    urls.add(new URL(match.groups?.path ?? "", assetBase).toString());
  }
  return [...urls];
}

/** The `_next/` root the page's own chunks load from, which is not always the page's host. */
function assetBaseOf(html: string, pageUrl: string): string {
  const absolute = /(?<base>https?:\/\/[^"'\s]+?\/_next\/)static\/chunks\//u.exec(html);
  return absolute?.groups?.base ?? new URL("/_next/", pageUrl).toString();
}

function errorCodes(body: unknown): string[] {
  const errors = (body as { errors?: unknown } | null)?.errors;
  if (!Array.isArray(errors)) {
    return [];
  }
  return errors.map((error) => {
    const row = (error ?? {}) as {
      message?: unknown;
      extensions?: { code?: unknown; classification?: unknown; errorType?: unknown };
    };
    const parts = [
      row.extensions?.code,
      row.extensions?.classification,
      row.extensions?.errorType,
      row.message,
    ];
    return parts
      .filter((part): part is string => typeof part === "string")
      .join(" ")
      .trim();
  });
}

/** Sequential by construction: every call awaits the previous one's spacing. */
export function createPlayriftboundClient(
  options: PlayriftboundClientOptions,
): PlayriftboundClient {
  const baseUrl = options.baseUrl;
  const cache = options.cache ?? createManifestCache();
  const http = createPacedHttp({
    fetch: options.fetch,
    gate: options.gate,
    userAgent: options.userAgent,
    sleep: options.sleep,
    random: options.random,
    now: options.now,
    spacingMs: REQUEST_SPACING_MS,
    jitterMs: REQUEST_JITTER_MS,
    blockRetryDelayMs: BLOCK_RETRY_DELAY_MS,
    isBlock,
    blockedError: (url, detail) => new PlayriftboundBlockedError(url, detail),
    refusedError: (message) => new PlayriftboundRefusedError(message),
  });
  let rediscovered = false;
  let discoveryFailure: Error | null = null;
  let runStopped: PlayriftboundRefusedError | null = null;
  let queue: Promise<unknown> = Promise.resolve();

  function fetchText(url: string, headers: Record<string, string>): Promise<string> {
    return http.request(url, { headers });
  }

  /** A query list that cannot be read stops the run: every later call would fail the same way. */
  async function discover(): Promise<PlayriftboundQueryIds> {
    if (discoveryFailure !== null) {
      throw discoveryFailure;
    }
    try {
      return await discoverOnce();
    } catch (error) {
      discoveryFailure =
        error instanceof PlayriftboundBlockedError ||
        (error instanceof PlayriftboundRefusedError && error.stopsRun)
          ? error
          : new PlayriftboundUnavailableError(
              `Reading the query list failed: ${error instanceof Error ? error.message : String(error)}`,
            );
      throw discoveryFailure;
    }
  }

  let scriptFailed = false;

  /** One script that fails to load is skipped; a later one may still hold the list. */
  async function readScript(url: string): Promise<string | null> {
    try {
      return await http.request(url, {
        headers: { accept: "*/*" },
        isBlock: (status) => status === 429,
      });
    } catch (error) {
      if (error instanceof PlayriftboundBlockedError) {
        throw error;
      }
      if (!(error instanceof PlayriftboundRefusedError)) {
        scriptFailed = true;
      }
      return null;
    }
  }

  async function discoverOnce(): Promise<PlayriftboundQueryIds> {
    scriptFailed = false;
    const pageUrl = new URL(EVENTS_PAGE_PATH, baseUrl).toString();
    const html = await fetchText(pageUrl, { accept: "text/html" });
    const assetBase = assetBaseOf(html, pageUrl);
    const seen = new Set<string>();
    let frontier = chunkUrls(html, assetBase);
    for (let depth = 0; depth < MAX_DISCOVERY_DEPTH && frontier.length > 0; depth++) {
      const next: string[] = [];
      for (const url of frontier) {
        if (seen.has(url) || seen.size >= MAX_DISCOVERY_CHUNKS) {
          continue;
        }
        seen.add(url);
        const script = await readScript(url);
        if (script === null) {
          continue;
        }
        const ids = extractManifest(script);
        if (ids !== null) {
          return { ids };
        }
        next.push(...chunkUrls(script, assetBase));
      }
      frontier = next;
    }
    const missing = `No persisted-query manifest among the ${seen.size} scripts the events page loads.`;
    if (scriptFailed) {
      throw new Error(`${missing} Some scripts failed to load.`);
    }
    throw new PlayriftboundRefusedError(missing, true);
  }

  async function queryIds(): Promise<PlayriftboundQueryIds> {
    const cached = cache.get();
    if (cached !== null) {
      return cached;
    }
    const discovered = await discover();
    cache.set(discovered);
    return discovered;
  }

  async function send(
    ids: PlayriftboundQueryIds,
    operationName: string,
    variables: Record<string, unknown>,
  ): Promise<unknown> {
    const id = ids.ids.get(operationName);
    if (id === undefined) {
      return { errors: [{ extensions: { code: "PERSISTED_QUERY_NOT_IN_LIST" } }] };
    }
    const url = new URL(GQL_PATH, baseUrl);
    url.searchParams.set("operationName", operationName);
    url.searchParams.set("variables", JSON.stringify(variables));
    url.searchParams.set(
      "extensions",
      JSON.stringify({ persistedQuery: { version: 1, sha256Hash: id } }),
    );
    return await http.request(
      url.toString(),
      {
        headers: {
          accept: "application/json",
          "content-type": "application/json",
          // Must be non-empty; the values themselves are not checked.
          "apollographql-client-name": "Esports Web",
          "apollographql-client-version": "1",
        },
        isBlock: isApiBlock,
        // GraphQL servers answer a refused query with a 400 and the errors as JSON.
        readStatuses: [400],
      },
      (text) => JSON.parse(text) as unknown,
    );
  }

  async function query<T>(operationName: string, variables: Record<string, unknown>): Promise<T> {
    if (runStopped !== null) {
      throw runStopped;
    }
    let body = await send(await queryIds(), operationName, variables);
    if (errorCodes(body).some((code) => STALE_QUERY.test(code)) && !rediscovered) {
      rediscovered = true;
      cache.set(null);
      body = await send(await queryIds(), operationName, variables);
    }
    const codes = errorCodes(body);
    const data = (body as { data?: unknown } | null)?.data;
    if (codes.length > 0 && (data === null || data === undefined)) {
      // A refused query fails the same way for every call; a refused event does not.
      const stopsRun = codes.some((code) => STALE_QUERY.test(code) || VALIDATION.test(code));
      const refusal = new PlayriftboundRefusedError(
        `${operationName}: ${codes.join("; ").slice(0, 300)}`,
        stopsRun,
      );
      if (stopsRun) {
        // The next run starts from a fresh read of the query list.
        cache.set(null);
        runStopped = refusal;
      }
      throw refusal;
    }
    return data as T;
  }

  return {
    query: <T>(operationName: string, variables: Record<string, unknown>): Promise<T> => {
      const previous = queue;
      const current = (async () => {
        await settled(previous);
        return await query<T>(operationName, variables);
      })();
      queue = settled(current);
      return current;
    },
    get requests() {
      return http.requests;
    },
    get blocked() {
      return http.blocked;
    },
  };
}
