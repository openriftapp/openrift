import { describe, expect, it } from "vitest";

import { describeScanKey } from "./labels";

describe("describeScanKey", () => {
  it("names a labelled key with its code and language", () => {
    expect(describeScanKey({ name: "Jinx", code: "OGN-001", language: "EN" }, "abc")).toBe(
      "Jinx (OGN-001 EN)",
    );
  });

  it("shortens an unlabelled key", () => {
    expect(describeScanKey(undefined, "0123456789abcdef")).toBe("unknown 01234567");
  });
});
