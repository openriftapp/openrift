import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/features/cards/components/search-alternative-hint", () => ({
  SearchAlternativeHint: () => <p>alternative hint</p>,
}));

const catalogTail = vi.hoisted(() => ({
  status: "complete" as "complete" | "loading" | "failed",
  retry: vi.fn(),
}));
vi.mock("@/features/cards/hooks/use-cards", () => ({
  useCatalogTailStatus: () => catalogTail,
}));

import { CardViewerEmptyState } from "./card-viewer-empty-state";

describe("CardViewerEmptyState", () => {
  afterEach(() => {
    catalogTail.status = "complete";
    catalogTail.retry.mockClear();
  });

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
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("uses the surface's own no-results description", () => {
    render(<CardViewerEmptyState totalItems={12} noResultsDescription="Nothing wanted here." />);

    expect(screen.getByText("Nothing wanted here.")).toBeInTheDocument();
  });

  it("says other languages are still loading", () => {
    catalogTail.status = "loading";
    render(<CardViewerEmptyState totalItems={0} />);

    expect(screen.getByRole("status")).toHaveTextContent(
      "Other languages are still loading, so some cards may be missing.",
    );
  });

  it("offers a retry when the other languages failed to load", async () => {
    catalogTail.status = "failed";
    render(<CardViewerEmptyState totalItems={12} />);

    expect(screen.getByRole("status")).toHaveTextContent("Couldn't load the other languages");
    await userEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(catalogTail.retry).toHaveBeenCalledTimes(1);
  });
});
