import { describe, expect, it } from "vitest";

import type { Fetch } from "../../../../io.js";
import type { PacedHttpOptions } from "./paced-http.js";
import { createPacedHttp, createPacingGate, withRequestDeadline } from "./paced-http.js";
import {
  isPermanentRefusal,
  isTransientSourceFailure,
  RunDeadlineError,
  SourceBlockedError,
  SourceHttpError,
  SourceMalformedBodyError,
  SourceThrottledError,
} from "./source-http.js";

class BlockedError extends Error {
  override name = "BlockedError";
}
class RefusedError extends Error {
  override name = "RefusedError";
}

function harness(responses: (() => Response)[], overrides: Partial<PacedHttpOptions> = {}) {
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
    refusedError: (code) => new RefusedError(String(code)),
    ...overrides,
  });
  return { http, sleeps, now: () => clock };
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
        refusedError: (code) => new RefusedError(String(code)),
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

  it("fails a non-empty body the caller cannot parse once, as a transient failure with its cause", async () => {
    const { http } = harness([ok("<html>maintenance</html>"), ok('{"a":1}')]);

    const error = await http
      .request("https://source.invalid/a", {}, (text) => JSON.parse(text))
      .catch((error_: unknown) => error_);

    expect(error).toBeInstanceOf(SourceMalformedBodyError);
    expect((error as Error).cause).toBeInstanceOf(SyntaxError);
    expect(isPermanentRefusal(error)).toBe(false);
    expect(isTransientSourceFailure(error)).toBe(true);
    expect(http.requests).toBe(1);
    expect(http.blocked).toBe(false);
  });

  it("retries a transient source error the parser raises from a readable body", async () => {
    const { http } = harness([ok('{"busy":true}'), ok('{"busy":false}')]);

    const parsed = await http.request("https://source.invalid/a", {}, (text) => {
      const body = JSON.parse(text) as { busy: boolean };
      if (body.busy) {
        throw new SourceHttpError(0, "busy");
      }
      return body;
    });

    expect(parsed).toEqual({ busy: false });
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

  it("waits out the Retry-After a throttle names, then succeeds", async () => {
    const throttled = () =>
      new Response("slow down", { status: 429, headers: { "retry-after": "7" } });
    const { http, sleeps } = harness([throttled, ok("done")]);

    await expect(http.request("https://source.invalid/a")).resolves.toBe("done");
    expect(sleeps).toContain(7000);
    expect(http.blocked).toBe(false);
  });

  it("stops on a throttle whose wait would end after the request deadline, as a throttle", async () => {
    const throttled = () =>
      new Response("slow down", { status: 429, headers: { "retry-after": "7" } });
    const { http, sleeps, now } = harness([throttled, ok("done")]);

    await expect(
      withRequestDeadline({ at: 1_000_000 + 5000, now }, () =>
        http.request("https://source.invalid/a"),
      ),
    ).rejects.toBeInstanceOf(SourceThrottledError);
    expect(sleeps).not.toContain(7000);
    expect(http.requests).toBe(1);
    expect(http.blocked).toBe(false);
  });

  it("latches a block whose retry wait would end after the request deadline", async () => {
    const { http, sleeps, now } = harness([status(403), ok("done")]);

    await expect(
      withRequestDeadline({ at: 1_000_000 + 5000, now }, () =>
        http.request("https://source.invalid/a"),
      ),
    ).rejects.toBeInstanceOf(BlockedError);
    expect(sleeps).not.toContain(15_000);
    expect(http.blocked).toBe(true);
  });

  it("waits out a throttle that ends before the request deadline", async () => {
    const throttled = () =>
      new Response("slow down", { status: 429, headers: { "retry-after": "7" } });
    const { http, sleeps, now } = harness([throttled, ok("done")]);

    await expect(
      withRequestDeadline({ at: 1_000_000 + 60_000, now }, () =>
        http.request("https://source.invalid/a"),
      ),
    ).resolves.toBe("done");
    expect(sleeps).toContain(7000);
  });

  it("refuses a retry backoff that would end after the request deadline", async () => {
    const { http, sleeps, now } = harness([status(503), ok("done")]);

    await expect(
      withRequestDeadline({ at: 1_000_000 + 500, now }, () =>
        http.request("https://source.invalid/a"),
      ),
    ).rejects.toBeInstanceOf(RunDeadlineError);
    expect(sleeps).toEqual([]);
    expect(http.requests).toBe(1);
  });

  it("ends the call on a second throttle with a transient throttle error", async () => {
    const { http, sleeps } = harness([status(429)]);

    const error = await http.request("https://source.invalid/a").catch((error_: unknown) => error_);

    expect(error).toBeInstanceOf(SourceThrottledError);
    expect(isPermanentRefusal(error)).toBe(false);
    expect(sleeps).toContain(30_000);
    expect(http.requests).toBe(2);
    expect(http.blocked).toBe(false);
  });

  it("latches when a second throttle maps to a block", async () => {
    const { http, sleeps } = harness([status(429)], {
      throttledError: (url) => new SourceBlockedError(url),
    });

    await expect(http.request("https://source.invalid/a")).rejects.toBeInstanceOf(
      SourceBlockedError,
    );
    expect(sleeps).toContain(30_000);
    expect(http.blocked).toBe(true);
    const before = http.requests;
    await expect(http.request("https://source.invalid/b")).rejects.toBeInstanceOf(BlockedError);
    expect(http.requests).toBe(before);
  });

  it("retries a request timeout instead of refusing it", async () => {
    const { http } = harness([status(408), ok("done")]);

    await expect(http.request("https://source.invalid/a")).resolves.toBe("done");
  });

  it("ends a server error that never clears with the status on the error", async () => {
    const { http } = harness([status(502)]);

    await expect(http.request("https://source.invalid/a")).rejects.toMatchObject({ status: 502 });
    expect(http.requests).toBe(3);
  });

  it("ends a request that never got an answer as a transient source failure", async () => {
    const { http } = harness([
      () => {
        throw new Error("ECONNRESET");
      },
    ]);

    const error = await http.request("https://source.invalid/a").catch((error_: unknown) => error_);

    expect(isTransientSourceFailure(error)).toBe(true);
    expect((error as Error).message).toContain("ECONNRESET");
  });

  it("latches a block that arrives on the last attempt", async () => {
    const { http } = harness([status(503), status(503), status(403)]);
    await expect(http.request("https://source.invalid/a")).rejects.toBeInstanceOf(BlockedError);
    expect(http.blocked).toBe(true);
  });
});
