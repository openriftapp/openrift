import { describe, expect, it } from "vitest";

import { milestoneBannerDecision } from "./milestone-banner";

const latest = { date: "2026-09-12", icon: "languages", title: "Languages", message: "m." };
const now = new Date("2026-09-20T12:00:00Z");

describe("milestoneBannerDecision", () => {
  it("hides when the changelog has no milestone", () => {
    expect(milestoneBannerDecision(null, null, now)).toBe("hide");
  });

  it("seeds on the first visit instead of showing", () => {
    expect(milestoneBannerDecision(latest, null, now)).toBe("seed");
  });

  it("shows a milestone newer than the dismissed one", () => {
    expect(milestoneBannerDecision(latest, "2026-08-31", now)).toBe("show");
  });

  it("hides a milestone already dismissed", () => {
    expect(milestoneBannerDecision(latest, "2026-09-12", now)).toBe("hide");
    expect(milestoneBannerDecision(latest, "2026-09-13", now)).toBe("hide");
  });

  it("hides a milestone older than the cutoff", () => {
    expect(milestoneBannerDecision(latest, "2026-08-31", new Date("2026-10-20T00:00:00Z"))).toBe(
      "hide",
    );
  });
});
