import { describe, expect, it } from "vitest";

import { discordRetryAfterMs } from "./discord-rate-limit.js";

function limited(headers?: Record<string, string>): Response {
  return new Response(null, { status: 429, headers });
}

describe("discordRetryAfterMs", () => {
  it("reads retry_after seconds from the body, rounded up to whole milliseconds", () => {
    expect(discordRetryAfterMs(limited(), '{"retry_after":2.5004}')).toBe(2501);
  });

  it("prefers the body over the Retry-After header", () => {
    expect(discordRetryAfterMs(limited({ "Retry-After": "9" }), '{"retry_after":1}')).toBe(1000);
  });

  it("falls back to the Retry-After header when the body has no number", () => {
    expect(discordRetryAfterMs(limited({ "Retry-After": "3" }), "not json")).toBe(3000);
    expect(discordRetryAfterMs(limited({ "Retry-After": "3" }), '{"retry_after":"2"}')).toBe(3000);
  });

  it("waits one second when neither body nor header names a delay", () => {
    expect(discordRetryAfterMs(limited(), "")).toBe(1000);
    expect(discordRetryAfterMs(limited({ "Retry-After": "soon" }), "null")).toBe(1000);
  });
});
