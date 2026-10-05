/** Scores offline bench runs against hand-labelled clip truth and compares two runs. */

export interface TruthPrinting {
  publicCode: string;
  language: string;
  markers?: string;
}

export interface TruthCard {
  artKey: string;
  name: string;
  copies?: number;
  printing?: TruthPrinting | null;
}

export interface ClipTruth {
  split: "tune" | "holdout";
  mode: "sweep" | "single" | "auto";
  reviewed: boolean;
  cards: TruthCard[];
  fps?: number;
  note?: string;
}

/** One clip in the bench pack's index.json. */
export interface PackClip {
  clip: string;
  frames: number;
  truth: ClipTruth;
}

export interface BenchIdentity {
  name: string;
  artKey: string;
  publicCode: string;
  language: string;
  markers?: string | null;
}

export interface BenchLock {
  seconds: number;
  key: string;
  artKey: string;
  label: string;
  framesToLock: number;
  /** Percent. */
  score: number;
  /** Percent. */
  rivalScore: number;
  printingResolved: boolean;
  multiPrinting: boolean;
  /** Seconds. */
  arrivedAt: number | null;
  source: "live" | "second-look";
  printingVia?: "name" | "code" | "stamp";
  printingMargin?: number;
  /** Frame pixels. */
  printingCardHeight?: number;
}

export type LockVerdict =
  | "correct"
  | "printing-open"
  | "marker-only"
  | "wrong-printing"
  | "wrong-card"
  | "duplicate";

export interface ScoredLock extends BenchLock {
  verdict: LockVerdict;
}

export interface ClipScore {
  expected: number;
  found: number;
  wrongCards: number;
  wrongPrintings: number;
  printingOpen: number;
  markerOnly: number;
  duplicates: number;
  missed: string[];
  /** Seconds. */
  arrivalToLock: number[];
}

/** Artworks whose keys span more than one code, language or marker combination. */
export function multiPrintingArts(
  keys: readonly string[],
  identityOf: (key: string) => BenchIdentity | undefined,
): Set<string> {
  const printingsByArt = new Map<string, Set<string>>();
  for (const key of keys) {
    const identity = identityOf(key);
    if (identity) {
      const printings = printingsByArt.get(identity.artKey) ?? new Set<string>();
      printings.add(`${identity.publicCode}|${identity.language}|${identity.markers ?? "?"}`);
      printingsByArt.set(identity.artKey, printings);
    }
  }
  return new Set(
    [...printingsByArt].filter(([, printings]) => printings.size > 1).map(([artKey]) => artKey),
  );
}

export function groupTruth(truth: ClipTruth, groupOf: ReadonlyMap<string, string>): ClipTruth {
  return {
    ...truth,
    cards: truth.cards.map((card) => ({
      ...card,
      artKey: groupOf.get(card.artKey) ?? card.artKey,
    })),
  };
}

function printingMatches(truth: TruthPrinting, identity: BenchIdentity): boolean {
  return (
    truth.publicCode === identity.publicCode &&
    truth.language === identity.language &&
    (truth.markers === undefined || truth.markers === (identity.markers ?? ""))
  );
}

/**
 * Marked printings sometimes carry their own code suffix, so the code is not
 * compared; callers have already matched the artwork.
 */
function onlyMarkerMissed(truth: TruthPrinting, identity: BenchIdentity): boolean {
  return (
    truth.language === identity.language &&
    (truth.markers ?? "") !== "" &&
    (identity.markers ?? "") === ""
  );
}

interface TruthEntry {
  card: TruthCard;
  counted: number;
}

const VERDICT_TALLY: Partial<
  Record<
    LockVerdict,
    "wrongCards" | "wrongPrintings" | "printingOpen" | "markerOnly" | "duplicates"
  >
> = {
  "wrong-card": "wrongCards",
  "wrong-printing": "wrongPrintings",
  "printing-open": "printingOpen",
  "marker-only": "markerOnly",
  duplicate: "duplicates",
};

