import type { ReviewCard } from "@openrift/shared/contracts/admin/catalog-workspace";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import { adminKeys } from "@/features/admin/lib/admin-query-keys";

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children }: { children: ReactNode }) => <a href="/admin/workspace/cards">{children}</a>,
}));
vi.mock("@/features/admin/hooks/use-admin", () => ({
  useAdminAccess: () => ({ data: { isAdmin: true } }),
}));
vi.mock("@/features/admin/lib/admin-sections", () => ({ hasAdminSection: () => true }));

const { CatalogWorkTile } = await import("./catalog-work-tile");

function reviewCard(key: string, pending: Partial<ReviewCard["pending"]>): ReviewCard {
  return {
    key,
    cardSlug: key,
    cardName: key,
    hasContribution: false,
    providers: [],
    waitingSince: "2026-11-20T09:00:00.000Z",
    pending: {
      cardFields: [],
      newPrintings: 0,
      faces: 0,
      printings: 0,
      newImages: 0,
      failedImages: 0,
      ...pending,
    },
  };
}

describe("CatalogWorkTile", () => {
  it("counts the cards the review list it opens shows", () => {
    const client = new QueryClient();
    client.setQueryData(adminKeys.workspaceReview, {
      cards: [reviewCard("vi", { faces: 1 }), reviewCard("jinx", { newImages: 2 })],
    });
    render(
      <QueryClientProvider client={client}>
        <CatalogWorkTile />
      </QueryClientProvider>,
    );

    expect(screen.getByText("1")).toBeVisible();
  });
});
