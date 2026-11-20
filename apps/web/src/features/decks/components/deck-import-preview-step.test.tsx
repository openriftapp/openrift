import { labelMapOf } from "@openrift/shared/enum-label";
import { WellKnown } from "@openrift/shared/well-known";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { DeckMatchedEntry } from "@/features/decks/lib/deck-import-matcher";
import type { SideBySideZone } from "@/features/decks/lib/deck-side-by-side";

vi.mock("@/features/decks/components/deck-import-entry-row", () => ({
  DeckImportEntryRow: () => null,
}));
vi.mock("@/features/decks/components/deck-import-summary", () => ({
  DeckImportSummary: () => null,
}));
vi.mock("@/features/decks/components/deck-changes-list", () => ({
  DeckChangesList: () => null,
}));
vi.mock("@/features/cards/components/hovered-card-preview", () => ({
  HoveredCardPreview: () => null,
}));
vi.mock("@/features/decks/hooks/use-deck-hover-preview", () => ({
  useDeckHoverPreview: () => ({
    hoveredCard: null,
    containerRef: { current: null },
    handleHoverMain: () => {},
  }),
}));

import { DeckImportPreviewStep } from "./deck-import-preview-step";

function entry(cardName: string, quantity: number): DeckMatchedEntry {
  return {
    entry: { cardName, quantity } as DeckMatchedEntry["entry"],
    status: "exact",
    resolvedCard: null,
    candidates: [],
    zone: WellKnown.deckZone.MAIN,
  };
}

function renderStep(props: {
  importableCount: number;
  totalCards: number;
  entries: number;
  replaceDeckName?: string;
  replaceChanges?: SideBySideZone[] | null;
}) {
  const noop = vi.fn();
  render(
    <DeckImportPreviewStep
      matchedEntries={Array.from({ length: props.entries }, (_, index) =>
        entry(`Card ${index}`, 1),
      )}
      allPrintings={[]}
      parseWarnings={[]}
      sourceNote={null}
      skippedIndices={new Set()}
      expandedValues={[]}
      deckName=""
      deckFormat={WellKnown.deckFormat.CONSTRUCTED}
      deckFormats={[]}
      zoneOrder={[]}
      zoneLabels={labelMapOf({})}
      readyCount={0}
      toVerifyCount={0}
      needsAttentionCount={0}
      importableCount={props.importableCount}
      skippedCount={0}
      totalCards={props.totalCards}
      importCards={[]}
      summaryFormat={WellKnown.deckFormat.CONSTRUCTED}
      summaryFormatConfig={null}
      isLoggedIn
      isImporting={false}
      replaceDeckName={props.replaceDeckName}
      replaceChanges={props.replaceChanges}
      onDropSourceLink={noop}
      onResolve={noop}
      onZoneChange={noop}
      onSkip={noop}
      onUnskip={noop}
      onExpandedValuesChange={noop}
      onDeckNameChange={noop}
      onDeckFormatChange={noop}
      onImport={noop}
      onBack={noop}
    />,
  );
}

describe("DeckImportPreviewStep", () => {
  it("counts only importable entries next to the card total", () => {
    renderStep({ entries: 5, importableCount: 3, totalCards: 9 });
    expect(screen.getByText(/3 entries · 9 cards/u)).toBeInTheDocument();
  });

  it("reads zero entries when nothing can be imported", () => {
    renderStep({ entries: 2, importableCount: 0, totalCards: 0 });
    expect(screen.getByText(/0 entries · 0 cards/u)).toBeInTheDocument();
  });

  it("sums what goes in, out and stays when replacing a deck", () => {
    renderStep({
      entries: 2,
      importableCount: 2,
      totalCards: 5,
      replaceDeckName: "Lucian",
      replaceChanges: [
        {
          zone: WellKnown.deckZone.MAIN,
          fromCount: 6,
          toCount: 5,
          rows: [
            { cardId: "a", cardName: "Sabotage", from: 3, to: 0, kind: "cut" },
            { cardId: "b", cardName: "Gem Jammer", from: 1, to: 3, kind: "change" },
            { cardId: "c", cardName: "Challenge", from: 2, to: 2, kind: "same" },
          ],
        },
      ],
    });
    expect(screen.getByText("Changes")).toBeInTheDocument();
    expect(screen.getByText("2 in · 3 out · 3 unchanged")).toBeInTheDocument();
    expect(screen.getByRole("switch")).toBeChecked();
  });

  it("says the lists match when the import changes nothing", () => {
    renderStep({
      entries: 1,
      importableCount: 1,
      totalCards: 2,
      replaceDeckName: "Lucian",
      replaceChanges: [
        {
          zone: WellKnown.deckZone.MAIN,
          fromCount: 2,
          toCount: 2,
          rows: [{ cardId: "c", cardName: "Challenge", from: 2, to: 2, kind: "same" }],
        },
      ],
    });
    expect(screen.getByText("The two lists match, card for card.")).toBeInTheDocument();
    expect(screen.queryByRole("switch")).not.toBeInTheDocument();
  });

  it("shows no changes section for a new deck", () => {
    renderStep({ entries: 1, importableCount: 1, totalCards: 1 });
    expect(screen.queryByText("Changes")).not.toBeInTheDocument();
  });
});
