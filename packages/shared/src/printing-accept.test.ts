import { describe, expect, it } from "vitest";

import { REQUIRED_ACCEPT_PRINTING_FIELDS, resolveFinish } from "./printing-accept.js";

describe("resolveFinish", () => {
  it("keeps a stated finish", () => {
    expect(resolveFinish("metal", "common")).toBe("metal");
  });

  it("infers normal for common and uncommon", () => {
    expect(resolveFinish(null, "common")).toBe("normal");
    expect(resolveFinish(undefined, "uncommon")).toBe("normal");
    expect(resolveFinish("", "Uncommon")).toBe("normal");
  });

  it("infers foil for every higher rarity", () => {
    expect(resolveFinish(null, "rare")).toBe("foil");
    expect(resolveFinish(null, "epic")).toBe("foil");
    expect(resolveFinish(null, "showcase")).toBe("foil");
  });

  it("returns null when neither finish nor rarity is known", () => {
    expect(resolveFinish(null, null)).toBeNull();
    expect(resolveFinish("", "")).toBeNull();
  });
});

describe("REQUIRED_ACCEPT_PRINTING_FIELDS", () => {
  it("requires a public code", () => {
    expect(REQUIRED_ACCEPT_PRINTING_FIELDS).toContain("publicCode");
  });
});
