import type { DeckCheckEntryCardResponse } from "@openrift/shared/types/api/deck-check";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/hooks/use-enums", () => ({
  useEnumOrders: () => ({ orders: { domains: [] } }),
  useZoneOrder: () => ({
    zoneOrder: ["legend", "champion", "runes", "main", "sideboard"],
    zoneLabels: { legend: "Legend", champion: "Champion", runes: "Runes", main: "Main Deck" },
  }),
}));

vi.mock("@/features/cards/hooks/use-cards", () => ({
  useCards: () => ({ printingsById: {}, printingsByCardId: new Map(), sets: [] }),
}));

vi.mock("@/features/cards/hooks/use-card-thumbnail-display", () => ({
  useCardThumbnailDisplay: () => ({}),
}));

vi.mock("@/hooks/use-is-mobile", () => ({ useIsMobile: () => false }));

vi.mock("@/features/tournaments/hooks/use-checklist-copy-actions", () => ({
  useChecklistCopyActions: () => ({
    found: false,
    toggle: vi.fn(),
    removeOpen: false,
    setRemoveOpen: vi.fn(),
    remove: vi.fn(),
    removePending: false,
  }),
}));

vi.mock("@/features/tournaments/components/deck-check-entry-dialogs", () => ({
  FixCardDialog: () => null,
}));

const { CardChecklist } = await import("./deck-check-checklist");

function card(id: string, zone: string): DeckCheckEntryCardResponse {
  return {
    id,
    zone,
    rawName: `Card ${id}`,
    quantity: 1,
    sortOrder: 0,
    matchStatus: "unmatched",
    resolvedCardId: null,
    resolvedPrintingId: null,
    foundCopies: [false],
  } as unknown as DeckCheckEntryCardResponse;
}

describe("CardChecklist", () => {
  it("lists the zones in the admin-managed zone order", () => {
    render(
      <CardChecklist
        tournamentId="t-1"
        entryId="e-1"
        cards={[card("a", "main"), card("b", "runes"), card("c", "champion")]}
        displayMode="list"
        sortBy="name"
        sortDir="asc"
        columns={1}
        cellWidth={172}
        locked
        fixLocked
        fixZoneOnly={false}
        tickLocked={false}
        onStale={vi.fn()}
      />,
    );

    expect(
      screen.getAllByRole("heading", { level: 3 }).map((heading) => heading.textContent),
    ).toEqual([
      expect.stringContaining("Champion"),
      expect.stringContaining("Runes"),
      expect.stringContaining("Main Deck"),
    ]);
  });
});
