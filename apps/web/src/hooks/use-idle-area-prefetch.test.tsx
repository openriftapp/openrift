import { QueryClientProvider } from "@tanstack/react-query";
import { cleanup, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useIdleAreaPrefetch } from "@/hooks/use-idle-area-prefetch";
import { createQueryClient } from "@/lib/query-client";

const prefetchAreas = vi.fn();
vi.mock("@/hooks/area-prefetch", () => ({
  prefetchAreas: (...args: unknown[]) => prefetchAreas(...args),
}));

const preloadRoute = vi.fn((_options: { to: string }) => Promise.resolve());
vi.mock("@tanstack/react-router", () => ({
  useRouter: () => ({ preloadRoute }),
}));

const idleCallbacks: IdleRequestCallback[] = [];
const cancelIdleCallback = vi.fn();

function wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
let queryClient = createQueryClient();

beforeEach(() => {
  queryClient = createQueryClient();
  idleCallbacks.length = 0;
  vi.stubGlobal("requestIdleCallback", (cb: IdleRequestCallback) => idleCallbacks.push(cb));
  vi.stubGlobal("cancelIdleCallback", cancelIdleCallback);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
  vi.useRealTimers();
});

function runIdle() {
  for (const cb of idleCallbacks.splice(0)) {
    cb({ didTimeout: false, timeRemaining: () => 50 });
  }
}

describe("useIdleAreaPrefetch", () => {
  it("prefetches the area queries once the browser is idle", async () => {
    renderHook(() => useIdleAreaPrefetch("user-1"), { wrapper });
    expect(prefetchAreas).not.toHaveBeenCalled();
    runIdle();
    await waitFor(() => expect(prefetchAreas).toHaveBeenCalledWith(queryClient, "user-1"));
  });

  it("preloads the primary area routes after the data", async () => {
    renderHook(() => useIdleAreaPrefetch("user-1"), { wrapper });
    runIdle();
    await waitFor(() => expect(preloadRoute).toHaveBeenCalledTimes(3));
    expect(preloadRoute.mock.calls.map(([options]) => options.to)).toEqual([
      "/cards",
      "/collections",
      "/decks",
    ]);
  });

  it("does nothing while signed out", () => {
    renderHook(() => useIdleAreaPrefetch(null), { wrapper });
    expect(idleCallbacks).toHaveLength(0);
    expect(prefetchAreas).not.toHaveBeenCalled();
  });

  it("cancels the idle callback on unmount", async () => {
    const { unmount } = renderHook(() => useIdleAreaPrefetch("user-1"), { wrapper });
    unmount();
    expect(cancelIdleCallback).toHaveBeenCalledTimes(1);
    runIdle();
    await Promise.resolve();
    expect(prefetchAreas).not.toHaveBeenCalled();
  });

  it("re-schedules when the user changes", async () => {
    const { rerender } = renderHook((userId: string | null) => useIdleAreaPrefetch(userId), {
      wrapper,
      initialProps: "user-1" as string | null,
    });
    runIdle();
    await waitFor(() => expect(prefetchAreas).toHaveBeenCalledWith(queryClient, "user-1"));
    rerender("user-2");
    runIdle();
    await waitFor(() => expect(prefetchAreas).toHaveBeenCalledWith(queryClient, "user-2"));
  });

  it("falls back to a timer without requestIdleCallback", async () => {
    vi.stubGlobal("requestIdleCallback", undefined);
    vi.useFakeTimers();
    renderHook(() => useIdleAreaPrefetch("user-1"), { wrapper });
    expect(prefetchAreas).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1500);
    expect(prefetchAreas).toHaveBeenCalledWith(queryClient, "user-1");
  });
});
