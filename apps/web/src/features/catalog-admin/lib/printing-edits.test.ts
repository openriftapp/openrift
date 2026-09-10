import { describe, expect, it } from "vitest";

import {
  printingDraft,
  printingDraftChanges,
  printingDraftIsValid,
} from "@/features/catalog-admin/lib/printing-edits";
import { makeAdminPrinting } from "@/test/factories";

describe("printingDraft", () => {
  it("seeds the draft from the printing, with the set slug as the set id", () => {
    const printing = makeAdminPrinting({ setSlug: "ogn", comment: "Launch party" });
    const draft = printingDraft(printing);
    expect(draft.setId).toBe("ogn");
    expect(draft.comment).toBe("Launch party");
    expect(draft.printedYear).toBe("2026");
  });

  it("renders absent values as empty strings", () => {
    const draft = printingDraft(makeAdminPrinting({ printedYear: null, flavorText: null }));
    expect(draft.printedYear).toBe("");
    expect(draft.flavorText).toBe("");
  });
});

describe("printingDraftChanges", () => {
  const printing = makeAdminPrinting({
    artist: "Sixmorevodka",
    markerSlugs: ["promo", "prerelease"],
  });

  it("reports nothing when the draft is untouched", () => {
    expect(printingDraftChanges(printing, printingDraft(printing))).toEqual([]);
  });

  it("reports one entry per changed field", () => {
    const draft = { ...printingDraft(printing), artist: "Kudos", rarity: "rare" };
    expect(printingDraftChanges(printing, draft)).toEqual([
      { field: "rarity", value: "rare" },
      { field: "artist", value: "Kudos" },
    ]);
  });

  it("trims text before comparing", () => {
    const draft = { ...printingDraft(printing), artist: "  Sixmorevodka  " };
    expect(printingDraftChanges(printing, draft)).toEqual([]);
  });

  it("sends an emptied nullable field as null", () => {
    const commented = makeAdminPrinting({ comment: "Launch party" });
    const draft = { ...printingDraft(commented), comment: "   " };
    expect(printingDraftChanges(commented, draft)).toEqual([{ field: "comment", value: null }]);
  });

  it("parses the printed year into a number", () => {
    const draft = { ...printingDraft(printing), printedYear: "2027" };
    expect(printingDraftChanges(printing, draft)).toEqual([{ field: "printedYear", value: 2027 }]);
  });

  it("ignores a reorder of the marker slugs", () => {
    const draft = { ...printingDraft(printing), markerSlugs: ["prerelease", "promo"] };
    expect(printingDraftChanges(printing, draft)).toEqual([]);
  });

  it("reports an added marker", () => {
    const draft = { ...printingDraft(printing), markerSlugs: ["promo"] };
    expect(printingDraftChanges(printing, draft)).toEqual([
      { field: "markerSlugs", value: ["promo"] },
    ]);
  });

  it("reports a flipped boolean", () => {
    const draft = { ...printingDraft(printing), isSigned: true };
    expect(printingDraftChanges(printing, draft)).toEqual([{ field: "isSigned", value: true }]);
  });
});

describe("printingDraftIsValid", () => {
  const printing = makeAdminPrinting();

  it("accepts a complete draft", () => {
    expect(printingDraftIsValid(printingDraft(printing))).toBe(true);
  });

  it("rejects a blank short code", () => {
    expect(printingDraftIsValid({ ...printingDraft(printing), shortCode: "  " })).toBe(false);
  });

  it("rejects a blank artist", () => {
    expect(printingDraftIsValid({ ...printingDraft(printing), artist: "" })).toBe(false);
  });
});
