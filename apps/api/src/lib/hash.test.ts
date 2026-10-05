import { describe, expect, it } from "vitest";

import { sha256Hex, stableKey } from "./hash.js";

describe("sha256Hex", () => {
  it("returns the lowercase hex digest", () => {
    expect(sha256Hex("abc")).toBe(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
    );
  });

  it("hashes the empty string", () => {
    expect(sha256Hex("")).toBe("e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");
  });
});

describe("stableKey", () => {
  it("hashes the NUL-joined parts and truncates", () => {
    expect(stableKey(["a", "b"], 32)).toBe(sha256Hex("a\0b").slice(0, 32));
    expect(stableKey(["a", "b"], 32)).toHaveLength(32);
  });

  it("keeps part boundaries significant", () => {
    expect(stableKey(["ab", "c"], 64)).not.toBe(stableKey(["a", "bc"], 64));
  });

  it("returns the full digest when length exceeds it", () => {
    expect(stableKey([], 100)).toBe(sha256Hex(""));
  });
});
