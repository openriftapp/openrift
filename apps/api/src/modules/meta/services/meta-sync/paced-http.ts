import type { Fetch } from "../../../../io.js";
import { metaSyncUserAgent } from "./user-agent.js";

const MAX_ATTEMPTS = 3;
const RETRY_BASE_DELAY_MS = 1000;
const REQUEST_TIMEOUT_MS = 30_000;

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
  blockRetryDelayMs: number;
  isBlock: (status: number, text: string) => boolean;
  blockedError: (url: string, detail?: string) => Error;
  refusedError: (message: string) => Error;
}

export interface PacedRequest {
  method?: "GET" | "POST";
  headers?: Record<string, string>;
  body?: string;
  isBlock?: (status: number, text: string) => boolean;
  readStatuses?: readonly number[];
}

export interface PacedHttp {
  /** A 2xx body that `parse` (the text itself by default) reads; a body it cannot read is retried. */
  request: <T = string>(
    url: string,
    init?: PacedRequest,
    parse?: (text: string) => T,
  ) => Promise<T>;
  readonly requests: number;
  readonly blocked: boolean;
}

function isRetryableStatus(status: number): boolean {
  return status >= 500 || status === 429;
}

export async function settled(promise: Promise<unknown>): Promise<void> {
  try {
    await promise;
  } catch {
    // Reported to whoever made that call.
  }
}

type Outcome<T> = { value: T } | { error: Error; retryable: boolean; block: boolean };

/**
 * A source that answers a burst with a block keeps refusing for hours, so after
 * one patient retry the client latches `blocked` and fails fast.
 */
export function createPacedHttp(options: PacedHttpOptions): PacedHttp {
  const userAgent = options.userAgent ?? metaSyncUserAgent();
  const sleep = options.sleep ?? ((ms: number) => Bun.sleep(ms));
  const random = options.random ?? Math.random;
  const now = options.now ?? Date.now;

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
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
      const text = await response.text();
      const isBlock = init.isBlock ?? options.isBlock;
      if (isBlock(response.status, text)) {
        return {
          error: new Error(`HTTP ${response.status}: ${text.slice(0, 200)}`),
          retryable: false,
          block: true,
        };
      }
      if (!response.ok && !(init.readStatuses ?? []).includes(response.status)) {
        const retryable = isRetryableStatus(response.status);
        const message = `HTTP ${response.status} for ${url}: ${text.slice(0, 200)}`;
        return {
          error: retryable ? new Error(message) : options.refusedError(message),
          retryable,
          block: false,
        };
      }
      if (!response.ok) {
        try {
          return { value: parse(text) };
        } catch {
          const message = `HTTP ${response.status} for ${url}: ${text.slice(0, 200)}`;
          return { error: options.refusedError(message), retryable: false, block: false };
        }
      }
      return { value: parse(text) };
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
      throw options.blockedError(url);
    }
    let lastError: Error | null = null;
    let blockTries = 0;
    for (let tries = 0; tries < MAX_ATTEMPTS; tries++) {
      if (tries > 0) {
        await sleep(RETRY_BASE_DELAY_MS * 2 ** (tries - 1) + random() * options.jitterMs);
      }
      await pace();
      requests++;
      const outcome = await attemptOnce(url, init, parse);
      if ("value" in outcome) {
        return outcome.value;
      }
      lastError = outcome.error;
      if (outcome.block) {
        if (blockTries === 0 && tries < MAX_ATTEMPTS - 1) {
          blockTries++;
          await sleep(options.blockRetryDelayMs);
          continue;
        }
        blocked = true;
        throw options.blockedError(url, outcome.error.message);
      }
      if (!outcome.retryable) {
        throw lastError;
      }
    }
    throw lastError ?? new Error(`Request failed: ${url}`);
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
