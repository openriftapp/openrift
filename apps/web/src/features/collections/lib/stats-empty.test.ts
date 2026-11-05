import { describe, expect, it } from "vitest";

import { statsBody } from "./stats-empty";

describe("statsBody", () => {
  it("waits until the stats are ready", () => {
    expect(statsBody(false, 0, 0)).toBe("loading");
  });

  it("shows the stats once any copy is counted", () => {
    expect(statsBody(true, 3, 2)).toBe("stats");
  });

  it("calls an unfiltered zero an empty collection", () => {
    expect(statsBody(true, 0, 0)).toBe("empty");
  });

  it("calls a filtered zero a non-match, so the filters stay reachable", () => {
    expect(statsBody(true, 0, 1)).toBe("no-match");
  });
});
