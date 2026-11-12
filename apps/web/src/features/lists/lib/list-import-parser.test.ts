import { looksLikePrintingCode } from "@openrift/shared/deck-codecs/text";
import { labelMap } from "@openrift/shared/enum-label";
import type { ListEntryDetailResponse } from "@openrift/shared/types/api/list";
import { describe, expect, it } from "vitest";

import { matchEntries } from "@/features/collections/lib/import-matcher";
import { formatListShareText } from "@/features/lists/lib/list-export";
import { formatCardListAsDeckText, formatCardListWithDetails } from "@/lib/export-text";
import { EMPTY_TRADE_PREFERENCE, stubPrinting } from "@/test/factories";

import { knownPrintingCode, parseCardListText, parseListImport } from "./list-import-parser";

const TEXT_LABELS = {
  finishes: labelMap([
    { slug: "normal", label: "Normal" },
    { slug: "foil", label: "Foil" },
  ]),
  languages: labelMap([
    { slug: "EN", label: "English" },
    { slug: "SC", label: "Chinese" },
  ]),
};

function printingEntry(
  id: string,
  cardName: string,
  quantity: number,
  opts: { shortCode: string; finish?: string; language?: string },
): ListEntryDetailResponse {
  return {
    id,
    listId: "list-1",
    ruleQuantity: 0,
    source: "manual",
    kind: "printing",
    printingId: `p-${id}`,
    quantity,
    cardName,
    setId: "set-1",
    rarity: "common",
    finish: opts.finish ?? "normal",
    shortCode: opts.shortCode,
    language: opts.language ?? "EN",
    imageId: null,
    tradeOverride: EMPTY_TRADE_PREFERENCE,
  };
}

const buffSprite = stubPrinting({
  printingId: "pair-sprite",
  cardId: "buff",
  shortCode: "OGN",
  publicCode: "OGN",
  card: { name: "Buff" },
  otherSide: {
    faceId: "f-sprite",
    cardId: "sprite",
    cardName: "Sprite",
    cardSlug: "sprite",
    shortCode: "OGN-T05",
    finish: "normal",
    artVariant: "normal",
    isSigned: false,
    markers: [],
  },
});
const buffRecruit = stubPrinting({
  printingId: "pair-recruit",
  cardId: "buff",
  shortCode: "OGN",
  publicCode: "OGN",
  card: { name: "Buff" },
  otherSide: {
    faceId: "f-recruit",
    cardId: "recruit",
    cardName: "Recruit",
    cardSlug: "recruit",
    shortCode: "OGN-T06",
    finish: "normal",
    artVariant: "normal",
    isSigned: false,
    markers: [],
  },
});
const CATALOG = [
  stubPrinting({
    printingId: "cleave",
    cardId: "cleave",
    shortCode: "OGN-004",
    publicCode: "OGN-004/298",
    card: { name: "Cleave" },
  }),
  stubPrinting({
    printingId: "cleave-foil",
    cardId: "cleave",
    shortCode: "OGN-004",
    publicCode: "OGN-004/298",
    finish: "foil",
    card: { name: "Cleave" },
  }),
  stubPrinting({
    printingId: "disintegrate-sc",
    cardId: "disintegrate",
    shortCode: "OGN-050",
    publicCode: "OGN-050/298",
    language: "SC",
    card: { name: "Disintegrate" },
  }),
  stubPrinting({
    printingId: "disintegrate-en",
    cardId: "disintegrate",
    shortCode: "OGN-050",
    publicCode: "OGN-050/298",
    card: { name: "Disintegrate" },
  }),
  buffSprite,
  buffRecruit,
];
const LABELS = { ...TEXT_LABELS, isCode: knownPrintingCode(CATALOG) };
const SHAPE_LABELS = { ...TEXT_LABELS, isCode: looksLikePrintingCode };

