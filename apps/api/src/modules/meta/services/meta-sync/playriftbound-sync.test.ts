import { createLogger } from "@openrift/shared/logger";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Repos, Transact } from "../../../../deps.js";
import { cellOf } from "../../lib/playriftbound-catalog.js";
import type {
  PlayriftboundListRow,
  PlayriftboundRecheckRow,
  PlayriftboundUpsertInput,
} from "../../repositories/playriftbound-events.js";
import type { PlayriftboundClient } from "./playriftbound-client.js";
import {
  PlayriftboundBlockedError,
  PlayriftboundRefusedError,
  PlayriftboundUnavailableError,
} from "./playriftbound-client.js";
import type { PlayriftboundDeepFetchResult } from "./playriftbound-deep-fetch.js";
import { playriftboundDeepFetch, readPlayriftboundUpdatedAt } from "./playriftbound-deep-fetch.js";
import type { PlayriftboundSyncDeps } from "./playriftbound-deps.js";
import {
  backfillPlayriftbound,
  fetchPlayriftboundEvent,
  isPlayriftboundSyncNoop,
  processPlayriftboundRechecks,
  syncPlayriftboundCatalog,
} from "./playriftbound-sync.js";

vi.mock("./playriftbound-accept.js", () => ({
  autoAcceptPlayriftboundEvents: vi.fn(() =>
    Promise.resolve({ considered: 0, accepted: 0, held: 0, failed: 0, errors: [] }),
  ),
}));

vi.mock("./playriftbound-deep-fetch.js", () => ({
  readPlayriftboundUpdatedAt: vi.fn(),
  playriftboundDeepFetch: vi.fn(),
}));

const NOW = new Date("2026-10-18T12:00:00Z");
const DAY_MS = 24 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;

const HANNOVER = { latitude: 52.37, longitude: 9.73 };
const BERLIN = { latitude: 52.52, longitude: 13.4 };

function node(id: string, startsAt: string, organizerId = "org-1") {
  return {
    organizer: {
      id: organizerId,
      name: "Bandle City Games",
      physicalAddress: { latitude: HANNOVER.latitude, longitude: HANNOVER.longitude },
    },
    tournament: {
      id,
      name: `Nexus Night ${id}`,
      startsAt,
      registrantCounts: [{ status: "REGISTERED", count: 8 }],
      config: { tournamentType: "NEXUS_NIGHT", format: "CONSTRUCTED", playerFormat: "ONE_V_ONE" },
    },
  };
}

interface SearchCall {
  latitude: number;
  longitude: number;
  startDate: string;
  distanceMeters: number;
  after: string | null;
}

