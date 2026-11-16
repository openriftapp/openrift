import { fireEvent, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { CollectCardFan } from "./card-fan";

const IMAGE_URLS = [
  "https://img.example/a.webp",
  "https://img.example/b.webp",
  "https://img.example/c.webp",
  "https://img.example/d.webp",
  "https://img.example/e.webp",
];

function finishFlyAways(container: HTMLElement) {
  for (const card of container.querySelectorAll(".animate-fly-away")) {
    fireEvent.animationEnd(card);
  }
}

describe("CollectCardFan", () => {
  let reducedMotion = false;
  const nativeMatchMedia = globalThis.matchMedia;

  beforeEach(() => {
    reducedMotion = false;
    globalThis.matchMedia = ((query: string) => ({
      matches: query.includes("reduce") && reducedMotion,
      addEventListener: () => {},
      removeEventListener: () => {},
    })) as unknown as typeof matchMedia;
  });

  afterEach(() => {
    globalThis.matchMedia = nativeMatchMedia;
  });

  it("renders nothing until image URLs are available", () => {
    const { container } = render(<CollectCardFan imageUrls={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it("renders one card button per fanned image", () => {
    const { container } = render(<CollectCardFan imageUrls={IMAGE_URLS} />);
    expect(container.querySelectorAll("button").length).toBe(IMAGE_URLS.length);
  });

  it("keeps the fan cards out of the keyboard tab order", () => {
    const { container } = render(<CollectCardFan imageUrls={IMAGE_URLS} />);
    const buttons = container.querySelectorAll("button");
    expect(buttons.length).toBeGreaterThan(0);
    for (const button of buttons) {
      expect(button.tabIndex).toBe(-1);
    }
  });

  it("fires onAllCollected when the last card's fly-away animation ends", () => {
    const onAllCollected = vi.fn();
    const { container } = render(
      <CollectCardFan imageUrls={IMAGE_URLS} onAllCollected={onAllCollected} />,
    );
    for (const button of container.querySelectorAll("button")) {
      fireEvent.click(button);
    }
    expect(onAllCollected).not.toHaveBeenCalled();

    finishFlyAways(container);

    expect(onAllCollected).toHaveBeenCalledTimes(1);
    expect(container.querySelectorAll("button")).toHaveLength(0);
  });

  it("does not fire onAllCollected while cards remain", () => {
    const onAllCollected = vi.fn();
    const { container } = render(
      <CollectCardFan imageUrls={IMAGE_URLS} onAllCollected={onAllCollected} />,
    );
    const firstButton = container.querySelector("button");
    expect(firstButton).not.toBeNull();
    fireEvent.click(firstButton as HTMLButtonElement);

    finishFlyAways(container);

    expect(onAllCollected).not.toHaveBeenCalled();
    expect(container.querySelectorAll("button")).toHaveLength(IMAGE_URLS.length - 1);
  });

  it("ignores the deal-in animation ending", () => {
    const { container } = render(<CollectCardFan imageUrls={IMAGE_URLS} />);

    for (const card of container.querySelectorAll(".animate-fly-in")) {
      fireEvent.animationEnd(card);
    }

    expect(container.querySelectorAll("button")).toHaveLength(IMAGE_URLS.length);
  });

  it("collects at once when the viewer prefers reduced motion", () => {
    reducedMotion = true;
    const onAllCollected = vi.fn();
    const { container } = render(
      <CollectCardFan imageUrls={IMAGE_URLS} onAllCollected={onAllCollected} />,
    );
    for (const button of container.querySelectorAll("button")) {
      fireEvent.click(button);
    }

    expect(onAllCollected).toHaveBeenCalledTimes(1);
    expect(container.querySelectorAll("button")).toHaveLength(0);
  });
});
