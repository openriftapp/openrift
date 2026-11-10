import { describe, expect, it } from "vitest";

import { referralTierLabel } from "./referral-tier-label";

describe("referralTierLabel", () => {
  it("has no label below the first tier", () => {
    expect(referralTierLabel(0)).toBeNull();
  });

  it("labels each earned tier", () => {
    expect(referralTierLabel(1)).toBe("Brought a friend");
    expect(referralTierLabel(2)).toBe("Brought 5 friends");
    expect(referralTierLabel(3)).toBe("Brought 25 friends");
  });
});
