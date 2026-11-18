// @vitest-environment happy-dom
import type { ImageQuad } from "@openrift/shared/contracts/admin/card-images";
import { describe, expect, it, vi } from "vitest";

import { previewSize, readPreviewSource } from "@/features/admin/lib/straighten-preview";

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

describe("readPreviewSource", () => {
  it("logs why it has no preview when the canvas refuses to give up its pixels", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const tainted = new DOMException("The canvas has been tainted", "SecurityError");
    const context = {
      drawImage: vi.fn(),
      getImageData: () => {
        throw tainted;
      },
    };
    const canvas = { width: 0, height: 0, getContext: () => context };
    const create = vi.spyOn(document, "createElement").mockReturnValue(canvas as never);

    const image = { naturalWidth: 400, naturalHeight: 560 } as HTMLImageElement;

    expect(readPreviewSource(image)).toBeNull();
    expect(warn).toHaveBeenCalledWith(expect.any(String), tainted);
    create.mockRestore();
    warn.mockRestore();
  });
});
