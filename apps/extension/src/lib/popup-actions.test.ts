import { describe, expect, it } from "vitest";

import { annotateResult, deckSummary, popupPlan } from "./popup-actions";

describe("popupPlan", () => {
  it("takes the counts on the OpenRift sync page without a second click", () => {
    const plan = popupPlan("https://openrift.app/extension/cardmarket");
    expect(plan.primary).toBe("capture");
    expect(plan.captureOnOpen).toBe(true);
    expect(plan.detectDeck).toBe(false);
  });

  it("marks the page on a seller's offers, keeping a second synchronize", () => {
    const plan = popupPlan("https://www.cardmarket.com/de/Riftbound/Users/x/Offers/Singles");
    expect(plan.primary).toBe("annotate");
    expect(plan.label).toBe("Mark this page");
    expect(plan.showSync).toBe(true);
    expect(plan.detectDeck).toBe(false);
  });

  it("marks a shopping wizard result the same way", () => {
    const plan = popupPlan(
      "https://www.cardmarket.com/en/Riftbound/Wants/ShoppingWizard/Results/2026-9-1-abc",
    );
    expect(plan.primary).toBe("annotate");
    expect(plan.showSync).toBe(true);
  });

  it("synchronizes and looks for a deck anywhere else", () => {
    const plan = popupPlan("https://riftdecks.com/deck/42");
    expect(plan.primary).toBe("refresh");
    expect(plan.label).toBe("Synchronize");
    expect(plan.detectDeck).toBe(true);
    expect(plan.captureOnOpen).toBe(false);
  });

  it("keeps the synchronize but looks for nothing where no extension may read", () => {
    for (const url of ["about:debugging", "moz-extension://abc/options.html", ""]) {
      const plan = popupPlan(url);
      expect(plan.primary).toBe("refresh");
      expect(plan.detectDeck).toBe(false);
    }
  });
});

describe("deckSummary", () => {
  it("names the deck and counts its copies", () => {
    const summary = deckSummary({
      kind: "text",
      list: "MainDeck:\n3 Yasuo\n1 Draven\n\nRunes:\n12 Fury Rune",
      name: "Yasuo Aggro",
    });
    expect(summary).toBe("Yasuo Aggro · 16 cards on this page.");
  });

  it("counts without a name when the page gave none", () => {
    expect(deckSummary({ kind: "text", list: "1 Yasuo" })).toBe(
      "A decklist with 1 card on this page.",
    );
  });

  it("says so for a deck code, which carries no count", () => {
    expect(deckSummary({ kind: "code", code: "RB1abc" })).toBe("A deck code is on this page.");
    expect(deckSummary({ kind: "code", code: "RB1abc", name: "Yasuo Aggro" })).toBe(
      "Yasuo Aggro · a deck code on this page.",
    );
  });

  it("has no section to show without a deck", () => {
    expect(deckSummary({ kind: "none" })).toBeUndefined();
    expect(deckSummary(undefined)).toBeUndefined();
  });
});

describe("annotateResult", () => {
  it("counts what it marked", () => {
    expect(annotateResult({ rows: 6, resolved: 6, annotated: 4 }, true)).toBe("Marked 4 cards.");
    expect(annotateResult({ rows: 6, resolved: 6, annotated: 1 }, true)).toBe("Marked 1 card.");
  });

  it("says so when nothing on the page is on a list", () => {
    expect(annotateResult({ rows: 6, resolved: 6, annotated: 0 }, true)).toBe(
      "Nothing on this page is on your lists.",
    );
  });

  it("asks for a sync when the page was marked without counts", () => {
    expect(annotateResult({ rows: 6, resolved: 6 }, false)).toBe(
      "Pick buttons added. Synchronize to see what you own and want.",
    );
  });

  it("says the page could not be read when rows were found but no card in them", () => {
    expect(annotateResult({ rows: 6, resolved: 0, annotated: 0 }, true)).toBe(
      "Could not read the cards on this page. Cardmarket may have changed its layout.",
    );
    expect(annotateResult({ rows: 6, resolved: 0 }, false)).toBe(
      "Could not read the cards on this page. Cardmarket may have changed its layout.",
    );
  });

  it("names the rows it could not read beside the ones it marked", () => {
    expect(annotateResult({ rows: 6, resolved: 4, annotated: 3 }, true)).toBe(
      "Marked 3 cards. 2 cards could not be read.",
    );
  });

  it("finds no cards on a page without rows", () => {
    expect(annotateResult({ rows: 0, resolved: 0, annotated: 0 }, true)).toBe(
      "Found no cards on this page.",
    );
  });

  it("stays positive when the report did not survive injection", () => {
    expect(annotateResult(undefined, true)).toBe("Counts shown on this page.");
    expect(annotateResult(undefined, false)).toBe(
      "Pick buttons added. Synchronize to see what you own and want.",
    );
  });
});
