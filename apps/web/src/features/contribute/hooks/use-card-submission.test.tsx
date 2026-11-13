import { QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import { createQueryClient } from "@/lib/query-client";
import { toastError } from "@/lib/toast";

vi.mock("@/lib/toast", async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  toastError: vi.fn(),
}));
vi.mock("@/lib/report-error", () => ({ captureHandledError: vi.fn() }));
vi.mock("@tanstack/react-start", async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  createServerFn: () => {
    const chain = {
      handler: () => () => Promise.reject(new Error("Daily limit reached")),
      middleware: () => chain,
      validator: () => chain,
    };
    return chain;
  },
}));
vi.mock("@/lib/server-fns/middleware", () => ({ withCookies: () => {} }));
vi.mock("@/lib/server-fns/upload", () => ({
  postMultipart: () => Promise.reject(new Error("Not an image")),
}));

const { useSubmitCard } = await import("./use-card-submission");
const { useUploadSubmissionImage } = await import("./use-upload-submission-image");

function wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={createQueryClient()}>{children}</QueryClientProvider>;
}

describe("contribute mutations show their error inline only", () => {
  it("does not toast a failed submission", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { result } = renderHook(() => useSubmitCard(), { wrapper });

    await act(() => result.current.mutateAsync({} as never).catch(() => null));

    await waitFor(() => expect(result.current.error?.message).toBe("Daily limit reached"));
    expect(toastError).not.toHaveBeenCalled();
  });

  it("does not toast a failed image upload", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { result } = renderHook(() => useUploadSubmissionImage(), { wrapper });

    await act(() => result.current.mutateAsync(new File([], "a.png")).catch(() => null));

    await waitFor(() => expect(result.current.error?.message).toBe("Not an image"));
    expect(toastError).not.toHaveBeenCalled();
  });
});
