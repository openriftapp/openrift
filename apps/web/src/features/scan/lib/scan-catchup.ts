import type { FrameWinner } from "@openrift/shared/scan/accept";
import type { RankedEmbed } from "@openrift/shared/scan/embed";
import type { RgbaImage } from "@openrift/shared/scan/types";

export const CATCH_UP_CAPACITY = 3;

export interface PendingFrame {
  frame: RgbaImage;
  thumbnail: string | null;
}

export interface CatchUpEntry {
  id: string;
  frame: RgbaImage;
  thumbnail: string | null;
  at: number;
}

export interface CatchUpQueue {
  push: (entry: CatchUpEntry) => void;
  take: () => CatchUpEntry | null;
  drop: (id: string) => void;
  size: () => number;
  clear: () => void;
}

export function createCatchUpQueue(capacity = CATCH_UP_CAPACITY): CatchUpQueue {
  let entries: CatchUpEntry[] = [];
  return {
    push(entry) {
      entries.push(entry);
      while (entries.length > capacity) {
        entries.shift();
      }
    },
    take() {
      return entries.shift() ?? null;
    },
    drop(id) {
      entries = entries.filter((entry) => entry.id !== id);
    },
    size() {
      return entries.length;
    },
    clear() {
      entries = [];
    },
  };
}

export type CatchUpVerdict = "add" | "ask" | "discard";

/** Aligned score in percent, as `FrameWinner.score` carries it. */
export const CATCH_UP_ADD_SCORE = 75;
/** Percent points. */
export const CATCH_UP_ADD_MARGIN = 30;

export function catchUpVerdict(winner: FrameWinner | null): CatchUpVerdict {
  if (!winner) {
    return "discard";
  }
  return winner.score >= CATCH_UP_ADD_SCORE &&
    winner.score - winner.rivalScore >= CATCH_UP_ADD_MARGIN
    ? "add"
    : "ask";
}

export function shouldRunCatchUp(input: {
  queued: number;
  settling: boolean;
  cardInGuide: boolean;
  busy: boolean;
}): boolean {
  return input.queued > 0 && !input.busy && !input.settling && !input.cardInGuide;
}

export const CATCH_UP_SHORTLIST = 4;

export interface UnidentifiedCard {
  id: string;
  thumbnail: string | null;
  candidates: { key: string; artKey: string }[];
  at: number;
}

export interface IdentifyAttempt {
  snapshot: string | null;
  identified: boolean;
  candidates: { key: string; artKey: string }[];
}

export function rankedArtworks(
  ranked: readonly RankedEmbed[],
  artKeys: ReadonlyMap<string, string>,
): { key: string; artKey: string }[] {
  const seen = new Set<string>();
  const candidates: { key: string; artKey: string }[] = [];
  for (const entry of ranked) {
    const artKey = artKeys.get(entry.key) ?? entry.key;
    if (seen.has(artKey)) {
      continue;
    }
    seen.add(artKey);
    candidates.push({ key: entry.key, artKey });
  }
  return candidates;
}
