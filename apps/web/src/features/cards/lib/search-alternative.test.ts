import { filterCards } from "@openrift/shared/filters";
import type { Printing } from "@openrift/shared/types/catalog";
import { EMPTY_CARD_FILTERS } from "@openrift/shared/types/search";
import { beforeEach, describe, expect, it } from "vitest";

import { resetIdCounter, stubPrinting } from "@/test/factories";

import { findSearchAlternatives } from "./search-alternative";

let catalog: Printing[];

beforeEach(() => {
  resetIdCounter();
  catalog = [
    stubPrinting({
      card: { name: "Doran's Shield", tags: [] },
      printedRulesText: "Gain a shield.",
    }),
    stubPrinting({
      card: { name: "Stalwart Guard", tags: [] },
      printedRulesText: "Gain a shield.",
    }),
    stubPrinting({ card: { name: "Darius", tags: ["Noxus"] }, printedRulesText: "Deal 3 damage." }),
    stubPrinting({ card: { name: "Noxian Fervor", tags: [] }, printedRulesText: "Draw a card." }),
    stubPrinting({ card: { name: "Poro Snax", tags: ["Poro"] }, printedRulesText: "A poro eats." }),
  ];
});

function run(query: string) {
  const search = (q: string) => filterCards(catalog, { ...EMPTY_CARD_FILTERS, search: q });
  return findSearchAlternatives(query, search(query), search);
}

describe("findSearchAlternatives", () => {
  it("offers card text when it finds cards the name search missed", () => {
    expect(run("shield")).toEqual([{ kind: "text", query: "o:shield", label: "shield", count: 2 }]);
  });

  it("offers tags with the tag's own spelling", () => {
    expect(run("noxus")).toEqual([{ kind: "tag", query: "tag:noxus", label: "Noxus", count: 1 }]);
  });

  it("names the tag a partial word matches", () => {
    expect(run("noxu")).toEqual([{ kind: "tag", query: "tag:noxu", label: "Noxus", count: 1 }]);
  });

  it("keeps the typed word when it matches several tags", () => {
    catalog.push(stubPrinting({ card: { name: "Swain", tags: ["Noxian"] } }));
    const [tag] = findSearchAlternatives("nox", [], () =>
      catalog.filter((printing) => printing.card.tags.some((t) => t.startsWith("Nox"))),
    ).filter((alternative) => alternative.kind === "tag");
    expect(tag?.label).toBe("nox");
  });

  it("skips an alternative whose cards are all shown already", () => {
    expect(run("poro")).toEqual([]);
  });

  it("searches each word separately and keeps a quoted phrase together", () => {
    expect(run("gain shield").map((alternative) => alternative.query)).toEqual(["o:gain o:shield"]);
    expect(run('"gain a shield"').map((alternative) => alternative.query)).toEqual([
      'o:"gain a shield"',
    ]);
  });

  it("offers nothing when every word is a card number", () => {
    expect(run("OGN-202")).toEqual([]);
    expect(run("pgn-123f ogn202")).toEqual([]);
  });

  it("offers nothing for an empty query or one with keys", () => {
    expect(run("")).toEqual([]);
    expect(run("t:unit shield")).toEqual([]);
    expect(run("-shield")).toEqual([]);
    expect(run("shield or noxus")).toEqual([]);
  });
});
