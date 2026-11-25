import { describe, expect, it } from "vitest";

import { deskCreateFields, normalizedRelease } from "./desk-printing-fields";

describe("normalizedRelease", () => {
  it("moves a month release to the first of the month", () => {
    expect(normalizedRelease("2026-11-19", "month")).toEqual({
      releasedAt: "2026-11-01",
      precision: "month",
    });
  });

  it("drops the precision of a printing without a date", () => {
    expect(normalizedRelease(null, "month")).toEqual({ releasedAt: null, precision: null });
  });
});

describe("deskCreateFields", () => {
  const base = {
    setId: "OGN",
    distributionChannelSlugs: ["summoner-skirmish"],
    markerSlugs: [],
    codeTba: false,
    shortCode: " OGN-001 ",
    finish: "foil",
    language: "EN",
    size: "standard",
    artist: "  ",
    announcedAt: null,
    releasedAt: null,
    precision: null,
    comment: "  ",
  };

  it("trims the code and leaves a blank artist and comment out", () => {
    expect(deskCreateFields(base)).toMatchObject({
      shortCode: "OGN-001",
      artist: undefined,
      comment: null,
    });
  });

  it("sends no short code for a code still to be announced", () => {
    expect(deskCreateFields({ ...base, codeTba: true }).shortCode).toBeUndefined();
  });
});
