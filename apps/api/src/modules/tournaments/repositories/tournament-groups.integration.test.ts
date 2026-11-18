import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createRepos } from "../../../deps.js";
import { createDbContext, seedTestUser } from "../../../test/integration-context.js";
import { pairNextRound, submitPodResult } from "../services/pod-pairing.js";

const OWNER_ID = crypto.randomUUID();
const ctx = createDbContext(OWNER_ID);

describe.skipIf(!ctx)("tournamentGroupsRepo.setWalkoverResult (integration)", () => {
  const { db } = ctx!;
  const repos = createRepos(db);

  beforeAll(async () => {
    await seedTestUser(db, { id: OWNER_ID });
  });

  afterAll(async () => {
    await db.deleteFrom("tournaments").where("hostUserId", "=", OWNER_ID).execute();
    await db.deleteFrom("users").where("id", "=", OWNER_ID).execute();
  });

  async function openMatch() {
    const created = await repos.tournaments.create({
      hostType: "user",
      hostUserId: OWNER_ID,
      name: "Summoner Skirmish",
      pairingStyle: "pod",
      deckSubmission: "none",
    });
    await repos.podTournaments.addPlayer(created.id, "Piltover Pat");
    await repos.podTournaments.addPlayer(created.id, "Zaun Zed");
    await repos.tournaments.updateSettings(created.id, { pairingStyle: "swiss" });
    const tournament = await repos.tournaments.getById(created.id);
    await pairNextRound(repos, tournament!);
    const pod = await db
      .selectFrom("pods as p")
      .innerJoin("podRounds as r", "r.id", "p.roundId")
      .select("p.id")
      .where("r.tournamentId", "=", created.id)
      .executeTakeFirstOrThrow();
    const members = await db
      .selectFrom("podMembers")
      .select("playerId")
      .where("podId", "=", pod.id)
      .orderBy("playerId")
      .execute();
    return { tournamentId: created.id, podId: pod.id, playerIds: members.map((m) => m.playerId) };
  }

  async function podState(podId: string) {
    const pod = await db
      .selectFrom("pods")
      .select(["resultStatus", "drawnGames"])
      .where("id", "=", podId)
      .executeTakeFirstOrThrow();
    const members = await db
      .selectFrom("podMembers")
      .select(["playerId", "placement", "gamePoints"])
      .where("podId", "=", podId)
      .orderBy("playerId")
      .execute();
    return { ...pod, members };
  }

  it("reports a pending pod and writes each member's placement", async () => {
    const { podId, playerIds } = await openMatch();
    const [winner, loser] = playerIds;

    await repos.tournamentGroups.setWalkoverResult(podId, [
      { playerId: winner!, placement: 1 },
      { playerId: loser!, placement: 2 },
    ]);

    expect(await podState(podId)).toEqual({
      resultStatus: "reported",
      drawnGames: 0,
      members: [
        { playerId: winner, placement: 1, gamePoints: null },
        { playerId: loser, placement: 2, gamePoints: null },
      ],
    });
  });

  it("leaves a result reported first untouched", async () => {
    const { tournamentId, podId, playerIds } = await openMatch();
    const [first, second] = playerIds;
    await submitPodResult(
      repos,
      tournamentId,
      podId,
      [
        { playerId: first!, gamePoints: 2 },
        { playerId: second!, gamePoints: 1 },
      ],
      { allowFinalized: false },
    );
    const reported = await podState(podId);

    await repos.tournamentGroups.setWalkoverResult(podId, [
      { playerId: first!, placement: 2 },
      { playerId: second!, placement: 1 },
    ]);

    expect(await podState(podId)).toEqual(reported);
  });
});