function judgeLock(
  entries: readonly TruthEntry[],
  names: ReadonlySet<string>,
  lock: BenchLock,
  identity: BenchIdentity | undefined,
): { verdict: LockVerdict; entry?: TruthEntry } {
  const candidates = entries.filter((entry) => entry.card.artKey === lock.artKey);
  if (candidates.length === 0) {
    return { verdict: identity && names.has(identity.name) ? "wrong-printing" : "wrong-card" };
  }
  const hasRoom = (entry: TruthEntry) => entry.counted < (entry.card.copies ?? 1);
  if (lock.multiPrinting && !lock.printingResolved) {
    const entry =
      candidates.find((candidate) => hasRoom(candidate) && !candidate.card.printing) ??
      candidates.find((candidate) => hasRoom(candidate));
    if (!entry) {
      return { verdict: "duplicate" };
    }
    return { verdict: entry.card.printing ? "printing-open" : "correct", entry };
  }
  const matches = (entry: TruthEntry) =>
    !entry.card.printing ||
    (identity !== undefined && printingMatches(entry.card.printing, identity));
  const markerMatches = (entry: TruthEntry) =>
    Boolean(entry.card.printing && identity && onlyMarkerMissed(entry.card.printing, identity));
  const exact = candidates.find((candidate) => hasRoom(candidate) && matches(candidate));
  if (exact) {
    return { verdict: "correct", entry: exact };
  }
  const marker = candidates.find((candidate) => hasRoom(candidate) && markerMatches(candidate));
  if (marker) {
    return { verdict: "marker-only", entry: marker };
  }
  return {
    verdict: candidates.some((candidate) => matches(candidate) || markerMatches(candidate))
      ? "duplicate"
      : "wrong-printing",
  };
}

export function scoreClip(
  truth: ClipTruth,
  locks: readonly BenchLock[],
  identityOf: (key: string) => BenchIdentity | undefined,
): { locks: ScoredLock[]; score: ClipScore } {
  const entries: TruthEntry[] = truth.cards.map((card) => ({ card, counted: 0 }));
  const names = new Set(truth.cards.map((card) => card.name));
  const score: ClipScore = {
    expected: truth.cards.reduce((sum, card) => sum + (card.copies ?? 1), 0),
    found: 0,
    wrongCards: 0,
    wrongPrintings: 0,
    printingOpen: 0,
    markerOnly: 0,
    duplicates: 0,
    missed: [],
    arrivalToLock: [],
  };
  const scored = locks.map((lock): ScoredLock => {
    const { verdict, entry } = judgeLock(entries, names, lock, identityOf(lock.key));
    if (entry) {
      entry.counted++;
      score.found++;
      if (lock.arrivedAt !== null) {
        score.arrivalToLock.push(lock.seconds - lock.arrivedAt);
      }
    }
    const tally = VERDICT_TALLY[verdict];
    if (tally) {
      score[tally]++;
    }
    return { ...lock, verdict };
  });
  for (const entry of entries) {
    const short = (entry.card.copies ?? 1) - entry.counted;
    for (let i = 0; i < short; i++) {
      score.missed.push(entry.card.name);
    }
  }
  return { locks: scored, score };
}

export type AppOutcome =
  | { kind: "auto" | "picker"; printings: BenchIdentity[] }
  | { kind: "unknown" };

export interface AppScore {
  auto: number;
  autoWrong: number;
  picker: number;
  pickerMissing: number;
  markerMiss: number;
  unknown: number;
}

