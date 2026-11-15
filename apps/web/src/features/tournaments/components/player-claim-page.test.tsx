import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

let deckSubmission = "none";

vi.mock("@/features/tournaments/hooks/use-deck-check-player", () => ({
  useClaimLanding: () => ({
    data: {
      tournamentName: "Summoner Skirmish",
      startsAt: "2026-03-01T12:00:00Z",
      hostName: "Zaun Card Hall",
      groupName: null,
      participantName: "Ashe",
      deckSubmission,
    },
  }),
  useClaimTournamentDeck: () => ({
    mutateAsync: vi.fn(),
    isPending: false,
    error: null,
    data: undefined,
  }),
}));

vi.mock("@/hooks/use-session", () => ({ useUserId: () => "user-1" }));

vi.mock("@/features/tournaments/components/token-landing-card", () => ({
  TokenLandingPage: ({ pageTitle, children }: { pageTitle: string; children: ReactNode }) => (
    <main>
      <h1>{pageTitle}</h1>
      {children}
    </main>
  ),
  TokenLandingCard: ({ children }: { children: ReactNode }) => <section>{children}</section>,
}));

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children }: { children?: ReactNode }) => <a href="/">{children}</a>,
  useNavigate: () => vi.fn(),
}));

const { PlayerClaimPage } = await import("./player-claim-page");

beforeEach(() => {
  deckSubmission = "none";
});

describe("PlayerClaimPage", () => {
  it("titles the page after the spot on an event without decklists", () => {
    render(<PlayerClaimPage token="claim-token" />);
    expect(screen.getByRole("heading", { name: "Claim your spot" })).toBeInTheDocument();
  });

  it("titles the page after the deck when the event takes decklists", () => {
    deckSubmission = "required";
    render(<PlayerClaimPage token="claim-token" />);
    expect(screen.getByRole("heading", { name: "Claim your deck" })).toBeInTheDocument();
  });
});
