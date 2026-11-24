import { describe, expect, it } from "vitest";

import { fnv1a } from "./fnv1a";

describe("fnv1a", () => {
  it("returns the offset basis for an empty string", () => {
    expect(fnv1a("")).toBe(0x81_1c_9d_c5);
  });

  it("matches the published 32-bit test vectors", () => {
    expect(fnv1a("a")).toBe(0xe4_0c_29_2c);
    expect(fnv1a("foobar")).toBe(0xbf_9c_f9_68);
  });
});
