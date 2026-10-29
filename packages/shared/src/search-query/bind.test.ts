import { describe, expect, it } from "vitest";

import { resolveSearchQuery } from "./bind.js";
import { parseSearchQuery } from "./parse.js";

describe("resolveSearchQuery", () => {
  it("accepts known slugs case-insensitively", () => {
    const resolved = resolveSearchQuery(parseSearchQuery("d:Fury s:OGN"), {
      domain: ["fury"],
      set: ["OGN"],
    });
    expect(resolved.diagnostics).toEqual([]);
    expect(resolved.clauses.map((clause) => clause.value)).toEqual(["fury", "ogn"]);
  });

  it("ignores an unknown slug with a warning", () => {
    const resolved = resolveSearchQuery(parseSearchQuery("d:purple"), {
      domain: ["fury", "calm"],
    });
    expect(resolved.root).toEqual({ kind: "ignored", span: { start: 0, end: 8 } });
    expect(resolved.clauses).toEqual([]);
    expect(resolved.diagnostics).toEqual([
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
    const vocabulary = { domain: ["fury", "calm"] };
    expect(resolveSearchQuery(parseSearchQuery("d<=fury,calm"), vocabulary).diagnostics).toEqual(
      [],
    );
    expect(
      resolveSearchQuery(parseSearchQuery("d<=fury,purple"), vocabulary).diagnostics,
    ).toHaveLength(1);
  });

  it("resolves a name to its value", () => {
    const resolved = resolveSearchQuery(parseSearchQuery('s:"proving grounds"'), {
      set: [{ value: "OGS", names: ["Proving Grounds"] }],
    });
    expect(resolved.root).toMatchObject({ kind: "clause", value: "ogs" });
  });

  it("resolves a prefix only for rarity and domain", () => {
    const vocabulary = { rarity: ["common", "epic"], set: ["OGN"] };
    expect(resolveSearchQuery(parseSearchQuery("r:ep"), vocabulary).clauses[0]?.value).toBe("epic");
    expect(resolveSearchQuery(parseSearchQuery("s:og"), vocabulary).diagnostics[0]).toMatchObject({
      code: "unknownValue",
    });
  });

  it("ignores an ambiguous prefix with its own warning", () => {
    const resolved = resolveSearchQuery(parseSearchQuery("d:c"), {
      domain: ["calm", "chaos", "colorless"],
    });
    expect(resolved.root).toMatchObject({ kind: "ignored" });
    expect(resolved.diagnostics[0]).toMatchObject({ code: "ambiguousValue" });
  });

  it("accepts lang:any without listing it", () => {
    expect(resolveSearchQuery(parseSearchQuery("lang:any"), { lang: ["EN"] }).diagnostics).toEqual(
      [],
    );
  });

  it("skips keys without a vocabulary", () => {
    expect(resolveSearchQuery(parseSearchQuery("marker:anything"), {}).diagnostics).toEqual([]);
  });

  it("rejects keys the surface cannot evaluate", () => {
    const resolved = resolveSearchQuery(parseSearchQuery("owned>=1 t:unit"), {}, ["owned"]);
    expect(resolved.diagnostics).toEqual([
      expect.objectContaining({ code: "unsupportedKey", severity: "error", key: "owned" }),
    ]);
  });
});
