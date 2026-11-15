import type { PublicTournamentLandingResponse } from "@openrift/shared/types/api/tournament";
import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

let landing: PublicTournamentLandingResponse;

vi.mock("@/features/tournaments/hooks/use-tournaments", () => ({
  useTournamentSubmitLanding: () => ({ data: landing }),
}));

vi.mock("@/features/tournaments/hooks/use-tournament-mutations", () => ({
  useRequestJoinTournament: () => ({ mutateAsync: vi.fn(), isPending: false, error: null }),
}));

vi.mock("@/features/tournaments/components/player-submit-page", () => ({
  PlayerSubmitDeckSection: () => null,
}));

vi.mock("@/hooks/use-session", () => ({ useUserId: () => "user-1" }));

vi.mock("@/features/tournaments/components/token-landing-card", () => ({
  TokenLandingPage: ({ children }: { children: ReactNode }) => <main>{children}</main>,
  TokenLandingCard: ({ children }: { children: ReactNode }) => <section>{children}</section>,
}));

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children }: { children?: ReactNode }) => <a href="/">{children}</a>,
}));

const { TournamentSubmitPage } = await import("./tournament-submit-page");

beforeEach(() => {
  landing = {
    name: "Summoner Skirmish",
    hostDisplayName: "Zaun Card Hall",
    selfRegistrationOpen: true,
    deckExpected: false,
    viewerIsParticipant: false,
    viewerParticipantStatus: null,
  };
});

describe("TournamentSubmitPage", () => {
  it("offers to join an open event to someone without a spot", () => {
    render(<TournamentSubmitPage token="submit-token" />);
    expect(screen.getByRole("button", { name: "Request to join" })).toBeInTheDocument();
  });

  it.each([
    ["active", "You have a spot in this event."],
    ["invited", "You have a spot in this event."],
    ["requested", "Your request was sent. The host will review it."],
    ["dropped", "You're no longer playing in this event. Ask the host if you want to rejoin."],
    ["no_show", "You're no longer playing in this event. Ask the host if you want to rejoin."],
  ] as const)("shows a %s participant of an open event their state", (status, text) => {
    landing.viewerIsParticipant = true;
    landing.viewerParticipantStatus = status;
    render(<TournamentSubmitPage token="submit-token" />);
    expect(screen.getByText(text)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Request to join" })).not.toBeInTheDocument();
  });
});
