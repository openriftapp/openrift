import type { FriendGroupMatchRow } from "@openrift/shared/types/api/friend-group";
import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { stubPrinting } from "@/test/factories";

const restore = vi.hoisted(() => vi.fn());

const printing = stubPrinting({ printingId: "p-1", cardId: "c-1", card: { name: "Jinx, Rebel" } });

vi.mock("@/features/groups/hooks/use-trade-dismissals", () => ({
  useRestoreSuggestion: () => ({ mutate: restore, isPending: false }),
}));
vi.mock("@/features/cards/hooks/use-cards", () => ({
  useCards: () => ({ printingsById: { "p-1": printing } }),
}));
const { HiddenSuggestions } = await import("./hidden-suggestions");

function stubRow(overrides: Partial<FriendGroupMatchRow> = {}): FriendGroupMatchRow {
  return {
    counterpartyUserId: "user-robogirl",
    counterpartyName: "Robogirl",
    counterpartyImage: null,
    counterpartyGravatarHash: "hash",
    counterpartyListId: "list-1",
    counterpartyListName: "Wants",
    viewerListName: "Spares",
    sellEntryId: "sell-1",
    sellListId: "list-1",
    copyId: "copy-1",
    condition: null,
    grader: null,
    grade: null,
    notesPublic: null,
    printingId: "p-1",
    cardId: "c-1",
    cardName: "Jinx, Rebel",
    setId: "set-1",
    rarity: "epic",
    finish: "normal",
    imageId: null,
    buyEntryId: "buy-1",
    buyListId: "list-2",
    buyEntryKind: "printing",
    buyQuantity: 1,
    sellPref: { pricePref: null, priceAbsoluteCents: null, tradeType: null, currency: null },
    buyPref: { pricePref: null, priceAbsoluteCents: null, tradeType: null, currency: null },
    ...overrides,
  };
}

const groups = [
  {
    slug: "summoner-skirmish",
    name: "Summoner Skirmish",
    incoming: [stubRow({ counterpartyUserId: "user-mara", counterpartyName: "Mara" })],
    outgoing: [stubRow(), stubRow({ printingId: "p-2", cardId: "c-2" })],
  },
];

afterEach(() => {
  vi.clearAllMocks();
});

describe("HiddenSuggestions", () => {
  it("lists hidden suggestions and brings one back", () => {
    const dismissal = {
      direction: "outgoing" as const,
      counterpartyUserId: "user-robogirl",
      printingId: "p-1",
    };
    render(<HiddenSuggestions dismissals={[dismissal]} groups={groups} />);
    fireEvent.click(screen.getByRole("button", { name: /1 hidden suggestion/u }));
    expect(screen.getByText("Jinx, Rebel for Robogirl")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Show again" }));
    expect(restore).toHaveBeenCalledWith(dismissal);
  });

  it("renders nothing without hidden suggestions", () => {
    const { container } = render(<HiddenSuggestions dismissals={[]} groups={groups} />);
    expect(container.textContent).toBe("");
  });
});
