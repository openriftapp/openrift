import { META_MAX_PAGE_SIZE, STANDINGS_PAGE_SIZE } from "@openrift/shared/meta-query";
import { describe, expect, it } from "vitest";

import {
  metaStandingsSearchSchema,
  groupsByLegend,
  standingsPageQuery,
  standingsPageSize,
} from "./meta-standings-search";

describe("metaStandingsSearchSchema", () => {
  it("reads the page and the size a link carries", () => {
    expect(
      metaStandingsSearchSchema.parse({ page: "3", per: "50", q: "ana", list: "with" }),
    ).toEqual({ page: 3, per: 50, q: "ana", list: "with", legend: undefined, by: undefined });
  });

  it("keeps the whole field as a size of its own", () => {
    expect(metaStandingsSearchSchema.parse({ per: "all" }).per).toBe("all");
  });

  it("drops a value a stale link carries rather than failing the route", () => {
    expect(metaStandingsSearchSchema.parse({ page: -2, per: 9000, list: "some" })).toEqual({
      page: undefined,
      per: undefined,
      q: undefined,
      list: undefined,
      legend: undefined,
      by: undefined,
    });
  });

  it("reads the grouping a link carries and drops an unknown one", () => {
    expect(metaStandingsSearchSchema.parse({ by: "legend" }).by).toBe("legend");
    expect(metaStandingsSearchSchema.parse({ by: "deck" }).by).toBeUndefined();
  });

  it("drops a legend that is not an id the API would accept", () => {
    expect(metaStandingsSearchSchema.parse({ legend: "azir" }).legend).toBeUndefined();
    expect(metaStandingsSearchSchema.parse({ legend: "none" }).legend).toBe("none");
    expect(
      metaStandingsSearchSchema.parse({ legend: "0199f1a2-6b3c-7d4e-8f90-1a2b3c4d5e6f" }).legend,
    ).toBe("0199f1a2-6b3c-7d4e-8f90-1a2b3c4d5e6f");
  });

  it("drops a search longer than the API takes", () => {
    expect(metaStandingsSearchSchema.parse({ q: "a".repeat(201) }).q).toBeUndefined();
    expect(metaStandingsSearchSchema.parse({ q: "a".repeat(200) }).q).toHaveLength(200);
  });
});

describe("standingsPageSize", () => {
  it("defaults to the page the event payload already carries", () => {
    expect(standingsPageSize({}, 2054)).toBe(STANDINGS_PAGE_SIZE);
  });

  it("takes the size the URL names", () => {
    expect(standingsPageSize({ per: 50 }, 2054)).toBe(50);
  });

  it("asks for the whole field, and no more than the API serves at once", () => {
    expect(standingsPageSize({ per: "all" }, 2054)).toBe(2054);
    expect(standingsPageSize({ per: "all" }, 40_000)).toBe(META_MAX_PAGE_SIZE);
  });
});

describe("standingsPageQuery", () => {
  it("turns a page into the slice the API takes", () => {
    expect(standingsPageQuery({ page: 3, per: 50 }, 2054)).toMatchObject({
      limit: 50,
      offset: 100,
    });
  });

  it("opens at the first page when the URL names none", () => {
    expect(standingsPageQuery({}, 2054)).toMatchObject({ limit: 200, offset: 0 });
  });

  it("carries the narrowings, a blank search box left off", () => {
    expect(standingsPageQuery({ q: "  ana  ", list: "with", legend: "card-1" }, 100)).toMatchObject(
      {
        q: "ana",
        list: "with",
        legend: "card-1",
      },
    );
    expect(standingsPageQuery({ q: "   " }, 100).q).toBeUndefined();
  });

  it("asks for the whole field when grouped, whatever page the URL names", () => {
    expect(
      standingsPageQuery({ page: 3, per: 50, list: "with", by: "legend" }, 2054, true),
    ).toMatchObject({ list: "with", limit: 2054, offset: 0 });
  });
});

describe("groupsByLegend", () => {
  it("groups only where the legend filter shows", () => {
    expect(groupsByLegend({ by: "legend" }, 9, 2)).toBe(true);
    expect(groupsByLegend({ by: "legend" }, 8, 2)).toBe(false);
    expect(groupsByLegend({ by: "legend" }, 9, 1)).toBe(false);
    expect(groupsByLegend({}, 9, 2)).toBe(false);
  });
});
