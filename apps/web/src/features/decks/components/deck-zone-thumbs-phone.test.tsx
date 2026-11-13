import type { DeckZone } from "@openrift/shared/types/enums";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { stubDeckBuilderCard } from "@/test/factories";

const actions = vi.hoisted(() => ({
  addCard: vi.fn(),
  removeCard: vi.fn(),
  setQuantity: vi.fn(),
}));

vi.mock("@/features/cards/hooks/use-cards", () => ({ useCards: () => ({ cardsById: {} }) }));
vi.mock("@/hooks/use-is-mobile", () => ({ useIsMobile: () => true }));
vi.mock("@/features/decks/hooks/use-deck-builder", () => ({
  useDeckBuilderActions: () => actions,
}));
vi.mock("@/features/decks/components/deck-card-printing-menu", () => ({
  DeckCardPrintingMenu: ({ children }: { children: React.ReactNode }) => children,
}));

import { ZoneThumb } from "./deck-zone-thumbs";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

function renderEditableThumb(addRoom: number, zone: DeckZone = "main") {
  const card = stubDeckBuilderCard({ cardName: "Stacked Deck", quantity: 2, zone });
  render(
    <ZoneThumb
      deckId="deck-1"
      card={card}
      zone={zone}
      addRoom={addRoom}
      thumbnail="https://example.test/stacked-deck.webp"
      isLandscape={false}
    />,
  );
  return card;
}

describe("ZoneThumb on a phone", () => {
  it("steps the count from a strip above the card, with no remove button on the art", () => {
    const card = renderEditableThumb(1);
    expect(screen.queryByRole("button", { name: "Remove Stacked Deck" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Remove one copy of Stacked Deck" }));
    expect(actions.removeCard).toHaveBeenCalledWith(card.cardId, "main", card.preferredPrintingId);
    fireEvent.click(screen.getByRole("button", { name: "Add one copy of Stacked Deck" }));
    expect(actions.addCard).toHaveBeenCalledWith(card, "main", 1);
  });

  it("disables adding once the zone has no room for another copy", () => {
    renderEditableThumb(0);
    const add = screen.getByRole("button", { name: "Add one copy of Stacked Deck" });
    expect((add as HTMLButtonElement).disabled).toBe(true);
  });

  it.each(["legend", "champion", "battlefield"] as const)(
    "drops the stepper on the single-card %s zone and keeps the remove button",
    (zone) => {
      const card = renderEditableThumb(1, zone);
      expect(screen.queryByRole("button", { name: "Add one copy of Stacked Deck" })).toBeNull();
      expect(screen.queryByRole("button", { name: "Remove one copy of Stacked Deck" })).toBeNull();
      fireEvent.click(screen.getByRole("button", { name: "Remove Stacked Deck" }));
      expect(actions.setQuantity).toHaveBeenCalledWith(
        card.cardId,
        zone,
        0,
        card.preferredPrintingId,
      );
    },
  );
});
