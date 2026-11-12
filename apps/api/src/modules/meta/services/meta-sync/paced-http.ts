import type { Fetch } from "../../../../io.js";
import {
  httpFailureMessage,
  isHtmlChallenge,
  isPermanentRefusal,
  isTransientStatus,
  SourceBlockedError,
  SourceHttpError,
  SourceThrottledError,
} from "./source-http.js";
import { metaSyncUserAgent } from "./user-agent.js";

const MAX_ATTEMPTS = 3;
const RETRY_BASE_DELAY_MS = 1000;
const DEFAULT_TIMEOUT_MS = 30_000;
const DEFAULT_THROTTLE_WAIT_MS = 30_000;
const MAX_THROTTLE_WAIT_MS = 120_000;

export interface PacingGate {
  lastStartedAt: number;
  turn: Promise<void>;
}

/** Clients that share a gate share one request spacing, whichever run they belong to. */
export function createPacingGate(): PacingGate {
  return { lastStartedAt: 0, turn: Promise.resolve() };
}

export interface PacedHttpOptions {
  fetch: Fetch;
  gate?: PacingGate;
  userAgent?: string;
  sleep?: (ms: number) => Promise<void>;
  random?: () => number;
  now?: () => number;
  spacingMs: number;
  jitterMs: number;
  /** ms */
  timeoutMs?: number;
  blockRetryDelayMs?: number;
  isBlock?: (status: number, text: string) => boolean;
  blockedError?: (url: string, detail?: string) => Error;
  refusedError: (status: number, url: string, body: string) => Error;
  throttleWaitMs?: (text: string) => number | null;
  throttledError?: (url: string) => Error;
  waitOnThrottle?: boolean;
}

interface PacedRequest {
  expectsJson?: boolean;
  method?: "GET" | "POST";
  headers?: Record<string, string>;
  body?: string;
  isBlock?: (status: number, text: string) => boolean;
  readStatuses?: readonly number[];
}

export interface PacedHttp {
  request: <T = string>(
    url: string,
    init?: PacedRequest,
    parse?: (text: string) => T,
  ) => Promise<T>;
  readonly requests: number;
  readonly blocked: boolean;
}

export async function settled(promise: Promise<unknown>): Promise<void> {
  try {
    await promise;
  } catch {
    // Reported to whoever made that call.
  }
}

function retryAfterMs(headers: Headers): number | null {
  const raw = headers.get("retry-after");
  if (raw === null) {
    return null;
  }
  const seconds = Number(raw);
  if (Number.isFinite(seconds) && seconds > 0) {
    return seconds * 1000;
  }
  const at = Date.parse(raw);
  return Number.isNaN(at) ? null : Math.max(0, at - Date.now());
}

type Outcome<T> =
  | { value: T }
  | { throttleMs: number; error: Error }
  | { error: Error; retryable: boolean; block: boolean };

