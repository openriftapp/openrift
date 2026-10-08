import { describe, expect, it } from "vitest";

import {
  SWEEP_OPTIONS,
  createSweepTracker,
  emptyGuideOutlines,
  isAimedCard,
  sweepView,
} from "./sweep";
import { blankFrame, boxQuad, outline } from "./test-images";
import type { CardCandidate, Quad } from "./types";

describe("isAimedCard", () => {
  const GUIDE_AREA = 100 * 140;

  it("counts an outline from the aimed share of the guide's area up as aimed", () => {
    const side = Math.sqrt(GUIDE_AREA * SWEEP_OPTIONS.aimedShare);
    expect(isAimedCard(boxQuad(0, 0, side, side), GUIDE_AREA)).toBe(true);
    expect(isAimedCard(boxQuad(0, 0, side - 1, side - 1), GUIDE_AREA)).toBe(false);
  });

  it("takes a different share when given one", () => {
    expect(isAimedCard(boxQuad(0, 0, 50, 140), GUIDE_AREA, 0.5)).toBe(true);
    expect(isAimedCard(boxQuad(0, 0, 50, 140), GUIDE_AREA)).toBe(false);
  });
});

describe("sweepView", () => {
  const guide = boxQuad(0, 0, 100, 140);
  const card = (width: number, height: number, score = 1) =>
    outline(boxQuad(0, 0, width, height), score);

  it("counts cards smaller than an aimed card and flags one that fills the guide", () => {
    expect(sweepView([card(30, 42), card(30, 42), card(90, 126)], guide)).toEqual({
      cards: 2,
      aimed: true,
    });
  });

  it("ignores weak outlines", () => {
    expect(sweepView([card(30, 42, 0.2)], guide)).toEqual({ cards: 0, aimed: false });
  });
});

describe("emptyGuideOutlines", () => {
  const FRAME = { width: 300, height: 200 };
  const guide = boxQuad(100, 0, 100, 140);
  const box = (left: number, top: number, width: number, height: number, score = 1) =>
    outline(boxQuad(left, top, width, height), score);

  it("keeps a landscape card centred in the guide", () => {
    const landscape = box(80, 30, 140, 100);
    expect(emptyGuideOutlines([landscape], guide, 0.3, FRAME)).toEqual([landscape]);
  });

  it("drops cards beside the guide, small cards and weak outlines", () => {
    expect(
      emptyGuideOutlines(
        [box(220, 30, 140, 100), box(140, 60, 20, 20), box(80, 30, 140, 100, 0.2)],
        guide,
        0.3,
        FRAME,
      ),
    ).toEqual([]);
  });

  it("drops a card cut off by the frame edge", () => {
    expect(emptyGuideOutlines([box(80, 0, 140, 100)], guide, 0.3, FRAME)).toEqual([]);
  });

  it("leaves a lone upright card to the guide detector", () => {
    expect(emptyGuideOutlines([box(105, 5, 90, 130)], guide, 0.3, FRAME)).toEqual([]);
  });

  it("tries an upright card while others are in view", () => {
    const upright = box(110, 20, 80, 110);
    expect(emptyGuideOutlines([upright, box(10, 20, 80, 110)], guide, 0.3, FRAME)).toEqual([
      upright,
    ]);
  });

  it("tries the largest card first", () => {
    const small = box(110, 30, 80, 100);
    const large = box(80, 20, 140, 110);
    expect(emptyGuideOutlines([small, large], guide, 0.3, FRAME)).toEqual([large, small]);
  });
});

describe("createSweepTracker — empty guide", () => {
  const frame = blankFrame(300, 200);
  const guide: Quad = boxQuad(100, 0, 100, 140);
  const landscape = outline(boxQuad(80, 30, 140, 100));

  function trackerReading(found: () => CardCandidate[]) {
    const reads: number[] = [];
    let index = 0;
    const tracker = createSweepTracker(() => {
      reads.push(index);
      return Promise.resolve(found());
    });
    const next = async (surveyed: CardCandidate[] | null = null) => {
      const outlines = await tracker.emptyGuide(frame, guide, surveyed);
      index++;
      return outlines;
    };
    return { reads, next };
  }

  it("skips the board detector for N frames after an empty read", async () => {
    const backoff = SWEEP_OPTIONS.emptyGuideBackoffFrames;
    const { reads, next } = trackerReading(() => []);
    for (let frameIndex = 0; frameIndex < backoff + 3; frameIndex++) {
      await next();
    }
    expect(reads).toEqual([0, backoff + 1]);
  });

  it("reads again on every frame while the board detector finds a card", async () => {
    const { reads, next } = trackerReading(() => [landscape]);
    for (let frameIndex = 0; frameIndex < 3; frameIndex++) {
      expect(await next()).toEqual([landscape]);
    }
    expect(reads).toEqual([0, 1, 2]);
  });

  it("tries a survey's outlines during the backoff without reading again", async () => {
    const { reads, next } = trackerReading(() => []);
    await next();
    expect(await next([landscape])).toEqual([landscape]);
    expect(reads).toEqual([0]);
  });
});

