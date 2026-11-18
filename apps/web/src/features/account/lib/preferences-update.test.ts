import { describe, expect, it } from "vitest";

import { mergeSavedPreferences } from "./preferences-update";

describe("mergeSavedPreferences", () => {
  it("drops a key the update reset, so no null reaches the cache", () => {
    const merged = mergeSavedPreferences(
      { showImages: false, theme: "light" },
      { showImages: null, theme: null },
    );

    expect(merged).toEqual({});
    expect(Object.values(merged)).not.toContain(null);
  });

  it("writes the values the update set", () => {
    expect(
      mergeSavedPreferences({ showImages: true }, { showImages: false, palette: "minimal" }),
    ).toEqual({ showImages: false, palette: "minimal" });
  });

  it("keeps server-only keys the update does not name", () => {
    const emailNotifications = { tradeMatches: true };
    expect(mergeSavedPreferences({ emailNotifications }, { fancyFan: true })).toEqual({
      emailNotifications,
      fancyFan: true,
    });
  });

  it("starts from an empty cache", () => {
    expect(mergeSavedPreferences(undefined, { languages: ["EN"], foilEffect: null })).toEqual({
      languages: ["EN"],
    });
  });
});
