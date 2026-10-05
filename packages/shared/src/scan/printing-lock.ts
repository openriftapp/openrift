import type { ArtTrack } from "./accept";
import type {
  PrintingIdentity,
  PrintingResolution,
  PrintingScore,
  PrintingSignature,
} from "./disambiguate";
import {
  bestShiftCorrelation,
  printingSignature,
  resolvePrinting,
  textBandForType,
} from "./disambiguate";
import type { EmbedBank } from "./embed";
import { rotateRgbaCw } from "./image";
import type { RgbaImage } from "./types";

const AGREEING_FRAMES = 2;

export const PRINTING_ATTEMPTS = 8;

export interface PrintingLockDeps {
  bank: EmbedBank;
  artKeyOf: (key: string) => string;
  labelOf: (key: string) => string;
  identityOf: (key: string) => PrintingIdentity | undefined;
  fetchReference: (key: string) => Promise<RgbaImage | null>;
}

export interface PrintingReadout {
  scores: PrintingScore[];
  margin?: number;
  via?: PrintingResolution["via"];
}

interface PrintingLock {
  /** Forgets a track's votes and attempts; call when the track locks. */
  restart: (track: ArtTrack) => void;
  takeAttempt: (track: ArtTrack) => boolean;
  disambiguate: (
    track: ArtTrack,
    card: RgbaImage,
    rotation: number,
  ) => Promise<PrintingReadout | undefined>;
}

export function createPrintingLock(deps: PrintingLockDeps): PrintingLock {
  const signatureCache = new Map<string, PrintingSignature | null>();
  const votes = new Map<ArtTrack, { key: string; streak: number }>();
  const attempts = new Map<ArtTrack, number>();

  async function referenceSignatures(
    keys: readonly string[],
    band: ReturnType<typeof textBandForType>,
  ): Promise<Map<string, PrintingSignature | null>> {
    await Promise.all(
      keys
        .filter((key) => !signatureCache.has(key))
        .map(async (key) => {
          let image: RgbaImage | null;
          try {
            image = await deps.fetchReference(key);
          } catch {
            return;
          }
          signatureCache.set(key, image ? printingSignature(image, band) : null);
        }),
    );
    const signatures = new Map<string, PrintingSignature | null>();
    for (const key of keys) {
      if (signatureCache.has(key)) {
        signatures.set(key, signatureCache.get(key) ?? null);
      }
    }
    return signatures;
  }

  function vote(track: ArtTrack, picked: PrintingResolution): void {
    // Duplicate renders of one printing vote as one.
    const pickedClass = new Set([picked.key, ...picked.indistinguishable]);
    const previous = votes.get(track);
    const streak = previous && pickedClass.has(previous.key) ? previous.streak + 1 : 1;
    votes.set(track, { key: picked.key, streak });
    // Same-code marker variants share a label, so their markers must agree too.
    const pickedLabel = deps.labelOf(picked.key);
    const pickedMarkers = deps.identityOf(picked.key)?.markers;
    const unanimous = picked.indistinguishable.every(
      (key) => deps.labelOf(key) === pickedLabel && deps.identityOf(key)?.markers === pickedMarkers,
    );
    if (streak >= AGREEING_FRAMES && unanimous) {
      track.key = picked.key;
      track.label = pickedLabel;
      track.printingResolved = true;
    }
  }

  return {
    restart(track) {
      votes.delete(track);
      attempts.delete(track);
    },

    takeAttempt(track) {
      const taken = attempts.get(track) ?? 0;
      if (taken >= PRINTING_ATTEMPTS) {
        return false;
      }
      attempts.set(track, taken + 1);
      return true;
    },

    async disambiguate(track, card, rotation) {
      const keys = [
        ...new Set(deps.bank.keys.filter((key) => deps.artKeyOf(key) === track.artKey)),
      ];
      if (keys.length < 2) {
        return;
      }
      let aligned = card;
      for (let turn = 0; turn < rotation; turn++) {
        aligned = rotateRgbaCw(aligned);
      }
      const band = textBandForType(deps.identityOf(track.key)?.type);
      const query = printingSignature(aligned, band);
      if (!query) {
        return;
      }
      const signatures = await referenceSignatures(keys, band);
      const scores: PrintingScore[] = [];
      for (const [key, signature] of signatures) {
        if (signature) {
          scores.push({ key, score: bestShiftCorrelation(query.name, signature.name).score });
        }
      }
      scores.sort((a, b) => b.score - a.score);
      const picked = resolvePrinting(query, signatures, deps.identityOf);
      if (picked !== null) {
        vote(track, picked);
      }
      return scores.length > 0 ? { scores, margin: picked?.margin, via: picked?.via } : undefined;
    },
  };
}
