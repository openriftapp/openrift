import { describe, expect, it, vi } from "vitest";

import type { CardEmbedder, EmbedBank } from "./embed";
import { rotateRgbaCw } from "./image";
import { PRINTING_ATTEMPTS } from "./printing-lock";
import { createScanSession, prioritizeTracked } from "./session";
import type { ScanSessionDeps } from "./session";
import { IDLE_AFTER_NO_WINNER_FRAMES } from "./session-options";
import type * as SessionOptionsModule from "./session-options";
import type { ScanSessionOptions } from "./session-options";
import { SWEEP_OPTIONS } from "./sweep";
import { blankFrame, boxQuad, cardTexture, layCard, outline, printingCard } from "./test-images";
import type { CardCandidate, Quad, RgbaImage } from "./types";

// The test textures are smooth noise below both focus floors, and every test
// card fills its whole frame.
vi.mock("./session-options", async (importOriginal) => ({
  ...(await importOriginal<typeof SessionOptionsModule>()),
  MIN_FOCUS: 0,
  ROTATION_MIN_FOCUS: 0,
  centeredGuideQuad: (width: number, height: number): Quad => [
    { x: 0, y: 0 },
    { x: width, y: 0 },
    { x: width, y: height },
    { x: 0, y: height },
  ],
}));

describe("prioritizeTracked", () => {
  const candidate = (x: number, y: number, score: number) =>
    outline(boxQuad(x, y, 100, 140), score);

  it("keeps the order when there is no anchor", () => {
    const a = candidate(0, 0, 5);
    const b = candidate(500, 500, 1);
    expect(prioritizeTracked([a, b], null)).toEqual([a, b]);
  });

  it("moves the candidate overlapping the anchor to the front", () => {
    const junk = candidate(500, 500, 9);
    const tracked = candidate(0, 0, 1);
    expect(prioritizeTracked([junk, tracked], candidate(4, 4, 0).quad)).toEqual(
      [junk, tracked].toReversed(),
    );
  });

  it("ignores overlaps below the tracking threshold", () => {
    const junk = candidate(500, 500, 9);
    const grazing = candidate(0, 0, 1);
    expect(prioritizeTracked([junk, grazing], candidate(80, 120, 0).quad)).toEqual([junk, grazing]);
  });

  it("preserves relative order among non-overlapping candidates", () => {
    const tracked = candidate(0, 0, 1);
    const far = candidate(500, 500, 9);
    const farther = candidate(900, 900, 3);
    expect(prioritizeTracked([far, farther, tracked], candidate(2, 2, 0).quad)).toEqual([
      tracked,
      far,
      farther,
    ]);
  });
});

function wholeFrameGuide(): (width: number, height: number) => Quad {
  return (width, height) => boxQuad(0, 0, width, height);
}

// Places each key at (cos, sin) of an angle so 1 - cos equals its requested distance
// from the fixed query vector (1, 0).
function createBank(distances: Record<string, number>): EmbedBank {
  const bank: EmbedBank = { keys: [], vectors: new Float32Array(0) };
  setDistances(bank, distances);
  return bank;
}

// Mutates in place: the session holds this bank object, not a copy, so a running
// session sees the change on its next frame.
function setDistances(bank: EmbedBank, distances: Record<string, number>): void {
  bank.keys = Object.keys(distances);
  bank.vectors = new Float32Array(bank.keys.length * 2);
  bank.keys.forEach((key, index) => {
    const cosine = 1 - (distances[key] ?? 2);
    bank.vectors[index * 2] = cosine;
    bank.vectors[index * 2 + 1] = Math.sqrt(Math.max(0, 1 - cosine * cosine));
  });
}

function createEmbedder(): { embedder: CardEmbedder; calls: number[] } {
  const calls: number[] = [];
  const embedder: CardEmbedder = (_pixels, count) => {
    calls.push(count);
    const out = new Float32Array(count * 2);
    for (let slot = 0; slot < count; slot++) {
      out[slot * 2] = 1;
    }
    return Promise.resolve(out);
  };
  return { embedder, calls };
}

function testOptions(overrides: Partial<ScanSessionOptions> = {}): Partial<ScanSessionOptions> {
  return {
    accept: { lockRun: 2, maxGapFrames: 6 },
    ...overrides,
  };
}

