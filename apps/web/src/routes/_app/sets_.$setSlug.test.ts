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

import { Route } from "./sets_.$setSlug";

const PARAMS = { setSlug: "origins" };

const DETAIL = {
  set: { id: "set-1", slug: "origins", name: "Origins" },
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
    { cardId: "card-jinx", printingId: "p-1" },
    { cardId: "card-jinx", printingId: "p-2" },
    { cardId: "card-ahri", printingId: "p-3" },
    { cardId: "card-missing", printingId: "p-4" },
  ],
};

describe("/sets/$setSlug head", () => {
  it("counts distinct cards and printings in the description", async () => {
    const head = await loadedHead(Route, PARAMS, DETAIL);

    expect(headTitle(head)).toBe("Origins - Riftbound Card Set - OpenRift");
    expect(headMeta(head, "description")).toBe(
      "Origins contains 3 unique cards and 4 printings. Browse the complete set on OpenRift.",
    );
    expect(headCanonical(head)).toBe("http://localhost:5173/sets/origins");
  });

  it("lists each resolvable card once in the collection JSON-LD", async () => {
    const [page] = headJsonLd(await loadedHead(Route, PARAMS, DETAIL)) as {
      mainEntity: { itemListElement: { name: string; url: string }[] };
    }[];

    expect(page!.mainEntity.itemListElement.map((item) => [item.name, item.url])).toEqual([
      ["Jinx", "http://localhost:5173/cards/jinx"],
      ["Ahri, Nine-Tailed Fox", "http://localhost:5173/cards/ahri-nine-tailed-fox"],
    ]);
  });

  it("keeps the printing rows out of the loader data", async () => {
    expect(await runRouteLoader(Route, PARAMS, DETAIL)).toEqual({
      slug: "origins",
      name: "Origins",
      cardCount: 3,
      printingCount: 4,
      items: [
        { name: "Jinx", url: "/cards/jinx" },
        { name: "Ahri, Nine-Tailed Fox", url: "/cards/ahri-nine-tailed-fox" },
      ],
    });
  });

  it("falls back to a bare title for a set that does not exist", () => {
    expect(headTitle(runRouteHead(Route, PARAMS, undefined))).toBe("Set - OpenRift");
  });
});
