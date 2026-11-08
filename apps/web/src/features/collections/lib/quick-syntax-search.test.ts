import type { Printing } from "@openrift/shared/types/catalog";
import { describe, expect, it } from "vitest";

import { stubPrinting } from "@/test/factories";

import { isSyntaxQuery, quickSyntaxSearch } from "./quick-syntax-search";

function groupByCardId(printings: Printing[]): Map<string, Printing[]> {
  return Map.groupBy(printings, (p) => p.cardId);
}

describe("isSyntaxQuery", () => {
  it("keeps bare words and card codes on the name lookup", () => {
    expect(isSyntaxQuery("ahri")).toBe(false);
    expect(isSyntaxQuery("nine tailed fox")).toBe(false);
    expect(isSyntaxQuery("OGN-066")).toBe(false);
  });

  it("detects keys, exact names, negation and or", () => {
    expect(isSyntaxQuery("t:unit")).toBe(true);
    expect(isSyntaxQuery("ahri e<=3")).toBe(true);
    expect(isSyntaxQuery("!Ahri")).toBe(true);
    expect(isSyntaxQuery("-ahri")).toBe(true);
    expect(isSyntaxQuery("ahri or yasuo")).toBe(true);
  });

  it("treats a half-typed clause as syntax and a blank query as neither", () => {
    expect(isSyntaxQuery("t:")).toBe(true);
    expect(isSyntaxQuery("e<")).toBe(true);
    expect(isSyntaxQuery("   ")).toBe(false);
  });
});

describe("quickSyntaxSearch", () => {
  const unit = (name: string, energy: number) =>
    stubPrinting({ cardId: `card-${name}`, card: { name, types: ["Unit"], energy } });
  const spell = (name: string) =>
    stubPrinting({ cardId: `card-${name}`, card: { name, types: ["Spell"], energy: 1 } });

  it("returns the cards a clause matches, sorted by name", () => {
    const map = groupByCardId([unit("Yasuo", 3), spell("Fireball"), unit("Ahri", 5)]);

    const { results, total, problems } = quickSyntaxSearch("t:unit", map, { limit: 8 });

    expect(results.map((r) => r.cardName)).toEqual(["Ahri", "Yasuo"]);
    expect(total).toBe(2);
    expect(problems).toEqual([]);
  });

  it("combines a name with a clause", () => {
    const map = groupByCardId([unit("Yasuo", 3), unit("Ahri", 5), unit("Ahri Fan", 2)]);

    const { results } = quickSyntaxSearch("ahri e>=4", map, { limit: 8 });

    expect(results.map((r) => r.cardName)).toEqual(["Ahri"]);
  });

  it("caps the rows at the limit but counts every match", () => {
    const map = groupByCardId([unit("A", 1), unit("B", 1), unit("C", 1)]);

    const { results, total } = quickSyntaxSearch("t:unit", map, { limit: 2 });

    expect(results).toHaveLength(2);
    expect(total).toBe(3);
  });

  it("keeps only the printings that match", () => {
    const origins = stubPrinting({ cardId: "card-ahri", setSlug: "ogn", card: { name: "Ahri" } });
    const spiritforged = stubPrinting({
      cardId: "card-ahri",
      setSlug: "sfd",
      card: { name: "Ahri" },
    });
    const map = groupByCardId([origins, spiritforged]);

    const { results } = quickSyntaxSearch("s:sfd", map, { limit: 8 });

    expect(results[0]?.printings).toEqual([spiritforged]);
    expect(results[0]?.defaultPrinting).toBe(spiritforged);
  });

  it("applies preferred languages unless the query names a language", () => {
    const english = stubPrinting({ cardId: "card-ahri", language: "EN", card: { name: "Ahri" } });
    const french = stubPrinting({ cardId: "card-ahri", language: "FR", card: { name: "Ahri" } });
    const map = groupByCardId([english, french]);

    const preferred = quickSyntaxSearch("!Ahri", map, { limit: 8, preferredLanguages: ["EN"] });
    const named = quickSyntaxSearch("!Ahri lang:fr", map, {
      limit: 8,
      preferredLanguages: ["EN"],
    });

    expect(preferred.results[0]?.printings).toEqual([english]);
    expect(named.results[0]?.printings).toEqual([french]);
  });

  it("sums owned copies over the matching printings", () => {
    const origins = stubPrinting({ cardId: "card-ahri", setSlug: "ogn", card: { name: "Ahri" } });
    const spiritforged = stubPrinting({
      cardId: "card-ahri",
      setSlug: "sfd",
      card: { name: "Ahri" },
    });
    const map = groupByCardId([origins, spiritforged]);

    const { results } = quickSyntaxSearch("s:ogn", map, {
      limit: 8,
      ownedCountByPrinting: { [origins.printingId]: 2, [spiritforged.printingId]: 5 },
    });

    expect(results[0]?.ownedCount).toBe(2);
  });

  it("reports unknown and unsupported keys and matches nothing for them", () => {
    const map = groupByCardId([unit("Ahri", 1)]);

    const unknown = quickSyntaxSearch("zz:x", map, { limit: 8 });
    const owned = quickSyntaxSearch("owned>0", map, { limit: 8 });

    expect(unknown.problems).toHaveLength(1);
    expect(owned.problems).toHaveLength(1);
    expect(owned.total).toBe(0);
  });
});
