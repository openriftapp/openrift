import type { Printing } from "@openrift/shared/types/catalog";
import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { stubPrinting } from "@/test/factories";

import { useQuickCardSearch } from "./use-quick-card-search";

const queryOptions = vi.hoisted(() => [] as { enabled?: boolean }[]);

vi.mock("@tanstack/react-query", async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  useQuery: (options: { enabled?: boolean }) => {
    queryOptions.push(options);
    return { data: undefined };
  },
}));
vi.mock("@/features/cards/hooks/use-catalog-search-vocabulary", () => ({
  useCatalogSearchVocabulary: () => undefined,
}));
vi.mock("@/hooks/use-keyword-reverse-map", () => ({
  useKeywordReverseMap: () => new Map(),
}));
vi.mock("@/hooks/use-enums", () => ({
  useEnumOrders: () => ({ orders: { rarities: [] } }),
}));
vi.mock("@/stores/display-store", () => ({
  useDisplayStore: (select: (state: { marketplaceOrder: string[] }) => unknown) =>
    select({ marketplaceOrder: ["tcgplayer"] }),
}));

function groupByCardId(printings: Printing[]): Map<string, Printing[]> {
  return Map.groupBy(printings, (p) => p.cardId);
}

const map = groupByCardId([
  stubPrinting({ cardId: "card-ahri", card: { name: "Ahri", types: ["Unit"] } }),
  stubPrinting({ cardId: "card-yasuo", card: { name: "Yasuo", types: ["Unit"] } }),
  stubPrinting({ cardId: "card-fireball", card: { name: "Fireball", types: ["Spell"] } }),
]);

describe("useQuickCardSearch", () => {
  it("uses the name lookup for bare words and leaves prices unfetched", () => {
    queryOptions.length = 0;
    const { result } = renderHook(() => useQuickCardSearch("ahri", map));

    expect(result.current.syntax).toBeNull();
    expect(result.current.results.map((r) => r.cardId)).toEqual(["card-ahri"]);
    expect(queryOptions.at(-1)?.enabled).toBe(false);
  });

  it("uses the search syntax for a clause, with the limit and match count", () => {
    queryOptions.length = 0;
    const { result } = renderHook(() => useQuickCardSearch("t:unit", map, { limit: 1 }));

    expect(result.current.results.map((r) => r.cardId)).toEqual(["card-ahri"]);
    expect(result.current.syntax).toEqual({ total: 2, problems: [] });
    expect(queryOptions.at(-1)?.enabled).toBe(true);
  });

  it("returns nothing for a blank query", () => {
    const { result } = renderHook(() => useQuickCardSearch("  ", map));

    expect(result.current).toEqual({ results: [], syntax: null });
  });
});
