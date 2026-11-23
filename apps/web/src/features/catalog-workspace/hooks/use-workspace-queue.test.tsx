import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  search: {} as Record<string, unknown>,
  access: { isAdmin: true, sections: [] as string[] },
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

const { filterDeskTable, recordFilterFor, useWorkspaceRecords } =
  await import("./use-workspace-queue");

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

beforeEach(() => {
  state.search = {};
  state.access = { isAdmin: true, sections: [] };
  state.recordsInputs = [];
  state.deskModes = [];
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
    expect(result.current.rows).toMatchObject([{ id: "f1" }]);
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
    expect(result.current.rows).toMatchObject([{ id: "f1" }, { id: "f2" }]);
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
    expect(result.current.rows).toMatchObject([{ id: "f1" }]);
  });

  it("loads nothing while disabled", () => {
    renderHook(() => useWorkspaceRecords("printing", false), { wrapper });
    expect(state.recordsInputs).toEqual([]);
  });

  it("sorts and filters the card list", () => {
    state.search = { q: "OGN-066" };
    const { result } = renderHook(() => useWorkspaceRecords("card", true), { wrapper });
    expect(result.current.kind).toBe("card");
    expect(result.current.rows.map((row) => row.cardSlug)).toEqual(["ahri-alluring"]);
    expect(result.current.total).toBe(2);
    expect(result.current.loadedRows).toHaveLength(2);
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

  it("sends a type filter that fits the table and drops one that does not", async () => {
    state.search = { filter: "promo" };
    const printings = renderHook(() => useWorkspaceRecords("printing", true), { wrapper });
    await waitFor(() => expect(printings.result.current.isPending).toBe(false));
    const faces = renderHook(() => useWorkspaceRecords("face", true), { wrapper });
    await waitFor(() => expect(faces.result.current.isPending).toBe(false));
    expect(state.recordsInputs).toMatchObject([
      { kind: "printing", filter: "promo" },
      { kind: "face", filter: undefined },
    ]);
  });
});

describe("recordFilterFor", () => {
  it("accepts only the filters of the table", () => {
    expect(recordFilterFor("printing", "mine")).toBe("mine");
    expect(recordFilterFor("face", "mine")).toBeUndefined();
    expect(recordFilterFor("face", "substitute")).toBe("substitute");
    expect(recordFilterFor("desk", "promo")).toBeUndefined();
    expect(recordFilterFor("printing", undefined)).toBeUndefined();
  });
});

describe("filterDeskTable", () => {
  function deskRow(overrides: Record<string, unknown>) {
    return {
      printingId: "p",
      cardName: "Garen, Rugged",
      cardSlug: "garen-rugged",
      shortCode: "OGN-160",
      publicCode: "OGN-160p",
      language: "en",
      finish: "foil",
      imageCount: 1,
      secondSide: null,
      releasedAt: "2026-01-01",
      releasePrecision: "day",
      updatedAt: "2026-10-01T00:00:00.000Z",
      ...overrides,
    } as unknown as Parameters<typeof filterDeskTable>[0][number];
  }

  const rows = [
    deskRow({ printingId: "a", shortCode: "OGN-007", updatedAt: "2026-10-03T00:00:00.000Z" }),
    deskRow({ printingId: "b", imageCount: 0, releasedAt: "2099-01-01" }),
    deskRow({
      printingId: "c",
      shortCode: "UNL-T02",
      secondSide: {
        cardName: "Brush",
        cardSlug: "brush",
        shortCode: "UNL-T03",
        publicCode: "UNL-T03",
      },
      updatedAt: "2026-10-05T00:00:00.000Z",
    }),
  ];

  it("sorts by last update unless told otherwise", () => {
    expect(filterDeskTable(rows, {}).map((row) => row.printingId)).toEqual(["c", "a", "b"]);
    expect(filterDeskTable(rows, { deskSort: "code" }).map((row) => row.printingId)).toEqual([
      "a",
      "b",
      "c",
    ]);
  });

  it("narrows to double-sided printings or printings without images", () => {
    expect(filterDeskTable(rows, { filter: "double-sided" }).map((row) => row.printingId)).toEqual([
      "c",
    ]);
    expect(filterDeskTable(rows, { filter: "no-image" }).map((row) => row.printingId)).toEqual([
      "b",
    ]);
  });

  it("filters by status", () => {
    expect(filterDeskTable(rows, { status: "announced" }).map((row) => row.printingId)).toEqual([
      "b",
    ]);
  });
});
