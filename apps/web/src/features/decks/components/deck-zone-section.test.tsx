import type { DeckZone } from "@openrift/shared/types/enums";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { stubDeckBuilderCard } from "@/test/factories";

vi.mock("@/features/decks/hooks/use-deck-zone-drop", () => ({
  useDeckZoneDrop: () => ({ dropRef: vi.fn(), isOver: false, dropDisabled: false }),
}));
vi.mock("@/features/decks/hooks/use-deck-builder", () => ({
  useDeckBuilderActions: () => ({ addCard: vi.fn(), removeCard: vi.fn(), setQuantity: vi.fn() }),
  useDeckCards: () => [],
}));
vi.mock("@/features/decks/hooks/use-decks", () => ({
  useDeckDetail: () => ({ data: { deck: { format: "constructed" } } }),
}));
vi.mock("@/features/cards/hooks/use-preferred-printing", () => ({
  usePreferredPrinting: () => ({ getPreferredPrinting: () => undefined }),
}));
vi.mock("@/features/groups/hooks/use-loans", () => ({
  useBorrowedLenders: () => ({ data: undefined }),
}));
vi.mock("@/hooks/use-domain-colors", () => ({ useDomainColors: () => ({}) }));
vi.mock("@/hooks/use-enums", () => ({
  useEnumOrders: () => ({
    labels: { domains: {}, cardTypes: { unit: "Unit", spell: "Spell", gear: "Gear" } },
  }),
}));
vi.mock("@/features/decks/components/deck-card-printing-menu", () => ({
  DeckCardPrintingMenu: ({ children }: { children: React.ReactNode }) => children,
}));
vi.mock("@/features/decks/components/deck-card-row", () => ({
  DeckCardRow: ({ card }: { card: { cardName: string } }) => <div>{card.cardName}</div>,
}));

// oxlint-disable-next-line import/first -- must import after vi.mock
import { DeckZoneSection } from "./deck-zone-section";

function renderSection({
  zone = "main" as DeckZone,
  cards = [] as ReturnType<typeof stubDeckBuilderCard>[],
  onActivate = vi.fn(),
  onAdd,
}: {
  zone?: DeckZone;
  cards?: ReturnType<typeof stubDeckBuilderCard>[];
  onActivate?: () => void;
  onAdd?: () => void;
} = {}) {
  render(
    <DeckZoneSection
      deckId="deck-1"
      zone={zone}
      cards={cards}
      violations={[]}
      isActive={false}
      onActivate={onActivate}
      onAdd={onAdd}
      deckItems={[]}
    />,
  );
}

describe("DeckZoneSection", () => {
  it("ends an empty zone with an add strip carrying the empty hint", () => {
    const onActivate = vi.fn();
    renderSection({ zone: "legend", onActivate });
    fireEvent.click(screen.getByRole("button", { name: "Choose a Legend" }));
    expect(onActivate).toHaveBeenCalledOnce();
  });

  it("keeps the add strip under a filled zone and routes it to onAdd", () => {
    const onActivate = vi.fn();
    const onAdd = vi.fn();
    renderSection({
      cards: [stubDeckBuilderCard({ cardName: "Iron Ballista", cardType: "gear" })],
      onActivate,
      onAdd,
    });
    fireEvent.click(screen.getByRole("button", { name: "Add to main deck" }));
    expect(onAdd).toHaveBeenCalledOnce();
    expect(onActivate).not.toHaveBeenCalled();
  });

  it("shows the rune auto-fill hint on the add strip of an empty runes zone", () => {
    const onActivate = vi.fn();
    renderSection({ zone: "runes", onActivate });
    fireEvent.click(screen.getByRole("button", { name: "Auto-fills from your Legend" }));
    expect(onActivate).toHaveBeenCalledOnce();
  });

  it("swaps the rune hint for an add strip once runes are in", () => {
    const onAdd = vi.fn();
    renderSection({
      zone: "runes",
      cards: [stubDeckBuilderCard({ cardName: "Fury Rune", cardType: "rune", quantity: 6 })],
      onAdd,
    });
    expect(screen.queryByText("Auto-fills from your Legend")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Add runes" }));
    expect(onAdd).toHaveBeenCalledOnce();
  });

  it("labels the gear group without a plural s", () => {
    renderSection({
      cards: [stubDeckBuilderCard({ cardName: "Iron Ballista", cardType: "gear", quantity: 2 })],
    });
    expect(screen.getByText(/^Gear/u)).toHaveTextContent("Gear · 2");
  });

  it("heads each type group with its label and copy count", () => {
    renderSection({
      cards: [
        stubDeckBuilderCard({
          cardId: "a",
          cardName: "Captain Farron",
          cardType: "unit",
          quantity: 3,
        }),
        stubDeckBuilderCard({ cardId: "b", cardName: "Magma Wurm", cardType: "unit", quantity: 2 }),
        stubDeckBuilderCard({
          cardId: "c",
          cardName: "Hextech Ray",
          cardType: "spell",
          quantity: 1,
        }),
      ],
    });
    expect(screen.getByText(/^Units/u)).toHaveTextContent("Units · 5");
    expect(screen.getByText(/^Spells/u)).toHaveTextContent("Spells · 1");
  });

  it("hides the rows and the add strip once collapsed", () => {
    renderSection({ cards: [stubDeckBuilderCard({ cardName: "Iron Ballista" })] });
    fireEvent.click(screen.getByRole("button", { name: /^Collapse/u }));
    expect(screen.queryByText("Iron Ballista")).toBeNull();
    expect(screen.queryByRole("button", { name: "Add to main deck" })).toBeNull();
  });
});
