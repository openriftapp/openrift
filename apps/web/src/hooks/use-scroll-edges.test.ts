import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { horizontalScrollEdges, useScrollEdges } from "./use-scroll-edges";

function scroller(metrics: { scrollLeft: number; scrollWidth: number; clientWidth: number }) {
  const element = document.createElement("div");
  element.append(document.createElement("div"));
  for (const [key, value] of Object.entries(metrics)) {
    Object.defineProperty(element, key, { value, configurable: true, writable: true });
  }
  return element;
}

describe("horizontalScrollEdges", () => {
  it("reports no hidden content when everything fits", () => {
    expect(horizontalScrollEdges({ scrollLeft: 0, scrollWidth: 300, clientWidth: 300 })).toEqual({
      start: false,
      end: false,
    });
  });

  it("reports the end edge at the start of an overflowing strip", () => {
    expect(horizontalScrollEdges({ scrollLeft: 0, scrollWidth: 600, clientWidth: 300 })).toEqual({
      start: false,
      end: true,
    });
  });

  it("reports both edges mid-scroll", () => {
    expect(horizontalScrollEdges({ scrollLeft: 150, scrollWidth: 600, clientWidth: 300 })).toEqual({
      start: true,
      end: true,
    });
  });

  it("ignores a sub-pixel remainder at either end", () => {
    expect(
      horizontalScrollEdges({ scrollLeft: 0.5, scrollWidth: 600, clientWidth: 300 }).start,
    ).toBe(false);
    expect(
      horizontalScrollEdges({ scrollLeft: 299.5, scrollWidth: 600, clientWidth: 300 }).end,
    ).toBe(false);
  });
});

describe("useScrollEdges", () => {
  const observed: Element[] = [];
  const disconnect = vi.fn();
  let resize: () => void = () => {};

  beforeEach(() => {
    vi.stubGlobal(
      "ResizeObserver",
      class {
        constructor(callback: () => void) {
          resize = callback;
        }
        observe(target: Element) {
          observed.push(target);
        }
        disconnect() {
          disconnect();
        }
      },
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    observed.length = 0;
    disconnect.mockClear();
  });

  it("starts with no hidden edges before a scroller attaches", () => {
    const { result } = renderHook(() => useScrollEdges());

    expect(result.current.edges).toEqual({ start: false, end: false });
  });

  it("measures the scroller as soon as it attaches", () => {
    const element = scroller({ scrollLeft: 0, scrollWidth: 600, clientWidth: 300 });
    const { result } = renderHook(() => useScrollEdges());

    act(() => result.current.ref(element));

    expect(result.current.edges).toEqual({ start: false, end: true });
    expect(observed).toEqual([element, element.firstElementChild]);
  });

  it("updates on scroll", () => {
    const element = scroller({ scrollLeft: 0, scrollWidth: 600, clientWidth: 300 });
    const { result } = renderHook(() => useScrollEdges());
    act(() => result.current.ref(element));

    act(() => {
      element.scrollLeft = 300;
      element.dispatchEvent(new Event("scroll"));
    });

    expect(result.current.edges).toEqual({ start: true, end: false });
  });

  it("updates when the strip resizes", () => {
    const element = scroller({ scrollLeft: 0, scrollWidth: 600, clientWidth: 300 });
    const { result } = renderHook(() => useScrollEdges());
    act(() => result.current.ref(element));

    act(() => {
      Object.defineProperty(element, "clientWidth", { value: 600, configurable: true });
      resize();
    });

    expect(result.current.edges).toEqual({ start: false, end: false });
  });

  it("stops listening when the scroller detaches", () => {
    const element = scroller({ scrollLeft: 0, scrollWidth: 600, clientWidth: 300 });
    const { result } = renderHook(() => useScrollEdges());
    act(() => result.current.ref(element));

    act(() => result.current.ref(null));
    act(() => {
      element.scrollLeft = 300;
      element.dispatchEvent(new Event("scroll"));
    });

    expect(disconnect).toHaveBeenCalledTimes(1);
    expect(result.current.edges).toEqual({ start: false, end: true });
  });
});
