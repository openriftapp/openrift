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
