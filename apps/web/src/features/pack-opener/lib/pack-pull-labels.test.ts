import { labelMapOf } from "@openrift/shared/enum-label";
import { describe, expect, it } from "vitest";

import {
  PACK_RARITY_ORDER,
  compareRarityDesc,
  packRarityColor,
  packRarityKey,
  packPullLabel,
  packRarityLabel,
} from "./pack-pull-labels";
import type { PackPrinting, PackPull } from "./pack-types";

const LABELS = labelMapOf({ common: "Common", uncommon: "Uncommon", rare: "Rare", epic: "Epic" });

function makePull(outcome: string, overrides: Partial<PackPrinting> = {}): PackPull {
  return {
    slot: "rare",
    outcome,
    printing: {
      id: "00000000-0000-0000-0000-000000000001",
      printingId: "00000000-0000-0000-0000-000000000001",
      cardId: "00000000-0000-0000-0000-000000000002",
      cardName: "Test Card",
      cardSlug: "test-card",
      cardTypes: ["unit"],
      cardSuperTypes: [],
      tags: [],
      rarity: "rare",
      finish: "normal",
      artVariant: "normal",
      isSigned: false,
      isOvernumbered: false,
      language: "EN",
      shortCode: "RB1-001",
      publicCode: "rb1-001",
      setSlug: "RB1",
      ...overrides,
    },
  };
}

describe("compareRarityDesc", () => {
  it("sorts rarity keys from highest to lowest", () => {
    const sorted = ["common", "ultimate", "rare", "rune", "epic"].toSorted(compareRarityDesc);
    expect(sorted).toEqual(["ultimate", "rune", "epic", "rare", "common"]);
  });

  it("ranks a token below common", () => {
    expect(["token", "common"].toSorted(compareRarityDesc)).toEqual(["common", "token"]);
  });

  it("puts keys outside the order last", () => {
    expect(["unknown", "token"].toSorted(compareRarityDesc)).toEqual(["token", "unknown"]);
  });

  it("does not order display labels, only keys", () => {
    expect(["Common", "Epic"].toSorted(compareRarityDesc)).toEqual(["Common", "Epic"]);
  });
});

describe("packRarityKey", () => {
  it("uses the printing rarity for a regular outcome", () => {
    expect(packRarityKey(makePull("epic", { rarity: "epic" }))).toBe("epic");
  });

  it("maps the Rune slot outcomes to rune or token", () => {
    expect(packRarityKey(makePull("rune"))).toBe("rune");
    expect(packRarityKey(makePull("alt-art-rune"))).toBe("rune");
    expect(packRarityKey(makePull("token", { cardSuperTypes: ["token"] }))).toBe("token");
  });

  it("maps the ultimate outcome to ultimate", () => {
    expect(packRarityKey(makePull("ultimate"))).toBe("ultimate");
  });

  it("returns only keys the rarity bar counts", () => {
    const pulls = [
      makePull("common", { rarity: "common" }),
      makePull("rune"),
      makePull("token"),
      makePull("alt-art", { rarity: "showcase" }),
      makePull("ultimate"),
    ];
    for (const pull of pulls) {
      expect(PACK_RARITY_ORDER).toContain(packRarityKey(pull));
    }
  });
});

describe("packRarityColor", () => {
  const rarityColors = { rare: "#E052B1" };

  it("takes a rarity's colour from the rarity colours", () => {
    expect(packRarityColor("rare", rarityColors)).toBe("#E052B1");
  });

  it("colours the slot-derived token, rune and ultimate keys", () => {
    expect(packRarityColor("token", rarityColors)).toBe("#a8a29e");
    expect(packRarityColor("rune", rarityColors)).toBe("#6b7280");
    expect(packRarityColor("ultimate", rarityColors)).toBe("#d946ef");
  });

  it("falls back to grey for a key with no colour", () => {
    expect(packRarityColor("mythic", rarityColors)).toBe("#888");
  });
});

describe("packRarityLabel", () => {
  it("reads table rarities from the label map", () => {
    expect(packRarityLabel("epic", LABELS)).toBe("Epic");
  });

  it("names the slot-derived keys", () => {
    expect(packRarityLabel("rune", LABELS)).toBe("Rune");
    expect(packRarityLabel("token", LABELS)).toBe("Token");
    expect(packRarityLabel("ultimate", LABELS)).toBe("Ultimate");
  });
});

describe("packPullLabel", () => {
  it("names the pull's outcome", () => {
    expect(packPullLabel(makePull("foil-rare"))).toBe("Upgrade to Rare");
    expect(packPullLabel(makePull("signed-overnumbered"))).toBe("Signed Overnumbered");
    expect(packPullLabel(makePull("alt-art-rune"))).toBe("Alt-art Rune");
  });

  it("falls back to the slug for an unknown outcome", () => {
    expect(packPullLabel(makePull("mythic"))).toBe("mythic");
  });
});
