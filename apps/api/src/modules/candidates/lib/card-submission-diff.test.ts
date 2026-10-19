import { describe, expect, it } from "vitest";

import type { ProposedPrinting } from "../repositories/candidate-cards-review.js";
import type { LivePrintingSnapshot, LiveSnapshot } from "../repositories/card-submissions.js";
import { adoptedFields, computeProposedDiff } from "./card-submission-diff.js";

const LIVE_CARD = {
  name: "Jinx",
  type: "unit",
  might: 3,
  energy: 4,
  power: 2,
  mightBonus: null,
  tags: ["zaun"],
};

const LIVE_PRINTING: LivePrintingSnapshot = {
  key: "OGN-042:normal::EN",
  shortCode: "OGN-042",
  finish: "normal",
  markerSlugs: [],
  rarity: "rare",
  artist: "Riot Games",
  artVariant: "standard",
  size: "standard",
  isSigned: false,
  isOvernumbered: false,
  flavorText: "Boom.",
  printedRulesText: null,
  printedEffectText: null,
  printedName: "Jinx",
  language: "EN",
  hasImage: true,
};

function proposedPrinting(overrides: Partial<ProposedPrinting> = {}): ProposedPrinting {
  return {
    shortCode: "OGN-042",
    finish: "normal",
    markerSlugs: [],
    rarity: "rare",
    artist: "Riot Games",
    artVariant: "standard",
    size: "standard",
    isSigned: false,
    flavorText: "Boom.",
    printedRulesText: null,
    printedEffectText: null,
    printedName: "Jinx",
    language: "EN",
    imageUrl: null,
    ...overrides,
  };
}

const EN_NORMAL = "OGN-042:normal::EN";
const FR_NORMAL = "OGN-042:normal::FR";

function liveSnapshot(overrides: Partial<LivePrintingSnapshot> = {}): LiveSnapshot {
  return {
    card: LIVE_CARD,
    printings: new Map([[EN_NORMAL, { ...LIVE_PRINTING, ...overrides }]]),
    printingsById: new Map(),
  };
}

