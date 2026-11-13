import type { DeckCheckEntryCardResponse } from "@openrift/shared/types/api/deck-check";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/features/cards/hooks/use-preferred-printing", () => ({
  usePreferredPrinting: () => ({ getPreferredPrinting: () => undefined }),
}));

const { DeckCheckStatsSummary } = await import("./deck-check-entry-header");

function line(zone: string, rawName: string): DeckCheckEntryCardResponse {
  return {
    id: rawName,
    zone,
    rawName,
    quantity: 1,
    matchStatus: "unmatched",
    resolvedCardId: null,
    resolvedPrintingId: null,
  } as unknown as DeckCheckEntryCardResponse;
}

describe("DeckCheckStatsSummary", () => {
  it("shows the typed Legend and Champion names when they did not resolve", () => {
    render(
      <DeckCheckStatsSummary
        cards={[line("legend", "Jinx, Loose Canon"), line("champion", "Jinx, Rebel")]}
        typeCounts={[]}
        format={null}
        isValid
        domainDistribution={[]}
      />,
    );

    expect(screen.getByText("Jinx, Loose Canon / Jinx, Rebel")).toBeInTheDocument();
  });
});
