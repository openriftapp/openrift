import { describe, expect, it } from "vitest";

import { ruleLinkUrl } from "./rule-link";

const base = { origin: "https://example.test", pathname: "/rules/core/1.2" };

describe("ruleLinkUrl", () => {
  it("anchors the rule on the current document", () => {
    expect(ruleLinkUrl("540.4.b", { ...base, search: "" })).toBe(
      "https://example.test/rules/core/1.2#rule-540.4.b",
    );
  });

  it("keeps the rules language and drops every other param", () => {
    expect(ruleLinkUrl("101", { ...base, search: "?q=might&lang=zh-Hans" })).toBe(
      "https://example.test/rules/core/1.2?lang=zh-Hans#rule-101",
    );
  });

  it("drops a search that carries no language", () => {
    expect(ruleLinkUrl("101", { ...base, search: "?q=might" })).toBe(
      "https://example.test/rules/core/1.2#rule-101",
    );
  });
});
