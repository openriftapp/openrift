import { describe, expect, it } from "vitest";

import { resolveDirection } from "./keys.js";

describe("resolveDirection", () => {
  it("keeps an explicit direction", () => {
    expect(resolveDirection("usd", "asc")).toBe("asc");
    expect(resolveDirection("name", "desc")).toBe("desc");
  });

  it("puts the priciest and newest first under auto", () => {
    expect(resolveDirection("usd", "auto")).toBe("desc");
    expect(resolveDirection("eur")).toBe("desc");
    expect(resolveDirection("released")).toBe("desc");
  });

  it("sorts everything else A to Z under auto", () => {
    expect(resolveDirection("name", "auto")).toBe("asc");
    expect(resolveDirection("might")).toBe("asc");
  });
});
