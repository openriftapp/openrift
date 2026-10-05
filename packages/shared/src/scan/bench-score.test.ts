import { describe, expect, it } from "vitest";

import type {
  BenchClipResult,
  BenchIdentity,
  BenchLock,
  ClipTruth,
  SavedClipResult,
  SavedRun,
  ScoredLock,
} from "./bench-score";
import {
  compareRuns,
  groupTruth,
  multiPrintingArts,
  scoreAppOutcomes,
  scoreClip,
  summarize,
} from "./bench-score";

const IDENTITIES: Record<string, BenchIdentity> = {
  "ahri-en": { name: "Ahri", artKey: "ogn|Ahri", publicCode: "OGN-066", language: "EN" },
  "ahri-zh": { name: "Ahri", artKey: "ogn|Ahri", publicCode: "OGN-066", language: "ZH" },
  "ahri-unl": { name: "Ahri", artKey: "unl|Ahri", publicCode: "UNL-010", language: "EN" },
  "teemo-en": { name: "Teemo", artKey: "ogn|Teemo", publicCode: "OGN-100", language: "EN" },
};

function identityOf(key: string): BenchIdentity | undefined {
  return IDENTITIES[key];
}

function lock(key: string, overrides: Partial<BenchLock> = {}): BenchLock {
  return {
    seconds: 2,
    key,
    artKey: IDENTITIES[key]?.artKey ?? "unknown",
    label: key,
    framesToLock: 3,
    score: 40,
    rivalScore: 0,
    printingResolved: true,
    multiPrinting: true,
    arrivedAt: null,
    source: "live",
    ...overrides,
  };
}

function truth(cards: ClipTruth["cards"]): ClipTruth {
  return { split: "tune", mode: "single", reviewed: true, cards };
}

