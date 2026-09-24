import type { FriendGroupMatchRow } from "@openrift/shared/types/api/friend-group";
import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { buildTradeMarket, marketPeople } from "@/features/groups/lib/trade-market";
import { stubPrinting } from "@/test/factories";

const dismiss = vi.hoisted(() => vi.fn());
const restore = vi.hoisted(() => vi.fn());

const printing = stubPrinting({ id: "p-1", cardId: "c-1", card: { name: "Jinx, Rebel" } });

vi.mock("@/features/groups/hooks/use-trade-dismissals", () => ({
  useDismissSuggestions: () => ({ mutate: dismiss, isPending: false }),
  useRestoreSuggestion: () => ({ mutate: restore, isPending: false }),
}));
vi.mock("@/features/cards/hooks/use-cards", () => ({
  useCards: () => ({ printingsById: { "p-1": printing } }),
}));
vi.mock("@/components/user-avatar", () => ({ UserAvatar: () => null }));
vi.mock("@tanstack/react-router", () => ({
  Link: ({ to, children, className }: { to: string; children?: ReactNode; className?: string }) => (
    <a href={to} className={className}>
      {children}
    </a>
  ),
}));

const { HiddenSuggestions, PeopleFilter, PersonActions } = await import("./trade-market-filters");

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
const market = buildTradeMarket(groups, []);

afterEach(() => {
  vi.clearAllMocks();
});

describe("PeopleFilter", () => {
  it("picks a person and goes back to everyone", () => {
    const onPersonChange = vi.fn();
    const { rerender } = render(
      <PeopleFilter
        people={marketPeople(market)}
        personId={null}
        onPersonChange={onPersonChange}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /Robogirl/u }));
    expect(onPersonChange).toHaveBeenLastCalledWith("user-robogirl");

    rerender(
      <PeopleFilter
        people={marketPeople(market)}
        personId="user-robogirl"
        onPersonChange={onPersonChange}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Everyone" }));
    expect(onPersonChange).toHaveBeenLastCalledWith(null);
  });
});

describe("PersonActions", () => {
  it("hides every current suggestion with the person at once", () => {
    const robogirl = marketPeople(market).find((person) => person.userId === "user-robogirl");
    if (robogirl === undefined) {
      throw new Error("missing person");
    }
    render(<PersonActions market={market} person={robogirl} />);
    fireEvent.click(screen.getByRole("button", { name: "Hide 2 suggestions with Robogirl" }));
    expect(dismiss).toHaveBeenCalledWith([
      { direction: "outgoing", counterpartyUserId: "user-robogirl", printingId: "p-1" },
      { direction: "outgoing", counterpartyUserId: "user-robogirl", printingId: "p-2" },
    ]);
  });
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
