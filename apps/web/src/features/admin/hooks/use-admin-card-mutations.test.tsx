import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@tanstack/react-start", async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  createServerFn: () => {
    const chain = {
      handler: () => async () => ({ printingId: "test-printing-id" }),
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

vi.mock("@/lib/server-fns/fetch-api", () => ({
  fetchApi: vi.fn(),
  fetchApiJson: vi.fn(),
}));

vi.mock("@/lib/server-fns/with-cookies", () => ({
  withCookies: () => {},
}));

const {
  useAcceptCardField,
  useAcceptPrintingGroup,
  useCheckProvider,
  useDeleteProvider,
  useRelinkCandidatePrintings,
} = await import("./use-admin-card-mutations");
const { useUploadCandidates } = await import("./use-admin-image-mutations");
const { useUpdateProviderSetting } = await import("./use-provider-settings");

function makeClient() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const invalidateSpy = vi.spyOn(client, "invalidateQueries");
  return { client, invalidateSpy };
}

function wrap(client: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
}

describe("useAcceptPrintingGroup", () => {
  it("invalidates the keys passed via `invalidates`, not keys derived from the payload cardId", async () => {
    const { client, invalidateSpy } = makeClient();
    const slugScopedKey = ["admin", "cards", "detail", "ahri-alluring"] as const;

    const { result } = renderHook(() => useAcceptPrintingGroup([slugScopedKey]), {
      wrapper: wrap(client),
    });

    await act(async () => {
      await result.current.mutateAsync({
        cardId: "019cfc3b-0388-743b-8b2e-7e64f56850c3",
        printingFields: {} as never,
        candidatePrintingIds: [],
      });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: [...slugScopedKey] });
    expect(invalidateSpy).not.toHaveBeenCalledWith({
      queryKey: ["admin", "cards", "detail", "019cfc3b-0388-743b-8b2e-7e64f56850c3"],
    });
  });
});

describe("useAcceptCardField", () => {
  it("invalidates the keys passed via `invalidates`, not keys derived from the payload cardId", async () => {
    const { client, invalidateSpy } = makeClient();
    const slugScopedKey = ["admin", "cards", "detail", "allay-eager-admirer"] as const;

    const { result } = renderHook(() => useAcceptCardField([slugScopedKey]), {
      wrapper: wrap(client),
    });

    await act(async () => {
      await result.current.mutateAsync({
        cardId: "019d3342-bec8-7f50-a92d-154e120f3fa1",
        field: "tags",
        value: ["Bandle City", "Yordle"],
        source: "provider",
      });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: [...slugScopedKey] });
    expect(invalidateSpy).not.toHaveBeenCalledWith({
      queryKey: ["admin", "cards", "detail", "019d3342-bec8-7f50-a92d-154e120f3fa1"],
    });
  });
});

describe.each([
  ["useCheckProvider", () => useCheckProvider(), "ogn"],
  ["useDeleteProvider", () => useDeleteProvider(), "ogn"],
  ["useRelinkCandidatePrintings", () => useRelinkCandidatePrintings(), undefined],
  ["useUploadCandidates", () => useUploadCandidates(), {}],
  [
    "useUpdateProviderSetting",
    () => useUpdateProviderSetting(),
    { provider: "ogn", isHidden: true },
  ],
] as const)("%s", (_name, useHook, input) => {
  it("refetches the review queue so the sidebar count updates", async () => {
    const { client, invalidateSpy } = makeClient();
    const { result } = renderHook(() => useHook(), { wrapper: wrap(client) });

    await act(async () => {
      await (result.current.mutateAsync as (vars: unknown) => Promise<unknown>)(input);
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["admin", "review-queue"] });
  });
});
