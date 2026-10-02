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
    expect(render("Proceed to CR 116.")).toContain(
      '<a href="/rules/core?lang=en#rule-116">CR 116</a>',
    );
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

describe("renderRuleHtml in French and Korean", () => {
  it("links a French `règle N` reference", () => {
    expect(render("Voir règle 197. Emplacements.", { language: "fr" })).toContain(
      '<a href="#rule-197">règle 197</a>',
    );
  });

  it("links a Korean article reference without a word boundary", () => {
    expect(render("자세한 내용은 규칙 제355.6조 위치를 참조하세요.", { language: "ko" })).toContain(
      '<a href="#rule-355.6">규칙 제355.6조</a>',
    );
  });

  it("sends a Korean Core Rules reference to the Korean core rules", () => {
    expect(render("핵심 규칙 제110조 게임 준비 절차", { language: "ko" })).toContain(
      '<a href="/rules/core?lang=ko#rule-110">핵심 규칙 제110조</a>',
    );
  });

  it("sends a French Core Rules section to the French core rules", () => {
    expect(
      render("Voir la section 110. des *Règles de base « Mise en place ».*", { language: "fr" }),
    ).toBe(
      'Voir la section <a href="/rules/core?lang=fr#rule-110">110</a>. des <em>Règles de base « Mise en place ».</em>',
    );
    expect(render("consultez la section *469.1.a. des Règles de base.*", { language: "fr" })).toBe(
      'consultez la section <em><a href="/rules/core?lang=fr#rule-469.1.a">469.1.a</a>. des Règles de base.</em>',
    );
    expect(
      render("comme défini par le point 484.8.e. des Règles de base.", { language: "fr" }),
    ).toBe(
      'comme défini par le point <a href="/rules/core?lang=fr#rule-484.8.e">484.8.e</a>. des Règles de base.',
    );
  });

  it("links a French term written with its article", () => {
    expect(
      render("Sur *le plateau*.", { language: "fr", termAnchors: new Map([["plateau", "107"]]) }),
    ).toBe('Sur <a href="#rule-107"><em>le plateau</em></a>.');
  });

  it("does not link an ordinal that is not an article", () => {
    expect(render("제1원칙", { language: "ko" })).toBe("제1원칙");
  });

  it("styles localized penalties by their English severity", () => {
    expect(render("[*Perte de partie*]", { language: "fr" })).toBe(
      '<span data-penalty="Game Loss">[Perte de partie]</span>',
    );
    expect(render("[경고]", { language: "ko" })).toBe('<span data-penalty="Warning">[경고]</span>');
  });

  it("puts French and Korean examples in their own block", () => {
    expect(render("Texte.\n*Exemple :* Une carte.\n*Voir règle 119.*", { language: "fr" })).toBe(
      '<div>Texte.</div><div class="rule-example"><em>Exemple :</em> Une carte.</div><div><em>Voir <a href="#rule-119">règle 119</a>.</em></div>',
    );
    expect(
      render("본문.\n예시: 카드.\n자세한 내용은 규칙 제119조를 참조하세요.", { language: "ko" }),
    ).toBe(
      '<div>본문.</div><div class="rule-example">예시: 카드.</div><div>자세한 내용은 <a href="#rule-119">규칙 제119조</a>를 참조하세요.</div>',
    );
  });

  it("does not split Simplified Chinese, which has no known example marker yet", () => {
    expect(render("Example: x", { language: "zh-Hans" })).toBe("Example: x");
  });
});

describe("renderRuleHtml keywords", () => {
  const keywords = new Map([
    ["reaction", { name: "Reaction", color: "#24705f", darkText: false }],
    ["réaction", { name: "Reaction", color: "#24705f", darkText: false }],
    ["deathknell", { name: "Deathknell", color: "#95b229", darkText: true }],
    ["shield", { name: "Shield", color: "#cd346f", darkText: false }],
  ]);

  it("turns a bracketed keyword into a badge in its color", () => {
    expect(render("[E]: [Reaction] — Add [1].", { keywords })).toBe(
      '[E]: <span data-keyword="Reaction" style="--keyword-color:#24705f">Reaction</span> — Add [1].',
    );
  });

  it("matches a translated label and a keyword with an amount", () => {
    expect(render("[Réaction] et [Shield 2]", { keywords })).toBe(
      '<span data-keyword="Reaction" style="--keyword-color:#24705f">Réaction</span> et <span data-keyword="Shield" style="--keyword-color:#cd346f">Shield 2</span>',
    );
  });

  it("points a badge right for [>] and left for [>>], dropping the markers", () => {
    expect(render("[Reaction][>] Kill this.", { keywords })).toBe(
      '<span data-keyword="Reaction" style="--keyword-color:#24705f" data-keyword-point="right">Reaction</span> Kill this.',
    );
    expect(render("x [>>][Shield][>] y", { keywords })).toBe(
      'x <span data-keyword="Shield" style="--keyword-color:#cd346f" data-keyword-point="both">Shield</span> y',
    );
  });

  it("leaves a [>] that follows no keyword as text", () => {
    expect(render("comes after the [>].", { keywords })).toBe("comes after the [&gt;].");
  });

  it("marks a keyword that needs dark text", () => {
    expect(render("[Deathknell]", { keywords })).toBe(
      '<span data-keyword="Deathknell" style="--keyword-color:#95b229" data-keyword-dark>Deathknell</span>',
    );
  });

  it("leaves placeholders and penalties alone", () => {
    expect(render("[Text] and [Warning]", { keywords })).toBe(
      '[Text] and <span data-penalty="Warning">[Warning]</span>',
    );
  });

  it("drops a badge whose color is not a hex color", () => {
    const bad = new Map([["reaction", { name: "Reaction", color: "red;x:y", darkText: false }]]);
    expect(render("[Reaction]", { keywords: bad })).toBe("Reaction");
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

  it("tags a card link with its image for the hover preview", () => {
    const pattern = cardMentionPattern(["Flash", "Ezreal"])!;
    const html = render("Rule.\n*Example:* Flash and Ezreal.", {
      cardMentions: {
        pattern,
        slugsByName: new Map([
          ["Flash", "flash"],
          ["Ezreal", "ezreal"],
        ]),
        imagesBySlug: new Map([
          ["flash", { imageId: "019a0000-0000-7000-8000-000000000001", landscape: false }],
          ["ezreal", { imageId: "not-a-uuid", landscape: true }],
        ]),
      },
    });
    expect(html).toContain(
      '<a href="/cards/flash" data-card-image="019a0000-0000-7000-8000-000000000001">Flash</a>',
    );
    expect(html).toContain('<a href="/cards/ezreal">Ezreal</a>');
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