/** Judges what the app would add for each lock that named a labelled card. */
export function scoreAppOutcomes(
  truth: ClipTruth,
  outcomes: readonly { lock: ScoredLock; name: string; outcome: AppOutcome }[],
): AppScore {
  const score: AppScore = {
    auto: 0,
    autoWrong: 0,
    picker: 0,
    pickerMissing: 0,
    markerMiss: 0,
    unknown: 0,
  };
  const remaining = truth.cards.map((card) => ({ card, left: card.copies ?? 1 }));
  const take = (name: string, printings: readonly BenchIdentity[]): "exact" | "marker" | "none" => {
    const open = (entry: (typeof remaining)[number]) => entry.left > 0 && entry.card.name === name;
    const exact = remaining.find(
      (entry) =>
        open(entry) &&
        printings.some(
          (printing) => !entry.card.printing || printingMatches(entry.card.printing, printing),
        ),
    );
    const slot =
      exact ??
      remaining.find(
        (entry) =>
          open(entry) &&
          printings.some(
            (printing) =>
              entry.card.printing &&
              entry.card.artKey === printing.artKey &&
              onlyMarkerMissed(entry.card.printing, printing),
          ),
      );
    if (!slot) {
      return "none";
    }
    slot.left--;
    return exact ? "exact" : "marker";
  };
  for (const { lock, name, outcome } of outcomes) {
    if (lock.verdict === "wrong-card") {
      continue;
    }
    if (outcome.kind === "unknown") {
      score.unknown++;
    } else {
      score[outcome.kind]++;
      const taken = take(name, outcome.printings);
      if (taken === "marker") {
        score.markerMiss++;
      } else if (taken === "none") {
        score[outcome.kind === "auto" ? "autoWrong" : "pickerMissing"]++;
      }
    }
  }
  return score;
}

export interface TimingSummary {
  mean: number;
  p50: number;
  p90: number;
}

export function summarize(values: readonly number[]): TimingSummary {
  if (values.length === 0) {
    return { mean: 0, p50: 0, p90: 0 };
  }
  const sorted = values.toSorted((a, b) => a - b);
  const at = (q: number) => sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))] ?? 0;
  return {
    mean: sorted.reduce((sum, value) => sum + value, 0) / sorted.length,
    p50: at(0.5),
    p90: at(0.9),
  };
}

export interface BenchClipResult {
  clip: string;
  split: ClipTruth["split"];
  mode: ClipTruth["mode"];
  reviewed: boolean;
  frames: number;
  processed: number;
  frameMs: TimingSummary;
  stageMs: { detect: number; embed: number; verify: number; printing?: number };
  locks: ScoredLock[];
  score: ClipScore;
  app?: AppScore;
  sweepShare: number;
}

export interface BenchRun {
  meta: Record<string, string | number | boolean>;
  clips: BenchClipResult[];
}

/** A clip result read from disk, where older runs lack `sweepShare`. */
export type SavedClipResult = Omit<BenchClipResult, "sweepShare"> & { sweepShare?: number };

export interface SavedRun {
  meta: BenchRun["meta"];
  clips: SavedClipResult[];
}

export interface RunComparison {
  failures: string[];
  warnings: string[];
  rows: string[];
}

const SLOWDOWN_WARN = 1.1;
const SLOWDOWN_FAIL = 1.25;
const SWEEPING_SHARE = 0.1;

function fmt(value: number, digits = 2): string {
  return value.toFixed(digits);
}

function wrongLocks(clip: SavedClipResult): number {
  return clip.score.wrongCards + clip.score.wrongPrintings;
}

function correctLocks(clip: SavedClipResult): number {
  return clip.score.found - clip.score.printingOpen - clip.score.markerOnly;
}

function wrongAdds(app: AppScore): number {
  return app.autoWrong + app.pickerMissing;
}

function compareSpeed(
  before: SavedClipResult,
  after: SavedClipResult,
  failures: string[],
  warnings: string[],
): void {
  const message = `${after.clip}: mean frame ${fmt(before.frameMs.mean, 0)} -> ${fmt(after.frameMs.mean, 0)} ms`;
  const mayHaveSwept = after.sweepShare === undefined || after.sweepShare >= SWEEPING_SHARE;
  if (!mayHaveSwept && after.frameMs.mean > before.frameMs.mean * SLOWDOWN_FAIL) {
    failures.push(message);
  } else if (after.frameMs.mean > before.frameMs.mean * SLOWDOWN_WARN) {
    warnings.push(message);
  }
}

function compareApp(
  before: SavedClipResult,
  after: SavedClipResult,
  failures: string[],
  warnings: string[],
): void {
  if (before.app && after.app) {
    const wrongAppBefore = wrongAdds(before.app);
    const wrongAppAfter = wrongAdds(after.app);
    if (wrongAppAfter > wrongAppBefore) {
      failures.push(`${after.clip}: wrong printings added ${wrongAppBefore} -> ${wrongAppAfter}`);
    }
  } else if (before.app || after.app) {
    warnings.push(
      `${after.clip}: only the ${before.app ? "baseline" : "candidate"} run has an app score`,
    );
  }
}

