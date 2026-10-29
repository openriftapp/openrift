import { describe, expect, it } from "vitest";

import { makePrinting } from "../filters-test-helpers.js";
import { catalogSearchVocabulary } from "./vocabulary.js";

describe("catalogSearchVocabulary", () => {
  const printings = [
    makePrinting({
      rarity: "epic",
      language: "FR",
      markers: [{ id: "m1", slug: "judge", label: "Judge", description: null }],
      card: { domains: ["fury", "chaos"] },
    }),
  ];
  const sets = [{ slug: "OGN", name: "Origins" }];
  const formats = [{ id: "standard", name: "Constructed" }];

  it("collects the values the catalog holds", () => {
    const vocabulary = catalogSearchVocabulary({ printings, sets, formats });
    expect(vocabulary.domain).toEqual(["fury", "chaos"]);
    expect(vocabulary.rarity).toEqual(["epic"]);
    expect(vocabulary.lang).toEqual(["FR"]);
    expect(vocabulary.marker).toEqual(["judge"]);
    expect(vocabulary.set).toEqual([{ value: "OGN", names: ["Origins"] }]);
    expect(vocabulary.format).toEqual([{ value: "standard", names: ["constructed"] }]);
  });

  it("returns the same object for the same catalog", () => {
    expect(catalogSearchVocabulary({ printings, sets, formats })).toBe(
      catalogSearchVocabulary({ printings, sets, formats }),
    );
  });
});
