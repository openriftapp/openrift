import type {
  PodRoundResponse,
  PodSnapshotPlayer,
} from "@openrift/shared/types/api/pod-tournament";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  movePlayer,
  seedFromRound,
  toPayload,
} from "@/features/tournaments/lib/pod-pairing-editor";
import type { MoveTarget } from "@/features/tournaments/lib/pod-pairing-editor";

const replace = vi.hoisted(() => ({ pod: vi.fn(), cut: vi.fn() }));

vi.mock("@/features/tournaments/hooks/use-tournament-run", () => ({
  useReplaceTournamentPairing: () => ({ mutateAsync: replace.pod, isPending: false }),
  useReplaceCutPairing: () => ({ mutateAsync: replace.cut, isPending: false }),
}));

import { PodPairingEditor } from "./pod-pairing-editor";

function member(playerId: string) {
  return {
    playerId,
    displayName: `Summoner ${playerId.toUpperCase()}`,
    image: null,
    gravatarHash: null,
    teamId: null,
    gamePoints: null,
    placement: null,
    points: null,
  };
}

function podRound(): PodRoundResponse {
  return {
    id: "r1",
    roundNumber: 2,
    status: "reporting",
    pairingStrategy: "local-search",
    penaltyTotal: 0,
    createdAt: "2026-01-01T00:00:00.000Z",
    finalizedAt: null,
    pods: [
      {
        id: "p1",
        podNumber: 1,
        size: 4,
        resultStatus: "pending",
        penalty: null,
        members: ["a", "b", "c", "d"].map((id) => member(id)),
      },
      {
        id: "p2",
        podNumber: 2,
        size: 3,
        resultStatus: "pending",
        penalty: null,
        members: ["e", "f", "g"].map((id) => member(id)),
      },
    ],
    byes: [{ playerId: "h", displayName: "Summoner H", image: null, gravatarHash: null }],
  } as unknown as PodRoundResponse;
}

function cutRound(): PodRoundResponse {
  const round = podRound();
  return {
    ...round,
    pods: [
      { ...round.pods[0]!, size: 2, members: ["a", "b"].map((id) => member(id)) },
      { ...round.pods[1]!, size: 2, members: ["c", "d"].map((id) => member(id)) },
    ],
    byes: [],
  } as unknown as PodRoundResponse;
}

function snapshot(ids: string[]): PodSnapshotPlayer[] {
  return ids.map(
    (playerId) =>
      ({
        playerId,
        teamId: null,
        score: 3,
        pods3: 0,
        pods4: 0,
        byes: 0,
        opponents: {},
        region: null,
        regionHistory: {},
        fixedTable: null,
      }) as unknown as PodSnapshotPlayer,
  );
}

function renderEditor(round = podRound(), mode?: "pod" | "cut") {
  const ids = [
    ...round.pods.flatMap((pod) => pod.members.map((entry) => entry.playerId)),
    ...round.byes.map((bye) => bye.playerId),
  ];
  return render(
    <PodPairingEditor
      id="t1"
      round={round}
      snapshot={snapshot(ids)}
      mode={mode}
      onClose={() => {}}
    />,
  );
}

async function openMenu(name: string) {
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: `Move ${name}` }));
  return user;
}

async function menuItemNames(): Promise<string[]> {
  const items = await screen.findAllByRole("menuitem");
  return items.map((item) => item.textContent ?? "");
}

function expectedPayload(playerId: string, target: MoveTarget) {
  return {
    id: "t1",
    roundNumber: 2,
    ...toPayload(movePlayer(seedFromRound(podRound()), playerId, target)),
  };
}

beforeEach(() => {
  replace.pod.mockReset().mockResolvedValue(undefined);
  replace.cut.mockReset().mockResolvedValue(undefined);
});

describe("PodPairingEditor move menu", () => {
  it("names each chip's menu button after the player", () => {
    renderEditor();
    for (const name of ["A", "B", "C", "D", "E", "F", "G", "H"]) {
      expect(screen.getByRole("button", { name: `Move Summoner ${name}` })).toBeInTheDocument();
    }
  });

  it("lists the other pods, a new pod and the byes, never the current pod", async () => {
    renderEditor();
    await openMenu("Summoner A");
    expect(screen.getByText("Move to")).toBeInTheDocument();
    expect(await menuItemNames()).toEqual(["Pod 2", "New pod", "Byes"]);
  });

  it("leaves out the byes for a player already sitting out", async () => {
    renderEditor();
    await openMenu("Summoner H");
    expect(await menuItemNames()).toEqual(["Pod 1", "Pod 2", "New pod"]);
  });

  it("moves a player to another pod and saves what the same drop would save", async () => {
    renderEditor();
    const user = await openMenu("Summoner A");
    await user.click(await screen.findByRole("menuitem", { name: "Pod 2" }));
    await user.click(screen.getByRole("button", { name: "Save pairing" }));
    expect(replace.pod).toHaveBeenCalledWith(expectedPayload("a", { kind: "pod", index: 1 }));
  });

  it("moves a player to the byes and saves what the same drop would save", async () => {
    renderEditor();
    const user = await openMenu("Summoner A");
    await user.click(await screen.findByRole("menuitem", { name: "Byes" }));
    await user.click(screen.getByRole("button", { name: "Save pairing" }));
    expect(replace.pod).toHaveBeenCalledWith(expectedPayload("a", { kind: "bye" }));
  });

  it("opens a new pod for the moved player, with the same validation as a drop", async () => {
    renderEditor();
    const user = await openMenu("Summoner H");
    await user.click(await screen.findByRole("menuitem", { name: "New pod" }));

    expect(screen.getByText("Pod 3")).toBeInTheDocument();
    expect(screen.getByText("Pod 3 has 1 player. Pods must have 3 or 4.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save pairing" })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "Move Summoner H" }));
    expect(await menuItemNames()).toEqual(["Pod 1", "Pod 2", "New pod", "Byes"]);
  });

  it("moves by keyboard and returns focus to the moved player's button", async () => {
    renderEditor();
    const user = userEvent.setup();
    screen.getByRole("button", { name: "Move Summoner A" }).focus();
    await user.keyboard("{Enter}");
    await screen.findByRole("menu");
    expect(screen.getByRole("menuitem", { name: "Pod 2" })).toHaveFocus();
    await user.keyboard("{ArrowDown}");
    expect(screen.getByRole("menuitem", { name: "New pod" })).toHaveFocus();
    await user.keyboard("{ArrowUp}{Enter}");

    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Move Summoner A" })).toHaveFocus();
    await user.click(screen.getByRole("button", { name: "Save pairing" }));
    expect(replace.pod).toHaveBeenCalledWith(expectedPayload("a", { kind: "pod", index: 1 }));
  });

  it("closes on Escape without moving anyone", async () => {
    renderEditor();
    const user = await openMenu("Summoner A");
    await screen.findByRole("menu");
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Save pairing" }));
    expect(replace.pod).toHaveBeenCalledWith(
      expect.objectContaining(toPayload(seedFromRound(podRound()))),
    );
  });

  it("offers only the other bracket slots in a cut round", async () => {
    renderEditor(cutRound(), "cut");
    await openMenu("Summoner A");
    expect(await menuItemNames()).toEqual(["Match 2"]);
  });
});
