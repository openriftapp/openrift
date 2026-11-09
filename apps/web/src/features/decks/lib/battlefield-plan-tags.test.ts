import { WellKnown } from "@openrift/shared/well-known";
import { describe, expect, it } from "vitest";

import { stubDeckBuilderCard } from "@/test/factories";

import { battlefieldPlanTags, orderByBattlefieldPlan } from "./battlefield-plan-tags";
import type { BattlefieldPlanPicks } from "./battlefield-plan-tags";

const A = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const B = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
const C = "cccccccc-cccc-cccc-cccc-cccccccccccc";

function picks(overrides: Partial<BattlefieldPlanPicks> = {}): BattlefieldPlanPicks {
  return {
    battlefieldGame1CardId: A,
    battlefieldFirstCardId: B,
    battlefieldSecondCardId: C,
    battlefieldCustom: false,
    ...overrides,
  };
}

const CONSTRUCTED = WellKnown.deckFormat.CONSTRUCTED;

describe("battlefieldPlanTags", () => {
  it("tags each picked battlefield with its scenario in plan order", () => {
    const tags = battlefieldPlanTags(picks(), CONSTRUCTED);
    expect(tags.get(A)).toEqual({ rank: 0, label: "Game 1" });
    expect(tags.get(B)).toEqual({ rank: 1, label: "Going first" });
    expect(tags.get(C)).toEqual({ rank: 2, label: "Going second" });
  });

  it("skips empty scenarios", () => {
    const tags = battlefieldPlanTags(picks({ battlefieldFirstCardId: null }), CONSTRUCTED);
    expect([...tags.keys()]).toEqual([A, C]);
  });

  it("joins the labels of a card picked for several scenarios", () => {
    const tags = battlefieldPlanTags(picks({ battlefieldSecondCardId: A }), CONSTRUCTED);
    expect(tags.get(A)).toEqual({ rank: 0, label: "Game 1 · Going second" });
  });

  it("returns no tags for a missing plan or a custom battlefield note", () => {
    expect(battlefieldPlanTags(null, CONSTRUCTED).size).toBe(0);
    expect(battlefieldPlanTags(undefined, CONSTRUCTED).size).toBe(0);
    expect(battlefieldPlanTags(picks({ battlefieldCustom: true }), CONSTRUCTED).size).toBe(0);
  });

  it("returns no tags in a single-battlefield format", () => {
    expect(battlefieldPlanTags(picks(), WellKnown.deckFormat.CUSTOM_REGION).size).toBe(0);
  });
});

describe("orderByBattlefieldPlan", () => {
  it("puts tagged cards in scenario order and keeps untagged ones after, in order", () => {
    const d = "dddddddd-dddd-dddd-dddd-dddddddddddd";
    const e = "eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee";
    const cards = [d, C, e, A, B].map((cardId) => stubDeckBuilderCard({ cardId }));
    const tags = battlefieldPlanTags(picks(), CONSTRUCTED);
    expect(orderByBattlefieldPlan(cards, tags).map((card) => card.cardId)).toEqual([A, B, C, d, e]);
  });

  it("returns the input untouched without tags", () => {
    const cards = [stubDeckBuilderCard({ cardId: B }), stubDeckBuilderCard({ cardId: A })];
    expect(orderByBattlefieldPlan(cards, new Map())).toBe(cards);
  });
});
