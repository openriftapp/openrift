import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { BuyCartItem } from "@/features/groups/lib/buy-cart";
import { cartFor } from "@/features/groups/lib/buy-cart";
import { useBuyCartStore } from "@/features/groups/stores/buy-cart-store";
import { stubPrinting } from "@/test/factories";
import { createStoreResetter } from "@/test/store-helpers";

const jinx = stubPrinting({ id: "p-1", card: { name: "Jinx, Rebel" } });
const star = stubPrinting({ id: "p-2", card: { name: "Falling Star" } });

const markOrdered = vi.hoisted(() => vi.fn());
const copy = vi.hoisted(() => vi.fn());

vi.mock("@/features/cards/hooks/use-cards", () => ({
  useCards: () => ({
    printingsById: { "p-1": jinx, "p-2": star },
    printingsByCardId: new Map([
      [star.cardId, [star, stubPrinting({ id: "p-3", cardId: star.cardId })]],
    ]),
  }),
}));
vi.mock("@/features/cards/hooks/use-prices", () => ({
  usePrices: () => ({ get: (printingId: string) => (printingId === "p-1" ? 38 : undefined) }),
}));
vi.mock("@/features/cards/hooks/use-marketplace-info", () => ({
  useMarketplaceInfo: () => ({
    data: {
      infos: {
        "p-1": {
          tcgplayer: { available: true, productId: 652_993 },
          cardmarket: { available: false, productId: null },
          cardtrader: { available: false, productId: null },
        },
        "p-2": {
          tcgplayer: { available: false, productId: null },
          cardmarket: { available: false, productId: null },
          cardtrader: { available: false, productId: null },
        },
      },
    },
  }),
}));
vi.mock("@/features/cards/components/card-art-thumb", () => ({ CardArtThumb: () => null }));
vi.mock("@/hooks/use-enums", () => ({
  useEnumOrders: () => ({ labels: { finishes: { normal: "Normal" } } }),
}));
vi.mock("@/features/groups/hooks/use-mark-ordered", () => ({
  useMarkOrdered: () => ({
    markOrdered,
    pending: false,
    orderedCollection: undefined,
    ready: true,
  }),
}));
vi.mock("@/hooks/use-copy-to-clipboard", () => ({
  useCopyToClipboard: () => ({ copy, reset: () => {} }),
}));
vi.mock("@tanstack/react-router", () => ({
  Link: ({ to, children, className }: { to: string; children?: ReactNode; className?: string }) => (
    <a href={to} className={className}>
      {children}
    </a>
  ),
}));

const { BuyCartPanel } = await import("./buy-cart-panel");

const ITEMS: BuyCartItem[] = [
  { key: "printing:p-1", cardId: jinx.cardId, printingId: "p-1", quantity: 1 },
  { key: "card:c-2", cardId: star.cardId, printingId: "p-2", quantity: 2 },
];

let resetStore: () => void;

beforeEach(() => {
  resetStore = createStoreResetter(useBuyCartStore);
  useBuyCartStore.getState().addItems("user-1", ITEMS);
  copy.mockResolvedValue(true);
  markOrdered.mockResolvedValue(true);
});

afterEach(() => {
  resetStore();
  vi.clearAllMocks();
});

function renderPanel() {
  const items = cartFor(useBuyCartStore.getState().carts, "user-1").items;
  return render(<BuyCartPanel userId="user-1" items={items} wantedByKey={new Map()} wantedReady />);
}

describe("BuyCartPanel", () => {
  it("totals the CardTrader estimate and says what it leaves out", () => {
    renderPanel();
    const total = screen.getByText("CardTrader est.").parentElement;
    expect(total?.textContent).toBe("CardTrader est.€38.00");
    expect(screen.getByText("2 cards have no price and are not counted.")).toBeTruthy();
  });

  it("sends TCGplayer the listed printings and names the ones it can't take", () => {
    useBuyCartStore.getState().setMarketplace("tcgplayer");
    renderPanel();
    const link = screen.getByRole("link", { name: "Add to TCGplayer cart" });
    const target = new URL(new URL(link.getAttribute("href") ?? "").searchParams.get("u") ?? "");
    expect(target.searchParams.get("c")).toBe("1-652993");
    expect(screen.getByText("1 card isn't listed on TCGplayer and was left out.")).toBeTruthy();
  });

  it("copies a Cardmarket wants list and shows the extension tip", async () => {
    useBuyCartStore.getState().setMarketplace("cardmarket");
    renderPanel();
    expect(screen.getByText("Compare with CardTrader Zero")).toBeTruthy();
    fireEvent.click(screen.getByRole("link", { name: "Copy list and open Cardmarket" }));
    await waitFor(() => expect(copy).toHaveBeenCalledWith("2x Falling Star\n1x Jinx, Rebel"));
  });

  it("copies a CardTrader wishlist for the CardTrader handoff", async () => {
    renderPanel();
    expect(screen.queryByText("Compare with CardTrader Zero")).toBeNull();
    fireEvent.click(screen.getByRole("link", { name: "Copy list and open CardTrader" }));
    await waitFor(() => expect(copy).toHaveBeenCalledWith("2 Falling Star\n1 Jinx, Rebel"));
  });

  it("files the cart as ordered and empties it", async () => {
    renderPanel();
    fireEvent.click(screen.getByRole("button", { name: "Mark 3 cards as ordered" }));
    await waitFor(() => expect(markOrdered).toHaveBeenCalledWith(ITEMS, new Map()));
    await waitFor(() =>
      expect(cartFor(useBuyCartStore.getState().carts, "user-1").items).toEqual([]),
    );
  });

  it("keeps the cart when filing fails", async () => {
    markOrdered.mockResolvedValueOnce(false);
    renderPanel();
    fireEvent.click(screen.getByRole("button", { name: "Mark 3 cards as ordered" }));
    await waitFor(() => expect(markOrdered).toHaveBeenCalled());
    expect(cartFor(useBuyCartStore.getState().carts, "user-1").items).toEqual(ITEMS);
  });

  it("waits for the wish lists before filing an order", () => {
    const items = cartFor(useBuyCartStore.getState().carts, "user-1").items;
    render(
      <BuyCartPanel userId="user-1" items={items} wantedByKey={new Map()} wantedReady={false} />,
    );
    const button = screen.getByRole("button", { name: "Mark 3 cards as ordered" });
    expect(button.hasAttribute("disabled")).toBe(true);
  });

  it("offers other printings only for any-printing wishes", () => {
    renderPanel();
    expect(screen.getAllByRole("combobox")).toHaveLength(1);
    expect(screen.getByRole("combobox", { name: "Printing of Falling Star" })).toBeTruthy();
  });

  it("asks for cards when the cart is empty", () => {
    render(<BuyCartPanel userId="user-1" items={[]} wantedByKey={new Map()} wantedReady />);
    expect(screen.getByText("Tick cards to add them to the cart.")).toBeTruthy();
  });
});
