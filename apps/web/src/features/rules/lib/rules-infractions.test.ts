import type { RulePageEntry } from "@openrift/shared/types/api/rules";
import { describe, expect, it } from "vitest";

import {
  buildInfractionSections,
  filterInfractionSections,
  infractionPenaltyCounts,
  nestedRuleDepth,
  ruleHeadlineName,
  splitRuleHeadline,
  withLinksTo,
  withoutPenaltyBadges,
} from "./rules-infractions";

function rule(ruleNumber: string, contentHtml: string, extra: Partial<RulePageEntry> = {}) {
  return {
    id: `id-${ruleNumber}`,
    kind: "tournament",
    language: "en",
    version: "2026-10-09",
    ruleNumber,
    sortOrder: 0,
    depth: ruleNumber.split(".").length - 1,
    ruleType: ruleNumber.includes(".") ? "text" : "subtitle",
    contentHtml,
    changeType: "unchanged",
    ...extra,
  } satisfies RulePageEntry;
}

const RULES: RulePageEntry[] = [
  rule("701", "Penalties"),
  rule("701.1", "Penalties are applied by judges."),
  rule("702", "Game Play Errors"),
  rule("702.1", "<em>Overview</em>"),
  rule("702.1.a", "A game play error is incorrect play."),
  rule("702.2", "<em>Missed Trigger</em>: a trigger is missed.", {
    infraction: { penalties: ["No Penalty"], stated: true },
  }),
  rule("702.2.a", "See 506."),
  rule("702.2.f", "Remedies:", { block: "remedies" }),
  rule("702.2.f.1", "Continue playing."),
  rule("702.2.f.2", "The opponent chooses."),
  rule("702.2.g", "A line after the remedies."),
  rule("703", "Tournament Errors"),
  rule("703.8", "<em>Late to Match</em>: a player arrives late.", {
    infraction: { penalties: ["Warning", "Match Loss"], stated: false },
  }),
  rule("703.10", "<em>Improperly Determining a Winner</em>: dice.", {
    infraction: { penalties: ["Match Loss"], stated: true },
  }),
];

describe("buildInfractionSections", () => {
  it("groups infractions under the sections that hold them", () => {
    const sections = buildInfractionSections(RULES);
    expect(sections.map((section) => section.entry.ruleNumber)).toEqual(["702", "703"]);
    expect(sections[1]?.infractions.map((item) => item.entry.ruleNumber)).toEqual([
      "703.8",
      "703.10",
    ]);
  });

  it("keeps the other children of a section as overviews with their sub-rules", () => {
    const [section] = buildInfractionSections(RULES);
    expect(section?.overviews.map((overview) => overview.entry.ruleNumber)).toEqual(["702.1"]);
    expect(section?.overviews[0]?.entries.map((entry) => entry.ruleNumber)).toEqual(["702.1.a"]);
  });

  it("puts a remedies heading and its sub-rules in one block", () => {
    const blocks = buildInfractionSections(RULES)[0]?.infractions[0]?.blocks ?? [];
    expect(
      blocks.map((block) =>
        block.kind === "line"
          ? block.entry.ruleNumber
          : `${block.block} ${block.heading.ruleNumber}[${block.entries.map((entry) => entry.ruleNumber).join(",")}]`,
      ),
    ).toEqual(["702.2.a", "remedies 702.2.f[702.2.f.1,702.2.f.2]", "702.2.g"]);
  });

  it("returns nothing for rules without infractions", () => {
    expect(buildInfractionSections(RULES.slice(0, 2))).toEqual([]);
  });
});

describe("nestedRuleDepth", () => {
  it("counts the levels below the ancestor, capped at the deepest guide", () => {
    expect(nestedRuleDepth("703.4.c", "703.4")).toBe(0);
    expect(nestedRuleDepth("703.4.c.2", "703.4.c")).toBe(0);
    expect(nestedRuleDepth("703.4.c.2.a.1", "703.4.c")).toBe(2);
    expect(nestedRuleDepth("703.4.c.2.a.1.a", "703.4")).toBe(3);
  });
});

describe("filterInfractionSections", () => {
  const sections = buildInfractionSections(RULES);

  it("keeps infractions that can carry the penalty, dropping empty sections", () => {
    const filtered = filterInfractionSections(sections, "Warning", "");
    expect(filtered.map((section) => section.entry.ruleNumber)).toEqual(["703"]);
    expect(filtered[0]?.infractions.map((item) => item.entry.ruleNumber)).toEqual(["703.8"]);
  });

  it("searches the headline, the sub-rules and the rule number", () => {
    const byRemedy = filterInfractionSections(sections, null, "opponent chooses");
    expect(byRemedy.flatMap((s) => s.infractions.map((i) => i.entry.ruleNumber))).toEqual([
      "702.2",
    ]);
    const byNumber = filterInfractionSections(sections, null, "703.10");
    expect(byNumber.flatMap((s) => s.infractions.map((i) => i.entry.ruleNumber))).toEqual([
      "703.10",
    ]);
  });

  it("returns every section for no penalty and an empty query", () => {
    expect(filterInfractionSections(sections, null, "")).toEqual(sections);
  });
});