function fakeDeps(options: {
  organizers?: { latitude: number; longitude: number }[];
  pages?: (call: SearchCall) => { nodes: unknown[]; next: string | null } | Error;
  due?: PlayriftboundRecheckRow[];
  cancelAfter?: number;
}) {
  const searches: SearchCall[] = [];
  const upserted: PlayriftboundUpsertInput[] = [];
  const missing: unknown[] = [];
  const rechecks: { tournamentId: string; nextCheckAt: Date | null; checkStage: number }[] = [];
  const cleared: string[] = [];
  const lifecycles: unknown[] = [];
  const heartbeats: Record<string, unknown>[] = [];
  const rearmed: Date[] = [];
  let cancelChecks = 0;
  let due = options.due ?? [];

  const client: PlayriftboundClient = {
    blocked: false,
    get requests() {
      return searches.length;
    },
    query: <T>(_name: string, variables: Record<string, unknown>): Promise<T> => {
      const filter = (variables.filter as { rb: Record<string, unknown> }).rb;
      const coords = filter.coords as { latitude: number; longitude: number };
      const call = {
        latitude: coords.latitude,
        longitude: coords.longitude,
        startDate: String(filter.startDate),
        distanceMeters: Number(filter.distanceMeters),
        after: (variables.after as string | undefined) ?? null,
      };
      searches.push(call);
      const page = options.pages?.(call) ?? { nodes: [], next: null };
      if (page instanceof Error) {
        return Promise.reject(page);
      }
      return Promise.resolve({
        competeTournamentSearch: {
          edges: page.nodes.map((n) => ({ node: n })),
          pageInfo: { hasNextPage: page.next !== null, endCursor: page.next },
        },
      } as T);
    },
  };

  const repos = {
    playriftboundEvents: {
      organizerCoordinates: () => Promise.resolve(options.organizers ?? []),
      upsertOrganizers: () => Promise.resolve(),
      upsertBatch: (rows: PlayriftboundUpsertInput[]) => {
        upserted.push(...rows);
        return Promise.resolve({
          inserted: rows.map((row) => row.tournamentId),
          changed: [],
          unchanged: [],
        });
      },
      markMissing: (params: unknown) => {
        missing.push(params);
        return Promise.resolve(0);
      },
      rearmRunningEvents: (at: Date) => {
        rearmed.push(at);
        return Promise.resolve(2);
      },
      dueForRecheck: () => {
        const page = due;
        due = [];
        return Promise.resolve(page);
      },
      setRecheck: (
        tournamentId: string,
        values: { nextCheckAt: Date | null; checkStage: number },
      ) => {
        rechecks.push({ tournamentId, ...values });
        return Promise.resolve();
      },
      clearFailing: (tournamentId: string) => {
        cleared.push(tournamentId);
        return Promise.resolve();
      },
    },
    meta: {
      setEventLifecycle: (id: string, values: unknown) => {
        lifecycles.push({ id, values });
        return Promise.resolve();
      },
    },
    jobRuns: {
      getResult: () => {
        cancelChecks++;
        return Promise.resolve({
          cancelRequested: options.cancelAfter !== undefined && cancelChecks > options.cancelAfter,
        });
      },
      mergeResult: (_id: string, patch: Record<string, unknown>) => {
        heartbeats.push(patch);
        return Promise.resolve();
      },
    },
  } as unknown as Repos;

  const deps: PlayriftboundSyncDeps = {
    repos,
    transact: (() => {
      throw new Error("unused");
    }) as unknown as Transact,
    client,
    log: createLogger("test"),
    now: () => NOW,
  };
  return {
    deps,
    searches,
    upserted,
    missing,
    rechecks,
    cleared,
    lifecycles,
    heartbeats,
    rearmed,
  };
}

const hannoverCell = cellOf(HANNOVER.latitude, HANNOVER.longitude);
const isHannover = (call: SearchCall) =>
  call.latitude === hannoverCell.latitude && call.longitude === hannoverCell.longitude;

