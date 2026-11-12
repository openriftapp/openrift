import { describe, expect, it, vi } from "vitest";

import { faceForNewImage } from "./image-face.js";

function repos(side: 1 | 2 | undefined) {
  return {
    catalogMutations: { sideOfFace: vi.fn(async () => side) },
    printingImages: { faceForShortCode: vi.fn(async () => "back" as const) },
  };
}

describe("faceForNewImage", () => {
  it("puts the image on the side the named face is on now", async () => {
    const r = repos(2);
    expect(await faceForNewImage(r as never, "p-1", { faceId: "face-gold" })).toBe("back");
    expect(r.catalogMutations.sideOfFace).toHaveBeenCalledWith("p-1", "face-gold");
    expect(await faceForNewImage(repos(1) as never, "p-1", { faceId: "face-bird" })).toBe("front");
  });

  it("404s a face that is not on the printing", async () => {
    await expect(
      faceForNewImage(repos(undefined) as never, "p-1", { faceId: "face-x" }),
    ).rejects.toMatchObject({ status: 404 });
  });

  it("falls back to the side whose short code matches", async () => {
    const r = repos(1);
    expect(await faceForNewImage(r as never, "p-1", { shortCode: "OGN-T05" })).toBe("back");
    expect(r.printingImages.faceForShortCode).toHaveBeenCalledWith("p-1", "OGN-T05");
  });
});
