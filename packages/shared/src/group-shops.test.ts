import { describe, expect, it } from "vitest";

import { groupShopKey, parseGroupShopKey } from "./group-shops.js";

describe("group shop keys", () => {
  it("round-trips a key from either source", () => {
    expect(parseGroupShopKey(groupShopKey("uvsgames", 42))).toEqual({
      source: "uvsgames",
      storeId: "42",
    });
    expect(parseGroupShopKey(groupShopKey("playriftbound", "019f-abc"))).toEqual({
      source: "playriftbound",
      storeId: "019f-abc",
    });
  });

  it("rejects an unknown source, a missing id and a non-numeric uvsgames id", () => {
    expect(parseGroupShopKey("elsewhere:42")).toBeNull();
    expect(parseGroupShopKey("uvsgames:")).toBeNull();
    expect(parseGroupShopKey("42")).toBeNull();
    expect(parseGroupShopKey("uvsgames:abc")).toBeNull();
    expect(parseGroupShopKey("uvsgames:2147483648")).toBeNull();
    expect(parseGroupShopKey("uvsgames:2147483647")).not.toBeNull();
  });
});
