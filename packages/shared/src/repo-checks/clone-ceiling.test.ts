import { describe, expect, it } from "vitest";

import {
  compareToCeiling,
  formatClonePair,
  parseCeiling,
  parseCloneReport,
  parseJscpdVersion,
} from "./clone-ceiling.js";

function fragment(name: string, start: number, end: number) {
  return { name, start, end, startLoc: { line: start }, endLoc: { line: end } };
}

describe("parseCloneReport", () => {
  it("relativizes paths and sorts clones largest first", () => {
    const report = {
      statistics: { total: { sources: 12, clones: 2 } },
      duplicates: [
        {
          lines: 13,
          format: "tsx",
          firstFile: fragment("/repo/apps/web/src/a.tsx", 1, 13),
          secondFile: fragment("/repo/apps/web/src/b.tsx", 20, 32),
        },
        {
          lines: 25,
          format: "typescript",
          firstFile: fragment("/repo/apps/api/src/c.ts", 90, 114),
          secondFile: fragment("/repo/apps/api/src/d.ts", 44, 67),
        },
      ],
    };
    expect(parseCloneReport(report, "/repo/")).toEqual({
      sources: 12,
      clones: [
        { first: "apps/api/src/c.ts:90-114", second: "apps/api/src/d.ts:44-67", lines: 25 },
        { first: "apps/web/src/a.tsx:1-13", second: "apps/web/src/b.tsx:20-32", lines: 13 },
      ],
    });
  });

  it("keeps a path outside the root as it is", () => {
    const report = {
      statistics: { total: { sources: 1 } },
      duplicates: [
        {
          lines: 12,
          firstFile: fragment("/elsewhere/x.ts", 1, 12),
          secondFile: fragment("/repo/y.ts", 1, 12),
        },
      ],
    };
    expect(parseCloneReport(report, "/repo").clones[0]?.first).toBe("/elsewhere/x.ts:1-12");
  });

  it("rejects a report without statistics", () => {
    expect(() => parseCloneReport({ duplicates: [] }, "/repo")).toThrow();
  });
});

describe("formatClonePair", () => {
  it("prints both locations and the size", () => {
    expect(formatClonePair({ first: "a.ts:1-12", second: "b.ts:5-16", lines: 12 })).toBe(
      "a.ts:1-12  b.ts:5-16  (12 lines)",
    );
  });
});

describe("compareToCeiling", () => {
  it.each([
    [14, 13, "over"],
    [13, 13, "at"],
    [12, 13, "under"],
  ] as const)("%i clones against a ceiling of %i is %s", (count, ceiling, verdict) => {
    expect(compareToCeiling(count, ceiling)).toBe(verdict);
  });
});

describe("parseCeiling", () => {
  it("reads the clone count and the jscpd version it was measured with", () => {
    expect(parseCeiling('{ "jscpd": "5.4.2", "clones": 13 }\n')).toEqual({
      jscpd: "5.4.2",
      clones: 13,
    });
  });

  it.each([
    "",
    "13",
    '{ "clones": 13 }',
    '{ "jscpd": "5.4", "clones": 13 }',
    '{ "jscpd": "5.4.2", "clones": -1 }',
    '{ "jscpd": "5.4.2", "clones": 1.5 }',
  ])("rejects %j", (text) => {
    expect(() => parseCeiling(text)).toThrow();
  });
});

describe("parseJscpdVersion", () => {
  it("reads the version from `jscpd --version`", () => {
    expect(parseJscpdVersion("jscpd 5.4.2\n")).toBe("5.4.2");
  });

  it("returns null for other output", () => {
    expect(parseJscpdVersion("jscpd: no prebuilt binary for this platform")).toBeNull();
  });
});
