import { makeCatalogReference } from "@openrift/shared/test-factories";
import type { CatalogResponse } from "@openrift/shared/types/api/catalog";
import type { Printing } from "@openrift/shared/types/catalog";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook } from "@testing-library/react";
import type { PropsWithChildren } from "react";
import { describe, expect, it } from "vitest";

import { useStandardArtFallback } from "@/features/cards/hooks/use-standard-art-fallback";
import { catalogKeys } from "@/features/cards/lib/cards-query-keys";
import { buildCardsResult } from "@/features/cards/lib/catalog-queries";
import type { UseCardsResult } from "@/features/cards/lib/catalog-queries";
import { CatalogSubsetContext } from "@/features/cards/lib/catalog-subset-context";
import { stubPrinting } from "@/test/factories";

const SET_ID = "00000000-0000-0000-0000-00000000set1";

function toCatalogValue(printing: Printing) {
  const {
    printingId: _id,
    setSlug: _slug,
    setReleased: _released,
    card: _card,
    ...value
  } = printing;
  return { ...value, setId: SET_ID };
}

// Structural cast: the zod wire schema and the stub-derived shape agree on
// every field the enrichment reads (sets, cards, printings, ids).
function makeCatalog(printings: Printing[]): CatalogResponse {
  return {
    sets: [
      {
        id: SET_ID,
        slug: "rb1",
        name: "Set One",
        releases: { EN: { releasedAt: "2025-01-01", precision: "day" } },
      },
    ],
    cards: Object.fromEntries(printings.map((p) => [p.cardId, p.card])),
    printings: Object.fromEntries(printings.map((p) => [p.printingId, toCatalogValue(p)])),
    ...makeCatalogReference(),
  } as unknown as CatalogResponse;
}

function setup(catalog?: CatalogResponse, subset?: UseCardsResult) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  if (catalog) {
    client.setQueryData(catalogKeys.all, catalog);
  }
  function wrapper({ children }: PropsWithChildren) {
    return (
      <QueryClientProvider client={client}>
        <CatalogSubsetContext value={subset ?? null}>{children}</CatalogSubsetContext>
      </QueryClientProvider>
    );
  }
  const { result } = renderHook(() => useStandardArtFallback(), { wrapper });
  return { client, result };
}

describe("useStandardArtFallback", () => {
  it("resolves fallback art from the cached catalog", () => {
    const target = stubPrinting({
      printingId: "p-target",
      cardId: "card-1",
      language: "SC",
      images: [],
    });
    const enStandard = stubPrinting({
      printingId: "p-en",
      cardId: "card-1",
      language: "EN",
      images: [{ imageId: "img-en" }],
    });
    const { result } = setup(makeCatalog([target, enStandard]));
    const fallback = result.current(target);
    expect(fallback?.printing?.printingId).toBe("p-en");
    expect(fallback?.image.imageId).toBe("img-en");
  });

  it("returns null for cards without a usable standard printing", () => {
    const target = stubPrinting({ printingId: "p-target", cardId: "card-1", images: [] });
    const { result } = setup(makeCatalog([target]));
    expect(result.current(target)).toBeNull();
  });

  it("resolves fallback art from a provided subset when the catalog is not cached", () => {
    const target = stubPrinting({
      printingId: "p-target",
      cardId: "card-1",
      language: "SC",
      images: [],
    });
    const enStandard = stubPrinting({
      printingId: "p-en",
      cardId: "card-1",
      language: "EN",
      images: [{ imageId: "img-en" }],
    });
    const subset = buildCardsResult({ "card-1": target.card }, [target, enStandard], []);
    const { client, result } = setup(undefined, subset);
    expect(result.current(target)?.image.imageId).toBe("img-en");
    expect(client.getQueryState(catalogKeys.all)?.fetchStatus ?? "idle").toBe("idle");
  });

  it("returns null and does not fetch when the catalog is not cached", () => {
    const { client, result } = setup();
    expect(result.current(stubPrinting())).toBeNull();
    expect(client.getQueryState(catalogKeys.all)?.fetchStatus ?? "idle").toBe("idle");
  });
});
