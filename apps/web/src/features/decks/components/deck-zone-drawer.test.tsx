import type { DeckViolation } from "@openrift/shared/deck-rules";
import type { DeckFormat } from "@openrift/shared/types/enums";
import { WellKnown } from "@openrift/shared/well-known";
import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { DeckBuilderCard } from "@/features/decks/lib/deck-builder-card";
import { stubDeckBuilderCard } from "@/test/factories";

const deck = vi.hoisted(() => ({
  format: "constructed" as DeckFormat,
  cards: [] as DeckBuilderCard[],
  violations: [] as DeckViolation[],
}));
const sidebar = vi.hoisted(() => ({ openMobile: true, setOpenMobile: vi.fn() }));

vi.mock("@/components/ui/sidebar", () => ({ useSidebar: () => sidebar }));
const undo = vi.hoisted(() => ({ canUndo: true, undo: vi.fn() }));
vi.mock("@/features/decks/components/deck-undo-controls", () => ({ useDeckUndo: () => undo }));
const overlay = vi.hoisted(() => ({ active: false }));
vi.mock("@/features/cards/hooks/use-overlay-history-entry", () => ({
  useOverlayHistoryEntry: (options: { active: boolean }) => {
    overlay.active = options.active;
  },
  closeOverlayHistoryEntry: (_key: string, close: () => void) => close(),
}));
vi.mock("@/features/decks/hooks/use-deck-builder", () => ({
  useDeckCards: () => deck.cards,
  useDeckViolations: () => deck.violations,
}));
vi.mock("@/features/decks/hooks/use-decks", () => ({
  useDeckDetail: () => ({
    data: { deck: { name: "Jinx Fury Aggro", format: deck.format, formatConfig: null } },
  }),
}));
vi.mock("@/features/decks/hooks/use-deck-stats", () => ({
  useDeckStats: () => ({ domainDistribution: [], mainDeckCards: 0 }),
}));
vi.mock("@/features/cards/hooks/use-preferred-printing", () => ({
  usePreferredPrinting: () => ({ getPreferredFrontImage: () => undefined }),
}));
vi.mock("@/hooks/use-domain-colors", () => ({ useDomainColors: () => ({}) }));
vi.mock("@/hooks/use-enums", async () => {
  const { useZoneOrderStub } = await import("@/test/zone-order-stub");
  return {
    useZoneOrder: useZoneOrderStub,
    useEnumOrders: () => ({ labels: { domains: {} }, orders: { domains: [] } }),
  };
});

import { DeckZoneDrawer } from "./deck-zone-drawer";
import { DeckZonePanelHeader } from "./deck-zone-panel";

afterEach(() => {
  deck.format = WellKnown.deckFormat.CONSTRUCTED;
  deck.cards = [];
  deck.violations = [];
  sidebar.openMobile = true;
  sidebar.setOpenMobile.mockClear();
});

function fullDeck(): DeckBuilderCard[] {
  return [
    stubDeckBuilderCard({ zone: "legend", quantity: 1 }),
    stubDeckBuilderCard({ zone: "champion", quantity: 1 }),
    stubDeckBuilderCard({ zone: "runes", quantity: 12 }),
    stubDeckBuilderCard({ zone: "battlefield", quantity: 3 }),
    stubDeckBuilderCard({ zone: "main", quantity: 39 }),
  ];
}

describe("DeckZonePanelHeader", () => {
  it("shows the deck name and its progress toward the required cards", () => {
    deck.cards = [stubDeckBuilderCard({ zone: "main", quantity: 10 })];
    render(<DeckZonePanelHeader deckId="deck-1" />);
    expect(screen.getByText("Jinx Fury Aggro")).toBeInTheDocument();
    expect(screen.getByText("10/56 required")).toHaveClass("text-muted-foreground");
  });

  it("marks a complete, valid deck as done", () => {
    deck.cards = fullDeck();
    render(<DeckZonePanelHeader deckId="deck-1" />);
    expect(screen.getByText("56/56 required")).toHaveClass("text-success");
  });

  it("flags a deck with rule violations", () => {
    deck.cards = fullDeck();
    deck.violations = [{ code: "copy-limit", message: "Too many copies", zone: "main" }];
    render(<DeckZonePanelHeader deckId="deck-1" />);
    expect(screen.getByText("56/56 required")).toHaveClass("text-destructive");
  });

  it("counts plain cards for a freeform deck", () => {
    deck.format = WellKnown.deckFormat.FREEFORM;
    deck.cards = [stubDeckBuilderCard({ zone: "main", quantity: 7 })];
    render(<DeckZonePanelHeader deckId="deck-1" />);
    expect(screen.getByText("7 cards")).toBeInTheDocument();
  });

  it("opens the overview when it has somewhere to go", () => {
    const onOverviewClick = vi.fn();
    render(<DeckZonePanelHeader deckId="deck-1" onOverviewClick={onOverviewClick} />);
    fireEvent.click(screen.getByRole("button", { name: "Deck overview" }));
    expect(onOverviewClick).toHaveBeenCalledOnce();
  });

  it("is not a button without an overview to open", () => {
    render(<DeckZonePanelHeader deckId="deck-1" />);
    expect(screen.queryByRole("button", { name: "Deck overview" })).toBeNull();
  });
});

describe("DeckZoneDrawer", () => {
  it("shows the zones and the deck header while open", () => {
    render(
      <DeckZoneDrawer deckId="deck-1">
        <p>zone list</p>
      </DeckZoneDrawer>,
    );
    expect(screen.getByText("Deck Zones")).toBeInTheDocument();
    expect(screen.getByText("Jinx Fury Aggro")).toBeInTheDocument();
    expect(screen.getByText("zone list")).toBeInTheDocument();
  });

  it("renders nothing while closed", () => {
    sidebar.openMobile = false;
    render(
      <DeckZoneDrawer deckId="deck-1">
        <p>zone list</p>
      </DeckZoneDrawer>,
    );
    expect(screen.queryByText("zone list")).toBeNull();
  });

  it("closes through the sidebar state", () => {
    render(
      <DeckZoneDrawer deckId="deck-1">
        <p>zone list</p>
      </DeckZoneDrawer>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(sidebar.setOpenMobile).toHaveBeenCalledWith(false, expect.anything());
  });

  it("routes the header to the overview", () => {
    const onOverviewClick = vi.fn();
    render(
      <DeckZoneDrawer deckId="deck-1" onOverviewClick={onOverviewClick}>
        <p>zone list</p>
      </DeckZoneDrawer>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Deck overview" }));
    expect(onOverviewClick).toHaveBeenCalledOnce();
  });

  it("adds no history entry outside the beta editor", () => {
    render(
      <DeckZoneDrawer deckId="deck-1">
        <p>zone list</p>
      </DeckZoneDrawer>,
    );
    expect(overlay.active).toBe(false);
    expect(screen.queryByText(/Tap another zone/u)).toBeNull();
  });

  it("names the target zone, offers Undo and keeps a history entry in the beta editor", () => {
    render(
      <DeckZoneDrawer deckId="deck-1" target="main">
        <p>zone list</p>
      </DeckZoneDrawer>,
    );
    expect(overlay.active).toBe(true);
    expect(
      screen.getByText("Adding to Main Deck. Tap another zone to switch."),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Undo" }));
    expect(undo.undo).toHaveBeenCalledOnce();
  });

  it("closes the beta sheet through its history entry", () => {
    render(
      <DeckZoneDrawer deckId="deck-1" target="main">
        <p>zone list</p>
      </DeckZoneDrawer>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(sidebar.setOpenMobile).toHaveBeenCalledWith(false);
  });
});