export function createPacedHttp(options: PacedHttpOptions): PacedHttp {
  const userAgent = options.userAgent ?? metaSyncUserAgent();
  const sleep = options.sleep ?? ((ms: number) => Bun.sleep(ms));
  const random = options.random ?? Math.random;
  const now = options.now ?? Date.now;
  const isBlock = options.isBlock ?? (() => false);
  const blockedError =
    options.blockedError ??
    ((url: string, detail?: string) =>
      new SourceBlockedError(
        `The source blocked ${url}${detail === undefined ? "" : ` (${detail})`}`,
      ));
  const throttledError = options.throttledError ?? ((url: string) => new SourceThrottledError(url));

  let requests = 0;
  let blocked = false;
  const gate = options.gate ?? createPacingGate();
  let queue: Promise<unknown> = Promise.resolve();

  async function pace(): Promise<void> {
    const previous = gate.turn;
    const turn = (async () => {
      await previous;
      const wait = gate.lastStartedAt + options.spacingMs + random() * options.jitterMs - now();
      if (wait > 0) {
        await sleep(wait);
      }
      gate.lastStartedAt = now();
    })();
    gate.turn = settled(turn);
    await turn;
  }

  function throttleWait(headers: Headers, text: string): number {
    const named = options.throttleWaitMs?.(text) ?? retryAfterMs(headers);
    return Math.min(named ?? DEFAULT_THROTTLE_WAIT_MS, MAX_THROTTLE_WAIT_MS);
  }

  async function attemptOnce<T>(
    url: string,
    init: PacedRequest,
    parse: (text: string) => T,
  ): Promise<Outcome<T>> {
    try {
      const response = await options.fetch(url, {
        method: init.method ?? "GET",
        headers: { "user-agent": userAgent, ...init.headers },
        ...(init.body === undefined ? {} : { body: init.body }),
        signal: AbortSignal.timeout(options.timeoutMs ?? DEFAULT_TIMEOUT_MS),
      });
      const text = await response.text();
      const challenge = init.expectsJson === true && isHtmlChallenge(response.status, text);
      if (challenge || (init.isBlock ?? isBlock)(response.status, text)) {
        return {
          error: new Error(`HTTP ${response.status}: ${text.slice(0, 200)}`),
          retryable: false,
          block: true,
        };
      }
      const message = httpFailureMessage(response.status, url, text);
      if (response.status === 429) {
        return { throttleMs: throttleWait(response.headers, text), error: new Error(message) };
      }
      if (!response.ok && !(init.readStatuses ?? []).includes(response.status)) {
        const retryable = isTransientStatus(response.status);
        return {
          error: retryable
            ? new SourceHttpError(response.status, message)
            : options.refusedError(response.status, url, text),
          retryable,
          block: false,
        };
      }
      if (!response.ok) {
        try {
          return { value: parse(text) };
        } catch {
          return {
            error: options.refusedError(response.status, url, text),
            retryable: false,
            block: false,
          };
        }
      }
      try {
        return { value: parse(text) };
      } catch (error) {
        if (isPermanentRefusal(error)) {
          return { error: error as Error, retryable: false, block: false };
        }
        throw error;
      }
    } catch (error) {
      return {
        error: error instanceof Error ? error : new Error(String(error)),
        retryable: true,
        block: false,
      };
    }
  }

  async function attempt<T>(
    url: string,
    init: PacedRequest,
    parse: (text: string) => T,
  ): Promise<T> {
    if (blocked) {
      throw blockedError(url);
    }
    let lastError: Error | null = null;
    let failures = 0;
    let blockTries = 0;
    let throttled = false;
    while (failures < MAX_ATTEMPTS) {
      await pace();
      requests++;
      const outcome = await attemptOnce(url, init, parse);
      if ("value" in outcome) {
        return outcome.value;
      }
      lastError = outcome.error;
      if ("throttleMs" in outcome) {
        if (throttled || options.waitOnThrottle === false) {
          throw throttledError(url);
        }
        throttled = true;
        await sleep(outcome.throttleMs);
        continue;
      }
      if (outcome.block) {
        if (blockTries === 0 && failures < MAX_ATTEMPTS - 1) {
          blockTries++;
          failures++;
          await sleep(options.blockRetryDelayMs ?? 0);
          continue;
        }
        blocked = true;
        throw blockedError(url, outcome.error.message);
      }
      if (!outcome.retryable) {
        throw lastError;
      }
      failures++;
      if (failures < MAX_ATTEMPTS) {
        await sleep(RETRY_BASE_DELAY_MS * 2 ** (failures - 1) + random() * options.jitterMs);
      }
    }
    throw lastError instanceof SourceHttpError
      ? lastError
      : new SourceHttpError(0, `${url}: ${lastError?.message ?? "request failed"}`);
  }

  return {
    request: <T = string>(
      url: string,
      init: PacedRequest = {},
      parse: (text: string) => T = (text) => text as T,
    ): Promise<T> => {
      const previous = queue;
      const current = (async () => {
        await settled(previous);
        return await attempt(url, init, parse);
      })();
      queue = settled(current);
      return current;
    },
    get requests() {
      return requests;
    },
    get blocked() {
      return blocked;
    },
  };
}