function testDeps(overrides: Partial<ScanSessionDeps> = {}) {
  return {
    embedder: createEmbedder().embedder,
    bank: createBank({ "k-a": 0.1 }),
    artKeyOf: (key: string) => key,
    labelOf: (key: string) => key,
    identityOf: () => ({ markers: "" }),
    fetchReference: () => Promise.resolve(cardTexture(1)),
    ...overrides,
  } satisfies ScanSessionDeps;
}

const frozenClock = () => 0;

describe("createScanSession — absent-frame re-arm", () => {
  // `present`/`absent` move the whole card in and out of frame at once: an absent
  // card must neither rank plausibly nor verify for a frame to count as absent.
  async function lockedSession() {
    const bank = createBank({ "k-a": 0.05 });
    let frame = cardTexture(1);
    const session = createScanSession(testDeps({ bank }), testOptions());
    await session.processFrame(frame, 0, 0, frozenClock);
    await session.processFrame(frame, 1, 0.1, frozenClock);
    return {
      session,
      frame: () => frame,
      absent: () => {
        setDistances(bank, { "k-a": 0.9 });
        frame = blankFrame();
      },
      present: () => {
        setDistances(bank, { "k-a": 0.05 });
        frame = cardTexture(1);
      },
      unverifiable: () => {
        setDistances(bank, { "k-a": 0.3 });
        frame = cardTexture(2);
      },
    };
  }

  it("locks the artwork over the accept run", async () => {
    const { session } = await lockedSession();

    expect(session.state.get("k-a")?.lockedAt).not.toBeNull();
    expect(session.state.get("k-a")?.lockedThisRun).toBe(true);
  });

  it("needs two absent frames in a row, not one", async () => {
    const { session, frame, absent } = await lockedSession();
    absent();

    await session.processFrame(frame(), 2, 0.2, frozenClock);

    expect(session.state.get("k-a")?.lockedThisRun).toBe(true);
  });

  it("re-arms the locked track on the second absent frame", async () => {
    const { session, frame, absent } = await lockedSession();
    absent();

    await session.processFrame(frame(), 2, 0.2, frozenClock);
    await session.processFrame(frame(), 3, 0.3, frozenClock);

    const track = session.state.get("k-a");
    expect(track?.lockedThisRun).toBe(false);
    expect(track?.runLength).toBe(0);
    expect(track?.lastFrame).toBe(Number.NEGATIVE_INFINITY);
    expect(track?.lockedAt).not.toBeNull();
  });

  it("treats a card that only verification missed as still present", async () => {
    const { session, frame, absent, unverifiable } = await lockedSession();
    absent();

    await session.processFrame(frame(), 2, 0.2, frozenClock);
    unverifiable();
    const missed = await session.processFrame(frame(), 3, 0.3, frozenClock);
    absent();
    await session.processFrame(frame(), 4, 0.4, frozenClock);

    expect(missed.winner).toBeNull();
    expect(session.state.get("k-a")?.lockedThisRun).toBe(true);
  });

  it("lets the artwork lock again once the card comes back", async () => {
    const { session, frame, absent, present } = await lockedSession();
    absent();
    await session.processFrame(frame(), 2, 0.2, frozenClock);
    await session.processFrame(frame(), 3, 0.3, frozenClock);

    present();
    await session.processFrame(frame(), 4, 0.4, frozenClock);
    const second = await session.processFrame(frame(), 5, 0.5, frozenClock);

    expect(second.locked?.artKey).toBe("k-a");
  });

  it("keeps a card the detector misses but the embedding still recognises", async () => {
    let frame = 0;
    const seen = (input: RgbaImage) => outline(wholeFrameGuide()(input.width, input.height));
    const session = createScanSession(
      testDeps({
        detectCard: (input) => Promise.resolve(frame < 2 ? [seen(input)] : []),
      }),
      testOptions(),
    );
    let locks = 0;
    for (frame = 0; frame < 6; frame++) {
      const outcome = await session.processFrame(cardTexture(1), frame, frame / 10, frozenClock);
      locks += outcome.locked ? 1 : 0;
    }
    expect(locks).toBe(1);
  });

  it("re-arms on demand and clears the absent streak with it", async () => {
    const { session, frame, absent } = await lockedSession();
    absent();

    await session.processFrame(frame(), 2, 0.2, frozenClock);
    session.rearm();
    await session.processFrame(frame(), 3, 0.3, frozenClock);

    const track = session.state.get("k-a");
    expect(track?.lockedThisRun).toBe(false);
    expect(track?.runLength).toBe(0);
  });
});

