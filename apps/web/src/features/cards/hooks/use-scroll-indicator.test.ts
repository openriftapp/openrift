import type { Virtualizer } from "@tanstack/react-virtual";
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { VRow } from "@/features/cards/lib/card-grid-types";
import { stubCardViewerItem } from "@/test/factories";

import { useScrollIndicator } from "./use-scroll-indicator";

const SCROLL_MARGIN = 1000;
const STICKY_OFFSET = 60;

const rows: VRow[] = [
  { kind: "cards", items: [stubCardViewerItem({ shortCode: "OGN-001" })], cardsBefore: 0 },
  { kind: "cards", items: [stubCardViewerItem({ shortCode: "OGN-007" })], cardsBefore: 6 },
];

function fakeVirtualizer(): Virtualizer<Window, Element> {
  return {
    getVirtualItems: () => [
      { index: 0, start: SCROLL_MARGIN, size: 300 },
      { index: 1, start: SCROLL_MARGIN + 300, size: 300 },
    ],
    getTotalSize: () => 4000,
    scrollToIndex: vi.fn(),
  } as unknown as Virtualizer<Window, Element>;
}

function scrollTo(y: number) {
  Object.defineProperty(globalThis, "scrollY", { value: y, configurable: true, writable: true });
  act(() => {
    globalThis.dispatchEvent(new Event("scroll"));
  });
}

function mount() {
  return renderHook(() =>
    useScrollIndicator({
      virtualRows: rows,
      rowStarts: [0, 300],
      virtualizer: fakeVirtualizer(),
      scrollMargin: SCROLL_MARGIN,
      multipleGroups: false,
      stickyOffset: STICKY_OFFSET,
    }),
  );
}

describe("useScrollIndicator", () => {
  const initialScrollY = globalThis.scrollY;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
      callback(0);
      return 1;
    });
    vi.stubGlobal("cancelAnimationFrame", vi.fn());
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    Object.defineProperty(globalThis, "scrollY", {
      value: initialScrollY,
      configurable: true,
      writable: true,
    });
  });

  it("shows the first visible card's code while scrolling through the grid", () => {
    const { result } = mount();
    scrollTo(1200);

    expect(result.current.indicator.visible).toBe(true);
    expect(result.current.indicator.cardId).toBe("OGN-001");
  });

  it("hides once the page scrolls back above the grid", () => {
    const { result } = mount();
    scrollTo(1200);
    expect(result.current.indicator.visible).toBe(true);

    scrollTo(SCROLL_MARGIN - STICKY_OFFSET - 200);

    expect(result.current.indicator.visible).toBe(false);
  });

  it("stays hidden above the grid without a pending hide timer", () => {
    const { result } = mount();
    scrollTo(100);

    expect(result.current.indicator.visible).toBe(false);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("hides after the idle delay", () => {
    const { result } = mount();
    scrollTo(1200);

    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(result.current.indicator.visible).toBe(false);
  });
});