describe("syncPlayriftboundCatalog", () => {
  it("asks for the discovery sweep when no store is known yet", async () => {
    const { deps, searches } = fakeDeps({});
    const result = await syncPlayriftboundCatalog(deps);
    expect(searches).toHaveLength(0);
    expect(result.complete).toBe(false);
    expect(result.errors[0]).toMatch(/discovery sweep/u);
  });

  it("searches each known area once, from a week back, with the full radius", async () => {
    const { deps, searches } = fakeDeps({ organizers: [HANNOVER, HANNOVER, BERLIN] });
    const result = await syncPlayriftboundCatalog(deps);
    const berlinCell = cellOf(BERLIN.latitude, BERLIN.longitude);
    expect(searches.map((s) => [s.latitude, s.longitude])).toEqual([
      [hannoverCell.latitude, hannoverCell.longitude],
      [berlinCell.latitude, berlinCell.longitude],
    ]);
    expect(searches[0]?.startDate).toBe(new Date(NOW.getTime() - 7 * DAY_MS).toISOString());
    expect(searches[0]?.distanceMeters).toBe(160_934);
    expect(result.cells).toBe(2);
  });

  it("pages until the horizon and keeps one copy of an event two areas both return", async () => {
    const { deps, searches, upserted } = fakeDeps({
      organizers: [HANNOVER, BERLIN],
      pages: (call) => {
        if (call.after === null) {
          return {
            nodes: [node("1", "2026-10-19T15:00:00Z"), node("2", "2026-10-20T15:00:00Z")],
            next: "c1",
          };
        }
        return {
          nodes: [node("3", "2026-10-25T15:00:00Z"), node("4", "2027-03-01T15:00:00Z")],
          next: "c2",
        };
      },
    });
    await syncPlayriftboundCatalog(deps);
    expect(searches.map((s) => s.after)).toEqual([null, "c1", null, "c1"]);
    expect(upserted.map((row) => row.tournamentId)).toEqual(["1", "2", "3"]);
  });

  it("marks rows missing only after every area was read", async () => {
    const clean = fakeDeps({ organizers: [HANNOVER] });
    await syncPlayriftboundCatalog(clean.deps);
    // Every area is read to the horizon, so an upcoming event the source dropped is caught too.
    expect(clean.missing).toEqual([
      {
        from: new Date(NOW.getTime() - 7 * DAY_MS),
        to: new Date(NOW.getTime() + 14 * DAY_MS),
        seenBefore: NOW,
        at: NOW,
      },
    ]);

    const failing = fakeDeps({
      organizers: [HANNOVER, BERLIN],
      pages: (call) => (isHannover(call) ? { nodes: [], next: null } : new Error("HTTP 503")),
    });
    const result = await syncPlayriftboundCatalog(failing.deps);
    expect(failing.missing).toHaveLength(0);
    expect(result.complete).toBe(false);
    expect(result.blocked).toBe(false);
  });

  it("stops at a block and cools down for hours", async () => {
    const { deps, searches } = fakeDeps({
      organizers: [HANNOVER, BERLIN],
      pages: () => new PlayriftboundBlockedError("https://source.invalid/api/gql", "HTTP 403"),
    });
    const result = await syncPlayriftboundCatalog(deps);
    expect(searches).toHaveLength(1);
    expect(result.blocked).toBe(true);
    expect(result.blockedUntil).toBe(new Date(NOW.getTime() + 6 * HOUR_MS).toISOString());
  });

  it("is a no-op only when it read every area cleanly and wrote nothing", async () => {
    const clean = fakeDeps({ organizers: [HANNOVER] });
    expect(isPlayriftboundSyncNoop(await syncPlayriftboundCatalog(clean.deps))).toBe(true);

    const cancelled = fakeDeps({ cancelAfter: 0 });
    const sweep = await backfillPlayriftbound(cancelled.deps, "run-1");
    expect(isPlayriftboundSyncNoop(sweep)).toBe(false);
  });

  it("is not a no-op when it stopped and paused, even if it wrote nothing", async () => {
    const { deps } = fakeDeps({
      organizers: [HANNOVER],
      pages: () => new PlayriftboundBlockedError("x"),
    });
    const result = await syncPlayriftboundCatalog(deps);
    expect(isPlayriftboundSyncNoop(result)).toBe(false);
  });

  it("stops at a refused query, since every area would fail the same way", async () => {
    const { deps, searches } = fakeDeps({
      organizers: [HANNOVER, BERLIN],
      pages: () => new PlayriftboundRefusedError("CompeteTournamentSearch: ValidationError", true),
    });
    const result = await syncPlayriftboundCatalog(deps);
    expect(searches).toHaveLength(1);
    expect(result.blocked).toBe(true);
  });

  it("pauses for half an hour, without a cool-down, when the query list will not load", async () => {
    const { deps, searches } = fakeDeps({
      organizers: [HANNOVER, BERLIN],
      pages: () => new PlayriftboundUnavailableError("Reading the query list failed: HTTP 503"),
    });
    const result = await syncPlayriftboundCatalog(deps);
    expect(searches).toHaveLength(1);
    expect(result).toMatchObject({
      blocked: false,
      blockedUntil: null,
      pausedUntil: new Date(NOW.getTime() + HOUR_MS / 2).toISOString(),
    });
  });

  it("treats a refusal tied to one area as that area failing", async () => {
    const { deps, searches } = fakeDeps({
      organizers: [HANNOVER, BERLIN],
      pages: (call) =>
        isHannover(call) ? new PlayriftboundRefusedError("HTTP 404") : { nodes: [], next: null },
    });
    const result = await syncPlayriftboundCatalog(deps);
    expect(searches).toHaveLength(2);
    expect(result).toMatchObject({ blocked: false, blockedUntil: null, complete: false });
  });
});

