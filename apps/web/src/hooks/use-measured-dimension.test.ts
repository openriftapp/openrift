import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useMeasuredDimension } from "./use-measured-dimension";
import { useMeasuredHeight } from "./use-measured-height";

type ObserverCallback = (entries: ResizeObserverEntry[]) => void;

function stubResizeObserver() {
  const state: { callback: ObserverCallback | null; observed: Element[]; disconnected: number } = {
    callback: null,
    observed: [],
    disconnected: 0,
  };
  vi.stubGlobal(
    "ResizeObserver",
    class {
      constructor(callback: ObserverCallback) {
        state.callback = callback;
      }
      observe(el: Element) {
        state.observed.push(el);
      }
      unobserve() {}
      disconnect() {
        state.disconnected += 1;
      }
    },
  );
  return state;
}

function entry(width: number, height: number): ResizeObserverEntry {
  return {
    borderBoxSize: [{ inlineSize: width, blockSize: height }],
    contentRect: { width, height } as DOMRectReadOnly,
  } as unknown as ResizeObserverEntry;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("useMeasuredDimension", () => {
  it("publishes the block size for height, rounded", () => {
    const observer = stubResizeObserver();
    const el = document.createElement("div");
    const { result } = renderHook(() => useMeasuredDimension(el, "height"));

    act(() => observer.callback?.([entry(800, 47.6)]));

    expect(result.current).toBe(48);
  });

  it("publishes the inline size for width", () => {
    const observer = stubResizeObserver();
    const el = document.createElement("div");
    const { result } = renderHook(() => useMeasuredDimension(el, "width"));

    act(() => observer.callback?.([entry(320.2, 40)]));

    expect(result.current).toBe(320);
  });

  it("falls back to contentRect height when borderBoxSize is empty", () => {
    const observer = stubResizeObserver();
    const el = document.createElement("div");
    const { result } = renderHook(() => useMeasuredHeight(el));

    act(() =>
      observer.callback?.([
        {
          borderBoxSize: [],
          contentRect: { width: 0, height: 56 } as DOMRectReadOnly,
        } as unknown as ResizeObserverEntry,
      ]),
    );

    expect(result.current).toBe(56);
  });

  it("observes nothing and returns 0 for a null element", () => {
    const observer = stubResizeObserver();
    const { result } = renderHook(() => useMeasuredHeight(null));

    expect(result.current).toBe(0);
    expect(observer.observed).toEqual([]);
  });

  it("re-observes a new element and resets to 0 when it goes away", () => {
    const observer = stubResizeObserver();
    const first = document.createElement("div");
    const second = document.createElement("div");
    const { result, rerender } = renderHook(({ node }) => useMeasuredHeight(node), {
      initialProps: { node: first as HTMLElement | null },
    });
    act(() => observer.callback?.([entry(0, 64)]));

    rerender({ node: second });
    expect(observer.observed).toEqual([first, second]);
    expect(observer.disconnected).toBe(1);

    rerender({ node: null });
    expect(result.current).toBe(0);
  });
});
