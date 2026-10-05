import type { PackPrinting, PackPull } from "@openrift/shared/pack-opener/types";
import { describe, expect, it } from "vitest";

import {
  PACK_RARITY_ORDER,
  compareRarityDesc,
  packRarityKey,
  packRarityLabel,
  packSlotLabel,
} from "./pack-pull-labels";

const LABELS = { common: "Common", uncommon: "Uncommon", rare: "Rare", epic: "Epic" };

function makePull(slot: PackPull["slot"], overrides: Partial<PackPrinting> = {}): PackPull {
  return {
    slot,
    printing: {
      id: "00000000-0000-0000-0000-000000000001",
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
  it("uses the printing rarity for a regular slot", () => {
    expect(packRarityKey(makePull("flex", { rarity: "epic" }))).toBe("epic");
  });

  it("maps the token slot to rune or token", () => {
    expect(packRarityKey(makePull("token"))).toBe("rune");
    expect(packRarityKey(makePull("token", { cardSuperTypes: ["token"] }))).toBe("token");
  });

  it("maps the ultimate slot to ultimate", () => {
    expect(packRarityKey(makePull("ultimate"))).toBe("ultimate");
  });

  it("returns only keys the rarity bar counts", () => {
    const pulls = [
      makePull("common", { rarity: "common" }),
      makePull("token"),
      makePull("token", { cardSuperTypes: ["token"] }),
      makePull("showcase", { rarity: "showcase" }),
      makePull("ultimate"),
    ];
    for (const pull of pulls) {
      expect(PACK_RARITY_ORDER).toContain(packRarityKey(pull));
    }
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

describe("packSlotLabel", () => {
  it("labels the common and uncommon slots by rarity", () => {
    expect(packSlotLabel(makePull("common"), LABELS)).toBe("Common");
    expect(packSlotLabel(makePull("uncommon"), LABELS)).toBe("Uncommon");
  });

  it("labels the flex and foil slots with the printing rarity", () => {
    expect(packSlotLabel(makePull("flex", { rarity: "epic" }), LABELS)).toBe("Epic");
    expect(packSlotLabel(makePull("foil", { rarity: "rare" }), LABELS)).toBe("Foil Rare");
  });

  it("tells the token slot variants apart", () => {
    expect(packSlotLabel(makePull("token", { cardSuperTypes: ["token"] }), LABELS)).toBe("Token");
    expect(packSlotLabel(makePull("token", { finish: "foil" }), LABELS)).toBe("Foil Rune");
    expect(packSlotLabel(makePull("token", { artVariant: "altart" }), LABELS)).toBe("Alt Art Rune");
    expect(packSlotLabel(makePull("token"), LABELS)).toBe("Rune");
  });

  it("tells the showcase slot variants apart", () => {
    expect(packSlotLabel(makePull("showcase", { isSigned: true }), LABELS)).toBe("Signed");
    expect(packSlotLabel(makePull("showcase", { isOvernumbered: true }), LABELS)).toBe(
      "Overnumbered",
    );
    expect(packSlotLabel(makePull("showcase"), LABELS)).toBe("Alt Art");
  });

  it("labels the ultimate slot", () => {
    expect(packSlotLabel(makePull("ultimate"), LABELS)).toBe("Ultimate");
  });

  it("falls back to the rarity slug when the label map has no entry", () => {
    expect(packSlotLabel(makePull("flex", { rarity: "mythic" }), {})).toBe("mythic");
  });
});
