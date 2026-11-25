import type { CardTradeResponse } from "@openrift/shared/types/api/card-trade";
import type { FriendGroupMatchRow } from "@openrift/shared/types/api/friend-group";
import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { dismissalKeys } from "@/features/groups/lib/trade-dismissals";
import type { TradeMarketGroup } from "@/features/groups/lib/trade-market";
import { buildTradeMarket } from "@/features/groups/lib/trade-market";
import type { WantedCard } from "@/features/groups/lib/wanted-cards";
import { useBuyCartStore } from "@/features/groups/stores/buy-cart-store";
import { useTradeFinderStore } from "@/features/groups/stores/trade-finder-store";
import { stubPrinting } from "@/test/factories";
import { createStoreResetter } from "@/test/store-helpers";

vi.mock("@/hooks/use-viewer-legality", () => ({
  useViewerLegality: () => ({ windows: [] }),
  useGlobalLegality: () => ({ windows: [] }),
}));

const jinx = stubPrinting({
  printingId: "p-jinx",
  cardId: "c-jinx",
  card: { name: "Jinx, Rebel" },
});
const star = stubPrinting({
  printingId: "p-star",
  cardId: "c-star",
  card: { name: "Grove of the God-Willow", types: ["battlefield"] },
  images: [{ imageId: "grove-image-id-aa" }],
});
const leona = stubPrinting({
  printingId: "p-leona",
  cardId: "c-leona",
  card: { name: "Leona, Zealot" },
});

