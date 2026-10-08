/**
 * The live scanning pipeline: detect cards, rectify the best candidates, rank
 * the catalogue by embedding, check the shortlist by aligned correlation, and
 * lock a card after a run of agreeing frames.
 */
import type { AcceptOptions, AcceptState, ArtTrack, FrameWinner } from "./accept";
import {
  DEFAULT_ALIGNED_OPTIONS,
  alignedFrameWeight,
  continuesRun,
  observeWinner,
  pickAlignedWinner,
  rearmLockedTracks,
} from "./accept";
import { createAlignedVerifier } from "./aligned-verify";
import type { PrintingScore } from "./disambiguate";
import { snapQuadToEdges } from "./edge-snap";
import type { CardEmbedder, RankedEmbed } from "./embed";
import { EMBED_IMAGE_SIZE, rankCardEmbedding } from "./embed";
import { createShiftTracker, framePyramid, trackShift } from "./frame-shift";
import { candidateFromQuad, quadIou } from "./geometry";
import { focusScore, toGray } from "./image";
import type { PrintingLockDeps, PrintingReadout } from "./printing-lock";
import { createPrintingLock } from "./printing-lock";
import type { ScanSessionOptions } from "./session-options";
import {
  DEFAULT_SESSION_OPTIONS,
  IDLE_AFTER_NO_WINNER_FRAMES,
  MIN_FOCUS,
  ROTATION_MIN_FOCUS,
  SESSION_UNWARP_HEIGHT,
  SESSION_UNWARP_WIDTH,
  SWEEP_TOP_K,
  centeredGuideQuad,
} from "./session-options";
import type { SweepSurvey } from "./sweep";
import { SWEEP_OPTIONS, createSweepTracker } from "./sweep";
import {
  countedQuads,
  createTablePlaces,
  onCountedPlace,
  placeFor,
  shiftTable,
} from "./table-places";
import type { CardCandidate, Quad, RgbaImage } from "./types";
import { unwarpCard } from "./unwarp";

export interface ScanSessionDeps extends PrintingLockDeps {
  embedder: CardEmbedder;
  detectCard?: (frame: RgbaImage) => Promise<CardCandidate[]>;
  detectBoard?: (frame: RgbaImage) => Promise<CardCandidate[]>;
  embedImageSize?: number;
}

export interface FrameOutcome {
  candidate: CardCandidate | null;
  ranked: RankedEmbed[];
  winner: FrameWinner | null;
  refused: boolean;
  /** Percent. */
  bestScore: number;
  locked: ArtTrack | null;
  winnerRun: { length: number; weight: number } | null;
  printingScores?: PrintingScore[];
  printingMargin?: number;
  printingVia?: PrintingReadout["via"];
  printingTrack?: {
    artKey: string;
    key: string;
    label: string;
    resolved: boolean;
    lockedFrame?: number;
  };
  aligned?: { key: string; score: number }[];
  focus: number;
  sweeping: boolean;
  still: boolean;
  survey?: CardCandidate[];
  /** Every card counted so far that lies in this frame. */
  counted: Quad[];
  /** Milliseconds; `crop` is the part of `embed` spent cutting out and focus-checking crops. */
  timings: {
    detect: number;
    embed: number;
    verify: number;
    total: number;
    crop: number;
    printing?: number;
  };
}

export interface ScanSession {
  processFrame: (
    frame: RgbaImage,
    frameIndex: number,
    seconds: number,
    now?: () => number,
  ) => Promise<FrameOutcome>;
  state: AcceptState;
  /** Lets every locked track lock again once the placement detector reports a new card in the guide. */
  rearm: () => void;
  /** Counts the cards a board read found in `still`, so they stay marked as the camera moves. */
  noteBoard: (
    cards: readonly { artKey: string; quad: Quad }[],
    still: { width: number; height: number },
  ) => void;
}

const EMPTY_OUTCOME = {
  candidate: null,
  ranked: [] as RankedEmbed[],
  winner: null,
  refused: false,
  locked: null,
  winnerRun: null,
  focus: 0,
  bestScore: 0,
};

