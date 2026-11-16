import { describe, expect, it } from "vitest";

import { findRuleInfractions, hasInfractions, parentRuleNumber } from "./rules-infractions.js";

describe("hasInfractions", () => {
  it("is true only when a rule carries an infraction mark", () => {
    expect(hasInfractions([{}, { infraction: undefined }])).toBe(false);
    expect(hasInfractions([{}, { infraction: { penalties: ["Warning"], stated: true } }])).toBe(
      true,
    );
  });
});

describe("parentRuleNumber", () => {
  it("drops the last segment, with no parent for a top-level rule", () => {
    expect(parentRuleNumber("703.4.c")).toBe("703.4");
    expect(parentRuleNumber("703")).toBeUndefined();
  });
});

const rows = (entries: [string, string][]) =>
  entries.map(([ruleNumber, content]) => ({ ruleNumber, content }));

describe("findRuleInfractions", () => {
  it("marks headline rules beside a penalty headline, skipping the overview", () => {
    const { infractions } = findRuleInfractions(
      rows([
        ["702", "Game Play Errors"],
        ["702.1", "*Overview*"],
        ["702.1.a", "A game play error is caused by incorrect play."],
        ["702.2", "*Missed Trigger [No Penalty]:* The accountable player misses a trigger."],
        ["702.3", "*Drawing Extra Cards [Warning]:* A player draws too many cards."],
      ]),
    );
    expect([...infractions.keys()]).toEqual(["702.2", "702.3"]);
    expect(infractions.get("702.2")).toEqual({ penalties: ["No Penalty"], stated: true });
  });

  it("takes the penalties of the sub-rules, mildest first, when the headline names none", () => {
    const { infractions } = findRuleInfractions(
      rows([
        ["703", "Tournament Errors"],
        ["703.2", "*Slow Play [Warning]:* A player plays slowly."],
        ["703.8", "*Late to Match:* A player arrives late."],
        ["703.8.c", "After 10 minutes, the penalty is a [*Match Loss*]."],
        ["703.8.a", "Within 2 minutes, the penalty is a [Warnings]."],
      ]),
    );
    expect(infractions.get("703.8")).toEqual({
      penalties: ["Warning", "Match Loss"],
      stated: false,
    });
  });

  it("accepts the colon outside the emphasis", () => {
    const { infractions } = findRuleInfractions(
      rows([
        ["703.2", "*Slow Play [Warning]*: A player plays slowly."],
        ["703.8", "*Late to Match*: A player arrives late."],
      ]),
    );
    expect([...infractions.keys()]).toEqual(["703.2", "703.8"]);
  });

  it("accepts emphasis that closes inside the penalty bracket", () => {
    const { infractions } = findRuleInfractions(
      rows([
        ["704.2", "*Unsporting Minor [Warning]:* A player is rude."],
        ["704.3", "*Unsporting Major [Disqualification*]: A player threatens another."],
      ]),
    );
    expect(infractions.get("704.3")).toEqual({ penalties: ["Disqualification"], stated: true });
  });

  it("ignores italic headlines in sections without a penalty", () => {
    const { infractions } = findRuleInfractions(
      rows([
        ["101", "*Purpose:* This document provides the frameworks."],
        ["102", "*Consistency:* All competitions run the same way."],
        ["701.2.a", "*Warning:* An indication that an error occurred."],
      ]),
    );
    expect(infractions.size).toBe(0);
  });

  it("finds remedies headings in every spelling, only inside infractions", () => {
    const { blocks } = findRuleInfractions(
      rows([
        ["701.5", "Remedies: rewinds in general."],
        ["702.2", "*Missed Trigger [No Penalty]:* A trigger is missed."],
        ["702.2.a", "See 506 for triggered abilities."],
        ["702.2.f", "Remedies:"],
        ["702.2.f.1", "Continue playing."],
        ["702.5", "*Looking at Extra Cards [Warning]:* A player looks at more cards."],
        ["702.5.c", "*Remedies*:"],
        ["702.13", "*Facedown Card Error [Warning]:* A facedown card is wrong."],
        ["702.13.c", "*Remedies for illegally added cards:*"],
        ["703.4", "*Deck Presentation Error [Warning]:* An illegal deck."],
        ["703.4.c", "*Other Remedies:*"],
        ["703.6", "*Marked Cards [Warning]:* Identifiable cards."],
        ["703.6.d", "Remedies"],
      ]),
    );
    expect([...blocks.keys()].toSorted()).toEqual([
      "702.13.c",
      "702.2.f",
      "702.5.c",
      "703.4.c",
      "703.6.d",
    ]);
    expect(new Set(blocks.values())).toEqual(new Set(["remedies"]));
  });

  it("finds examples headings but not single worked examples", () => {
    const { blocks } = findRuleInfractions(
      rows([
        ["702.13", "*Facedown Card Error [Warning]:* A facedown card is wrong."],
        ["702.13.a", "Example: Hiding a card that does not have the Hidden keyword."],
        ["703.3", "*Decklist Error [Game Loss]:* An illegal decklist."],
        ["703.3.a", "*Examples:*"],
        ["703.3.a.1", "The decklist has too many cards."],
        ["704.2", "*Unsporting Minor [Warning]:*"],
        ["704.2.a", "Examples include but are not limited to:"],
      ]),
    );
    expect([...blocks]).toEqual([
      ["703.3.a", "examples"],
      ["704.2.a", "examples"],
    ]);
  });
});
