import { createLogger } from "@openrift/shared/logger";
import { describe, expect, it } from "vitest";

import { createPacedHttp } from "./paced-http.js";
import type { RecheckPassSpec } from "./recheck-pass.js";
import { emptyRecheckPassResult, runRecheckPass } from "./recheck-pass.js";
import type { RunHeartbeat } from "./run-heartbeat.js";
import { SourceHttpError, SourceThrottledError } from "./source-http.js";

const NOW = new Date("2026-11-12T10:00:00.000Z");

class BlockedError extends Error {
  override name = "BlockedError";
}

interface Row {
  id: number;
}

function heartbeat(cancelAfter = Number.POSITIVE_INFINITY): RunHeartbeat & { beats: number } {
  const state = {
    beats: 0,
    beat: () => {
      state.beats++;
      return Promise.resolve(state.beats > cancelAfter);
    },
    checkpoint: () => Promise.resolve(false),
    cancelled: () => Promise.resolve(false),
  };
  return state;
}

function spec(
  rows: Row[],
  overrides: Partial<RecheckPassSpec<Row, ReturnType<typeof emptyRecheckPassResult>>> = {},
) {
  const visited: number[] = [];
  const graced: number[] = [];
  const deferred: number[] = [];
  const dropped: number[] = [];
  let requests = 0;
  const base: RecheckPassSpec<Row, ReturnType<typeof emptyRecheckPassResult>> = {
    result: emptyRecheckPassResult(),
    heartbeat: heartbeat(),
    log: createLogger("test"),
    now: () => NOW,
    budgetMs: 60_000,
    requests: () => requests,
    pageSize: 50,
    due: () => Promise.resolve(rows),
    keyOf: (row) => row.id,
    visit: (row) => {
      visited.push(row.id);
      requests += 2;
      return Promise.resolve("ok");
    },
    grace: (row) => {
      graced.push(row.id);
      return Promise.resolve();
    },
    drop: (row) => {
      dropped.push(row.id);
      return Promise.resolve();
    },
    stopOf: (error) => (error instanceof BlockedError ? "block" : null),
    deferOnStop: (row) => {
      deferred.push(row.id);
      return Promise.resolve();
    },
    ...overrides,
  };
  return { spec: base, visited, graced, deferred, dropped };
}

