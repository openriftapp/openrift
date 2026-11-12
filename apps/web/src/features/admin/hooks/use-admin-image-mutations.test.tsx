import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@tanstack/react-start", async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  createServerFn: () => {
    const chain = {
      handler: () => async () => {
        throw new Error("Could not rehost the image: HTTP 404");
      },
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

vi.mock("@/lib/server-fns/with-cookies", () => ({
  withCookies: () => {},
}));

const { reportMutationError } = vi.hoisted(() => ({ reportMutationError: vi.fn() }));
vi.mock("@/lib/query-client", () => ({ reportMutationError }));

const { useActivatePrintingImage, useRehostPrintingImage } =
  await import("./use-admin-image-mutations");

function wrap(client: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
}

const SCOPE = [["admin", "cards"]] as const;

describe("image mutations that can fail after changing the image", () => {
  it("reports a failed activation and still refreshes the image list", async () => {
    const client = new QueryClient();
    const invalidateSpy = vi.spyOn(client, "invalidateQueries");
    const { result } = renderHook(() => useActivatePrintingImage(SCOPE), {
      wrapper: wrap(client),
    });

    act(() => {
      result.current.mutate({ imageId: "img-1", active: true });
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(reportMutationError).toHaveBeenCalledWith(
      expect.objectContaining({ message: "Could not rehost the image: HTTP 404" }),
      client,
    );
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["admin", "cards"] });
  });

  it("reports a failed rehost and still refreshes the image list", async () => {
    reportMutationError.mockClear();
    const client = new QueryClient();
    const invalidateSpy = vi.spyOn(client, "invalidateQueries");
    const { result } = renderHook(() => useRehostPrintingImage(SCOPE), { wrapper: wrap(client) });

    act(() => {
      result.current.mutate("img-1");
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(reportMutationError).toHaveBeenCalledTimes(1);
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["admin", "cards"] });
  });
});
