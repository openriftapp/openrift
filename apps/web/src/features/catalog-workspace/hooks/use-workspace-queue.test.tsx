import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { workspaceQueueFixture } from "@/features/catalog-workspace/lib/workspace-queue.fixture";
import { useWorkspaceSkipStore } from "@/features/catalog-workspace/stores/workspace-skip-store";
import { createStoreResetter } from "@/test/store-helpers";

const state = vi.hoisted(() => ({
  search: {} as Record<string, unknown>,
  access: { isAdmin: true, sections: [] as string[] },
  queue: null as unknown,
  queueError: null as Error | null,
  recordsInputs: [] as unknown[],
  deskModes: [] as string[],
}));

vi.mock("@tanstack/react-router", () => ({
  useSearch: () => state.search,
}));

vi.mock("@/features/admin/hooks/use-admin", () => ({
  useAdminAccess: () => ({ data: state.access }),
}));

vi.mock("@/features/admin/hooks/use-admin-card-queries", () => ({
  useAdminCardListWhen: (enabled: boolean) => ({
    data: enabled
      ? [
          {
            cardSlug: "yasuo-unforgiven",
            name: "Yasuo, Unforgiven",
            normalizedName: "yasuo unforgiven",
            shortCodes: ["OGN-205"],
            stagingShortCodes: [],
            setSlugs: ["origins"],
            uncheckedCardCount: 0,
            uncheckedPrintingCount: 0,
            pendingSubmissions: 0,
          },
          {
            cardSlug: "ahri-alluring",
            name: "Ahri, Alluring",
            normalizedName: "ahri alluring",
            shortCodes: ["OGN-066"],
            stagingShortCodes: [],
            setSlugs: ["origins"],
            uncheckedCardCount: 1,
            uncheckedPrintingCount: 0,
            pendingSubmissions: 0,
          },
        ]
      : undefined,
    isPending: false,
    error: null,
  }),
}));

vi.mock("@/features/admin/lib/printing-desk-queries", () => ({
  deskPrintingsQueryOptions: (mode: string) => ({
    queryKey: ["desk", mode],
    queryFn: () => {
      state.deskModes.push(mode);
      return { printings: [] };
    },
  }),
}));

vi.mock("@/features/catalog-workspace/lib/workspace-queries", () => ({
  workspaceQueueQueryOptions: () => ({
    queryKey: ["admin", "workspace", "queue", "all"],
    queryFn: () => {
      if (state.queueError) {
        throw state.queueError;
      }
      return state.queue;
    },
  }),
  workspaceRecordsInfiniteQueryOptions: (input: object) => ({
    queryKey: ["admin", "workspace", "records", "infinite", input],
    queryFn: ({ pageParam }: { pageParam?: string }) => {
      state.recordsInputs.push({ ...input, cursor: pageParam });
      const id = pageParam === undefined ? "f1" : "f2";
      return {
        rows: [
          {
            id,
            cardSlug: "jinx-loose-cannon",
            cardName: "Jinx, Loose Cannon",
            setName: "Origins",
            shortCode: "OGN-030",
            language: "en",
            finish: "normal",
            imageUrl: null,
            updatedAt: "2026-10-20T10:00:00.000Z",
          },
        ],
        nextCursor: pageParam === undefined ? "next" : null,
      };
    },
    initialPageParam: undefined,
    getNextPageParam: (last: { nextCursor: string | null }) => last.nextCursor ?? undefined,
  }),
}));

const { resolveView, useWorkspaceQueue, useWorkspaceRecords } =
  await import("./use-workspace-queue");

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

let resetSkips: () => void;

beforeEach(() => {
  resetSkips = createStoreResetter(useWorkspaceSkipStore);
  state.search = {};
  state.access = { isAdmin: true, sections: [] };
  state.queue = workspaceQueueFixture;
  state.queueError = null;
  state.recordsInputs = [];
  state.deskModes = [];
});

afterEach(() => {
  resetSkips();
});

describe("resolveView", () => {
  it("defaults to Open and keeps New and All", () => {
    expect(resolveView("card", "admin", undefined)).toBe("open");
    expect(resolveView("card", "admin", "new")).toBe("new");
    expect(resolveView("printing", "reviewer", "all")).toBe("all");
  });

  it("has no New segment for faces", () => {
    expect(resolveView("face", "admin", "new")).toBe("open");
  });

  it("shows desk holders the full list only", () => {
    expect(resolveView("printing", "desk", "open")).toBe("all");
  });
});