describe("createSweepTracker — ending a sweep", () => {
  const frame = blankFrame(300, 200);
  const guide: Quad = boxQuad(100, 0, 100, 140);
  const several = [outline(boxQuad(100, 10, 30, 42)), outline(boxQuad(150, 10, 30, 42))];
  const FPS = 20;

  async function secondsUntilSweepEnds(motionWhileHeld: number): Promise<number | null> {
    const tracker = createSweepTracker(() => Promise.resolve(several));
    let frameIndex = 0;
    for (; !tracker.active && frameIndex < FPS; frameIndex++) {
      tracker.noteMotion(0.02, false, frameIndex / FPS);
      await tracker.survey(frame, guide, frameIndex / FPS, false);
    }
    expect(tracker.active).toBe(true);
    for (let held = 0; held < 3 * FPS; held++, frameIndex++) {
      tracker.noteMotion(motionWhileHeld, false, frameIndex / FPS);
      if (tracker.endsSweep(several, guide)) {
        return held / FPS;
      }
    }
    return null;
  }

  it("ends within about a second once the camera is held still over several cards", async () => {
    const endedAfter = await secondsUntilSweepEnds(0.001);
    expect(endedAfter).not.toBeNull();
    expect(endedAfter).toBeLessThanOrEqual(SWEEP_OPTIONS.settleSeconds + 0.1);
  });

  it("keeps sweeping while the camera pans slowly over several cards", async () => {
    expect(await secondsUntilSweepEnds(0.004)).toBeNull();
  });

  it("still surveys but never starts a sweep when told not to enter one", async () => {
    const tracker = createSweepTracker(() => Promise.resolve(several), false);
    for (let frameIndex = 0; frameIndex < FPS; frameIndex++) {
      tracker.noteMotion(0.02, false, frameIndex / FPS);
      const survey = await tracker.survey(frame, guide, frameIndex / FPS, false);
      expect(survey?.started ?? false).toBe(false);
    }
    expect(tracker.active).toBe(false);
  });
});

describe("createSweepTracker — survey cadence", () => {
  const frame = blankFrame(300, 200);
  const guide: Quad = boxQuad(100, 0, 100, 140);
  const FPS = 30;

  async function surveyedFrames(
    frames: number,
    motion: number,
    cardInGuide: (frameIndex: number) => boolean = () => false,
  ): Promise<number[]> {
    const tracker = createSweepTracker(() => Promise.resolve([]));
    const surveyed: number[] = [];
    for (let frameIndex = 0; frameIndex < frames; frameIndex++) {
      const seconds = frameIndex / FPS;
      tracker.noteMotion(motion, false, seconds);
      if (await tracker.survey(frame, guide, seconds, cardInGuide(frameIndex))) {
        surveyed.push(frameIndex);
      }
    }
    return surveyed;
  }

  it("surveys once per second while the camera is still", async () => {
    expect(await surveyedFrames(2 * FPS + 1, 0)).toEqual([0, FPS, 2 * FPS]);
  });

  it("does not survey on frames between surveys", async () => {
    expect(await surveyedFrames(FPS, 0)).toEqual([0]);
  });

  it("skips the still survey while a card is in the guide", async () => {
    expect(await surveyedFrames(2 * FPS, 0, () => true)).toEqual([]);
  });

  it("keeps surveying every few frames while the camera moves, card in the guide or not", async () => {
    const every = SWEEP_OPTIONS.surveyEveryFrames;
    const moving = [every - 1, 2 * every - 1, 3 * every - 1];
    expect(await surveyedFrames(3 * every, 0.01, () => true)).toEqual(moving);
    expect(await surveyedFrames(3 * every, 0.01)).toEqual([0, ...moving]);
  });

  it("counts a moving survey toward the still interval", async () => {
    const every = SWEEP_OPTIONS.surveyEveryFrames;
    const tracker = createSweepTracker(() => Promise.resolve([]));
    const surveyed: number[] = [];
    for (let frameIndex = 0; frameIndex < FPS + every; frameIndex++) {
      const seconds = frameIndex / FPS;
      const moving = frameIndex < every;
      tracker.noteMotion(moving ? 0.01 : 0, false, seconds);
      if (await tracker.survey(frame, guide, seconds, moving)) {
        surveyed.push(frameIndex);
      }
    }
    expect(surveyed).toEqual([every - 1, every - 1 + FPS]);
  });
});
