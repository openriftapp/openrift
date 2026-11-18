import type { AdminPrintingImageResponse } from "@openrift/shared/types/api/admin";
import { describe, expect, it } from "vitest";

import { printingImageDisplayUrl } from "./printing-image-display-url";

function image(overrides: Partial<AdminPrintingImageResponse>): AdminPrintingImageResponse {
  return {
    id: "fi-1",
    printingId: "p-1",
    imageFileId: "if-1",
    face: "front",
    originalUrl: "https://example.com/jinx.png",
    rehostedUrl: "/media/cards/f1/if-1",
    rotation: 90,
    needsTrim: true,
    quad: null,
    isActive: true,
    activateWhenRehosted: false,
    rehostFailure: null,
    ...overrides,
  };
}

describe("printingImageDisplayUrl", () => {
  it("shows the full variant of a rehosted file at its own path", () => {
    expect(printingImageDisplayUrl(image({}))).toBe("/media/cards/f1/if-1-full.webp");
  });

  it("shows the source URL before the file is rehosted", () => {
    expect(printingImageDisplayUrl(image({ rehostedUrl: null }))).toBe(
      "https://example.com/jinx.png",
    );
  });
});
