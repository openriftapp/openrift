// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { flyCardToDeck } from "./workbench-fly-to-dock";

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

describe("flyCardToDeck", () => {
  it("flies a copy of the card image toward the dock and removes it on finish", () => {
    mount();
    flyCardToDeck("p-1", "c-1", "main");
    const ghosts = document.querySelectorAll('img[aria-hidden="true"]');
    expect(ghosts).toHaveLength(1);
    expect(HTMLElement.prototype.animate).toHaveBeenCalledOnce();
    finish?.();
    expect(document.querySelectorAll('img[aria-hidden="true"]')).toHaveLength(0);
  });

  it("pulses only the card's row when it lands in the sidebar", () => {
    mount();
    document.querySelector("[data-deck-dock-target]")?.remove();
    document.body.insertAdjacentHTML(
      "beforeend",
      '<section data-slot="deck-zone" data-zone="main"><div data-deck-card-id="c-1"></div></section>',
    );
    const section = document.querySelector("section") as HTMLElement;
    const row = document.querySelector("[data-deck-card-id]") as HTMLElement;
    section.getBoundingClientRect = () => rect(900, 300, 300, 400);
    row.getBoundingClientRect = () => rect(900, 340, 300, 32);
    flyCardToDeck("p-1", "c-1", "main");
    finish?.();
    const animate = vi.mocked(HTMLElement.prototype.animate);
    expect(animate).toHaveBeenCalledTimes(2);
    expect(animate.mock.contexts[1]).toBe(row);
  });

  it("leaves the zone alone when a first copy's row is not there on landing", () => {
    mount();
    document.querySelector("[data-deck-dock-target]")?.remove();
    document.body.insertAdjacentHTML(
      "beforeend",
      '<section data-slot="deck-zone" data-zone="main"></section>',
    );
    const section = document.querySelector("section") as HTMLElement;
    section.getBoundingClientRect = () => rect(900, 300, 300, 400);
    flyCardToDeck("p-1", "c-1", "main");
    finish?.();
    expect(HTMLElement.prototype.animate).toHaveBeenCalledOnce();
  });

  it("does nothing with reduced motion", () => {
    mount(true);
    flyCardToDeck("p-1", "c-1", "main");
    expect(document.querySelectorAll("img")).toHaveLength(1);
  });

  it("does nothing when the card is not on screen", () => {
    mount();
    flyCardToDeck("missing", "c-1", "main");
    expect(document.querySelectorAll("img")).toHaveLength(1);
  });
});
