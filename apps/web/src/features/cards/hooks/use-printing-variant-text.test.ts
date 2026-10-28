import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { stubPrinting } from "@/test/factories";

vi.mock("@/hooks/use-enums", () => ({
  useEnumOrders: () => ({
    labels: {
      artVariants: { normal: "Normal", altart: "Alt Art" },
      finishes: { normal: "Normal", foil: "Foil" },
      cardSizes: { standard: "Standard" },
    },
  }),
}));

// oxlint-disable-next-line import/first -- must import after vi.mock
import { usePrintingVariantText } from "./use-printing-variant-text";

function otherSide(shortCode: string) {
  return {
    faceId: `face-${shortCode}`,
    cardId: "recruit",
    cardName: "Recruit",
    cardSlug: "recruit",
    shortCode,
  };
}

describe("usePrintingVariantText", () => {
  it("names a plain printing by its code", () => {
    const { result } = renderHook(() => usePrintingVariantText());
    expect(result.current(stubPrinting({ shortCode: "OGN-042" }))).toBe("OGN-042");
  });

  it("adds the parts that tell siblings apart", () => {
    const normal = stubPrinting({ shortCode: "OGN-042", finish: "normal", language: "EN" });
    const foil = stubPrinting({ shortCode: "OGN-042", finish: "foil", language: "FR" });
    const { result } = renderHook(() => usePrintingVariantText());

    expect(result.current(foil, [normal, foil])).toBe("OGN-042 · FR · Foil");
  });

  it("names a token by its other side when two share the side's name", () => {
    const first = stubPrinting({ shortCode: "OGN", otherSide: otherSide("OGN-271") });
    const second = stubPrinting({ shortCode: "OGN", otherSide: otherSide("OGN-272") });
    const { result } = renderHook(() => usePrintingVariantText());

    expect(result.current(second, [first, second])).toBe("OGN · with Recruit (OGN-272)");
  });
});
