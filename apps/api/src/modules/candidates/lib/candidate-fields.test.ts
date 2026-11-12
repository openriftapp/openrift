import { ingestPrintingSchema } from "@openrift/shared/contracts/admin/card-mutations";
import { describe, expect, it } from "vitest";

import {
  buildCandidatePrintingFields,
  candidateCardValidator,
  candidatePrintingValidator,
  candidatePrintingValidatorInput,
} from "./candidate-fields.js";

const BASE = { short_code: "OGN-001", external_id: "ext-1" };

function ingest(fields: Record<string, unknown>) {
  return buildCandidatePrintingFields(ingestPrintingSchema.parse({ ...BASE, ...fields }));
}

describe("ingest release dates", () => {
  it("defaults all three fields to null", () => {
    expect(ingest({})).toMatchObject({
      releasedAt: null,
      releasePrecision: null,
      announcedAt: null,
    });
  });

  it("reads a full date as a day release", () => {
    expect(ingest({ released_at: "2026-11-20", announced_at: "2026-10-18" })).toMatchObject({
      releasedAt: "2026-11-20",
      releasePrecision: "day",
      announcedAt: "2026-10-18",
    });
  });

  it("reads YYYY-MM and YYYY as month and year releases", () => {
    expect(ingest({ released_at: "2026-11" })).toMatchObject({
      releasedAt: "2026-11-01",
      releasePrecision: "month",
    });
    expect(ingest({ released_at: "2027" })).toMatchObject({
      releasedAt: "2027-01-01",
      releasePrecision: "year",
    });
  });

  it("snaps a date to the start of the given precision", () => {
    expect(ingest({ released_at: "2026-11-20", release_precision: "quarter" })).toMatchObject({
      releasedAt: "2026-10-01",
      releasePrecision: "quarter",
    });
  });

  it("rejects a precision without a date, finer than the date, or unknown", () => {
    const parse = (fields: Record<string, unknown>) =>
      ingestPrintingSchema.safeParse({ ...BASE, ...fields }).success;
    expect(parse({ release_precision: "month" })).toBe(false);
    expect(parse({ released_at: "2026-11", release_precision: "day" })).toBe(false);
    expect(parse({ released_at: "2026-11-20", release_precision: "week" })).toBe(false);
  });

  it("rejects malformed dates", () => {
    const parse = (fields: Record<string, unknown>) =>
      ingestPrintingSchema.safeParse({ ...BASE, ...fields }).success;
    expect(parse({ released_at: "2026-02-30" })).toBe(false);
    expect(parse({ released_at: "November 2026" })).toBe(false);
    expect(parse({ announced_at: "2026-10" })).toBe(false);
  });
});

describe("ingest printed text", () => {
  it("stores whitespace-only printed text as null", () => {
    expect(
      ingest({
        artist: "  ",
        printed_rules_text: " \n ",
        printed_effect_text: "\t",
        flavor_text: "   ",
        printed_name: " ",
      }),
    ).toMatchObject({
      artist: null,
      printedRulesText: null,
      printedEffectText: null,
      flavorText: null,
      printedName: null,
    });
  });

  it("trims surrounding whitespace and keeps inner line breaks", () => {
    expect(
      ingest({ artist: " Riot Games ", printed_rules_text: " Draw 1.\nGain 1. " }),
    ).toMatchObject({ artist: "Riot Games", printedRulesText: "Draw 1.\nGain 1." });
  });

  it("validates the trimmed values", () => {
    const printing = ingestPrintingSchema.parse({ ...BASE, artist: "  ", flavor_text: " " });
    expect(
      candidatePrintingValidator.safeParse(candidatePrintingValidatorInput(printing)).success,
    ).toBe(true);
  });
});

describe("candidate card name", () => {
  const card = {
    types: ["spell"],
    might: null,
    energy: null,
    power: null,
    might_bonus: null,
    rules_text: null,
    effect_text: null,
    short_code: null,
    external_id: "ext-1",
  };

  it("rejects a name with no letter or digit", () => {
    const result = candidateCardValidator.safeParse({ ...card, name: "!?!" });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe("needs at least one letter or digit");
  });

  it("accepts a name in a non-Latin script", () => {
    expect(candidateCardValidator.safeParse({ ...card, name: "影流之主" }).success).toBe(true);
  });
});
