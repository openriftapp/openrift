import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/features/cards/components/search-alternative-hint", () => ({
  SearchAlternativeHint: () => <p>alternative hint</p>,
}));

import { CardViewerEmptyState } from "./card-viewer-empty-state";

describe("CardViewerEmptyState", () => {
  it("shows an empty source as empty, not as a failed load", () => {
    render(<CardViewerEmptyState totalItems={0} />);

    expect(screen.getByText("No cards found")).toBeInTheDocument();
    expect(screen.queryByText("Couldn't load cards")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Retry" })).not.toBeInTheDocument();
    expect(screen.queryByText("Try adjusting your filters.")).not.toBeInTheDocument();
  });

  it("points at the filters when they excluded every item", () => {
    render(<CardViewerEmptyState totalItems={12} />);

    expect(screen.getByText("No cards found")).toBeInTheDocument();
    expect(screen.getByText("Try adjusting your filters.")).toBeInTheDocument();
    expect(screen.getByText("alternative hint")).toBeInTheDocument();
  });

  it("uses the surface's own no-results description", () => {
    render(<CardViewerEmptyState totalItems={12} noResultsDescription="Nothing wanted here." />);

    expect(screen.getByText("Nothing wanted here.")).toBeInTheDocument();
  });
});
