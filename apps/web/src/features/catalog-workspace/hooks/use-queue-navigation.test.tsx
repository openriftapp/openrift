import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { ListEntry } from "@/features/catalog-workspace/lib/owner-items";
import { workspaceQueueFixture } from "@/features/catalog-workspace/lib/workspace-queue.fixture";
import { useWorkspaceActionsStore } from "@/features/catalog-workspace/stores/workspace-actions-store";
import { createStoreResetter } from "@/test/store-helpers";

const router = vi.hoisted(() => ({
  navigate: vi.fn(),
  params: {} as Record<string, string>,
  search: {} as Record<string, unknown>,
}));

const access = vi.hoisted(() => ({
  value: { isAdmin: true, sections: [] as string[] } as { isAdmin: boolean; sections: string[] },
}));

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => router.navigate,
  useParams: () => router.params,
  useSearch: () => router.search,
}));

vi.mock("@/features/admin/hooks/use-admin", () => ({
  useAdminAccess: () => ({ data: access.value }),
}));

vi.mock("@/features/admin/hooks/use-admin-card-queries", () => ({
  useAdminCardListWhen: () => ({ data: undefined, isPending: false, error: null }),
}));

vi.mock("@/features/admin/lib/printing-desk-queries", () => ({
  deskPrintingsQueryOptions: (mode: string) => ({
    queryKey: ["desk", mode],
    queryFn: () => ({ printings: [] }),
  }),
}));

vi.mock("@/features/catalog-workspace/lib/workspace-queries", () => ({
  workspaceQueueQueryOptions: () => ({
    queryKey: ["admin", "workspace", "queue", "all"],
    queryFn: () => workspaceQueueFixture,
  }),
  workspaceRecordsQueryOptions: (input: unknown) => ({
    queryKey: ["admin", "workspace", "records", input],
    queryFn: () => ({ rows: [], nextCursor: null }),
  }),
}));

const { navigateToTarget, planQueueStep, useQueueNavigation } =
  await import("./use-queue-navigation");

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

function entry(key: string, linkable = true): ListEntry {
  return {
    key,
    title: key,
    detail: "",
    target: linkable ? { kind: "card", cardSlug: key.replace("card:", "") } : null,
  };
}

let resetActions: () => void;

beforeEach(() => {
  resetActions = createStoreResetter(useWorkspaceActionsStore);
  router.navigate.mockReset();
  router.params = {};
  router.search = {};
  access.value = { isAdmin: true, sections: [] };
});

afterEach(() => {
  resetActions();
});

describe("planQueueStep", () => {
  const entries = [entry("card:a"), entry("card:orphan", false), entry("card:b")];

  it("steps over rows without a record", () => {
    expect(planQueueStep(entries, "card:a", 1)).toEqual({
      kind: "go",
      target: { kind: "card", cardSlug: "b" },
    });
  });

  it("opens the first row when nothing is selected", () => {
    expect(planQueueStep(entries, null, 1)).toEqual({
      kind: "go",
      target: { kind: "card", cardSlug: "a" },
    });
  });

  it("wraps to the top after the last row", () => {
    expect(planQueueStep(entries, "card:b", 1)).toEqual({
      kind: "go",
      target: { kind: "card", cardSlug: "a" },
    });
  });

  it("returns to the list when the selected record was the only one", () => {
    expect(planQueueStep([entry("card:a")], "card:a", 1)).toEqual({ kind: "list" });
    expect(planQueueStep([], "card:gone", 1)).toEqual({ kind: "list" });
  });

  it("stays put moving up from the top", () => {
    expect(planQueueStep(entries, "card:a", -1)).toEqual({ kind: "stay" });
    expect(planQueueStep([], null, 1)).toEqual({ kind: "stay" });
  });
});

describe("navigateToTarget", () => {
  it("keeps the search params on every target", () => {
    const navigate = vi.fn();
    navigateToTarget(navigate as never, "face", {
      kind: "face",
      cardSlug: "jinx",
      faceId: "f1",
    });
    navigateToTarget(navigate as never, "printing", {
      kind: "printing-new",
      candidatePrintingId: "c1",
    });
    navigateToTarget(navigate as never, "card", null);
    expect(navigate.mock.calls.map((call) => call[0])).toEqual([
      {
        to: "/admin/workspace/faces/$cardSlug/$faceId",
        params: { cardSlug: "jinx", faceId: "f1" },
        search: true,
      },
      {
        to: "/admin/workspace/printings/new/$candidatePrintingId",
        params: { candidatePrintingId: "c1" },
        search: true,
      },
      { to: "/admin/workspace/cards", search: true },
    ]);
  });
});

describe("useQueueNavigation", () => {
  it("walks the open cards queue in age order", async () => {
    router.params = { cardSlug: "jinx-loose-cannon" };
    const { result } = renderHook(() => useQueueNavigation("card"), { wrapper });
    await waitFor(() => expect(result.current.position).toEqual({ index: 0, total: 2 }));

    act(() => result.current.goNext());
    expect(router.navigate).toHaveBeenCalledWith({
      to: "/admin/workspace/cards/$cardSlug",
      params: { cardSlug: "yasuo-unforgiven" },
      search: true,
    });
  });

  it("walks the New segment when the search selects it", async () => {
    router.search = { segment: "new" };
    const { result } = renderHook(() => useQueueNavigation("card"), { wrapper });
    await waitFor(() => expect(result.current.position).toBeNull());
    await waitFor(() => {
      result.current.goNext();
      expect(router.navigate).toHaveBeenCalledWith({
        to: "/admin/workspace/cards/new/$name",
        params: { name: "ahri nine tailed fox" },
        search: true,
      });
    });
  });

  it("moves a skipped record to the end and opens the next one", async () => {
    router.params = { cardSlug: "jinx-loose-cannon" };
    const { result } = renderHook(() => useQueueNavigation("card"), { wrapper });
    await waitFor(() => expect(result.current.position).not.toBeNull());

    act(() => result.current.skipToEnd());
    expect(useWorkspaceActionsStore.getState().skipped.card).toEqual(["card:jinx-loose-cannon"]);
    expect(router.navigate).toHaveBeenCalledWith({
      to: "/admin/workspace/cards/$cardSlug",
      params: { cardSlug: "yasuo-unforgiven" },
      search: true,
    });
  });

  it("does not move up past the first record", async () => {
    router.params = { cardSlug: "jinx-loose-cannon" };
    const { result } = renderHook(() => useQueueNavigation("card"), { wrapper });
    await waitFor(() => expect(result.current.position).not.toBeNull());
    act(() => result.current.goPrev());
    expect(router.navigate).not.toHaveBeenCalled();
  });

  it("does not walk the faces list for desk holders", async () => {
    access.value = { isAdmin: false, sections: ["printing-desk"] };
    router.params = {
      cardSlug: "jinx-loose-cannon",
      faceId: "0190a000-0000-7000-8000-0000000000f1",
    };
    const { result } = renderHook(() => useQueueNavigation("face"), { wrapper });
    await waitFor(() => expect(result.current.position).toBeNull());
    act(() => result.current.goNext());
    act(() => result.current.skipToEnd());
    expect(router.navigate).not.toHaveBeenCalled();
  });
});
