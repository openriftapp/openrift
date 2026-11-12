import type { AcceptPrintingBody } from "@openrift/shared/contracts/admin/card-mutations";
import { describe, expect, it } from "vitest";

import { describeUnknownRefs, knownRarity, unknownPrintingRefs } from "./printing-refs.js";

const known = {
  languages: ["EN", "SC"],
  rarities: ["common", "rare"],
  artVariants: ["normal"],
  finishes: ["normal", "foil"],
  cardSizes: ["standard"],
  markers: ["prerelease"],
  distributionChannels: ["retail"],
};

function fields(
  overrides: Partial<AcceptPrintingBody["printingFields"]> = {},
): AcceptPrintingBody["printingFields"] {
  return {
    shortCode: "UNL-131",
    artist: "Kudos Productions",
    publicCode: "UNL-131/219",
    ...overrides,
  } as AcceptPrintingBody["printingFields"];
}

describe("unknownPrintingRefs", () => {
  it("passes a printing whose every reference is on a list", () => {
    expect(
      unknownPrintingRefs(
        fields({
          language: "EN",
          rarity: "common",
          artVariant: "normal",
          finish: "foil",
          size: "standard",
          markerSlugs: ["prerelease"],
          distributionChannelSlugs: ["retail"],
        }),
        known,
      ),
    ).toEqual([]);
  });

  it("names an unknown language", () => {
    expect(unknownPrintingRefs(fields({ language: "JP" }), known)).toEqual([
      { field: "language", value: "JP" },
    ]);
  });

  it("reports every offending reference, single and list-valued", () => {
    const unknown = unknownPrintingRefs(
      fields({ language: "JP", rarity: "mythic", markerSlugs: ["prerelease", "promo"] }),
      known,
    );

    expect(unknown).toEqual([
      { field: "language", value: "JP" },
      { field: "rarity", value: "mythic" },
      { field: "marker", value: "promo" },
    ]);
    expect(describeUnknownRefs(unknown)).toBe(
      'not on an admin list: language "JP", rarity "mythic", marker "promo"',
    );
  });

  it.each([
    ["finish", { finish: "glossy" }],
    ["size", { size: "jumbo" }],
    ["art variant", { artVariant: "borderless" }],
    ["language", { language: "XX" }],
    ["distribution channel", { distributionChannelSlugs: ["mail-in"] }],
  ])("names an unknown %s", (field, override) => {
    expect(unknownPrintingRefs(fields(override), known)).toEqual([
      { field, value: Object.values(override).flat()[0] },
    ]);
  });

  it("matches the rarity whatever its case", () => {
    expect(unknownPrintingRefs(fields({ rarity: "Rare" }), known)).toEqual([]);
    expect(knownRarity(known, "Rare")).toBe("rare");
  });

  it("ignores references the printing does not carry", () => {
    expect(unknownPrintingRefs(fields(), known)).toEqual([]);
  });
});
