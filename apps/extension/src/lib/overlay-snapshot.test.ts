import { describe, expect, it } from "vitest";

import { countsForProduct, readSnapshotFromPage } from "./overlay-snapshot";

const CAPTURED_AT = "2026-09-09T12:00:00.000Z";

function pageWith(payload: string): Document {
  return new DOMParser().parseFromString(
    `<html><body><script type="application/json" data-openrift-overlay-snapshot>${payload}</script></body></html>`,
    "text/html",
  );
}

const VALID = JSON.stringify({
  lists: [{ id: "0199a0f2-0000-7000-8000-000000000001", name: "Summoner Skirmish wants" }],
  marketplace: "cardmarket",
  generatedAt: "2026-09-09T11:59:00.000Z",
  products: [
    { idProduct: 847_321, finish: "normal", owned: 2, wanted: 1, priceCents: 240 },
    { idProduct: 847_321, finish: "foil", owned: 0, wanted: 3, priceCents: null },
  ],
});

describe("readSnapshotFromPage", () => {
  it("keys the products by id and finish and stamps the capture time", () => {
    const snapshot = readSnapshotFromPage(pageWith(VALID), CAPTURED_AT);

    expect(snapshot?.lists).toEqual([
      { id: "0199a0f2-0000-7000-8000-000000000001", name: "Summoner Skirmish wants" },
    ]);
    expect(snapshot?.capturedAt).toBe(CAPTURED_AT);
    expect(snapshot?.products).toEqual({
      "847321:normal": { owned: 2, wanted: 1, priceCents: 240 },
      "847321:foil": { owned: 0, wanted: 3, priceCents: null },
    });
  });

  it("returns nothing on a page without the hand-off block", () => {
    const doc = new DOMParser().parseFromString("<html><body></body></html>", "text/html");
    expect(readSnapshotFromPage(doc, CAPTURED_AT)).toBeUndefined();
  });

  it("returns nothing when the block is not valid JSON", () => {
    expect(readSnapshotFromPage(pageWith("{oops"), CAPTURED_AT)).toBeUndefined();
  });

  it("returns nothing when the marketplace is not one we know", () => {
    const payload = JSON.stringify({
      lists: [{ id: "x", name: "y" }],
      marketplace: "ebay",
      generatedAt: "2026-09-09T11:59:00.000Z",
      products: [],
    });
    expect(readSnapshotFromPage(pageWith(payload), CAPTURED_AT)).toBeUndefined();
  });

  it("returns nothing when a required field is missing", () => {
    const payload = JSON.stringify({ lists: [{ id: "x", name: "y" }], products: [] });
    expect(readSnapshotFromPage(pageWith(payload), CAPTURED_AT)).toBeUndefined();
  });

  it("returns nothing when no list survives validation", () => {
    const payload = JSON.stringify({
      lists: [{ id: 7 }],
      generatedAt: "2026-09-09T11:59:00.000Z",
      products: [],
    });
    expect(readSnapshotFromPage(pageWith(payload), CAPTURED_AT)).toBeUndefined();
  });

  it("drops product rows that are not a full id, finish and pair of counts", () => {
    const payload = JSON.stringify({
      lists: [{ id: "0199a0f2-0000-7000-8000-000000000001", name: "Wants" }],
      marketplace: "cardmarket",
      generatedAt: "2026-09-09T11:59:00.000Z",
      products: [
        { idProduct: 847_321, finish: "foil", owned: 2, wanted: 1, priceCents: null },
        { idProduct: 847_321, finish: "shiny", owned: 1, wanted: 1, priceCents: null },
        { idProduct: "847321", finish: "foil", owned: 1, wanted: 1, priceCents: null },
        null,
      ],
    });

    expect(readSnapshotFromPage(pageWith(payload), CAPTURED_AT)?.products).toEqual({
      "847321:foil": { owned: 2, wanted: 1, priceCents: null },
    });
  });
});

describe("countsForProduct", () => {
  const snapshot = readSnapshotFromPage(pageWith(VALID), CAPTURED_AT)!;

  it("keeps the two finishes of one product apart", () => {
    expect(countsForProduct(snapshot, 847_321, "normal")).toEqual({
      owned: 2,
      wanted: 1,
      priceCents: 240,
    });
    expect(countsForProduct(snapshot, 847_321, "foil")).toEqual({
      owned: 0,
      wanted: 3,
      priceCents: null,
    });
  });

  it("reads a product outside the snapshot as zero", () => {
    expect(countsForProduct(snapshot, 42, "normal")).toEqual({
      owned: 0,
      wanted: 0,
      priceCents: null,
    });
  });

  it("reads an unresolved row as zero", () => {
    expect(countsForProduct(snapshot, undefined, "normal")).toEqual({
      owned: 0,
      wanted: 0,
      priceCents: null,
    });
  });
});
