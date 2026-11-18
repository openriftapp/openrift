import { describe, expect, it, vi } from "vitest";

import type { Repos, Transact } from "../../../deps.js";
import type { Tournament, TournamentParticipant } from "../repositories/tournaments-shared.js";
import { dropLiveSpotsOfUser } from "./participant-drops.js";

const USER_ID = "a0000000-0001-4000-a000-000000000001";
const NOW = new Date("2026-11-16T12:00:00Z");

function tournament(overrides: Partial<Tournament> = {}): Tournament {
  return {
    id: "t-1",
    status: "running",
    startsAt: new Date("2026-11-16T10:00:00Z"),
    endsAt: null,
    currentRound: 2,
    playMode: "1v1",
    format: "rounds",
    ...overrides,
  } as Tournament;
}

function spot(overrides: Partial<TournamentParticipant> = {}): TournamentParticipant {
  return {
    id: "p-1",
    tournamentId: "t-1",
    userId: USER_ID,
    status: "active",
    teamId: null,
    ...overrides,
  } as TournamentParticipant;
}

function setup(options: {
  spots: TournamentParticipant[];
  tournaments: Tournament[];
  roster?: TournamentParticipant[];
  pendingPods?: { podId: string; members: { playerId: string; status: string }[] }[];
  lockedStatus?: TournamentParticipant["status"];
}) {
  const updateParticipant = vi.fn(() => Promise.resolve(undefined));
  const deleteParticipant = vi.fn(() => Promise.resolve());
  const setWalkoverResult = vi.fn(() => Promise.resolve());
  const byId = new Map(options.tournaments.map((row) => [row.id, row]));
  const spotById = new Map(options.spots.map((row) => [row.id, row]));
  const repos = {
    tournaments: {
      listParticipantsOfUser: vi.fn(() => Promise.resolve(options.spots)),
      getById: vi.fn((id: string) => Promise.resolve(byId.get(id))),
      listParticipants: vi.fn(() => Promise.resolve(options.roster ?? [])),
      lockRounds: vi.fn(() => Promise.resolve()),
      lockParticipant: vi.fn(() => Promise.resolve(true)),
      getParticipantById: vi.fn((id: string) => {
        const row = spotById.get(id);
        return Promise.resolve(
          row && options.lockedStatus ? { ...row, status: options.lockedStatus } : row,
        );
      }),
      updateParticipant,
      deleteParticipant,
    },
    tournamentGroups: {
      listPendingGroupStagePods: vi.fn(() => Promise.resolve(options.pendingPods ?? [])),
      setWalkoverResult,
    },
  } as unknown as Repos;
  const transactions = { count: 0 };
  const transact: Transact = (fn) => {
    transactions.count++;
    return fn(repos);
  };
  return { repos, transact, transactions, updateParticipant, deleteParticipant, setWalkoverResult };
}

