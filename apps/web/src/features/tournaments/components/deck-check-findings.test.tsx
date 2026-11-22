import type { DeckCheckEntryDetailResponse } from "@openrift/shared/types/api/deck-check";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

function idle() {
  return { mutateAsync: vi.fn(), isPending: false, error: null, reset: vi.fn() };
}

vi.mock("@/features/tournaments/hooks/use-tournament-deck-check", () => ({
  useApplyTournamentDeckCheckZoneFixes: idle,
  useReResolveTournamentDeckCheck: idle,
}));

vi.mock("@/features/cards/hooks/use-cards", () => ({
  useCards: () => ({ printingsByCardId: new Map() }),
}));

vi.mock("@/hooks/use-enums", () => ({
  useZoneOrder: () => ({ zoneOrder: ["main", "runes"], zoneLabels: {} }),
}));

const { FindingsBanner } = await import("./deck-check-findings");

const detail = {
  entry: { state: "submitted" },
  cards: [],
  violations: [],
  zoneSuggestions: [
    { cardId: "c-rune", cardName: "Fury Rune", currentZone: "main", suggestedZone: "runes" },
  ],
} as unknown as DeckCheckEntryDetailResponse;

describe("FindingsBanner zone fixes", () => {
  it("reselects every suggestion when reopened after a cancel", async () => {
    const user = userEvent.setup();
    render(<FindingsBanner tournamentId="t-1" detail={detail} onResolved={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: "Fix zones" }));
    await user.click(screen.getByRole("checkbox"));
    expect(screen.getByRole("checkbox")).not.toBeChecked();
    await user.click(screen.getByRole("button", { name: "Cancel" }));

    await user.click(screen.getByRole("button", { name: "Fix zones" }));
    expect(screen.getByRole("checkbox")).toBeChecked();
  });
});
