import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useIsStuck } from "./use-is-stuck";

function stickyElement(top: string): { el: HTMLDivElement; setRectTop: (value: number) => void } {
  const el = document.createElement("div");
  el.style.top = top;
  document.body.append(el);
  let rectTop = 0;
  // jsdom does not lay out, so the rect is stubbed.
  el.getBoundingClientRect = () => ({ top: rectTop }) as DOMRect;
  return {
    el,
    setRectTop: (value) => {
      rectTop = value;
    },
  };
}

let frames: FrameRequestCallback[] = [];

function fire(type: "scroll" | "resize"): void {
  act(() => {
    globalThis.dispatchEvent(new Event(type));
    const pending = frames;
    frames = [];
    for (const callback of pending) {
      callback(0);
    }
  });
}

describe("useIsStuck", () => {
  beforeEach(() => {
    frames = [];
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
      frames.push(callback);
      return frames.length;
    });
    vi.stubGlobal("cancelAnimationFrame", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    document.body.innerHTML = "";
  });

  it("is false while the element sits below its pinned offset", () => {
    const { el, setRectTop } = stickyElement("100px");
    setRectTop(240);

    const { result } = renderHook(() => useIsStuck(el));

    expect(result.current).toBe(false);
  });

  it("turns true once scrolling brings the element to its pinned offset, and false again on the way back", () => {
    const { el, setRectTop } = stickyElement("100px");
    setRectTop(240);
    const { result } = renderHook(() => useIsStuck(el));

    setRectTop(100);
    fire("scroll");
    expect(result.current).toBe(true);

    setRectTop(180);
    fire("scroll");
    expect(result.current).toBe(false);
  });

  it("rechecks on resize", () => {
    const { el, setRectTop } = stickyElement("100px");
    setRectTop(240);
    const { result } = renderHook(() => useIsStuck(el));

    setRectTop(99.8);
    fire("resize");

    expect(result.current).toBe(true);
  });

  it("is false without an element", () => {
    const { result } = renderHook(() => useIsStuck(null));

    expect(result.current).toBe(false);
  });

  it("stops listening after unmount", () => {
    const { el } = stickyElement("100px");
    const remove = vi.spyOn(globalThis, "removeEventListener");
    const { unmount } = renderHook(() => useIsStuck(el));

    unmount();

    expect(remove).toHaveBeenCalledWith("scroll", expect.any(Function));
    expect(remove).toHaveBeenCalledWith("resize", expect.any(Function));
  });
});
