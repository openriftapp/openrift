import type { ScanManifest } from "@openrift/shared/contracts/scan";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

let manifest: ScanManifest;

vi.mock("@tanstack/react-start", async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  createServerFn: () => {
    const chain = {
      // oxlint-disable-next-line react/function-component-definition -- mocked server-fn handler, not a component
      handler: () => async () => manifest,
      middleware: () => chain,
    };
    return chain;
  },
}));

vi.mock("@/lib/server-fns/middleware", () => ({ withCookies: () => {} }));
vi.mock("@/lib/server-fns/orpc-client", () => ({ apiOrpcClient: vi.fn() }));

const { useScanServing } = await import("./use-scan-serving");

const PUBLISHED: ScanManifest = {
  available: true,
  formatVersion: 1,
  bankHash: "511b47521ffca52a",
  entryCount: 2670,
  builtAt: "2026-07-28T11:36:00.000Z",
  bankUrl: "/media/scan/scan-bank-511b47521ffca52a.bin",
  labelsUrl: "/media/scan/scan-labels-511b47521ffca52a.json",
  encoderUrl: "/media/scan/scan-encoder-v2.onnx",
  detectorUrl: "/media/scan/scan-detector-v1.onnx",
  boardDetectorUrl: null,
};

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

describe("useScanServing", () => {
  it("serves the published assets", async () => {
    manifest = PUBLISHED;
    const { result } = renderHook(() => useScanServing(), { wrapper });

    await waitFor(() => {
      expect(result.current.status).toBe("ready");
    });
    expect(result.current.assets).toMatchObject({
      bankUrl: PUBLISHED.bankUrl,
      detectorUrl: PUBLISHED.detectorUrl,
      boardDetectorUrl: null,
    });
  });

  it("reports unavailable before a bank is published", async () => {
    manifest = { ...PUBLISHED, available: false, bankUrl: null, labelsUrl: null };
    const { result } = renderHook(() => useScanServing(), { wrapper });

    await waitFor(() => {
      expect(result.current.status).toBe("unavailable");
    });
  });

  it("reports unavailable without a card detector", async () => {
    manifest = { ...PUBLISHED, detectorUrl: null };
    const { result } = renderHook(() => useScanServing(), { wrapper });

    await waitFor(() => {
      expect(result.current.status).toBe("unavailable");
    });
    expect(result.current.assets).toBeNull();
  });
});
