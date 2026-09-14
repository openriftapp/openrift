// oxlint-disable-next-line import/no-nodejs-modules -- server-side file needs filesystem access
import { join } from "node:path";

import type { Logger } from "@openrift/shared/logger";

import type { Io } from "../../../../io.js";
import type { candidateCardsRepo } from "../../../candidates/repositories/candidate-cards.js";
import type { printingImagesRepo } from "../../repositories/printing-images.js";
import { downloadImage } from "./download.js";
import { computeCandidateFingerprint, computeImageFingerprint } from "./fingerprint.js";
import { CARD_MEDIA_DIR } from "./paths.js";

export interface FingerprintSweepResult {
  liveFingerprinted: number;
  liveFailed: number;
  candidatesFingerprinted: number;
  candidatesFailed: number;
}

const FINGERPRINT_LIVE_BATCH = 500;
const FINGERPRINT_CANDIDATE_BATCH = 300;

interface SweepRepos {
  printingImages: ReturnType<typeof printingImagesRepo>;
  candidateCards: ReturnType<typeof candidateCardsRepo>;
}

export function isFingerprintSweepNoop(result: FingerprintSweepResult): boolean {
  return (
    result.liveFingerprinted === 0 &&
    result.liveFailed === 0 &&
    result.candidatesFingerprinted === 0 &&
    result.candidatesFailed === 0
  );
}

/** A failed candidate download still records the URL, so the row is not retried every run. */
export async function sweepImageFingerprints(
  io: Io,
  repos: SweepRepos,
  log: Logger,
  limits = { live: FINGERPRINT_LIVE_BATCH, candidates: FINGERPRINT_CANDIDATE_BATCH },
): Promise<FingerprintSweepResult> {
  const result: FingerprintSweepResult = {
    liveFingerprinted: 0,
    liveFailed: 0,
    candidatesFingerprinted: 0,
    candidatesFailed: 0,
  };

  const liveFiles = await repos.printingImages.listRehostedWithoutFingerprint(limits.live);
  for (const file of liveFiles) {
    try {
      const buffer = await io.fs.readFile(
        join(CARD_MEDIA_DIR, file.id.slice(-2), `${file.id}-full.webp`),
      );
      await repos.printingImages.setFingerprint(file.id, await computeImageFingerprint(io, buffer));
      result.liveFingerprinted++;
    } catch (error) {
      result.liveFailed++;
      log.warn({ imageFileId: file.id, err: error }, "image fingerprint failed");
    }
  }

  const candidates = await repos.candidateCards.listPrintingsNeedingFingerprint(limits.candidates);
  for (const candidate of candidates) {
    try {
      const { buffer } = await downloadImage(io, candidate.imageUrl);
      const fingerprint = await computeCandidateFingerprint(io, buffer, candidate.liveFingerprint);
      await repos.candidateCards.setImageFingerprint(candidate.id, candidate.imageUrl, fingerprint);
      result.candidatesFingerprinted++;
    } catch (error) {
      await repos.candidateCards.setImageFingerprint(candidate.id, candidate.imageUrl, null);
      result.candidatesFailed++;
      log.warn(
        { candidatePrintingId: candidate.id, url: candidate.imageUrl, err: error },
        "candidate image fingerprint failed",
      );
    }
  }

  return result;
}
