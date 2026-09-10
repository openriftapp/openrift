import type { UnifiedMappingsCardResponse } from "@openrift/shared/types/api/admin";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

const saved: { marketplace: string; mappings: unknown[] }[] = [];
const ignoredVariants: { marketplace: string; products: unknown[] }[] = [];
const ignoredProducts: { marketplace: string; products: unknown[] }[] = [];
const unmapped: unknown[] = [];
let saveFails = false;

vi.mock("@tanstack/react-start", () => ({
  createServerFn: () => {
    const chain = {
      handler: () => async () => ({ skipped: [] }),
      middleware: () => chain,
      validator: () => chain,
    };
    return chain;
  },
  createMiddleware: () => {
    const chain = { server: () => chain };
    return chain;
  },
}));

vi.mock("@/lib/server-fns/middleware", () => ({ withCookies: () => {} }));

vi.mock("@/features/admin/hooks/use-unified-mappings", async () => {
  const { useMutation } = await import("@tanstack/react-query");
  return {
    unifiedMappingsForCardQueryOptions: (cardId: string) => ({
      queryKey: ["admin", "unified-mappings", "card", cardId],
      queryFn: () => ({ group: null, allCards: [] }),
    }),
    useUnifiedSaveMappings: (marketplace: string) =>
      useMutation({
        mutationFn: async (body: { mappings: unknown[] }) => {
          if (saveFails) {
            throw new Error("save refused");
          }
          saved.push({ marketplace, mappings: body.mappings });
        },
      }),
    useUnifiedIgnoreVariants: (marketplace: string) =>
      useMutation({
        mutationFn: async (products: unknown[]) => {
          ignoredVariants.push({ marketplace, products });
        },
      }),
    useUnifiedIgnoreProducts: (marketplace: string) =>
      useMutation({
        mutationFn: async (products: unknown[]) => {
          ignoredProducts.push({ marketplace, products });
        },
      }),
    useUnifiedAssignToCard: () => useMutation({ mutationFn: async () => undefined }),
    useUnifiedUnassignFromCard: () => useMutation({ mutationFn: async () => undefined }),
  };
});

vi.mock("@/features/admin/hooks/use-admin-card-mutations", async () => {
  const { useMutation } = await import("@tanstack/react-query");
  return {
    useUnmapMarketplacePrinting: () =>
      useMutation({
        mutationFn: async (input: unknown) => {
          unmapped.push(input);
        },
      }),
  };
});

const { useMarketplaceActions } = await import("./use-marketplace-actions");
const { makeStagedProduct, makeUnifiedMappingGroup, makeUnifiedMappingPrinting } =
  await import("@/test/factories");

const CARD = "lux-lady-of-luminosity";
const CARD_KEY = ["admin", "unified-mappings", "card", CARD];

function cached(): UnifiedMappingsCardResponse {
  return {
    group: makeUnifiedMappingGroup({
      printings: [makeUnifiedMappingPrinting({ printingId: "p-en" })],
      tcgplayer: {
        stagedProducts: [makeStagedProduct({ externalId: 5 })],
        assignedProducts: [],
        assignments: [],
      },
    }),
    allCards: [],
  };
}

function setup() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  client.setQueryData(CARD_KEY, cached());
  function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  }
  const { result } = renderHook(() => useMarketplaceActions(CARD), { wrapper: Wrapper });
  return { client, result };
}

const ASSIGNMENT = {
  marketplace: "tcgplayer" as const,
  externalId: 5,
  finish: "normal",
  language: "EN",
  printingId: "p-en",
};

function reset() {
  saved.length = 0;
  ignoredVariants.length = 0;
  ignoredProducts.length = 0;
  unmapped.length = 0;
  saveFails = false;
}

describe("useMarketplaceActions", () => {
  it("writes the assignment into the cache before the request settles", () => {
    reset();
    const { client, result } = setup();

    act(() => result.current.assign([ASSIGNMENT]));

    const data = client.getQueryData<UnifiedMappingsCardResponse>(CARD_KEY);
    expect(data?.group?.tcgplayer.stagedProducts).toEqual([]);
    expect(data?.group?.tcgplayer.assignments).toHaveLength(1);
  });

  it("rolls the cache back when the save is refused", async () => {
    reset();
    saveFails = true;
    const { client, result } = setup();

    act(() => result.current.assign([ASSIGNMENT]));

    await waitFor(() => {
      expect(
        client.getQueryData<UnifiedMappingsCardResponse>(CARD_KEY)?.group?.tcgplayer.stagedProducts,
      ).toHaveLength(1);
    });
  });

  it("sends one save per marketplace", async () => {
    reset();
    const { result } = setup();

    act(() =>
      result.current.assign([
        ASSIGNMENT,
        { ...ASSIGNMENT, marketplace: "cardmarket", externalId: 9 },
        { ...ASSIGNMENT, externalId: 6 },
      ]),
    );

    await waitFor(() => expect(saved).toHaveLength(2));
    expect(saved.find((entry) => entry.marketplace === "tcgplayer")?.mappings).toHaveLength(2);
    expect(saved.find((entry) => entry.marketplace === "cardmarket")?.mappings).toHaveLength(1);
  });

  it("does nothing when asked to assign an empty list", () => {
    reset();
    const { result } = setup();

    act(() => result.current.assign([]));

    expect(saved).toEqual([]);
  });

  it("routes ignore, unlink and product-level ignore to the right marketplace", async () => {
    reset();
    const { result } = setup();

    act(() => result.current.ignoreVariant("cardtrader", 7, "foil", "SC"));
    act(() => result.current.ignoreProduct("cardmarket", 8));
    act(() => result.current.unlink("tcgplayer", "p-en", 5, "normal", "EN"));

    await waitFor(() => expect(unmapped).toHaveLength(1));
    expect(ignoredVariants).toEqual([
      { marketplace: "cardtrader", products: [{ externalId: 7, finish: "foil", language: "SC" }] },
    ]);
    expect(ignoredProducts).toEqual([{ marketplace: "cardmarket", products: [{ externalId: 8 }] }]);
    expect(unmapped[0]).toEqual({
      marketplace: "tcgplayer",
      printingId: "p-en",
      externalId: 5,
      finish: "normal",
      language: "EN",
    });
  });
});
