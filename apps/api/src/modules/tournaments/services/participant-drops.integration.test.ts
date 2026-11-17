import { NO_PENALTY_BREAKDOWN } from "@openrift/shared/pairing/penalty";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createRepos, createTransact } from "../../../deps.js";
import { createDbContext, seedTestUser } from "../../../test/integration-context.js";
import { dropLiveSpotsOfUser } from "./participant-drops.js";

const HOST_ID = crypto.randomUUID();
const LEAVER_ID = crypto.randomUUID();

const ctx = createDbContext(HOST_ID);

describe.skipIf(!ctx)("closed accounts in tournaments (integration)", () => {
  const { db } = ctx!;

  let tournamentId: string;
  let leaverParticipantId: string;
  let walkInId: string;
  const liveTournamentIds: string[] = [];
  let liveActiveId: string;
  let liveRequestedId: string;
  let groupLeaverId: string;
  let groupOpponentId: string;
  let groupPodId: string;

  async function liveTournament(values: Record<string, unknown>): Promise<string> {
    const row = await db
      .insertInto("tournaments")
      .values({ hostType: "user", hostUserId: HOST_ID, name: "Live night", ...values })
      .returning("id")
      .executeTakeFirstOrThrow();
    liveTournamentIds.push(row.id);
    return row.id;
  }

  async function leaverRow(liveId: string, status: "active" | "requested"): Promise<string> {
    const row = await db
      .insertInto("tournamentParticipants")
      .values({
        tournamentId: liveId,
        userId: LEAVER_ID,
        displayName: "Ekko",
        claimSource: "self_submit",
        claimedAt: new Date(),
        status,
      })
      .returning("id")
      .executeTakeFirstOrThrow();
    return row.id;
  }

  beforeAll(async () => {
    await seedTestUser(db, { id: HOST_ID });
    await seedTestUser(db, { id: LEAVER_ID });

    const tournament = await db
      .insertInto("tournaments")
      .values({
        hostType: "user",
        hostUserId: HOST_ID,
        name: "Summoner Skirmish",
        status: "completed",
        startsAt: new Date("2026-01-10T18:00:00Z"),
      })
      .returning("id")
      .executeTakeFirstOrThrow();
    tournamentId = tournament.id;

    const leaver = await db
      .insertInto("tournamentParticipants")
      .values({
        tournamentId,
        userId: LEAVER_ID,
        displayName: `test-${LEAVER_ID}@test.com`,
        riotId: "Ekko#ZAUN",
        claimSource: "self_submit",
        claimedAt: new Date(),
        claimToken: `closed-${LEAVER_ID}`,
        seed: 3,
      })
      .returning("id")
      .executeTakeFirstOrThrow();
    leaverParticipantId = leaver.id;

    const walkIn = await db
      .insertInto("tournamentParticipants")
      .values({ tournamentId, displayName: "Walk-in Jinx" })
      .returning("id")
      .executeTakeFirstOrThrow();
    walkInId = walkIn.id;

    const round = await db
      .insertInto("podRounds")
      .values({ tournamentId, roundNumber: 1, penaltyTotal: 0, pairingStrategy: "manual" })
      .returning("id")
      .executeTakeFirstOrThrow();
    const pod = await db
      .insertInto("pods")
      .values({
        roundId: round.id,
        podNumber: 1,
        size: 2,
        penaltyBreakdown: NO_PENALTY_BREAKDOWN,
        resultStatus: "reported",
      })
      .returning("id")
      .executeTakeFirstOrThrow();
    await db
      .insertInto("podMembers")
      .values([
        { podId: pod.id, playerId: leaverParticipantId, placement: 1, gamePoints: 2 },
        { podId: pod.id, playerId: walkInId, placement: 2, gamePoints: 0 },
      ])
      .execute();

    const roundsEvent = await liveTournament({ currentRound: 2 });
    liveActiveId = await leaverRow(roundsEvent, "active");
    liveRequestedId = await leaverRow(await liveTournament({}), "requested");

    const groupEvent = await liveTournament({
      format: "group_cut",
      pairingStyle: "swiss",
      currentRound: 1,
    });
    groupLeaverId = await leaverRow(groupEvent, "active");
    const opponent = await db
      .insertInto("tournamentParticipants")
      .values({ tournamentId: groupEvent, displayName: "Walk-in Vi" })
      .returning("id")
      .executeTakeFirstOrThrow();
    groupOpponentId = opponent.id;
    const groupRound = await db
      .insertInto("podRounds")
      .values({
        tournamentId: groupEvent,
        roundNumber: 1,
        penaltyTotal: 0,
        pairingStrategy: "manual",
      })
      .returning("id")
      .executeTakeFirstOrThrow();
    const groupPod = await db
      .insertInto("pods")
      .values({
        roundId: groupRound.id,
        podNumber: 1,
        size: 2,
        penaltyBreakdown: NO_PENALTY_BREAKDOWN,
      })
      .returning("id")
      .executeTakeFirstOrThrow();
    groupPodId = groupPod.id;
    await db
      .insertInto("podMembers")
      .values([
        { podId: groupPodId, playerId: groupLeaverId },
        { podId: groupPodId, playerId: groupOpponentId },
      ])
      .execute();

    await dropLiveSpotsOfUser(createRepos(db), createTransact(db), LEAVER_ID);
    await db.deleteFrom("users").where("id", "=", LEAVER_ID).execute();
  });

  afterAll(async () => {
    await db
      .deleteFrom("tournaments")
      .where("id", "in", [tournamentId, ...liveTournamentIds])
      .execute();
    await db.deleteFrom("users").where("id", "=", HOST_ID).execute();
  });

  it("leaves a past event's spot as it was, without the name, Riot ID and claim link", async () => {
    const row = await db
      .selectFrom("tournamentParticipants")
      .selectAll()
      .where("id", "=", leaverParticipantId)
      .executeTakeFirstOrThrow();
    expect(row).toMatchObject({
      userId: null,
      displayName: null,
      riotId: null,
      claimToken: null,
      isAccountClosed: true,
      status: "active",
      seed: 3,
    });
  });

  it("drops the deleted account's spot in a running event after the current round", async () => {
    const row = await db
      .selectFrom("tournamentParticipants")
      .select(["status", "droppedAfterRound", "isAccountClosed as accountClosed"])
      .where("id", "=", liveActiveId)
      .executeTakeFirstOrThrow();
    expect(row).toEqual({ status: "dropped", droppedAfterRound: 2, accountClosed: true });
  });

  it("withdraws the deleted account's pending request", async () => {
    const row = await db
      .selectFrom("tournamentParticipants")
      .select("id")
      .where("id", "=", liveRequestedId)
      .executeTakeFirst();
    expect(row).toBeUndefined();
  });

  it("reports the deleted account's open group-stage pod as a walkover", async () => {
    const members = await db
      .selectFrom("podMembers")
      .select(["playerId", "placement", "gamePoints"])
      .where("podId", "=", groupPodId)
      .execute();
    expect(members).toEqual(
      expect.arrayContaining([
        { playerId: groupOpponentId, placement: 1, gamePoints: null },
        { playerId: groupLeaverId, placement: 2, gamePoints: null },
      ]),
    );
    const pod = await db
      .selectFrom("pods")
      .select("resultStatus")
      .where("id", "=", groupPodId)
      .executeTakeFirstOrThrow();
    expect(pod.resultStatus).toBe("reported");
  });

  it("keeps the deleted account's results", async () => {
    const members = await db
      .selectFrom("podMembers")
      .select(["placement", "gamePoints"])
      .where("playerId", "=", leaverParticipantId)
      .execute();
    expect(members).toEqual([{ placement: 1, gamePoints: 2 }]);
  });

  it("leaves a walk-in untouched", async () => {
    const row = await db
      .selectFrom("tournamentParticipants")
      .select(["displayName", "isAccountClosed as accountClosed"])
      .where("id", "=", walkInId)
      .executeTakeFirstOrThrow();
    expect(row).toEqual({ displayName: "Walk-in Jinx", accountClosed: false });
  });

  it("refuses a closed participant that still has a name", async () => {
    await expect(
      db
        .updateTable("tournamentParticipants")
        .set({ displayName: "Ekko" })
        .where("id", "=", leaverParticipantId)
        .execute(),
    ).rejects.toThrow(/chk_tournament_participants_name/u);
  });

  it("refuses an open participant without a name", async () => {
    await expect(
      db
        .updateTable("tournamentParticipants")
        .set({ displayName: null })
        .where("id", "=", walkInId)
        .execute(),
    ).rejects.toThrow(/chk_tournament_participants_name/u);
  });
});
