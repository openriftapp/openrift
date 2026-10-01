import { describe, expect, it } from "vitest";

import { cardMentionPattern } from "./rule-examples.js";
import type { RuleHtmlOptions } from "./rules-html.js";
import { renderCommentHtml, renderRuleHtml } from "./rules-html.js";
import { buildTermAnchors } from "./rules.js";

const NO_TERMS: RuleHtmlOptions = { termAnchors: new Map(), ruleNumber: "100" };

function render(content: string, options: Partial<RuleHtmlOptions> = {}): string {
  return renderRuleHtml(content, { ...NO_TERMS, ...options });
}

describe("renderRuleHtml formatting", () => {
  it("renders emphasis, strong and code", () => {
    expect(render("*Card* is **bold** and `code`.")).toBe(
      "<em>Card</em> is <strong>bold</strong> and <code>code</code>.",
    );
  });

  it("turns each newline into a line break", () => {
    expect(render("first line\nsecond line")).toBe("first line<br>\nsecond line");
  });

  it("wraps penalty labels, including italicized ones", () => {
    expect(render("Penalty: [*Game Loss*]")).toBe(
      'Penalty: <span data-penalty="Game Loss">[Game Loss]</span>',
    );
  });
});

describe("renderRuleHtml links", () => {
  it("links a `rule N` reference to the same-page anchor", () => {
    expect(render("See *rule 540* for more information.")).toBe(
      'See <em><a href="#rule-540">rule 540</a></em> for more information.',
    );
  });

  it("stops a multi-segment reference before a sentence-ending dot", () => {
    expect(render("Continue until rule 540.4.b. is done.")).toContain(
      '<a href="#rule-540.4.b">rule 540.4.b</a>',
    );
  });

  it("links a bare tournament reference and a `CR N` reference", () => {
    expect(render("See 603.7.")).toContain('<a href="#rule-603.7">603.7</a>');
    expect(render("Proceed to CR 116.")).toContain('<a href="/rules/core#rule-116">CR 116</a>');
  });

  it("does not link a low decimal that is not a rule number", () => {
    expect(render("The ratio is 1.5x.")).toBe("The ratio is 1.5x.");
  });

  it("links an italicized term, ignoring a trailing dot and a plural", () => {
    const termAnchors = buildTermAnchors([
      { ruleNumber: "168", ruleType: "subtitle", depth: 0, content: "Battlefields" },
    ]);
    expect(render("At the *Battlefield.*", { termAnchors, ruleNumber: "500" })).toBe(
      'At the <a href="#rule-168"><em>Battlefield.</em></a>',
    );
  });

  it("does not self-link a term in the rule that defines it", () => {
    const termAnchors = new Map([["accelerate", "805"]]);
    expect(render("*Accelerate*", { termAnchors, ruleNumber: "805" })).toBe("<em>Accelerate</em>");
  });

  it("does not double-link an italicized rule reference", () => {
    const termAnchors = new Map([["rule", "999"]]);
    expect(render("See *rule 540*.", { termAnchors })).toBe(
      'See <em><a href="#rule-540">rule 540</a></em>.',
    );
  });

  it("opens an external https link in a new tab", () => {
    expect(render("[Rules PDF](https://example.com/rules.pdf)")).toBe(
      '<a href="https://example.com/rules.pdf" target="_blank" rel="noreferrer">Rules PDF</a>',
    );
  });
});

describe("renderRuleHtml examples", () => {
  it("leaves a rule without examples inline", () => {
    expect(render("Just text.")).toBe("Just text.");
  });

  it("puts examples in their own block and links the cards they mention", () => {
    const cardMentions = {
      pattern: cardMentionPattern(["Flash", "Gold"])!,
      slugsByName: new Map([
        ["Flash", "flash"],
        ["Gold", "gold"],
      ]),
    };
    expect(
      render("Units can move.\n*Example:* A player plays Flash to make a “Gold token”.", {
        cardMentions,
      }),
    ).toBe(
      '<div>Units can move.</div><div class="rule-example"><em>Example:</em> A player plays <a href="/cards/flash">Flash</a> to make a “Gold token”.</div>',
    );
  });

  it("does not link cards in the rule text outside examples", () => {
    const cardMentions = {
      pattern: cardMentionPattern(["Flash"])!,
      slugsByName: new Map([["Flash", "flash"]]),
    };
    expect(render("Flash moves units.\n*Example:* Two units.", { cardMentions })).toBe(
      '<div>Flash moves units.</div><div class="rule-example"><em>Example:</em> Two units.</div>',
    );
  });
});

describe("renderRuleHtml sanitizing", () => {
  it("escapes raw HTML in the source", () => {
    const html = render('<script>alert(1)</script> and <img src=x onerror="alert(1)">');
    expect(html).not.toContain("<script");
    expect(html).not.toContain("<img");
  });

  it("escapes markup characters in text", () => {
    expect(render("a < b & c > d")).toBe("a &lt; b &amp; c &gt; d");
  });

  it("drops a javascript: link and keeps its text", () => {
    expect(render("[click](javascript:alert(1))")).toBe("click");
  });

  it("drops a protocol-relative or http link", () => {
    expect(render("[a](//evil.example) [b](http://evil.example)")).toBe("a b");
  });

  it("drops images and keeps their alt text out", () => {
    expect(render("![x](https://evil.example/x.png)")).toBe("");
  });

  it("escapes a quote inside an allowed href", () => {
    expect(render('[q](https://example.com/a"onmouseover="x)')).not.toContain('"onmouseover');
  });

  it("unwraps headings, lists and block quotes to their text", () => {
    expect(render("# Title")).toBe("Title");
    expect(render("> quoted")).toBe("\nquoted\n");
    expect(render("- a\n- b")).toBe("\na\nb\n");
  });
});

describe("renderCommentHtml", () => {
  it("keeps paragraphs, lists, headings, quotes and rules", () => {
    expect(renderCommentHtml("## Notes\n\nFixed *744.5*.\n\n- one\n- two\n\n> quoted\n\n---")).toBe(
      "<h2>Notes</h2>\n<p>Fixed <em>744.5</em>.</p>\n<ul>\n<li>one</li>\n<li>two</li>\n</ul>\n<blockquote>\n<p>quoted</p>\n</blockquote>\n<hr>",
    );
  });

  it("opens external links in a new tab and drops unsafe ones", () => {
    expect(renderCommentHtml("[PDF](https://example.com/a.pdf) [x](javascript:alert(1))")).toBe(
      '<p><a href="https://example.com/a.pdf" target="_blank" rel="noreferrer">PDF</a> x</p>',
    );
  });

  it("escapes raw HTML and unwraps a top-level heading", () => {
    const html = renderCommentHtml("# Title\n\n<script>alert(1)</script>");
    expect(html).toContain("Title");
    expect(html).not.toContain("<h1");
    expect(html).not.toContain("<script");
  });

  it("does not render rule references as links", () => {
    expect(renderCommentHtml("See rule 540.")).toBe("<p>See rule 540.</p>");
  });
});
