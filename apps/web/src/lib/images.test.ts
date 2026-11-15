import { describe, expect, it } from "vitest";

import { cardAspectVar, needsCssRotation } from "./images";

describe("cardAspectVar", () => {
  it("uses the landscape ratio for a landscape card", () => {
    expect(cardAspectVar("landscape")).toBe("var(--aspect-card-landscape)");
  });

  it("uses the card ratio for a portrait card", () => {
    expect(cardAspectVar("portrait")).toBe("var(--aspect-card)");
  });
});

describe("needsCssRotation", () => {
  it("returns true for landscape orientation", () => {
    expect(needsCssRotation("landscape")).toBe(true);
  });

  it("returns false for portrait orientation", () => {
    expect(needsCssRotation("portrait")).toBe(false);
  });
});
