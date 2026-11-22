import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

const refetch = vi.fn();

vi.mock("@/features/tournaments/hooks/use-tournament-deck-check", () => ({
  useTournamentDeckCheckEntry: () => ({ data: undefined, isError: true, refetch }),
  useSetTournamentDeckCheckEntryState: () => ({ mutate: vi.fn(), isPending: false }),
  useDeleteTournamentDeckCheckEntry: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

vi.mock("@/features/tournaments/components/deck-check-entry-header", () => ({
  DeckEntryTopBar: () => null,
  EntryHeader: () => null,
  EntryPreview: () => null,
  EntryTopBarActions: () => null,
  PlayerMessageField: () => null,
  DeckCheckStatsSummary: () => null,
}));

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => vi.fn(),
}));

const { TournamentDeckCheckEntry } = await import("./deck-check-entry-page");

describe("TournamentDeckCheckEntry", () => {
  it("offers a retry when the decklist fails to load", async () => {
    const user = userEvent.setup();
    render(<TournamentDeckCheckEntry tournamentId="t-1" entryId="e-1" canManage={false} />);

    expect(screen.getByText("Decklist unavailable")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Retry" }));
    expect(refetch).toHaveBeenCalled();
  });
});
