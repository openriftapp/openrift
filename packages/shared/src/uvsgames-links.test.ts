import { describe, expect, it } from "vitest";

import { parseUvsgamesEventId, uvsgamesEventUrl } from "./uvsgames-links.js";

describe("uvsgamesEventUrl", () => {
  it("points at the source's own page for the event", () => {
    expect(uvsgamesEventUrl("4821")).toBe("https://locator.riftbound.uvsgames.com/events/4821");
  });
});

describe("parseUvsgamesEventId", () => {
  it("takes a bare id", () => {
    expect(parseUvsgamesEventId(" 667904 ")).toBe("667904");
  });

  it("takes the locator URL, with or without a trailing slash or query", () => {
    expect(parseUvsgamesEventId("https://locator.riftbound.uvsgames.com/events/667904")).toBe(
      "667904",
    );
    expect(
      parseUvsgamesEventId("https://locator.riftbound.uvsgames.com/events/667904/?tab=standings"),
    ).toBe("667904");
  });

  it("refuses another site's URL", () => {
    expect(parseUvsgamesEventId("https://example.com/events/667904")).toBeNull();
  });

  it("refuses a hostname that only ends in the same letters", () => {
    expect(parseUvsgamesEventId("https://notuvsgames.com/events/1")).toBeNull();
    expect(parseUvsgamesEventId("https://uvsgames.com.evil/events/1")).toBeNull();
  });

  it("refuses text that is neither", () => {
    expect(parseUvsgamesEventId("Summoner Skirmish")).toBeNull();
    expect(parseUvsgamesEventId("0")).toBeNull();
    expect(parseUvsgamesEventId("")).toBeNull();
  });
});
