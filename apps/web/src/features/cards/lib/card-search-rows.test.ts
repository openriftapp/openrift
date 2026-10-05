import { describe, expect, it } from "vitest";

import { stubPrinting } from "@/test/factories";

import { cardSearchRows, printingSearchRows } from "./card-search-rows";

const first = stubPrinting({
  id: "p-1",
  cardId: "card-1",
  shortCode: "OGN-001",
  publicCode: "ogn-001",
  printedName: "Feuerball",
  card: { name: "Fireball" },
});
const second = stubPrinting({
  id: "p-2",
  cardId: "card-1",
  shortCode: "OGN-001a",
  publicCode: "ogn-001a",
  card: { name: "Fireball" },
});
const other = stubPrinting({ id: "p-3", cardId: "card-2", card: { name: "Shield" } });

describe("printingSearchRows", () => {
  it("builds one row per printing with its own codes", () => {
    const { rows, codesByRowId } = printingSearchRows([first, second]);
    expect(rows.map((row) => row.id)).toEqual(["p-1", "p-2"]);
    expect(rows[0]).toMatchObject({ slug: "OGN-001", name: "Fireball", printing: first });
    expect(rows[0]?.altNames).toContain("Feuerball");
    expect(codesByRowId.get("p-2")).toEqual([{ shortCode: "OGN-001a", publicCode: "ogn-001a" }]);
  });

  it("returns empty rows for no printings", () => {
    const { rows, codesByRowId } = printingSearchRows([]);
    expect(rows).toEqual([]);
    expect(codesByRowId.size).toBe(0);
  });
});

describe("cardSearchRows", () => {
  it("keeps the first printing of each card as its representative", () => {
    const { rows, codesByRowId } = cardSearchRows([first, second, other]);
    expect(rows.map((row) => row.id)).toEqual(["card-1", "card-2"]);
    expect(rows[0]).toMatchObject({ slug: "card-1", printing: first });
    expect(codesByRowId.get("card-1")).toEqual([{ shortCode: "OGN-001", publicCode: "ogn-001" }]);
  });

  it("accepts any iterable", () => {
    const { rows } = cardSearchRows(new Set([other]));
    expect(rows).toHaveLength(1);
  });
});