describe("round trip through the text exports", () => {
  const exported = [
    printingEntry("cleave", "Cleave", 2, { shortCode: "OGN-004" }),
    printingEntry("cleave-foil", "Cleave", 1, { shortCode: "OGN-004", finish: "foil" }),
    printingEntry("disintegrate-sc", "Disintegrate", 3, { shortCode: "OGN-050", language: "SC" }),
    printingEntry("pair-sprite", "Buff // Sprite", 1, { shortCode: "OGN" }),
  ];
  const resolved = (text: string) =>
    matchEntries(parseListImport(text, LABELS).entries, CATALOG, "EN").map((match) => [
      match.status,
      match.resolvedPrinting?.printingId,
      match.entry.quantity,
    ]);
  const expected = [
    ["exact", "cleave", 2],
    ["exact", "cleave-foil", 1],
    ["exact", "disintegrate-sc", 3],
    ["exact", "pair-sprite", 1],
  ];

  it("resolves what the list share text writes to the same printings", () => {
    const text = formatListShareText(
      "2024 Wants",
      "printing",
      exported,
      "https://example.test/lists/share/x",
      TEXT_LABELS.finishes,
    );
    expect(parseListImport(text, LABELS).issues).toEqual([]);
    expect(resolved(text)).toEqual(expected);
  });

  it("resolves what the collection detail export writes to the same printings", () => {
    const text = formatCardListWithDetails(
      exported.map((entry) => ({
        name: entry.cardName,
        quantity: entry.quantity,
        details: [
          entry.kind === "card" ? "" : entry.shortCode,
          entry.kind === "card" ? "EN" : entry.language,
          ...(entry.kind !== "card" && entry.finish === "foil" ? ["Foil"] : []),
        ],
      })),
    );
    expect(resolved(text)).toEqual(expected);
  });

  it("does not read a list name that starts with a number as a card line", () => {
    const text = formatListShareText(
      "2024 Wants",
      "printing",
      exported.slice(0, 1),
      null,
      TEXT_LABELS.finishes,
    );
    expect(parseListImport(text, LABELS).entries.map((entry) => entry.cardName)).toEqual([
      "Cleave",
    ]);
  });

  it("reads a language or finish segment as such when no code precedes it", () => {
    expect(parseCardListText("1 Teemo · SC", LABELS).entries[0]).toMatchObject({
      sourceCode: "",
      language: "SC",
    });
    expect(parseCardListText("1 Teemo · Foil", LABELS).entries[0]).toMatchObject({
      sourceCode: "",
      finish: "foil",
    });
  });
});

describe("parseCardListText", () => {
  it("parses `<qty> <name>` lines into ImportEntry shapes with synthetic defaults", () => {
    const result = parseCardListText("1 Teemo, Scout\n3 Jinx, Rebel", LABELS);
    expect(result.errors).toEqual([]);
    expect(result.rowCount).toBe(2);
    expect(result.entries).toHaveLength(2);
    expect(result.entries[0]).toMatchObject({
      cardName: "Teemo, Scout",
      quantity: 1,
      finish: "normal",
      artVariant: "normal",
      sourceCode: "",
      setPrefix: "",
    });
    expect(result.entries[1]!.cardName).toBe("Jinx, Rebel");
  });

  it("skips blank lines without raising errors", () => {
    const result = parseCardListText("\n\n2 Teemo, Scout\n\n  \n1 Jinx, Rebel\n", LABELS);
    expect(result.errors).toEqual([]);
    expect(result.rowCount).toBe(2);
    expect(result.entries).toHaveLength(2);
  });

  it("merges duplicate names by summing quantities, normalized so styling differences collapse", () => {
    const result = parseCardListText(
      "1 Kai'Sa, Survivor\n2 KaiSa Survivor\n1 Kai’Sa, Survivor",
      LABELS,
    );
    expect(result.errors).toEqual([]);
    expect(result.entries).toHaveLength(1);
    expect(result.entries[0]!.quantity).toBe(4);
    expect(result.entries[0]!.cardName).toBe("Kai'Sa, Survivor");
  });

  it("reports malformed lines as issues and keeps parsing the rest", () => {
    const result = parseCardListText("Teemo, Scout\n3 Jinx, Rebel\nbroken", LABELS);
    expect(result.issues.map((issue) => [issue.line, issue.code])).toEqual([
      [1, "unreadable"],
      [3, "unreadable"],
    ]);
    expect(result.entries).toHaveLength(1);
    expect(result.entries[0]!.cardName).toBe("Jinx, Rebel");
  });

  it("rejects non-positive quantities", () => {
    const result = parseCardListText("0 Teemo, Scout\n2 Jinx, Rebel", LABELS);
    expect(result.issues.map((issue) => [issue.line, issue.code])).toEqual([[1, "zeroQuantity"]]);
    expect(result.entries).toHaveLength(1);
    expect(result.entries[0]!.cardName).toBe("Jinx, Rebel");
  });

  it("tolerates CRLF line endings (iOS clipboard round-trip)", () => {
    const result = parseCardListText("1 Teemo, Scout\r\n2 Jinx, Rebel\r\n", LABELS);
    expect(result.errors).toEqual([]);
    expect(result.entries).toHaveLength(2);
  });

  it("reads the share text's `2x Name · CODE · …` lines and skips its link", () => {
    const result = parseCardListText(
      "https://example.test/lists/abc\n2x Pouty Poro · OGN-031 · Foil · DE\n1 Jinx, Rebel · OGN-202/298",
      SHAPE_LABELS,
    );
    expect(result.errors).toEqual([]);
    expect(
      result.entries.map((entry) => [entry.quantity, entry.cardName, entry.sourceCode]),
    ).toEqual([
      [2, "Pouty Poro", "OGN-031"],
      [1, "Jinx, Rebel", "OGN-202/298"],
    ]);
  });

  it("skips the share header and link, and reads finish and language back", () => {
    const shareText =
      "My Printings (3 printings)\nhttps://example.test/lists/share/tok123\n\n2x Cleave · OGN-004\n1x Cleave · OGN-004 · Foil\n1x Disintegrate · OGN-050 · SC · €1.20";
    const result = parseCardListText(shareText, LABELS);
    expect(result.issues).toEqual([]);
    expect(
      result.entries.map((entry) => [
        entry.quantity,
        entry.cardName,
        entry.sourceCode,
        entry.finish,
        entry.language,
      ]),
    ).toEqual([
      [2, "Cleave", "OGN-004", "normal", "EN"],
      [1, "Cleave", "OGN-004", "foil", "EN"],
      [1, "Disintegrate", "OGN-050", "normal", "SC"],
    ]);
  });

  it("reads finish and language labels as well as slugs, and ignores unknown segments", () => {
    const result = parseCardListText("1 Cleave · OGN-004 · Chinese · Foil · Alt Art", LABELS);
    expect(result.entries[0]).toMatchObject({ finish: "foil", language: "SC" });
  });

  it("keeps two printings of one card apart when their codes differ", () => {
    const result = parseCardListText(
      "1x Pouty Poro · OGN-031\n1x Pouty Poro · OGN-031a",
      SHAPE_LABELS,
    );
    expect(result.entries.map((entry) => entry.sourceCode)).toEqual(["OGN-031", "OGN-031a"]);
  });

  it("reports each problem as a code with its line", () => {
    const result = parseCardListText("Pouty Poro\n0 Jinx", LABELS);
    expect(result.issues).toEqual([
      { line: 1, code: "unreadable", text: "Pouty Poro" },
      { line: 2, code: "zeroQuantity", text: "0 Jinx" },
    ]);
  });

  it("round-trips with formatCardListAsDeckText", () => {
    const exported = formatCardListAsDeckText([
      { name: "Teemo, Scout", quantity: 1 },
      { name: "Kai’Sa, Survivor", quantity: 2 },
      { name: "Jinx, Rebel", quantity: 3 },
    ]);
    const result = parseCardListText(exported, LABELS);
    expect(result.errors).toEqual([]);
    expect(result.entries).toHaveLength(3);
    expect(result.entries.map((entry) => `${entry.quantity} ${entry.cardName}`)).toEqual([
      "1 Teemo, Scout",
      "2 Kai'Sa, Survivor",
      "3 Jinx, Rebel",
    ]);
  });
});

