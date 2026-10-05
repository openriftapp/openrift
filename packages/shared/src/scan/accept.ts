/** The accept layer: turn per-frame verification results into locked cards. */

export interface FrameWinner {
  key: string;
  artKey: string;
  /** Percent. */
  score: number;
  /** Percent. */
  rivalScore: number;
}

export interface FrameDecision {
  winner: FrameWinner | null;
  refused: boolean;
}

export interface AlignedOptions {
  minScore: number;
  minMargin: number;
}

export const DEFAULT_ALIGNED_OPTIONS: AlignedOptions = { minScore: 0.6, minMargin: 0.15 };
const ALIGNED_FULL_WEIGHT_SCORE = 0.95;
export const MAX_FRAME_WEIGHT = 2;

/** Frame winner from aligned-patch scores (0..1). */
export function pickAlignedWinner(
  scores: readonly { key: string; score: number }[],
  artKeyOf: (key: string) => string,
  options: AlignedOptions,
): FrameDecision {
  let best: { key: string; score: number } | null = null;
  for (const entry of scores) {
    if (Number.isFinite(entry.score) && (!best || entry.score > best.score)) {
      best = entry;
    }
  }
  if (!best || best.score < options.minScore) {
    return { winner: null, refused: false };
  }
  const artKey = artKeyOf(best.key);
  let rival = Number.NEGATIVE_INFINITY;
  for (const entry of scores) {
    if (Number.isFinite(entry.score) && artKeyOf(entry.key) !== artKey) {
      rival = Math.max(rival, entry.score);
    }
  }
  if (best.score - rival < options.minMargin) {
    return { winner: null, refused: true };
  }
  return {
    winner: {
      key: best.key,
      artKey,
      score: Math.round(best.score * 100),
      rivalScore: Number.isFinite(rival) ? Math.max(0, Math.round(rival * 100)) : 0,
    },
    refused: false,
  };
}

export function alignedFrameWeight(winner: FrameWinner, options: AlignedOptions): number {
  const strength =
    (winner.score / 100 - options.minScore) / (ALIGNED_FULL_WEIGHT_SCORE - options.minScore);
  return 1 + (MAX_FRAME_WEIGHT - 1) * Math.max(0, Math.min(1, strength));
}

export interface AcceptOptions {
  lockRun: number;
  maxGapFrames: number;
  weighted?: boolean;
  relockOnlyAfterRearm?: boolean;
}

export interface ArtTrack {
  artKey: string;
  key: string;
  label: string;
  firstSeen: number;
  sightings: number;
  runLength: number;
  runWeight: number;
  lockedThisRun: boolean;
  lastFrame: number;
  lockedAt: number | null;
  lockedFrame?: number;
  framesToLock: number | null;
  printingResolved: boolean;
  runStartFrame: number;
  runStartSeconds: number;
  maxRunLength: number;
}

export type AcceptState = Map<string, ArtTrack>;

/** One lock of one physical card; copies of an artwork lock on different frames. */
export function lockIdOf(lock: { artKey: string; lockedFrame?: number }): string {
  return `${lock.artKey}@${lock.lockedFrame ?? ""}`;
}

export function continuesRun(
  track: Pick<ArtTrack, "lastFrame">,
  frame: number,
  options: Pick<AcceptOptions, "maxGapFrames">,
): boolean {
  return frame - track.lastFrame <= options.maxGapFrames;
}

interface Sighting {
  weight?: number;
  stateKey?: string;
  canLock?: boolean;
}

export function observeWinner(
  state: AcceptState,
  frame: number,
  seconds: number,
  winner: FrameWinner,
  label: string,
  options: AcceptOptions,
  { weight = 1, stateKey = winner.artKey, canLock = true }: Sighting = {},
): ArtTrack | null {
  let track = state.get(stateKey);
  if (!track) {
    track = {
      artKey: winner.artKey,
      key: winner.key,
      label,
      firstSeen: seconds,
      sightings: 0,
      runLength: 0,
      runWeight: 0,
      lockedThisRun: false,
      lastFrame: Number.NEGATIVE_INFINITY,
      lockedAt: null,
      framesToLock: null,
      printingResolved: false,
      runStartFrame: frame,
      runStartSeconds: seconds,
      maxRunLength: 0,
    };
    state.set(stateKey, track);
  }
  track.sightings++;
  if (continuesRun(track, frame, options)) {
    track.runLength++;
    track.runWeight += weight;
  } else {
    track.runLength = 1;
    track.runWeight = weight;
    track.runStartFrame = frame;
    track.runStartSeconds = seconds;
    if (!options.relockOnlyAfterRearm) {
      track.lockedThisRun = false;
    }
  }
  track.maxRunLength = Math.max(track.maxRunLength, track.runLength);
  track.lastFrame = frame;
  // A run's first frame weighs at most MAX_FRAME_WEIGHT, below every lockRun
  // in use, so a single frame never locks unless lockRun is 1 (capture mode).
  if (canLock && !track.lockedThisRun && track.runWeight >= options.lockRun) {
    track.lockedThisRun = true;
    track.lockedAt = seconds;
    track.lockedFrame = frame;
    track.key = winner.key;
    track.label = label;
    track.printingResolved = false;
    track.framesToLock = frame - track.runStartFrame;
    if (options.relockOnlyAfterRearm) {
      rearmLockedTracks(state, track);
    }
    return track;
  }
  return null;
}

// Unlocked tracks are left alone: their gap tolerance exists so mid-aim blur
// does not restart the lock clock, and this must not undo that.
export function rearmLockedTracks(state: AcceptState, except?: ArtTrack): void {
  for (const track of state.values()) {
    if (track.lockedAt !== null && track !== except) {
      track.runLength = 0;
      track.runWeight = 0;
      track.lockedThisRun = false;
      track.lastFrame = Number.NEGATIVE_INFINITY;
    }
  }
}