describe("dropLiveSpotsOfUser", () => {
  it.each(["requested", "invited"] as const)("withdraws a %s spot", async (status) => {
    const { repos, transact, deleteParticipant, updateParticipant } = setup({
      spots: [spot({ status })],
      tournaments: [tournament({ status: "setup", startsAt: new Date("2026-11-20T10:00:00Z") })],
    });

    await dropLiveSpotsOfUser(repos, transact, USER_ID, NOW);

    expect(deleteParticipant).toHaveBeenCalledWith("p-1");
    expect(updateParticipant).not.toHaveBeenCalled();
  });

  it("leaves a pending spot the host approved before the lock", async () => {
    const { repos, transact, deleteParticipant } = setup({
      spots: [spot({ status: "requested" })],
      tournaments: [tournament()],
      lockedStatus: "active",
    });

    await dropLiveSpotsOfUser(repos, transact, USER_ID, NOW);

    expect(deleteParticipant).not.toHaveBeenCalled();
  });

  it("logs a spot that fails and still drops the others", async () => {
    const { repos, transact, updateParticipant } = setup({
      spots: [spot({ id: "p-1" }), spot({ id: "p-2" })],
      tournaments: [tournament()],
    });
    updateParticipant.mockRejectedValueOnce(new Error("lock timeout"));

    await expect(dropLiveSpotsOfUser(repos, transact, USER_ID, NOW)).resolves.toBeUndefined();

    expect(updateParticipant).toHaveBeenCalledWith("p-2", {
      status: "dropped",
      droppedAfterRound: 2,
    });
  });

  it("resolves when the spots cannot be listed", async () => {
    const { repos, transact } = setup({ spots: [], tournaments: [] });
    vi.mocked(repos.tournaments.listParticipantsOfUser).mockRejectedValueOnce(
      new Error("connection reset"),
    );

    await expect(dropLiveSpotsOfUser(repos, transact, USER_ID, NOW)).resolves.toBeUndefined();
  });

  it("drops in a transaction that takes the rounds lock before any write", async () => {
    const { repos, transact, transactions, updateParticipant, setWalkoverResult } = setup({
      spots: [spot()],
      tournaments: [tournament({ format: "group_cut", pairingStyle: "swiss", currentRound: 1 })],
      pendingPods: [
        {
          podId: "pod-1",
          members: [
            { playerId: "p-1", status: "dropped" },
            { playerId: "p-9", status: "active" },
          ],
        },
      ],
    });

    await dropLiveSpotsOfUser(repos, transact, USER_ID, NOW);

    expect(transactions.count).toBe(1);
    const lockOrder = vi.mocked(repos.tournaments.lockRounds).mock.invocationCallOrder[0] ?? 0;
    expect(lockOrder).toBeGreaterThan(0);
    expect(lockOrder).toBeLessThan(updateParticipant.mock.invocationCallOrder[0] ?? 0);
    expect(lockOrder).toBeLessThan(
      vi.mocked(repos.tournamentGroups.listPendingGroupStagePods).mock.invocationCallOrder[0] ?? 0,
    );
    expect(setWalkoverResult).toHaveBeenCalledTimes(1);
  });

  it("leaves a spot the host dropped while this waited for the lock", async () => {
    const { repos, transact, updateParticipant, setWalkoverResult } = setup({
      spots: [spot()],
      tournaments: [tournament({ format: "group_cut", pairingStyle: "swiss", currentRound: 1 })],
      lockedStatus: "dropped",
    });

    await dropLiveSpotsOfUser(repos, transact, USER_ID, NOW);

    expect(updateParticipant).not.toHaveBeenCalled();
    expect(setWalkoverResult).not.toHaveBeenCalled();
  });

  it("leaves a spot whose event was cancelled while this waited for the lock", async () => {
    const { repos, transact, updateParticipant } = setup({
      spots: [spot()],
      tournaments: [tournament()],
    });
    vi.mocked(repos.tournaments.lockRounds).mockImplementation(() => {
      vi.mocked(repos.tournaments.getById).mockResolvedValue(tournament({ status: "cancelled" }));
      return Promise.resolve();
    });

    await dropLiveSpotsOfUser(repos, transact, USER_ID, NOW);

    expect(updateParticipant).not.toHaveBeenCalled();
  });

  it("drops the active teammate of a 2v2 team too", async () => {
    const own = spot({ teamId: "team-1" });
    const teammate = spot({ id: "p-2", userId: null, teamId: "team-1" });
    const { repos, transact, updateParticipant } = setup({
      spots: [own],
      tournaments: [tournament({ playMode: "2v2" })],
      roster: [own, teammate],
    });

    await dropLiveSpotsOfUser(repos, transact, USER_ID, NOW);

    expect(updateParticipant).toHaveBeenCalledWith("p-2", {
      status: "dropped",
      droppedAfterRound: 2,
    });
  });

  it("leaves spots in completed, cancelled and ended events alone", async () => {
    const { repos, transact, updateParticipant, deleteParticipant } = setup({
      spots: [
        spot({ id: "p-1", tournamentId: "t-done" }),
        spot({ id: "p-2", tournamentId: "t-cancelled", status: "requested" }),
        spot({ id: "p-3", tournamentId: "t-ended" }),
      ],
      tournaments: [
        tournament({ id: "t-done", status: "completed" }),
        tournament({ id: "t-cancelled", status: "cancelled" }),
        tournament({
          id: "t-ended",
          startsAt: new Date("2026-11-10T10:00:00Z"),
          endsAt: new Date("2026-11-10T18:00:00Z"),
        }),
      ],
    });

    await dropLiveSpotsOfUser(repos, transact, USER_ID, NOW);

    expect(updateParticipant).not.toHaveBeenCalled();
    expect(deleteParticipant).not.toHaveBeenCalled();
  });

  it("leaves a spot the player already left as it is", async () => {
    const { repos, transact, updateParticipant, deleteParticipant } = setup({
      spots: [spot({ status: "dropped" }), spot({ id: "p-2", status: "no_show" })],
      tournaments: [tournament()],
    });

    await dropLiveSpotsOfUser(repos, transact, USER_ID, NOW);

    expect(updateParticipant).not.toHaveBeenCalled();
    expect(deleteParticipant).not.toHaveBeenCalled();
  });
});
