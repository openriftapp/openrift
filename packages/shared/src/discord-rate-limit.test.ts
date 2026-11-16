import { describe, expect, it } from "vitest";

import { discordRetryAfterMs, sendWithDiscordRetry } from "./discord-rate-limit.js";
import { toError } from "./strings.js";

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

describe("sendWithDiscordRetry", () => {
  function rateLimited(retryAfter: number): Response {
    return Response.json({ retry_after: retryAfter }, { status: 429 });
  }

  function recordingSleep() {
    const waits: number[] = [];
    return { waits, sleep: (ms: number) => Promise.resolve(waits.push(ms)) };
  }

  it("waits out a 429 and returns the response that follows", async () => {
    const { waits, sleep } = recordingSleep();
    const responses = [rateLimited(2), new Response("{}", { status: 200 })];
    const result = await sendWithDiscordRetry(() => Promise.resolve(responses.shift()!), {
      timeoutMs: 1000,
      sleep,
    });
    expect(result.ok).toBe(true);
    expect(waits).toEqual([2000]);
  });

  it("gives up after three retries and returns the last 429", async () => {
    const { waits, sleep } = recordingSleep();
    let sends = 0;
    const result = await sendWithDiscordRetry(
      () => {
        sends++;
        return Promise.resolve(rateLimited(1));
      },
      { timeoutMs: 1000, sleep },
    );
    expect(sends).toBe(4);
    expect(waits).toEqual([1000, 1000, 1000]);
    expect(result).toEqual({ ok: false, status: 429, body: '{"retry_after":1}' });
  });

  it("does not wait out a 429 longer than a minute", async () => {
    const { waits, sleep } = recordingSleep();
    const result = await sendWithDiscordRetry(() => Promise.resolve(rateLimited(61)), {
      timeoutMs: 1000,
      sleep,
    });
    expect(waits).toEqual([]);
    expect(result).toMatchObject({ ok: false, status: 429 });
  });

  it("returns any other failure without retrying", async () => {
    const { waits, sleep } = recordingSleep();
    const result = await sendWithDiscordRetry(
      () => Promise.resolve(new Response("nope", { status: 500 })),
      { timeoutMs: 1000, sleep },
    );
    expect(waits).toEqual([]);
    expect(result).toEqual({ ok: false, status: 500, body: "nope" });
  });

  it("aborts a request that outlasts the timeout", async () => {
    const { sleep } = recordingSleep();
    const send = (signal: AbortSignal) =>
      new Promise<Response>((_resolve, reject) => {
        signal.addEventListener("abort", () => reject(toError(signal.reason)));
      });
    await expect(sendWithDiscordRetry(send, { timeoutMs: 5, sleep })).rejects.toMatchObject({
      name: "TimeoutError",
    });
  });
});
