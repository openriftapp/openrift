import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { useCardDesignerStore } from "@/features/designer/stores/card-designer-store";
import { createStoreResetter } from "@/test/store-helpers";

import { useImageUpload } from "./use-image-upload";

const reset = createStoreResetter(useCardDesignerStore);

beforeEach(reset);
afterEach(reset);

describe("useImageUpload", () => {
  it("rejects a non-image file and leaves the store empty", async () => {
    const { result } = renderHook(() => useImageUpload());

    await act(async () => {
      await result.current.handleFile(
        new File(["not an image"], "doc.pdf", { type: "application/pdf" }),
      );
    });

    expect(result.current.error).toMatch(/image/iu);
    expect(useCardDesignerStore.getState().background.dataUrl).toBeNull();
  });
});
