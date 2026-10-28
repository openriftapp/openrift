import type { MetaSyncStatus } from "@openrift/shared/contracts/admin/meta-catalog";
import { describe, expect, it } from "vitest";

import { TRIGGER_GROUPS } from "./meta-admin-triggers";
import {
  autoPublishRuleText,
  collectDetail,
  collectKind,
  latestRun,
  metaJobLabel,
  overdueOf,
  refreshCell,
  sourceTone,
  triggerKind,
} from "./meta-source-overview";

type Run = MetaSyncStatus["runs"][number];

const NOW = new Date("2026-10-28T15:00:00.000Z");

function run(overrides: Partial<Run> = {}): Run {
  return {
    id: "run-1",
    kind: "meta.playloltcg_sync",
    trigger: "cron",
    status: "succeeded",
    startedAt: "2026-10-28T07:00:00.000Z",
    finishedAt: "2026-10-28T07:00:15.000Z",
    durationMs: 15_000,
    errorMessage: null,
    result: null,
    ...overrides,
  };
}

describe("collectKind", () => {
  it("names the recheck job of a source that has one", () => {
    expect(collectKind("playriftbound")).toBe("meta.playriftbound_recheck");
  });

  it("has none for a source whose refresh carries the results", () => {
    expect(collectKind("topdeck")).toBeNull();
  });
});

describe("latestRun", () => {
  it("picks the newest run of the kind, whatever the list order", () => {
    const older = run({ id: "a", startedAt: "2026-10-27T07:00:00.000Z" });
    const newer = run({ id: "b" });
    const other = run({
      id: "c",
      kind: "meta.playloltcg_recheck",
      startedAt: "2026-10-28T14:00:00.000Z",
    });

    expect(latestRun([older, other, newer], "meta.playloltcg_sync")?.id).toBe("b");
  });
});

describe("metaJobLabel", () => {
  it("names every meta job kind in the new terms", () => {
    expect(metaJobLabel("meta.uvsgames_sync")).toBe("Refresh mirror");
    expect(metaJobLabel("meta.uvsgames_recheck")).toBe("Collect results");
    expect(metaJobLabel("meta.uvsgames_backfill")).toBe("Mirror full history");
    expect(metaJobLabel("meta.playriftbound_backfill")).toBe("Find stores");
    expect(metaJobLabel("meta.uvsgames_id_sweep")).toBe("Find unlisted events");
    expect(metaJobLabel("meta.topdeck_auto_accept")).toBe("Apply auto-publish rule");
  });

  it("shows an unknown kind as itself", () => {
    expect(metaJobLabel("meta.retier")).toBe("meta.retier");
  });
});

describe("refreshCell", () => {
  it("says what the refresh added and published", () => {
    const cell = refreshCell(
      run({ result: { rows: 5103, inserted: 270, autoAccepted: 37 } }),
      true,
      NOW,
    );

    expect(cell).toEqual({
      tone: "ok",
      at: "2026-10-28T07:00:00.000Z",
      detail: "270 new · 37 published",
    });
  });

  it("warns and counts errors next to what still went through", () => {
    const cell = refreshCell(
      run({
        result: { rows: 500, inserted: 0, errors: ["Event 1: unreadable", "Event 2: unreadable"] },
      }),
      true,
      NOW,
    );

    expect(cell.tone).toBe("warn");
    expect(cell.detail).toBe("0 new · 2 errors");
  });

  it("shows the first error of a refresh that read nothing", () => {
    const cell = refreshCell(
      run({ result: { rows: 0, inserted: 0, errors: ["No stores are known yet."] } }),
      true,
      NOW,
    );

    expect(cell).toMatchObject({ tone: "warn", detail: "No stores are known yet." });
  });

  it("flags a scheduled refresh that has not run for over a day", () => {
    const cell = refreshCell(
      run({ startedAt: "2026-10-27T07:00:00.000Z", result: { rows: 10, inserted: 1 } }),
      true,
      NOW,
    );

    expect(cell).toMatchObject({ tone: "bad", detail: "last run over a day ago" });
  });

  it("carries a failed run's error", () => {
    expect(
      refreshCell(run({ status: "failed", errorMessage: "HTTP 503" }), true, NOW),
    ).toMatchObject({
      tone: "bad",
      detail: "HTTP 503",
    });
  });

  it("separates a refresh that never ran from one that is not scheduled", () => {
    expect(refreshCell(undefined, true, NOW)).toMatchObject({ tone: "warn", detail: "never ran" });
    expect(refreshCell(undefined, false, NOW)).toMatchObject({
      tone: "off",
      detail: "not scheduled",
    });
  });
});

