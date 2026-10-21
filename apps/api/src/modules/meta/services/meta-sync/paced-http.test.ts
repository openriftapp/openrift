import { describe, expect, it } from "vitest";

import type { Fetch } from "../../../../io.js";
import { createPacedHttp, createPacingGate } from "./paced-http.js";

class BlockedError extends Error {
  override name = "BlockedError";
}
class RefusedError extends Error {
  override name = "RefusedError";
}

function harness(responses: (() => Response)[]) {
  const sleeps: number[] = [];
  let call = 0;
  let clock = 1_000_000;
  const fetchFn: Fetch = () => {
    const next = responses[Math.min(call, responses.length - 1)] as () => Response;
    call++;
    return Promise.resolve(next());
  };
  const http = createPacedHttp({
    fetch: fetchFn,
    sleep: (ms) => {
      sleeps.push(ms);
      clock += ms;
      return Promise.resolve();
    },
    random: () => 0,
    now: () => clock,
    spacingMs: 500,
    jitterMs: 0,
    blockRetryDelayMs: 15_000,
    isBlock: (status) => status === 403,
    blockedError: (url) => new BlockedError(url),
    refusedError: (message) => new RefusedError(message),
  });
  return { http, sleeps };
}

const ok =
  (body = "{}") =>
  () =>
    new Response(body);
const status = (code: number) => () => new Response("x", { status: code });

describe("createPacedHttp", () => {
  it("spaces consecutive requests", async () => {
    const { http, sleeps } = harness([ok()]);
    await http.request("https://source.invalid/a");
    await http.request("https://source.invalid/b");
    expect(sleeps).toContain(500);
    expect(http.requests).toBe(2);
  });

  it("spaces requests from separate clients that share a gate", async () => {
    const sleeps: number[] = [];
    let clock = 1_000_000;
    const gate = createPacingGate();
    const make = () =>
      createPacedHttp({
        fetch: () => Promise.resolve(new Response("{}")),
        gate,
        sleep: (ms) => {
          sleeps.push(ms);
          clock += ms;
          return Promise.resolve();
        },
        random: () => 0,
        now: () => clock,
        spacingMs: 500,
        jitterMs: 0,
        blockRetryDelayMs: 15_000,
        isBlock: () => false,
        blockedError: (url) => new BlockedError(url),
        refusedError: (message) => new RefusedError(message),
      });
    const [first, second] = [make(), make()];
    await Promise.all([
      first.request("https://source.invalid/a"),
      second.request("https://source.invalid/b"),
    ]);
    expect(sleeps).toEqual([500]);
    expect([first.requests, second.requests]).toEqual([1, 1]);
  });

  it("retries a server error and returns the body once it succeeds", async () => {
    const { http } = harness([status(503), ok("done")]);
    await expect(http.request("https://source.invalid/a")).resolves.toBe("done");
    expect(http.requests).toBe(2);
  });

  it("retries a body the caller cannot parse", async () => {
    const { http } = harness([ok(""), ok('{"a":1}')]);
    const parsed = await http.request("https://source.invalid/a", {}, (text) => JSON.parse(text));
    expect(parsed).toEqual({ a: 1 });
    expect(http.requests).toBe(2);
  });

  it("refuses an accepted error status whose body does not parse, without retrying", async () => {
    const { http } = harness([() => new Response("not json", { status: 400 })]);
    await expect(
      http.request("https://source.invalid/a", { readStatuses: [400] }, (text) => JSON.parse(text)),
    ).rejects.toBeInstanceOf(RefusedError);
    expect(http.requests).toBe(1);
  });

  it("gives up on a plain 4xx at once, without latching", async () => {
    const { http } = harness([status(404)]);
    await expect(http.request("https://source.invalid/a")).rejects.toBeInstanceOf(RefusedError);
    expect(http.requests).toBe(1);
    expect(http.blocked).toBe(false);
  });

  it("waits once after a block, then latches and fails every later call without a request", async () => {
    const { http, sleeps } = harness([status(403)]);
    await expect(http.request("https://source.invalid/a")).rejects.toBeInstanceOf(BlockedError);
    expect(sleeps).toContain(15_000);
    expect(http.blocked).toBe(true);
    const before = http.requests;
    await expect(http.request("https://source.invalid/b")).rejects.toBeInstanceOf(BlockedError);
    expect(http.requests).toBe(before);
  });

  it("latches a block that arrives on the last attempt", async () => {
    const { http } = harness([status(503), status(503), status(403)]);
    await expect(http.request("https://source.invalid/a")).rejects.toBeInstanceOf(BlockedError);
    expect(http.blocked).toBe(true);
  });
});
