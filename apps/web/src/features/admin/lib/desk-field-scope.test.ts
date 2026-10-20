import { describe, expect, it } from "vitest";

import { fieldsInScope } from "./desk-field-scope";

const fields = {
  setId: "set-1",
  markerSlugs: ["stamped"],
  codeTba: false,
  shortCode: "OGN-101",
  finish: "foil",
  language: "EN",
  artist: "Kudos Productions",
  size: "standard",
  distributionChannelSlugs: ["store-event"],
  announcedAt: null,
  releasedAt: "2026-10-01",
  releasePrecision: "day",
  comment: null,
};

describe("fieldsInScope", () => {
  it("sends every field for the full form", () => {
    expect(fieldsInScope(fields, "all")).toEqual(fields);
  });

  it("sends only the printing's own fields for the printing form", () => {
    expect(Object.keys(fieldsInScope(fields, "printing")).toSorted()).toEqual([
      "announcedAt",
      "comment",
      "distributionChannelSlugs",
      "releasePrecision",
      "releasedAt",
      "size",
    ]);
  });

  it("sends only face fields for a face form, so a printing edit never touches a shared face", () => {
    expect(Object.keys(fieldsInScope(fields, "face")).toSorted()).toEqual([
      "artist",
      "codeTba",
      "finish",
      "language",
      "markerSlugs",
      "setId",
      "shortCode",
    ]);
  });
});
