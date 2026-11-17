import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { workspaceQueueFixture } from "@/features/catalog-workspace/lib/workspace-queue.fixture";
import { useWorkspaceActionsStore } from "@/features/catalog-workspace/stores/workspace-actions-store";
import { createStoreResetter } from "@/test/store-helpers";

const mutation = { isPending: false, mutateAsync: vi.fn() };
const detailQuery = vi.hoisted(() => ({
  current: { data: undefined, isLoading: true, isError: false, error: null } as object,
}));

const queuedNames = vi.hoisted(() => ({ current: ["ahri nine tailed fox"] }));

vi.mock("@/features/catalog-workspace/lib/workspace-queries", () => ({
  workspaceQueueQueryOptions: () => ({
    queryKey: ["admin", "workspace", "queue", "all"],
    queryFn: () => ({
      ...workspaceQueueFixture,
      items: workspaceQueueFixture.items.filter(
        (item) => item.owner !== "card" || queuedNames.current.includes(item.ownerId),
      ),
    }),
  }),
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
  queuedNames.current = ["ahri nine tailed fox"];
});

describe("NewCardRecord", () => {
  it("registers as loading while the card's sources load", () => {
    render(
      <QueryClientProvider client={new QueryClient()}>
        <NewCardRecord name="ahri nine tailed fox" />
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
        <NewCardRecord name="ahri nine tailed fox" />
      </QueryClientProvider>,
    );

    expect(screen.getByRole("alert").textContent).toBe("Network down");
    expect(useWorkspaceActionsStore.getState().actions?.loading).toBe(false);
  });

  it("says an ignored or accepted card is not in the queue and offers no accept form", async () => {
    queuedNames.current = [];
    render(
      <QueryClientProvider client={new QueryClient()}>
        <NewCardRecord name="ahri nine tailed fox" />
      </QueryClientProvider>,
    );

    expect(await screen.findByText(/not in the queue any more/u)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Accept as new card/u })).toBeNull();
    await waitFor(() => expect(useWorkspaceActionsStore.getState().actions).toEqual({}));
  });
});