describe("scoreClip", () => {
  it("counts a lock on a labelled card as found", () => {
    const { locks, score } = scoreClip(
      truth([{ artKey: "ogn|Ahri", name: "Ahri" }]),
      [lock("ahri-en")],
      identityOf,
    );
    expect(locks[0]?.verdict).toBe("correct");
    expect(score).toMatchObject({ expected: 1, found: 1, wrongCards: 0, missed: [] });
  });

  it("flags a lock on an artwork the clip does not contain", () => {
    const { score } = scoreClip(
      truth([{ artKey: "ogn|Ahri", name: "Ahri" }]),
      [lock("teemo-en")],
      identityOf,
    );
    expect(score).toMatchObject({ found: 0, wrongCards: 1, missed: ["Ahri"] });
  });

  it("counts the same card from another set as a wrong printing", () => {
    const { score } = scoreClip(
      truth([{ artKey: "ogn|Ahri", name: "Ahri" }]),
      [lock("ahri-unl")],
      identityOf,
    );
    expect(score).toMatchObject({ found: 0, wrongCards: 0, wrongPrintings: 1 });
  });

  it("treats every lock in a clip without cards as wrong", () => {
    const { score } = scoreClip(truth([]), [lock("ahri-en")], identityOf);
    expect(score).toMatchObject({ expected: 0, found: 0, wrongCards: 1 });
  });

  it("flags a resolved lock on the wrong printing", () => {
    const { locks, score } = scoreClip(
      truth([
        { artKey: "ogn|Ahri", name: "Ahri", printing: { publicCode: "OGN-066", language: "ZH" } },
      ]),
      [lock("ahri-en")],
      identityOf,
    );
    expect(locks[0]?.verdict).toBe("wrong-printing");
    expect(score).toMatchObject({ found: 0, wrongPrintings: 1 });
  });

  it("counts an unresolved printing as found but open", () => {
    const { locks, score } = scoreClip(
      truth([
        { artKey: "ogn|Ahri", name: "Ahri", printing: { publicCode: "OGN-066", language: "ZH" } },
      ]),
      [lock("ahri-en", { printingResolved: false })],
      identityOf,
    );
    expect(locks[0]?.verdict).toBe("printing-open");
    expect(score).toMatchObject({ found: 1, printingOpen: 1, wrongPrintings: 0 });
  });

  it("judges the printing of a single-printing artwork even when unresolved", () => {
    const { score } = scoreClip(
      truth([
        { artKey: "ogn|Teemo", name: "Teemo", printing: { publicCode: "OGN-100", language: "EN" } },
      ]),
      [lock("teemo-en", { printingResolved: false, multiPrinting: false })],
      identityOf,
    );
    expect(score).toMatchObject({ found: 1, printingOpen: 0 });
  });

  it("ignores the printing when the truth leaves it open", () => {
    const { score } = scoreClip(
      truth([{ artKey: "ogn|Ahri", name: "Ahri", printing: null }]),
      [lock("ahri-zh")],
      identityOf,
    );
    expect(score).toMatchObject({ found: 1, wrongPrintings: 0 });
  });

  it("scores a promo picked for a plain card as a wrong printing", () => {
    const marked: BenchIdentity = {
      name: "Ahri",
      artKey: "ogn|Ahri",
      publicCode: "OGN-066",
      language: "EN",
      markers: "promo",
    };
    const { score } = scoreClip(
      truth([
        {
          artKey: "ogn|Ahri",
          name: "Ahri",
          printing: { publicCode: "OGN-066", language: "EN", markers: "" },
        },
      ]),
      [lock("ahri-en")],
      () => marked,
    );
    expect(score).toMatchObject({ found: 0, markerOnly: 0, wrongPrintings: 1 });
  });

  it("scores a plain lock as marker-only while a promo copy is still unfound", () => {
    const plainAhri: BenchIdentity = {
      name: "Ahri",
      artKey: "ogn|Ahri",
      publicCode: "OGN-066",
      language: "EN",
      markers: "",
    };
    const { locks, score } = scoreClip(
      truth([
        {
          artKey: "ogn|Ahri",
          name: "Ahri",
          printing: { publicCode: "OGN-066-P", language: "EN", markers: "promo" },
        },
        {
          artKey: "ogn|Ahri",
          name: "Ahri",
          printing: { publicCode: "OGN-066", language: "EN", markers: "" },
        },
      ]),
      [lock("ahri-en"), lock("ahri-en"), lock("ahri-en")],
      () => plainAhri,
    );
    expect(locks.map((scored) => scored.verdict)).toEqual(["correct", "marker-only", "duplicate"]);
    expect(score).toMatchObject({ found: 2, markerOnly: 1, duplicates: 1 });
  });

  it("keeps another language a wrong printing", () => {
    const korean: BenchIdentity = {
      name: "Ahri",
      artKey: "ogn|Ahri",
      publicCode: "OGN-066",
      language: "KR",
      markers: "",
    };
    const { score } = scoreClip(
      truth([
        {
          artKey: "ogn|Ahri",
          name: "Ahri",
          printing: { publicCode: "OGN-066", language: "EN", markers: "" },
        },
      ]),
      [lock("ahri-en")],
      () => korean,
    );
    expect(score).toMatchObject({ found: 0, markerOnly: 0, wrongPrintings: 1 });
  });

  it("counts locks beyond the labelled copies as duplicates", () => {
    const { score } = scoreClip(
      truth([{ artKey: "ogn|Ahri", name: "Ahri", copies: 2 }]),
      [lock("ahri-en"), lock("ahri-en"), lock("ahri-en")],
      identityOf,
    );
    expect(score).toMatchObject({ expected: 2, found: 2, duplicates: 1 });
  });

  it("matches each lock to the labelled printing of a shared artwork", () => {
    const { locks, score } = scoreClip(
      truth([
        { artKey: "ogn|Ahri", name: "Ahri", printing: { publicCode: "OGN-066", language: "ZH" } },
        { artKey: "ogn|Ahri", name: "Ahri", printing: { publicCode: "OGN-066", language: "EN" } },
      ]),
      [lock("ahri-en"), lock("ahri-zh")],
      identityOf,
    );
    expect(locks.map((scored) => scored.verdict)).toEqual(["correct", "correct"]);
    expect(score).toMatchObject({ expected: 2, found: 2, missed: [] });
  });

  it("counts a repeat of an already found printing as a duplicate, not a wrong printing", () => {
    const { locks, score } = scoreClip(
      truth([
        { artKey: "ogn|Ahri", name: "Ahri", printing: { publicCode: "OGN-066", language: "ZH" } },
        { artKey: "ogn|Ahri", name: "Ahri", printing: { publicCode: "OGN-066", language: "EN" } },
      ]),
      [lock("ahri-en"), lock("ahri-en")],
      identityOf,
    );
    expect(locks.map((scored) => scored.verdict)).toEqual(["correct", "duplicate"]);
    expect(score.missed).toEqual(["Ahri"]);
  });

  it("gives an unresolved lock to an open printing of its artwork", () => {
    const { locks } = scoreClip(
      truth([
        { artKey: "ogn|Ahri", name: "Ahri", printing: { publicCode: "OGN-066", language: "ZH" } },
        { artKey: "ogn|Ahri", name: "Ahri", printing: { publicCode: "OGN-066", language: "EN" } },
      ]),
      [lock("ahri-en"), lock("ahri-zh", { printingResolved: false })],
      identityOf,
    );
    expect(locks.map((scored) => scored.verdict)).toEqual(["correct", "printing-open"]);
  });

  it("lists every missing copy", () => {
    const { score } = scoreClip(
      truth([{ artKey: "ogn|Ahri", name: "Ahri", copies: 3 }]),
      [lock("ahri-en")],
      identityOf,
    );
    expect(score.missed).toEqual(["Ahri", "Ahri"]);
  });

  it("records arrival-to-lock time for counted locks only", () => {
    const { score } = scoreClip(
      truth([{ artKey: "ogn|Ahri", name: "Ahri" }]),
      [
        lock("ahri-en", { seconds: 5, arrivedAt: 4.5 }),
        lock("ahri-en", { seconds: 9, arrivedAt: 8 }),
      ],
      identityOf,
    );
    expect(score.arrivalToLock).toEqual([0.5]);
  });
});

