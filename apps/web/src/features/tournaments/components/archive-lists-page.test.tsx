import type {
  ArchiveListParticipant,
  ArchiveListStateResponse,
} from "@openrift/shared/types/api/tournament";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useArchiveListsStore } from "@/features/tournaments/stores/archive-lists-store";
import { createStoreResetter } from "@/test/store-helpers";

const sendMutate = vi.fn();
const refreshMutate = vi.fn();
let state: ArchiveListStateResponse | undefined;

vi.mock("@/features/tournaments/hooks/use-tournament-archive-lists", () => ({
  useTournamentArchiveLists: () => ({ data: state }),
  useRefreshTournamentArchiveLists: () => ({ mutate: refreshMutate, isPending: false }),
  useSendTournamentArchiveLists: () => ({ mutate: sendMutate, isPending: false }),
}));

vi.mock("@/features/tournaments/hooks/use-tournaments", () => ({
  useTournamentDetail: () => ({ data: { name: "Friday Skirmish" } }),
}));

vi.mock("@tanstack/react-router", () => ({
  createLink: (component: unknown) => component,
  useNavigate: () => vi.fn(),
  Link: ({ children }: { children?: ReactNode }) => <a href="/">{children}</a>,
}));

const { ArchiveListsPage } = await import("./archive-lists-page");

function participant(
  participantId: string,
  eligibility: ArchiveListParticipant["eligibility"],
  suggestedIdentity: string | null = null,
): ArchiveListParticipant {
  return {
    participantId,
    displayName: `Player ${participantId}`,
    entryState: null,
    eligibility,
    unmatchedLines: 0,
    suggestedIdentity,
  };
}

function makeState(overrides: Partial<ArchiveListStateResponse> = {}): ArchiveListStateResponse {
  return {
    uvsgamesEventId: "667904",
    tournamentCompleted: true,
    event: {
      name: "Summoner Skirmish",
      startAt: "2026-09-12T16:00:00.000Z",
      displayStatus: "complete",
      playerCount: 16,
      storeName: "Piltover Games",
      resultsFetchedAt: "2026-09-13T08:00:00.000Z",
    },
    metaEventSlug: null,
    standings: [
      {
        identity: "u11",
        rank: 1,
        playerName: "Nova",
        wins: 4,
        losses: 0,
        draws: 0,
        sentStatus: null,
      },
      {
        identity: "u12",
        rank: 2,
        playerName: "Jinx",
        wins: 3,
        losses: 1,
        draws: 0,
        sentStatus: "pending",
      },
    ],
    participants: [
      participant("a", "ready", "u11"),
      participant("b", "unchecked", "u12"),
      participant("c", "no_consent"),
    ],
    ...overrides,
  };
}

let resetStore: () => void;

beforeEach(() => {
  resetStore = createStoreResetter(useArchiveListsStore);
  sendMutate.mockReset();
  refreshMutate.mockReset();
  state = makeState();
});

afterEach(() => {
  resetStore();
});

describe("ArchiveListsPage", () => {
  it("asks for a link when no UVS Games event is linked", () => {
    state = makeState({ uvsgamesEventId: null, event: null });
    render(<ArchiveListsPage tournamentId="t-1" />);

    expect(screen.getByText("This tournament has no UVS Games event linked.")).toBeInTheDocument();
  });

  it("waits for the tournament to end", () => {
    state = makeState({ tournamentCompleted: false });
    render(<ArchiveListsPage tournamentId="t-1" />);

    expect(
      screen.getByText("You can send lists once the tournament has ended."),
    ).toBeInTheDocument();
  });

  it("offers to load the standings before they are mirrored", async () => {
    state = makeState({ event: null, standings: [] });
    const user = userEvent.setup();
    render(<ArchiveListsPage tournamentId="t-1" />);

    await user.click(screen.getByRole("button", { name: "Load standings from UVS Games" }));

    expect(refreshMutate).toHaveBeenCalledTimes(1);
  });

  it("holds sending until UVS Games publishes final standings", () => {
    const base = makeState();
    state = makeState({ event: base.event && { ...base.event, displayStatus: "inProgress" } });
    render(<ArchiveListsPage tournamentId="t-1" />);

    expect(
      screen.getByText("UVS Games has not published the final standings for this event yet."),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Send/u })).not.toBeInTheDocument();
  });

  it("shows why a list is left out and offers no standing for it", () => {
    render(<ArchiveListsPage tournamentId="t-1" />);

    expect(screen.getByText("Didn't agree to publishing")).toBeInTheDocument();
    expect(screen.getAllByRole("combobox")).toHaveLength(2);
    expect(screen.getByText("2 lists will not be sent", { exact: false })).toBeInTheDocument();
  });

  it("sends the ready list under its suggested standing", async () => {
    const user = userEvent.setup();
    render(<ArchiveListsPage tournamentId="t-1" />);

    await user.click(screen.getByRole("button", { name: "Send 1 list" }));

    expect(sendMutate).toHaveBeenCalledWith(
      [{ participantId: "a", identity: "u11", force: false }],
      expect.anything(),
    );
  });

  it("adds an unchecked list once the organizer sends it anyway", async () => {
    const user = userEvent.setup();
    render(<ArchiveListsPage tournamentId="t-1" />);

    await user.click(screen.getByRole("checkbox", { name: "Send anyway" }));
    await user.click(screen.getByRole("button", { name: "Send 2 lists" }));

    expect(sendMutate).toHaveBeenCalledWith(
      [
        { participantId: "a", identity: "u11", force: false },
        { participantId: "b", identity: "u12", force: true },
      ],
      expect.anything(),
    );
  });

  it("blocks sending while two players share a standing", async () => {
    state = makeState({
      participants: [participant("a", "ready", "u11"), participant("b", "ready", "u11")],
    });
    render(<ArchiveListsPage tournamentId="t-1" />);

    expect(
      screen.getByText("Two players share a standing. Each standing takes one list."),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Send 2 lists" })).toBeDisabled();
  });
});
