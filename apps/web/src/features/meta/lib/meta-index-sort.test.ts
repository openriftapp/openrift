import { describe, expect, it } from "vitest";

import { nextIndexSort, sortSearchPatch } from "./meta-index-sort";

const DEFAULTS = { sort: "date", direction: "desc" } as const;

describe("nextIndexSort", () => {
  it("flips the direction of the active column", () => {
    expect(nextIndexSort({ sort: "date", direction: "desc" }, "date", new Set())).toEqual({
      sort: "date",
      direction: "asc",
    });
  });

  it("opens a new column descending only when it is listed as descending-first", () => {
    const from = { sort: "name", direction: "asc" } as const;
    expect(nextIndexSort(from, "players", new Set(["players"]))).toEqual({
      sort: "players",
      direction: "desc",
    });
    expect(nextIndexSort(from, "country", new Set(["players"]))).toEqual({
      sort: "country",
      direction: "asc",
    });
  });
});

describe("sortSearchPatch", () => {
  it("leaves the default sort out of the URL", () => {
    expect(sortSearchPatch({ sort: "date", direction: "desc" }, DEFAULTS)).toEqual({
      by: undefined,
      dir: undefined,
    });
  });

  it("keeps the direction when only the direction differs from the default", () => {
    expect(sortSearchPatch({ sort: "date", direction: "asc" }, DEFAULTS)).toEqual({
      by: undefined,
      dir: "asc",
    });
  });

  it("writes both fields for another column", () => {
    expect(sortSearchPatch({ sort: "players", direction: "desc" }, DEFAULTS)).toEqual({
      by: "players",
      dir: "desc",
    });
  });
});
