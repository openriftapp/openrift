import { describe, expect, it } from "vitest";

import { effectiveLanguageOrder } from "./language-order";

const rows = [
  { slug: "fr", sortOrder: 2 },
  { slug: "en", sortOrder: 1 },
  { slug: "de", sortOrder: 3 },
];

describe("effectiveLanguageOrder", () => {
  it("prefers the user's own order when set", () => {
    expect(effectiveLanguageOrder(["de", "en"], rows)).toEqual(["de", "en"]);
  });

  it("falls back to the catalog rows sorted by sortOrder", () => {
    expect(effectiveLanguageOrder([], rows)).toEqual(["en", "fr", "de"]);
  });

  it("does not mutate the fallback rows", () => {
    const copy = [...rows];
    effectiveLanguageOrder([], rows);
    expect(rows).toEqual(copy);
  });
});