describe("createScanSession — idle backoff", () => {
  function idleSession() {
    const bank = createBank({ "k-a": 0.9 });
    const { embedder, calls } = createEmbedder();
    const session = createScanSession(testDeps({ bank, embedder }), testOptions());
    return { session, bank, calls };
  }

  it("pays the full rotation search while the streak is short", async () => {
    const { session, calls } = idleSession();

    await session.processFrame(blankFrame(), 0, 0, frozenClock);

    // [1, 3]: upright first, then the three other quarter turns.
    expect(calls).toEqual([1, 3]);
  });

  it("embeds upright only once the winner-less streak crosses the threshold", async () => {
    const { session, calls } = idleSession();
    for (let frame = 0; frame < IDLE_AFTER_NO_WINNER_FRAMES; frame++) {
      await session.processFrame(blankFrame(), frame, frame / 10, frozenClock);
    }
    calls.length = 0;

    await session.processFrame(blankFrame(), IDLE_AFTER_NO_WINNER_FRAMES, 0.5, frozenClock);

    expect(calls).toEqual([1]);
  });

  it("restores the full search on the frame after one that ranked plausibly", async () => {
    const { session, bank, calls } = idleSession();
    for (let frame = 0; frame < IDLE_AFTER_NO_WINNER_FRAMES; frame++) {
      await session.processFrame(blankFrame(), frame, frame / 10, frozenClock);
    }

    setDistances(bank, { "k-a": 0.3 });
    await session.processFrame(blankFrame(), 5, 0.5, frozenClock);
    setDistances(bank, { "k-a": 0.9 });
    calls.length = 0;
    await session.processFrame(blankFrame(), 6, 0.6, frozenClock);

    expect(calls).toEqual([1, 3]);
  });
});

describe("createScanSession — printing attempts", () => {
  const ART = "art-lux";
  const LABELS: Record<string, string> = {
    "p-en": "Lux [OGN EN]",
    "p-dup": "Lux [UNL EN]",
    "p-sc": "Lux [OGN SC]",
  };

  function printingSession(renders: Record<string, number>) {
    const images = new Map(
      Object.entries(renders).map(([key, stamp]) => [key, printingCard(stamp)]),
    );
    const keys = Object.keys(renders);
    const [aimedStamp = 1] = Object.values(renders);
    const session = createScanSession(
      testDeps({
        bank: createBank(Object.fromEntries(keys.map((key, index) => [key, 0.05 + index / 100]))),
        artKeyOf: () => ART,
        labelOf: (key) => LABELS[key] ?? key,
        fetchReference: (key) => Promise.resolve(images.get(key) ?? null),
      }),
      testOptions({ topK: keys.length }),
    );
    return { session, frame: printingCard(aimedStamp) };
  }

  // Frame 0 starts the run; every frame from the lock on takes one attempt.
  async function pastTheCap(session: ReturnType<typeof createScanSession>, frame: RgbaImage) {
    const outcomes = [];
    for (let index = 0; index < PRINTING_ATTEMPTS + 2; index++) {
      outcomes.push(await session.processFrame(frame, index, index / 10, frozenClock));
    }
    return outcomes;
  }

  it("stops trying to settle a printing after the attempt cap", async () => {
    const { session, frame } = printingSession({ "p-en": 1, "p-dup": 1, "p-sc": 9 });

    const outcomes = await pastTheCap(session, frame);

    expect(outcomes.filter((outcome) => outcome.printingScores).length).toBe(PRINTING_ATTEMPTS);
    expect(outcomes.at(-1)?.printingScores).toBeUndefined();
    expect(session.state.get(ART)?.printingResolved).toBe(false);
  });

  it("tries again after the cap once the artwork locks again", async () => {
    const { session, frame } = printingSession({ "p-en": 1, "p-dup": 1, "p-sc": 9 });
    await pastTheCap(session, frame);
    const next = PRINTING_ATTEMPTS + 2;

    session.rearm();
    await session.processFrame(frame, next, next / 10, frozenClock);
    const relock = await session.processFrame(frame, next + 1, (next + 1) / 10, frozenClock);

    expect(relock.locked?.artKey).toBe(ART);
    expect(relock.printingScores).toBeDefined();
  });

  it("settles the printing over the frames after the lock", async () => {
    const { session, frame } = printingSession({ "p-en": 1, "p-sc": 9 });

    await session.processFrame(frame, 0, 0, frozenClock);
    const lock = await session.processFrame(frame, 1, 0.1, frozenClock);
    const retry = await session.processFrame(frame, 2, 0.2, frozenClock);

    expect(lock.printingTrack?.resolved).toBe(false);
    expect(retry.printingVia).toBe("name");
    expect(retry.printingTrack).toMatchObject({ key: "p-en", resolved: true });
  });

  it("stops retrying once the track is resolved", async () => {
    const { session, frame } = printingSession({ "p-en": 1, "p-sc": 9 });

    await session.processFrame(frame, 0, 0, frozenClock);
    await session.processFrame(frame, 1, 0.1, frozenClock);
    await session.processFrame(frame, 2, 0.2, frozenClock);
    const after = await session.processFrame(frame, 3, 0.3, frozenClock);

    expect(after.printingTrack).toBeUndefined();
    expect(after.printingScores).toBeUndefined();
  });
});

