import type { DeckViolation } from "@openrift/shared/deck-rules";
import type { CardType, DeckZone } from "@openrift/shared/types/enums";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { stubDeckBuilderCard } from "@/test/factories";

const actions = vi.hoisted(() => ({
  addCard: vi.fn(),
  increments: new Map<string, (event: { shiftKey: boolean }) => void>(),
}));

vi.mock("@/features/decks/hooks/use-deck-zone-drop", () => ({
  useDeckZoneDrop: () => ({ dropRef: vi.fn(), isOver: false, dropDisabled: false }),
}));
vi.mock("@/features/decks/hooks/use-deck-builder", () => ({
  useDeckBuilderActions: () => ({
    addCard: actions.addCard,
    removeCard: vi.fn(),
    setQuantity: vi.fn(),
  }),
  useDeckCards: () => [],
}));
vi.mock("@/features/decks/hooks/use-decks", () => ({
  useDeckDetail: () => ({ data: { deck: { format: "constructed" } } }),
}));
const planMock = vi.hoisted(() => ({ plan: undefined as unknown }));
vi.mock("@/features/decks/hooks/use-deck-plan", () => ({
  useDeckPlanIfAvailable: () => planMock.plan,
}));
vi.mock("@/features/decks/hooks/use-local-decks", () => ({ useIsLocalDeck: () => false }));
vi.mock("@/features/cards/hooks/use-preferred-printing", () => ({
  usePreferredPrinting: () => ({ getPreferredPrinting: () => undefined }),
}));
vi.mock("@/features/groups/hooks/use-loans", () => ({
  useBorrowedLenders: () => ({ data: undefined }),
}));
vi.mock("@/hooks/use-domain-colors", () => ({ useDomainColors: () => ({}) }));
vi.mock("@/hooks/use-enums", async () => {
  const { useZoneOrderStub } = await import("@/test/zone-order-stub");
  return {
    useZoneOrder: useZoneOrderStub,
    useEnumOrders: () => ({
      labels: { domains: {}, cardTypes: { unit: "Unit", spell: "Spell", gear: "Gear" } },
    }),
  };
});
vi.mock("@/features/decks/components/deck-card-printing-menu", () => ({
  DeckCardPrintingMenu: ({ children }: { children: React.ReactNode }) => children,
}));
vi.mock("@/features/decks/components/deck-card-row", () => ({
  DeckCardRow: ({
    card,
    controlMode,
    onIncrement,
    hasViolation,
    planTag,
  }: {
    card: { cardName: string };
    controlMode: string;
    onIncrement?: (event: { shiftKey: boolean }) => void;
    hasViolation?: boolean;
    planTag?: string;
  }) => {
    if (onIncrement) {
      actions.increments.set(card.cardName, onIncrement);
    }
    return (
      <div
        data-testid="deck-card-row"
        data-plan-tag={planTag ?? ""}
        data-control-mode={controlMode}
        data-can-increment={String(onIncrement !== undefined)}
        data-has-violation={String(hasViolation === true)}
      >
        {card.cardName}
      </div>
    );
  },
}));

import { DeckZoneSection } from "./deck-zone-section";

function renderSection({
  zone = "main" as DeckZone,
  cards = [] as ReturnType<typeof stubDeckBuilderCard>[],
  onActivate = vi.fn(),
  onAdd,
  violations = [],
  workbench = false,
}: {
  zone?: DeckZone;
  cards?: ReturnType<typeof stubDeckBuilderCard>[];
  onActivate?: () => void;
  onAdd?: () => void;
  violations?: DeckViolation[];
  workbench?: boolean;
} = {}) {
  render(
    <DeckZoneSection
      deckId="deck-1"
      zone={zone}
      cards={cards}
      violations={violations}
      isActive={false}
      onActivate={onActivate}
      onAdd={onAdd}
      deckItems={[]}
      workbench={workbench}
    />,
  );
}

