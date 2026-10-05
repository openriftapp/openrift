import { act, renderHook } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createMediaQueryHook } from "./create-media-query-hook";

function stubMatchMedia(initial: boolean) {
  const listeners = new Set<() => void>();
  const list = {
    matches: initial,
    addEventListener: (_event: string, listener: () => void) => listeners.add(listener),
    removeEventListener: (_event: string, listener: () => void) => listeners.delete(listener),
  };
  const matchMedia = vi.fn((_query: string) => list);
  vi.stubGlobal("matchMedia", matchMedia);
  return {
    matchMedia,
    set(matches: boolean) {
      list.matches = matches;
      for (const listener of listeners) {
        listener();
      }
    },
    listenerCount: () => listeners.size,
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("createMediaQueryHook", () => {
  it("reads the query's current match", () => {
    const media = stubMatchMedia(true);
    const useQuery = createMediaQueryHook("(pointer: coarse)", false);

    const { result } = renderHook(() => useQuery());

    expect(result.current).toBe(true);
    expect(media.matchMedia).toHaveBeenCalledWith("(pointer: coarse)");
  });

  it("re-renders when the match changes", () => {
    const media = stubMatchMedia(false);
    const useQuery = createMediaQueryHook("(orientation: landscape)", false);
    const { result } = renderHook(() => useQuery());

    act(() => media.set(true));

    expect(result.current).toBe(true);
  });

  it("builds the MediaQueryList once per hook", () => {
    const media = stubMatchMedia(false);
    const useQuery = createMediaQueryHook("(min-width: 640px)", true);
    renderHook(() => useQuery());
    renderHook(() => useQuery());

    expect(media.matchMedia).toHaveBeenCalledOnce();
  });

  it("unsubscribes on unmount", () => {
    const media = stubMatchMedia(false);
    const useQuery = createMediaQueryHook("(max-width: 767px)", false);
    const { unmount } = renderHook(() => useQuery());
    expect(media.listenerCount()).toBe(1);

    unmount();

    expect(media.listenerCount()).toBe(0);
  });

  it.each([true, false])("renders the server value %s during SSR", (serverValue) => {
    stubMatchMedia(!serverValue);
    const useQuery = createMediaQueryHook("(min-width: 640px)", serverValue);
    function Probe() {
      return useQuery() ? "yes" : "no";
    }

    expect(renderToString(<Probe />)).toBe(serverValue ? "yes" : "no");
  });

  it("falls back to the server value without matchMedia", () => {
    vi.stubGlobal("matchMedia", undefined);
    const useQuery = createMediaQueryHook("(min-width: 640px)", true);

    const { result } = renderHook(() => useQuery());

    expect(result.current).toBe(true);
  });
});
