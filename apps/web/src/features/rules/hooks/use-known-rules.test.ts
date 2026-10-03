import { describe, expect, it } from "vitest";

import { unknownRuleRefs } from "./use-known-rules";

describe("unknownRuleRefs", () => {
  const refs = [
    { kind: "core" as const, ruleNumber: "466.1.a.2" },
    { kind: "core" as const, ruleNumber: "999.9" },
    { kind: "tournament" as const, ruleNumber: "4.1" },
  ];

  it("returns references missing from a loaded version", () => {
    const known = { core: new Set(["466.1.a.2"]), tournament: new Set(["4.1"]) };
    expect(unknownRuleRefs(refs, known)).toEqual([{ kind: "core", ruleNumber: "999.9" }]);
  });

  it("leaves a kind that has not loaded yet out of the result", () => {
    expect(unknownRuleRefs(refs, { core: new Set(["466.1.a.2", "999.9"]) })).toEqual([]);
  });
});
