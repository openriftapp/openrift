import type { CandidateCardSummaryResponse } from "@openrift/shared/types/api/admin";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const linkCard = { mutate: vi.fn(), isPending: false };
const acceptFavorite = { mutate: vi.fn(), isPending: false };
const toast = vi.hoisted(() => ({
  success: vi.fn(),
  warning: vi.fn(),
  error: vi.fn(),
  info: vi.fn(),
}));

vi.mock("sonner", () => ({ toast }));

vi.mock("@/features/admin/hooks/use-admin-card-mutations", () => ({
  useLinkCard: () => linkCard,
  useAcceptFavoriteNewCard: () => acceptFavorite,
}));

vi.mock("@/features/admin/components/assign-button", () => ({
  AssignButton: () => (
    <button type="button" aria-label="Assign to another card">
      search
    </button>
  ),
}));

import { DraftRowActions } from "./draft-row-actions";

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

const ALL_CARDS = [
  { id: "card-1", slug: "some-card", name: "Some Card", types: [], shortCodes: [] },
];

describe("DraftRowActions", () => {
  it("offers the suggested card, accept and the picker", () => {
    render(
      <DraftRowActions
        row={makeRow({ hasFavorite: true, suggestedCardSlug: "some-card" })}
        allCards={ALL_CARDS}
      />,
    );

    expect(screen.getByRole("button", { name: "Assign to some-card" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Accept as a new card" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Assign to another card" })).toBeInTheDocument();
  });

  it("renders nothing when the name normalizes to no lookup key", () => {
    const { container } = render(
      <DraftRowActions
        row={makeRow({ name: "!?!", normalizedName: "", hasFavorite: true })}
        allCards={ALL_CARDS}
      />,
    );

    expect(container).toBeEmptyDOMElement();
  });

  it("leaves accept off a draft no trusted source proposed", () => {
    render(<DraftRowActions row={makeRow()} allCards={ALL_CARDS} />);

    expect(screen.queryByRole("button", { name: "Accept as a new card" })).toBeNull();
  });

  it("reports the printings an accept skipped, with why", () => {
    acceptFavorite.mutate.mockImplementation((_name, options) =>
      options.onSuccess({
        cardSlug: "new-card",
        printingsCreated: 1,
        skipped: [{ shortCode: "OGN-002", reason: "missing: artist" }],
      }),
    );
    render(<DraftRowActions row={makeRow({ hasFavorite: true })} allCards={ALL_CARDS} />);

    fireEvent.click(screen.getByRole("button", { name: "Accept as a new card" }));

    expect(toast.warning).toHaveBeenCalledWith(
      "Created new-card. Accepted 1 printing, skipped 1: OGN-002 (missing: artist)",
    );
  });
});