describe("parseListImport", () => {
  it("falls back to plain-text parsing when no CSV format is detected", () => {
    const result = parseListImport("1 Teemo, Scout\n3 Jinx, Rebel", LABELS);
    expect(result.errors).toEqual([]);
    expect(result.entries).toHaveLength(2);
    expect(result.entries[0]).toMatchObject({
      cardName: "Teemo, Scout",
      sourceCode: "",
      finish: "normal",
    });
  });

  it("routes a Piltover Archive CSV through the rich parser, preserving printing detail", () => {
    const csv = [
      "Variant Number,Card Name,Set Prefix,Rarity,Variant Label,Foil,Quantity,Language",
      "OGN-001,Blazing Scorcher,OGN,common,Standard,true,2,EN",
    ].join("\n");
    const result = parseListImport(csv, LABELS);
    expect(result.errors).toEqual([]);
    expect(result.entries).toHaveLength(1);
    expect(result.entries[0]).toMatchObject({
      cardName: "Blazing Scorcher",
      quantity: 2,
      finish: "foil",
      sourceCode: "OGN-001",
    });
  });

  it("routes an OpenRift CSV through the rich parser", () => {
    const csv = [
      "Card ID,Card Name,Rarity,Type,Domain,Finish,Art Variant,Promo,Language,Quantity",
      "OGN-007a,Fury Rune,common,rune,fury,normal,altart,,EN,3",
    ].join("\n");
    const result = parseListImport(csv, LABELS);
    expect(result.errors).toEqual([]);
    expect(result.entries).toHaveLength(1);
    expect(result.entries[0]).toMatchObject({
      cardName: "Fury Rune",
      quantity: 3,
      artVariant: "altart",
      sourceCode: "OGN-007a",
    });
  });
});
