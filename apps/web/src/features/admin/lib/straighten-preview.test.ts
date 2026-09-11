import type { ImageQuad } from "@openrift/shared/contracts/admin/card-images";
import { describe, expect, it } from "vitest";

import { previewSize } from "@/features/admin/lib/straighten-preview";

function rect(width: number, height: number): ImageQuad {
  return [
    { x: 0, y: 0 },
    { x: width, y: 0 },
    { x: width, y: height },
    { x: 0, y: height },
  ];
}

describe("previewSize", () => {
  it("keeps a small quad at its straightened size", () => {
    expect(previewSize(rect(200, 280))).toEqual({ width: 200, height: 280 });
  });

  it("fits a large portrait quad to the long edge", () => {
    expect(previewSize(rect(3000, 4000))).toEqual({ width: 258, height: 360 });
  });

  it("fits a large landscape quad to the long edge", () => {
    expect(previewSize(rect(4000, 3000))).toEqual({ width: 360, height: 258 });
  });

  it("never returns a zero dimension", () => {
    const point = rect(0, 0);
    expect(previewSize(point)).toEqual({ width: 1, height: 1 });
  });
});