describe("backfillPlayriftbound", () => {
  it("resumes after the last covered cell and checkpoints as resumable", async () => {
    const { deps, searches, heartbeats } = fakeDeps({ cancelAfter: 1 });
    const result = await backfillPlayriftbound(deps, "run-1", { resumeFrom: 99 });
    expect(result.resumedFrom).toBe("99");
    expect(result.cancelRequested).toBe(true);
    expect(result.complete).toBe(false);
    expect(searches).toHaveLength(51);
    expect(result.coveredThrough).toBe("150");
    expect(heartbeats[0]).toMatchObject({ coveredThrough: "100", complete: false });
  });

  it("retries an area that failed once and finishes complete", async () => {
    let attempts = 0;
    const { deps } = fakeDeps({
      pages: (call) => {
        if (isHannover(call) && attempts++ === 0) {
          return new Error("HTTP 503");
        }
        return { nodes: [], next: null };
      },
    });
    const result = await backfillPlayriftbound(deps);
    expect(attempts).toBe(2);
    expect(result.complete).toBe(true);
    expect(result.coveredThrough).toBe(String(result.cells - 1));
  });

  it("resumes in front of an area that failed twice", async () => {
    const { deps, searches } = fakeDeps({
      pages: (call) => (isHannover(call) ? new Error("HTTP 503") : { nodes: [], next: null }),
    });
    const result = await backfillPlayriftbound(deps);
    expect(result.complete).toBe(false);
    expect(result.coveredThrough).toBe(String(searches.findIndex((call) => isHannover(call)) - 1));
  });

  it("stops at a block, skips the retry pass and resumes at the blocked area", async () => {
    let calls = 0;
    const { deps, searches } = fakeDeps({
      pages: () => {
        calls++;
        return calls === 3
          ? new PlayriftboundBlockedError("https://source.invalid/api/gql")
          : { nodes: [], next: null };
      },
    });
    const result = await backfillPlayriftbound(deps);
    expect(searches).toHaveLength(3);
    expect(result.blocked).toBe(true);
    expect(result.coveredThrough).toBe("1");
    expect(result.complete).toBe(false);
  });

  it("leaves nothing to continue after a full pass, even when an area overflowed", async () => {
    const { deps } = fakeDeps({
      pages: (call) => (isHannover(call) ? { nodes: [], next: "more" } : { nodes: [], next: null }),
    });
    const result = await backfillPlayriftbound(deps);
    expect(result.complete).toBe(false);
    expect(result.coveredThrough).toBeNull();
  });

  it("keeps a mid-run checkpoint in front of an area that failed", async () => {
    let calls = 0;
    const { deps, heartbeats } = fakeDeps({
      cancelAfter: 2,
      pages: () => {
        calls++;
        return calls === 10 ? new Error("HTTP 503") : { nodes: [], next: null };
      },
    });
    await backfillPlayriftbound(deps, "run-1");
    expect(heartbeats[0]).toMatchObject({ coveredThrough: "0" });
    expect(heartbeats.at(-1)).toMatchObject({ coveredThrough: "8" });
  });

  it("pauses after five areas in a row fail", async () => {
    const { deps, searches } = fakeDeps({ pages: () => new Error("HTTP 503") });
    const result = await backfillPlayriftbound(deps);
    expect(searches).toHaveLength(5);
    // A pause is this job's own; only a block holds the source's other runs back.
    expect(result.pausedUntil).toBe(new Date(NOW.getTime() + 30 * 60 * 1000).toISOString());
    expect(result.blockedUntil).toBeNull();
    expect(result.coveredThrough).toBeNull();
  });
});

