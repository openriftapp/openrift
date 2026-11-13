import { describe, expect, it } from "vitest";

import { metaSearchSchema } from "./admin-meta-search";

describe("metaSearchSchema", () => {
  it("accepts an untouched tab as an empty search", () => {
    expect(metaSearchSchema.parse({})).toEqual({});
  });

  it("drops params it does not own", () => {
    expect(metaSearchSchema.parse({ notMine: "x" })).toEqual({});
  });

  it("accepts the three tabs", () => {
    for (const tab of ["catalogue", "review", "public"]) {
      expect(metaSearchSchema.parse({ tab }).tab).toBe(tab);
    }
  });

  it("falls back to the default for an unknown tab", () => {
    expect(metaSearchSchema.parse({ tab: "archive", q: "kept" })).toEqual({ q: "kept" });
  });

  it("coerces the page number out of the URL string", () => {
    expect(metaSearchSchema.parse({ page: "3" }).page).toBe(3);
  });

  it("falls back to the default for a page below one", () => {
    expect(metaSearchSchema.parse({ page: "0", q: "kept" })).toEqual({ q: "kept" });
    expect(metaSearchSchema.parse({ page: "-1", q: "kept" })).toEqual({ q: "kept" });
  });

  it("falls back to the default for a fractional page", () => {
    expect(metaSearchSchema.parse({ page: "1.5", q: "kept" })).toEqual({ q: "kept" });
  });

  it("accepts every catalogue provider as the source", () => {
    for (const source of ["uvsgames", "playloltcg", "topdeck"]) {
      expect(metaSearchSchema.parse({ source }).source).toBe(source);
    }
  });

  it("falls back to the default for an unknown source", () => {
    expect(metaSearchSchema.parse({ source: "melee", q: "kept" })).toEqual({ q: "kept" });
  });

  it("accepts the triage states and the any escape hatch", () => {
    for (const triage of ["new", "accepted", "dismissed", "any"]) {
      expect(metaSearchSchema.parse({ triage }).triage).toBe(triage);
    }
  });

  it("falls back to the default for an unknown triage state", () => {
    expect(metaSearchSchema.parse({ triage: "pending", q: "kept" })).toEqual({ q: "kept" });
  });

  it("coerces a playloltcg status out of the URL string", () => {
    expect(metaSearchSchema.parse({ plStatus: "3" }).plStatus).toBe(3);
  });

  it("falls back to the default for a playloltcg status outside the known set", () => {
    expect(metaSearchSchema.parse({ plStatus: "9", q: "kept" })).toEqual({ q: "kept" });
    expect(metaSearchSchema.parse({ plStatus: "0", q: "kept" })).toEqual({ q: "kept" });
  });

  it("accepts the catalogue sort columns and directions", () => {
    const parsed = metaSearchSchema.parse({ eventSort: "playerCount", eventDir: "desc" });
    expect(parsed).toMatchObject({ eventSort: "playerCount", eventDir: "desc" });
  });

  it("falls back to the default for a sort column that is not a catalogue column", () => {
    expect(metaSearchSchema.parse({ eventSort: "createdAt", q: "kept" })).toEqual({ q: "kept" });
  });

  it("accepts the live sort columns and directions", () => {
    const parsed = metaSearchSchema.parse({ liveSort: "eventDate", liveDir: "asc" });
    expect(parsed).toMatchObject({ liveSort: "eventDate", liveDir: "asc" });
  });

  it("falls back to the default for a catalogue sort column on the live tab", () => {
    expect(metaSearchSchema.parse({ liveSort: "startAt", q: "kept" })).toEqual({ q: "kept" });
  });

  it("accepts the non-provider live sources", () => {
    for (const liveSource of ["usersubmission", "manual", "topdeck"]) {
      expect(metaSearchSchema.parse({ liveSource }).liveSource).toBe(liveSource);
    }
  });

  it("accepts zero as the minimum player count", () => {
    expect(metaSearchSchema.parse({ minPlayers: "0" }).minPlayers).toBe(0);
  });

  it("falls back to the default for a negative minimum player count", () => {
    expect(metaSearchSchema.parse({ minPlayers: "-5", q: "kept" })).toEqual({ q: "kept" });
  });

  it("keeps the boolean toggles as booleans", () => {
    const parsed = metaSearchSchema.parse({
      decklists: true,
      missing: false,
      incompleteStandings: false,
      hasDecks: true,
    });
    expect(parsed).toMatchObject({
      decklists: true,
      missing: false,
      incompleteStandings: false,
      hasDecks: true,
    });
  });

  it("falls back to the default for a stringified boolean toggle", () => {
    expect(metaSearchSchema.parse({ decklists: "true", q: "kept" })).toEqual({ q: "kept" });
  });

  it("passes the free-text params through untouched", () => {
    const parsed = metaSearchSchema.parse({
      q: "Summoner Skirmish",
      tdFormat: "standard",
      liveFormat: "constructed",
      dateFrom: "2026-01-01",
      dateTo: "2026-02-01",
    });
    expect(parsed).toMatchObject({
      q: "Summoner Skirmish",
      tdFormat: "standard",
      liveFormat: "constructed",
      dateFrom: "2026-01-01",
      dateTo: "2026-02-01",
    });
  });
});
