import { describe, expect, it } from "vitest";

import { hoverPreviewImage } from "./hover-preview";

describe("hoverPreviewImage", () => {
  it("returns null without an image", () => {
    expect(hoverPreviewImage(null, ["unit"])).toBeNull();
    expect(hoverPreviewImage(undefined, ["unit"])).toBeNull();
  });

  it("builds the thumbnail and full image of a portrait card", () => {
    expect(hoverPreviewImage("img-1", ["unit"])).toEqual({
      thumbnailUrl: "/media/cards/img-1-400w.webp",
      fullUrl: "/media/cards/img-1-full.webp",
      landscape: false,
    });
  });

  it("shows battlefields in landscape", () => {
    expect(hoverPreviewImage("img-2", ["battlefield"])?.landscape).toBe(true);
  });
});
