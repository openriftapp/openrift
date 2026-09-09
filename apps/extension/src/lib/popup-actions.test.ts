import { describe, expect, it } from "vitest";

import { annotateResult, popupPlan } from "./popup-actions";

describe("popupPlan", () => {
  it("takes the counts on the OpenRift sync page without a second click", () => {
    const plan = popupPlan("https://openrift.app/extension/cardmarket");
    expect(plan.primary).toBe("capture");
    expect(plan.captureOnOpen).toBe(true);
    expect(plan.showImport).toBe(false);
  });

  it("marks the page on a seller's offers", () => {
    const plan = popupPlan("https://www.cardmarket.com/de/Riftbound/Users/x/Offers/Singles");
    expect(plan.primary).toBe("annotate");
    expect(plan.label).toBe("Show counts here");
    expect(plan.showImport).toBe(false);
  });

  it("offers the refresh and the deck import anywhere else", () => {
    const plan = popupPlan("https://riftdecks.com/deck/42");
    expect(plan.primary).toBe("refresh");
    expect(plan.showImport).toBe(true);
    expect(plan.captureOnOpen).toBe(false);
  });

  it("keeps the refresh but drops the import where no extension may read", () => {
    for (const url of ["about:debugging", "moz-extension://abc/options.html", ""]) {
      const plan = popupPlan(url);
      expect(plan.primary).toBe("refresh");
      expect(plan.showImport).toBe(false);
    }
  });
});

describe("annotateResult", () => {
  it("counts what it marked", () => {
    expect(annotateResult(4)).toBe("Marked 4 cards.");
    expect(annotateResult(1)).toBe("Marked 1 card.");
  });

  it("says so when nothing on the page is on a list", () => {
    expect(annotateResult(0)).toBe("Nothing on this page is on your lists.");
  });

  it("stays positive when the count did not survive injection", () => {
    expect(annotateResult(undefined)).toBe("Counts shown on this page.");
  });
});
