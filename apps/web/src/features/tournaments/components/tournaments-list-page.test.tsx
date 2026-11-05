import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

let items: { id: string }[] = [];

vi.mock("@/features/tournaments/hooks/use-tournaments", () => ({
  useTournaments: () => ({ data: { items } }),
}));

vi.mock("@/features/tournaments/components/tournaments-overview", () => ({
  TournamentsOverview: () => <div>overview</div>,
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
  });

  it("shows only the empty state's create button when there are no tournaments", () => {
    render(<TournamentsListPage />);
    expect(screen.getAllByRole("link", { name: /new tournament/iu })).toHaveLength(1);
    expect(screen.queryByText("overview")).not.toBeInTheDocument();
  });

  it("shows the header create button once a tournament exists", () => {
    items = [{ id: "t-1" }];
    render(<TournamentsListPage />);
    expect(screen.getAllByRole("link", { name: /new tournament/iu })).toHaveLength(1);
    expect(screen.getByText("overview")).toBeInTheDocument();
  });
});
