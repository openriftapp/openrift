import { QueryClient, QueryClientProvider, queryOptions } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  access: undefined as { isAdmin: boolean; sections: string[] } | undefined,
  fetchProviderSettings: vi.fn(),
}));

vi.mock("@/features/admin/lib/provider-settings-queries", () => ({
  providerSettingsQueryOptions: queryOptions({
    queryKey: ["admin", "provider-settings"],
    queryFn: () => state.fetchProviderSettings(),
  }),
}));
vi.mock("@/features/admin/hooks/use-admin", () => ({
  useAdminAccess: () => ({ data: state.access }),
}));
vi.mock("@/hooks/use-enums", () => ({
  useEnumOrders: () => ({ orders: {}, labels: {} }),
}));
vi.mock("@/features/admin/hooks/use-markers", () => ({
  useMarkers: () => ({ data: { markers: [] } }),
}));
vi.mock("@/features/admin/hooks/use-distribution-channels", () => ({
  useDistributionChannels: () => ({ data: { distributionChannels: [] } }),
}));
vi.mock("@/features/admin/hooks/use-languages", () => ({
  useLanguages: () => ({ data: { languages: [] } }),
}));
vi.mock("@/features/cards/hooks/use-distinct-artists", () => ({
  useDistinctArtists: () => ({ data: [] }),
}));
vi.mock("@/features/admin/components/candidate-field-defs", () => ({
  candidateCardFieldDefs: () => [],
  candidatePrintingFieldDefs: () => [],
  buildNewCardFields: () => [],
  isValidOption: () => true,
}));
vi.mock("@/features/admin/hooks/use-admin-card-mutations", () => ({
  useCheckAllCandidatePrintings: () => ({}),
  useCheckCandidateCard: () => ({}),
  useCheckCandidatePrinting: () => ({}),
  useUncheckCandidateCard: () => ({}),
  useUncheckCandidatePrinting: () => ({}),
}));
vi.mock("@/features/admin/hooks/use-ignored-candidates", () => ({
  useIgnoreCandidateCard: () => ({}),
  useIgnoreCandidatePrinting: () => ({}),
}));

const { useCardDetailData } = await import("./card-detail-shared");

const SETTINGS = [{ provider: "gallery", isFavorite: true }];

function wrap(client: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
}

function render(client = new QueryClient({ defaultOptions: { queries: { retry: false } } })) {
  return renderHook(() => useCardDetailData([]), { wrapper: wrap(client) });
}

describe("useCardDetailData provider settings", () => {
  beforeEach(() => {
    state.fetchProviderSettings.mockReset();
    state.fetchProviderSettings.mockResolvedValue({ providerSettings: SETTINGS });
  });

  it("reads provider settings for a card-review holder", async () => {
    state.access = { isAdmin: false, sections: ["card-review"] };
    const { result } = render();

    await waitFor(() => expect(result.current.providerSettings).toEqual(SETTINGS));
  });

  it("never requests provider settings for a printing-desk-only user", () => {
    state.access = { isAdmin: false, sections: ["printing-desk"] };
    const { result } = render();

    expect(result.current.providerSettings).toEqual([]);
    expect(state.fetchProviderSettings).not.toHaveBeenCalled();
  });

  it("serves cached settings on the first render, before access has loaded", () => {
    state.access = undefined;
    const client = new QueryClient();
    client.setQueryData(["admin", "provider-settings"], { providerSettings: SETTINGS });
    const { result } = render(client);

    expect(result.current.providerSettings).toEqual(SETTINGS);
    expect(state.fetchProviderSettings).not.toHaveBeenCalled();
  });
});