describe("createScanSession — learned detector with the aligned verifier", () => {
  const fullFrame = (frame: RgbaImage) => outline(wholeFrameGuide()(frame.width, frame.height));

  it("locks from detector crops and reports the aligned score in percent", async () => {
    const session = createScanSession(
      testDeps({ detectCard: (input) => Promise.resolve([fullFrame(input)]) }),
      testOptions(),
    );

    const first = await session.processFrame(cardTexture(1), 0, 0, frozenClock);
    const second = await session.processFrame(cardTexture(1), 1, 0.1, frozenClock);

    expect(first.winner?.key).toBe("k-a");
    expect(second.locked?.key).toBe("k-a");
    expect(first.bestScore).toBeGreaterThanOrEqual(60);
    expect(first.bestScore).toBeLessThanOrEqual(100);
  });

  it("finds no winner when the crop does not line up with the reference", async () => {
    const session = createScanSession(
      testDeps({
        fetchReference: () => Promise.resolve(cardTexture(2)),
        detectCard: (input) => Promise.resolve([fullFrame(input)]),
      }),
      testOptions(),
    );

    const outcome = await session.processFrame(cardTexture(1), 0, 0, frozenClock);

    expect(outcome.ranked[0]?.key).toBe("k-a");
    expect(outcome.winner).toBeNull();
  });

  it("refuses a frame two artworks verify equally well", async () => {
    const session = createScanSession(
      testDeps({ bank: createBank({ "k-a": 0.1, "k-b": 0.12 }) }),
      testOptions(),
    );

    const outcome = await session.processFrame(cardTexture(1), 0, 0, frozenClock);

    expect(outcome.winner).toBeNull();
    expect(outcome.refused).toBe(true);
  });

  const failing =
    (failed: string) =>
    (key: string): Promise<RgbaImage | null> =>
      key === failed
        ? Promise.reject(new Error("connection dropped"))
        : Promise.resolve(cardTexture(1));

  it("reads on past an unfetchable rival ranked behind the winner", async () => {
    const session = createScanSession(
      testDeps({ bank: createBank({ "k-a": 0.05, "k-b": 0.3 }), fetchReference: failing("k-b") }),
      testOptions(),
    );

    const outcome = await session.processFrame(cardTexture(1), 0, 0, frozenClock);

    expect(outcome.winner?.key).toBe("k-a");
    expect(outcome.ranked.map((entry) => entry.key)).toEqual(["k-a", "k-b"]);
  });

  it("reads on past an unfetchable printing of the winning artwork", async () => {
    const session = createScanSession(
      testDeps({
        bank: createBank({ "k-a2": 0.05, "k-a": 0.1 }),
        artKeyOf: () => "art-a",
        fetchReference: failing("k-a2"),
      }),
      testOptions(),
    );

    const outcome = await session.processFrame(cardTexture(1), 0, 0, frozenClock);

    expect(outcome.winner?.key).toBe("k-a");
  });

  it("discards a frame whose unfetchable rival ranked ahead of the winner", async () => {
    const session = createScanSession(
      testDeps({ bank: createBank({ "k-b": 0.05, "k-a": 0.1 }), fetchReference: failing("k-b") }),
      testOptions(),
    );

    const outcome = await session.processFrame(cardTexture(1), 0, 0, frozenClock);

    expect(outcome.winner).toBeNull();
    expect(outcome.bestScore).toBe(0);
    expect(outcome.candidate).not.toBeNull();
  });

  it("embeds only the detector's crop once it sees a card", async () => {
    const { embedder, calls } = createEmbedder();
    const session = createScanSession(
      testDeps({
        embedder,
        bank: createBank({ "k-a": 0.9 }),
        detectCard: (input) => Promise.resolve([fullFrame(input)]),
      }),
      testOptions(),
    );

    await session.processFrame(cardTexture(1), 0, 0, frozenClock);

    expect(calls.reduce((sum, count) => sum + count, 0)).toBeLessThanOrEqual(4);
  });
});

