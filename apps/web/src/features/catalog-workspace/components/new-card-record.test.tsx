import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useWorkspaceActionsStore } from "@/features/catalog-workspace/stores/workspace-actions-store";
import { createStoreResetter } from "@/test/store-helpers";

const mutation = { isPending: false, mutateAsync: vi.fn() };
const detailQuery = vi.hoisted(() => ({
  current: { data: undefined, isLoading: true, isError: false, error: null } as object,
}));

vi.mock("@tanstack/react-router", () => ({ useNavigate: () => vi.fn() }));
vi.mock("@/components/error-message", () => ({
  RouteErrorFallback: ({ error }: { error: Error }) => <p role="alert">{error.message}</p>,
}));
vi.mock("@/features/admin/components/card-detail-shared", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  useCardDetailData: () => ({ providerSettings: [], newCardFields: [] }),
}));
vi.mock("@/features/admin/hooks/use-admin", () => ({
  useAdminAccess: () => ({ data: { isAdmin: true } }),
}));
vi.mock("@/features/admin/hooks/use-admin-card-mutations", () => ({
  useAcceptNewCard: () => mutation,
  useAcceptPrintingGroup: () => mutation,
  useLinkCard: () => mutation,
}));
vi.mock("@/features/admin/hooks/use-admin-card-queries", () => ({
  useAllCards: () => ({ data: [] }),
  useUnmatchedCardDetail: () => ({ ...detailQuery.current, refetch: vi.fn() }),
}));
vi.mock("@/features/admin/hooks/use-ignored-candidates", () => ({
  useIgnoreNewCardDrafts: () => mutation,
}));
vi.mock("@/features/cards/hooks/use-card-search", () => ({ useAdminCardSearch: () => [] }));
vi.mock("@/features/cards/lib/sets-queries", () => ({
  setsQueryOptions: { queryKey: ["sets"], queryFn: () => new Promise(() => {}) },
}));
vi.mock("@/features/catalog-workspace/hooks/use-queue-navigation", () => ({
  useQueueNavigation: () => ({ goNext: vi.fn(), skipToEnd: vi.fn() }),
}));
vi.mock("@/features/catalog-workspace/hooks/use-workspace-undo", () => ({
  useWorkspaceUndo: () => ({ announce: vi.fn() }),
}));
vi.mock("@/hooks/use-keyword-styles", () => ({ useCostKeywords: () => [] }));

const { NewCardRecord } = await import("./new-card-record");

let resetActions: () => void;

beforeEach(() => {
  resetActions = createStoreResetter(useWorkspaceActionsStore);
});

afterEach(() => {
  resetActions();
  detailQuery.current = { data: undefined, isLoading: true, isError: false, error: null };
});

describe("NewCardRecord", () => {
  it("registers as loading while the card's sources load", () => {
    render(
      <QueryClientProvider client={new QueryClient()}>
        <NewCardRecord name="Jinx, Loose Cannon" />
      </QueryClientProvider>,
    );

    expect(useWorkspaceActionsStore.getState().actions?.loading).toBe(true);
  });

  it("shows the load error and stops registering as loading when the card fails to load", () => {
    detailQuery.current = {
      data: undefined,
      isLoading: false,
      isError: true,
      error: new Error("Network down"),
    };
    render(
      <QueryClientProvider client={new QueryClient()}>
        <NewCardRecord name="Jinx, Loose Cannon" />
      </QueryClientProvider>,
    );

    expect(screen.getByRole("alert").textContent).toBe("Network down");
    expect(useWorkspaceActionsStore.getState().actions?.loading).toBe(false);
  });
});
