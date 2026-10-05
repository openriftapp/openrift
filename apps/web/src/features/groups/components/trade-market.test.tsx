import type { FriendGroupMatchRow } from "@openrift/shared/types/api/friend-group";
import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { dismissalKeys } from "@/features/groups/lib/trade-dismissals";
import type { TradeMarketGroup } from "@/features/groups/lib/trade-market";
import { buildTradeMarket } from "@/features/groups/lib/trade-market";
import type { WantedCard } from "@/features/groups/lib/wanted-cards";
import { useBuyCartStore } from "@/features/groups/stores/buy-cart-store";
import { stubPrinting } from "@/test/factories";
import { createStoreResetter } from "@/test/store-helpers";

const jinx = stubPrinting({ id: "p-jinx", cardId: "c-jinx", card: { name: "Jinx, Rebel" } });
const star = stubPrinting({
  id: "p-star",
  cardId: "c-star",
  card: { name: "Grove of the God-Willow", types: ["battlefield"] },
  images: [{ face: "front", imageId: "grove-image-id-aa" }],
});
const leona = stubPrinting({ id: "p-leona", cardId: "c-leona", card: { name: "Leona, Zealot" } });

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
const market = buildTradeMarket([group], []);
let currentMarket = market;

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

vi.mock("@/hooks/use-session", () => ({ useRequiredUserId: () => "user-1" }));
vi.mock("@/features/groups/hooks/use-trade-market", () => ({
  useTradeMarket: () => ({
    market: currentMarket,
    groups: [{ slug: "summoner-skirmish", name: "Summoner Skirmish" }],
    marketGroups: [],
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
    cardTilt: false,
    coarsePointer: false,
    domainColors: {},
    finishLabels: {},
    sizeLabels: {},
    rarityLabels: {},
    artVariantLabels: {},
    prices: { get: () => undefined },
    favoriteMarketplace: "cardtrader",
    compactFmt: String,
    getFallbackArt: () => null,
  }),
}));
vi.mock("@/features/groups/hooks/use-trade-dismissals", () => ({
  useDismissSuggestions: () => ({ mutate: () => {}, isPending: false }),
  useRestoreSuggestion: () => ({ mutate: () => {}, isPending: false }),
}));
vi.mock("@/components/user-avatar", () => ({ UserAvatar: () => null }));
vi.mock("@/features/groups/components/trade-market-sheet", () => ({
  TradeMarketSheet: ({
    selection,
  }: {
    selection: {
      kind: string;
      card?: { printingId: string; sources: unknown[] };
      printingId?: string;
    } | null;
  }): ReactNode =>
    selection === null ? null : (
      <>
        <div>
          sheet:{selection.kind === "market" ? selection.card?.printingId : selection.printingId}
        </div>
        {selection.card === undefined ? null : <div>sources:{selection.card.sources.length}</div>}
      </>
    ),
}));

const { TradeMarket } = await import("./trade-market");

let resetStore: () => void;

beforeEach(() => {
  resetStore = createStoreResetter(useBuyCartStore);
});

afterEach(() => {
  currentMarket = market;
  resetStore();
  vi.restoreAllMocks();
});

describe("TradeMarket", () => {
  it("counts each tab", () => {
    render(<TradeMarket />);
    expect(screen.getByRole("tab", { name: /You could get\s*1/u })).toBeTruthy();
    expect(screen.getByRole("tab", { name: /Wanted from you\s*1/u })).toBeTruthy();
    expect(screen.getByRole("tab", { name: /Not in your groups\s*1/u })).toBeTruthy();
  });

  it("shows the cards group members have, with who has them", () => {
    render(<TradeMarket />);
    expect(screen.getByText("Jinx, Rebel")).toBeTruthy();
    expect(screen.getByText("Mara has it")).toBeTruthy();
  });

  it("lists wanted cards no group member has on the last tab", () => {
    render(<TradeMarket />);
    fireEvent.click(screen.getByRole("tab", { name: /Not in your groups/u }));
    expect(screen.getAllByText("Grove of the God-Willow").length).toBeGreaterThan(0);
    expect(screen.queryByText("Jinx, Rebel")).toBeNull();
    expect(screen.getByText("You want 2")).toBeTruthy();
  });

  it("adds every card no group member has to the cart in one go", () => {
    render(<TradeMarket />);
    fireEvent.click(screen.getByRole("tab", { name: /Not in your groups/u }));
    expect(screen.getByText("2 cards no one in your groups has")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Add all 2 to cart" }));
    expect(useBuyCartStore.getState().carts["user-1"]?.items.map((item) => item.key)).toEqual([
      "printing:p-star",
    ]);
    expect(screen.getByText("View cart")).toBeTruthy();
  });

  it("rotates battlefield art into the portrait frame", () => {
    vi.spyOn(HTMLImageElement.prototype, "naturalWidth", "get").mockReturnValue(880);
    render(<TradeMarket />);
    fireEvent.click(screen.getByRole("tab", { name: /Not in your groups/u }));
    const art = screen.getByRole("img", { name: "Grove of the God-Willow" });
    expect(art.parentElement?.style.transform).toContain("rotate(-90deg)");
  });

  it("opens the sheet for the picked card", () => {
    render(<TradeMarket />);
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
    currentMarket = buildTradeMarket(groups, []);
    const { rerender } = render(<TradeMarket />);
    fireEvent.click(screen.getByRole("button", { name: /Jinx, Rebel/u }));
    expect(screen.getByText("sources:2")).toBeTruthy();

    currentMarket = buildTradeMarket(
      groups,
      [],
      dismissalKeys([
        { direction: "incoming", counterpartyUserId: "user-kofi", printingId: "p-jinx" },
      ]),
    );
    rerender(<TradeMarket />);
    expect(screen.getByText("sources:1")).toBeTruthy();
  });

  it("narrows the grid by the search", () => {
    render(<TradeMarket />);
    fireEvent.change(screen.getByRole("textbox", { name: "Search cards" }), {
      target: { value: "leona" },
    });
    expect(screen.queryByText("Jinx, Rebel")).toBeNull();
    expect(screen.getByText("No cards match your search.")).toBeTruthy();
  });
});
