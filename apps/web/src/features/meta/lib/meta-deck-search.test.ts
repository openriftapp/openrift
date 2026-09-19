import { MAX_FACET_VALUES } from "@openrift/shared/contracts/meta";
import { describe, expect, it } from "vitest";

import { metaDeckSearchSchema, metaOverviewSearchSchema } from "./meta-deck-search";

describe("metaDeckSearchSchema", () => {
  it("reads the cost bound, the sideboard preference and both value bounds", () => {
    expect(
      metaDeckSearchSchema.parse({ cost: 25, side: true, valueMin: 10, valueMax: 200 }),
    ).toMatchObject({ cost: 25, side: true, valueMin: 10, valueMax: 200 });
  });

  it("keeps a cost bound of zero", () => {
    expect(metaDeckSearchSchema.parse({ cost: 0 }).cost).toBe(0);
  });

  it("leaves every new param absent when the URL carries none", () => {
    const parsed = metaDeckSearchSchema.parse({});
    expect(parsed.cost).toBeUndefined();
    expect(parsed.side).toBeUndefined();
    expect(parsed.valueMin).toBeUndefined();
    expect(parsed.valueMax).toBeUndefined();
  });

  it("drops a negative bound rather than failing the route", () => {
    expect(metaDeckSearchSchema.parse({ cost: -5 }).cost).toBeUndefined();
    expect(metaDeckSearchSchema.parse({ valueMin: -1 }).valueMin).toBeUndefined();
  });

  it("drops a bound that is not a number", () => {
    expect(metaDeckSearchSchema.parse({ cost: "cheap" }).cost).toBeUndefined();
    expect(metaDeckSearchSchema.parse({ side: "yes" }).side).toBeUndefined();
  });

  it("drops an events facet holding an empty value the API would reject", () => {
    expect(metaDeckSearchSchema.parse({ events: ["worlds", ""] }).events).toBeUndefined();
    expect(metaDeckSearchSchema.parse({ events: ["worlds"] }).events).toEqual(["worlds"]);
  });

  it("drops a legends facet holding something that is not an id", () => {
    expect(metaDeckSearchSchema.parse({ legends: ["yasuo"] }).legends).toBeUndefined();
  });

  it("drops a facet list longer than the API accepts", () => {
    const events = Array.from({ length: MAX_FACET_VALUES + 1 }, (_, index) => `event-${index}`);
    expect(metaDeckSearchSchema.parse({ events }).events).toBeUndefined();
    expect(metaDeckSearchSchema.parse({ events: events.slice(1) }).events).toHaveLength(
      MAX_FACET_VALUES,
    );
  });
});

describe("metaOverviewSearchSchema", () => {
  it("drops a needle the API would reject, rather than blanking the page", () => {
    expect(metaOverviewSearchSchema.parse({ q: "a".repeat(200) }).q).toBe("a".repeat(200));
    expect(metaOverviewSearchSchema.parse({ q: "a".repeat(201) }).q).toBeUndefined();
  });
});
