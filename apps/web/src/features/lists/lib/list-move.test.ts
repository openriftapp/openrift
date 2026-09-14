import { describe, expect, it } from "vitest";

import { moveNeedsDialog, movePickFor } from "./list-move";

describe("movePickFor", () => {
  it("needs nothing for same or narrower kinds", () => {
    expect(movePickFor("copy", "copy")).toBe("none");
    expect(movePickFor("copy", "printing")).toBe("none");
    expect(movePickFor("printing", "card")).toBe("none");
  });

  it("needs a printing for card → printing and copies for anything → copy", () => {
    expect(movePickFor("card", "printing")).toBe("printing");
    expect(movePickFor("card", "copy")).toBe("copies");
    expect(movePickFor("printing", "copy")).toBe("copies");
  });
});

describe("moveNeedsDialog", () => {
  it("is false only for the same intent and a same-or-narrower kind", () => {
    expect(
      moveNeedsDialog({ kind: "copy", intent: "wish" }, { kind: "card", intent: "wish" }),
    ).toBe(false);
    expect(
      moveNeedsDialog({ kind: "card", intent: "wish" }, { kind: "card", intent: "trade" }),
    ).toBe(true);
    expect(
      moveNeedsDialog({ kind: "card", intent: "wish" }, { kind: "printing", intent: "wish" }),
    ).toBe(true);
  });
});
