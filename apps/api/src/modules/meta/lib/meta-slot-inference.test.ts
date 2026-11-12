import { describe, expect, it } from "vitest";

import type { ChampionFacts } from "./meta-chosen-champion.js";
import type { GroupDeck } from "./meta-slot-inference.js";
import {
  buildLegendIndex,
  championCandidates,
  guessBattlefield,
  guessChampion,
  inferenceSignature,
  inferGroup,
  nearestDecks,
} from "./meta-slot-inference.js";

const LEGEND = "legend";
const YI_HONED = "yi-honed";
const YI_TEMPERED = "yi-tempered";
const GAREN = "garen";
const BF = ["bf-a", "bf-b", "bf-c", "bf-d", "bf-e"] as const;

const FACTS = new Map<string, ChampionFacts>([
  [LEGEND, { tags: ["Master Yi"], isChampion: false, maxCopiesOverride: null }],
  [YI_HONED, { tags: ["Master Yi"], isChampion: true, maxCopiesOverride: null }],
  [YI_TEMPERED, { tags: ["Master Yi"], isChampion: true, maxCopiesOverride: null }],
  [GAREN, { tags: ["Garen"], isChampion: true, maxCopiesOverride: null }],
]);

function deck(
  deckId: string,
  main: Record<string, number>,
  championCardId: string | null,
  battlefieldCardIds: readonly string[] = [],
  partial = false,
): GroupDeck {
  return {
    deckId,
    main: new Map(Object.entries(main)),
    championCardId,
    battlefieldCardIds,
    partial,
  };
}

const AGGRO = { charm: 3, defy: 3, rengar: 3, poro: 2 };
const CONTROL = { sabotage: 3, shroud: 3, zhonya: 2, poro: 1 };

describe("nearestDecks", () => {
  it("ranks by shared copies and breaks ties by deck id", () => {
    const index = buildLegendIndex([
      deck("b", AGGRO, YI_HONED),
      deck("a", AGGRO, YI_HONED),
      deck("c", CONTROL, YI_TEMPERED),
    ]);

    const nearest = nearestDecks(index, new Map(Object.entries(AGGRO)), 2, () => true);

    expect(nearest.map((neighbour) => [neighbour.deck.deckId, neighbour.shared])).toEqual([
      ["a", 11],
      ["b", 11],
    ]);
  });

  it("skips decks the filter rejects", () => {
    const index = buildLegendIndex([deck("a", AGGRO, YI_HONED), deck("b", AGGRO, null)]);

    const nearest = nearestDecks(
      index,
      new Map(Object.entries(AGGRO)),
      5,
      (candidate) => candidate.championCardId !== null,
    );

    expect(nearest.map((neighbour) => neighbour.deck.deckId)).toEqual(["a"]);
  });
});

describe("championCandidates", () => {
  it("keeps the legend's champion units with room under their copy limit", () => {
    const candidates = championCandidates(LEGEND, new Map([[YI_HONED, 3]]), FACTS);

    expect([...candidates]).toEqual([YI_TEMPERED]);
  });

  it("respects a Unique keyword", () => {
    const facts = new Map([
      ...FACTS,
      [YI_HONED, { ...FACTS.get(YI_HONED)!, keywords: ["Unique"] }],
    ]);

    expect(championCandidates(LEGEND, new Map([[YI_HONED, 1]]), facts).has(YI_HONED)).toBe(false);
  });

  it("is empty for a legend without tags", () => {
    const facts = new Map([
      ...FACTS,
      [LEGEND, { tags: [], isChampion: false, maxCopiesOverride: null }],
    ]);

    expect(championCandidates(LEGEND, new Map(), facts).size).toBe(0);
  });
});

describe("guessChampion", () => {
  const known = [
    deck("k1", AGGRO, YI_HONED),
    deck("k2", AGGRO, YI_HONED),
    deck("k3", AGGRO, YI_HONED),
    deck("k4", CONTROL, YI_TEMPERED),
    deck("k5", CONTROL, YI_TEMPERED),
  ];

  it("follows the most similar lists", () => {
    const target = deck("t", AGGRO, null);
    const guess = guessChampion(
      buildLegendIndex([...known, target]),
      target,
      new Set([YI_HONED, YI_TEMPERED]),
    );

    expect(guess?.ranked[0]).toBe(YI_HONED);
    expect(guess?.neighbours.map((neighbour) => neighbour.deck.deckId)).not.toContain("t");
  });

  it("is unsure when the runner-up's vote comes close", () => {
    const target = deck("t", { charm: 3, sabotage: 3, poro: 1 }, null);
    const guess = guessChampion(
      buildLegendIndex([...known, target]),
      target,
      new Set([YI_HONED, YI_TEMPERED]),
    );

    expect(guess?.unsure).toBe(true);
  });

  it("gives up below three neighbours", () => {
    const target = deck("t", AGGRO, null);
    const guess = guessChampion(
      buildLegendIndex([known[0]!, known[1]!, target]),
      target,
      new Set([YI_HONED]),
    );

    expect(guess).toBeNull();
  });

  it("ignores neighbours whose champion is ruled out for the target", () => {
    const target = deck("t", AGGRO, null);
    const guess = guessChampion(
      buildLegendIndex([...known, target]),
      target,
      new Set([YI_TEMPERED]),
    );

    expect(guess).toBeNull();
  });
});

