import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

let items: { id: string }[] = [];
let olderPage: { id: string }[] | null = null;
const fetchNextPage = vi.fn();

vi.mock("@/features/tournaments/hooks/use-tournaments", () => ({
  useTournaments: () => ({
    data: {
      pages: [
        { items, nextCursor: olderPage ? "cursor" : null, pastCount: 5 },
        ...(olderPage ? [{ items: olderPage, nextCursor: null, pastCount: 5 }] : []),
      ],
    },
    hasNextPage: olderPage !== null,
    isFetchingNextPage: false,
    fetchNextPage,
  }),
}));

vi.mock("@/features/tournaments/components/tournaments-overview", () => ({
  TournamentsOverview: ({
    tournaments,
    pastPaging,
  }: {
    tournaments: { id: string }[];
    pastPaging?: { total: number; hasMore: boolean; onLoadMore: () => void };
  }) => (
    <div>
      overview {tournaments.map((tournament) => tournament.id).join(",")} total {pastPaging?.total}{" "}
      more {String(pastPaging?.hasMore)}
    </div>
  ),
}));

vi.mock("@tanstack/react-router", () => ({
  createLink: (component: unknown) => component,
  Link: ({ children, className }: { children?: ReactNode; className?: string }) => (
    <a href="/" className={className}>
      {children}
    </a>
  ),
}));

const { TournamentsListPage } = await import("./tournaments-list-page");

describe("TournamentsListPage", () => {
  beforeEach(() => {
    items = [];
    olderPage = null;
  });

  it("hands every loaded page and the past paging state to the overview", () => {
    items = [{ id: "t-1" }];
    olderPage = [{ id: "t-2" }];
    render(<TournamentsListPage />);
    expect(screen.getByText(/overview t-1,t-2 total 5 more true/u)).toBeInTheDocument();
  });

  it("shows only the empty state's create button when there are no tournaments", () => {
    render(<TournamentsListPage />);
    expect(screen.getAllByRole("link", { name: /new tournament/iu })).toHaveLength(1);
    expect(screen.queryByText(/overview/u)).not.toBeInTheDocument();
  });

  it("shows the header create button once a tournament exists", () => {
    items = [{ id: "t-1" }];
    render(<TournamentsListPage />);
    expect(screen.getAllByRole("link", { name: /new tournament/iu })).toHaveLength(1);
    expect(screen.getByText(/overview t-1/u)).toBeInTheDocument();
  });
});
