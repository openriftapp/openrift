import { labelMapOf } from "@openrift/shared/enum-label";
import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useWorkbenchStore } from "@/features/decks/stores/workbench-store";
import type * as UseEnums from "@/hooks/use-enums";
import { stubDeckBuilderCard } from "@/test/factories";
import { createStoreResetter } from "@/test/store-helpers";

vi.mock("@/hooks/use-enums", async (importOriginal) => {
  const actual = await importOriginal<typeof UseEnums>();
  const { useZoneOrderStub } = await import("@/test/zone-order-stub");
  return {
    ...actual,
    useZoneOrder: useZoneOrderStub,
    useEnumOrders: () => ({ labels: { domains: labelMapOf({}) } }),
  };
});
vi.mock("@/hooks/use-domain-colors", () => ({ useDomainColors: () => ({}) }));
vi.mock("@/features/decks/hooks/use-deck-builder", () => ({
  useDeckBuilderActions: () => ({
    changePreferredPrinting: vi.fn(),
    moveCard: vi.fn(),
    moveOneCard: vi.fn(),
    setQuantity: vi.fn(),
  }),
  useDeckCards: () => [],
}));
vi.mock("@/features/decks/hooks/use-decks", () => ({
  useDeckDetail: () => ({ data: { deck: { format: "constructed" } } }),
}));
vi.mock("@/hooks/use-session", () => ({ useSession: () => ({ data: undefined }) }));
vi.mock("@/features/collections/hooks/use-owned-count", () => ({
  useOwnedCountsForPrintings: () => ({ data: undefined }),
}));
vi.mock("@/features/cards/hooks/use-printing-choices", () => ({
  usePrintingChoices: () => [],
}));

const { DeckCardPrintingMenu } = await import("./deck-card-printing-menu");
const { DeckCardRow } = await import("./deck-card-row");

const resetStore = createStoreResetter(useWorkbenchStore);

describe("DeckCardPrintingMenu", () => {
  beforeEach(() => {
    resetStore();
    useWorkbenchStore.setState({ relaxed: true });
  });
  afterEach(resetStore);

  it("offers switching the legend from the menu", () => {
    const onSwitch = vi.fn();
    render(
      <DeckCardPrintingMenu
        deckId="deck-1"
        card={stubDeckBuilderCard({ cardName: "Azir", cardType: "legend", zone: "legend" })}
        onSwitch={onSwitch}
      >
        <div>Azir row</div>
      </DeckCardPrintingMenu>,
    );

    fireEvent.contextMenu(screen.getByText("Azir row"));
    fireEvent.click(screen.getByRole("menuitem", { name: "Pick a different Legend" }));

    expect(onSwitch).toHaveBeenCalledOnce();
  });

  it("links a battlefield to the plan even with nothing else to offer", () => {
    useWorkbenchStore.setState({ relaxed: false });
    const onOpenPlan = vi.fn();
    render(
      <DeckCardPrintingMenu
        deckId="deck-1"
        card={stubDeckBuilderCard({
          cardName: "Sunken Temple",
          cardType: "battlefield",
          zone: "battlefield",
        })}
        onOpenPlan={onOpenPlan}
      >
        <div>Sunken Temple row</div>
      </DeckCardPrintingMenu>,
    );

    fireEvent.contextMenu(screen.getByText("Sunken Temple row"));
    fireEvent.click(
      screen.getByRole("menuitem", { name: "Choose battlefields per game in the plan" }),
    );

    expect(onOpenPlan).toHaveBeenCalledOnce();
  });

  function renderWorkbenchRow() {
    const card = stubDeckBuilderCard({ cardName: "Iron Ballista", quantity: 2 });
    render(
      <DeckCardPrintingMenu deckId="deck-1" card={card}>
        <DeckCardRow card={card} menuButton onClick={() => {}} />
      </DeckCardPrintingMenu>,
    );
  }

  it("opens the row's items from the menu button as a menu of that button", () => {
    renderWorkbenchRow();
    const button = screen.getByRole("button", { name: "More actions for Iron Ballista" });

    fireEvent.click(button);

    expect(button).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("menuitem", { name: "Remove all 2" })).toBeInTheDocument();
  });

  it("leaves the keyboard context-menu keys to the browser", () => {
    renderWorkbenchRow();
    const row = screen.getByRole("button", { name: "View details for Iron Ballista" });

    expect(fireEvent.keyDown(row, { key: "F10", shiftKey: true })).toBe(true);
    expect(fireEvent.keyDown(row, { key: "ContextMenu" })).toBe(true);
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });
});
