import { describe, expect, it } from "vitest";

import {
  buildCandidateLinkIndex,
  resolveCardIdByName,
  resolvePrintingLink,
} from "./candidate-links.js";

interface TestPrinting {
  id: string;
  cardId?: string;
  shortCode: string;
  finish: string;
  markerSlugs: string[];
  language: string;
  size: string;
}

const FIREBALL_PRINTING: TestPrinting = {
  id: "printing-uuid",
  shortCode: "OGN-001",
  finish: "normal",
  markerSlugs: [],
  language: "EN",
  size: "standard",
};

function makeIndex({
  cardNorms = [{ id: "card-uuid", normName: "fireball" }],
  aliases = [] as { cardId: string; normName: string }[],
  printings = [FIREBALL_PRINTING] as TestPrinting[],
  linkOverrides = [] as {
    externalId: string;
    finish: string;
    provider: string;
    printingId: string;
  }[],
} = {}) {
  return buildCandidateLinkIndex({
    cardNorms,
    aliases,
    printings: printings.map((printing) => ({
      ...printing,
      cardId: printing.cardId ?? "card-uuid",
    })),
    linkOverrides,
  });
}

function candidate(overrides: Record<string, unknown> = {}) {
  return {
    provider: "test-provider",
    externalId: "ext-1",
    shortCode: "OGN-001",
    finish: "normal" as string | null,
    rarity: null as string | null,
    markerSlugs: [] as string[],
    language: "EN" as string | null,
    cardId: "card-uuid" as string | null,
    ...overrides,
  };
}

describe("resolveCardIdByName", () => {
  it("resolves by normalized name", () => {
    expect(resolveCardIdByName(makeIndex(), "Fireball")).toBe("card-uuid");
  });

  it("falls back to an alias when the direct norm does not match", () => {
    const index = makeIndex({ aliases: [{ cardId: "card-uuid", normName: "firbal" }] });
    expect(resolveCardIdByName(index, "Firbal")).toBe("card-uuid");
  });

  it("prefers the card norm over an alias pointing elsewhere", () => {
    const index = makeIndex({ aliases: [{ cardId: "other-uuid", normName: "fireball" }] });
    expect(resolveCardIdByName(index, "Fireball")).toBe("card-uuid");
  });

  it("never resolves an empty norm, even when a card normalizes to one", () => {
    const index = makeIndex({
      cardNorms: [
        { id: "card-uuid", normName: "fireball" },
        { id: "empty-card-uuid", normName: "" },
      ],
    });
    expect(resolveCardIdByName(index, "!?!")).toBeNull();
  });

  it("returns null for an unknown name", () => {
    expect(resolveCardIdByName(makeIndex(), "Unknown Card")).toBeNull();
  });
});

