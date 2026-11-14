import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import { metaRow } from "@/test/meta-event-fixtures";

vi.mock("@tanstack/react-start", async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  createServerFn: () => {
    const chain = {
      handler: () => async () => ({}),
      middleware: () => chain,
      validator: () => chain,
      inputValidator: () => chain,
    };
    return chain;
  },
  createMiddleware: () => {
    const chain = { server: () => chain };
    return chain;
  },
}));

vi.mock("@/lib/server-fns/middleware", () => ({
  withCookies: () => {},
}));

const { useMetaLegendGroupRows } = await import("./use-meta");
const { metaStandingsQueryOptions } = await import("@/features/meta/lib/meta-queries");

const SLUG = "summoner-skirmish";

function seeded() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const ahri = [metaRow({ id: "p-1", playerName: "Ana" })];
  client.setQueryData(
    metaStandingsQueryOptions(SLUG, { legend: "card-ahri", limit: 5, offset: 0 }).queryKey,
    { players: ahri, total: 1 },
  );
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return { ahri, wrapper };
}

describe("useMetaLegendGroupRows", () => {
  it("hands back each group's cached rows in the order asked", () => {
    const { ahri, wrapper } = seeded();
    const { result } = renderHook(() => useMetaLegendGroupRows(SLUG, ["card-ahri"], 5), {
      wrapper,
    });

    expect(result.current.groups[0]).toMatchObject({ players: ahri, isError: false });
    expect(result.current.lists).toEqual([ahri]);
  });

  it("keeps the same result across renders while the data holds", () => {
    const { wrapper } = seeded();
    const { result, rerender } = renderHook(() => useMetaLegendGroupRows(SLUG, ["card-ahri"], 5), {
      wrapper,
    });
    const first = result.current;

    rerender();

    expect(result.current).toBe(first);
    expect(result.current.lists).toBe(first.lists);
  });

  it("asks for nothing when no group is open", () => {
    const { wrapper } = seeded();
    const { result } = renderHook(() => useMetaLegendGroupRows(SLUG, [], 5), { wrapper });

    expect(result.current).toEqual({ groups: [], lists: [] });
  });
});
