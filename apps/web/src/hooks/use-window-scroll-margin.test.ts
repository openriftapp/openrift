import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useWindowScrollMargin } from "./use-window-scroll-margin";

const observer = {
  callback: null as (() => void) | null,
  observed: [] as Element[],
  disconnected: 0,
};

function elementAt(top: number): { el: HTMLElement; move: (next: number) => void } {
  const el = document.createElement("div");
  let current = top;
  el.getBoundingClientRect = () => ({ top: current }) as DOMRect;
  return { el, move: (next) => (current = next) };
}

beforeEach(() => {
  observer.callback = null;
  observer.observed = [];
  observer.disconnected = 0;
  vi.stubGlobal("scrollY", 0);
  vi.stubGlobal(
    "ResizeObserver",
    class {
      constructor(callback: () => void) {
        observer.callback = callback;
      }
      observe(el: Element) {
        observer.observed.push(el);
      }
      unobserve() {}
      disconnect() {
        observer.disconnected += 1;
      }
    },
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("useWindowScrollMargin", () => {
  it("adds the window scroll to the element's top", () => {
    vi.stubGlobal("scrollY", 200);
    const { el } = elementAt(120.4);

    const { result } = renderHook(() => useWindowScrollMargin(el));

    expect(result.current).toBe(320);
  });

  it("adds `extra` on top of the measured offset", () => {
    const { el } = elementAt(100);

    const { result } = renderHook(() => useWindowScrollMargin(el, 36));

    expect(result.current).toBe(136);
  });

  it("re-measures when the body resizes", () => {
    const { el, move } = elementAt(100);
    const { result } = renderHook(() => useWindowScrollMargin(el));
    expect(observer.observed).toEqual([document.body]);

    move(148);
    act(() => observer.callback?.());

    expect(result.current).toBe(148);
  });

  it("seeds a new instance with the last measured top", () => {
    const { el } = elementAt(90);
    renderHook(() => useWindowScrollMargin(el));

    const { result } = renderHook(() => useWindowScrollMargin(null, 10));

    expect(result.current).toBe(100);
  });

  it("disconnects on unmount", () => {
    const { el } = elementAt(0);
    const { unmount } = renderHook(() => useWindowScrollMargin(el));

    unmount();

    expect(observer.disconnected).toBe(1);
  });
});
