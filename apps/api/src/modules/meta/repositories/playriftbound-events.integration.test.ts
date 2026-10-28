import { afterAll, describe, expect, it } from "vitest";

import { PLAYRIFTBOUND_PROVIDER } from "../../../lib/meta-providers.js";
import { createDbContext } from "../../../test/integration-context.js";
import { metaRepo } from "./meta.js";
import type { PlayriftboundUpsertInput } from "./playriftbound-events.js";
import { playriftboundEventsRepo } from "./playriftbound-events.js";
import { playriftboundResultsRepo } from "./playriftbound-results.js";

// The mirror table has no provider column, so isolation is by key: every
// tournament id this file writes starts with 99000.

const ctx = createDbContext(crypto.randomUUID());

const KEYS = {
  hashed: "990000000000000001",
  gone: "990000000000000002",
  live: "990000000000000003",
  dismissed: "990000000000000004",
  results: "990000000000000005",
  due: "990000000000000006",
  unlocated: "990000000000000007",
  notStarted: "990000000000000011",
  collecting: "990000000000000012",
  final: "990000000000000013",
  noResults: "990000000000000014",
  needsDecision: "990000000000000015",
  passingNoResults: "990000000000000016",
  team: "990000000000000017",
  skippedUpcoming: "990000000000000018",
  rejected: "990000000000000019",
} as const;
const ALL_KEYS = Object.values(KEYS);
const ORGANIZER_ID = "pri-organizer-1";

const SEEN = new Date("2026-10-18T12:00:00Z");
const STARTED = new Date("2026-10-17T16:00:00Z");

const createdEventIds: string[] = [];

function row(overrides: Partial<PlayriftboundUpsertInput> = {}): PlayriftboundUpsertInput {
  return {
    tournamentId: KEYS.hashed,
    organizerId: ORGANIZER_ID,
    name: "PRI Nexus Night",
    startAt: STARTED,
    tournamentType: "NEXUS_NIGHT",
    format: "CONSTRUCTED",
    playerFormat: "ONE_V_ONE",
    participantCapacity: 16,
    registeredCount: 10,
    waitlistedCount: 0,
    pricing: "FREE",
    entryFeeCurrency: null,
    entryFeeMinor: null,
    contentHash: "hash-1",
    ...overrides,
  };
}

async function seedAccepted(tournamentId: string): Promise<string> {
  const live = await ctx!.db
    .insertInto("metaEvents")
    .values({
      slug: `pri-${crypto.randomUUID().slice(0, 8)}`,
      name: `PRI ${tournamentId}`,
      eventDate: "2026-10-17",
      format: "constructed",
    })
    .returning("id")
    .executeTakeFirstOrThrow();
  createdEventIds.push(live.id);
  await metaRepo(ctx!.db).insertEventSource({
    metaEventId: live.id,
    provider: PLAYRIFTBOUND_PROVIDER,
    externalId: tournamentId,
    label: PLAYRIFTBOUND_PROVIDER,
    sourceUrl: null,
  });
  return live.id;
}

afterAll(async () => {
  if (!ctx) {
    return;
  }
  await ctx.db.deleteFrom("playriftboundEvents").where("tournamentId", "in", ALL_KEYS).execute();
  await ctx.db.deleteFrom("playriftboundOrganizers").where("id", "=", ORGANIZER_ID).execute();
  await ctx.db.deleteFrom("metaEvents").where("id", "in", createdEventIds).execute();
  await ctx.db
    .deleteFrom("ignoredMetaSourceEvents")
    .where("provider", "=", PLAYRIFTBOUND_PROVIDER)
    .where("externalId", "in", ALL_KEYS)
    .execute();
});

