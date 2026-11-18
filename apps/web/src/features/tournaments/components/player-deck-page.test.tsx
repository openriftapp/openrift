import type {
  DeckCheckEntryCardResponse,
  PlayerDeckCheckEntryDetailResponse,
} from "@openrift/shared/types/api/deck-check";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/hooks/use-enums", () => ({
  useDeckFormatList: () => ({ formats: [] }),
  useZoneOrder: () => ({
    zoneOrder: ["legend", "champion", "runes", "main", "sideboard"],
    zoneLabels: { legend: "Legend", champion: "Champion", runes: "Runes", main: "Main Deck" },
  }),
}));

vi.mock("@/features/cards/hooks/use-cards", () => ({
  useCards: () => ({ printingsById: {}, printingsByCardId: new Map() }),
}));

vi.mock("@/features/cards/hooks/use-card-thumbnail-display", () => ({
  useCardThumbnailDisplay: () => ({}),
}));

const createDeckMutateAsync = vi.fn<(input: unknown) => Promise<{ id: string }>>();
const saveCardsMutateAsync = vi.fn<(input: unknown) => Promise<unknown>>();

vi.mock("@/features/decks/hooks/use-decks", () => ({
  useCreateDeck: () => ({ mutateAsync: createDeckMutateAsync, isPending: false }),
  useSaveDeckCards: () => ({ mutateAsync: saveCardsMutateAsync, isPending: false }),
}));

vi.mock("@/features/tournaments/lib/deck-check-save", () => ({
  deckCardsFromCheckEntry: () => ({ cards: [{ cardId: "c-1", quantity: 1 }], skippedCount: 0 }),
}));

vi.mock("@tanstack/react-router", () => ({
  createLink: (component: unknown) => component,
  useNavigate: () => vi.fn(),
}));

const myDeck = vi.fn<() => { data: unknown; isPending: boolean; isError: boolean }>();
const idleMutation = () => ({ mutate: vi.fn(), reset: vi.fn(), isPending: false, error: null });

vi.mock("@/features/tournaments/hooks/use-deck-check-player", () => ({
  useMyTournamentDeck: () => myDeck(),
  useSubmitMyTournamentDeck: idleMutation,
  useUnlockMyTournamentDeck: idleMutation,
  useCancelUnlockRequest: idleMutation,
  useEditMyTournamentDeck: idleMutation,
  usePreviewTournamentDeck: idleMutation,
}));

vi.mock("@/features/tournaments/components/tournament-detail-frame", () => ({
  TournamentSectionFrame: ({
    actions,
    render: renderBody,
  }: {
    actions?: ReactNode;
    render: (data: unknown) => ReactNode;
  }) => (
    <>
      <div data-testid="actions">{actions}</div>
      {renderBody({})}
    </>
  ),
}));

vi.mock("@/features/tournaments/components/deck-check-entry-header", () => ({
  DeckCheckStatsSummary: () => null,
}));

const { PlayerCardGrid, PlayerDeckPage, SaveToDecksButton } = await import("./player-deck-page");

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
  } as unknown as DeckCheckEntryCardResponse;
}

describe("PlayerCardGrid", () => {
  it("orders the zones by the admin-managed zone order", () => {
    render(
      <PlayerCardGrid cards={[card("a", "main"), card("b", "runes"), card("c", "champion")]} />,
    );

    expect(
      screen.getAllByRole("heading", { level: 3 }).map((heading) => heading.textContent),
    ).toEqual(["Champion · 1", "Runes · 1", "Main Deck · 1"]);
  });
});

describe("SaveToDecksButton", () => {
  it("stays busy across both saves so a second click makes no second deck", async () => {
    createDeckMutateAsync.mockResolvedValue({ id: "deck-1" });
    saveCardsMutateAsync.mockReturnValue(new Promise(() => {}));
    const user = userEvent.setup();
    const data = {
      entry: { eventName: "Summoner Skirmish", format: "standard" },
      cards: [],
    } as unknown as PlayerDeckCheckEntryDetailResponse;
    render(<SaveToDecksButton data={data} />);

    const button = screen.getByRole("button");
    await user.click(button);
    await user.click(button);

    expect(createDeckMutateAsync).toHaveBeenCalledTimes(1);
    expect(saveCardsMutateAsync).toHaveBeenCalledTimes(1);
    expect(button).toBeDisabled();
  });
});

describe("PlayerDeckPage", () => {
  function detail(entry: Partial<PlayerDeckCheckEntryDetailResponse["entry"]>) {
    return {
      entry: {
        id: "entry-1",
        eventName: "Summoner Skirmish",
        eventDate: null,
        groupName: null,
        format: "constructed",
        allowedSets: null,
        state: "editable",
        reviewOutcome: null,
        unlockRequested: false,
        playerMessage: null,
        allowDeckPublishing: true,
        allowNameSharing: true,
        allowRiotIdSharing: true,
        submittedAt: null,
        submissionsCloseAt: null,
        updatedAt: "2026-06-01T00:00:00.000Z",
        windowOpen: true,
        leftEvent: false,
        canEdit: true,
        canUnlock: false,
        canRequestUnlock: false,
        ...entry,
      },
      cards: [],
      violations: [],
      typeCounts: [],
      domainDistribution: [],
    } satisfies PlayerDeckCheckEntryDetailResponse;
  }

  it("offers replace and submit while the player is still in the event", () => {
    myDeck.mockReturnValue({ data: detail({}), isPending: false, isError: false });
    render(<PlayerDeckPage tournamentId="t-1" />);

    expect(screen.getByRole("button", { name: "Replace deck" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Submit for review" })).toBeInTheDocument();
  });

  it("offers no cancel for a pending unlock request once the player left the event", () => {
    myDeck.mockReturnValue({
      data: detail({ leftEvent: true, canEdit: false, state: "approved", unlockRequested: true }),
      isPending: false,
      isError: false,
    });
    render(<PlayerDeckPage tournamentId="t-1" />);

    expect(screen.queryByRole("button", { name: "Cancel unlock request" })).not.toBeInTheDocument();
  });

  it("hides replace and submit and says so once the player left the event", () => {
    myDeck.mockReturnValue({
      data: detail({ leftEvent: true, canEdit: false }),
      isPending: false,
      isError: false,
    });
    render(<PlayerDeckPage tournamentId="t-1" />);

    expect(screen.queryByRole("button", { name: "Replace deck" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Submit for review" })).not.toBeInTheDocument();
    expect(
      screen.getByText(
        "You're no longer playing in this event. Ask the host if you want to rejoin.",
      ),
    ).toBeInTheDocument();
  });
});
