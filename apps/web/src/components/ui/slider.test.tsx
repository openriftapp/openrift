import { act, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { Slider } from "./slider";

const observers: { callback: ResizeObserverCallback; targets: Element[] }[] = [];
let width = 0;

class FakeResizeObserver {
  private readonly entry: { callback: ResizeObserverCallback; targets: Element[] };
  constructor(callback: ResizeObserverCallback) {
    this.entry = { callback, targets: [] };
    observers.push(this.entry);
  }
  observe(target: Element) {
    this.entry.targets.push(target);
  }
  unobserve() {}
  disconnect() {
    this.entry.targets = [];
  }
}

function fakeRect(element: Element): DOMRect {
  const slot = element instanceof HTMLElement ? element.dataset.slot : undefined;
  const w = width === 0 ? 0 : slot === "slider-thumb" ? 12 : width;
  return { x: 0, y: 0, top: 0, left: 0, bottom: 0, right: w, width: w, height: 0, toJSON() {} };
}

function thumbs(container: HTMLElement): HTMLElement[] {
  return [...container.querySelectorAll<HTMLElement>('[data-slot="slider-thumb"]')];
}

beforeEach(() => {
  observers.length = 0;
  width = 0;
  vi.stubGlobal("ResizeObserver", FakeResizeObserver);
  vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(function measuredRect(
    this: Element,
  ) {
    return fakeRect(this);
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("Slider", () => {
  it("renders one thumb for a numeric value", () => {
    const { container } = render(<Slider aria-label="Zoom" min={1} max={3} value={2} />);

    expect(thumbs(container)).toHaveLength(1);
  });

  it("renders one thumb for a numeric default value", () => {
    const { container } = render(<Slider aria-label="Zoom" defaultValue={5} />);

    expect(thumbs(container)).toHaveLength(1);
  });

  it("renders one thumb per array entry", () => {
    const { container } = render(<Slider aria-label="Max energy" defaultValue={[3]} max={10} />);

    expect(thumbs(container)).toHaveLength(1);
  });

  it("renders a range of two thumbs when no value is given", () => {
    const { container } = render(<Slider aria-label="Energy range" />);

    expect(thumbs(container)).toHaveLength(2);
  });

  it("shows its thumbs once a control that mounted hidden gets a width", async () => {
    const { container } = render(
      <Slider aria-label="Energy range" min={0} max={10} value={[2, 8]} />,
    );
    await act(async () => {
      await Promise.resolve();
    });

    width = 200;
    await act(async () => {
      for (const { callback, targets } of observers) {
        if (targets.length > 0) {
          callback([], {} as ResizeObserver);
        }
      }
      await Promise.resolve();
    });

    expect(thumbs(container)).toHaveLength(2);
    for (const thumb of thumbs(container)) {
      expect(thumb.style.visibility).toBe("");
    }
  });
});