const TRACK_IOU = 0.4;
const ABSENT_FRAMES_TO_REARM = 2;

interface BestCrop {
  candidate: CardCandidate;
  ranked: RankedEmbed[];
  top: RankedEmbed;
  card: RgbaImage;
  focus: number;
}

export function prioritizeTracked(
  candidates: readonly CardCandidate[],
  anchor: Quad | null,
): CardCandidate[] {
  if (!anchor) {
    return [...candidates];
  }
  const overlap = (candidate: CardCandidate): number => {
    const iou = quadIou(candidate.quad, anchor);
    return iou >= TRACK_IOU ? iou : 0;
  };
  return candidates.toSorted((a, b) => overlap(b) - overlap(a));
}

export function createScanSession(
  deps: ScanSessionDeps,
  options: Partial<ScanSessionOptions> = {},
): ScanSession {
  const opts = { ...DEFAULT_SESSION_OPTIONS, ...options };
  const state: AcceptState = new Map();
  const embedImageSize = deps.embedImageSize ?? EMBED_IMAGE_SIZE;
  const embedInput = new Float32Array(4 * 3 * embedImageSize * embedImageSize);
  const verify = createAlignedVerifier(deps.fetchReference);
  const printingLock = createPrintingLock(deps);
  const sweep = opts.sweep ? createSweepTracker(deps.detectBoard, opts.enterSweeps) : null;
  const tablePlaces = createTablePlaces();
  const countedPlaces = new Set<string>();
  const shiftTracker = createShiftTracker();
  const sweepLocks = new Map<string, number>();
  let lastWinnerQuad: Quad | null = null;
  let lastWinnerRotation = 0;
  let noWinnerStreak = 0;
  let absentStreak = 0;
  let cardInGuide = false;
  let lastFrame: { width: number; height: number } | null = null;

  function resetAim(): void {
    lastWinnerQuad = null;
    noWinnerStreak = 0;
  }

  function acceptOptions(sweeping: boolean): AcceptOptions {
    return sweeping ? SWEEP_OPTIONS.accept : opts.accept;
  }

  function frameWeightFor(winner: FrameWinner, sweeping: boolean): number {
    return acceptOptions(sweeping).weighted
      ? alignedFrameWeight(winner, DEFAULT_ALIGNED_OPTIONS)
      : 1;
  }

  function snap(frame: RgbaImage, found: CardCandidate[]): CardCandidate[] {
    if (found.length === 0) {
      return found;
    }
    const gray = toGray(frame);
    return found.map((candidate) => ({
      ...candidate,
      quad: snapQuadToEdges(gray, candidate.quad),
    }));
  }

  function trackCamera(frame: RgbaImage, seconds: number): boolean {
    if (!sweep) {
      return false;
    }
    const step = trackShift(shiftTracker, framePyramid(frame));
    shiftTable(tablePlaces, step);
    return sweep.noteMotion(Math.hypot(step.x, step.y) / frame.width, shiftTracker.lost, seconds);
  }

  async function findCards(
    frame: RgbaImage,
    guide: Quad,
    sweeping: boolean,
    survey: SweepSurvey | null,
  ): Promise<{ learned: CardCandidate[]; candidates: CardCandidate[]; guideEmpty: boolean }> {
    if (sweeping) {
      let found = survey?.started ? survey.outlines : null;
      if (!found) {
        found = deps.detectBoard ? await deps.detectBoard(frame) : [];
        if (sweep?.endsSweep(found, guide)) {
          resetAim();
        }
      }
      return { learned: [], candidates: snap(frame, found), guideEmpty: false };
    }
    const learned = deps.detectCard ? snap(frame, await deps.detectCard(frame)) : [];
    if (learned.length > 0) {
      return { learned, candidates: [], guideEmpty: false };
    }
    const board = sweep ? await sweep.emptyGuide(frame, guide, survey?.outlines ?? null) : [];
    return {
      learned: snap(frame, board),
      candidates: [candidateFromQuad(guide, frame.width, frame.height, 0)],
      guideEmpty: true,
    };
  }

  function uncountedFirst(ordered: CardCandidate[], sweeping: boolean): CardCandidate[] {
    if (!sweeping || countedPlaces.size === 0) {
      return ordered;
    }
    return ordered.toSorted(
      (a, b) =>
        Number(onCountedPlace(tablePlaces, countedPlaces, a.quad)) -
        Number(onCountedPlace(tablePlaces, countedPlaces, b.quad)),
    );
  }

  async function bestCrop(
    frame: RgbaImage,
    candidates: readonly CardCandidate[],
    sweeping: boolean,
    idle: boolean,
    now: () => number,
  ): Promise<{ best: BestCrop | null; cropMs: number }> {
    let best: BestCrop | null = null;
    let cropMs = 0;
    for (const candidate of candidates) {
      const cropStartedAt = now();
      const card = unwarpCard(
        frame,
        candidate.quad,
        SESSION_UNWARP_WIDTH,
        SESSION_UNWARP_HEIGHT,
        0,
      );
      const focus = card ? focusScore(toGray(card)) : 0;
      cropMs += now() - cropStartedAt;
      if (!card || focus < MIN_FOCUS) {
        continue;
      }
      const ranked = await rankCardEmbedding(card, deps.embedder, deps.bank, {
        topK: sweeping ? SWEEP_TOP_K : opts.topK,
        confidentDistance: opts.confidentDistance,
        rotationFallbackDistance: opts.rotationFallbackDistance,
        allowRotationFallback: !idle && focus >= ROTATION_MIN_FOCUS,
        preferredRotation: lastWinnerRotation,
        scratch: embedInput,
        imageSize: embedImageSize,
        pairOnly: opts.rotationPairOnly,
      });
      const top = ranked[0];
      if (top && (!best || top.distance < best.top.distance)) {
        best = { candidate, ranked, top, card, focus };
      }
      const exitDistance = sweeping ? opts.confidentDistance : opts.rotationFallbackDistance;
      if (opts.confidentDistance >= 0 && best !== null && best.top.distance <= exitDistance) {
        break;
      }
    }
    return { best, cropMs };
  }

  function crossesSweptCard(artKey: string, frameIndex: number, seconds: number): boolean {
    const swept = sweepLocks.get(artKey);
    if (swept === undefined) {
      return false;
    }
    const track = state.get(artKey);
    const runStart =
      track && continuesRun(track, frameIndex, opts.accept) ? track.runStartSeconds : seconds;
    return runStart - swept <= SWEEP_OPTIONS.crossPathSeconds;
  }

  function noteLock(
    locked: ArtTrack,
    sweeping: boolean,
    quad: Quad,
    frame: RgbaImage,
    seconds: number,
  ): void {
    if (!sweep) {
      return;
    }
    if (sweeping) {
      sweepLocks.set(locked.artKey, seconds);
      return;
    }
    const aimedPlace = placeFor(tablePlaces, locked.artKey, quad, frame);
    if (aimedPlace) {
      countedPlaces.add(aimedPlace.key);
    }
  }

  function observeFrameWinner(
    winner: FrameWinner,
    best: BestCrop,
    frame: RgbaImage,
    frameIndex: number,
    seconds: number,
    sweeping: boolean,
  ): { locked: ArtTrack | null; stateKey: string | null } {
    const place = sweeping
      ? placeFor(tablePlaces, winner.artKey, best.candidate.quad, frame)
      : null;
    if (sweeping && place === null) {
      return { locked: null, stateKey: null };
    }
    const stateKey = place?.key ?? winner.artKey;
    const crossed = !sweeping && crossesSweptCard(winner.artKey, frameIndex, seconds);
    noWinnerStreak = 0;
    absentStreak = 0;
    lastWinnerQuad = best.candidate.quad;
    lastWinnerRotation =
      best.ranked.find((entry) => entry.key === winner.key)?.rotation ?? best.top.rotation;
    const counted = place !== null && countedPlaces.has(place.key) && state.has(place.key);
    const locked = observeWinner(
      state,
      frameIndex,
      seconds,
      winner,
      deps.labelOf(winner.key),
      acceptOptions(sweeping),
      { weight: frameWeightFor(winner, sweeping), stateKey, canLock: !counted && !crossed },
    );
    if (locked) {
      if (place) {
        countedPlaces.add(place.key);
      }
      noteLock(locked, sweeping, best.candidate.quad, frame, seconds);
      printingLock.restart(locked);
    }
    return { locked, stateKey: crossed ? null : stateKey };
  }

  async function settlePrinting(
    locked: ArtTrack | null,
    stateKey: string | null,
    card: RgbaImage,
  ): Promise<{ track: ArtTrack | null; readout?: PrintingReadout }> {
    let track = locked;
    if (!track && stateKey) {
      const candidate = state.get(stateKey);
      if (candidate && candidate.lockedAt !== null && !candidate.printingResolved) {
        track = candidate;
      }
    }
    if (!track || !printingLock.takeAttempt(track)) {
      return { track: null };
    }
    return { track, readout: await printingLock.disambiguate(track, card, lastWinnerRotation) };
  }

  function failureCouldChangeWinner(
    failed: readonly string[],
    winner: FrameWinner | null,
    ranked: readonly RankedEmbed[],
  ): boolean {
    if (failed.length === 0) {
      return false;
    }
    if (!winner) {
      return true;
    }
    const rankOf = (key: string) => ranked.findIndex((entry) => entry.key === key);
    const winnerRank = rankOf(winner.key);
    return failed.some((key) => deps.artKeyOf(key) !== winner.artKey && rankOf(key) < winnerRank);
  }

  function bestScoreOf(scores: readonly { score: number }[]): number {
    const best = Math.max(0, ...scores.map(({ score }) => (Number.isFinite(score) ? score : 0)));
    return Math.round(best * 100);
  }

  async function processFrame(
    frame: RgbaImage,
    frameIndex: number,
    seconds: number,
    now: () => number = () => Date.now(),
  ): Promise<FrameOutcome> {
    lastFrame = { width: frame.width, height: frame.height };
    const outcome = await processOnce(frame, frameIndex, seconds, now);
    return { ...outcome, counted: countedQuads(tablePlaces, countedPlaces, lastFrame) };
  }

  function noteBoard(
    cards: readonly { artKey: string; quad: Quad }[],
    still: { width: number; height: number },
  ): void {
    if (!lastFrame || still.width <= 0) {
      return;
    }
    const scale = lastFrame.width / still.width;
    for (const card of cards) {
      const [a, b, c, d] = card.quad;
      const quad: Quad = [
        { x: a.x * scale, y: a.y * scale },
        { x: b.x * scale, y: b.y * scale },
        { x: c.x * scale, y: c.y * scale },
        { x: d.x * scale, y: d.y * scale },
      ];
      const place = placeFor(tablePlaces, card.artKey, quad, lastFrame);
      if (place) {
        countedPlaces.add(place.key);
      }
    }
  }

  async function processOnce(
    frame: RgbaImage,
    frameIndex: number,
    seconds: number,
    now: () => number,
  ): Promise<Omit<FrameOutcome, "counted">> {
    const startedAt = now();
    const still = trackCamera(frame, seconds);
    const guide = centeredGuideQuad(frame.width, frame.height);
    const survey =
      sweep && !sweep.active ? await sweep.survey(frame, guide, seconds, cardInGuide) : null;
    if (survey?.started) {
      resetAim();
    }
    const surveyed = survey ? { survey: survey.outlines } : {};
    const sweeping = sweep?.active ?? false;
    const { learned, candidates, guideEmpty } = await findCards(frame, guide, sweeping, survey);
    const detectMs = now() - startedAt;

    const embedStartedAt = now();
    const idle = !sweeping && noWinnerStreak >= IDLE_AFTER_NO_WINNER_FRAMES;
    // Learned outlines go first, so the idle backoff's single try still uses them.
    const ordered = [
      ...learned,
      ...uncountedFirst(
        prioritizeTracked(candidates, lastWinnerQuad ?? (sweeping ? null : guide)),
        sweeping,
      ),
    ].slice(0, idle ? 1 : opts.candidatesToTry);
    const { best, cropMs } = await bestCrop(frame, ordered, sweeping, idle, now);
    cardInGuide = best !== null && best.top.distance <= opts.rotationFallbackDistance;
    const embedMs = now() - embedStartedAt;
    const timings = (verifyMs: number, printing?: number): FrameOutcome["timings"] => ({
      detect: detectMs,
      embed: embedMs,
      verify: verifyMs,
      total: now() - startedAt,
      crop: cropMs,
      ...(printing === undefined ? {} : { printing }),
    });

    // Must run before verification: a card whose first frame needs the
    // rotation search could otherwise never produce the winner that resets it.
    if (best !== null && best.top.distance <= opts.rotationFallbackDistance) {
      noWinnerStreak = 0;
      absentStreak = 0;
    } else if (guideEmpty) {
      // Junk frames mid-swap (a hand, a steep angle) may still yield
      // proposals, so they neither extend nor reset the streak.
      absentStreak++;
      if (absentStreak >= ABSENT_FRAMES_TO_REARM) {
        rearmLockedTracks(state);
      }
    }

    if (!best) {
      noWinnerStreak++;
      return { ...EMPTY_OUTCOME, ...surveyed, sweeping, still, timings: timings(0) };
    }

    const verifyStartedAt = now();
    const verification = await verify(best.card, best.ranked);
    const decision = pickAlignedWinner(verification.scores, deps.artKeyOf, DEFAULT_ALIGNED_OPTIONS);
    if (failureCouldChangeWinner(verification.failed, decision.winner, best.ranked)) {
      return {
        ...EMPTY_OUTCOME,
        ...surveyed,
        sweeping,
        still,
        candidate: best.candidate,
        ranked: best.ranked,
        focus: best.focus,
        timings: timings(now() - verifyStartedAt),
      };
    }

    cardInGuide ||= decision.winner !== null;
    if (!decision.winner && best.top.distance > opts.rotationFallbackDistance) {
      noWinnerStreak++;
    }
    const { locked, stateKey } = decision.winner
      ? observeFrameWinner(decision.winner, best, frame, frameIndex, seconds, sweeping)
      : { locked: null, stateKey: null };
    const verifyMs = now() - verifyStartedAt;

    const printingStartedAt = now();
    const printing = await settlePrinting(locked, stateKey, best.card);
    const printingMs = now() - printingStartedAt;
    const winnerTrack = stateKey ? state.get(stateKey) : undefined;

    return {
      candidate: best.candidate,
      ranked: best.ranked,
      winner: decision.winner,
      aligned: verification.scores,
      refused: decision.refused,
      bestScore: bestScoreOf(verification.scores),
      locked,
      winnerRun: winnerTrack
        ? { length: winnerTrack.runLength, weight: winnerTrack.runWeight }
        : null,
      printingScores: printing.readout?.scores,
      printingMargin: printing.readout?.margin,
      printingVia: printing.readout?.via,
      printingTrack: printing.track
        ? {
            artKey: printing.track.artKey,
            key: printing.track.key,
            label: printing.track.label,
            resolved: printing.track.printingResolved,
            ...(printing.track.lockedFrame === undefined
              ? {}
              : { lockedFrame: printing.track.lockedFrame }),
          }
        : undefined,
      ...surveyed,
      sweeping,
      still,
      focus: best.focus,
      timings: timings(verifyMs, printingMs),
    };
  }

  return {
    processFrame,
    state,
    noteBoard,
    rearm: () => {
      rearmLockedTracks(state);
      // lastWinnerRotation stays: cards dealt onto a pile land the same way
      // up, and it only steers the search order.
      lastWinnerQuad = null;
      absentStreak = 0;
    },
  };
}