describe("createScanSession — automatic sweep", () => {
  const EVERY = SWEEP_OPTIONS.surveyEveryFrames;
  const outlineAt = (left: number) => outline(boxQuad(left, 100, 120, 168));

  const MAX_TABLE_OFFSET = 64;
  const table = blankFrame(blankFrame().width + MAX_TABLE_OFFSET);
  for (let y = 0; y < table.height; y++) {
    for (let x = 0; x < table.width; x++) {
      const value = 128 + 60 * Math.sin(x / 23) * Math.cos(y / 31) + 40 * Math.sin((x + y) / 57);
      table.data.fill(value, (y * table.width + x) * 4, (y * table.width + x) * 4 + 3);
    }
  }
  const card = cardTexture(1);

  function tableSeenFrom(offset: number, cardLefts: number[]): RgbaImage {
    const frame = blankFrame();
    for (let y = 0; y < frame.height; y++) {
      const from = (y * table.width + offset) * 4;
      frame.data.set(table.data.subarray(from, from + frame.width * 4), y * frame.width * 4);
    }
    for (const left of cardLefts) {
      layCard(frame, card, { left, top: 100, width: 120, height: 168 });
    }
    return frame;
  }

  function sweepSession(outlines: () => CardCandidate[]) {
    return createScanSession(
      testDeps({
        detectCard: () => Promise.resolve([]),
        detectBoard: () => Promise.resolve(outlines()),
      }),
      testOptions({ sweep: true }),
    );
  }

  it("switches into a sweep while the camera moves over several cards", async () => {
    let offset = 0;
    const session = sweepSession(() => [outlineAt(20 - offset), outlineAt(220 - offset)]);
    const sweeping: boolean[] = [];
    for (let frame = 0; frame < 8; frame++) {
      offset = frame * 6;
      const outcome = await session.processFrame(
        tableSeenFrom(offset, [20 - offset, 220 - offset]),
        frame,
        frame / 30,
        frozenClock,
      );
      sweeping.push(outcome.sweeping);
    }
    expect(sweeping.at(0)).toBe(false);
    expect(sweeping.at(-1)).toBe(true);
  });

  it("keeps scanning single cards while the camera holds still over several cards", async () => {
    const session = sweepSession(() => [outlineAt(20), outlineAt(220)]);
    for (let frame = 0; frame < 8; frame++) {
      const outcome = await session.processFrame(
        tableSeenFrom(0, [20, 220]),
        frame,
        frame / 30,
        frozenClock,
      );
      expect(outcome.sweeping).toBe(false);
    }
  });

  it("publishes the survey outlines on the frame outcome", async () => {
    const outlines = [outlineAt(20), outlineAt(220)];
    let boardReads = 0;
    const session = createScanSession(
      testDeps({
        detectCard: () => Promise.resolve([]),
        detectBoard: () => {
          boardReads++;
          return Promise.resolve(outlines);
        },
      }),
      testOptions({ sweep: true }),
    );
    const first = await session.processFrame(tableSeenFrom(0, [20, 220]), 0, 0, frozenClock);
    const second = await session.processFrame(tableSeenFrom(0, [20, 220]), 1, 1 / 30, frozenClock);

    expect(first.survey).toEqual(outlines);
    expect(second).not.toHaveProperty("survey");
    expect(boardReads).toBe(1);
  });

  async function surveyedFrames(bank: EmbedBank, frames: number): Promise<number[]> {
    const session = createScanSession(
      testDeps({
        bank,
        detectCard: () => Promise.resolve([]),
        detectBoard: () => Promise.resolve([outlineAt(20), outlineAt(220)]),
      }),
      testOptions({ sweep: true }),
    );
    const surveyed: number[] = [];
    for (let frame = 0; frame < frames; frame++) {
      const outcome = await session.processFrame(
        tableSeenFrom(0, [20, 220]),
        frame,
        frame / 30,
        frozenClock,
      );
      if (outcome.survey) {
        surveyed.push(frame);
      }
    }
    return surveyed;
  }

  it("surveys once per second while the camera is still and no card is in the guide", async () => {
    expect(await surveyedFrames(createBank({ "k-a": 0.9 }), 61)).toEqual([0, 30, 60]);
  });

  it("stops the still survey once the guide holds a card", async () => {
    expect(await surveyedFrames(createBank({ "k-a": 0.1 }), 61)).toEqual([0]);
  });

  async function stillAfter(offsetAt: (frame: number) => number): Promise<boolean[]> {
    const session = sweepSession(() => []);
    const still: boolean[] = [];
    for (let frame = 0; frame < 30 * (SWEEP_OPTIONS.stillSeconds + 0.5); frame++) {
      const outcome = await session.processFrame(
        tableSeenFrom(offsetAt(frame), []),
        frame,
        frame / 30,
        frozenClock,
      );
      still.push(outcome.still);
    }
    return still;
  }

  it("reads a camera on a stand as still once it has not moved for a while", async () => {
    const still = await stillAfter(() => 0);
    expect(still.at(10)).toBe(false);
    expect(still.at(-1)).toBe(true);
  });

  it("never reads a hand-held camera as still", async () => {
    const still = await stillAfter((frame) => (frame % 2) * 2);
    expect(still).not.toContain(true);
  });

  it("keeps scanning single cards while one card fills the guide", async () => {
    const aimed = outline(boxQuad(10, 10, 364, 508));
    const session = sweepSession(() => [aimed]);
    for (let frame = 0; frame < 8; frame++) {
      const outcome = await session.processFrame(
        tableSeenFrom(frame * 6, []),
        frame,
        frame / 30,
        frozenClock,
      );
      expect(outcome.sweeping).toBe(false);
    }
  });

  it("returns to single cards once nothing is left in view", async () => {
    let offset = 0;
    let cards = true;
    const session = sweepSession(() =>
      cards ? [outlineAt(20 - offset), outlineAt(220 - offset)] : [],
    );
    let last = false;
    for (let frame = 0; frame < 8; frame++) {
      offset = frame * 6;
      const outcome = await session.processFrame(
        tableSeenFrom(offset, []),
        frame,
        frame / 30,
        frozenClock,
      );
      last = outcome.sweeping;
    }
    expect(last).toBe(true);
    cards = false;
    for (let frame = 8; frame <= 8 + SWEEP_OPTIONS.exitFrames; frame++) {
      const outcome = await session.processFrame(
        tableSeenFrom(0, []),
        frame,
        frame / 30,
        frozenClock,
      );
      last = outcome.sweeping;
    }
    expect(last).toBe(false);
  });

  // Corners in the card's own order: rotating clockwise puts its top-left at the frame's top-right.
  const sidewaysOutline = (sideways: RgbaImage) =>
    outline([
      { x: sideways.width - 12, y: 12 },
      { x: sideways.width - 12, y: sideways.height - 12 },
      { x: 12, y: sideways.height - 12 },
      { x: 12, y: 12 },
    ]);

  it("reads a landscape card the guide detector misses from the board detector's outline", async () => {
    const sideways = rotateRgbaCw(cardTexture(1));
    const outlined = sidewaysOutline(sideways);
    const session = createScanSession(
      testDeps({
        detectCard: () => Promise.resolve([]),
        detectBoard: () => Promise.resolve([outlined]),
      }),
      testOptions({ sweep: true }),
    );
    const outcome = await session.processFrame(sideways, 0, 0, frozenClock);
    expect(outcome.candidate?.score).toBe(1);
    expect(outcome.winner?.key).toBe("k-a");
  });

  it("keeps a counted card's lock when a sweep comes back to it", async () => {
    const lefts = [40, 240];
    let offset = 0;
    let inView = lefts;
    const session = sweepSession(() => inView.map((left) => outlineAt(left - offset)));
    let frame = 0;
    let locks = 0;
    const run = async (frames: number) => {
      const visible = lefts.map((left) => left - offset);
      for (const end = frame + frames; frame < end; frame++) {
        const outcome = await session.processFrame(
          tableSeenFrom(offset, visible),
          frame,
          frame / 30,
          frozenClock,
        );
        locks += outcome.locked ? 1 : 0;
      }
    };
    for (let step = 0; step < EVERY; step++) {
      offset = step * 4;
      await run(1);
    }
    await run(8);
    const counted = [...session.state.values()].map((track) => ({
      track,
      lockedFrame: track.lockedFrame,
    }));
    inView = [];
    await run(SWEEP_OPTIONS.exitFrames - 1);
    inView = [40];
    await run(8);

    expect(counted).toHaveLength(2);
    expect(locks).toBe(2);
    for (const { track, lockedFrame } of counted) {
      expect(track.lockedFrame).toBe(lockedFrame);
    }
  });

  it("counts a second copy in a sweep but not the card just aimed at", async () => {
    let offset = 0;
    let sweepingTable = false;
    const session = createScanSession(
      testDeps({
        detectCard: () => Promise.resolve(sweepingTable ? [] : [outlineAt(132)]),
        detectBoard: () =>
          Promise.resolve(sweepingTable ? [outlineAt(132 - offset), outlineAt(300 - offset)] : []),
      }),
      testOptions({ sweep: true }),
    );
    let locks = 0;
    for (let frame = 0; frame < 4; frame++) {
      const outcome = await session.processFrame(
        tableSeenFrom(0, [132]),
        frame,
        frame / 30,
        frozenClock,
      );
      locks += outcome.locked ? 1 : 0;
    }
    expect(locks).toBe(1);
    sweepingTable = true;
    for (let frame = 4; frame < 24; frame++) {
      offset = (frame - 4) * 3;
      const outcome = await session.processFrame(
        tableSeenFrom(offset, [132 - offset, 300 - offset]),
        frame,
        frame / 30,
        frozenClock,
      );
      locks += outcome.locked ? 1 : 0;
    }
    expect(locks).toBe(2);
  });

  it("drops an aimed lock of a card a sweep just counted until its cross-path window passes", async () => {
    const lefts = [40, 240];
    let offset = 0;
    let phase: "sweep" | "leave" | "aim" = "sweep";
    const session = createScanSession(
      testDeps({
        detectCard: () => Promise.resolve(phase === "aim" ? [outlineAt(132)] : []),
        detectBoard: () =>
          Promise.resolve(phase === "sweep" ? lefts.map((left) => outlineAt(left - offset)) : []),
      }),
      testOptions({ sweep: true }),
    );
    const frameFor = () =>
      phase === "aim"
        ? tableSeenFrom(0, [132])
        : tableSeenFrom(offset, phase === "sweep" ? lefts.map((left) => left - offset) : []);
    const play = async (frames: number[], seconds: (frame: number) => number) => {
      const outcomes = [];
      for (const frame of frames) {
        outcomes.push(await session.processFrame(frameFor(), frame, seconds(frame), frozenClock));
      }
      return outcomes;
    };
    const range = (from: number, count: number) =>
      Array.from({ length: count }, (_, i) => from + i);
    const live = (frame: number) => frame / 30;

    const swept = [];
    for (let step = 0; step < EVERY; step++) {
      offset = step * 4;
      swept.push(...(await play([step], live)));
    }
    swept.push(...(await play(range(EVERY, 8), live)));
    phase = "leave";
    const left = await play(range(EVERY + 8, SWEEP_OPTIONS.exitFrames + 1), live);
    phase = "aim";
    const inWindow = await play(range(100, 4), live);
    const later = (frame: number) => live(frame) + SWEEP_OPTIONS.crossPathSeconds;
    const afterWindow = await play(range(200, 4), later);

    expect(swept.some((outcome) => outcome.locked?.artKey === "k-a")).toBe(true);
    expect(left.at(-1)?.sweeping).toBe(false);
    expect(inWindow.map((outcome) => outcome.winner?.key)).toEqual(["k-a", "k-a", "k-a", "k-a"]);
    expect(inWindow.some((outcome) => outcome.locked)).toBe(false);
    expect(afterWindow.some((outcome) => outcome.locked?.artKey === "k-a")).toBe(true);
  });

  it("spends no printing attempt of an aimed lock on a swept copy without a place", async () => {
    const edgeLefts = [60, 230];
    let offset = 0;
    let sweepingTable = false;
    const atTopEdge = (left: number) => outline(boxQuad(left, 0, 120, 168));
    const session = createScanSession(
      testDeps({
        detectCard: (input) =>
          Promise.resolve(
            sweepingTable ? [] : [outline(wholeFrameGuide()(input.width, input.height))],
          ),
        detectBoard: () =>
          Promise.resolve(sweepingTable ? edgeLefts.map((left) => atTopEdge(left - offset)) : []),
      }),
      testOptions({ sweep: true }),
    );
    const aimed = [];
    for (let frame = 0; frame < 2; frame++) {
      aimed.push(await session.processFrame(card, frame, frame / 30, frozenClock));
    }
    sweepingTable = true;
    const swept = [];
    for (let frame = 2; frame < 20; frame++) {
      offset = (frame - 2) * 3;
      const frameImage = tableSeenFrom(offset, []);
      for (const left of edgeLefts) {
        layCard(frameImage, card, { left: left - offset, top: 0, width: 120, height: 168 });
      }
      swept.push(await session.processFrame(frameImage, frame, frame / 30, frozenClock));
    }
    const sweptWins = swept.filter((outcome) => outcome.sweeping && outcome.winner?.key === "k-a");

    expect(aimed.at(-1)?.locked?.artKey).toBe("k-a");
    expect(sweptWins.length).toBeGreaterThan(0);
    expect(sweptWins.map((outcome) => outcome.printingTrack)).toEqual(
      sweptWins.map(() => undefined),
    );
    expect(sweptWins.some((outcome) => outcome.locked)).toBe(false);
  });

  it("keeps an earlier aimed lock intact while a re-aim falls in a sweep's cross-path window", async () => {
    const lefts = [40, 240];
    let offset = 0;
    let phase: "aim" | "sweep" | "leave" = "aim";
    const session = createScanSession(
      testDeps({
        detectCard: (input) =>
          Promise.resolve(
            phase === "aim" ? [outline(wholeFrameGuide()(input.width, input.height))] : [],
          ),
        detectBoard: () =>
          Promise.resolve(phase === "sweep" ? lefts.map((left) => outlineAt(left - offset)) : []),
      }),
      testOptions({ sweep: true }),
    );
    const frameFor = () =>
      phase === "aim"
        ? card
        : tableSeenFrom(offset, phase === "sweep" ? lefts.map((left) => left - offset) : []);
    const play = async (frames: number[], seconds: (frame: number) => number) => {
      const outcomes = [];
      for (const frame of frames) {
        outcomes.push(await session.processFrame(frameFor(), frame, seconds(frame), frozenClock));
      }
      return outcomes;
    };
    const range = (from: number, count: number) =>
      Array.from({ length: count }, (_, i) => from + i);
    const live = (frame: number) => frame / 30;

    const firstFrames = await play(range(0, 2), live);
    const firstLock = firstFrames.at(-1)?.locked?.lockedFrame;
    phase = "sweep";
    const swept = [];
    for (let step = 0; step < EVERY; step++) {
      offset = step * 4;
      swept.push(...(await play([10 + step], live)));
    }
    swept.push(...(await play(range(10 + EVERY, 8), live)));
    phase = "leave";
    await play(range(30, SWEEP_OPTIONS.exitFrames + 1), live);
    phase = "aim";
    const inWindow = await play(range(100, 4), live);
    const pastWindow = (frame: number) => live(frame) + SWEEP_OPTIONS.crossPathSeconds;
    const heldPastWindow = await play(range(104, 4), pastWindow);
    const reaimed = [...inWindow, ...heldPastWindow];

    expect(firstLock).toBe(1);
    expect(swept.some((outcome) => outcome.locked?.artKey === "k-a")).toBe(true);
    expect(reaimed.map((outcome) => outcome.winner?.key)).toEqual(reaimed.map(() => "k-a"));
    expect(reaimed.some((outcome) => outcome.locked)).toBe(false);
    expect(reaimed.map((outcome) => outcome.printingTrack)).toEqual(reaimed.map(() => undefined));
    expect(session.state.get("k-a")).toMatchObject({ lockedFrame: 1, lockedThisRun: false });
  });

  it("reads a landscape card that appears during the backoff once it ends", async () => {
    const sideways = rotateRgbaCw(cardTexture(1));
    const reads: number[] = [];
    let frame = 0;
    const session = createScanSession(
      testDeps({
        detectCard: () => Promise.resolve([]),
        detectBoard: () => {
          reads.push(frame);
          return Promise.resolve(frame === 0 ? [] : [sidewaysOutline(sideways)]);
        },
      }),
      testOptions({ sweep: true }),
    );
    const backoff = SWEEP_OPTIONS.emptyGuideBackoffFrames;
    const outcomes = [];
    for (frame = 0; frame <= backoff + 1; frame++) {
      outcomes.push(await session.processFrame(sideways, frame, frame / 30, frozenClock));
    }

    expect(reads).toEqual([0, backoff + 1]);
    expect(outcomes.at(-1)?.candidate?.score).toBe(1);
    expect(outcomes.at(-1)?.winner?.key).toBe("k-a");
  });
});
