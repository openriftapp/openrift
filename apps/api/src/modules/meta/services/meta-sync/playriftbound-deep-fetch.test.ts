import { createLogger } from "@openrift/shared/logger";
import { describe, expect, it, vi } from "vitest";

import type { Repos, Transact } from "../../../../deps.js";
import { promoteMetaEvent } from "../meta-promote.js";
import type { PlayriftboundClient } from "./playriftbound-client.js";
import { PlayriftboundBlockedError, PlayriftboundRefusedError } from "./playriftbound-client.js";
import { playriftboundDeepFetch, readPlayriftboundUpdatedAt } from "./playriftbound-deep-fetch.js";
import type { PlayriftboundSyncDeps } from "./playriftbound-deps.js";

vi.mock("../meta-promote.js", () => ({
  promoteMetaEvent: vi.fn(() => Promise.resolve({ players: 2, unresolvedNames: [], errors: [] })),
}));

const NOW = new Date("2026-10-18T22:00:00Z");
const TOURNAMENT_ID = "117000000000000001";
const STARTED = new Date("2026-10-18T10:00:00Z");

const TOURNAMENT = {
  id: TOURNAMENT_ID,
  updatedAt: "2026-10-18T14:00:00.123456Z",
  config: { structure: "SWISS", matchFormat: "BO1", roundCount: 3 },
  tournamentParticipants: [
    { esportsTeamId: "t1", status: "ACTIVE", player: { id: "u1", displayName: "Teemo Main" } },
    { esportsTeamId: "t2", status: "ACTIVE", player: { id: "u2", displayName: "Poro Snax" } },
  ],
  stages: [
    {
      esportsStageId: "s1",
      sections: [
        {
          esportsSectionId: "x1",
          rounds: [
            {
              roundNumber: 1,
              status: "FINALIZED",
              byeTeamIds: [],
              matches: [
                {
                  esportsMatchId: "m1",
                  teamOutcomes: [
                    { esportsTeamId: "t1", outcome: "WIN" },
                    { esportsTeamId: "t2", outcome: "LOSS" },
                  ],
                  games: [],
                  teams: [{ esportsTeamId: "t1" }, { esportsTeamId: "t2" }],
                },
              ],
              endOfRoundStandings: [
                { esportsTeamId: "t1", rank: 1, matchWins: 1, matchLosses: 0, matchDraws: 0 },
                { esportsTeamId: "t2", rank: 2, matchWins: 0, matchLosses: 1, matchDraws: 0 },
              ],
            },
          ],
        },
      ],
    },
  ],
};

