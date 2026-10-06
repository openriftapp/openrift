/** Switches a guide session into reading every card in view while the camera sweeps over several. */
import type { AcceptOptions } from "./accept";
import { boundingBox, quadArea, quadCenter, touchesFrameEdge } from "./geometry";
import type { CardCandidate, Quad, RgbaImage } from "./types";

export interface SweepOptions {
  /** Processed frames. */
  surveyEveryFrames: number;
  /** Seconds. */
  surveyStillSeconds: number;
  minCards: number;
  /** Share of the guide's area. */
  aimedShare: number;
  /** Frame widths per processed frame. */
  minMotion: number;
  enterSurveys: number;
  /** Processed frames. */
  exitFrames: number;
  /** Seconds. */
  crossPathSeconds: number;
  /** Share of the guide's area. */
  emptyGuideShare: number;
  /** Processed frames. */
  emptyGuideBackoffFrames: number;
  /** Seconds. */
  stillSeconds: number;
  /** Frame widths per processed frame. */
  stillMotion: number;
  /** Seconds. */
  settleSeconds: number;
  /** Frame widths per second. */
  settleMotion: number;
  accept: AcceptOptions;
}

export const SWEEP_OPTIONS: SweepOptions = {
  surveyEveryFrames: 5,
  surveyStillSeconds: 1,
  minCards: 2,
  aimedShare: 0.75,
  minMotion: 0.004,
  enterSurveys: 1,
  exitFrames: 15,
  crossPathSeconds: 20,
  emptyGuideShare: 0.3,
  emptyGuideBackoffFrames: 7,
  stillSeconds: 3,
  stillMotion: 0.00025,
  settleSeconds: 1,
  settleMotion: 0.06,
  accept: { lockRun: 4, maxGapFrames: 6 },
};

export const SWEEP_MIN_SCORE = 0.5;
const STILL_EXIT_FACTOR = 8;
const STILL_WINDOW_MIN_SHARE = 0.8;
const MAX_EMPTY_GUIDE_OUTLINES = 2;
/** Share of the frame width. */
export const FRAME_EDGE_MARGIN = 0.02;

export function isAimedCard(
  quad: Quad,
  guideArea: number,
  aimedShare = SWEEP_OPTIONS.aimedShare,
): boolean {
  return quadArea(quad) >= guideArea * aimedShare;
}

export function sweepView(
  outlines: readonly CardCandidate[],
  guide: Quad,
  aimedShare = SWEEP_OPTIONS.aimedShare,
): { cards: number; aimed: boolean } {
  const guideArea = quadArea(guide);
  let cards = 0;
  let aimed = false;
  for (const outline of outlines) {
    if (outline.score < SWEEP_MIN_SCORE) {
      continue;
    }
    if (isAimedCard(outline.quad, guideArea, aimedShare)) {
      aimed = true;
    } else {
      cards++;
    }
  }
  return { cards, aimed };
}

export function emptyGuideOutlines(
  outlines: readonly CardCandidate[],
  guide: Quad,
  minShare: number,
  frame: { width: number; height: number },
): CardCandidate[] {
  const box = boundingBox(guide);
  const minArea = quadArea(guide) * minShare;
  const several = outlines.filter((outline) => outline.score >= SWEEP_MIN_SCORE).length > 1;
  return outlines
    .filter((outline) => {
      if (outline.score < SWEEP_MIN_SCORE || quadArea(outline.quad) < minArea) {
        return false;
      }
      const cut = touchesFrameEdge(
        outline.quad,
        frame.width,
        frame.height,
        frame.width * FRAME_EDGE_MARGIN,
      );
      const bounds = boundingBox(outline.quad);
      const upright = bounds.maxY - bounds.minY >= bounds.maxX - bounds.minX;
      if (cut || (upright && !several)) {
        return false;
      }
      const center = quadCenter(outline.quad);
      return (
        center.x >= box.minX && center.x <= box.maxX && center.y >= box.minY && center.y <= box.maxY
      );
    })
    .toSorted((a, b) => quadArea(b.quad) - quadArea(a.quad))
    .slice(0, MAX_EMPTY_GUIDE_OUTLINES);
}

export interface SweepSurvey {
  outlines: CardCandidate[];
  started: boolean;
}

interface SweepTracker {
  readonly active: boolean;
  noteMotion: (motion: number, lost: boolean, seconds: number) => boolean;
  survey: (
    frame: RgbaImage,
    guide: Quad,
    seconds: number,
    cardInGuide: boolean,
  ) => Promise<SweepSurvey | null>;
  endsSweep: (outlines: readonly CardCandidate[], guide: Quad) => boolean;
  emptyGuide: (
    frame: RgbaImage,
    guide: Quad,
    surveyed: readonly CardCandidate[] | null,
  ) => Promise<CardCandidate[]>;
}

