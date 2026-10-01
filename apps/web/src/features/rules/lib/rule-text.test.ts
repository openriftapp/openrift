import { describe, expect, it } from "vitest";

import { ruleHtmlToText, ruleSearchText } from "./rule-text";

describe("ruleHtmlToText", () => {
  it("drops tags and keeps their text", () => {
    expect(
      ruleHtmlToText(
        'See <em><a href="#rule-540">rule 540</a></em><br>\nfor <strong>more</strong>.',
      ),
    ).toBe("See rule 540\nfor more.");
  });

  it("decodes the entities the renderer escapes", () => {
    expect(ruleHtmlToText("a &lt; b &amp; c &gt; d &quot;e&quot; &#39;f&#39;")).toBe(
      "a < b & c > d \"e\" 'f'",
    );
  });

  it("leaves other entity-like text alone", () => {
    expect(ruleHtmlToText("&nbsp;")).toBe("&nbsp;");
  });
});

describe("ruleSearchText", () => {
  it("lowercases the text and reuses it for the same rule object", () => {
    const rule = { contentHtml: "<em>Combat</em> &amp; Focus" };
    expect(ruleSearchText(rule)).toBe("combat & focus");
    rule.contentHtml = "changed";
    expect(ruleSearchText(rule)).toBe("combat & focus");
  });
});