function compareClip(
  before: SavedClipResult,
  after: SavedClipResult,
  failures: string[],
  warnings: string[],
): void {
  if (!after.reviewed) {
    warnings.push(`${after.clip}: truth labels are not reviewed yet`);
  }
  if (after.score.expected !== before.score.expected) {
    warnings.push(
      `${after.clip}: truth changed, expected ${before.score.expected} -> ${after.score.expected}`,
    );
  }
  const wrongBefore = wrongLocks(before);
  const wrongAfter = wrongLocks(after);
  if (wrongAfter > wrongBefore) {
    failures.push(`${after.clip}: wrong locks ${wrongBefore} -> ${wrongAfter}`);
  } else if (wrongAfter > 0) {
    warnings.push(`${after.clip}: ${wrongAfter} wrong locks in both runs`);
  }
  if (after.score.found < before.score.found) {
    failures.push(
      `${after.clip}: found ${before.score.found} -> ${after.score.found} of ${after.score.expected}`,
    );
  }
  const correctBefore = correctLocks(before);
  const correctAfter = correctLocks(after);
  if (correctAfter < correctBefore) {
    failures.push(`${after.clip}: correct locks ${correctBefore} -> ${correctAfter}`);
  }
  if (after.score.duplicates > before.score.duplicates) {
    failures.push(
      `${after.clip}: duplicates ${before.score.duplicates} -> ${after.score.duplicates}`,
    );
  }
  compareSpeed(before, after, failures, warnings);
  compareApp(before, after, failures, warnings);
}

function clipRow(before: SavedClipResult, after: SavedClipResult): string {
  const wrongBefore = wrongLocks(before);
  const wrongAfter = wrongLocks(after);
  const appRow =
    before.app && after.app
      ? `  added-wrong ${wrongAdds(before.app)}->${wrongAdds(after.app)}  marker-miss ${before.app.markerMiss}->${after.app.markerMiss}  picker ${before.app.picker}->${after.app.picker}`
      : "";
  const aimBefore = summarize(before.score.arrivalToLock);
  const aimAfter = summarize(after.score.arrivalToLock);
  const arrival =
    after.score.arrivalToLock.length > 0 || before.score.arrivalToLock.length > 0
      ? `  arrival p50 ${fmt(aimBefore.p50)}->${fmt(aimAfter.p50)}s p90 ${fmt(aimBefore.p90)}->${fmt(aimAfter.p90)}s`
      : "";
  return (
    `${after.clip.padEnd(36)} ${after.split.padEnd(7)} ` +
    `found ${before.score.found}->${after.score.found}/${after.score.expected}  ` +
    `correct ${correctLocks(before)}->${correctLocks(after)}  ` +
    `wrong ${wrongBefore}->${wrongAfter}  ` +
    `open ${before.score.printingOpen}->${after.score.printingOpen}  ` +
    `marker ${before.score.markerOnly}->${after.score.markerOnly}  ` +
    `dup ${before.score.duplicates}->${after.score.duplicates}  ` +
    `frame ${fmt(before.frameMs.mean, 0)}->${fmt(after.frameMs.mean, 0)}ms${appRow}${arrival}`
  );
}

export function compareRuns(baseline: SavedRun, candidate: SavedRun): RunComparison {
  const failures: string[] = [];
  const warnings: string[] = [];
  const rows: string[] = [];
  const baseClips = new Map(baseline.clips.map((clip) => [clip.clip, clip]));
  const candidateNames = new Set(candidate.clips.map((clip) => clip.clip));
  for (const name of baseClips.keys()) {
    if (!candidateNames.has(name)) {
      failures.push(`${name}: missing from the candidate run`);
    }
  }
  for (const after of candidate.clips) {
    const before = baseClips.get(after.clip);
    if (!before) {
      failures.push(`${after.clip}: missing from the baseline run`);
      continue;
    }
    compareClip(before, after, failures, warnings);
    rows.push(clipRow(before, after));
  }
  return { failures, warnings, rows };
}
