import { render } from "@testing-library/react";
import { createRef } from "react";
import { describe, expect, it } from "vitest";

import { ImageHoverPreview } from "./printing-hover-preview";

function anchorAt(left: number, top: number) {
  const anchor = document.createElement("div");
  anchor.getBoundingClientRect = () =>
    ({ left, right: left + 100, top, bottom: top + 40, width: 100, height: 40 }) as DOMRect;
  const ref = createRef<HTMLElement>();
  (ref as { current: HTMLElement | null }).current = anchor;
  return ref;
}

function previewElement(): HTMLElement | null {
  return document.body.querySelector<HTMLElement>("div.fixed");
}

describe("ImageHoverPreview", () => {
  it("positions a preview that appears after an imageless entry, without a remount", () => {
    const anchorRef = anchorAt(20, 300);
    const { rerender } = render(
      <ImageHoverPreview
        thumbnailUrl={null}
        fullUrl={null}
        landscape={false}
        anchorRef={anchorRef}
      />,
    );
    expect(previewElement()).toBeNull();

    rerender(
      <ImageHoverPreview
        thumbnailUrl="/thumb.webp"
        fullUrl="/full.webp"
        landscape={false}
        anchorRef={anchorRef}
      />,
    );

    const preview = previewElement();
    expect(preview?.style.left).toMatch(/px$/u);
    expect(preview?.style.top).toMatch(/px$/u);
  });

  it("re-positions for the next printing when its anchor moved", () => {
    const root = document.documentElement;
    Object.defineProperty(root, "clientWidth", { configurable: true, value: 1600 });
    Object.defineProperty(root, "clientHeight", { configurable: true, value: 1200 });
    const anchorRef = anchorAt(20, 300);
    const { rerender } = render(
      <ImageHoverPreview
        thumbnailUrl="/a.webp"
        fullUrl={null}
        landscape={false}
        anchorRef={anchorRef}
      />,
    );
    const firstLeft = previewElement()?.style.left;

    (anchorRef as { current: HTMLElement | null }).current = anchorAt(600, 300).current;
    rerender(
      <ImageHoverPreview
        thumbnailUrl="/b.webp"
        fullUrl={null}
        landscape={false}
        anchorRef={anchorRef}
      />,
    );

    expect(firstLeft).toBe("132px");
    expect(previewElement()?.style.left).toBe("712px");
    Reflect.deleteProperty(root, "clientWidth");
    Reflect.deleteProperty(root, "clientHeight");
  });
});
