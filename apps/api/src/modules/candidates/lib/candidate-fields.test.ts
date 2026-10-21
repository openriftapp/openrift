import { ingestPrintingSchema } from "@openrift/shared/contracts/admin/card-mutations";
import { describe, expect, it } from "vitest";

import { buildCandidatePrintingFields } from "./candidate-fields.js";

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