describe("useWorkspaceQueue", () => {
  it("groups the open cards with stats for the header", async () => {
    const { result } = renderHook(() => useWorkspaceQueue("card"), { wrapper });
    await waitFor(() => expect(result.current.isPending).toBe(false));
    expect(result.current.view).toBe("open");
    expect(result.current.entries.map((entry) => entry.key)).toEqual([
      "card:jinx-loose-cannon",
      "card:yasuo-unforgiven",
    ]);
    expect(result.current.counts).toEqual({ open: 2, new: 1 });
    expect(result.current.stats).toEqual({ decisions: 3, oldestAt: "2026-10-18T09:12:00.000Z" });
    expect(result.current.providers).toEqual(["provider-a"]);
    expect(result.current.doneToday).toBe(14);
  });

  it("applies the search filters and sort", async () => {
    state.search = { reason: "contributor-proposal" };
    const { result } = renderHook(() => useWorkspaceQueue("card"), { wrapper });
    await waitFor(() => expect(result.current.isPending).toBe(false));
    expect(result.current.entries.map((entry) => entry.key)).toEqual(["card:yasuo-unforgiven"]);
    expect(result.current.counts).toEqual({ open: 2, new: 1 });
  });

  it("drops invalid search params", async () => {
    state.search = { order: "random", segment: "archived" };
    const { result } = renderHook(() => useWorkspaceQueue("card"), { wrapper });
    await waitFor(() => expect(result.current.isPending).toBe(false));
    expect(result.current.view).toBe("open");
    expect(result.current.search.order).toBeUndefined();
  });

  it("moves skipped records to the end and prunes skips that left the queue", async () => {
    useWorkspaceSkipStore.getState().skip("card", "card:jinx-loose-cannon");
    useWorkspaceSkipStore.getState().skip("card", "card:viktor-herald");
    useWorkspaceSkipStore.getState().skip("face", "face:f9");
    const { result } = renderHook(() => useWorkspaceQueue("card"), { wrapper });
    await waitFor(() => expect(result.current.isPending).toBe(false));
    expect(result.current.entries.map((entry) => entry.key)).toEqual([
      "card:yasuo-unforgiven",
      "card:jinx-loose-cannon",
    ]);
    await waitFor(() =>
      expect(useWorkspaceSkipStore.getState().skipped).toEqual({
        card: ["card:jinx-loose-cannon"],
        face: ["face:f9"],
      }),
    );
  });

  it("keeps the skips while the queue is loading or failed", async () => {
    state.queueError = new Error("Not found");
    useWorkspaceSkipStore.getState().skip("card", "card:viktor-herald");
    const { result } = renderHook(() => useWorkspaceQueue("card"), { wrapper });
    await waitFor(() => expect(result.current.error).not.toBeNull());
    expect(useWorkspaceSkipStore.getState().skipped.card).toEqual(["card:viktor-herald"]);
  });

  it("surfaces a failed queue request", async () => {
    state.queueError = new Error("Not found");
    const { result } = renderHook(() => useWorkspaceQueue("face"), { wrapper });
    await waitFor(() => expect(result.current.error?.message).toBe("Not found"));
    expect(result.current.entries).toEqual([]);
  });
});

describe("useWorkspaceRecords", () => {
  it("loads the face rows with the trimmed search", async () => {
    state.search = { q: "  jinx " };
    const { result } = renderHook(() => useWorkspaceRecords("face", true), { wrapper });
    await waitFor(() => expect(result.current.isPending).toBe(false));
    expect(state.recordsInputs).toEqual([
      { kind: "face", q: "jinx", limit: 500, cursor: undefined },
    ]);
    expect(result.current.kind).toBe("face");
    expect(result.current.hasMore).toBe(true);
    expect(result.current.entries.map((entry) => entry.key)).toEqual(["face:f1"]);
  });

  it("loads the next page from the cursor and stops at the end", async () => {
    const { result } = renderHook(() => useWorkspaceRecords("printing", true), { wrapper });
    await waitFor(() => expect(result.current.isPending).toBe(false));
    act(() => result.current.loadMore());
    await waitFor(() => expect(result.current.hasMore).toBe(false));
    expect(state.recordsInputs).toEqual([
      { kind: "printing", q: undefined, limit: 500, cursor: undefined },
      { kind: "printing", q: undefined, limit: 500, cursor: "next" },
    ]);
    expect(result.current.entries.map((entry) => entry.key)).toEqual([
      "printing:f1",
      "printing:f2",
    ]);
    expect(result.current.total).toBe(2);
  });

  it("restarts paging when the search changes", async () => {
    const { result, rerender } = renderHook(() => useWorkspaceRecords("face", true), {
      wrapper,
    });
    await waitFor(() => expect(result.current.isPending).toBe(false));
    act(() => result.current.loadMore());
    await waitFor(() => expect(result.current.hasMore).toBe(false));
    state.search = { q: "jinx" };
    rerender();
    await waitFor(() => expect(result.current.hasMore).toBe(true));
    expect(state.recordsInputs.at(-1)).toEqual({
      kind: "face",
      q: "jinx",
      limit: 500,
      cursor: undefined,
    });
    expect(result.current.entries.map((entry) => entry.key)).toEqual(["face:f1"]);
  });

  it("loads nothing while disabled", () => {
    renderHook(() => useWorkspaceRecords("printing", false), { wrapper });
    expect(state.recordsInputs).toEqual([]);
  });

  it("sorts and filters the card list", () => {
    state.search = { q: "OGN-066" };
    const { result } = renderHook(() => useWorkspaceRecords("card", true), { wrapper });
    expect(result.current.kind).toBe("card");
    expect(result.current.entries.map((entry) => entry.key)).toEqual(["card:ahri-alluring"]);
    expect(result.current.total).toBe(2);
  });

  it("uses the desk list for desk holders", async () => {
    state.access = { isAdmin: false, sections: ["printing-desk"] };
    state.search = { desk: "promos" };
    const { result } = renderHook(() => useWorkspaceRecords("printing", true), { wrapper });
    await waitFor(() => expect(result.current.isPending).toBe(false));
    expect(result.current.kind).toBe("desk");
    expect(state.deskModes).toEqual(["all"]);
    expect(state.recordsInputs).toEqual([]);
  });
});
