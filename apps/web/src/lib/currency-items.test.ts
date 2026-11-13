import { describe, expect, it } from "vitest";

import { currencySelectItems, isCurrency } from "./currency-items";

describe("isCurrency", () => {
  it("accepts the supported currencies only", () => {
    expect(isCurrency("EUR")).toBe(true);
    expect(isCurrency("USD")).toBe(true);
    expect(isCurrency("GBP")).toBe(false);
  });
});

describe("currencySelectItems", () => {
  it("offers every supported currency with its label", () => {
    expect(currencySelectItems()).toEqual([
      { value: "EUR", label: "Euro (EUR)" },
      { value: "USD", label: "US Dollar (USD)" },
    ]);
  });
});
