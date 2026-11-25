import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@tanstack/react-router", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  Link: ({ children }: { children: ReactNode }) => <a href="/card">{children}</a>,
}));
vi.mock("@/features/admin/lib/unified-mappings-queries", () => ({
  unifiedMappingsForCardQueryOptions: (cardSlug: string) => ({
    queryKey: ["unified-mappings", cardSlug],
    queryFn: () => new Promise(() => {}),
  }),
}));
vi.mock("@/features/cards/hooks/use-prices", () => ({ usePricesOnDemand: () => undefined }));
vi.mock("@/features/catalog-workspace/hooks/use-listing-writes", () => ({
  useListingWrites: () => ({ map: vi.fn(), unmap: vi.fn(), pending: false }),
}));
vi.mock("@/components/marketplace-icon", () => ({ MarketplaceIcon: () => null }));

const { PrintingMarketplaceSection } = await import("./printing-marketplace-section");

describe("PrintingMarketplaceSection", () => {
  it("claims no missing listing before the card's listings have loaded", () => {
    render(
      <QueryClientProvider client={new QueryClient()}>
        <PrintingMarketplaceSection
          printingId="p-1"
          cardSlug="jinx"
          otherCardSlugs={[]}
          cardName="Jinx"
          language="EN"
          mappings={[]}
        />
      </QueryClientProvider>,
    );

    expect(screen.getAllByText("Not mapped").length).toBeGreaterThan(0);
    expect(screen.queryByText("Not mapped, no unassigned listing of this card")).toBeNull();
  });
});
