import { describe, expect, it } from "vitest";

import { stubPrinting } from "@/test/factories";

import type { CardmarketPicksPayload } from "./cardmarket-picks-payload";
import {
  defaultPicksListName,
  matchedEntriesFromPicks,
  parsePicksHash,
  picksToResolveRows,
} from "./cardmarket-picks-payload";

const PRINTING_ID = "0199a0f2-0000-7000-8000-000000000001";

const PAYLOAD: CardmarketPicksPayload = {
  v: 1,
  seller: "Some One",
  picks: [
    {
      idProduct: 847_321,
      finish: "foil",
      idLanguage: 1,
      languageLabel: "Englisch",
      productName: "Volibear, Imposing (V.1 - Rare)",
      quantity: 2,
    },
    {
      idProduct: 847_358,
      finish: "normal",
      idLanguage: null,
      languageLabel: null,
      productName: "Maddened Marauder",
      quantity: 1,
    },
  ],
};

function hashFor(value: unknown): string {
  return `#picks=${encodeURIComponent(JSON.stringify(value))}`;
}

describe("parsePicksHash", () => {
  it("reads the payload the extension writes into the fragment", () => {
    expect(parsePicksHash(hashFor(PAYLOAD))).toEqual(PAYLOAD);
  });

  it("rejects an empty, malformed or foreign payload", () => {
    expect(parsePicksHash("")).toBeUndefined();
    expect(parsePicksHash("#other=1")).toBeUndefined();
    expect(parsePicksHash("#picks=not-json")).toBeUndefined();
    expect(parsePicksHash(hashFor({ ...PAYLOAD, v: 2 }))).toBeUndefined();
    expect(parsePicksHash(hashFor({ ...PAYLOAD, picks: [] }))).toBeUndefined();
    expect(
      parsePicksHash(hashFor({ ...PAYLOAD, picks: [{ ...PAYLOAD.picks[0], quantity: 0 }] })),
    ).toBeUndefined();
  });
});

describe("picksToResolveRows", () => {
  it("turns finish into a flag and an unknown language into 0", () => {
    expect(picksToResolveRows(PAYLOAD)).toEqual([
      { idProduct: 847_321, isFoil: true, idLanguage: 1 },
      { idProduct: 847_358, isFoil: false, idLanguage: 0 },
    ]);
  });
});

describe("matchedEntriesFromPicks", () => {
  it("marks a placed pick exact and an unplaced one unresolved, keeping pick order", () => {
    const printing = stubPrinting({ id: PRINTING_ID });
    const entries = matchedEntriesFromPicks(
      PAYLOAD,
      {
        rows: [
          {
            idProduct: 847_321,
            isFoil: true,
            idLanguage: 1,
            printingId: PRINTING_ID,
            reason: null,
            productName: "Volibear, Imposing",
            languageName: "English",
          },
          {
            idProduct: 847_358,
            isFoil: false,
            idLanguage: 0,
            printingId: null,
            reason: "language-not-printed",
            productName: null,
            languageName: null,
          },
        ],
      },
      { [PRINTING_ID]: printing },
    );

    expect(entries).toHaveLength(2);
    expect(entries[0]).toMatchObject({
      status: "exact",
      resolvedPrinting: printing,
      candidates: [printing],
      entry: { quantity: 2, cardName: "Volibear, Imposing", finish: "foil" },
    });
    expect(entries[0]?.entry.rawFields).toEqual({
      Seller: "Some One",
      Product: "Volibear, Imposing (V.1 - Rare)",
      Language: "Englisch",
      Finish: "Foil",
    });
    expect(entries[1]).toMatchObject({
      status: "unresolved",
      resolvedPrinting: null,
      candidates: [],
      entry: { quantity: 1, cardName: "Maddened Marauder" },
    });
    expect(entries[1]?.entry.rawFields.Problem).toBe("Riftbound is not printed in this language");
    expect(entries[1]?.entry.rawFields.Language).toBe("unknown");
  });

  it("treats a printing the catalogue does not carry as unresolved", () => {
    const entries = matchedEntriesFromPicks(
      PAYLOAD,
      {
        rows: [
          {
            idProduct: 847_321,
            isFoil: true,
            idLanguage: 1,
            printingId: PRINTING_ID,
            reason: null,
            productName: null,
            languageName: "English",
          },
        ],
      },
      {},
    );

    expect(entries[0]?.status).toBe("unresolved");
    expect(entries[1]?.status).toBe("unresolved");
  });
});

describe("defaultPicksListName", () => {
  it("names the list after the seller", () => {
    expect(defaultPicksListName("Some One")).toBe("Cardmarket · Some One");
  });
});