describe("summarize", () => {
  it("returns zeros for no values", () => {
    expect(summarize([])).toEqual({ mean: 0, p50: 0, p90: 0 });
  });

  it("reports mean and nearest-rank percentiles", () => {
    const summary = summarize([10, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
    expect(summary).toEqual({ mean: 5.5, p50: 6, p90: 10 });
  });
});

function clip(overrides: Partial<BenchClipResult> = {}): BenchClipResult {
  return {
    clip: "singles",
    split: "tune",
    mode: "single",
    reviewed: true,
    frames: 100,
    processed: 100,
    frameMs: { mean: 50, p50: 50, p90: 60 },
    stageMs: { detect: 10, embed: 10, verify: 30 },
    locks: [],
    score: {
      expected: 5,
      found: 5,
      wrongCards: 0,
      wrongPrintings: 0,
      markerOnly: 0,
      printingOpen: 0,
      duplicates: 0,
      missed: [],
      arrivalToLock: [],
    },
    sweepShare: 0,
    ...overrides,
  };
}

function run(clips: SavedClipResult[]): SavedRun {
  return { meta: {}, clips };
}

describe("compareRuns", () => {
  it("passes an identical run", () => {
    const result = compareRuns(run([clip()]), run([clip()]));
    expect(result.failures).toEqual([]);
    expect(result.warnings).toEqual([]);
    expect(result.rows).toHaveLength(1);
  });

  it("fails when a clip gains a wrong lock", () => {
    const worse = clip({ score: { ...clip().score, wrongCards: 1 } });
    expect(compareRuns(run([clip()]), run([worse])).failures).toEqual([
      "singles: wrong locks 0 -> 1",
    ]);
  });

  it("fails when a wrong printing appears", () => {
    const worse = clip({ score: { ...clip().score, wrongPrintings: 1 } });
    expect(compareRuns(run([clip()]), run([worse])).failures).toHaveLength(1);
  });

  it("warns when both runs carry the same wrong locks", () => {
    const both = clip({ score: { ...clip().score, wrongCards: 1 } });
    const result = compareRuns(run([both]), run([both]));
    expect(result.failures).toEqual([]);
    expect(result.warnings).toEqual(["singles: 1 wrong locks in both runs"]);
  });

  it("fails when fewer cards are found", () => {
    const worse = clip({ score: { ...clip().score, found: 4 } });
    expect(compareRuns(run([clip()]), run([worse])).failures).toEqual([
      "singles: found 5 -> 4 of 5",
      "singles: correct locks 5 -> 4",
    ]);
  });

  it("fails when a correct printing degrades to an open or marker-only lock", () => {
    const open = clip({ score: { ...clip().score, printingOpen: 1 } });
    const marker = clip({ score: { ...clip().score, markerOnly: 1 } });
    expect(compareRuns(run([clip()]), run([open])).failures).toEqual([
      "singles: correct locks 5 -> 4",
    ]);
    expect(compareRuns(run([clip()]), run([marker])).failures).toEqual([
      "singles: correct locks 5 -> 4",
    ]);
  });

  it("warns when the truth file changed between runs", () => {
    const relabelled = clip({ score: { ...clip().score, expected: 6 } });
    const result = compareRuns(run([clip()]), run([relabelled]));
    expect(result.failures).toEqual([]);
    expect(result.warnings).toEqual(["singles: truth changed, expected 5 -> 6"]);
  });

  it("fails when a card is counted twice more often", () => {
    const worse = clip({ score: { ...clip().score, duplicates: 1 } });
    expect(compareRuns(run([clip()]), run([worse])).failures).toEqual([
      "singles: duplicates 0 -> 1",
    ]);
  });

  it("fails when the clip sets differ", () => {
    const result = compareRuns(run([clip()]), run([clip({ clip: "binder" })]));
    expect(result.failures).toEqual([
      "singles: missing from the candidate run",
      "binder: missing from the baseline run",
    ]);
  });

  describe("frame time", () => {
    const at = (mean: number, sweepShare?: number): SavedClipResult => {
      const { sweepShare: _, ...rest } = clip({ frameMs: { mean, p50: mean, p90: mean } });
      return sweepShare === undefined ? rest : { ...rest, sweepShare };
    };

    it("fails a slowdown above 25% on a clip that did not sweep", () => {
      const result = compareRuns(run([at(50, 0)]), run([at(63, 0.05)]));
      expect(result.failures).toEqual(["singles: mean frame 50 -> 63 ms"]);
      expect(result.warnings).toEqual([]);
    });

    it("only warns about a slowdown between 10% and 25%", () => {
      const result = compareRuns(run([at(50, 0)]), run([at(60, 0)]));
      expect(result.failures).toEqual([]);
      expect(result.warnings).toEqual(["singles: mean frame 50 -> 60 ms"]);
    });

    it("only warns about a large slowdown on a clip that swept", () => {
      const result = compareRuns(run([at(50, 0)]), run([at(80, 0.1)]));
      expect(result.failures).toEqual([]);
      expect(result.warnings).toEqual(["singles: mean frame 50 -> 80 ms"]);
    });

    it("only warns about a large slowdown when the candidate has no sweep share", () => {
      const result = compareRuns(run([at(50)]), run([at(80)]));
      expect(result.failures).toEqual([]);
      expect(result.warnings).toEqual(["singles: mean frame 50 -> 80 ms"]);
    });
  });

  it("warns about unreviewed truth", () => {
    const result = compareRuns(run([clip()]), run([clip({ reviewed: false })]));
    expect(result.warnings).toEqual(["singles: truth labels are not reviewed yet"]);
  });

  it("fails when more wrong printings would be added to the collection", () => {
    const app = { auto: 5, autoWrong: 0, picker: 0, pickerMissing: 0, markerMiss: 0, unknown: 0 };
    const result = compareRuns(
      run([clip({ app })]),
      run([clip({ app: { ...app, autoWrong: 1 } })]),
    );
    expect(result.failures).toEqual(["singles: wrong printings added 0 -> 1"]);
  });

  it("warns when only one run has an app score", () => {
    const app = { auto: 5, autoWrong: 0, picker: 0, pickerMissing: 0, markerMiss: 0, unknown: 0 };
    expect(compareRuns(run([clip({ app })]), run([clip()])).warnings).toEqual([
      "singles: only the baseline run has an app score",
    ]);
    expect(compareRuns(run([clip()]), run([clip({ app })])).warnings).toEqual([
      "singles: only the candidate run has an app score",
    ]);
  });
});

describe("scoreAppOutcomes", () => {
  const promoTruth = truth([
    {
      artKey: "ogn|Ahri",
      name: "Ahri",
      printing: { publicCode: "OGN-066", language: "EN", markers: "promo" },
    },
  ]);
  const promo: BenchIdentity = {
    name: "Ahri",
    artKey: "ogn|Ahri",
    publicCode: "OGN-066",
    language: "EN",
    markers: "promo",
  };
  const plain: BenchIdentity = { ...promo, markers: "" };
  const scored = (verdict: ScoredLock["verdict"]): ScoredLock => ({ ...lock("ahri-en"), verdict });

  it("accepts an automatic add of the labelled printing", () => {
    const score = scoreAppOutcomes(promoTruth, [
      { lock: scored("correct"), name: "Ahri", outcome: { kind: "auto", printings: [promo] } },
    ]);
    expect(score).toEqual({
      auto: 1,
      autoWrong: 0,
      picker: 0,
      pickerMissing: 0,
      markerMiss: 0,
      unknown: 0,
    });
  });

  it("counts a plain add of a promo card as a marker miss", () => {
    const score = scoreAppOutcomes(promoTruth, [
      {
        lock: scored("printing-open"),
        name: "Ahri",
        outcome: { kind: "auto", printings: [plain] },
      },
    ]);
    expect(score).toMatchObject({ auto: 1, autoWrong: 0, markerMiss: 1 });
  });

  it("flags an automatic add in another language", () => {
    const score = scoreAppOutcomes(promoTruth, [
      {
        lock: scored("printing-open"),
        name: "Ahri",
        outcome: { kind: "auto", printings: [{ ...promo, language: "KR" }] },
      },
    ]);
    expect(score).toMatchObject({ auto: 1, autoWrong: 1, markerMiss: 0 });
  });

  it("flags a picker that does not offer the labelled printing", () => {
    const score = scoreAppOutcomes(promoTruth, [
      {
        lock: scored("printing-open"),
        name: "Ahri",
        outcome: { kind: "picker", printings: [{ ...promo, language: "KR" }] },
      },
      {
        lock: scored("printing-open"),
        name: "Ahri",
        outcome: { kind: "picker", printings: [plain, promo] },
      },
    ]);
    expect(score).toMatchObject({ picker: 2, pickerMissing: 1 });
  });

  it("skips wrong-card locks, which the card score already counts", () => {
    const score = scoreAppOutcomes(promoTruth, [
      { lock: scored("wrong-card"), name: "Teemo", outcome: { kind: "auto", printings: [plain] } },
    ]);
    expect(score.auto).toBe(0);
  });

  it("flags a duplicate add, which puts an extra card in the list", () => {
    const score = scoreAppOutcomes(promoTruth, [
      {
        lock: scored("printing-open"),
        name: "Ahri",
        outcome: { kind: "auto", printings: [promo] },
      },
      { lock: scored("duplicate"), name: "Ahri", outcome: { kind: "auto", printings: [promo] } },
    ]);
    expect(score).toMatchObject({ auto: 2, autoWrong: 1 });
  });

  it("uses each labelled copy once, so a promo added as normal is a marker miss", () => {
    const mixed = truth([
      {
        artKey: "ogn|Ahri",
        name: "Ahri",
        printing: { publicCode: "OGN-066", language: "EN", markers: "promo" },
      },
      {
        artKey: "ogn|Ahri",
        name: "Ahri",
        copies: 2,
        printing: { publicCode: "OGN-066", language: "EN", markers: "" },
      },
    ]);
    const addPlain = {
      lock: scored("printing-open"),
      name: "Ahri",
      outcome: { kind: "auto" as const, printings: [plain] },
    };
    const score = scoreAppOutcomes(mixed, [addPlain, addPlain, addPlain, addPlain]);
    expect(score).toMatchObject({ auto: 4, autoWrong: 1, markerMiss: 1 });
  });

  it("accepts any printing when the label leaves it open", () => {
    const score = scoreAppOutcomes(truth([{ artKey: "ogn|Ahri", name: "Ahri", printing: null }]), [
      { lock: scored("correct"), name: "Ahri", outcome: { kind: "auto", printings: [plain] } },
    ]);
    expect(score.autoWrong).toBe(0);
  });
});

describe("groupTruth", () => {
  it("moves labelled artworks onto their group and keeps ungrouped ones", () => {
    const labelled: ClipTruth = {
      split: "tune",
      mode: "single",
      reviewed: true,
      cards: [
        { artKey: "unl|Ahri", name: "Ahri", copies: 2 },
        { artKey: "ogn|Teemo", name: "Teemo" },
      ],
    };
    const grouped = groupTruth(labelled, new Map([["unl|Ahri", "ogn|Ahri"]]));
    expect(grouped.cards).toEqual([
      { artKey: "ogn|Ahri", name: "Ahri", copies: 2 },
      { artKey: "ogn|Teemo", name: "Teemo" },
    ]);
    expect(labelled.cards[0]?.artKey).toBe("unl|Ahri");
  });
});

describe("multiPrintingArts", () => {
  const printings: Record<string, BenchIdentity> = {
    ...IDENTITIES,
    "ahri-en-again": { ...IDENTITIES["ahri-en"]! },
    "teemo-en-again": { ...IDENTITIES["teemo-en"]! },
    "jinx-en": { name: "Jinx", artKey: "ogn|Jinx", publicCode: "OGN-200", language: "EN" },
    "jinx-promo": {
      name: "Jinx",
      artKey: "ogn|Jinx",
      publicCode: "OGN-200",
      language: "EN",
      markers: "promo",
    },
  };

  it("keeps artworks whose printings differ by language or marker", () => {
    const arts = multiPrintingArts([...Object.keys(printings), "unknown"], (key) => printings[key]);
    expect(arts).toEqual(new Set(["ogn|Ahri", "ogn|Jinx"]));
  });

  it("ignores keys that repeat one printing", () => {
    const arts = multiPrintingArts(["teemo-en", "teemo-en-again"], (key) => printings[key]);
    expect(arts.size).toBe(0);
  });
});
