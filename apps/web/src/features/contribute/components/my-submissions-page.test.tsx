import type { CardSubmissionStatusResponse } from "@openrift/shared/contracts/card-submissions";
import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@tanstack/react-router", () => ({
  Link: ({ to, children, className }: { to: string; children: ReactNode; className?: string }) => (
    <a href={to} className={className}>
      {children}
    </a>
  ),
}));

vi.mock("@/components/layout/page-top-bar", () => ({
  PageDescription: ({ children }: { children: ReactNode }) => <p>{children}</p>,
  PageTopBar: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  PageTopBarActions: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  PageTopBarBack: () => null,
  PageTopBarSticky: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  PageTopBarTitle: ({ children }: { children: ReactNode }) => <h1>{children}</h1>,
}));

const state = vi.hoisted(() => ({ items: [] as CardSubmissionStatusResponse[] }));

vi.mock("@/features/contribute/hooks/use-card-submissions", () => ({
  useCardSubmissions: () => ({
    data: { pages: [{ items: state.items, nextCursor: null }] },
    isPending: false,
    hasNextPage: false,
    isFetchingNextPage: false,
    fetchNextPage: vi.fn(),
  }),
}));

import { MySubmissionsPage } from "@/features/contribute/components/my-submissions-page";

function submission(
  overrides: Partial<CardSubmissionStatusResponse>,
): CardSubmissionStatusResponse {
  return {
    id: "s-1",
    kind: "correction",
    cardName: "Jinx, Loose Cannon",
    cardSlug: null,
    status: "rejected",
    note: null,
    reason: null,
    resolutionNote: null,
    createdAt: "2026-11-01T10:00:00.000Z",
    resolvedAt: "2026-11-02T10:00:00.000Z",
    ...overrides,
  };
}

describe("MySubmissionsPage", () => {
  it("shows the reason and the reviewer's note together", () => {
    state.items = [submission({ reason: "duplicate", resolutionNote: "It went in last week." })];
    render(<MySubmissionsPage />);

    expect(screen.getByText("Someone had already sent this one in.")).toBeInTheDocument();
    expect(screen.getByText("It went in last week.")).toBeInTheDocument();
  });

  it("shows a neutral line for a rejection that has no reason", () => {
    state.items = [submission({})];
    render(<MySubmissionsPage />);

    expect(
      screen.getByText("We did not use this one. Thank you for sending it in."),
    ).toBeInTheDocument();
  });
});
