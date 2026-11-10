import type { GroupStageView } from "@openrift/shared/types/api/pod-tournament";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const replaceSeats = vi.hoisted(() => vi.fn());

vi.mock("@/features/tournaments/hooks/use-tournament-run", () => ({
  useReplaceGroupSeats: () => ({ mutateAsync: replaceSeats, isPending: false }),
}));

import { GroupSeatEditor, swapSeats } from "./group-seat-editor";
import type { SeatGroup } from "./group-seat-editor";

const groups = [
  { label: "A", pairedGroupLabel: null, playerIds: ["a1", "a2", "a3", "a4"] },
  { label: "B", pairedGroupLabel: null, playerIds: ["b1", "b2", "b3", "b4"] },
];

describe("swapSeats", () => {
  it("swaps two players across groups and keeps every size", () => {
    const next = swapSeats(groups, "a1", "b3");
    expect(next[0]?.playerIds).toEqual(["b3", "a2", "a3", "a4"]);
    expect(next[1]?.playerIds).toEqual(["b1", "b2", "a1", "b4"]);
  });

  it("swaps seats inside one group and ignores a self-drop", () => {
    expect(swapSeats(groups, "a2", "a4")[0]?.playerIds).toEqual(["a1", "a4", "a3", "a2"]);
    expect(swapSeats(groups, "a2", "a2")).toEqual(groups);
  });
});

function groupStage(): GroupStageView {
  return {
    groups: groups.map((group) => ({
      ...group,
      standings: group.playerIds.map((playerId) => ({
        playerId,
        displayName: `Summoner ${playerId.toUpperCase()}`,
      })),
    })),
  } as unknown as GroupStageView;
}

function renderEditor() {
  return render(<GroupSeatEditor id="t1" groupStage={groupStage()} onClose={() => {}} />);
}

function savedGroups(next: readonly SeatGroup[]) {
  return {
    id: "t1",
    groups: next.map((group) => ({ label: group.label, playerIds: group.playerIds })),
  };
}

beforeEach(() => {
  replaceSeats.mockReset().mockResolvedValue(undefined);
});

describe("GroupSeatEditor swap menu", () => {
  it("names each seat's menu button after the player", () => {
    renderEditor();
    for (const id of ["A1", "A4", "B1", "B4"]) {
      expect(
        screen.getByRole("button", { name: `Swap seat of Summoner ${id}` }),
      ).toBeInTheDocument();
    }
  });

  it("lists every other seat's player with their group and seat", async () => {
    const user = userEvent.setup();
    renderEditor();
    await user.click(screen.getByRole("button", { name: "Swap seat of Summoner A1" }));
    expect(screen.getByText("Swap with")).toBeInTheDocument();
    const items = await screen.findAllByRole("menuitem");
    expect(items).toHaveLength(7);
    expect(items[0]).toHaveTextContent("Summoner A2Group A, seat 2");
    expect(items[6]).toHaveTextContent("Summoner B4Group B, seat 4");
  });

  it("swaps across groups through the same path as a drop and refocuses the moved player", async () => {
    const user = userEvent.setup();
    renderEditor();
    await user.click(screen.getByRole("button", { name: "Swap seat of Summoner A1" }));
    await user.click(await screen.findByRole("menuitem", { name: /Summoner B3/u }));

    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Swap seat of Summoner A1" })).toHaveFocus();
    await user.click(screen.getByRole("button", { name: "Save groups" }));
    expect(replaceSeats).toHaveBeenCalledWith(savedGroups(swapSeats(groups, "a1", "b3")));
  });

  it("swaps inside one group by keyboard", async () => {
    const user = userEvent.setup();
    renderEditor();
    screen.getByRole("button", { name: "Swap seat of Summoner A2" }).focus();
    await user.keyboard("{Enter}");
    await screen.findByRole("menu");
    const target = screen.getByRole("menuitem", { name: /Summoner A4/u });
    for (let step = 0; step < 7 && document.activeElement !== target; step++) {
      await user.keyboard("{ArrowDown}");
    }
    expect(target).toHaveFocus();
    await user.keyboard("{Enter}");

    expect(screen.getByRole("button", { name: "Swap seat of Summoner A2" })).toHaveFocus();
    await user.click(screen.getByRole("button", { name: "Save groups" }));
    expect(replaceSeats).toHaveBeenCalledWith(savedGroups(swapSeats(groups, "a2", "a4")));
  });
});
