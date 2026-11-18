import { describe, expect, it } from "vitest";

import { routeChromeMode } from "./chrome-mode";

describe("routeChromeMode", () => {
  it("is undefined when no match declares one", () => {
    expect(
      routeChromeMode([{ staticData: {} }, { staticData: { hideFooter: true } }, {}]),
    ).toBeUndefined();
  });

  it("takes the deepest declaring match", () => {
    expect(
      routeChromeMode([
        { staticData: { chrome: "bare" } },
        { staticData: { chrome: "transparent" } },
        { staticData: {} },
      ]),
    ).toBe("transparent");
  });
});
