import type { TournamentSummaryResponse } from "@openrift/shared/types/api/tournament";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/features/tournaments/components/next-event-hero", () => ({
  NextEventHero: ({ tournament }: { tournament: TournamentSummaryResponse }) => (
    <div>hero {tournament.id}</div>
  ),
}));

vi.mock("@/features/tournaments/components/past-events-timeline", () => ({
  PastEventsTimeline: ({ tournaments }: { tournaments: TournamentSummaryResponse[] }) => (
    <div>past {tournaments.map((tournament) => tournament.id).join(",")}</div>
  ),
}));

vi.mock("@/features/tournaments/components/tournament-card", () => ({
  TournamentCard: () => null,
}));

const { TournamentsOverview } = await import("./tournaments-overview");

function makeTournament(id: string, status: TournamentSummaryResponse["status"], startsAt: string) {
  return { id, status, startsAt, endsAt: null } as TournamentSummaryResponse;
}

const items = [
  makeTournament("next", "setup", "2099-01-01T12:00:00Z"),
  makeTournament("done-1", "completed", "2025-05-01T12:00:00Z"),
  makeTournament("done-2", "completed", "2025-04-01T12:00:00Z"),
];

describe("TournamentsOverview", () => {
  it("counts the loaded past events when there is no paging", () => {
    render(<TournamentsOverview tournaments={items} noUpcomingText="none" />);

    expect(screen.getByText("hero next")).toBeInTheDocument();
    expect(screen.getByText("past done-1,done-2")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /past events\s*2/iu })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /show older events/iu })).not.toBeInTheDocument();
  });

  it("shows the server's past total and loads older events while more are left", async () => {
    const onLoadMore = vi.fn();
    render(
      <TournamentsOverview
        tournaments={items}
        noUpcomingText="none"
        pastPaging={{ total: 9, hasMore: true, loadingMore: false, onLoadMore }}
      />,
    );

    expect(screen.getByRole("heading", { name: /past events\s*9/iu })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /show older events/iu }));
    expect(onLoadMore).toHaveBeenCalledTimes(1);
  });

  it("drops the button once the last page is loaded", () => {
    render(
      <TournamentsOverview
        tournaments={items}
        noUpcomingText="none"
        pastPaging={{ total: 2, hasMore: false, loadingMore: false, onLoadMore: vi.fn() }}
      />,
    );

    expect(screen.queryByRole("button", { name: /show older events/iu })).not.toBeInTheDocument();
  });
});
