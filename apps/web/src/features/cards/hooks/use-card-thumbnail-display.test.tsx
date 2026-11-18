import { EMPTY_PRICE_LOOKUP } from "@openrift/shared/price-lookup";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { initQueryOptions } from "@/lib/init-queries";
import { useDisplayStore } from "@/stores/display-store";
import { stubInitResponse } from "@/test/init-fixtures";
import { createStoreResetter } from "@/test/store-helpers";

import { useCardThumbnailDisplayWith } from "./use-card-thumbnail-display";

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient();
  client.setQueryData(initQueryOptions.queryKey, stubInitResponse());
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

describe("useCardThumbnailDisplayWith", () => {
  const resetStore = createStoreResetter(useDisplayStore);
  beforeEach(() => {
    resetStore();
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.reject(new Error("unexpected fetch"))),
    );
  });
  afterEach(() => {
    resetStore();
    vi.unstubAllGlobals();
  });

  it("uses the lookup it is given and never loads prices itself", () => {
    const { result } = renderHook(() => useCardThumbnailDisplayWith(EMPTY_PRICE_LOOKUP), {
      wrapper,
    });
    expect(result.current.prices).toBe(EMPTY_PRICE_LOOKUP);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("takes the favorite marketplace from the first entry of the viewer's order", () => {
    useDisplayStore.setState({ marketplaceOrder: ["cardmarket", "tcgplayer", "cardtrader"] });
    const { result } = renderHook(() => useCardThumbnailDisplayWith(EMPTY_PRICE_LOOKUP), {
      wrapper,
    });
    expect(result.current.favoriteMarketplace).toBe("cardmarket");
  });
});
