import type { Fetch } from "../../../../io.js";
import type { PacingGate } from "./paced-http.js";
import { createPacedHttp } from "./paced-http.js";
import { httpFailureMessage, SourceHttpError, SourceThrottledError } from "./source-http.js";

// The source claims 100 requests/minute but throttles bulk queries far
// earlier (six searches in twenty seconds drew a 429), and it names its own
// cool-down in the response body.
const REQUEST_SPACING_MS = 2000;
const REQUEST_JITTER_MS = 500;

const MAX_THROTTLE_WAIT_MS = 120_000;

const REQUEST_TIMEOUT_MS = 120_000;
const BLOCK_RETRY_DELAY_MS = 15_000;

/** A 4xx that isn't a throttle; retrying cannot help. */
export class TopdeckRefusedError extends SourceHttpError {
  constructor(message: string, status = 400) {
    super(status, message);
    this.name = "TopdeckRefusedError";
  }
}

export class TopdeckThrottledError extends SourceThrottledError {
  constructor(url: string) {
    super(url, `topdeck kept throttling: ${url}`);
    this.name = "TopdeckThrottledError";
  }
}

export interface TopdeckSearchBody {
  game: string;
  format: string;
  /** Unix seconds. */
  start?: number;
  end?: number;
  columns?: string[];
}

export interface TopdeckClientOptions {
  fetch: Fetch;
  baseUrl: string;
  apiKey: string;
  gate?: PacingGate;
  userAgent?: string;
  sleep?: (ms: number) => Promise<void>;
  random?: () => number;
  now?: () => number;
}

export interface TopdeckClient {
  searchTournaments: (body: TopdeckSearchBody) => Promise<unknown[]>;
  readonly requests: number;
}

function throttleWaitMs(text: string): number | null {
  try {
    const body: unknown = JSON.parse(text);
    const seconds = (body as { retryAfterSeconds?: unknown }).retryAfterSeconds;
    if (typeof seconds === "number" && Number.isFinite(seconds) && seconds > 0) {
      return Math.min(seconds * 1000, MAX_THROTTLE_WAIT_MS);
    }
    return null;
  } catch {
    return null;
  }
}

export function createTopdeckClient(options: TopdeckClientOptions): TopdeckClient {
  const http = createPacedHttp({
    fetch: options.fetch,
    gate: options.gate,
    userAgent: options.userAgent,
    sleep: options.sleep,
    random: options.random,
    now: options.now,
    spacingMs: REQUEST_SPACING_MS,
    jitterMs: REQUEST_JITTER_MS,
    timeoutMs: REQUEST_TIMEOUT_MS,
    blockRetryDelayMs: BLOCK_RETRY_DELAY_MS,
    refusedError: (status, url, body) =>
      new TopdeckRefusedError(httpFailureMessage(status, url, body), status),
    throttleWaitMs,
    throttledError: (url) => new TopdeckThrottledError(url),
  });

  return {
    searchTournaments: async (body: TopdeckSearchBody): Promise<unknown[]> => {
      const url = new URL("v2/tournaments", options.baseUrl).toString();
      const result = await http.request(
        url,
        {
          expectsJson: true,
          method: "POST",
          headers: {
            "content-type": "application/json",
            accept: "application/json",
            authorization: options.apiKey,
          },
          body: JSON.stringify(body),
        },
        (text) => JSON.parse(text) as unknown,
      );
      if (!Array.isArray(result)) {
        throw new TopdeckRefusedError(
          `topdeck answered ${url} with ${typeof result}, not a tournament list`,
        );
      }
      return result;
    },

    get requests() {
      return http.requests;
    },
  };
}