export function createSweepTracker(
  detectBoard?: (frame: RgbaImage) => Promise<CardCandidate[]>,
): SweepTracker {
  let active = false;
  let surveyStreak = 0;
  let exitStreak = 0;
  let motionSinceSurvey = 0;
  let framesSinceSurvey = 0;
  let emptyGuideSkips = 0;
  let lastSurveyAt = Number.NEGATIVE_INFINITY;
  let still = false;
  let settled = false;
  const recentMotion: { seconds: number; motion: number; rate: number }[] = [];

  function cameraStill(seconds: number): boolean {
    const first = recentMotion[0];
    if (!first || seconds - first.seconds < SWEEP_OPTIONS.stillSeconds * STILL_WINDOW_MIN_SHARE) {
      return false;
    }
    const sorted = recentMotion.map((entry) => entry.motion).toSorted((a, b) => a - b);
    // A card dropping into view must not count as camera motion.
    const median = sorted[Math.floor(sorted.length / 2)] ?? 1;
    return median < SWEEP_OPTIONS.stillMotion * (still ? STILL_EXIT_FACTOR : 1);
  }

  function cameraSettled(seconds: number): boolean {
    const since = seconds - SWEEP_OPTIONS.settleSeconds;
    const window = recentMotion.filter((entry) => entry.seconds >= since);
    const first = window[0];
    if (!first || seconds - first.seconds < SWEEP_OPTIONS.settleSeconds * STILL_WINDOW_MIN_SHARE) {
      return false;
    }
    const rates = window.map((entry) => entry.rate).toSorted((a, b) => a - b);
    return (rates[Math.floor(rates.length / 2)] ?? Infinity) < SWEEP_OPTIONS.settleMotion;
  }

  return {
    get active() {
      return active;
    },

    noteMotion(motion, lost, seconds) {
      motionSinceSurvey += motion;
      const previous = recentMotion.at(-1);
      const elapsed = previous ? seconds - previous.seconds : 0;
      const rate = lost ? Infinity : elapsed > 0 ? motion / elapsed : Infinity;
      recentMotion.push({ seconds, motion: lost ? 1 : motion, rate });
      while ((recentMotion[0]?.seconds ?? seconds) < seconds - SWEEP_OPTIONS.stillSeconds) {
        recentMotion.shift();
      }
      still = cameraStill(seconds);
      settled = cameraSettled(seconds);
      return still;
    },

    async survey(frame, guide, seconds, cardInGuide) {
      if (!detectBoard) {
        return null;
      }
      framesSinceSurvey++;
      let moving = false;
      if (framesSinceSurvey >= SWEEP_OPTIONS.surveyEveryFrames) {
        moving = motionSinceSurvey / framesSinceSurvey >= SWEEP_OPTIONS.minMotion;
        motionSinceSurvey = 0;
        framesSinceSurvey = 0;
        if (!moving) {
          surveyStreak = 0;
        }
      }
      if (!moving && (cardInGuide || seconds - lastSurveyAt < SWEEP_OPTIONS.surveyStillSeconds)) {
        return null;
      }
      lastSurveyAt = seconds;
      const outlines = await detectBoard(frame);
      if (!moving) {
        return { outlines, started: false };
      }
      const view = sweepView(outlines, guide, SWEEP_OPTIONS.aimedShare);
      surveyStreak = view.cards >= SWEEP_OPTIONS.minCards ? surveyStreak + 1 : 0;
      if (surveyStreak < SWEEP_OPTIONS.enterSurveys) {
        return { outlines, started: false };
      }
      active = true;
      surveyStreak = 0;
      exitStreak = 0;
      return { outlines, started: true };
    },

    endsSweep(outlines, guide) {
      const view = sweepView(outlines, guide, SWEEP_OPTIONS.aimedShare);
      const several = view.cards >= SWEEP_OPTIONS.minCards || (view.cards > 0 && !view.aimed);
      exitStreak = several ? 0 : exitStreak + 1;
      if (exitStreak < SWEEP_OPTIONS.exitFrames && !settled) {
        return false;
      }
      active = false;
      exitStreak = 0;
      motionSinceSurvey = 0;
      framesSinceSurvey = 0;
      return true;
    },

    async emptyGuide(frame, guide, surveyed) {
      if (!detectBoard) {
        return [];
      }
      if (!surveyed && emptyGuideSkips > 0) {
        emptyGuideSkips--;
        return [];
      }
      const board = emptyGuideOutlines(
        surveyed ?? (await detectBoard(frame)),
        guide,
        SWEEP_OPTIONS.emptyGuideShare,
        frame,
      );
      emptyGuideSkips = board.length === 0 ? SWEEP_OPTIONS.emptyGuideBackoffFrames : 0;
      return board;
    },
  };
}