describe("infractionPenaltyCounts", () => {
  it("counts each penalty in severity order and leaves out the ones that never occur", () => {
    expect(infractionPenaltyCounts(buildInfractionSections(RULES))).toEqual([
      { penalty: "No Penalty", count: 1 },
      { penalty: "Warning", count: 1 },
      { penalty: "Match Loss", count: 2 },
    ]);
  });
});

describe("withoutPenaltyBadges", () => {
  it("drops each badge with the space before it, keeping the colon", () => {
    expect(
      withoutPenaltyBadges(
        '<em>Missed Trigger <span data-penalty="No Penalty">[No Penalty]</span>:</em> A trigger.',
      ),
    ).toBe("<em>Missed Trigger:</em> A trigger.");
    expect(
      withoutPenaltyBadges(
        '<em>Conduite antisportive mineure <span data-penalty="Warning">[Avertissement]</span> :</em>',
      ),
    ).toBe("<em>Conduite antisportive mineure :</em>");
  });

  it("leaves a headline without badges alone", () => {
    expect(withoutPenaltyBadges("<em>Late to Match:</em> A player arrives late.")).toBe(
      "<em>Late to Match:</em> A player arrives late.",
    );
  });
});

describe("ruleHeadlineName", () => {
  it("reads the italic name before the colon, without the penalty", () => {
    expect(
      ruleHeadlineName(
        '<em>Missed Trigger <span data-penalty="No Penalty">[No Penalty]</span>:</em> A trigger is missed.',
      ),
    ).toBe("Missed Trigger");
    expect(ruleHeadlineName("<em>Late to Match</em>: A player arrives late.")).toBe(
      "Late to Match",
    );
    expect(ruleHeadlineName("<em>迟到</em>：玩家迟到。")).toBe("迟到");
  });

  it("keeps a headline without a colon whole", () => {
    expect(ruleHeadlineName("<em>Overview</em>")).toBe("Overview");
  });

  it("drops a stray asterisk left by a malformed source", () => {
    expect(
      ruleHeadlineName(
        '*Unsporting Major <span data-penalty="Disqualification">[Disqualification]</span>: A threat.',
      ),
    ).toBe("Unsporting Major");
  });
});

describe("splitRuleHeadline", () => {
  it("splits the italic name from the description at the colon", () => {
    expect(splitRuleHeadline("<em>Missed Trigger:</em> A trigger is missed.")).toEqual({
      titleHtml: "Missed Trigger",
      bodyHtml: "A trigger is missed.",
    });
    expect(splitRuleHeadline("<em>Late to Match</em>: A player arrives late.")).toEqual({
      titleHtml: "Late to Match",
      bodyHtml: "A player arrives late.",
    });
    expect(splitRuleHeadline("<em>Jeu lent :</em> un joueur est lent.")).toEqual({
      titleHtml: "Jeu lent",
      bodyHtml: "un joueur est lent.",
    });
    expect(splitRuleHeadline("<em>迟到</em>：玩家迟到。")).toEqual({
      titleHtml: "迟到",
      bodyHtml: "玩家迟到。",
    });
  });

  it("splits an unemphasized headline and keeps markup in the description", () => {
    expect(splitRuleHeadline('Mispayment: See <a href="#rule-201">CR 201</a>. Costs.')).toEqual({
      titleHtml: "Mispayment",
      bodyHtml: 'See <a href="#rule-201">CR 201</a>. Costs.',
    });
  });

  it("ignores a colon inside a tag", () => {
    expect(
      splitRuleHeadline('<em>Outside Help:</em> See <a href="https://example.com">this</a>.'),
    ).toEqual({
      titleHtml: "Outside Help",
      bodyHtml: 'See <a href="https://example.com">this</a>.',
    });
  });

  it("treats a headline without a colon as all title", () => {
    expect(splitRuleHeadline("<em>Overview</em>")).toEqual({ titleHtml: "Overview", bodyHtml: "" });
  });

  it("returns an empty description when nothing follows the colon", () => {
    expect(splitRuleHeadline("Unsporting Minor:")).toEqual({
      titleHtml: "Unsporting Minor",
      bodyHtml: "",
    });
  });
});

describe("withLinksTo", () => {
  it("sends links to rules missing from the page elsewhere and keeps the rest", () => {
    const html = '<a href="#rule-702.2">702.2</a> and <a href="#rule-506">506</a>';
    expect(withLinksTo(html, new Set(["rule-702.2"]), "/rules/tournament/v?lang=en")).toBe(
      '<a href="#rule-702.2">702.2</a> and <a href="/rules/tournament/v?lang=en#rule-506">506</a>',
    );
  });

  it("leaves links that are not same-page fragments alone", () => {
    const html = '<a href="/cards/jinx">Jinx</a>';
    expect(withLinksTo(html, new Set(), "/rules/tournament/v")).toBe(html);
  });
});
