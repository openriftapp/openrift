import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

function idle() {
  return { mutate: vi.fn(), mutateAsync: vi.fn(), isPending: false, error: null, reset: vi.fn() };
}

vi.mock("@/features/tournaments/hooks/use-tournament-deck-check", () => ({
  useTournamentDeckCheckEntries: () => ({ data: { entries: [] } }),
  useCreateTournamentDeckCheckEntry: idle,
  useDeleteTournamentDeckCheckEntry: idle,
  useSetTournamentDeckCheckEntryState: idle,
}));

vi.mock("@/features/tournaments/hooks/use-tournaments", () => ({
  useTournamentParticipants: () => ({ data: { items: [] } }),
}));

vi.mock("@/hooks/use-enums", () => ({
  useZoneOrder: () => ({ zoneOrder: ["main"], zoneLabels: {} }),
}));

vi.mock("@tanstack/react-router", () => ({
  createLink: (component: unknown) => component,
  Link: ({ children }: { children?: ReactNode }) => <a href="/">{children}</a>,
  useNavigate: () => vi.fn(),
}));

const { TournamentDeckCheckAddButton } = await import("./deck-check-event-page");

describe("AddDeckDialog", () => {
  it("opens without any warning or error before a list is pasted", async () => {
    const user = userEvent.setup();
    render(<TournamentDeckCheckAddButton tournamentId="t-1" />);

    await user.click(screen.getByRole("button", { name: /Add deck/u }));

    expect(await screen.findByRole("dialog")).toBeInTheDocument();
    expect(screen.queryByText("No data provided.")).not.toBeInTheDocument();
  });
});