function dueRow(overrides: Partial<PlayriftboundRecheckRow> = {}): PlayriftboundRecheckRow {
  return {
    tournamentId: "117000000000000001",
    organizerId: "org-1",
    name: "Summoner Skirmish",
    startAt: new Date(NOW.getTime() - 4 * HOUR_MS),
    tournamentType: "SUMMONER_SKIRMISH",
    format: "CONSTRUCTED",
    playerFormat: "ONE_V_ONE",
    participantCapacity: 16,
    registeredCount: 12,
    waitlistedCount: 0,
    pricing: "PAID",
    entryFeeCurrency: "EUR",
    entryFeeMinor: 1000,
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
    resultsFetchedAt: null,
    triage: "accepted",
    metaEventId: "live-1",
    metaEventSlug: "summoner-skirmish",
    organizerName: "Bandle City Games",
    organizerCity: "Bandle City",
    organizerAddress: null,
    organizerLongitude: 9.73,
    nextCheckAt: NOW,
    checkStage: 0,
    stagedPlayerCount: 0,
    stagedMatchCount: 0,
    important: false,
    failingSince: null,
    ...overrides,
  };
}

const FINISHED_FACTS = {
  structure: "SWISS",
  matchFormat: "BO3",
  roundCount: 4,
  roundsPlayed: 4,
  roundsFinalized: 4,
  sourceUpdatedAt: new Date(NOW.getTime() - HOUR_MS),
};

function deepResult(
  facts: typeof FINISHED_FACTS | null,
  overrides: Partial<PlayriftboundDeepFetchResult> = {},
): PlayriftboundDeepFetchResult {
  return {
    tournamentId: "117000000000000001",
    requests: 1,
    players: 12,
    matches: 24,
    acceptedPlayers: 12,
    skippedPlayers: 0,
    facts,
    complete: facts !== null,
    gone: false,
    errors: facts === null ? ["Event 117000000000000001 detail: HTTP 500"] : [],
    ...overrides,
  };
}

