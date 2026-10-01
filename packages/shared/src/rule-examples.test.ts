import { describe, expect, it } from "vitest";

import {
  cardMentionPattern,
  findCardMentions,
  linkCardMentions,
  ruleExampleText,
  splitRuleSections,
} from "./rule-examples";

describe("splitRuleSections", () => {
  it("returns a rule without examples as one text section", () => {
    expect(splitRuleSections("A player may play a *Spell*.")).toEqual([
      { kind: "text", content: "A player may play a *Spell*." },
    ]);
  });

  it("splits an example line off the rule text", () => {
    expect(
      splitRuleSections(
        "Cards have different names.\n  *Example:* Yasuo, Remorseful and Yasuo, Windrider.",
      ),
    ).toEqual([
      { kind: "text", content: "Cards have different names." },
      { kind: "example", content: "*Example:* Yasuo, Remorseful and Yasuo, Windrider." },
    ]);
  });

  it("keeps the lines after an Examples heading in the same example", () => {
    expect(
      splitRuleSections(
        "Modifications stop.\n  *Examples:*\n  Damage is cleared.\n  Counters are removed.",
      ),
    ).toEqual([
      { kind: "text", content: "Modifications stop." },
      { kind: "example", content: "*Examples:*\n  Damage is cleared.\n  Counters are removed." },
    ]);
  });

  it("returns to the text at a See line after an example", () => {
    expect(
      splitRuleSections(
        "Units can attach.\n*Example:* A gear attaches.\n*See rule 716. Attachment for more information.*",
      ),
    ).toEqual([
      { kind: "text", content: "Units can attach." },
      { kind: "example", content: "*Example:* A gear attaches." },
      { kind: "text", content: "*See rule 716. Attachment for more information.*" },
    ]);
  });

  it("starts a new example at each Example line", () => {
    expect(splitRuleSections("Rule text.\n*Example:* First.\n*Example:* Second.")).toEqual([
      { kind: "text", content: "Rule text." },
      { kind: "example", content: "*Example:* First." },
      { kind: "example", content: "*Example:* Second." },
    ]);
  });

  it("accepts an unformatted Example marker and an example that opens the rule", () => {
    expect(splitRuleSections("Example: A unit moves.")).toEqual([
      { kind: "example", content: "Example: A unit moves." },
    ]);
  });

  it("drops blank lines between sections", () => {
    expect(splitRuleSections("Rule text.\n  \n*Example:* One.")).toEqual([
      { kind: "text", content: "Rule text." },
      { kind: "example", content: "*Example:* One." },
    ]);
  });

  it("leaves a See line in the text when no example precedes it", () => {
    expect(splitRuleSections("Rule text.\n*See rule 100.*")).toEqual([
      { kind: "text", content: "Rule text.\n*See rule 100.*" },
    ]);
  });
});

describe("ruleExampleText", () => {
  it("joins the example sections and leaves out the rule text", () => {
    expect(ruleExampleText("Rule text.\n*Example:* One.\n*See rule 1.*\n*Example:* Two.")).toBe(
      "*Example:* One.\n*Example:* Two.",
    );
  });

  it("is empty for a rule without examples", () => {
    expect(ruleExampleText("Rule text.")).toBe("");
  });
});

describe("cardMentionPattern", () => {
  it("is null without names", () => {
    expect(cardMentionPattern([])).toBeNull();
  });

  it("prefers the longest name and matches whole words only", () => {
    const pattern = cardMentionPattern(["Cull", "Cull the Weak", "Flash"]);
    expect(pattern).not.toBeNull();
    expect("Cull the Weak and Flashy and Cull".match(pattern!)).toEqual(["Cull the Weak", "Cull"]);
  });

  it("escapes names with regex characters", () => {
    const pattern = cardMentionPattern(["Dr. Mundo, Expert"]);
    expect("Dr. Mundo, Expert attacks".match(pattern!)).toEqual(["Dr. Mundo, Expert"]);
    expect("Drx Mundo, Expert".match(pattern!)).toBeNull();
  });
});

describe("findCardMentions", () => {
  const pattern = cardMentionPattern(["Buff", "Gold", "Treasure Hunter", "Jinx", "Discipline"])!;

  it("finds names in plain text", () => {
    expect(findCardMentions("Its controller plays Discipline on the unit.", pattern)).toEqual(
      new Set(["Discipline"]),
    );
  });

  it("skips names inside curly or straight quotes", () => {
    expect(
      findCardMentions(
        'Treasure Hunter reads “When I move, play a Gold gear token.” A spell reads "Buff a unit."',
        pattern,
      ),
    ).toEqual(new Set(["Treasure Hunter"]));
  });

  it("skips names inside emphasis", () => {
    expect(findCardMentions("Loose Cannon has the tag *Jinx*.", pattern)).toEqual(new Set());
  });
});

describe("linkCardMentions", () => {
  const slugs = new Map([
    ["Loose Cannon", "loose-cannon"],
    ["Jinx, Rebel", "jinx-rebel"],
    ["Gold", "gold"],
  ]);
  const pattern = cardMentionPattern(slugs.keys())!;

  it("links card names to their card pages", () => {
    expect(
      linkCardMentions(
        "*Example:* Loose Cannon has the tag *Jinx*. Choose Jinx, Rebel.",
        pattern,
        slugs,
      ),
    ).toBe(
      "*Example:* [Loose Cannon](/cards/loose-cannon) has the tag *Jinx*. Choose [Jinx, Rebel](/cards/jinx-rebel).",
    );
  });

  it("leaves quoted card text alone", () => {
    expect(linkCardMentions("It reads “play a Gold gear token.”", pattern, slugs)).toBe(
      "It reads “play a Gold gear token.”",
    );
  });

  it("leaves a name without a slug unlinked", () => {
    const partial = new Map([["Gold", "gold"]]);
    expect(linkCardMentions("Loose Cannon", cardMentionPattern(["Loose Cannon"])!, partial)).toBe(
      "Loose Cannon",
    );
  });
});
