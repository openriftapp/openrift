import { describe, expect, it } from "vitest";

import { centsToDollars, formatCents, toCents } from "./money.js";

describe("toCents", () => {
  it("returns null for null input", () => {
    expect(toCents(null)).toBeNull();
  });

  it("returns null for undefined input", () => {
    expect(toCents(undefined)).toBeNull();
  });

  it("returns null for zero", () => {
    expect(toCents(0)).toBeNull();
  });

  it("converts dollar amounts to cents", () => {
    expect(toCents(1.5)).toBe(150);
    expect(toCents(9.99)).toBe(999);
    expect(toCents(0.01)).toBe(1);
  });

  it("rounds fractional cents using Math.round", () => {
    expect(toCents(1.005)).toBe(100);
    expect(toCents(0.1 + 0.2)).toBe(30);
  });

  it("handles negative amounts", () => {
    expect(toCents(-5.25)).toBe(-525);
  });
});

describe("centsToDollars", () => {
  it("returns null for null input", () => {
    expect(centsToDollars(null)).toBeNull();
  });

  it("converts cents to dollars", () => {
    expect(centsToDollars(150)).toBe(1.5);
    expect(centsToDollars(999)).toBe(9.99);
    expect(centsToDollars(1)).toBe(0.01);
  });

  it("converts zero cents to zero dollars", () => {
    expect(centsToDollars(0)).toBe(0);
  });

  it("handles negative cent values", () => {
    expect(centsToDollars(-525)).toBe(-5.25);
  });
});

describe("formatCents", () => {
  it("renders minor units as major-unit currency", () => {
    expect(formatCents(452, "USD")).toBe("$4.52");
    expect(formatCents(380, "EUR")).toBe("€3.80");
    expect(formatCents(0, "USD")).toBe("$0.00");
  });

  it("groups thousands and keeps two decimals", () => {
    expect(formatCents(123_456, "USD")).toBe("$1,234.56");
  });
});
