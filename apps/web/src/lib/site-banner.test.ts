import { describe, expect, it } from "vitest";

import { pickSiteBanner } from "./site-banner";

describe("pickSiteBanner", () => {
  it("shows the locale banner over the other two", () => {
    expect(pickSiteBanner({ locale: true, milestone: true, install: true })).toBe("locale");
  });

  it("shows the milestone banner over the install nudge", () => {
    expect(pickSiteBanner({ locale: false, milestone: true, install: true })).toBe("milestone");
  });

  it("shows the install nudge when it is the only one due", () => {
    expect(pickSiteBanner({ locale: false, milestone: false, install: true })).toBe("install");
  });

  it("shows nothing when no banner is due", () => {
    expect(pickSiteBanner({ locale: false, milestone: false, install: false })).toBeNull();
  });
});