describe("processPlayriftboundRechecks", () => {
  beforeEach(() => {
    vi.mocked(readPlayriftboundUpdatedAt).mockReset();
    vi.mocked(playriftboundDeepFetch).mockReset();
  });

  it("parks an event that has not started until its start and forgets any failure streak", async () => {
    const startAt = new Date(NOW.getTime() + DAY_MS);
    const failingSince = new Date(NOW.getTime() - 13 * DAY_MS);
    const { deps, rechecks } = fakeDeps({ due: [dueRow({ startAt, failingSince })] });
    await processPlayriftboundRechecks(deps);
    expect(readPlayriftboundUpdatedAt).not.toHaveBeenCalled();
    expect(rechecks).toEqual([
      {
        tournamentId: "117000000000000001",
        nextCheckAt: startAt,
        checkStage: 0,
        failingSince: null,
      },
    ]);
  });

  it("re-queues running events only when asked to", async () => {
    const quiet = fakeDeps({});
    await processPlayriftboundRechecks(quiet.deps);
    expect(quiet.rearmed).toHaveLength(0);

    const hourly = fakeDeps({});
    const result = await processPlayriftboundRechecks(hourly.deps, { rearm: true });
    expect(hourly.rearmed).toEqual([NOW]);
    expect(result.pulledForward).toBe(2);
  });

  it("fetches a never-fetched event, then files it under its finished ladder", async () => {
    vi.mocked(readPlayriftboundUpdatedAt).mockResolvedValue(FINISHED_FACTS.sourceUpdatedAt);
    vi.mocked(playriftboundDeepFetch).mockResolvedValue(deepResult(FINISHED_FACTS));
    const { deps, rechecks, lifecycles } = fakeDeps({ due: [dueRow()] });
    const result = await processPlayriftboundRechecks(deps);
    expect(playriftboundDeepFetch).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({ processed: 1, fetched: 1, players: 12, matches: 24 });
    expect(lifecycles).toEqual([
      { id: "live-1", values: { status: "complete", sourceCheckedAt: NOW } },
    ]);
    expect(rechecks).toEqual([
      {
        tournamentId: "117000000000000001",
        nextCheckAt: new Date(NOW.getTime() + DAY_MS),
        checkStage: 1,
        failingSince: null,
      },
    ]);
  });

  it("skips the detail request when the source reports no change mid-event", async () => {
    const sourceUpdatedAt = new Date(NOW.getTime() - HOUR_MS);
    vi.mocked(readPlayriftboundUpdatedAt).mockResolvedValue(sourceUpdatedAt);
    const { deps, rechecks } = fakeDeps({
      due: [
        dueRow({
          resultsFetchedAt: NOW,
          sourceUpdatedAt,
          roundCount: 4,
          roundsPlayed: 2,
          roundsFinalized: 1,
        }),
      ],
    });
    await processPlayriftboundRechecks(deps);
    expect(playriftboundDeepFetch).not.toHaveBeenCalled();
    expect(rechecks[0]?.nextCheckAt).toEqual(new Date(dueRow().startAt.getTime() + 3 * DAY_MS));
  });

  it("re-fetches an unchanged event once it reads complete, for the final sheet", async () => {
    vi.mocked(readPlayriftboundUpdatedAt).mockResolvedValue(FINISHED_FACTS.sourceUpdatedAt);
    vi.mocked(playriftboundDeepFetch).mockResolvedValue(deepResult(FINISHED_FACTS));
    const { deps } = fakeDeps({
      due: [dueRow({ resultsFetchedAt: NOW, ...FINISHED_FACTS, checkStage: 0 })],
    });
    await processPlayriftboundRechecks(deps);
    expect(playriftboundDeepFetch).toHaveBeenCalledTimes(1);
  });

  it("retries a failed fetch in an hour without moving the ladder", async () => {
    vi.mocked(readPlayriftboundUpdatedAt).mockResolvedValue(null);
    vi.mocked(playriftboundDeepFetch).mockResolvedValue(deepResult(null));
    const { deps, rechecks } = fakeDeps({ due: [dueRow({ checkStage: 2 })] });
    const result = await processPlayriftboundRechecks(deps);
    expect(rechecks).toEqual([
      {
        tournamentId: "117000000000000001",
        nextCheckAt: new Date(NOW.getTime() + HOUR_MS),
        checkStage: 2,
        failingSince: NOW,
      },
    ]);
    expect(result.errors.join(" ")).toMatch(/HTTP 500/u);
  });

  it("drops an event whose visits have failed for two weeks", async () => {
    vi.mocked(readPlayriftboundUpdatedAt).mockResolvedValue(null);
    vi.mocked(playriftboundDeepFetch).mockResolvedValue(deepResult(null));
    const failingSince = new Date(NOW.getTime() - 15 * DAY_MS);
    const { deps, rechecks } = fakeDeps({ due: [dueRow({ failingSince, checkStage: 2 })] });
    const result = await processPlayriftboundRechecks(deps);
    expect(rechecks).toEqual([
      { tournamentId: "117000000000000001", nextCheckAt: null, checkStage: 2 },
    ]);
    expect(result.dropped).toBe(1);
  });

  it("retries an old event's first failure in an hour and remembers when it began", async () => {
    vi.mocked(readPlayriftboundUpdatedAt).mockResolvedValue(null);
    vi.mocked(playriftboundDeepFetch).mockResolvedValue(deepResult(null));
    const startAt = new Date(NOW.getTime() - 40 * DAY_MS);
    const { deps, rechecks } = fakeDeps({ due: [dueRow({ startAt, checkStage: 3 })] });
    const result = await processPlayriftboundRechecks(deps);
    expect(rechecks).toEqual([
      {
        tournamentId: "117000000000000001",
        nextCheckAt: new Date(NOW.getTime() + HOUR_MS),
        checkStage: 3,
        failingSince: NOW,
      },
    ]);
    expect(result.dropped).toBe(0);
  });

  it("stops rechecking an event the source no longer has", async () => {
    vi.mocked(readPlayriftboundUpdatedAt).mockResolvedValue(null);
    vi.mocked(playriftboundDeepFetch).mockResolvedValue(deepResult(null, { gone: true }));
    const { deps, rechecks } = fakeDeps({ due: [dueRow()] });
    const result = await processPlayriftboundRechecks(deps);
    expect(rechecks).toEqual([
      { tournamentId: "117000000000000001", nextCheckAt: null, checkStage: 0 },
    ]);
    expect(result).toMatchObject({ dropped: 1, processed: 1, backedOff: false });
  });

  it("retries an event the poller still answers for when the detail read comes back empty", async () => {
    vi.mocked(readPlayriftboundUpdatedAt).mockResolvedValue(NOW);
    vi.mocked(playriftboundDeepFetch).mockResolvedValue(deepResult(null, { gone: true }));
    const { deps, rechecks } = fakeDeps({ due: [dueRow()] });
    const result = await processPlayriftboundRechecks(deps);
    expect(rechecks).toEqual([
      {
        tournamentId: "117000000000000001",
        nextCheckAt: new Date(NOW.getTime() + HOUR_MS),
        checkStage: 0,
        failingSince: NOW,
      },
    ]);
    expect(result.dropped).toBe(0);
  });

  it("pauses for half an hour after five visits in a row fail", async () => {
    vi.mocked(readPlayriftboundUpdatedAt).mockRejectedValue(new Error("HTTP 503"));
    const due = Array.from({ length: 8 }, (_, index) =>
      dueRow({ tournamentId: `11700000000000000${index}` }),
    );
    const { deps } = fakeDeps({ due });
    const result = await processPlayriftboundRechecks(deps);
    expect(result.due).toBe(5);
    expect(result.backedOff).toBe(true);
    expect(result.pausedUntil).toBe(new Date(NOW.getTime() + 30 * 60 * 1000).toISOString());
    expect(result.blockedUntil).toBeNull();
  });

  it("stops at a block, defers that event to the end of the cool-down", async () => {
    vi.mocked(readPlayriftboundUpdatedAt).mockRejectedValue(
      new PlayriftboundBlockedError("https://source.invalid/api/gql"),
    );
    const due = [dueRow({ tournamentId: "1" }), dueRow({ tournamentId: "2" })];
    const { deps, rechecks } = fakeDeps({ due });
    const result = await processPlayriftboundRechecks(deps);
    expect(readPlayriftboundUpdatedAt).toHaveBeenCalledTimes(1);
    expect(rechecks).toEqual([
      { tournamentId: "1", nextCheckAt: new Date(NOW.getTime() + 6 * HOUR_MS), checkStage: 0 },
    ]);
    expect(result.blocked).toBe(true);
    expect(result.blockedUntil).toBe(new Date(NOW.getTime() + 6 * HOUR_MS).toISOString());
  });
});

