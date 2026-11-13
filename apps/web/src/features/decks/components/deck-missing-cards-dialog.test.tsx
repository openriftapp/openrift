import type { Marketplace } from "@openrift/shared/types/pricing";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type * as UseEnums from "@/hooks/use-enums";
import { stubCardOwnership } from "@/test/factories";

const marketplaceLinks = vi.hoisted(() => ({ data: undefined as unknown }));

vi.mock("@/hooks/use-enums", async (importOriginal) => {
  const actual = await importOriginal<typeof UseEnums>();
  const { useZoneOrderStub } = await import("@/test/zone-order-stub");
  return { ...actual, useZoneOrder: useZoneOrderStub };
});
vi.mock("@/features/cards/hooks/use-marketplace-links", () => ({
  useMarketplaceLinks: () => marketplaceLinks,
}));
vi.mock("@/features/cards/components/card-art-thumb", () => ({ CardArtThumb: () => null }));
vi.mock("@/features/cards/components/rarity-icon", () => ({ RarityIcon: () => null }));
vi.mock("@/features/cards/components/card-detail-overlay", () => ({
  CardDetailOverlay: () => null,
}));
vi.mock("@/features/lists/components/add-to-wishlist-dialog", () => ({
  AddToWishlistDialog: () => null,
}));
vi.mock("@/features/lists/components/create-list-dialog", () => ({
  CreateListDialog: () => null,
}));
vi.mock("@tanstack/react-router", () => ({ useNavigate: () => vi.fn() }));

const { DeckMissingCardsDialog } = await import("./deck-missing-cards-dialog");

const jinx = stubCardOwnership({ cardName: "Jinx, Rebel", shortfall: 2 });
const star = stubCardOwnership({ cardName: "Star Spring", shortfall: 1 });

function linksFor(productIds: Record<string, number | null>) {
  return {
    links: Object.fromEntries(
      Object.entries(productIds).map(([printingId, productId]) => [
        printingId,
        {
          tcgplayer: { available: productId !== null, productId },
          cardmarket: { available: false, productId: null },
          cardtrader: { available: false, productId: null },
          cardnexus: { available: productId !== null, productId },
        },
      ]),
    ),
  };
}

function renderDialog(marketplace: Marketplace) {
  return render(
    <DeckMissingCardsDialog
      open
      onOpenChange={() => {}}
      missingCards={[jinx, star]}
      totalMissingValue={undefined}
      marketplace={marketplace}
    />,
  );
}

describe("DeckMissingCardsDialog footer", () => {
  it("offers the Cardmarket wants pair for Cardmarket prices", async () => {
    renderDialog("cardmarket");
    expect(await screen.findByRole("link", { name: /Open Cardmarket/u })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Copy for Cardmarket" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Copy list" })).toBeTruthy();
  });

  it("offers the CardTrader wishlist pair for CardTrader prices", async () => {
    renderDialog("cardtrader");
    expect(await screen.findByRole("link", { name: /Open CardTrader/u })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Copy for CardTrader" })).toBeTruthy();
    expect(screen.queryByText(/Cardmarket/u)).toBeNull();
  });

  it("sends TCGplayer the listed printings and names the ones it can't take", async () => {
    marketplaceLinks.data = linksFor({
      [jinx.displayPrinting?.id ?? ""]: 652_993,
      [star.displayPrinting?.id ?? ""]: null,
    });
    renderDialog("tcgplayer");
    const link = await screen.findByRole("link", { name: /Add 2 cards to TCGplayer cart/u });
    const target = new URL(new URL(link.getAttribute("href") ?? "").searchParams.get("u") ?? "");
    expect(target.searchParams.get("c")).toBe("2-652993");
    expect(screen.getByText("1 card isn't listed on TCGplayer and was left out.")).toBeTruthy();
    expect(screen.queryByText(/Cardmarket/u)).toBeNull();
  });

  it("disables the TCGplayer cart button until product ids load", async () => {
    marketplaceLinks.data = undefined;
    renderDialog("tcgplayer");
    const button = await screen.findByRole("button", { name: /Add 3 cards to TCGplayer cart/u });
    expect(button.hasAttribute("disabled")).toBe(true);
  });
});

describe("DeckMissingCardsDialog zone sections", () => {
  it("orders the zone sections by deck zone order, not by label", () => {
    render(
      <DeckMissingCardsDialog
        open
        onOpenChange={() => {}}
        missingCards={[
          stubCardOwnership({ cardName: "Sunken Temple", zone: "battlefield", shortfall: 1 }),
          stubCardOwnership({ cardName: "Azir, Emperor", zone: "legend", shortfall: 1 }),
        ]}
        totalMissingValue={undefined}
        marketplace="cardmarket"
      />,
    );
    const headings = screen.getAllByRole("heading", { level: 3 }).map((h) => h.textContent);
    expect(headings).toEqual(["Legend", "Battlefields"]);
  });
});

describe("DeckMissingCardsDialog total", () => {
  it("counts the missing copies that have no price beside the total", () => {
    render(
      <DeckMissingCardsDialog
        open
        onOpenChange={() => {}}
        missingCards={[
          stubCardOwnership({ cardName: "Jinx, Rebel", shortfall: 2, cheapestPrice: 1.5 }),
          stubCardOwnership({
            cardName: "Star Spring",
            shortfall: 3,
            cheapestPrice: undefined,
            displayPrice: undefined,
          }),
        ]}
        totalMissingValue={3}
        marketplace="cardmarket"
      />,
    );
    expect(screen.getByText(/\(3 unpriced\)/u)).toBeTruthy();
  });
});