describe("collectDetail", () => {
  const recheck = (result: Record<string, unknown>) =>
    run({ kind: "meta.playloltcg_recheck", result });

  it("counts the events and players it collected", () => {
    expect(collectDetail(recheck({ due: 18, fetched: 16, players: 427 })).detail).toBe(
      "16 events, 427 players",
    );
  });

  it("separates nothing due from nothing new", () => {
    expect(collectDetail(recheck({ due: 0, fetched: 0 })).detail).toBe("nothing due");
    expect(collectDetail(recheck({ due: 3, fetched: 0 })).detail).toBe("nothing new");
  });

  it("warns when the source refused requests", () => {
    expect(collectDetail(recheck({ blocked: true }))).toMatchObject({
      tone: "warn",
      detail: "the source refused requests",
    });
  });
});

describe("overdueOf", () => {
  const catalog = (oldestDueAt: string | null, dueRecheck: number) =>
    ({ oldestDueAt, dueRecheck }) as MetaSyncStatus["catalog"];

  it("is not behind while the oldest due event waited under two hours", () => {
    expect(overdueOf(catalog("2026-10-28T14:55:00.000Z", 1), NOW).behind).toBe(false);
  });

  it("is behind once the oldest due event waited over two hours", () => {
    expect(overdueOf(catalog("2026-10-27T21:00:00.000Z", 123), NOW)).toEqual({
      count: 123,
      oldestAt: "2026-10-27T21:00:00.000Z",
      behind: true,
    });
  });
});

describe("sourceTone", () => {
  it("ranks a failed run over any other warning", () => {
    expect(sourceTone(["due-rechecks", "failed-runs"], [], "uvsgames")).toBe("bad");
    expect(sourceTone(["due-rechecks"], [], "uvsgames")).toBe("warn");
  });

  it("shows a backfill in flight on an otherwise healthy source", () => {
    const backfill = run({ kind: "meta.uvsgames_backfill", status: "running", finishedAt: null });
    expect(sourceTone([], [backfill], "uvsgames")).toBe("running");
    expect(sourceTone([], [], "uvsgames")).toBe("ok");
  });
});

describe("autoPublishRuleText", () => {
  it("states the threshold and the source-specific rules that are on", () => {
    expect(
      autoPublishRuleText({
        autoAcceptMinPlayers: 16,
        autoAcceptOfficial: true,
        autoAcceptNotable: false,
      }),
    ).toBe("Auto-publish rule: 16+ players, all sources · watched templates (UVS Games)");
  });

  it("says the rule is off when nothing is set", () => {
    expect(
      autoPublishRuleText({
        autoAcceptMinPlayers: null,
        autoAcceptOfficial: false,
        autoAcceptNotable: false,
      }),
    ).toBe("Auto-publish is off");
  });
});

describe("triggerKind", () => {
  it("maps each trigger to the job kind its runs carry", () => {
    const kinds = TRIGGER_GROUPS.uvsgames.map((entry) => triggerKind("uvsgames", entry));
    expect(kinds).toEqual([
      "meta.uvsgames_sync",
      "meta.uvsgames_auto_accept",
      "meta.uvsgames_recheck",
      "meta.uvsgames_id_sweep",
    ]);
  });
});
