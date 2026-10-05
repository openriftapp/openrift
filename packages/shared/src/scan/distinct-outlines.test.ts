import { describe, expect, it } from "vitest";

import { distinctWholeOutlines } from "./distinct-outlines";
import { boxQuad } from "./test-images";
import type { Quad } from "./types";

const outline = (name: string, quad: Quad, score: number) => ({ name, quad, score });

const names = (outlines: { name: string }[]) => outlines.map((entry) => entry.name);

describe("distinctWholeOutlines", () => {
  it("keeps the strongest outline where outlines overlap", () => {
    const kept = distinctWholeOutlines([
      outline("weak", boxQuad(100, 100, 60, 84), 0.7),
      outline("strong", boxQuad(104, 102, 60, 84), 0.9),
    ]);
    expect(names(kept)).toEqual(["strong"]);
  });

  it("keeps two cards lying side by side", () => {
    const kept = distinctWholeOutlines([
      outline("left", boxQuad(100, 100, 60, 84), 0.8),
      outline("right", boxQuad(180, 100, 60, 84), 0.8),
    ]);
    expect(names(kept)).toEqual(["left", "right"]);
  });

  it("drops an art box inside a stronger card", () => {
    const kept = distinctWholeOutlines([
      outline("card", boxQuad(100, 100, 60, 84), 0.9),
      outline("art", boxQuad(110, 110, 40, 30), 0.65),
    ]);
    expect(names(kept)).toEqual(["card"]);
  });

  it("drops an outline under the floor before it can hide a card", () => {
    const kept = distinctWholeOutlines(
      [
        outline("weak", boxQuad(100, 100, 60, 84), 0.4),
        outline("card", boxQuad(104, 102, 60, 84), 0.6),
      ],
      { minScore: 0.5 },
    );
    expect(names(kept)).toEqual(["card"]);
  });

  it("keeps a weak outline when no floor is given", () => {
    const kept = distinctWholeOutlines([outline("weak", boxQuad(100, 100, 60, 84), 0.3)]);
    expect(names(kept)).toEqual(["weak"]);
  });

  it("drops an outline within 2% of the frame width of its edge", () => {
    const frame = { width: 1000, height: 800 };
    const kept = distinctWholeOutlines(
      [
        outline("cut", boxQuad(19, 100, 60, 84), 0.9),
        outline("whole", boxQuad(21, 300, 60, 84), 0.9),
      ],
      { frame },
    );
    expect(names(kept)).toEqual(["whole"]);
  });

  it("keeps an outline on the edge when no frame is given", () => {
    expect(names(distinctWholeOutlines([outline("edge", boxQuad(0, 0, 60, 84), 0.9)]))).toEqual([
      "edge",
    ]);
  });
});
