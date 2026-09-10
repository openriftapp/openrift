import { describe, expect, it } from "vitest";

import {
  activeFrontImage,
  displayPrintingImage,
  printingImageSrc,
  siblingArtOptions,
} from "@/features/catalog-admin/lib/printing-images";
import { makeAdminPrinting, makeAdminPrintingImage } from "@/test/factories";

describe("printingImageSrc", () => {
  it("returns the external address for an image that was never rehosted", () => {
    const image = makeAdminPrintingImage({
      rehostedUrl: null,
      originalUrl: "https://cdn.example.test/ogn-001.png",
    });
    expect(printingImageSrc(image, "120w")).toBe("https://cdn.example.test/ogn-001.png");
  });

  it("busts the cache with the rotation and trim of a rehosted file", () => {
    const image = makeAdminPrintingImage({
      imageFileId: "0123456789abcdef",
      rehostedUrl: "/media/cards/ef/0123456789abcdef",
      rotation: 90,
      needsTrim: true,
    });
    expect(printingImageSrc(image, "240w")).toBe(
      "/media/cards/ef/0123456789abcdef-240w.webp?r=90&t=1&q=0",
    );
  });

  it("changes the address when the image is rotated", () => {
    const image = makeAdminPrintingImage({ rehostedUrl: "/media/cards/aa/aa" });
    const before = printingImageSrc(image, "120w");
    expect(printingImageSrc({ ...image, rotation: 180 }, "120w")).not.toBe(before);
  });
});

describe("activeFrontImage", () => {
  it("ignores an active back scan", () => {
    const back = makeAdminPrintingImage({ printingId: "p-1", face: "back", isActive: true });
    expect(activeFrontImage("p-1", [back])).toBeUndefined();
  });

  it("finds the active front image", () => {
    const front = makeAdminPrintingImage({ printingId: "p-1", face: "front", isActive: true });
    const back = makeAdminPrintingImage({ printingId: "p-1", face: "back", isActive: true });
    expect(activeFrontImage("p-1", [back, front])).toBe(front);
  });
});

describe("displayPrintingImage", () => {
  it("prefers the front face when both faces are active", () => {
    const back = makeAdminPrintingImage({ printingId: "p-1", face: "back", isActive: true });
    const front = makeAdminPrintingImage({ printingId: "p-1", face: "front", isActive: true });
    expect(displayPrintingImage("p-1", [back, front])).toBe(front);
  });

  it("falls back to an active back scan", () => {
    const back = makeAdminPrintingImage({ printingId: "p-1", face: "back", isActive: true });
    expect(displayPrintingImage("p-1", [back])).toBe(back);
  });

  it("ignores inactive images and other printings", () => {
    const inactive = makeAdminPrintingImage({ printingId: "p-1", isActive: false });
    const other = makeAdminPrintingImage({ printingId: "p-2", isActive: true });
    expect(displayPrintingImage("p-1", [inactive, other])).toBeUndefined();
  });
});

describe("siblingArtOptions", () => {
  it("labels each sibling file once, by the printing that owns it", () => {
    const lux = makeAdminPrinting({ id: "p-1", expectedPrintingId: "EN:OGN-001" });
    const luxFoil = makeAdminPrinting({ id: "p-2", expectedPrintingId: "EN:OGN-001-foil" });
    const shared = makeAdminPrintingImage({ printingId: "p-2", imageFileId: "file-a" });
    const alsoShared = makeAdminPrintingImage({ printingId: "p-2", imageFileId: "file-a" });
    const own = makeAdminPrintingImage({ printingId: "p-1", imageFileId: "file-own" });

    expect(siblingArtOptions("p-1", [lux, luxFoil], [own, shared, alsoShared])).toEqual([
      { imageFileId: "file-a", label: "EN:OGN-001-foil" },
    ]);
  });
});
