import { describe, expect, it } from "vitest";

import { heroStatRowClass } from "./hero-stat-row";

describe("heroStatRowClass", () => {
  it("puts four stats in two columns on phones", () => {
    expect(heroStatRowClass(4)).toContain("grid-cols-2");
    expect(heroStatRowClass(4)).not.toContain("grid-cols-3");
  });

  it("puts three or fewer stats in one row of three columns", () => {
    for (const count of [1, 2, 3]) {
      expect(heroStatRowClass(count)).toContain("grid-cols-3");
    }
  });

  it("keeps two columns past four stats", () => {
    expect(heroStatRowClass(5)).toContain("grid-cols-2");
  });

  it("uses the shared hero gaps and wraps as a row from sm up", () => {
    expect(heroStatRowClass(3).split(" ")).toEqual(
      expect.arrayContaining(["grid", "gap-x-9", "gap-y-3", "sm:flex", "sm:flex-wrap"]),
    );
  });
});
