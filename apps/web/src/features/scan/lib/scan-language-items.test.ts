import { labelMap } from "@openrift/shared/enum-label";
import { describe, expect, it } from "vitest";

import { ANY_LANGUAGE, scanLanguageItems } from "@/features/scan/lib/scan-language-items";
import { stubPrinting } from "@/test/factories";

const labels = labelMap([
  { slug: "EN", label: "English" },
  { slug: "DE", label: "German" },
  { slug: "ZH", label: "Chinese" },
  { slug: "FR", label: "French" },
]);

const printings = ["ZH", "FR", "EN", "DE"].map((language) => stubPrinting({ language }));

function codes(order: readonly string[], selected: string | null = null): string[] {
  return scanLanguageItems(printings, selected, labels, order).map((item) => item.value);
}

describe("scanLanguageItems", () => {
  it("lists the viewer's languages first, then the catalogue order", () => {
    expect(codes(["DE", "EN", "ZH", "FR"])).toEqual([ANY_LANGUAGE, "DE", "EN", "ZH", "FR"]);
  });

  it("puts languages the order does not know last, alphabetically", () => {
    expect(codes(["ZH"])).toEqual([ANY_LANGUAGE, "ZH", "DE", "EN", "FR"]);
  });

  it("keeps a selected language no printing has", () => {
    expect(codes(["EN"], "KO")).toContain("KO");
  });

  it("labels each language", () => {
    const items = scanLanguageItems(printings, null, labels, ["EN"]);
    expect(items.find((item) => item.value === "EN")?.label).toBe("English");
  });
});
