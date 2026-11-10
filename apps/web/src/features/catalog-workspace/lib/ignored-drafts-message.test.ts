import { describe, expect, it } from "vitest";

import { ignoredDraftsMessage } from "./ignored-drafts-message";

describe("ignoredDraftsMessage", () => {
  it("counts the ignored drafts", () => {
    expect(ignoredDraftsMessage(1, 0)).toBe("Ignored 1 new card.");
    expect(ignoredDraftsMessage(3, 0)).toBe("Ignored 3 new cards.");
  });

  it("names the contributor-only drafts that stay", () => {
    expect(ignoredDraftsMessage(2, 1)).toBe(
      "Ignored 2 new cards. 1 with only contributor submissions stays.",
    );
    expect(ignoredDraftsMessage(0, 2)).toBe(
      "No new card ignored. 2 with only contributor submissions stay.",
    );
  });
});
