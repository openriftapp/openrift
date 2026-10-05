import { describe, expect, it } from "vitest";

import { getOrientation } from "./card-orientation.js";

describe("getOrientation", () => {
  it("returns landscape for Battlefield type", () => {
    expect(getOrientation(["battlefield"])).toBe("landscape");
  });

  it("returns portrait for Unit type", () => {
    expect(getOrientation(["unit"])).toBe("portrait");
  });

  it("returns portrait for Spell type", () => {
    expect(getOrientation(["spell"])).toBe("portrait");
  });

  it("returns portrait for Legend type", () => {
    expect(getOrientation(["legend"])).toBe("portrait");
  });

  it("returns portrait for Rune type", () => {
    expect(getOrientation(["rune"])).toBe("portrait");
  });

  it("returns portrait for Gear type", () => {
    expect(getOrientation(["gear"])).toBe("portrait");
  });

  it("returns portrait for multi-type cards without Battlefield (Unit Gear)", () => {
    expect(getOrientation(["unit", "gear"])).toBe("portrait");
  });

  it("returns landscape when any type is Battlefield", () => {
    expect(getOrientation(["unit", "battlefield"])).toBe("landscape");
  });
});
