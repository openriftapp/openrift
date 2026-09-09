import { describe, expect, it } from "vitest";

import { parsePriceCents, priceVerdict } from "./cardmarket-price";

describe("parsePriceCents", () => {
  it("reads the German format Cardmarket prints by default", () => {
    expect(parsePriceCents("1,00 €")).toBe(100);
    expect(parsePriceCents("0,02 €")).toBe(2);
    expect(parsePriceCents("1.234,56 €")).toBe(123_456);
  });

  it("reads the English format", () => {
    expect(parsePriceCents("€1.00")).toBe(100);
    expect(parsePriceCents("$19.99")).toBe(1999);
    expect(parsePriceCents("1,234.56 €")).toBe(123_456);
  });

  it("reads a whole number with no decimals", () => {
    expect(parsePriceCents("7 €")).toBe(700);
    expect(parsePriceCents("1.000 €")).toBe(100_000);
  });

  it("reads a single decimal place", () => {
    expect(parsePriceCents("1,5 €")).toBe(150);
  });

  it("returns nothing for text carrying no number", () => {
    expect(parsePriceCents("ab sofort")).toBeUndefined();
    expect(parsePriceCents("")).toBeUndefined();
  });
});

describe("priceVerdict", () => {
  it("calls anything at or under the reference below", () => {
    expect(priceVerdict(50, 100)).toBe("below");
    expect(priceVerdict(100, 100)).toBe("below");
  });

  it("allows a fifth over before it stops being near", () => {
    expect(priceVerdict(101, 100)).toBe("near");
    expect(priceVerdict(120, 100)).toBe("near");
  });

  it("calls more than a fifth over above", () => {
    expect(priceVerdict(121, 100)).toBe("above");
    expect(priceVerdict(400, 100)).toBe("above");
  });

  it("judges nothing against a reference of nothing", () => {
    expect(priceVerdict(100, 0)).toBeUndefined();
  });
});