describe("computeProposedDiff", () => {
  it("returns nothing when the submission matches the catalog", () => {
    const diff = computeProposedDiff(
      {
        card: { name: "Jinx", might: 3, energy: 4, power: 2, tags: ["zaun"] },
        printings: [proposedPrinting()],
      },
      liveSnapshot(),
    );
    expect(diff).toEqual([]);
  });

  it("reports only the fields that actually differ", () => {
    const diff = computeProposedDiff(
      {
        card: { name: "Jinx", energy: 5 },
        printings: [proposedPrinting({ artist: "Someone Else" })],
      },
      liveSnapshot(),
    );
    expect(diff).toEqual(["card.energy", `printing.${EN_NORMAL}.artist`]);
  });

  it("reports an overnumbered flag that disagrees with the catalog", () => {
    const diff = computeProposedDiff(
      {
        card: { name: "Jinx" },
        printings: [proposedPrinting({ isOvernumbered: true })],
      },
      liveSnapshot(),
    );
    expect(diff).toEqual([`printing.${EN_NORMAL}.isOvernumbered`]);
  });

  it("treats an unstated overnumbered flag as no proposal", () => {
    const diff = computeProposedDiff(
      {
        card: { name: "Jinx" },
        printings: [proposedPrinting({ isOvernumbered: null })],
      },
      liveSnapshot({ isOvernumbered: true }),
    );
    expect(diff).toEqual([]);
  });

  it("keeps a card's finishes and languages apart", () => {
    const live: LiveSnapshot = {
      card: LIVE_CARD,
      printings: new Map([
        [EN_NORMAL, { ...LIVE_PRINTING, artist: "Fixed Artist" }],
        [FR_NORMAL, { ...LIVE_PRINTING, printedName: "Jinx (FR)" }],
      ]),
      printingsById: new Map(),
    };
    const diff = computeProposedDiff(
      {
        card: { name: "Jinx" },
        printings: [
          proposedPrinting({ language: "EN", artist: "Fixed Artist" }),
          proposedPrinting({ language: "FR", printedName: "Jinx (FR)", artist: "Someone Else" }),
        ],
      },
      live,
    );
    expect(diff).toEqual([`printing.${FR_NORMAL}.artist`]);
  });

  it("skips a printing that carries no finish", () => {
    const diff = computeProposedDiff(
      { card: { name: "Jinx" }, printings: [proposedPrinting({ finish: null, artist: "Nobody" })] },
      liveSnapshot(),
    );
    expect(diff).toEqual([]);
  });

  it("ignores casing and surrounding whitespace", () => {
    const diff = computeProposedDiff(
      { card: { name: "  jinx " }, printings: [proposedPrinting({ artist: "riot games" })] },
      liveSnapshot(),
    );
    expect(diff).toEqual([]);
  });

  it("treats a blank value as no proposal rather than as a clear", () => {
    const diff = computeProposedDiff(
      {
        card: { name: "Jinx", might: null, energy: undefined },
        printings: [proposedPrinting({ flavorText: null })],
      },
      liveSnapshot(),
    );
    expect(diff).toEqual([]);
  });

  it("marks the whole card new when nothing matched", () => {
    const diff = computeProposedDiff(
      { card: { name: "Brand New" }, printings: [proposedPrinting({ shortCode: "OGN-999" })] },
      { card: null, printings: new Map(), printingsById: new Map() },
    );
    expect(diff).toEqual(["card.new", "printing.OGN-999:normal::EN.new"]);
  });

  it("matches printings case-insensitively on the short code", () => {
    const diff = computeProposedDiff(
      {
        card: { name: "Jinx" },
        printings: [proposedPrinting({ shortCode: "ogn-042", rarity: "epic" })],
      },
      liveSnapshot(),
    );
    expect(diff).toEqual([`printing.${EN_NORMAL}.rarity`]);
  });

  it("counts an image only when the printing has none", () => {
    const withoutArt = computeProposedDiff(
      {
        card: { name: "Jinx" },
        printings: [proposedPrinting({ imageUrl: "https://example.test/j.png" })],
      },
      liveSnapshot({ hasImage: false }),
    );
    expect(withoutArt).toEqual([`printing.${EN_NORMAL}.image`]);
  });

  it("counts no change when the printing already has artwork", () => {
    const withArt = computeProposedDiff(
      {
        card: { name: "Jinx" },
        printings: [proposedPrinting({ imageUrl: "https://example.test/j.png" })],
      },
      liveSnapshot({ hasImage: true }),
    );
    expect(withArt).toEqual([]);
  });

  it("compares tags order-insensitively", () => {
    const same = computeProposedDiff(
      { card: { name: "Jinx", tags: ["ZAUN"] }, printings: [] },
      liveSnapshot(),
    );
    expect(same).toEqual([]);

    const different = computeProposedDiff(
      { card: { name: "Jinx", tags: ["zaun", "sniper"] }, printings: [] },
      liveSnapshot(),
    );
    expect(different).toEqual(["card.tags"]);
  });
});

