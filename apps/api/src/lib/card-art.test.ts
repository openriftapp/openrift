import { describe, expect, it } from "vitest";

import { toCardArt } from "./card-art.js";

describe("toCardArt", () => {
  it("marks images in the landscape set", () => {
    expect(toCardArt("img-bf", new Set(["img-bf"]))).toEqual({
      imageId: "img-bf",
      landscape: true,
    });
  });

  it("leaves other images portrait", () => {
    expect(toCardArt("img-unit", new Set(["img-bf"]))).toEqual({
      imageId: "img-unit",
      landscape: false,
    });
  });
});
