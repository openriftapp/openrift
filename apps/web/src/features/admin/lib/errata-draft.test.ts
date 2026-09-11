import { beforeEach, describe, expect, it } from "vitest";

import { makeCardErrata, resetIdCounter } from "@/test/factories";

import {
  EMPTY_ERRATA_DRAFT,
  errataDraftFrom,
  errataDraftInput,
  isErrataDraftComplete,
} from "./errata-draft";

beforeEach(() => {
  resetIdCounter();
});

describe("errataDraftFrom", () => {
  it("turns every missing value into empty text", () => {
    expect(errataDraftFrom(makeCardErrata()).correctedEffectText).toBe("");
    expect(errataDraftFrom(makeCardErrata({ sourceUrl: null, effectiveDate: null }))).toMatchObject(
      { sourceUrl: "", effectiveDate: "" },
    );
  });
});

describe("errataDraftInput", () => {
  it("trims the texts and sends blanks as nothing", () => {
    const draft = {
      ...errataDraftFrom(makeCardErrata()),
      correctedEffectText: "   ",
      sourceUrl: " ",
    };
    expect(errataDraftInput("card-1", draft)).toEqual({
      cardId: "card-1",
      correctedRulesText: "Deal 2 damage to a unit you do not control.",
      correctedEffectText: null,
      source: "Rules update, August 2026",
      sourceUrl: null,
      effectiveDate: "2026-08-15",
    });
  });
});

describe("isErrataDraftComplete", () => {
  it("needs a source and at least one corrected text", () => {
    const draft = errataDraftFrom(makeCardErrata());
    expect(isErrataDraftComplete(draft)).toBe(true);
    expect(isErrataDraftComplete(EMPTY_ERRATA_DRAFT)).toBe(false);
    expect(isErrataDraftComplete({ ...draft, source: " " })).toBe(false);
    expect(
      isErrataDraftComplete({
        ...EMPTY_ERRATA_DRAFT,
        source: "Rules update",
        correctedEffectText: "Draw a card.",
      }),
    ).toBe(true);
  });
});