describe("computeProposedDiff with a linked printing", () => {
  const PROMO_KEY = "OGN-042:normal:promo:EN";
  const BASE = { ...LIVE_PRINTING, hasImage: true };
  const PROMO: LivePrintingSnapshot = {
    ...LIVE_PRINTING,
    key: PROMO_KEY,
    markerSlugs: ["promo"],
    hasImage: false,
  };

  function promoSnapshot(): LiveSnapshot {
    return {
      card: LIVE_CARD,
      printings: new Map([
        [EN_NORMAL, BASE],
        [PROMO_KEY, PROMO],
      ]),
      printingsById: new Map([
        ["base-id", [BASE]],
        ["promo-id", [PROMO]],
      ]),
    };
  }

  it("compares an image against the linked promo, not the base printing sharing its short code", () => {
    const diff = computeProposedDiff(
      {
        card: { name: "Jinx" },
        printings: [
          proposedPrinting({
            printingId: "promo-id",
            markerSlugs: ["promo"],
            imageUrl: "https://example.test/promo.png",
          }),
        ],
      },
      promoSnapshot(),
    );
    expect(diff).toEqual([`printing.${PROMO_KEY}.image`]);
  });

  it("uses the linked printing even when the proposal's markers would key to the base", () => {
    const diff = computeProposedDiff(
      {
        card: { name: "Jinx" },
        printings: [
          proposedPrinting({ printingId: "promo-id", imageUrl: "https://example.test/promo.png" }),
        ],
      },
      promoSnapshot(),
    );
    expect(diff).toEqual([`printing.${PROMO_KEY}.markerSlugs`, `printing.${PROMO_KEY}.image`]);
  });

  it("keys an unlinked proposal by its fields", () => {
    const diff = computeProposedDiff(
      {
        card: { name: "Jinx" },
        printings: [proposedPrinting({ imageUrl: "https://example.test/promo.png" })],
      },
      promoSnapshot(),
    );
    expect(diff).toEqual([]);
  });

  it("compares the side of a two-sided printing whose short code was proposed", () => {
    const front: LivePrintingSnapshot = {
      ...LIVE_PRINTING,
      key: "SGN-T01:normal::EN",
      shortCode: "SGN-T01",
      hasImage: true,
    };
    const back: LivePrintingSnapshot = {
      ...LIVE_PRINTING,
      key: "SGN-T05:normal::EN",
      shortCode: "SGN-T05",
      hasImage: false,
    };
    const diff = computeProposedDiff(
      {
        card: { name: "Jinx" },
        printings: [
          proposedPrinting({
            printingId: "pair-id",
            shortCode: "sgn-t05",
            imageUrl: "https://example.test/back.png",
          }),
        ],
      },
      {
        card: LIVE_CARD,
        printings: new Map([
          [front.key, front],
          [back.key, back],
        ]),
        printingsById: new Map([["pair-id", [front, back]]]),
      },
    );
    expect(diff).toEqual(["printing.SGN-T05:normal::EN.image"]);
  });

  it("records only the image for a linked signed, overnumbered printing", () => {
    const signed: LivePrintingSnapshot = {
      ...PROMO,
      isSigned: true,
      isOvernumbered: true,
    };
    const diff = computeProposedDiff(
      {
        card: { name: "Jinx" },
        printings: [
          proposedPrinting({
            printingId: "signed-id",
            markerSlugs: ["promo"],
            isSigned: true,
            isOvernumbered: true,
            imageUrl: "https://example.test/signed.png",
          }),
        ],
      },
      {
        card: LIVE_CARD,
        printings: new Map([[PROMO_KEY, signed]]),
        printingsById: new Map([["signed-id", [signed]]]),
      },
    );
    expect(diff).toEqual([`printing.${PROMO_KEY}.image`]);
  });

  it("reports corrections to the linked printing's identity fields", () => {
    const diff = computeProposedDiff(
      {
        card: { name: "Jinx" },
        printings: [
          proposedPrinting({
            printingId: "base-id",
            shortCode: "OGN-043",
            finish: "foil",
            language: "FR",
            markerSlugs: ["promo"],
          }),
        ],
      },
      promoSnapshot(),
    );
    expect(diff).toEqual([
      `printing.${EN_NORMAL}.shortCode`,
      `printing.${EN_NORMAL}.finish`,
      `printing.${EN_NORMAL}.language`,
      `printing.${EN_NORMAL}.markerSlugs`,
    ]);
  });

  it("compares a linked printing that carries no finish", () => {
    const diff = computeProposedDiff(
      {
        card: { name: "Jinx" },
        printings: [
          proposedPrinting({
            printingId: "promo-id",
            finish: null,
            markerSlugs: ["promo"],
            imageUrl: "https://example.test/promo.png",
          }),
        ],
      },
      promoSnapshot(),
    );
    expect(diff).toEqual([`printing.${PROMO_KEY}.image`]);
  });

  it("falls back to the key when the linked printing is no longer live", () => {
    const diff = computeProposedDiff(
      {
        card: { name: "Jinx" },
        printings: [proposedPrinting({ printingId: "deleted-id", artist: "Someone Else" })],
      },
      promoSnapshot(),
    );
    expect(diff).toEqual([`printing.${EN_NORMAL}.artist`]);
  });
});

describe("adoptedFields", () => {
  it("returns the fields the catalog has since agreed with", () => {
    expect(adoptedFields(["card.energy", "card.might"], ["card.might"])).toEqual(["card.energy"]);
  });

  it("returns nothing when the catalog still disagrees with everything", () => {
    expect(adoptedFields(["card.energy"], ["card.energy"])).toEqual([]);
  });

  it("returns everything when the catalog now agrees fully", () => {
    expect(adoptedFields(["card.energy", "card.name"], [])).toEqual(["card.energy", "card.name"]);
  });
});
