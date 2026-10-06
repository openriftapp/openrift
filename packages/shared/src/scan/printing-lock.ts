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

export interface PrintingRead {
  scores: PrintingScore[];
  picked: PrintingResolution | null;
}

export type PrintingReader = (
  artKey: string,
  typeKey: string,
  card: RgbaImage,
  rotation: number,
) => Promise<PrintingRead | undefined>;

/** Compares one crop against every printing of its artwork; undefined when the artwork has one printing. */
export function createPrintingReader(
  deps: Pick<PrintingLockDeps, "bank" | "artKeyOf" | "identityOf" | "fetchReference">,
): PrintingReader {
  const signatureCache = new Map<string, PrintingSignature | null>();

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

  return async (artKey, typeKey, card, rotation) => {
    const keys = [...new Set(deps.bank.keys.filter((key) => deps.artKeyOf(key) === artKey))];
    if (keys.length < 2) {
      return;
    }
    let aligned = card;
    for (let turn = 0; turn < rotation; turn++) {
      aligned = rotateRgbaCw(aligned);
    }
    const band = textBandForType(deps.identityOf(typeKey)?.type);
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
    scores.sort((first, second) => second.score - first.score);
    return { scores, picked: resolvePrinting(query, signatures, deps.identityOf) };
  };
}

/** Same-code marker variants share a label, so a pick only stands when their markers agree too. */
export function unanimousPick(
  picked: PrintingResolution,
  deps: Pick<PrintingLockDeps, "labelOf" | "identityOf">,
): boolean {
  const pickedLabel = deps.labelOf(picked.key);
  const pickedMarkers = deps.identityOf(picked.key)?.markers;
  return picked.indistinguishable.every(
    (key) => deps.labelOf(key) === pickedLabel && deps.identityOf(key)?.markers === pickedMarkers,
  );
}

export function createPrintingLock(deps: PrintingLockDeps): PrintingLock {
  const read = createPrintingReader(deps);
  const votes = new Map<ArtTrack, { key: string; streak: number }>();
  const attempts = new Map<ArtTrack, number>();

  function vote(track: ArtTrack, picked: PrintingResolution): void {
    // Duplicate renders of one printing vote as one.
    const pickedClass = new Set([picked.key, ...picked.indistinguishable]);
    const previous = votes.get(track);
    const streak = previous && pickedClass.has(previous.key) ? previous.streak + 1 : 1;
    votes.set(track, { key: picked.key, streak });
    if (streak >= AGREEING_FRAMES && unanimousPick(picked, deps)) {
      track.key = picked.key;
      track.label = deps.labelOf(picked.key);
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
      const result = await read(track.artKey, track.key, card, rotation);
      if (!result) {
        return;
      }
      if (result.picked !== null) {
        vote(track, result.picked);
      }
      return result.scores.length > 0
        ? { scores: result.scores, margin: result.picked?.margin, via: result.picked?.via }
        : undefined;
    },
  };
}
