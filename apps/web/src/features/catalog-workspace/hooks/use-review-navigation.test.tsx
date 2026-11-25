import type { ReviewCard } from "@openrift/shared/contracts/admin/catalog-workspace";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { createElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { adminKeys } from "@/features/admin/lib/admin-query-keys";
import type { ReviewTrail } from "@/features/catalog-workspace/lib/review-stops";
import { useWorkspaceActionsStore } from "@/features/catalog-workspace/stores/workspace-actions-store";
import { createStoreResetter } from "@/test/store-helpers";

const PATH = "/admin/workspace/faces/vi/face-1";

const router = vi.hoisted(() => ({
  navigate: vi.fn(),
  latestPath: "",
  search: {} as Record<string, unknown>,
  access: { isAdmin: true, sections: [] as string[] },
}));

vi.mock("@/features/admin/hooks/use-admin", () => ({
  useAdminAccess: () => ({ data: router.access }),
}));

vi.mock("@tanstack/react-router", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  useNavigate: () => router.navigate,
  useRouter: () => ({ latestLocation: { pathname: router.latestPath } }),
  useRouterState: () => PATH,
  useSearch: () => router.search,
}));

const { useReviewNavigation } = await import("./use-card-pass");

function reviewCard(key: string): ReviewCard {
  return {
    key,
    cardSlug: key.startsWith("new:") ? null : key,
    cardName: key,
    hasContribution: false,
    providers: [],
    waitingSince: "2026-11-20T09:00:00.000Z",
    pending: {
      cardFields: ["might"],
      newPrintings: 0,
      faces: 0,
      printings: 0,
      newImages: 0,
      failedImages: 0,
    },
  };
}

let queryClient: QueryClient;
let resetActions: () => void;

function render(key: string, trail?: ReviewTrail) {
  const wrapper = ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children);
  return renderHook(() => useReviewNavigation(key, trail), { wrapper });
}

beforeEach(() => {
  queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  queryClient.setQueryData(adminKeys.workspaceReview, {
    cards: [reviewCard("vi"), reviewCard("new:teemo"), reviewCard("jinx")],
  });
  resetActions = createStoreResetter(useWorkspaceActionsStore);
  router.navigate.mockClear();
  router.latestPath = PATH;
  router.search = {};
  router.access = { isAdmin: true, sections: [] };
});

afterEach(() => {
  resetActions();
});

describe("useReviewNavigation", () => {
  const trail: ReviewTrail = { cardSlug: "vi", queue: "review", q: "vi", cardIndex: 0 };

  it("opens a new card's own page from a stop and keeps the segment and search", () => {
    const invalidate = vi.spyOn(queryClient, "invalidateQueries");
    const { result } = render("vi", trail);

    act(() => result.current.advance(null, trail));

    expect(router.navigate).toHaveBeenCalledExactlyOnceWith({
      to: "/admin/workspace/cards/new/$name",
      params: { name: "teemo" },
      search: { queue: "review", q: "vi" },
    });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: adminKeys.workspaceReview });
  });

  it("opens the card's next stop with the trail", () => {
    const { result } = render("vi", trail);

    act(() => result.current.advance({ kind: "printing", printingId: "printing-2" }, trail));

    expect(router.navigate).toHaveBeenCalledExactlyOnceWith({
      to: "/admin/workspace/printings/$printingId",
      params: { printingId: "printing-2" },
      state: { workspaceReview: trail },
    });
  });

  it("walks the review cards when a non-admin opens an admin segment", () => {
    router.search = { queue: "listings" };
    router.access = { isAdmin: false, sections: ["card-review"] };
    const { result } = render("vi");

    expect(result.current.position).toEqual({ index: 0, total: 3 });
  });

  it("stays put when the admin already moved on", () => {
    router.latestPath = "/admin/workspace/cards";
    const { result } = render("vi", trail);

    act(() => result.current.advance(null, trail));
    act(() => result.current.advance({ kind: "printing", printingId: "printing-2" }, trail));

    expect(router.navigate).not.toHaveBeenCalled();
  });

  it("walks the listing cards in the Listings segment", () => {
    router.search = { queue: "listings" };
    queryClient.setQueryData(adminKeys.workspaceListings, {
      cards: [{ cardSlug: "ahri" }, { cardSlug: "lux" }],
      noCardCount: 0,
    });
    const { result } = render("ahri");

    expect(result.current.position).toEqual({ index: 0, total: 2 });
    act(() => result.current.goNext());

    expect(router.navigate).toHaveBeenCalledExactlyOnceWith({
      to: "/admin/workspace/cards/$cardSlug",
      params: { cardSlug: "lux" },
      search: true,
      hash: "listings",
    });
  });
});
