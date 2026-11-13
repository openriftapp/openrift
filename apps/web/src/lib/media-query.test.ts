import { afterEach, describe, expect, it, vi } from "vitest";

import {
  matchesMediaQuery,
  MOBILE_QUERY,
  prefersReducedMotion,
  REDUCED_MOTION_QUERY,
} from "./media-query";

function stubMatching(matching: string[]) {
  vi.stubGlobal("matchMedia", (query: string) => ({ matches: matching.includes(query) }));
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("matchesMediaQuery", () => {
  it("reports a query the browser matches", () => {
    stubMatching([MOBILE_QUERY]);

    expect(matchesMediaQuery(MOBILE_QUERY)).toBe(true);
    expect(matchesMediaQuery(REDUCED_MOTION_QUERY)).toBe(false);
  });

  it("reports false where matchMedia does not exist", () => {
    vi.stubGlobal("matchMedia", undefined);

    expect(matchesMediaQuery(MOBILE_QUERY)).toBe(false);
  });
});

describe("prefersReducedMotion", () => {
  it("follows the reduced-motion setting", () => {
    stubMatching([REDUCED_MOTION_QUERY]);
    expect(prefersReducedMotion()).toBe(true);

    stubMatching([]);
    expect(prefersReducedMotion()).toBe(false);
  });

  it("assumes motion is fine without matchMedia", () => {
    vi.stubGlobal("matchMedia", undefined);

    expect(prefersReducedMotion()).toBe(false);
  });
});

describe("MOBILE_QUERY", () => {
  it("covers widths below the 768px tablet breakpoint", () => {
    expect(MOBILE_QUERY).toBe("(max-width: 767px)");
  });
});
