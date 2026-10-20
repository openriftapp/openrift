import { describe, expect, it } from "vitest";

import { imagesOnSide } from "./printing-side-images";

describe("imagesOnSide", () => {
  const images = [
    { id: "bird-art", printingId: "pair", face: "front" as const },
    { id: "gold-art", printingId: "pair", face: "back" as const },
    { id: "other", printingId: "solo", face: "front" as const },
  ];

  it("returns the second side's images for a printing shown from side 2", () => {
    expect(imagesOnSide(images, { id: "pair", side: 2 }).map((image) => image.id)).toEqual([
      "gold-art",
    ]);
  });

  it("returns the first side's images otherwise", () => {
    expect(imagesOnSide(images, { id: "pair", side: 1 }).map((image) => image.id)).toEqual([
      "bird-art",
    ]);
  });
});