describe("resolvePrintingLink", () => {
  it("links on the composite key", () => {
    expect(resolvePrintingLink(makeIndex(), candidate())).toBe("printing-uuid");
  });

  it("links a side shown on one double-sided printing to that printing", () => {
    const pair = {
      id: "pair-uuid",
      shortCode: "UNL-T05",
      finish: "normal",
      markerSlugs: [],
      language: "EN",
      size: "standard",
    };
    const index = makeIndex({ printings: [FIREBALL_PRINTING, pair] });
    expect(resolvePrintingLink(index, candidate({ shortCode: "UNL-T05" }))).toBe("pair-uuid");
  });

  it("tells a standard and an oversized printing of one side apart by size", () => {
    const side = { shortCode: "OGN-279", finish: "normal", markerSlugs: [], language: "EN" };
    const index = makeIndex({
      printings: [
        { id: "standard", ...side, size: "standard" },
        { id: "oversized", ...side, size: "oversized" },
      ],
    });
    expect(resolvePrintingLink(index, candidate({ shortCode: "OGN-279", size: "oversized" }))).toBe(
      "oversized",
    );
    expect(resolvePrintingLink(index, candidate({ shortCode: "OGN-279" }))).toBe("standard");
  });

  it("does not link a sized candidate to a printing of another size", () => {
    const index = makeIndex({
      printings: [{ ...FIREBALL_PRINTING, id: "standard", size: "standard" }],
    });
    expect(resolvePrintingLink(index, candidate({ size: "oversized" }))).toBeNull();
  });

  it("links a size-less candidate to the only printing of its side", () => {
    const index = makeIndex({
      printings: [{ ...FIREBALL_PRINTING, id: "oversized", size: "oversized" }],
    });
    expect(resolvePrintingLink(index, candidate())).toBe("oversized");
  });

  it("does not link to another card's printing with the same key", () => {
    const index = makeIndex({
      printings: [{ ...FIREBALL_PRINTING, id: "other-card-printing", cardId: "other-uuid" }],
    });
    expect(resolvePrintingLink(index, candidate())).toBeNull();
  });

  it("links each card's candidate to its own side of a shared key", () => {
    const index = makeIndex({
      printings: [
        { ...FIREBALL_PRINTING, id: "own" },
        { ...FIREBALL_PRINTING, id: "other", cardId: "other-uuid" },
      ],
    });
    expect(resolvePrintingLink(index, candidate())).toBe("own");
    expect(resolvePrintingLink(index, candidate({ cardId: "other-uuid" }))).toBe("other");
  });

  it("links a pair printing from the card on either side", () => {
    const index = makeIndex({
      printings: [
        { ...FIREBALL_PRINTING, id: "pair", shortCode: "UNL-T02" },
        { ...FIREBALL_PRINTING, id: "pair", shortCode: "UNL-T05", cardId: "gold-uuid" },
      ],
    });
    expect(resolvePrintingLink(index, candidate({ shortCode: "UNL-T02" }))).toBe("pair");
    expect(
      resolvePrintingLink(index, candidate({ shortCode: "UNL-T05", cardId: "gold-uuid" })),
    ).toBe("pair");
  });

  it("links a pair printing listed under one side's card with the other side's code", () => {
    const index = makeIndex({
      printings: [
        { ...FIREBALL_PRINTING, id: "pair", shortCode: "OGN" },
        { ...FIREBALL_PRINTING, id: "pair", shortCode: "OGN-271a", cardId: "recruit-uuid" },
        { ...FIREBALL_PRINTING, id: "other-pair", shortCode: "OGN" },
        { ...FIREBALL_PRINTING, id: "other-pair", shortCode: "OGN-272", cardId: "sprite-uuid" },
      ],
    });
    expect(resolvePrintingLink(index, candidate({ shortCode: "OGN-271A" }))).toBe("pair");
    expect(resolvePrintingLink(index, candidate({ shortCode: "OGN" }))).toBeNull();
    expect(
      resolvePrintingLink(index, candidate({ shortCode: "OGN-271a", cardId: "other-uuid" })),
    ).toBeNull();
  });

  it("leaves a side shared by several printings unlinked", () => {
    const side = {
      shortCode: "OGN",
      finish: "normal",
      markerSlugs: [],
      language: "EN",
      size: "standard",
    };
    const index = makeIndex({
      printings: [
        { id: "recruit-buff", ...side },
        { id: "sprite-buff", ...side },
      ],
    });
    expect(resolvePrintingLink(index, candidate({ shortCode: "OGN" }))).toBeNull();
  });

  it("links a lowercase short code to an uppercase live printing", () => {
    expect(resolvePrintingLink(makeIndex(), candidate({ shortCode: "ogn-001" }))).toBe(
      "printing-uuid",
    );
  });

  it("links without a rarity — rarity is not part of the gate", () => {
    expect(resolvePrintingLink(makeIndex(), candidate())).toBe("printing-uuid");
  });

  it("defaults a missing language to EN", () => {
    expect(resolvePrintingLink(makeIndex(), candidate({ language: null }))).toBe("printing-uuid");
  });

  it("does not link when the card did not resolve", () => {
    expect(resolvePrintingLink(makeIndex(), candidate({ cardId: null }))).toBeNull();
  });

  it("infers a missing finish from the rarity", () => {
    const foil = { ...FIREBALL_PRINTING, id: "foil-uuid", finish: "foil" };
    const index = makeIndex({ printings: [FIREBALL_PRINTING, foil] });
    expect(resolvePrintingLink(index, candidate({ finish: null, rarity: "common" }))).toBe(
      "printing-uuid",
    );
    expect(resolvePrintingLink(index, candidate({ finish: null, rarity: "epic" }))).toBe(
      "foil-uuid",
    );
  });

  it("does not link without a finish or a rarity", () => {
    expect(resolvePrintingLink(makeIndex(), candidate({ finish: null }))).toBeNull();
  });

  it("does not link when no live printing matches the key", () => {
    expect(resolvePrintingLink(makeIndex(), candidate({ shortCode: "OGN-999" }))).toBeNull();
  });

  it("prefers a manual link override over key resolution", () => {
    const index = makeIndex({
      linkOverrides: [
        {
          externalId: "ext-1",
          finish: "normal",
          provider: "test-provider",
          printingId: "override-uuid",
        },
      ],
    });
    expect(resolvePrintingLink(index, candidate())).toBe("override-uuid");
  });

  it("applies an override to a candidate with no finish, where the key cannot", () => {
    const index = makeIndex({
      linkOverrides: [
        { externalId: "ext-1", finish: "", provider: "test-provider", printingId: "override-uuid" },
      ],
    });
    expect(resolvePrintingLink(index, candidate({ finish: null, cardId: null }))).toBe(
      "override-uuid",
    );
  });

  it("ignores another provider's override and falls back to the key", () => {
    const index = makeIndex({
      linkOverrides: [
        {
          externalId: "ext-1",
          finish: "normal",
          provider: "other-provider",
          printingId: "override-uuid",
        },
      ],
    });
    expect(resolvePrintingLink(index, candidate())).toBe("printing-uuid");
  });

  it("links a claimed printing that shares the composite key with another printing", () => {
    const index = makeIndex({
      printings: [{ ...FIREBALL_PRINTING, id: "promo-uuid" }, FIREBALL_PRINTING],
    });
    expect(resolvePrintingLink(index, candidate({ claimedPrintingId: "promo-uuid" }))).toBe(
      "promo-uuid",
    );
  });

  it("links a claimed printing whose fields match no key", () => {
    expect(
      resolvePrintingLink(
        makeIndex(),
        candidate({ claimedPrintingId: "claimed-uuid", finish: null, shortCode: "OGN-999" }),
      ),
    ).toBe("claimed-uuid");
  });

  it("lets a manual link override win over a claimed printing", () => {
    const index = makeIndex({
      linkOverrides: [
        {
          externalId: "ext-1",
          finish: "normal",
          provider: "test-provider",
          printingId: "override-uuid",
        },
      ],
    });
    expect(resolvePrintingLink(index, candidate({ claimedPrintingId: "claimed-uuid" }))).toBe(
      "override-uuid",
    );
  });

  it("falls back to the key when no printing is claimed", () => {
    expect(resolvePrintingLink(makeIndex(), candidate({ claimedPrintingId: null }))).toBe(
      "printing-uuid",
    );
  });
});
