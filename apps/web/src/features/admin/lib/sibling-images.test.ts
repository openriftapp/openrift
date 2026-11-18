import type {
  AdminPrintingImageResponse,
  AdminPrintingResponse,
} from "@openrift/shared/types/api/admin";
import { describe, expect, it } from "vitest";

import { siblingImagesOf } from "./sibling-images";

function image(printingId: string, imageFileId: string, isActive: boolean) {
  return { printingId, imageFileId, isActive } as AdminPrintingImageResponse;
}

function printing(id: string, fallbackImageFileId: string | null = null) {
  return { id, expectedPrintingId: `${id}-code`, fallbackImageFileId } as AdminPrintingResponse;
}

describe("siblingImagesOf", () => {
  it("lists each file of the other faces once and leaves the face's own out", () => {
    const siblings = siblingImagesOf(
      [image("own", "file-own", true), image("b", "file-b", false), image("c", "file-b", false)],
      [printing("own"), printing("b"), printing("c")],
      new Set(["own"]),
    );
    expect(siblings).toEqual([{ imageFileId: "file-b", printingLabel: "b-code", inUse: false }]);
  });

  it("marks a file active on any other face as in use", () => {
    const siblings = siblingImagesOf(
      [image("b", "file-b", false), image("c", "file-b", true)],
      [printing("b"), printing("c")],
      new Set(["own"]),
    );
    expect(siblings[0]?.inUse).toBe(true);
  });

  it("marks a file another face pins as fallback art as in use", () => {
    const siblings = siblingImagesOf(
      [image("b", "file-b", false)],
      [printing("b", "file-b")],
      new Set(["own"]),
    );
    expect(siblings[0]?.inUse).toBe(true);
  });
});