describe.skipIf(!ctx)("playriftboundEventsRepo", () => {
  // oxlint-disable-next-line typescript/no-non-null-assertion -- guarded by skipIf
  const { db } = ctx!;
  const repo = playriftboundEventsRepo(db);
  const results = playriftboundResultsRepo(db);

  it("upserts organizers and reports where they are", async () => {
    await repo.upsertOrganizers([
      {
        id: ORGANIZER_ID,
        name: "PRI Bandle City Games",
        city: "Bandle City",
        adminArea: "BC",
        address: "1 Yordle Lane",
        latitude: 52.37,
        longitude: 9.73,
      },
    ]);
    const points = await repo.organizerCoordinates();
    expect(points).toContainEqual({ latitude: 52.37, longitude: 9.73 });
  });

  it("keeps an organizer's known address when a later row has no venue", async () => {
    const unlocated = {
      id: ORGANIZER_ID,
      name: "PRI Bandle City Games",
      city: null,
      adminArea: null,
      address: null,
      latitude: null,
      longitude: null,
    };
    await repo.upsertOrganizers([
      { ...unlocated, city: "Bandle City", latitude: 52.37, longitude: 9.73 },
      unlocated,
    ]);
    await repo.upsertOrganizers([unlocated]);

    const stored = await db
      .selectFrom("playriftboundOrganizers")
      .select(["city", "latitude", "longitude"])
      .where("id", "=", ORGANIZER_ID)
      .executeTakeFirstOrThrow();
    expect(stored).toEqual({ city: "Bandle City", latitude: 52.37, longitude: 9.73 });
  });

  it("inserts a new row, then costs an unchanged one only a last-seen write", async () => {
    const first = await repo.upsertBatch([row()], SEEN);
    const later = new Date(SEEN.getTime() + 60_000);
    const second = await repo.upsertBatch([row()], later);
    const third = await repo.upsertBatch([row({ contentHash: "hash-2" })], later);

    expect(first.inserted).toEqual([KEYS.hashed]);
    expect(second).toMatchObject({ inserted: [], changed: [], unchanged: [KEYS.hashed] });
    expect(third.changed).toEqual([KEYS.hashed]);
    const stored = await repo.byKey(KEYS.hashed);
    expect(stored?.organizerName).toBe("PRI Bandle City Games");
    expect(stored?.triage).toBe("new");
  });

  it("flags a row the window no longer returns, and a re-sighting clears it", async () => {
    await repo.upsertBatch(
      [row({ tournamentId: KEYS.gone }), row({ tournamentId: KEYS.unlocated, organizerId: null })],
      SEEN,
    );
    const marked = await repo.markMissing({
      from: new Date("2026-10-10T00:00:00Z"),
      to: new Date("2026-10-19T00:00:00Z"),
      seenBefore: new Date(SEEN.getTime() + 1),
      at: SEEN,
    });
    expect(marked).toBeGreaterThanOrEqual(1);
    const flagged = await repo.byKey(KEYS.gone);
    expect(flagged?.missingSince).not.toBeNull();
    // The crawl never searched where an event with no located store is.
    const unlocated = await repo.byKey(KEYS.unlocated);
    expect(unlocated?.missingSince).toBeNull();

    const back = await repo.upsertBatch([row({ tournamentId: KEYS.gone })], SEEN);
    expect(back.changed).toEqual([KEYS.gone]);
    const resighted = await repo.byKey(KEYS.gone);
    expect(resighted?.missingSince).toBeNull();
  });

  it("derives triage from citations and the ignore table", async () => {
    await repo.upsertBatch(
      [row({ tournamentId: KEYS.live }), row({ tournamentId: KEYS.dismissed })],
      SEEN,
    );
    const liveId = await seedAccepted(KEYS.live);
    await db
      .insertInto("ignoredMetaSourceEvents")
      .values({ provider: PLAYRIFTBOUND_PROVIDER, externalId: KEYS.dismissed })
      .execute();

    const live = await repo.byKey(KEYS.live);
    const dismissed = await repo.byKey(KEYS.dismissed);
    expect(live?.metaEventId).toBe(liveId);
    expect(dismissed?.triage).toBe("dismissed");
    const accepted = await repo.list(
      { triage: "accepted", search: "PRI" },
      { limit: 50, offset: 0 },
    );
    expect(accepted.rows.map((r) => r.tournamentId)).toContain(KEYS.live);
    const fresh = await repo.unacceptedByKeys([KEYS.live, KEYS.dismissed, KEYS.hashed]);
    expect(fresh.map((r) => r.tournamentId)).toEqual([KEYS.hashed]);
    const inputs = await repo.tierInputsForLiveEvents();
    expect(inputs).toContainEqual({
      metaEventId: liveId,
      tournamentId: KEYS.live,
      playerCount: 10,
    });
  });

  it("replaces results wholesale and counts what is staged", async () => {
    await repo.upsertBatch([row({ tournamentId: KEYS.results })], SEEN);
    const standing = {
      tournamentId: KEYS.results,
      teamId: "t1",
      playerId: "u1",
      playerName: "Teemo Main",
      rank: 1,
      wins: 3,
      losses: 0,
      draws: 0,
      matchPoints: 9,
      opponentMatchWinPct: 0.5,
      gameWinPct: 1,
      opponentGameWinPct: 0.5,
      entryStatus: null,
    };
    const match = {
      tournamentId: KEYS.results,
      sourceMatchId: "m1",
      roundId: "s:x:1",
      phaseOrder: 0,
      roundNumber: 1,
      tableNumber: 1,
      isBye: false,
      isDraw: false,
      player1TeamId: "t1",
      player2TeamId: "t2",
      winnerTeamId: "t1",
      gamesWonP1: 1,
      gamesWonP2: 0,
    };
    const phase = {
      tournamentId: KEYS.results,
      phaseOrder: 0,
      name: null,
      roundType: "SWISS",
      roundCount: 3,
      maxGameWins: 1,
    };
    await results.replaceResults(KEYS.results, {
      standings: [
        standing,
        { ...standing, teamId: "t2", playerId: "u2", playerName: "Poro Snax", rank: 2 },
      ],
      phases: [phase],
      matches: [match],
    });
    await results.replaceResults(KEYS.results, {
      standings: [standing],
      phases: [phase],
      matches: [match],
    });
    await repo.setDetailFacts(
      KEYS.results,
      {
        structure: "SWISS",
        matchFormat: "BO1",
        roundCount: 3,
        roundsPlayed: 3,
        roundsFinalized: 3,
        sourceUpdatedAt: SEEN,
      },
      SEEN,
    );

    expect(await results.standings(KEYS.results)).toHaveLength(1);
    const stored = await repo.byKey(KEYS.results);
    expect(stored).toMatchObject({
      stagedPlayerCount: 1,
      stagedMatchCount: 1,
      roundsFinalized: 3,
      resultsFetchedAt: SEEN,
    });
  });

  it("sorts each event into exactly one overview bucket", async () => {
    const before = await repo.syncOverview(16);
    const future = new Date(Date.now() + 7 * 86_400_000);
    const big = { registeredCount: 20 };
    await repo.upsertBatch(
      [
        row({ tournamentId: KEYS.notStarted, startAt: future }),
        row({ tournamentId: KEYS.collecting }),
        row({ tournamentId: KEYS.final }),
        row({ tournamentId: KEYS.noResults }),
        row({ tournamentId: KEYS.needsDecision, ...big }),
        row({ tournamentId: KEYS.passingNoResults, ...big }),
        row({ tournamentId: KEYS.team, ...big, playerFormat: "TWO_V_TWO" }),
        row({ tournamentId: KEYS.skippedUpcoming, startAt: future }),
        row({ tournamentId: KEYS.rejected, ...big }),
      ],
      SEEN,
    );
    for (const key of [KEYS.notStarted, KEYS.collecting, KEYS.final, KEYS.noResults]) {
      await seedAccepted(key);
    }
    await db
      .insertInto("ignoredMetaSourceEvents")
      .values({ provider: PLAYRIFTBOUND_PROVIDER, externalId: KEYS.rejected })
      .execute();
    const played = {
      structure: "SWISS",
      matchFormat: "BO1",
      roundCount: 3,
      roundsPlayed: 3,
      roundsFinalized: 3,
      sourceUpdatedAt: SEEN,
    };
    for (const key of [KEYS.final, KEYS.needsDecision, KEYS.team, KEYS.rejected]) {
      await repo.setDetailFacts(key, played, SEEN);
    }
    await repo.setRecheck(KEYS.collecting, {
      nextCheckAt: new Date(Date.now() + 3_600_000),
      checkStage: 0,
    });

    const after = await repo.syncOverview(16);

    expect({
      notStarted: after.notStarted - before.notStarted,
      collecting: after.collecting - before.collecting,
      final: after.final - before.final,
      noResults: after.noResults - before.noResults,
      needsDecision: after.needsDecision - before.needsDecision,
      passingNoResults: after.passingNoResults - before.passingNoResults,
      skippedUpcoming: after.skippedUpcoming - before.skippedUpcoming,
      skippedPast: after.skippedPast - before.skippedPast,
    }).toEqual({
      notStarted: 1,
      collecting: 1,
      final: 1,
      noResults: 1,
      needsDecision: 1,
      passingNoResults: 1,
      skippedUpcoming: 1,
      skippedPast: 1,
    });
    expect(after.nextCheckAt).not.toBeNull();

    const listed = await repo.list(
      { bucket: "needsDecision", minPlayers: 16, search: "PRI" },
      { limit: 500, offset: 0 },
    );
    expect(listed.rows.map((r) => r.tournamentId)).toContain(KEYS.needsDecision);
    expect(listed.rows.map((r) => r.tournamentId)).not.toContain(KEYS.passingNoResults);

    const passing = await repo.passingNoResultsKeys(16);
    expect(passing).toContain(KEYS.passingNoResults);
    expect(passing).not.toContain(KEYS.needsDecision);
    expect(passing).not.toContain(KEYS.team);
  });

  it("passes nothing through the rule while auto-publish is off", async () => {
    const overview = await repo.syncOverview(null);

    expect(overview.needsDecision).toBe(0);
    expect(overview.passingNoResults).toBe(0);
  });

  it("re-queues a running event and leaves a finished one on its ladder", async () => {
    await repo.upsertBatch([row({ tournamentId: KEYS.due })], SEEN);
    const later = new Date(SEEN.getTime() + 86_400_000);
    await repo.setRecheck(KEYS.due, { nextCheckAt: later, checkStage: 1 });
    await repo.rearmRunningEvents(SEEN);
    const finished = await repo.dueForRecheck(SEEN, 500);
    expect(finished.map((r) => r.tournamentId)).not.toContain(KEYS.due);

    await repo.setRecheck(KEYS.due, { nextCheckAt: later, checkStage: 0 });
    expect(await repo.rearmRunningEvents(SEEN)).toBeGreaterThanOrEqual(1);
    const running = await repo.dueForRecheck(SEEN, 500);
    expect(running.map((r) => r.tournamentId)).toContain(KEYS.due);
  });

  it("keeps a failure's start until a visit succeeds", async () => {
    await repo.upsertBatch([row({ tournamentId: KEYS.due })], SEEN);
    const failingOf = async () => {
      const due = await repo.dueForRecheck(SEEN, 500);
      return due.find((r) => r.tournamentId === KEYS.due)?.failingSince;
    };

    await repo.setRecheck(KEYS.due, { nextCheckAt: SEEN, checkStage: 1, failingSince: SEEN });
    await repo.setRecheck(KEYS.due, { nextCheckAt: SEEN, checkStage: 1 });
    expect(await failingOf()).toEqual(SEEN);

    await repo.setRecheck(KEYS.due, { nextCheckAt: SEEN, checkStage: 1, failingSince: null });
    expect(await failingOf()).toBeNull();

    await repo.setRecheck(KEYS.due, { nextCheckAt: SEEN, checkStage: 1, failingSince: SEEN });
    await repo.clearFailing(KEYS.due);
    expect(await failingOf()).toBeNull();
  });
});
