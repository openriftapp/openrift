import type {
  TournamentDetailResponse,
  TournamentViewerRole,
} from "@openrift/shared/types/api/tournament";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { TournamentDeckCheckTab } from "./tournament-deck-check-tab";

const NOTICE = "Deck check is for judges";

// The real entries list runs a suspense query and the ingest guide pulls in
// server wiring; stub both so we can assert which branch the tab renders.
vi.mock("@/features/tournaments/components/deck-check-event-page", () => ({
  TournamentDeckCheckEntries: () => <div>entries-list</div>,
}));
vi.mock("@/features/tournaments/components/deck-check-ingest-guide", () => ({
  DeckCheckIngestGuide: () => <div>ingest-guide</div>,
}));
vi.mock("@/features/tournaments/components/archive-lists-band", () => ({
  ArchiveListsBand: () => <div>archive-band</div>,
}));

let metaEnabled = true;
vi.mock("@/hooks/use-feature-flags", () => ({
  useFeatureEnabled: () => metaEnabled,
}));

function detailWith(
  myRoles: TournamentViewerRole[],
  overrides: Partial<TournamentDetailResponse> = {},
): TournamentDetailResponse {
  return {
    id: "tournament-1",
    deckSubmission: "required",
    host: { type: "user", id: "user-1", name: "Host" },
    myRoles,
    startsAt: "2099-01-01T10:00:00Z",
    endsAt: null,
    status: "running",
    ...overrides,
  } as unknown as TournamentDetailResponse;
}

describe("TournamentDeckCheckTab", () => {
  it("shows a notice and no entries list for a non-judge", () => {
    render(<TournamentDeckCheckTab detail={detailWith([])} />);

    expect(screen.getByText(NOTICE)).toBeInTheDocument();
    expect(screen.queryByText("entries-list")).not.toBeInTheDocument();
  });

  it("renders the entries list for a judge", () => {
    render(<TournamentDeckCheckTab detail={detailWith(["judge"])} />);

    expect(screen.getByText("entries-list")).toBeInTheDocument();
    expect(screen.queryByText(NOTICE)).not.toBeInTheDocument();
  });

  it("renders the entries list for a host or organizer", () => {
    render(<TournamentDeckCheckTab detail={detailWith(["organizer"])} />);

    expect(screen.getByText("entries-list")).toBeInTheDocument();
  });

  it("offers the Meta Archive band to an organizer once the tournament ended", () => {
    metaEnabled = true;
    render(<TournamentDeckCheckTab detail={detailWith(["organizer"], { status: "completed" })} />);

    expect(screen.getByText("archive-band")).toBeInTheDocument();
  });

  it("keeps the band away from judges, running tournaments and a switched-off archive", () => {
    metaEnabled = true;
    const { rerender } = render(
      <TournamentDeckCheckTab detail={detailWith(["judge"], { status: "completed" })} />,
    );
    expect(screen.queryByText("archive-band")).not.toBeInTheDocument();

    rerender(<TournamentDeckCheckTab detail={detailWith(["organizer"])} />);
    expect(screen.queryByText("archive-band")).not.toBeInTheDocument();

    metaEnabled = false;
    rerender(
      <TournamentDeckCheckTab detail={detailWith(["organizer"], { status: "completed" })} />,
    );
    expect(screen.queryByText("archive-band")).not.toBeInTheDocument();
  });
});
