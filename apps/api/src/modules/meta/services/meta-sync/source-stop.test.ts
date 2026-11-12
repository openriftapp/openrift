import { describe, expect, it } from "vitest";

import { sourceJobKinds } from "./job-kinds.js";
import type { SourceStopFields } from "./source-stop.js";
import { applySourceStop, cooldownUntil, metaJobSkipReason } from "./source-stop.js";

const NOW = new Date("2026-10-20T12:00:00Z");
const LATER = "2026-10-20T13:00:00.000Z";
const EARLIER = "2026-10-20T11:00:00.000Z";

function jobRuns(results: Record<string, unknown>) {
  return {
    getLatestForResume: (kind: string) =>
      Promise.resolve(kind in results ? { result: results[kind] } : null),
  };
}

function fields(): SourceStopFields {
  return { blocked: false, blockedUntil: null, pausedUntil: null };
}

describe("applySourceStop", () => {
  it("blocks the source for six hours", () => {
    const result = fields();
    applySourceStop(result, "block", NOW);
    expect(result).toEqual({ blocked: true, blockedUntil: cooldownUntil(NOW), pausedUntil: null });
    expect(result.blockedUntil).toBe("2026-10-20T18:00:00.000Z");
  });

  it("pauses only the job for half an hour", () => {
    const result = fields();
    applySourceStop(result, "pause", NOW);
    expect(result).toEqual({
      blocked: false,
      blockedUntil: null,
      pausedUntil: "2026-10-20T12:30:00.000Z",
    });
  });
});

describe("sourceJobKinds", () => {
  it("lists every kind of the same source", () => {
    expect(sourceJobKinds("meta.topdeck_sync")).toEqual([
      "meta.topdeck_sync",
      "meta.topdeck_backfill",
      "meta.topdeck_auto_accept",
    ]);
  });
});

describe("metaJobSkipReason", () => {
  it("skips every job of a source while any of its kinds left a block in the future", async () => {
    const runs = jobRuns({ "meta.playloltcg_backfill": { blockedUntil: LATER } });

    expect(await metaJobSkipReason(runs, "meta.playloltcg_sync", NOW)).toMatch(/cooling down/u);
    expect(await metaJobSkipReason(runs, "meta.playloltcg_recheck", NOW)).toMatch(/cooling down/u);
    expect(await metaJobSkipReason(runs, "meta.uvsgames_sync", NOW)).toBeNull();
  });

  it("skips a job for its own pause only, never for a sibling's", async () => {
    const runs = jobRuns({ "meta.playloltcg_recheck": { pausedUntil: LATER } });

    expect(await metaJobSkipReason(runs, "meta.playloltcg_recheck", NOW)).toMatch(/paused/u);
    expect(await metaJobSkipReason(runs, "meta.playloltcg_sync", NOW)).toBeNull();
  });

  it("runs once every block and pause has passed, or none was set", async () => {
    const runs = jobRuns({
      "meta.topdeck_sync": { blockedUntil: EARLIER, pausedUntil: EARLIER },
      "meta.topdeck_backfill": { blockedUntil: null },
    });

    expect(await metaJobSkipReason(runs, "meta.topdeck_sync", NOW)).toBeNull();
  });
});
