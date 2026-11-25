import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@tanstack/react-router", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  Link: ({ children }: { children: ReactNode }) => <a href="/card">{children}</a>,
  useNavigate: () => vi.fn(),
}));
vi.mock("@/features/admin/lib/unified-mappings-queries", () => ({
  unifiedMappingsForCardQueryOptions: (cardSlug: string) => ({
    queryKey: ["unified-mappings", cardSlug],
    queryFn: () => Promise.reject(new Error("Server error")),
    retry: false,
  }),
}));
vi.mock("@/features/admin/hooks/use-unified-mappings", () => {
  const none = () => ({});
  return {
    useAssignToCardByMarketplace: none,
    useIgnoreProductsByMarketplace: none,
    useIgnoreVariantsByMarketplace: none,
    useUnassignFromCardByMarketplace: none,
  };
});
vi.mock("@/features/catalog-workspace/hooks/use-listing-writes", () => ({
  useListingWrites: () => ({ done: vi.fn(), saves: {}, pending: false }),
}));
vi.mock("@/features/admin/components/ignored-products-note", () => ({
  IgnoredProductsNote: () => null,
}));

const { CardListingsSection } = await import("./card-listings-section");

describe("CardListingsSection", () => {
  it("says the listings could not be loaded instead of saying there are none", async () => {
    render(
      <QueryClientProvider client={new QueryClient()}>
        <CardListingsSection cardSlug="jinx" cardName="Jinx" pairNames={new Map()} />
      </QueryClientProvider>,
    );

    expect(await screen.findByRole("alert")).toHaveTextContent("The listings could not be loaded.");
    expect(screen.queryByText("No marketplace listings point at this card.")).toBeNull();
  });
});
