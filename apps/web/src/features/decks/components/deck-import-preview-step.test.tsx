import { labelMapOf } from "@openrift/shared/enum-label";
import { WellKnown } from "@openrift/shared/well-known";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { DeckMatchedEntry } from "@/features/decks/lib/deck-import-matcher";

vi.mock("@/features/decks/components/deck-import-entry-row", () => ({
  DeckImportEntryRow: () => null,
}));
vi.mock("@/features/decks/components/deck-import-summary", () => ({
  DeckImportSummary: () => null,
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

function renderStep(props: { importableCount: number; totalCards: number; entries: number }) {
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
});