function fakeDeps(options: { answer: unknown | Error; linked: boolean }) {
  const replaced: unknown[] = [];
  const facts: unknown[] = [];
  let requests = 0;
  const client: PlayriftboundClient = {
    blocked: false,
    get requests() {
      return requests;
    },
    query: <T>(): Promise<T> => {
      requests++;
      return options.answer instanceof Error
        ? Promise.reject(options.answer)
        : Promise.resolve(options.answer as T);
    },
  };
  const repos = {
    playriftboundResults: {
      replaceResults: (id: string, results: unknown) => {
        replaced.push({ id, results });
        return Promise.resolve();
      },
    },
    playriftboundEvents: {
      setDetailFacts: (id: string, value: unknown) => {
        facts.push({ id, value });
        return Promise.resolve();
      },
    },
    meta: {
      sourceByKey: () => Promise.resolve(options.linked ? { metaEventId: "live-1" } : undefined),
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
  return { deps, replaced, facts };
}

describe("playriftboundDeepFetch", () => {
  it("replaces the mirror, records progress and promotes a linked event", async () => {
    const { deps, replaced, facts } = fakeDeps({
      answer: { competeTournaments: [TOURNAMENT] },
      linked: true,
    });
    const result = await playriftboundDeepFetch(deps, TOURNAMENT_ID, STARTED);
    expect(result).toMatchObject({
      complete: true,
      players: 2,
      matches: 1,
      acceptedPlayers: 2,
      requests: 1,
    });
    expect(replaced).toEqual([
      {
        id: TOURNAMENT_ID,
        results: {
          standings: [
            expect.objectContaining({
              tournamentId: TOURNAMENT_ID,
              teamId: "t1",
              rank: 1,
              fetchedAt: NOW,
            }),
            expect.objectContaining({ tournamentId: TOURNAMENT_ID, teamId: "t2", rank: 2 }),
          ],
          // A quiet event that stopped after one of three rounds stores the one it played.
          phases: [
            {
              tournamentId: TOURNAMENT_ID,
              phaseOrder: 0,
              name: null,
              roundType: "SWISS",
              roundCount: 1,
              maxGameWins: 1,
            },
          ],
          matches: [expect.objectContaining({ tournamentId: TOURNAMENT_ID, sourceMatchId: "m1" })],
        },
      },
    ]);
    expect(facts).toEqual([
      {
        id: TOURNAMENT_ID,
        value: expect.objectContaining({ roundsFinalized: 1, roundsPlayed: 1 }),
      },
    ]);
    expect(promoteMetaEvent).toHaveBeenCalledWith(deps.repos, "live-1");
  });

  it("does not promote an event nobody accepted", async () => {
    vi.mocked(promoteMetaEvent).mockClear();
    const { deps } = fakeDeps({ answer: { competeTournaments: [TOURNAMENT] }, linked: false });
    await playriftboundDeepFetch(deps, TOURNAMENT_ID, STARTED);
    expect(promoteMetaEvent).not.toHaveBeenCalled();
  });

  it("collects a failed or empty read without writing anything", async () => {
    const failed = fakeDeps({ answer: new Error("HTTP 503"), linked: true });
    const result = await playriftboundDeepFetch(failed.deps, TOURNAMENT_ID, STARTED);
    expect(result.complete).toBe(false);
    expect(result.errors).toEqual([`Event ${TOURNAMENT_ID} detail: HTTP 503`]);
    expect(failed.replaced).toHaveLength(0);

    const empty = fakeDeps({ answer: { competeTournaments: [] }, linked: true });
    const none = await playriftboundDeepFetch(empty.deps, TOURNAMENT_ID, STARTED);
    expect(none).toMatchObject({ complete: false, gone: true });
    expect(empty.replaced).toHaveLength(0);

    const odd = fakeDeps({ answer: { somethingElse: true }, linked: true });
    const unreadable = await playriftboundDeepFetch(odd.deps, TOURNAMENT_ID, STARTED);
    expect(unreadable).toMatchObject({ complete: false, gone: false });
  });

  it("lets a block through, so the pass that asked can stop", async () => {
    const blocked = fakeDeps({
      answer: new PlayriftboundBlockedError("https://source.invalid/api/gql"),
      linked: true,
    });
    await expect(
      playriftboundDeepFetch(blocked.deps, TOURNAMENT_ID, STARTED),
    ).rejects.toBeInstanceOf(PlayriftboundBlockedError);
  });
});

describe("refusals", () => {
  it("lets a refused query through and keeps a refused event among the errors", async () => {
    const shape = fakeDeps({
      answer: new PlayriftboundRefusedError("GetCompeteTournament: ValidationError", true),
      linked: true,
    });
    await expect(playriftboundDeepFetch(shape.deps, TOURNAMENT_ID, STARTED)).rejects.toBeInstanceOf(
      PlayriftboundRefusedError,
    );

    const event = fakeDeps({ answer: new PlayriftboundRefusedError("not found"), linked: true });
    const result = await playriftboundDeepFetch(event.deps, TOURNAMENT_ID, STARTED);
    expect(result).toMatchObject({ complete: false, gone: false });
  });

  it("reads a refused event's change time as unknown, and lets a refused query through", async () => {
    const event = fakeDeps({ answer: new PlayriftboundRefusedError("not found"), linked: false });
    await expect(readPlayriftboundUpdatedAt(event.deps, TOURNAMENT_ID)).resolves.toBeNull();

    const shape = fakeDeps({
      answer: new PlayriftboundRefusedError("GetCompeteRbRefreshPoller: PERSISTED_QUERY", true),
      linked: false,
    });
    await expect(readPlayriftboundUpdatedAt(shape.deps, TOURNAMENT_ID)).rejects.toBeInstanceOf(
      PlayriftboundRefusedError,
    );
  });
});

describe("readPlayriftboundUpdatedAt", () => {
  it("reads the poller's aliased timestamp", async () => {
    const { deps } = fakeDeps({
      answer: { t: { u: "2026-10-18T20:00:00.123456Z" } },
      linked: false,
    });
    await expect(readPlayriftboundUpdatedAt(deps, TOURNAMENT_ID)).resolves.toEqual(
      new Date("2026-10-18T20:00:00.123Z"),
    );
  });
});
