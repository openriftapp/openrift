import { describe, expect, it } from "vitest";

import { printingBlockTitle, printingKindLabel } from "@/features/admin/lib/printing-summary";
import { makeAdminPrinting } from "@/test/factories";

const kindLabels = {
  artVariants: { normal: "Normal", altart: "Alt art" },
  markers: { prerelease: "Prerelease", promo: "Promo" },
};

function basePrinting(overrides: Parameters<typeof makeAdminPrinting>[0] = {}) {
  return makeAdminPrinting({ artVariant: "normal", ...overrides });
}

describe("printingKindLabel", () => {
  it("calls a plain printing Base", () => {
    expect(printingKindLabel(basePrinting(), kindLabels)).toBe("Base");
  });

  it("names a signed printing", () => {
    expect(printingKindLabel(basePrinting({ isSigned: true }), kindLabels)).toBe("Signed");
  });

  it("names a signed and overnumbered printing Signature", () => {
    const printing = basePrinting({ isSigned: true, isOvernumbered: true });
    expect(printingKindLabel(printing, kindLabels)).toBe("Signature");
  });

  it("names an overnumbered printing", () => {
    expect(printingKindLabel(basePrinting({ isOvernumbered: true }), kindLabels)).toBe(
      "Overnumbered",
    );
  });

  it("appends the art variant and every marker", () => {
    const printing = basePrinting({
      artVariant: "altart",
      markerSlugs: ["prerelease", "promo"],
    });
    expect(printingKindLabel(printing, kindLabels)).toBe("Alt art · Prerelease · Promo");
  });

  it("falls back to the slug for an unknown marker", () => {
    const printing = basePrinting({ markerSlugs: ["launch-party"] });
    expect(printingKindLabel(printing, kindLabels)).toBe("launch-party");
  });
});

describe("printingBlockTitle", () => {
  it("titles a printing with its code, language and finish", () => {
    expect(
      printingBlockTitle(
        makeAdminPrinting({ shortCode: "OGN-001", language: "en", finish: "foil" }),
      ),
    ).toBe("OGN-001 · EN · foil");
  });

  it("appends the markers", () => {
    expect(
      printingBlockTitle(
        makeAdminPrinting({ finish: "nonfoil", markerSlugs: ["prerelease", "stamped"] }),
      ),
    ).toBe("OGN-001 · EN · nonfoil + prerelease + stamped");
  });
});