describe("processPlayriftboundRechecks on a refused query, old event", () => {
  beforeEach(() => {
    vi.mocked(readPlayriftboundUpdatedAt).mockReset();
  });

  it("defers an old event to the end of the cool-down and keeps it on the ladder", async () => {
    vi.mocked(readPlayriftboundUpdatedAt).mockRejectedValue(
      new PlayriftboundRefusedError("GetCompeteRbRefreshPoller: ValidationError", true),
    );
    const startAt = new Date(NOW.getTime() - 40 * DAY_MS);
    const failingSince = new Date(NOW.getTime() - 15 * DAY_MS);
    const { deps, rechecks } = fakeDeps({
      due: [dueRow({ startAt, failingSince, checkStage: 1 })],
    });
    await processPlayriftboundRechecks(deps);
    expect(rechecks).toEqual([
      {
        tournamentId: "117000000000000001",
        nextCheckAt: new Date(NOW.getTime() + 6 * HOUR_MS),
        checkStage: 1,
      },
    ]);
  });
});

describe("processPlayriftboundRechecks on a refused query", () => {
  beforeEach(() => {
    vi.mocked(readPlayriftboundUpdatedAt).mockReset();
    vi.mocked(playriftboundDeepFetch).mockReset();
  });

  it("stops at once and cools down, since every event would fail the same way", async () => {
    vi.mocked(readPlayriftboundUpdatedAt).mockRejectedValue(
      new PlayriftboundRefusedError("GetCompeteRbRefreshPoller: PERSISTED_QUERY_NOT_IN_LIST", true),
    );
    const due = [dueRow({ tournamentId: "1" }), dueRow({ tournamentId: "2" })];
    const { deps } = fakeDeps({ due });
    const result = await processPlayriftboundRechecks(deps);
    expect(readPlayriftboundUpdatedAt).toHaveBeenCalledTimes(1);
    expect(result.blocked).toBe(true);
    expect(result.blockedUntil).toBe(new Date(NOW.getTime() + 6 * HOUR_MS).toISOString());
  });

  it("pauses and leaves the event due when the query list will not load", async () => {
    vi.mocked(readPlayriftboundUpdatedAt).mockRejectedValue(
      new PlayriftboundUnavailableError("Reading the query list failed: HTTP 503"),
    );
    const startAt = new Date(NOW.getTime() - 15 * DAY_MS);
    const { deps, rechecks } = fakeDeps({ due: [dueRow({ startAt, checkStage: 1 })] });
    const result = await processPlayriftboundRechecks(deps);
    expect(rechecks).toEqual([]);
    expect(result).toMatchObject({
      blocked: false,
      blockedUntil: null,
      pausedUntil: new Date(NOW.getTime() + HOUR_MS / 2).toISOString(),
    });
  });
});

