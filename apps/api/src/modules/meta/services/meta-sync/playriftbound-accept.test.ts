import { createLogger } from "@openrift/shared/logger";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Repos, Transact } from "../../../../deps.js";
import type { PlayriftboundListRow } from "../../repositories/playriftbound-events.js";
import { promoteNewEvent } from "../meta-promote.js";
import {
  acceptPlayriftboundEvent,
  autoAcceptPlayriftboundBacklog,
  autoAcceptPlayriftboundEvents,
} from "./playriftbound-accept.js";
import type { PlayriftboundSyncDeps } from "./playriftbound-deps.js";

vi.mock("../meta-promote.js", () => ({
  promoteNewEvent: vi.fn(() =>
    Promise.resolve({ metaEventId: "live-1", slug: "summoner-skirmish", created: true }),
  ),
}));

const NOW = new Date("2026-10-18T12:00:00Z");

function row(overrides: Partial<PlayriftboundListRow> = {}): PlayriftboundListRow {
  return {
    tournamentId: "117000000000000001",
    organizerId: "org-1",
    name: "Summoner Skirmish",
    // The evening of the 17th in Los Angeles.
    startAt: new Date("2026-10-18T02:00:00Z"),
    tournamentType: "SUMMONER_SKIRMISH",
    format: "CONSTRUCTED",
    playerFormat: "ONE_V_ONE",
    participantCapacity: 64,
    registeredCount: 40,
    waitlistedCount: 0,
    pricing: "PAID",
    entryFeeCurrency: "USD",
    entryFeeMinor: 1500,
    contentHash: "hash",
    firstSeenAt: NOW,
    lastSeenAt: NOW,
    missingSince: null,
    structure: null,
    matchFormat: null,
    roundCount: null,
    roundsPlayed: null,
    roundsFinalized: null,
    sourceUpdatedAt: null,
    triage: "new",
    metaEventId: null,
    metaEventSlug: null,
    organizerName: "Piltover Hobbies",
    organizerCity: "Los Angeles",
    organizerAddress: null,
    organizerLongitude: -118.24,
    nextCheckAt: null,
    checkStage: 0,
    resultsFetchedAt: null,
    stagedPlayerCount: 0,
    stagedMatchCount: 0,
    ...overrides,
  };
}

function fakeDeps(
  options: {
    minPlayers?: number | null;
    rows?: PlayriftboundListRow[];
    live?: { id: string; name: string; eventDate: string; organizer: string | null }[];
  } = {},
) {
  const rechecks: unknown[] = [];
  const newKeys = vi.fn(() => Promise.resolve((options.rows ?? []).map((r) => r.tournamentId)));
  const deps: PlayriftboundSyncDeps = {
    repos: {
      meta: {
        eventsAtStoresOutside: () => Promise.resolve(options.live ?? []),
      },
      uvsgamesEvents: {
        settings: () =>
          Promise.resolve({
            autoAcceptMinPlayers: "minPlayers" in options ? options.minPlayers : 32,
          }),
      },
      playriftboundEvents: {
        unacceptedByKeys: (ids: readonly string[]) =>
          Promise.resolve((options.rows ?? []).filter((r) => ids.includes(r.tournamentId))),
        newKeys,
        setRecheck: (id: string, values: unknown) => {
          rechecks.push({ id, values });
          return Promise.resolve();
        },
      },
    } as unknown as Repos,
    transact: (() => Promise.reject(new Error("no writes here"))) as unknown as Transact,
    client: {
      requests: 0,
      blocked: false,
      query: () => Promise.reject(new Error("no reads here")),
    },
    log: createLogger("test"),
    now: () => NOW,
  };
  return { deps, rechecks, newKeys };
}

describe("acceptPlayriftboundEvent", () => {
  beforeEach(() => {
    vi.mocked(promoteNewEvent).mockClear();
  });

  it("files the event under the store's local day and queues it for an immediate visit", async () => {
    const { deps, rechecks } = fakeDeps();
    await acceptPlayriftboundEvent(deps, row());
    expect(promoteNewEvent).toHaveBeenCalledWith(
      deps.repos,
      "playriftbound",
      "117000000000000001",
      {
        name: "Summoner Skirmish",
        eventDate: "2026-10-17",
        format: "constructed",
        sourceUrl: "https://playriftbound.com/en-US/events/117000000000000001",
      },
    );
    expect(rechecks).toEqual([
      { id: "117000000000000001", values: { nextCheckAt: NOW, checkStage: 0, failingSince: null } },
    ]);
  });
});

describe("autoAcceptPlayriftboundEvents", () => {
  beforeEach(() => {
    vi.mocked(promoteNewEvent).mockClear();
  });

  it("accepts fields at or above the threshold and skips team events", async () => {
    const rows = [
      row({ tournamentId: "1", registeredCount: 32 }),
      row({ tournamentId: "2", registeredCount: 31 }),
      row({ tournamentId: "3", registeredCount: 64, playerFormat: "TWO_V_TWO" }),
      row({ tournamentId: "4", registeredCount: null }),
    ];
    const { deps } = fakeDeps({ rows });
    const summary = await autoAcceptPlayriftboundEvents(deps, ["1", "2", "3", "4"]);
    expect(summary).toEqual({ considered: 4, accepted: 1, held: 0, failed: 0, errors: [] });
    expect(vi.mocked(promoteNewEvent).mock.calls.map((call) => call[2])).toEqual(["1"]);
  });

  it("does nothing while the threshold is off", async () => {
    const { deps } = fakeDeps({ minPlayers: null, rows: [row()] });
    const summary = await autoAcceptPlayriftboundEvents(deps, ["117000000000000001"]);
    expect(summary.considered).toBe(0);
    expect(promoteNewEvent).not.toHaveBeenCalled();
  });

  it("records a failed accept and carries on", async () => {
    vi.mocked(promoteNewEvent).mockRejectedValueOnce(new Error("slug taken"));
    const rows = [row({ tournamentId: "1" }), row({ tournamentId: "2" })];
    const { deps } = fakeDeps({ rows });
    const summary = await autoAcceptPlayriftboundEvents(deps, ["1", "2"]);
    expect(summary.accepted).toBe(1);
    expect(summary.failed).toBe(1);
    expect(summary.errors[0]).toMatch(/slug taken/u);
  });
});

describe("same-store guard", () => {
  beforeEach(() => {
    vi.mocked(promoteNewEvent).mockClear();
  });

  it("holds an event another source already archived at the same store within a day", async () => {
    const { deps } = fakeDeps({
      rows: [row({ tournamentId: "1", name: "Summoner Skirmish" })],
      live: [
        {
          id: "uvs-live",
          name: "Summoner Skirmish",
          eventDate: "2026-10-17",
          organizer: "Piltover Hobbies",
        },
      ],
    });
    const summary = await autoAcceptPlayriftboundEvents(deps, ["1"]);
    expect(summary).toMatchObject({ accepted: 0, held: 1 });
    expect(promoteNewEvent).not.toHaveBeenCalled();
  });
});

describe("autoAcceptPlayriftboundBacklog", () => {
  it("runs the rule over every row still awaiting triage", async () => {
    const { deps, newKeys } = fakeDeps({ rows: [row()] });
    const summary = await autoAcceptPlayriftboundBacklog(deps);
    expect(newKeys).toHaveBeenCalledTimes(1);
    expect(summary.accepted).toBe(1);
  });
});
