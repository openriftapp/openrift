import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useScrolledPast } from "./use-scrolled-past";

let frames: FrameRequestCallback[] = [];

function scrollTo(y: number) {
  Object.defineProperty(globalThis, "scrollY", { value: y, configurable: true, writable: true });
  globalThis.dispatchEvent(new Event("scroll"));
  for (const frame of frames.splice(0)) {
    frame(0);
  }
}

describe("useScrolledPast", () => {
  beforeEach(() => {
    frames = [];
    vi.spyOn(globalThis, "requestAnimationFrame").mockImplementation((callback) => {
      frames.push(callback);
      return frames.length;
    });
    scrollTo(0);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    scrollTo(0);
  });

  it("is false at the top of the page", () => {
    const { result } = renderHook(() => useScrolledPast(800));

    expect(result.current).toBe(false);
  });

  it("turns true past the threshold and false again on the way back", () => {
    const { result } = renderHook(() => useScrolledPast(800));

    act(() => scrollTo(800));
    expect(result.current).toBe(false);

    act(() => scrollTo(801));
    expect(result.current).toBe(true);

    act(() => scrollTo(100));
    expect(result.current).toBe(false);
  });

  it("reads the position on mount when the page is already scrolled", () => {
    scrollTo(2000);
    const { result } = renderHook(() => useScrolledPast(800));

    expect(result.current).toBe(true);
  });

  it("stops listening after unmount", () => {
    const { unmount } = renderHook(() => useScrolledPast(800));
    const remove = vi.spyOn(globalThis, "removeEventListener");

    unmount();

    expect(remove).toHaveBeenCalledWith("scroll", expect.any(Function));
  });
});
