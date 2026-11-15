import { describe, expect, it } from "vitest";

import { createCrawlRun } from "./crawl-run.js";
import { emptyMetaSyncResult } from "./result.js";
import type { RunHeartbeat } from "./run-heartbeat.js";

function fakeHeartbeat(cancelAfter = Number.POSITIVE_INFINITY) {
  const beats: Record<string, unknown>[] = [];
  const heartbeat: RunHeartbeat = {
    beat: () => Promise.resolve(false),
    checkpoint: (result) => {
      beats.push({ ...result, complete: false });
      return Promise.resolve(beats.length > cancelAfter);
    },
    cancelled: () => Promise.resolve(false),
  };
  return { heartbeat, beats };
}

describe("createCrawlRun", () => {
  it("stops once the time budget has run out and marks the crawl incomplete", async () => {
    let at = 1000;
    const run = createCrawlRun({
      result: emptyMetaSyncResult(),
      heartbeat: fakeHeartbeat().heartbeat,
      requests: () => 0,
      maxDurationMs: 5 * 60_000,
      now: () => at,
    });

    at += 5 * 60_000 - 1;
    expect(await run.tick()).toBe(true);
    at += 1;

    expect(run.withinTime()).toBe(false);
    expect(await run.tick()).toBe(false);
    expect(run.result.complete).toBe(false);
    expect(run.result.errors).toEqual(["Stopped at the 5-minute time budget"]);
  });

  it("never stops on time without a time budget", async () => {
    let at = 0;
    const run = createCrawlRun({
      result: emptyMetaSyncResult(),
      heartbeat: fakeHeartbeat().heartbeat,
      requests: () => 0,
      now: () => at,
    });

    at += 10 * 24 * 60 * 60_000;

    expect(run.withinTime()).toBe(true);
    expect(await run.tick()).toBe(true);
  });

  it("checkpoints every Nth tick with the requests spent since the run started", async () => {
    let requests = 40;
    const { heartbeat, beats } = fakeHeartbeat();
    const run = createCrawlRun({
      result: emptyMetaSyncResult(),
      heartbeat,
      requests: () => requests,
      beatEvery: 2,
    });

    for (let index = 0; index < 4; index++) {
      requests += 3;
      await run.tick();
    }

    expect(beats.map((beat) => beat.requests)).toEqual([6, 12]);
  });

  it("stops at the request budget and marks the crawl incomplete", async () => {
    let requests = 0;
    const run = createCrawlRun({
      result: emptyMetaSyncResult(),
      heartbeat: fakeHeartbeat().heartbeat,
      requests: () => requests,
      maxRequests: 5,
    });

    requests = 5;

    expect(await run.tick()).toBe(false);
    expect(run.stopped).toBe(true);
    expect(run.result.complete).toBe(false);
    expect(run.result.errors).toEqual(["Stopped at the 5-request budget"]);
  });

  it("stops on an admin's cancel and records it", async () => {
    const run = createCrawlRun({
      result: emptyMetaSyncResult(),
      heartbeat: fakeHeartbeat(0).heartbeat,
      requests: () => 0,
    });

    expect(await run.tick()).toBe(false);
    expect(run.result).toMatchObject({
      cancelRequested: true,
      complete: false,
      errors: ["Cancelled from the admin panel"],
    });
    expect(await run.tick()).toBe(false);
  });

  it("caps the errors one run collects", () => {
    const run = createCrawlRun({
      result: emptyMetaSyncResult(),
      heartbeat: fakeHeartbeat().heartbeat,
      requests: () => 0,
    });

    for (let index = 0; index < 80; index++) {
      run.record(`Event ${index}: HTTP 502`);
    }

    expect(run.result.errors).toHaveLength(50);
  });

  it("stamps the spent requests on finish", () => {
    let requests = 10;
    const run = createCrawlRun({
      result: emptyMetaSyncResult(),
      heartbeat: fakeHeartbeat().heartbeat,
      requests: () => requests,
    });
    requests = 17;

    expect(run.finish().requests).toBe(7);
  });
});
