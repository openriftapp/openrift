import { MAX_FACET_VALUES, metaEventFilterQuerySchema } from "@openrift/shared/contracts/meta";
import { describe, expect, it } from "vitest";

import { metaEventsSearchSchema } from "./meta-events-search";
import { deriveSetEras, ERA_CUSTOM, metaEventFilterQuery } from "./meta-scope";

describe("metaEventsSearchSchema", () => {
  it("keeps the scope fields alongside its own", () => {
    expect(
      metaEventsSearchSchema.parse({
        q: "vienna",
        by: "players",
        dir: "asc",
        tiers: ["premier"],
      }),
    ).toMatchObject({ q: "vienna", by: "players", dir: "asc", tiers: ["premier"] });
  });

  it("keeps a holdings filter, and drops one the page does not offer", () => {
    expect(metaEventsSearchSchema.parse({ holds: "decks" }).holds).toBe("decks");
    expect(metaEventsSearchSchema.parse({ holds: "photos" }).holds).toBeUndefined();
  });

  it("keeps every holdings filter the page offers", () => {
    for (const holds of ["decks", "standings", "upcoming", "resultless"]) {
      expect(metaEventsSearchSchema.parse({ holds }).holds).toBe(holds);
    }
  });

  it("drops a needle the API would reject, rather than blanking the page", () => {
    expect(metaEventsSearchSchema.parse({ q: "a".repeat(200) }).q).toBe("a".repeat(200));
    expect(metaEventsSearchSchema.parse({ q: "a".repeat(201) }).q).toBeUndefined();
  });

  it("drops a sort a stale bookmark names but the page no longer has", () => {
    const parsed = metaEventsSearchSchema.parse({ by: "organizer", dir: "sideways" });
    expect(parsed.by).toBeUndefined();
    expect(parsed.dir).toBeUndefined();
  });

  it("keeps the scope fields a bad sort travelled with", () => {
    expect(metaEventsSearchSchema.parse({ by: "organizer", countries: ["AT"] })).toMatchObject({
      countries: ["AT"],
    });
  });

  it("parses an empty URL", () => {
    expect(metaEventsSearchSchema.parse({})).toEqual({});
  });

  it("hands the API nothing the event filter contract rejects", () => {
    const eras = deriveSetEras([], "2026-09-01");
    const hostile = {
      era: ERA_CUSTOM,
      from: "2026-1-1",
      to: "2026-02-31",
      q: "x".repeat(201),
      tiers: [""],
      countries: Array.from({ length: MAX_FACET_VALUES + 1 }, (_, index) => `c-${index}`),
      formatsEx: "standard",
      playersMin: -1,
      holds: "photos",
    };
    const query = metaEventFilterQuery(metaEventsSearchSchema.parse(hostile), eras);

    expect(metaEventFilterQuerySchema.safeParse(query).success).toBe(true);
  });
});