describe("guessBattlefield", () => {
  it("names the most voted battlefield the list does not hold", () => {
    const decks = [
      deck("k1", AGGRO, YI_HONED, [BF[0], BF[1], BF[2]]),
      deck("k2", AGGRO, YI_HONED, [BF[0], BF[1], BF[3]]),
      deck("k3", AGGRO, YI_HONED, [BF[0], BF[4], BF[2]]),
    ];
    const target = deck("t", AGGRO, null, [BF[0]]);

    const guess = guessBattlefield(buildLegendIndex([...decks, target]), target, 3);

    expect(guess?.top).toBe(BF[1]);
    expect(guess?.alsoSeen).toEqual([BF[2], BF[3], BF[4]]);
  });

  it("only learns from lists with every battlefield", () => {
    const decks = [
      deck("k1", AGGRO, YI_HONED, [BF[0]]),
      deck("k2", AGGRO, YI_HONED, [BF[0]]),
      deck("k3", AGGRO, YI_HONED, [BF[0]]),
    ];
    const target = deck("t", AGGRO, null);

    expect(guessBattlefield(buildLegendIndex([...decks, target]), target, 3)).toBeNull();
  });
});

describe("inferGroup", () => {
  const known = [
    deck("k1", AGGRO, YI_HONED, [BF[0], BF[1], BF[2]]),
    deck("k2", AGGRO, YI_HONED, [BF[0], BF[1], BF[2]]),
    deck("k3", AGGRO, YI_HONED, [BF[0], BF[1], BF[3]]),
  ];

  it("guesses only the zones a partial list is missing", () => {
    const planned = inferGroup(
      LEGEND,
      [...known, deck("t", AGGRO, YI_TEMPERED, [], true)],
      FACTS,
      3,
    );

    expect(planned).toHaveLength(1);
    expect(planned[0]).toMatchObject({
      deckId: "t",
      championCardId: null,
      battlefieldCardId: BF[0],
    });
    expect(planned[0]!.neighbours.every((neighbour) => neighbour.zone === "battlefield")).toBe(
      true,
    );
  });

  it("marks a lone candidate unsure when the legend's held-out guesses miss", () => {
    const mixed = [
      deck("h1", AGGRO, YI_HONED),
      deck("h2", AGGRO, YI_HONED),
      deck("h3", AGGRO, YI_HONED),
      deck("t1", AGGRO, YI_TEMPERED),
      deck("t2", AGGRO, YI_TEMPERED),
      deck("t3", AGGRO, YI_TEMPERED),
    ];
    const target = deck("x", { ...AGGRO, [YI_TEMPERED]: 3 }, null, [], true);

    const [planned] = inferGroup(LEGEND, [...mixed, target], FACTS, 3);

    expect(planned).toMatchObject({
      championCardId: YI_HONED,
      championAltCardId: null,
      championUnsure: true,
    });
  });

  it("learns only from complete lists, never from another partial one", () => {
    const planned = inferGroup(
      LEGEND,
      [
        ...known,
        deck("p1", AGGRO, YI_TEMPERED, [], true),
        deck("p2", AGGRO, YI_TEMPERED, [], true),
        deck("t", AGGRO, null, [], true),
      ],
      FACTS,
      3,
    );

    const target = planned.find((row) => row.deckId === "t");
    expect(target?.championCardId).toBe(YI_HONED);
    expect(target?.neighbours.map((neighbour) => neighbour.neighbourDeckId)).not.toContain("p1");
  });

  it("leaves full lists alone even when a zone is empty", () => {
    expect(inferGroup(LEGEND, [...known, deck("t", AGGRO, null)], FACTS, 3)).toEqual([]);
  });

  it("writes no row when nothing can be guessed", () => {
    expect(inferGroup(LEGEND, [deck("t", AGGRO, null, [], true)], FACTS, 3)).toEqual([]);
  });
});

describe("inferenceSignature", () => {
  it("ignores how the two zones' neighbours interleave", () => {
    const base = {
      deckId: "t",
      championCardId: YI_HONED,
      championAltCardId: null,
      championUnsure: false,
      battlefieldCardId: BF[0],
      battlefieldAlsoCardIds: [],
    };
    const champion = { zone: "champion" as const, neighbourDeckId: "k1", shared: 30 };
    const battlefield = { zone: "battlefield" as const, neighbourDeckId: "k2", shared: 28 };

    expect(inferenceSignature({ ...base, neighbours: [champion, battlefield] })).toBe(
      inferenceSignature({ ...base, neighbours: [battlefield, champion] }),
    );
  });
});
