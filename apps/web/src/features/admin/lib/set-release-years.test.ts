import { describe, expect, it } from "vitest";

import { buildSetReleaseYears, setReleaseYear } from "./set-release-years";

const years = buildSetReleaseYears([
  {
    slug: "OGN",
    releases: {
      EN: { releasedAt: "2025-10-31", precision: "day" },
      ZH: { releasedAt: "2025-09-12", precision: "day" },
      FR: { releasedAt: null, precision: null },
    },
  },
  { slug: "SFD", releases: { EN: { releasedAt: null, precision: null } } },
]);

describe("buildSetReleaseYears", () => {
  it("keys each dated language and the earliest release", () => {
    expect(years).toEqual({ "OGN|EN": 2025, "OGN|ZH": 2025, OGN: 2025 });
  });
});

describe("setReleaseYear", () => {
  it("prefers the language's own release", () => {
    expect(setReleaseYear({ OGN: 2025, "OGN|FR": 2026 }, "OGN", "FR")).toBe(2026);
  });

  it("falls back to the earliest release", () => {
    expect(setReleaseYear(years, "OGN", "FR")).toBe(2025);
    expect(setReleaseYear(years, "OGN")).toBe(2025);
  });

  it("is undefined for a set without a dated release", () => {
    expect(setReleaseYear(years, "SFD", "EN")).toBeUndefined();
  });
});
