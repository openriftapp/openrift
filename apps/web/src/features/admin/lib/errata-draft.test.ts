import { beforeEach, describe, expect, it } from "vitest";

import { makeCardErrata, resetIdCounter } from "@/test/factories";

import type { AdminCardErrata } from "./errata-draft";
import {
  EMPTY_ERRATA_DRAFT,
  errataDraftFrom,
  errataDraftInput,
  isErrataDraftComplete,
} from "./errata-draft";

function adminErrata(overrides: Partial<AdminCardErrata> = {}): AdminCardErrata {
  return { ...makeCardErrata(), announcementId: null, ...overrides };
}

beforeEach(() => {
  resetIdCounter();
});

describe("errataDraftFrom", () => {
  it("turns every missing value into empty text", () => {
    expect(errataDraftFrom(adminErrata()).correctedEffectText).toBe("");
    expect(errataDraftFrom(adminErrata({ sourceUrl: null, effectiveDate: null }))).toMatchObject({
      sourceUrl: "",
      effectiveDate: "",
    });
  });
});

describe("errataDraftInput", () => {
  it("trims the texts and sends blanks as nothing", () => {
    const draft = {
      ...errataDraftFrom(adminErrata()),
      correctedEffectText: "   ",
      sourceUrl: " ",
    };
    expect(errataDraftInput("card-1", draft)).toEqual({
      cardId: "card-1",
      announcementId: null,
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
    const draft = errataDraftFrom(adminErrata());
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

describe("announced errata", () => {
  it("leaves the source fields empty when the errata belongs to an announcement", () => {
    expect(errataDraftFrom(adminErrata({ announcementId: "a-1" }))).toMatchObject({
      announcementId: "a-1",
      source: "",
      sourceUrl: "",
      effectiveDate: "",
    });
  });

  it("sends no source fields with an announcement", () => {
    const draft = { ...errataDraftFrom(adminErrata()), announcementId: "a-1" };
    expect(errataDraftInput("card-1", draft)).toMatchObject({
      announcementId: "a-1",
      source: null,
      sourceUrl: null,
      effectiveDate: null,
    });
  });

  it("is complete with an announcement and no source", () => {
    expect(
      isErrataDraftComplete({
        ...EMPTY_ERRATA_DRAFT,
        announcementId: "a-1",
        correctedRulesText: "Draw a card.",
      }),
    ).toBe(true);
  });
});
