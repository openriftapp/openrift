import { describe, expect, it, vi } from "vitest";

import { tournamentHistoryForUser } from "./player-history.js";

const tournament = (id: string) =>
  ({
    id,
    scoringScheme: "standard",
    byePoints: 3,
    winPoints: 3,
    drawPoints: 1,
    playMode: "1v1",
  }) as never;

const standing = (playerId: string) => ({ playerId }) as never;

describe("tournamentHistoryForUser", () => {
  it("counts completed tournaments and keeps the best rank", async () => {
    const computeStandings = vi
      .fn()
      .mockResolvedValueOnce([standing("p-a"), standing("me-1"), standing("p-b")])
      .mockResolvedValueOnce([standing("p-c"), standing("p-d"), standing("p-e"), standing("me-2")]);
    const history = await tournamentHistoryForUser(
      {
        userProfile: {
          completedTournamentParticipations: vi.fn().mockResolvedValue([
            { tournament: tournament("t-1"), participantId: "me-1" },
            { tournament: tournament("t-2"), participantId: "me-2" },
          ]),
        },
        podTournaments: { computeStandings },
      },
      "user-1",
    );

    expect(history).toEqual({ played: 2, bestFinish: { rank: 2, players: 3 } });
    expect(computeStandings).toHaveBeenCalledTimes(2);
  });

  it("prefers the larger field when two finishes share a rank", async () => {
    const computeStandings = vi
      .fn()
      .mockResolvedValueOnce([standing("me-1"), standing("p-a")])
      .mockResolvedValueOnce([standing("me-2"), standing("p-b"), standing("p-c")]);
    const history = await tournamentHistoryForUser(
      {
        userProfile: {
          completedTournamentParticipations: vi.fn().mockResolvedValue([
            { tournament: tournament("t-1"), participantId: "me-1" },
            { tournament: tournament("t-2"), participantId: "me-2" },
          ]),
        },
        podTournaments: { computeStandings },
      },
      "user-1",
    );

    expect(history.bestFinish).toEqual({ rank: 1, players: 3 });
  });

  it("ignores a tournament whose standings do not list the participant", async () => {
    const history = await tournamentHistoryForUser(
      {
        userProfile: {
          completedTournamentParticipations: vi
            .fn()
            .mockResolvedValue([{ tournament: tournament("t-1"), participantId: "me-1" }]),
        },
        podTournaments: {
          computeStandings: vi.fn().mockResolvedValue([standing("p-a")]),
        },
      },
      "user-1",
    );

    expect(history).toEqual({ played: 1, bestFinish: null });
  });

  it("returns an empty history without computing standings", async () => {
    const computeStandings = vi.fn();
    const history = await tournamentHistoryForUser(
      {
        userProfile: { completedTournamentParticipations: vi.fn().mockResolvedValue([]) },
        podTournaments: { computeStandings },
      },
      "user-1",
    );

    expect(history).toEqual({ played: 0, bestFinish: null });
    expect(computeStandings).not.toHaveBeenCalled();
  });
});
