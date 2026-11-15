import { describe, expect, it } from "vitest";

import { buildCardNameIndex, cardNameKeys, resolveCardIdByNorm } from "./card-names.js";

describe("cardNameKeys", () => {
  it("puts the card's own name first, then its aliases, once each", () => {
    expect(
      cardNameKeys("annie", [
        { normName: "annie" },
        { normName: "anniehastur" },
        { normName: "annie" },
      ]),
    ).toEqual(["annie", "anniehastur"]);
  });

  it("keeps the own name when the alias row is missing", () => {
    expect(cardNameKeys("annie", [{ normName: "oldname" }])).toEqual(["annie", "oldname"]);
  });

  it("drops empty keys", () => {
    expect(cardNameKeys("", [{ normName: "" }, { normName: "annie" }])).toEqual(["annie"]);
  });
});

describe("resolveCardIdByNorm", () => {
  const index = buildCardNameIndex({
    cardNorms: [
      { id: "card-a", normName: "annie" },
      { id: "card-b", normName: "annietibbers" },
    ],
    aliases: [
      { cardId: "card-b", normName: "annie" },
      { cardId: "card-b", normName: "tibbers" },
    ],
  });

  it("prefers the card whose own name it is over another card's alias", () => {
    expect(resolveCardIdByNorm(index, "annie")).toBe("card-a");
  });

  it("falls back to an alias", () => {
    expect(resolveCardIdByNorm(index, "tibbers")).toBe("card-b");
  });

  it("gives a name two cards share to the lower card id, in either order", () => {
    const cards = [
      { id: "card-9", normName: "poro" },
      { id: "card-2", normName: "poro" },
    ];
    for (const cardNorms of [cards, cards.toReversed()]) {
      expect(resolveCardIdByNorm(buildCardNameIndex({ cardNorms, aliases: [] }), "poro")).toBe(
        "card-2",
      );
    }
  });

  it("matches nothing for an empty or unknown name", () => {
    expect(resolveCardIdByNorm(index, "")).toBeNull();
    expect(resolveCardIdByNorm(index, "gromp")).toBeNull();
  });
});
