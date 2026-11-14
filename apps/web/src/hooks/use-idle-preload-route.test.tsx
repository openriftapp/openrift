import { cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useIdlePreloadRoute } from "@/hooks/use-idle-preload-route";

const preloadRoute = vi.fn((_options: { to: string }) => Promise.resolve());
vi.mock("@tanstack/react-router", () => ({
  useRouter: () => ({ preloadRoute }),
}));

const idleCallbacks: IdleRequestCallback[] = [];
const cancelIdleCallback = vi.fn();

beforeEach(() => {
  idleCallbacks.length = 0;
  vi.stubGlobal("requestIdleCallback", (cb: IdleRequestCallback) => idleCallbacks.push(cb));
  vi.stubGlobal("cancelIdleCallback", cancelIdleCallback);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("useIdlePreloadRoute", () => {
  it("preloads the route only once the browser is idle", () => {
    renderHook(() => useIdlePreloadRoute("/cards"));
    expect(preloadRoute).not.toHaveBeenCalled();
    for (const cb of idleCallbacks.splice(0)) {
      cb({ didTimeout: false, timeRemaining: () => 50 });
    }
    expect(preloadRoute).toHaveBeenCalledWith({ to: "/cards" });
  });

  it("cancels the pending preload on unmount", () => {
    const { unmount } = renderHook(() => useIdlePreloadRoute("/cards"));
    unmount();
    expect(cancelIdleCallback).toHaveBeenCalledTimes(1);
  });

  it("skips the preload where the browser has no idle callback", () => {
    vi.stubGlobal("requestIdleCallback", undefined);
    renderHook(() => useIdlePreloadRoute("/cards"));
    expect(preloadRoute).not.toHaveBeenCalled();
  });
});
