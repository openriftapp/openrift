import type { Printing } from "@openrift/shared/types/catalog";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { stubPrinting } from "@/test/factories";

const state = vi.hoisted(() => ({
  othersHaveYourWants: [] as {
    printingId: string;
    cardId: string;
    counterpartyUserId: string;
    buyQuantity: number;
  }[],
  othersWantYourHaves: [] as {
    printingId: string;
    cardId: string;
    counterpartyUserId: string;
    buyQuantity: number;
  }[],
  createTrade: vi.fn(async () => ({})),
}));

vi.mock("@/features/groups/hooks/use-friend-group-sharing", () => ({
  useFriendGroupShareableLists: () => ({
    data: {
      items: [
        {
          listId: "wish-1",
          listName: "Wishlist",
          listKind: "printing",
          listIntent: "wish",
          entryCount: 2,
          isShared: true,
        },
      ],
    },
  }),
  useShareListWithFriendGroup: () => ({ isPending: false, mutateAsync: vi.fn() }),
}));
vi.mock("@/features/groups/hooks/use-friend-groups", () => ({
  useFriendGroupMatches: () => ({
    data: {
      othersHaveYourWants: state.othersHaveYourWants,
      othersWantYourHaves: state.othersWantYourHaves,
    },
  }),
}));
vi.mock("@/features/groups/hooks/use-card-trades", () => ({
  useCreateTrade: () => ({ isPending: false, mutateAsync: state.createTrade }),
}));
vi.mock("@/features/lists/hooks/use-lists", () => ({
  useCreateList: () => ({ isPending: false, mutateAsync: vi.fn() }),
  useBulkAddListEntries: () => ({ isPending: false, mutateAsync: vi.fn() }),
}));

const { TradeProposalDialog } = await import("./trade-proposal-dialog");

function dialog(printing: Printing, available: number) {
  return (
    <TradeProposalDialog
      side="request"
      open
      onOpenChange={() => {}}
      choices={[{ printing, available }]}
      groupSlug="summoner-skirmish"
      groupName="Summoner Skirmish"
      counterpartyUserId="user-2"
      counterpartyName="Kai"
    />
  );
}

describe("TradeProposalDialog", () => {
  it("clamps a request to the new maximum when the member's wish shrinks", async () => {
    const printing = stubPrinting();
    const view = render(dialog(printing, 3));
    await userEvent.click(screen.getByRole("button", { name: "One more" }));
    await userEvent.click(screen.getByRole("button", { name: "One more" }));
    expect(screen.getByRole("spinbutton", { name: "Quantity" })).toHaveValue(3);

    state.othersHaveYourWants = [
      {
        printingId: printing.printingId,
        cardId: printing.cardId,
        counterpartyUserId: "user-2",
        buyQuantity: 1,
      },
    ];
    view.rerender(dialog(printing, 3));
    await userEvent.click(screen.getByRole("button", { name: "Send request" }));

    expect(state.createTrade).toHaveBeenCalledWith(
      expect.objectContaining({ role: "receiver", quantity: 1 }),
    );
  });

  it("offers no more copies than the member still wants", async () => {
    state.createTrade.mockClear();
    const printing = stubPrinting();
    state.othersWantYourHaves = [
      {
        printingId: printing.printingId,
        cardId: printing.cardId,
        counterpartyUserId: "user-2",
        buyQuantity: 2,
      },
    ];
    render(
      <TradeProposalDialog
        side="offer"
        open
        onOpenChange={() => {}}
        choices={[{ printing, available: 5, copyIds: ["c1", "c2", "c3", "c4", "c5"] }]}
        wantQuantity={4}
        groupSlug="summoner-skirmish"
        groupName="Summoner Skirmish"
        counterpartyUserId="user-2"
        counterpartyName="Kai"
      />,
    );
    for (let step = 0; step < 4; step++) {
      await userEvent.click(screen.getByRole("button", { name: "One more" }));
    }
    expect(screen.getByRole("spinbutton", { name: "Quantity" })).toHaveValue(2);
    await userEvent.click(screen.getByRole("button", { name: "Send offer" }));
    expect(state.createTrade).toHaveBeenCalledWith(
      expect.objectContaining({ role: "giver", quantity: 2 }),
    );
  });
});
