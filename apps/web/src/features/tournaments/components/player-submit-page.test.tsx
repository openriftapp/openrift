import type { DeckCheckSubmissionPageResponse } from "@openrift/shared/types/api/deck-check";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const submissionPage = vi.fn<() => { data: unknown; isPending: boolean; isError: boolean }>();
const idleMutation = () => ({
  mutate: vi.fn(),
  mutateAsync: vi.fn(),
  isPending: false,
  error: null,
});

vi.mock("@/features/tournaments/hooks/use-deck-check-player", () => ({
  useTournamentSubmissionPage: () => submissionPage(),
  useSubmitTournamentDeck: idleMutation,
  usePreviewTournamentDeck: idleMutation,
}));

vi.mock("@/features/tournaments/components/player-deck-source-form", () => ({
  PlayerDeckSourceForm: () => <form aria-label="Deck source" />,
}));

vi.mock("@/hooks/use-enums", () => ({
  useDeckFormatList: () => ({ labels: {} }),
}));

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => vi.fn(),
}));

const { PlayerSubmitDeckSection } = await import("./player-submit-page");

function page(overrides: Partial<DeckCheckSubmissionPageResponse>) {
  return {
    eventName: "Summoner Skirmish",
    eventDate: null,
    groupName: "Noxus Locals",
    format: null,
    allowedSets: null,
    submissionsCloseAt: null,
    submissionsOpen: true,
    leftEvent: false,
    linkedEntry: null,
    ...overrides,
  } satisfies DeckCheckSubmissionPageResponse;
}

describe("PlayerSubmitDeckSection", () => {
  it("offers the deck form to a player still in the event", () => {
    submissionPage.mockReturnValue({ data: page({}), isPending: false, isError: false });
    render(<PlayerSubmitDeckSection token="token-1" />);

    expect(screen.getByRole("form", { name: "Deck source" })).toBeInTheDocument();
  });

  it("shows the no-longer-playing line in place of the form after leaving", () => {
    submissionPage.mockReturnValue({
      data: page({ leftEvent: true }),
      isPending: false,
      isError: false,
    });
    render(<PlayerSubmitDeckSection token="token-1" />);

    expect(screen.queryByRole("form", { name: "Deck source" })).not.toBeInTheDocument();
    expect(
      screen.getByText(
        "You're no longer playing in this event. Ask the host if you want to rejoin.",
      ),
    ).toBeInTheDocument();
  });
});
