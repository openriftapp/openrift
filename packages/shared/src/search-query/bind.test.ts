import { describe, expect, it } from "vitest";

import { bindSearchQuery } from "./bind.js";
import { parseSearchQuery } from "./parse.js";

describe("bindSearchQuery", () => {
  it("accepts known slugs case-insensitively", () => {
    const parsed = parseSearchQuery("d:Fury s:OGN");
    expect(bindSearchQuery(parsed, { domain: ["fury"], set: ["OGN"] })).toEqual([]);
  });

  it("warns about an unknown slug", () => {
    const parsed = parseSearchQuery("d:purple");
    expect(bindSearchQuery(parsed, { domain: ["fury", "calm"] })).toEqual([
      {
        code: "unknownValue",
        severity: "warning",
        span: { start: 0, end: 8 },
        key: "domain",
        value: "purple",
      },
    ]);
  });

  it("checks each entry of a domain list", () => {
    expect(bindSearchQuery(parseSearchQuery("d<=fury,calm"), { domain: ["fury", "calm"] })).toEqual(
      [],
    );
    expect(bindSearchQuery(parseSearchQuery("d<=fury,purple"), { domain: ["fury"] })).toHaveLength(
      1,
    );
  });

  it("skips keys without a vocabulary", () => {
    expect(bindSearchQuery(parseSearchQuery("marker:anything"), {})).toEqual([]);
  });

  it("rejects keys the surface cannot evaluate", () => {
    const diagnostics = bindSearchQuery(parseSearchQuery("owned>=1 t:unit"), {}, ["owned"]);
    expect(diagnostics).toEqual([
      expect.objectContaining({ code: "unsupportedKey", severity: "error", key: "owned" }),
    ]);
  });
});