describe("runRecheckPass", () => {
  it("visits every due row once, even when a failed write leaves it due", async () => {
    const { spec: pass, visited } = spec([{ id: 1 }, { id: 2 }]);

    const result = await runRecheckPass(pass);

    expect(visited).toEqual([1, 2]);
    expect(result).toMatchObject({ due: 2, requests: 4, backedOff: false });
  });

  it("pauses the job after five failed visits in a row", async () => {
    const rows = Array.from({ length: 8 }, (_, index) => ({ id: index }));
    const { spec: pass } = spec(rows, { visit: () => Promise.resolve("failed") });

    const result = await runRecheckPass(pass);

    expect(result.backedOff).toBe(true);
    expect(result.pausedUntil).toBe("2026-11-12T10:30:00.000Z");
    expect(result.blockedUntil).toBeNull();
    expect(result.due).toBe(5);
  });

  it("drops a row the source deleted without counting it toward the failure streak", async () => {
    const rows = Array.from({ length: 7 }, (_, index) => ({ id: index }));
    const { spec: pass, dropped } = spec(rows, {
      visit: (row) => Promise.reject(new SourceHttpError(404, `Event ${row.id} not found`)),
    });

    const result = await runRecheckPass(pass);

    expect(result.backedOff).toBe(false);
    expect(result.dropped).toBe(7);
    expect(dropped).toEqual([0, 1, 2, 3, 4, 5, 6]);
  });

  it("graces a row the source refuses for good without counting it as a failure", async () => {
    const rows = Array.from({ length: 6 }, (_, index) => ({ id: index }));
    const { spec: pass, graced } = spec(rows, {
      visit: (row) =>
        row.id % 2 === 0
          ? Promise.resolve("failed")
          : Promise.reject(new SourceHttpError(403, "forbidden")),
    });

    const result = await runRecheckPass(pass);

    expect(result.backedOff).toBe(false);
    expect(graced).toEqual([1, 3, 5]);
  });

  it("graces a row whose visit threw and keeps going", async () => {
    const { spec: pass, graced } = spec([{ id: 1 }, { id: 2 }], {
      visit: (row) =>
        row.id === 1 ? Promise.reject(new Error("deadlock")) : Promise.resolve("ok"),
    });

    const result = await runRecheckPass(pass);

    expect(graced).toEqual([1]);
    expect(result.errors).toEqual(["Event 1: deadlock"]);
    expect(result.due).toBe(2);
  });

  it("ends on a source stop, defers the row that hit it, and cools the source down", async () => {
    const { spec: pass, deferred } = spec([{ id: 1 }, { id: 2 }], {
      visit: () => Promise.reject(new BlockedError("refused")),
    });

    const result = await runRecheckPass(pass);

    expect(deferred).toEqual([1]);
    expect(result).toMatchObject({
      due: 1,
      blocked: true,
      blockedUntil: "2026-11-12T16:00:00.000Z",
      errors: [
        "Stopped: the source refused further requests (refused); every job of this source waits until 2026-11-12T16:00:00.000Z.",
      ],
    });
  });

  it("stops at the next visit once the admin cancels", async () => {
    const { spec: pass, visited } = spec([{ id: 1 }, { id: 2 }, { id: 3 }], {
      heartbeat: heartbeat(1),
    });

    const result = await runRecheckPass(pass);

    expect(result.cancelRequested).toBe(true);
    expect(result.errors).toEqual(["Cancelled from the admin panel"]);
    expect(visited).toEqual([1, 2]);
  });

  it("stops at the request budget, and never starts once a preparation spent it", async () => {
    const { spec: pass } = spec([{ id: 1 }, { id: 2 }, { id: 3 }], { maxRequests: 3 });
    const budgeted = await runRecheckPass(pass);
    expect(budgeted.due).toBe(2);

    let requests = 0;
    const spent = spec([{ id: 1 }], {
      maxRequests: 3,
      requests: () => requests,
      prepare: () => {
        requests = 5;
        return Promise.resolve();
      },
    });
    const prepared = await runRecheckPass(spent.spec);
    expect(prepared.due).toBe(0);
  });

  it("ends like a spent budget when a visit's retry wait would outlast it", async () => {
    const http = createPacedHttp({
      fetch: () => Promise.resolve(new Response("unavailable", { status: 503 })),
      sleep: () => Promise.resolve(),
      spacingMs: 0,
      jitterMs: 0,
      refusedError: (code) => new Error(String(code)),
    });
    const visited: number[] = [];
    const {
      spec: pass,
      graced,
      deferred,
    } = spec([{ id: 1 }, { id: 2 }], {
      budgetMs: 500,
      visit: async (row) => {
        visited.push(row.id);
        await http.request("https://source.invalid/event");
        return "ok";
      },
    });

    const result = await runRecheckPass(pass);

    expect(visited).toEqual([1]);
    expect(graced).toEqual([]);
    expect(deferred).toEqual([]);
    expect(result.errors).toEqual([]);
    expect(result).toMatchObject({ backedOff: false, pausedUntil: null, blocked: false });
  });

  it("measures its deadline on the pass's own clock, whatever clock the client paces on", async () => {
    let at = NOW.getTime();
    const http = createPacedHttp({
      fetch: () => Promise.resolve(new Response("unavailable", { status: 503 })),
      sleep: () => Promise.resolve(),
      now: () => 0,
      spacingMs: 0,
      jitterMs: 0,
      refusedError: (code) => new Error(String(code)),
    });
    const { spec: pass, graced } = spec([{ id: 1 }], {
      now: () => new Date(at),
      visit: async () => {
        at += 59_500;
        await http.request("https://source.invalid/event");
        return "ok";
      },
    });

    const result = await runRecheckPass(pass);

    expect(graced).toEqual([]);
    expect(result.errors).toEqual([]);
  });

  it("stops as a throttle when a visit's throttle wait would outlast the budget", async () => {
    const http = createPacedHttp({
      fetch: () =>
        Promise.resolve(
          new Response("slow down", { status: 429, headers: { "retry-after": "120" } }),
        ),
      sleep: () => Promise.resolve(),
      spacingMs: 0,
      jitterMs: 0,
      refusedError: (code) => new Error(String(code)),
    });
    const { spec: pass, deferred } = spec([{ id: 1 }, { id: 2 }], {
      stopOf: (error) => (error instanceof SourceThrottledError ? "pause" : null),
      visit: async () => {
        await http.request("https://source.invalid/event");
        return "ok";
      },
    });

    const result = await runRecheckPass(pass);

    expect(deferred).toEqual([1]);
    expect(result.pausedUntil).not.toBeNull();
  });
});
