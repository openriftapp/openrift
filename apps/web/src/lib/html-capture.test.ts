// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { createRenderHandoff } from "./html-capture";

function target(...imageSources: string[]): HTMLElement {
  const element = document.createElement("div");
  for (const src of imageSources) {
    const image = document.createElement("img");
    image.src = src;
    element.append(image);
  }
  return element;
}

async function settled(promise: Promise<unknown>): Promise<boolean> {
  let done = false;
  void promise.then(() => {
    done = true;
    return done;
  });
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
  return done;
}

describe("createRenderHandoff", () => {
  const decodes = new Map<string, { resolve: () => void; reject: () => void }>();

  beforeEach(() => {
    Object.defineProperty(document, "fonts", {
      configurable: true,
      value: { ready: Promise.resolve() },
    });
    Object.defineProperty(HTMLImageElement.prototype, "decode", {
      configurable: true,
      value: function decode(this: HTMLImageElement) {
        return new Promise<void>((resolve, reject) => {
          decodes.set(this.getAttribute("src") ?? "", {
            resolve,
            reject: () => reject(new Error("decode failed")),
          });
        });
      },
    });
  });

  afterEach(() => {
    decodes.clear();
    Reflect.deleteProperty(HTMLImageElement.prototype, "decode");
    Reflect.deleteProperty(document, "fonts");
  });

  it("resolves with the element rendered for the awaited key, not a stale one", async () => {
    const handoff = createRenderHandoff();
    handoff.report("card-a", target());
    const waiting = handoff.waitFor("card-b");
    expect(await settled(waiting)).toBe(false);

    const cardB = target();
    handoff.report("card-b", cardB);

    await expect(waiting).resolves.toBe(cardB);
  });

  it("waits for the target's images to decode", async () => {
    const handoff = createRenderHandoff();
    const element = target("/art.webp");
    handoff.report("card-a", element);
    const waiting = handoff.waitFor("card-a");
    expect(await settled(waiting)).toBe(false);

    decodes.get("/art.webp")?.resolve();

    await expect(waiting).resolves.toBe(element);
  });

  it("does not stall on an image that fails to decode", async () => {
    const handoff = createRenderHandoff();
    const element = target("/missing.webp");
    handoff.report("card-a", element);
    const waiting = handoff.waitFor("card-a");

    decodes.get("/missing.webp")?.reject();

    await expect(waiting).resolves.toBe(element);
  });

  it("forgets an element once it unmounts", async () => {
    const handoff = createRenderHandoff();
    const cleanup = handoff.report("card-a", target());
    cleanup?.();

    expect(await settled(handoff.waitFor("card-a"))).toBe(false);
  });
});
