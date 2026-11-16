import { MINUTE_MS } from "./format-date.js";

const DEFAULT_RETRY_AFTER_MS = 1000;

function parseRateLimitBody(body: string): { retry_after?: unknown } | null {
  try {
    return JSON.parse(body) as { retry_after?: unknown } | null;
  } catch {
    return null;
  }
}

export function discordRetryAfterMs(response: Response, body: string): number {
  const parsed = parseRateLimitBody(body);
  if (typeof parsed?.retry_after === "number") {
    return Math.ceil(parsed.retry_after * 1000);
  }
  const header = Number(response.headers.get("retry-after") ?? Number.NaN);
  return Number.isFinite(header) ? header * 1000 : DEFAULT_RETRY_AFTER_MS;
}

const MAX_RATE_LIMIT_RETRIES = 3;
const MAX_RETRY_AFTER_MS = MINUTE_MS;

export type DiscordSendResult =
  | { ok: true; response: Response }
  | { ok: false; status: number; body: string };

/** Network errors and timeouts throw; only a 429 is retried. */
export async function sendWithDiscordRetry(
  send: (signal: AbortSignal) => Promise<Response>,
  options: {
    /** ms */
    timeoutMs: number;
    sleep: (ms: number) => Promise<unknown>;
    onRateLimited?: (waitMs: number, attempt: number) => void;
  },
): Promise<DiscordSendResult> {
  for (let attempt = 0; ; attempt++) {
    const response = await send(AbortSignal.timeout(options.timeoutMs));
    if (response.ok) {
      return { ok: true, response };
    }
    const body = await response.text().catch(() => "");
    if (response.status === 429 && attempt < MAX_RATE_LIMIT_RETRIES) {
      const waitMs = discordRetryAfterMs(response, body);
      if (waitMs <= MAX_RETRY_AFTER_MS) {
        options.onRateLimited?.(waitMs, attempt);
        await options.sleep(waitMs);
        continue;
      }
    }
    return { ok: false, status: response.status, body };
  }
}
