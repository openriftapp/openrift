import { describe, expect, it } from "vitest";

import {
  clampPageLimit,
  decodeXidKeyset,
  encodeXidKeyset,
  pinWatermark,
  takePage,
} from "./xid-watermark.js";

describe("pinWatermark", () => {
  it("keeps the server watermark without a cursor", () => {
    expect(pinWatermark("5000")).toBe("5000");
  });

  it("narrows to a lower cursor watermark", () => {
    expect(pinWatermark("5000", "4000")).toBe("4000");
  });

  it("ignores a cursor watermark above the server's", () => {
    expect(pinWatermark("5000", "9000")).toBe("5000");
  });

  it("compares numerically, not as strings", () => {
    expect(pinWatermark("10000", "9000")).toBe("9000");
  });
});

describe("encodeXidKeyset / decodeXidKeyset", () => {
  it("round-trips a keyset", () => {
    const keyset = { xid: "4009", id: "a0000000-0001-4000-a000-000000000009" };
    expect(decodeXidKeyset(encodeXidKeyset(keyset))).toEqual(keyset);
  });

  it("encodes a missing keyset as an empty string", () => {
    expect(encodeXidKeyset()).toBe("");
  });

  it("decodes a part without a separator to undefined", () => {
    expect(decodeXidKeyset("")).toBeUndefined();
    expect(decodeXidKeyset("4009")).toBeUndefined();
  });

  it("splits on the first underscore only", () => {
    expect(decodeXidKeyset("4009_a_b")).toEqual({ xid: "4009", id: "a_b" });
  });
});

describe("clampPageLimit", () => {
  it("defaults to the max", () => {
    expect(clampPageLimit(undefined, 5000)).toBe(5000);
  });

  it("keeps a smaller limit", () => {
    expect(clampPageLimit(10, 5000)).toBe(10);
  });

  it("caps a larger limit", () => {
    expect(clampPageLimit(9999, 5000)).toBe(5000);
  });
});

describe("takePage", () => {
  it("reports drained when the extra row is absent", () => {
    expect(takePage([1, 2], 2)).toEqual({ page: [1, 2], drained: true });
  });

  it("drops the look-ahead row and reports more", () => {
    expect(takePage([1, 2, 3], 2)).toEqual({ page: [1, 2], drained: false });
  });

  it("handles an empty read", () => {
    expect(takePage([], 2)).toEqual({ page: [], drained: true });
  });
});
