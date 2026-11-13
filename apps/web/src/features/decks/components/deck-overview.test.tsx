import { WellKnown } from "@openrift/shared/well-known";
import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useDeckBuilderUiStore } from "@/features/decks/stores/deck-builder-ui-store";
import { useDeckOverviewViewStore } from "@/features/decks/stores/deck-overview-view-store";
import { stubDeckBuilderCard } from "@/test/factories";
import { createStoreResetter } from "@/test/store-helpers";

const viewport = vi.hoisted(() => ({ phone: false }));

vi.mock("@/hooks/use-is-mobile", () => ({ useIsMobile: () => viewport.phone }));
vi.mock("@/hooks/use-hydrated", () => ({ useHydrated: () => true }));
vi.mock("@/hooks/use-enums", async () => {
  const { useZoneOrderStub } = await import("@/test/zone-order-stub");
  return {
    useZoneOrder: useZoneOrderStub,
    useChampionIdentifierTags: () => [],
    useEnumOrders: () => ({
      labels: { cardTypes: {}, rarities: {}, domains: {} },
      orders: { cardTypes: [], rarities: [], domains: [] },
    }),
  };
});
vi.mock("@tanstack/react-query", async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  useQuery: () => ({ data: undefined }),
}));
vi.mock("@/features/cards/hooks/use-cards", () => ({ useCards: () => ({ sets: [] }) }));
vi.mock("@/features/cards/hooks/use-preferred-printing", () => ({
  usePreferredPrinting: () => ({ getFaceImage: () => undefined }),
}));
vi.mock("@/features/cards/hooks/use-responsive-columns", () => ({
  useResponsiveColumns: () => ({
    containerRef: () => {},
    columns: 4,
    autoColumns: 4,
    physicalMin: 1,
    physicalMax: 8,
    containerWidth: 0,
    measured: false,
  }),
}));
vi.mock("@/features/collections/hooks/use-home-collection", () => ({
  useHomeCollection: () => undefined,
}));
vi.mock("@/features/decks/hooks/use-deck-stats", () => ({
  useDeckStats: () => ({ domainDistribution: [], mainDeckCards: 0 }),
}));
vi.mock("@/features/cards/components/options-bar", () => ({
  MobileOptionsDrawer: () => null,
}));
vi.mock("@/features/decks/components/deck-hero", () => ({
  DeckHero: () => <div data-testid="deck-hero" />,
}));
vi.mock("@/features/decks/components/deck-overview-list", () => ({
  DeckOverviewList: () => <div>card list</div>,
}));
vi.mock("@/features/decks/components/deck-overview-zone-tile", () => ({
  ZoneTile: ({ zone }: { zone: string }) => <div>{`zone tile ${zone}`}</div>,
}));
vi.mock("@/features/decks/components/stats/deck-stats-band", () => ({
  DeckStatsBand: ({
    applyStatsFocus,
  }: {
    applyStatsFocus: (focus: { kind: "energy"; value: number }) => void;
  }) => (
    <section aria-label="stats band">
      <button type="button" onClick={() => applyStatsFocus({ kind: "energy", value: 2 })}>
        energy bar
      </button>
    </section>
  ),
}));
vi.mock("@/features/decks/components/stats/deck-stats-summary", () => ({
  DeckStatsSummary: () => <div>stats summary</div>,
}));
vi.mock("@/features/decks/components/deck-overview-view-controls", () => ({
  DeckOverviewViewControls: () => null,
  DeckOrderingControl: () => null,
}));
vi.mock("@/features/decks/components/deck-tokens-section", () => ({
  DeckTokensSection: () => null,
}));
vi.mock("@/features/decks/components/format-config-card", () => ({
  FormatConfigCard: () => null,
}));
vi.mock("@/features/decks/components/deck-ownership-bridge", () => ({
  OwnershipBandSourcesBridge: () => null,
}));
vi.mock("@/features/decks/components/deck-test-bench", () => ({ DeckTestBench: () => null }));
vi.mock("@/features/decks/components/deck-box-tab", () => ({ DeckBoxTab: () => null }));
vi.mock("@/features/decks/components/deck-builder-intro-banner", () => ({
  DeckBuilderIntroBanner: () => null,
}));

import { DeckOverview } from "./deck-overview";

const resetUiStore = createStoreResetter(useDeckBuilderUiStore);
const resetViewStore = createStoreResetter(useDeckOverviewViewStore);

beforeEach(() => {
  resetUiStore();
  resetViewStore();
});

afterEach(() => {
  viewport.phone = false;
});

function renderOverview({ phone = false, readOnly = false } = {}) {
  viewport.phone = phone;
  render(
    <DeckOverview
      deck={{
        id: "deck-1",
        name: "Jinx Fury Aggro",
        format: WellKnown.deckFormat.CONSTRUCTED,
        formatConfig: null,
      }}
      cards={[stubDeckBuilderCard({ cardName: "Iron Ballista", energy: 2, quantity: 3 })]}
      customTagAssignments={{}}
      marketplace="tcgplayer"
      getThumbnail={() => undefined}
      readOnly={readOnly}
    />,
  );
}

describe("DeckOverview on a phone", () => {
  it("opens an editable deck as a list until a display mode is picked", () => {
    renderOverview({ phone: true });
    expect(screen.getByText("card list")).toBeInTheDocument();
    expect(screen.queryByText("zone tile main")).toBeNull();
  });

  it("keeps a picked display mode", () => {
    useDeckOverviewViewStore.getState().setDisplayMode("grid");
    renderOverview({ phone: true });
    expect(screen.getByText("zone tile main")).toBeInTheDocument();
  });

  it("keeps a read-only deck on the stored grid", () => {
    renderOverview({ phone: true, readOnly: true });
    expect(screen.getByText("zone tile main")).toBeInTheDocument();
  });

  it("moves the stats band onto its own tab behind a summary", () => {
    renderOverview({ phone: true });
    expect(screen.getByText("stats summary")).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "stats band" })).toBeNull();
    fireEvent.click(screen.getByRole("tab", { name: "Stats" }));
    expect(screen.getByRole("region", { name: "stats band" })).toBeInTheDocument();
  });

  it("jumps back to the deck tab when a stats bar is clicked", () => {
    renderOverview({ phone: true });
    fireEvent.click(screen.getByRole("tab", { name: "Stats" }));
    fireEvent.click(screen.getByRole("button", { name: "energy bar" }));
    expect(useDeckBuilderUiStore.getState().overviewTab).toBe("overview");
    expect(screen.getByRole("button", { name: "Show all cards" })).toBeInTheDocument();
  });
});

describe("DeckOverview above phone width", () => {
  it("shows the stats band inline with no Stats tab or summary", () => {
    renderOverview();
    expect(screen.getByRole("region", { name: "stats band" })).toBeInTheDocument();
    expect(screen.queryByRole("tab", { name: "Stats" })).toBeNull();
    expect(screen.queryByText("stats summary")).toBeNull();
  });

  it("keeps the stored grid for an editable deck", () => {
    renderOverview();
    expect(screen.getByText("zone tile main")).toBeInTheDocument();
  });

  it("filters in place when a stats bar is clicked", () => {
    renderOverview();
    fireEvent.click(screen.getByRole("button", { name: "energy bar" }));
    expect(screen.getByRole("region", { name: "stats band" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Show all cards" })).toBeInTheDocument();
  });
});
