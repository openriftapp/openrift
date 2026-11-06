// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { flyCardToDock } from "./workbench-fly-to-dock";

function rect(left: number, top: number, width: number, height: number): DOMRect {
  return {
    left,
    top,
    width,
    height,
    right: left + width,
    bottom: top + height,
    x: left,
    y: top,
    toJSON: () => ({}),
  };
}

let finish: (() => void) | undefined;

function mount(reducedMotion = false) {
  vi.stubGlobal("matchMedia", (query: string) => ({ matches: reducedMotion, media: query }));
  document.body.innerHTML = `
    <div data-printing-id="p-1"><img src="/card.webp" alt="Annie" /></div>
    <span data-deck-dock-target><span class="ring"></span></span>`;
  const image = document.querySelector("img") as HTMLImageElement;
  const ring = document.querySelector(".ring") as HTMLElement;
  image.getBoundingClientRect = () => rect(100, 100, 200, 280);
  ring.getBoundingClientRect = () => rect(20, 800, 32, 32);
  HTMLElement.prototype.animate = vi.fn(() => {
    const listeners: Record<string, () => void> = {};
    finish = () => listeners.finish?.();
    return {
      addEventListener: (type: string, fn: () => void) => {
        listeners[type] = fn;
      },
    } as unknown as Animation;
  });
}

beforeEach(() => {
  finish = undefined;
});

afterEach(() => {
  vi.unstubAllGlobals();
  document.body.innerHTML = "";
});

describe("flyCardToDock", () => {
  it("flies a copy of the card image toward the dock and removes it on finish", () => {
    mount();
    flyCardToDock("p-1");
    const ghosts = document.querySelectorAll('img[aria-hidden="true"]');
    expect(ghosts).toHaveLength(1);
    expect(HTMLElement.prototype.animate).toHaveBeenCalledOnce();
    finish?.();
    expect(document.querySelectorAll('img[aria-hidden="true"]')).toHaveLength(0);
  });

  it("does nothing with reduced motion", () => {
    mount(true);
    flyCardToDock("p-1");
    expect(document.querySelectorAll("img")).toHaveLength(1);
  });

  it("does nothing when the card is not on screen", () => {
    mount();
    flyCardToDock("missing");
    expect(document.querySelectorAll("img")).toHaveLength(1);
  });
});
