import type { AdminPrintingImageResponse } from "@openrift/shared/types/api/admin";
import { beforeEach, describe, expect, it } from "vitest";

import { makeAdminPrinting, resetIdCounter } from "@/test/factories";

import { CARD_RECORD_FIELDS, primaryCardImage } from "./record-fields";

beforeEach(() => {
  resetIdCounter();
});

function image(overrides: Partial<AdminPrintingImageResponse>): AdminPrintingImageResponse {
  return {
    id: "img",
    printingId: "p",
    imageFileId: "file",
    face: "front",
    originalUrl: "https://img.test/original.png",
    rehostedUrl: null,
    rotation: 0,
    needsTrim: false,
    needsLevels: false,
    isActive: true,
    activateWhenRehosted: false,
    isReviewed: false,
    addedAt: "2026-01-01T00:00:00.000Z",
    uploadedByName: null,
    fileInUseElsewhere: false,
    rehostFailure: null,
    ...overrides,
  };
}

describe("primaryCardImage", () => {
  it("takes the first active image by canonical rank", () => {
    const first = makeAdminPrinting({ id: "a", canonicalRank: 0 });
    const second = makeAdminPrinting({ id: "b", canonicalRank: 1 });
    expect(
      primaryCardImage(
        [second, first],
        [
          image({ printingId: "b", originalUrl: "https://img.test/b.png" }),
          image({ printingId: "a", isActive: false }),
        ],
      ),
    ).toBe("https://img.test/b.png");
    expect(primaryCardImage([first], [])).toBeNull();
  });
});

describe("CARD_RECORD_FIELDS", () => {
  it("lists the compared fields first, then the card-only ones", () => {
    expect(CARD_RECORD_FIELDS.map((entry) => entry.field)).toEqual([
      "name",
      "types",
      "superTypes",
      "domains",
      "might",
      "energy",
      "power",
      "mightBonus",
      "tags",
      "maxCopiesOverride",
      "additionalLegendCount",
      "comment",
    ]);
    expect(CARD_RECORD_FIELDS.filter((entry) => entry.comparable)).toHaveLength(9);
  });
});
