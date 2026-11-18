// @vitest-environment happy-dom
import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { edgeScrollDelta, isPointInRect, useDragAutoScroll } from "./use-drag-auto-scroll";

function container(overrides?: Partial<Parameters<typeof edgeScrollDelta>[0]>) {
  return {
    pointerY: 250,
    top: 0,
    bottom: 500,
    scrollTop: 500,
    scrollHeight: 1500,
    clientHeight: 500,
    ...overrides,
  };
}

describe("edgeScrollDelta", () => {
  it("stays still while the pointer is away from both edges", () => {
    expect(edgeScrollDelta(container())).toBe(0);
  });

  it("scrolls up near the top edge", () => {
    expect(edgeScrollDelta(container({ pointerY: 10 }))).toBeLessThan(0);
  });

  it("scrolls down near the bottom edge", () => {
    expect(edgeScrollDelta(container({ pointerY: 490 }))).toBeGreaterThan(0);
  });

  it("speeds up the closer the pointer gets to an edge", () => {
    const near = edgeScrollDelta(container({ pointerY: 495 }));
    const far = edgeScrollDelta(container({ pointerY: 470 }));
    expect(near).toBeGreaterThan(far);
  });

  it("caps the speed for a pointer past the edge", () => {
    const atEdge = edgeScrollDelta(container({ pointerY: 500 }));
    const beyond = edgeScrollDelta(container({ pointerY: 900 }));
    expect(beyond).toBe(atEdge);
  });

  it("does not scroll up when already at the top", () => {
    expect(edgeScrollDelta(container({ pointerY: 10, scrollTop: 0 }))).toBe(0);
  });

  it("does not scroll down when already at the bottom", () => {
    expect(edgeScrollDelta(container({ pointerY: 490, scrollTop: 1000 }))).toBe(0);
  });

  it("ignores containers with nothing to scroll", () => {
    expect(edgeScrollDelta(container({ pointerY: 490, scrollTop: 0, scrollHeight: 500 }))).toBe(0);
  });
});

describe("isPointInRect", () => {
  const rect = { top: 100, right: 400, bottom: 300, left: 200 };

  it("accepts a point inside", () => {
    expect(isPointInRect(300, 200, rect)).toBe(true);
  });

  it("accepts a point on the edge", () => {
    expect(isPointInRect(200, 100, rect)).toBe(true);
  });

  it("rejects points outside on every side", () => {
    expect(isPointInRect(199, 200, rect)).toBe(false);
    expect(isPointInRect(401, 200, rect)).toBe(false);
    expect(isPointInRect(300, 99, rect)).toBe(false);
    expect(isPointInRect(300, 301, rect)).toBe(false);
  });
});

describe("useDragAutoScroll canScroll", () => {
  function mountSidebar() {
    const sidebar = document.createElement("div");
    sidebar.dataset.slot = "sidebar-content";
    sidebar.getBoundingClientRect = () => DOMRect.fromRect({ x: 0, y: 0, width: 250, height: 800 });
    document.body.append(sidebar);
  }

  afterEach(() => {
    document.body.replaceChildren();
  });

  function canScrollAfterGrabAt(x: number, y: number) {
    const { result, unmount } = renderHook(() => useDragAutoScroll());
    act(() => {
      result.current.start(new MouseEvent("pointerdown", { clientX: x, clientY: y }));
    });
    const { canScroll } = result.current.autoScroll;
    unmount();
    return canScroll;
  }

  it("vetoes the page while the pointer is over the sidebar", () => {
    mountSidebar();
    expect(canScrollAfterGrabAt(100, 20)(document.documentElement)).toBe(false);
  });

  it("lets the page scroll while the pointer is over the main view", () => {
    mountSidebar();
    expect(canScrollAfterGrabAt(600, 20)(document.documentElement)).toBe(true);
  });

  it("lets the page scroll when there is no sidebar", () => {
    expect(canScrollAfterGrabAt(100, 20)(document.documentElement)).toBe(true);
  });

  it("always lets inner scroll containers scroll", () => {
    mountSidebar();
    expect(canScrollAfterGrabAt(100, 20)(document.createElement("div"))).toBe(true);
  });
});