describe("fetchPlayriftboundEvent", () => {
  beforeEach(() => {
    vi.mocked(playriftboundDeepFetch).mockReset();
  });

  it("moves a finished event straight to its first revisit", async () => {
    vi.mocked(playriftboundDeepFetch).mockResolvedValue(deepResult(FINISHED_FACTS));
    const { deps, rechecks } = fakeDeps({});
    const row: PlayriftboundListRow = dueRow();
    await fetchPlayriftboundEvent(deps, row);
    expect(rechecks).toEqual([
      {
        tournamentId: "117000000000000001",
        nextCheckAt: new Date(NOW.getTime() + DAY_MS),
        checkStage: 1,
      },
    ]);
  });

  it("clears an earlier failure streak once a manual fetch succeeds", async () => {
    vi.mocked(playriftboundDeepFetch).mockResolvedValue(deepResult(FINISHED_FACTS));
    const { deps, cleared } = fakeDeps({});
    await fetchPlayriftboundEvent(deps, dueRow({ checkStage: 2 }));
    expect(cleared).toEqual(["117000000000000001"]);
  });

  it("reports a cool-down when the source blocks a manual fetch", async () => {
    vi.mocked(playriftboundDeepFetch).mockRejectedValue(
      new PlayriftboundBlockedError("https://source.invalid/api/gql"),
    );
    const { deps } = fakeDeps({});
    const result = await fetchPlayriftboundEvent(deps, dueRow());
    expect(result.blockedUntil).toBe(new Date(NOW.getTime() + 6 * HOUR_MS).toISOString());
    expect(result.complete).toBe(false);
  });

  it("reports no cool-down when the query list will not load for a manual fetch", async () => {
    vi.mocked(playriftboundDeepFetch).mockRejectedValue(
      new PlayriftboundUnavailableError("Reading the query list failed: HTTP 503"),
    );
    const { deps } = fakeDeps({});
    const result = await fetchPlayriftboundEvent(deps, dueRow());
    expect(result).toMatchObject({ blockedUntil: null, complete: false });
  });

  it("leaves the queue alone while the event is still running", async () => {
    vi.mocked(playriftboundDeepFetch).mockResolvedValue(
      deepResult({ ...FINISHED_FACTS, roundsFinalized: 2, sourceUpdatedAt: NOW }),
    );
    const { deps, rechecks } = fakeDeps({});
    await fetchPlayriftboundEvent(deps, dueRow());
    expect(rechecks).toHaveLength(0);
  });
});