describe("DeckZoneSection", () => {
  it("adds three runes on a shift-click in the workbench, where the rune cap only warns", () => {
    actions.addCard.mockClear();
    const runes = stubDeckBuilderCard({
      cardName: "Fury Rune",
      zone: "runes" as DeckZone,
      cardType: "rune" as CardType,
      quantity: 12,
    });
    renderSection({ zone: "runes" as DeckZone, cards: [runes], workbench: true });
    actions.increments.get("Fury Rune")?.({ shiftKey: true });
    expect(actions.addCard).toHaveBeenCalledWith(runes, "runes", 3);
  });

  it("offers no extra legends without a card that grants them", () => {
    renderSection({
      zone: "legend-options",
      cards: [stubDeckBuilderCard({ cardName: "Darius, Hand of Noxus", cardType: "legend" })],
    });
    expect(screen.queryByRole("button", { name: "Add extra legends" })).toBeNull();
  });

  it("hides the workbench count once a zone is exactly full", () => {
    renderSection({
      zone: "runes",
      cards: [stubDeckBuilderCard({ cardName: "Fury Rune", cardType: "rune", quantity: 12 })],
      workbench: true,
    });
    expect(screen.queryByText("12/12")).toBeNull();
  });

  it("keeps the workbench count while a zone is short", () => {
    renderSection({
      zone: "runes",
      cards: [stubDeckBuilderCard({ cardName: "Fury Rune", cardType: "rune", quantity: 6 })],
      workbench: true,
    });
    expect(screen.getByText("6/12")).toBeDefined();
  });

  const jinx = stubDeckBuilderCard({
    cardId: "jinx",
    cardName: "Jinx, Loose Cannon",
    cardType: "legend",
    quantity: 2,
  });
  const duplicate: DeckViolation = {
    zone: "legend-options",
    code: "legend_options_unique",
    message: "Jinx, Loose Cannon is listed twice",
    cardId: "jinx",
  };

  it("leaves workbench rows unmarked and lists card issues in the header", () => {
    renderSection({
      zone: "legend-options",
      cards: [jinx],
      violations: [duplicate],
      workbench: true,
    });
    expect(screen.getByText("Jinx, Loose Cannon").dataset.hasViolation).toBe("false");
    fireEvent.click(screen.getByRole("button", { name: "Show zone issues" }));
    expect(screen.getByText("Jinx, Loose Cannon is listed twice")).toBeDefined();
  });

  it("keeps the per-row marking in the classic editor", () => {
    renderSection({ zone: "legend-options", cards: [jinx], violations: [duplicate] });
    expect(screen.getByText("Jinx, Loose Cannon").dataset.hasViolation).toBe("true");
  });

  it("drops the add strip once the legend slot is filled", () => {
    renderSection({
      zone: "legend",
      cards: [stubDeckBuilderCard({ cardName: "Volibear, Relentless Storm", cardType: "legend" })],
    });
    expect(screen.queryByRole("button", { name: "Add a legend" })).toBeNull();
  });

  it("drops the add strip once a zone reaches its target", () => {
    renderSection({
      zone: "runes",
      cards: [stubDeckBuilderCard({ cardName: "Fury Rune", cardType: "rune", quantity: 12 })],
    });
    expect(screen.queryByRole("button", { name: "Add runes" })).toBeNull();
  });

  it("drops the add strip once the chosen champion slot is filled", () => {
    renderSection({
      zone: "champion",
      cards: [stubDeckBuilderCard({ cardName: "Volibear, Furious", cardType: "unit" })],
    });
    expect(screen.queryByRole("button", { name: "Add a champion" })).toBeNull();
  });

  it("shows the count of a duplicated legend option without offering another copy", () => {
    renderSection({
      zone: "legend-options",
      cards: [
        stubDeckBuilderCard({ cardName: "Jinx, Loose Cannon", cardType: "legend", quantity: 2 }),
      ],
    });
    const row = screen.getByText("Jinx, Loose Cannon");
    expect(row.dataset.controlMode).toBe("quantity");
    expect(row.dataset.canIncrement).toBe("false");
  });

  it("keeps a single legend option on the remove-only control", () => {
    renderSection({
      zone: "legend-options",
      cards: [stubDeckBuilderCard({ cardName: "Darius, Hand of Noxus", cardType: "legend" })],
    });
    expect(screen.getByText("Darius, Hand of Noxus").dataset.controlMode).toBe("remove-only");
  });

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

  it("shows battlefields in the overflow zone after the known type groups", () => {
    renderSection({
      zone: "overflow",
      cards: [
        stubDeckBuilderCard({ cardId: "a", cardName: "Captain Farron", cardType: "unit" }),
        stubDeckBuilderCard({ cardId: "b", cardName: "Sunken Temple", cardType: "battlefield" }),
      ],
    });
    fireEvent.click(screen.getByRole("button", { name: "Expand Overflow" }));
    expect(screen.getByText("Captain Farron")).toBeInTheDocument();
    expect(screen.getByText("Sunken Temple")).toBeInTheDocument();
  });

  it("tags and orders battlefields by their plan scenario", () => {
    planMock.plan = {
      battlefieldGame1CardId: "temple",
      battlefieldFirstCardId: "camp",
      battlefieldSecondCardId: null,
      battlefieldCustom: false,
    };
    renderSection({
      zone: "battlefield",
      cards: [
        stubDeckBuilderCard({ cardId: "seat", cardName: "Seat of Power", cardType: "battlefield" }),
        stubDeckBuilderCard({ cardId: "camp", cardName: "War Camp", cardType: "battlefield" }),
        stubDeckBuilderCard({ cardId: "temple", cardName: "Temple", cardType: "battlefield" }),
      ],
    });
    planMock.plan = undefined;
    const rows = screen.getAllByTestId("deck-card-row");
    expect(rows.map((row) => [row.textContent, row.dataset.planTag])).toEqual([
      ["Temple", "Game 1"],
      ["War Camp", "Going first"],
      ["Seat of Power", ""],
    ]);
  });

  it("hides the rows and the add strip once collapsed", () => {
    renderSection({ cards: [stubDeckBuilderCard({ cardName: "Iron Ballista" })] });
    fireEvent.click(screen.getByRole("button", { name: /^Collapse/u }));
    expect(screen.queryByText("Iron Ballista")).toBeNull();
    expect(screen.queryByRole("button", { name: "Add to main deck" })).toBeNull();
  });
});
