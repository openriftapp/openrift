import { describe, expect, it } from "vitest";

import { buildCopyDeltaCursor, parseCopyDeltaCursor } from "./copy-delta-cursor.js";

describe("buildCopyDeltaCursor / parseCopyDeltaCursor", () => {
  it("round-trips a cursor with both keysets set", () => {
    const cursor = {
      safeXid: "5000",
      row: { xid: "4009", id: "a0000000-0001-4000-a000-000000000009" },
      deletion: { xid: "4010", id: "b0000000-0001-4000-a000-000000000010" },
    };
    expect(parseCopyDeltaCursor(buildCopyDeltaCursor(cursor))).toEqual(cursor);
  });

  it("encodes a missing keyset as an empty segment", () => {
    expect(buildCopyDeltaCursor({ safeXid: "5000" })).toBe("5000~~");
  });

  it("parses an empty segment back to an undefined keyset", () => {
    expect(parseCopyDeltaCursor("5000~~")).toEqual({
      safeXid: "5000",
      row: undefined,
      deletion: undefined,
    });
  });

  it("splits a keyset on the first underscore, so a uuid's dashes survive", () => {
    const parsed = parseCopyDeltaCursor("5000~4009_a0000000-0001-4000-a000-000000000009~");
    expect(parsed.row).toEqual({ xid: "4009", id: "a0000000-0001-4000-a000-000000000009" });
  });
});
