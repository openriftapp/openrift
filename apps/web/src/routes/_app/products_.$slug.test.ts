import { describe, expect, it } from "vitest";

import {
  headCanonical,
  headJsonLd,
  headMeta,
  headTitle,
  loadedHead,
  runRouteHead,
  runRouteLoader,
} from "@/test/route-head";

import { Route } from "./products_.$slug";

const PARAMS = { slug: "jinx-starter" };

function detail(description: string | null) {
  return {
    product: { slug: "jinx-starter", name: "Jinx Starter Deck", description, cardTotal: 40 },
    contents: [{ printingId: "p-1", quantity: 3 }],
    cards: {
      "card-jinx": { slug: "jinx", name: "Jinx", type: "unit", types: ["unit"], tags: [] },
      "card-ahri": {
        slug: "ahri-nine-tailed-fox",
        name: "Nine-Tailed Fox",
        type: "legend",
        types: ["legend"],
        tags: ["Ahri"],
      },
    },
    printings: [
      { cardId: "card-ahri", printingId: "p-3" },
      { cardId: "card-jinx", printingId: "p-1" },
      { cardId: "card-jinx", printingId: "p-2" },
      { cardId: "card-missing", printingId: "p-9" },
    ],
    sets: [{ slug: "origins" }],
  };
}

describe("/products/$slug head", () => {
  it("describes the product by its card total when it has no description", async () => {
    const head = await loadedHead(Route, PARAMS, detail(null));

    expect(headTitle(head)).toBe("Jinx Starter Deck - OpenRift");
    expect(headMeta(head, "description")).toBe(
      "Every card in Jinx Starter Deck, a fixed-content Riftbound product (40 cards).",
    );
    expect(headCanonical(head)).toBe("http://localhost:5173/products/jinx-starter");
  });

  it("uses the product's own description when it has one", async () => {
    const head = await loadedHead(Route, PARAMS, detail("Jinx's opening box."));

    expect(headMeta(head, "description")).toBe("Jinx's opening box.");
  });

  it("lists each resolvable card once in the collection JSON-LD", async () => {
    const [page] = headJsonLd(await loadedHead(Route, PARAMS, detail(null))) as {
      mainEntity: { itemListElement: { name: string }[] };
    }[];

    expect(page!.mainEntity.itemListElement.map((item) => item.name)).toEqual([
      "Ahri, Nine-Tailed Fox",
      "Jinx",
    ]);
  });

  it("keeps the printing rows out of the loader data", async () => {
    expect(await runRouteLoader(Route, PARAMS, detail(null))).toEqual({
      product: { name: "Jinx Starter Deck", description: null, cardTotal: 40 },
      items: [
        { name: "Ahri, Nine-Tailed Fox", url: "/cards/ahri-nine-tailed-fox" },
        { name: "Jinx", url: "/cards/jinx" },
      ],
    });
  });

  it("noindexes a product that does not exist", () => {
    const head = runRouteHead(Route, PARAMS, undefined);

    expect(headTitle(head)).toBe("Product - OpenRift");
    expect(headMeta(head, "robots")).toBe("noindex, nofollow");
  });
});
