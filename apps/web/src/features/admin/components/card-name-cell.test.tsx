import type { CandidateCardSummaryResponse } from "@openrift/shared/types/api/admin";
import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@tanstack/react-router", () => ({
  Link: ({
    to,
    params,
    children,
    className,
  }: {
    to: string;
    params?: Record<string, string>;
    children: ReactNode;
    className?: string;
  }) => {
    let path = to;
    if (params) {
      for (const [key, value] of Object.entries(params)) {
        path = path.replace(`$${key}`, value);
      }
    }
    return (
      <a href={path} className={className}>
        {children}
      </a>
    );
  },
}));

// oxlint-disable-next-line import/first -- must import after vi.mock
import { CardNameCell } from "./card-name-cell";

function makeRow(overrides: Partial<CandidateCardSummaryResponse> = {}) {
  return {
    cardSlug: null,
    name: "New Card",
    normalizedName: "newcard",
    shortCodes: [],
    stagingShortCodes: [],
    setSlugs: [],
    candidateCount: 1,
    uncheckedCardCount: 0,
    uncheckedPrintingCount: 0,
    unlinkedPrintingCount: 0,
    unlinkedTrustedPrintingCount: 0,
    hasFavorite: false,
    favoriteStagingShortCodes: [],
    suggestedCardSlug: null,
    hasUserSubmission: false,
    pendingSubmissions: 0,
    uncheckedTrustedProviders: [],
    updatedAt: "2026-09-01T00:00:00.000Z",
    ...overrides,
  } as CandidateCardSummaryResponse;
}

describe("CardNameCell", () => {
  it("links an unmatched row to the new-card route by normalized name", () => {
    render(<CardNameCell row={makeRow()} />);
    expect(screen.getByRole("link")).toHaveAttribute("href", "/admin/cards/new/newcard");
  });

  it("links a matched row to the card detail route", () => {
    render(<CardNameCell row={makeRow({ cardSlug: "fireball" })} />);
    expect(screen.getByRole("link")).toHaveAttribute("href", "/admin/cards/fireball");
  });

  it("keeps a non-Latin name linkable", () => {
    render(<CardNameCell row={makeRow({ name: "影流之主", normalizedName: "影流之主" })} />);
    expect(screen.getByRole("link")).toHaveAttribute("href", "/admin/cards/new/影流之主");
  });

  it("renders a name that normalizes to nothing as text instead of a link", () => {
    render(<CardNameCell row={makeRow({ name: "!?!", normalizedName: "" })} />);
    expect(screen.queryByRole("link")).toBeNull();
    expect(screen.getByText("!?!")).toBeInTheDocument();
  });
});
