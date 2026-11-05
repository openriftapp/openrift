import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

let tierLists: Record<string, unknown>[] = [];

vi.mock("@/features/stage/hooks/use-tier-lists", () => ({
  useTierLists: () => ({ data: tierLists }),
  useDeleteTierList: () => ({ mutate: vi.fn(), isPending: false }),
}));

vi.mock("@/features/cards/hooks/use-cards", () => ({
  useCards: () => ({ cardsById: new Map(), printingsByCardId: new Map() }),
}));

vi.mock("@/features/stage/components/create-tier-list-dialog", () => ({
  CreateTierListDialog: () => null,
}));

vi.mock("@/features/stage/components/tier-list-share-dialog", () => ({
  TierListShareDialog: () => null,
}));

vi.mock("@tanstack/react-router", () => ({
  createLink: (component: unknown) => component,
  Link: ({ children }: { children?: ReactNode }) => <a href="/">{children}</a>,
}));

const { TierListIndexPage } = await import("./tier-list-index-page");

describe("TierListIndexPage", () => {
  beforeEach(() => {
    tierLists = [];
  });

  it("shows only the empty state's create button when there are no tier lists", () => {
    render(<TierListIndexPage />);
    expect(screen.getAllByRole("button", { name: /new tier list/iu })).toHaveLength(1);
  });

  it("shows the header create button once a tier list exists", () => {
    tierLists = [
      {
        id: "tl-1",
        title: "My list",
        cardCount: 0,
        tierCount: 0,
        updatedAt: "2026-01-01T00:00:00.000Z",
        isPublic: false,
        shareToken: null,
        previewRows: [],
      },
    ];
    render(<TierListIndexPage />);
    expect(screen.getAllByRole("button", { name: /new tier list/iu })).toHaveLength(1);
    expect(screen.getByText("My list")).toBeInTheDocument();
  });
});