function stubRow(overrides: Partial<FriendGroupMatchRow> = {}): FriendGroupMatchRow {
  return {
    counterpartyUserId: "user-mara",
    counterpartyName: "Mara",
    counterpartyImage: null,
    counterpartyGravatarHash: "hash",
    counterpartyListId: "list-1",
    counterpartyListName: "Spares",
    viewerListName: "Wants",
    sellEntryId: "sell-1",
    sellListId: "list-1",
    copyId: "copy-1",
    condition: null,
    grader: null,
    grade: null,
    notesPublic: null,
    printingId: "p-jinx",
    cardId: "c-jinx",
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

const group: TradeMarketGroup = {
  slug: "summoner-skirmish",
  name: "Summoner Skirmish",
  incoming: [stubRow()],
  outgoing: [stubRow({ printingId: "p-leona", cardId: "c-leona", cardName: "Leona, Zealot" })],
};
const market = buildTradeMarket([group]);
let currentMarket = market;
let currentGroups: TradeMarketGroup[] = [group];

function wantedCard(overrides: Partial<WantedCard>): WantedCard {
  return {
    key: "printing:p-star",
    kind: "printing",
    cardId: "c-star",
    printingId: "p-star",
    quantity: 2,
    ruleQuantity: 0,
    listNames: ["Wants"],
    entries: [],
    ...overrides,
  };
}

const wanted = [
  wantedCard({}),
  wantedCard({ key: "printing:p-jinx", cardId: "c-jinx", printingId: "p-jinx", quantity: 1 }),
];

let currentTrades: CardTradeResponse[] = [];
const dismiss = vi.hoisted(() => vi.fn());

function pendingRequest(cardId: string): CardTradeResponse {
  return {
    id: "trade-1",
    groupId: "group-1",
    groupSlug: "summoner-skirmish",
    groupName: "Summoner Skirmish",
    role: "receiver",
    initiator: "receiver",
    counterparty: {
      userId: "user-mara",
      name: "Mara",
      image: null,
      gravatarHash: "hash",
      contactMethods: [],
    },
    printingId: "p-other",
    cardId,
    quantity: 1,
    status: "pending",
    createdAt: "2026-11-01T10:00:00.000Z",
    updatedAt: "2026-11-01T10:00:00.000Z",
    acceptedAt: null,
    completedAt: null,
    closedAt: null,
    expiresAt: null,
    viewerSyncAppliedAt: null,
    counterpartySyncAppliedAt: null,
    viewerWishEntryId: null,
    autoAccepted: false,
    recipientSeenAt: null,
    actionNeeded: "cancel",
  };
}

vi.mock("@/features/groups/hooks/use-card-trades", () => ({
  useUserTrades: () => ({ data: { items: currentTrades } }),
}));
vi.mock("@/hooks/use-session", () => ({ useRequiredUserId: () => "user-1" }));
vi.mock("@/features/groups/hooks/use-trade-market", () => ({
  useTradeMarket: () => ({
    market: currentMarket,
    marketGroups: currentGroups,
    dismissals: [],
  }),
}));
vi.mock("@/features/groups/hooks/use-wanted-cards", () => ({
  useWantedCards: () => ({ wanted, ready: true }),
}));
vi.mock("@/features/cards/hooks/use-cards", () => ({
  useCards: () => ({
    printingsById: { "p-jinx": jinx, "p-star": star, "p-leona": leona },
    printingsByCardId: new Map([
      ["c-jinx", [jinx]],
      ["c-star", [star]],
      ["c-leona", [leona]],
    ]),
  }),
}));
vi.mock("@/features/cards/hooks/use-prices", () => ({
  usePrices: () => ({ get: () => undefined }),
}));
vi.mock("@tanstack/react-router", () => ({
  Link: ({ children }: { children: ReactNode }) => <span>{children}</span>,
}));
vi.mock("@/hooks/use-domain-colors", () => ({ useDomainColors: () => ({}) }));
vi.mock("@/features/cards/hooks/use-card-thumbnail-display", () => ({
  useCardThumbnailDisplay: () => ({
    fancyFan: false,
    gridFoil: false,
    coarsePointer: false,
    domainColors: {},
    finishLabels: {},
    sizeLabels: {},
    rarityLabels: {},
    prices: { get: () => undefined },
    favoriteMarketplace: "cardtrader",
    compactFmt: String,
    getFallbackArt: () => null,
  }),
}));
vi.mock("@/features/groups/hooks/use-trade-dismissals", () => ({
  useDismissSuggestions: () => ({ mutate: dismiss, isPending: false }),
  useRestoreSuggestion: () => ({ mutate: () => {}, isPending: false }),
}));
vi.mock("@/components/user-avatar", () => ({ UserAvatar: () => null }));
vi.mock("@/features/groups/components/trade-market-sheet", () => ({
  TradeMarketSheet: ({
    card,
  }: {
    card: { printingId: string; sources: unknown[] } | null;
  }): ReactNode =>
    card === null ? null : (
      <>
        <div>sheet:{card.printingId}</div>
        <div>sources:{card.sources.length}</div>
      </>
    ),
}));

const { TradeFinder } = await import("./trade-finder");

let resetCart: () => void;
let resetFinder: () => void;

beforeEach(() => {
  resetCart = createStoreResetter(useBuyCartStore);
  resetFinder = createStoreResetter(useTradeFinderStore);
});

afterEach(() => {
  currentMarket = market;
  currentGroups = [group];
  currentTrades = [];
  resetCart();
  resetFinder();
  vi.restoreAllMocks();
  dismiss.mockClear();
});

function showCards() {
  fireEvent.click(screen.getByRole("button", { name: "By card" }));
}

describe("TradeFinder by person", () => {
  it("lists each person with what they have and want", () => {
    render(<TradeFinder groupSlug={null} />);
    expect(screen.getByText("Mara")).toBeTruthy();
    expect(screen.getByText("Has 1 you want · wants 1 of yours")).toBeTruthy();
  });

  it("opens a person into what you'd get and give, with the trade sheet and hide actions", () => {
    render(<TradeFinder groupSlug={null} />);
    fireEvent.click(screen.getByRole("button", { name: /Mara/u }));
    expect(screen.getByText("You'd get")).toBeTruthy();
    expect(screen.getByText("You'd give")).toBeTruthy();
    expect(screen.getByText("Open trade sheet")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Hide 2 suggestions with Mara" }));
    expect(dismiss).toHaveBeenCalledWith([
      { direction: "incoming", counterpartyUserId: "user-mara", printingId: "p-jinx" },
      { direction: "outgoing", counterpartyUserId: "user-mara", printingId: "p-leona" },
    ]);
  });

  it("opens the sheet for a card picked in a person's panel", () => {
    render(<TradeFinder groupSlug={null} />);
    fireEvent.click(screen.getByRole("button", { name: /Mara/u }));
    fireEvent.click(screen.getByRole("button", { name: /Jinx, Rebel/u }));
    expect(screen.getByText("sheet:p-jinx")).toBeTruthy();
  });
});

describe("TradeFinder by card", () => {
  it("counts each side", () => {
    render(<TradeFinder groupSlug={null} />);
    showCards();
    expect(screen.getByRole("heading", { name: /You could get\s*1/u })).toBeTruthy();
    expect(screen.getByRole("heading", { name: /Wanted from you\s*1/u })).toBeTruthy();
  });

  it("shows the cards group members have, with who has them", () => {
    render(<TradeFinder groupSlug={null} />);
    showCards();
    expect(screen.getByText("Jinx, Rebel")).toBeTruthy();
    expect(screen.getByText("Mara has it")).toBeTruthy();
  });

  it("opens the sheet for the picked card", () => {
    render(<TradeFinder groupSlug={null} />);
    showCards();
    fireEvent.click(screen.getByRole("button", { name: /Jinx, Rebel/u }));
    expect(screen.getByText("sheet:p-jinx")).toBeTruthy();
  });

  it("keeps the open sheet in step with hidden suggestions", () => {
    const kofi = stubRow({
      counterpartyUserId: "user-kofi",
      counterpartyName: "Kofi",
      copyId: "copy-2",
    });
    const groups = [{ ...group, incoming: [stubRow(), kofi] }];
    currentMarket = buildTradeMarket(groups);
    const { rerender } = render(<TradeFinder groupSlug={null} />);
    showCards();
    fireEvent.click(screen.getByRole("button", { name: /Jinx, Rebel/u }));
    expect(screen.getByText("sources:2")).toBeTruthy();

    currentMarket = buildTradeMarket(
      groups,
      dismissalKeys([
        { direction: "incoming", counterpartyUserId: "user-kofi", printingId: "p-jinx" },
      ]),
    );
    rerender(<TradeFinder groupSlug={null} />);
    expect(screen.getByText("sources:1")).toBeTruthy();
  });

  it("marks a card already requested from anyone, in any printing", () => {
    currentTrades = [pendingRequest("c-jinx")];
    render(<TradeFinder groupSlug={null} />);
    showCards();
    expect(screen.getByText("Requested")).toBeTruthy();
  });

  it("marks a card someone offered the viewer without calling it requested", () => {
    currentTrades = [{ ...pendingRequest("c-jinx"), initiator: "giver" }];
    render(<TradeFinder groupSlug={null} />);
    showCards();
    expect(screen.getByText("In a trade")).toBeTruthy();
    expect(screen.queryByText("Requested")).toBeNull();
  });

  it("leaves a card out once its only source is in a trade", () => {
    currentTrades = [{ ...pendingRequest("c-jinx"), printingId: "p-jinx" }];
    render(<TradeFinder groupSlug={null} />);
    showCards();
    expect(screen.getByRole("heading", { name: /You could get\s*0/u })).toBeTruthy();
    expect(screen.queryByText("Jinx, Rebel")).toBeNull();
  });

  it("keeps a card on offer from someone else with only them as a source", () => {
    currentMarket = buildTradeMarket([
      {
        ...group,
        incoming: [
          stubRow(),
          stubRow({ counterpartyUserId: "user-kofi", counterpartyName: "Kofi", copyId: "copy-2" }),
        ],
      },
    ]);
    currentTrades = [{ ...pendingRequest("c-jinx"), printingId: "p-jinx" }];
    render(<TradeFinder groupSlug={null} />);
    showCards();
    expect(screen.getByRole("heading", { name: /You could get\s*1/u })).toBeTruthy();
    expect(screen.getByText("Kofi has it")).toBeTruthy();
  });

  it("narrows both sides by the search", () => {
    render(<TradeFinder groupSlug={null} />);
    showCards();
    fireEvent.change(screen.getByRole("textbox", { name: "Search cards" }), {
      target: { value: "leona" },
    });
    expect(screen.queryByText("Jinx, Rebel")).toBeNull();
    expect(screen.getByText("No cards match your search.")).toBeTruthy();
  });

  it("remembers the chosen view", () => {
    render(<TradeFinder groupSlug={null} />);
    showCards();
    expect(useTradeFinderStore.getState().view).toBe("card");
  });
});

describe("TradeFinder buy strip", () => {
  it("counts the wishlist cards no group member has and links to buying them", () => {
    render(<TradeFinder groupSlug={null} />);
    expect(screen.getByText("1 wishlist card no one in your groups has")).toBeTruthy();
    expect(screen.getByText("Buy missing cards")).toBeTruthy();
  });

  it("keeps the cart reachable once nothing is missing", () => {
    useBuyCartStore
      .getState()
      .addItems("user-1", [
        { key: "printing:p-star", cardId: "c-star", printingId: "p-star", quantity: 2 },
      ]);
    currentGroups = [
      {
        ...group,
        incoming: [
          stubRow(),
          stubRow({ printingId: "p-star", cardId: "c-star", copyId: "copy-3" }),
        ],
      },
    ];
    currentMarket = buildTradeMarket(currentGroups);
    render(<TradeFinder groupSlug={null} />);
    expect(screen.getByText("1 card in your cart")).toBeTruthy();
    expect(screen.getByText("View cart")).toBeTruthy();
  });

  it("names the selected group and counts only its cards as available", () => {
    render(<TradeFinder groupSlug="other-group" groupName="Bothfeld Connection" />);
    expect(screen.getByText("2 wishlist cards no one in Bothfeld Connection has")).toBeTruthy();
  });

  it("shows the cart count beside the missing count", () => {
    useBuyCartStore
      .getState()
      .addItems("user-1", [
        { key: "printing:p-star", cardId: "c-star", printingId: "p-star", quantity: 2 },
      ]);
    render(<TradeFinder groupSlug={null} />);
    expect(
      screen.getByText("1 wishlist card no one in your groups has · 1 in your cart"),
    ).toBeTruthy();
  });

  it("does not count a hidden suggestion as missing", () => {
    currentMarket = buildTradeMarket(
      [group],
      dismissalKeys([
        { direction: "incoming", counterpartyUserId: "user-mara", printingId: "p-jinx" },
      ]),
    );
    render(<TradeFinder groupSlug={null} />);
    expect(screen.getByText("1 wishlist card no one in your groups has")).toBeTruthy();
  });
});

describe("TradeFinder empty states", () => {
  it("says so when no one matches", () => {
    currentMarket = buildTradeMarket([]);
    render(<TradeFinder groupSlug={null} />);
    expect(
      screen.getByText(
        "No one in your groups has a card from your wishlists or wants one from your tradelists right now.",
      ),
    ).toBeTruthy();
  });

  it("narrows people by the search and says when nothing matches", () => {
    render(<TradeFinder groupSlug={null} />);
    const search = screen.getByRole("textbox", { name: "Search cards" });
    fireEvent.change(search, { target: { value: "leona" } });
    expect(screen.getByText("wants 1 of yours", { exact: false })).toBeTruthy();
    expect(screen.queryByText(/Has 1 you want/u)).toBeNull();
    fireEvent.change(search, { target: { value: "zzz" } });
    expect(screen.getByText("No cards match your search.")).toBeTruthy();
  });
});
