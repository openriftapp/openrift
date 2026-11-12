import type {
  AcceptCardField,
  AcceptPrintingBody,
  AcceptPrintingField,
} from "@openrift/shared/contracts/admin/card-mutations";
import { ERROR_CODES } from "@openrift/shared/error-codes";
import { resolveFinish } from "@openrift/shared/printing-accept";

import type { CardSubmissionReason, CardSubmissionStatus } from "../../../db/tables/candidates.js";
import type { Repos, Transact } from "../../../deps.js";
import { AppError } from "../../../errors.js";
import type { Io } from "../../../io.js";
import { assertFound } from "../../../lib/assertions.js";
import { buildSizedPrintingLinkKey } from "../../../lib/printing-link-key.js";
import { faceForNewImage } from "../../catalog/lib/image-face.js";
import {
  describeUnknownRefs,
  knownRarity,
  loadKnownPrintingRefs,
  unknownPrintingRefs,
} from "../../catalog/lib/printing-refs.js";
import {
  normalizeCardFieldValue,
  writeCardField,
} from "../../catalog/services/card-field-writes.js";
import { rehostImagesInBackground } from "../../catalog/services/images/jobs.js";
import type { NewPrinting } from "../../catalog/services/printing-admin.js";
import {
  facePrintedFieldConflict,
  insertNewPrinting,
  newPrintingConflict,
  newPrintingIdentity,
  withPrintingIdentityConflicts,
} from "../../catalog/services/printing-admin.js";
import type { PrintingFieldSource } from "../../catalog/services/printing-field-writes.js";
import {
  normalizePrintingFieldValue,
  writePrintingField,
} from "../../catalog/services/printing-field-writes.js";
import { recordAdminEvent } from "../../system/services/record-admin-event.js";
import { assertProvidersInScope } from "../lib/card-review-scope.js";
import type { CardSubmissionRow } from "../repositories/card-submissions.js";
import { finishPrintingAccepts } from "./accept-candidate-printings.js";
import { relinkCandidatePrintings } from "./relink-candidates.js";
import { discardSubmissionUploads } from "./submission-uploads.js";

interface CardFieldPick {
  field: AcceptCardField;
  value: unknown;
}

interface PrintingFieldPick {
  printingId: string;
  faceId?: string;
  field: AcceptPrintingField;
  value: unknown;
  source: PrintingFieldSource;
}

interface NewPrintingPick {
  candidatePrintingId: string;
  printingFields: AcceptPrintingBody["printingFields"];
}

interface ImagePick {
  candidatePrintingId: string;
  printingId: string;
  faceId?: string;
}

/** The side a review pick names by face; a re-sort since the page loaded may have moved it. */
async function sideOfPick(trx: Repos, pick: { printingId: string; faceId?: string }) {
  if (pick.faceId === undefined) {
    return 1;
  }
  const side = await trx.catalogMutations.sideOfFace(pick.printingId, pick.faceId);
  assertFound(side, "That face is not on the printing");
  return side;
}

interface ReviewerArgs {
  candidateCardId: string;
  adminUserId: string;
  scope: Set<string> | null;
  now: Date;
}

export interface AcceptSubmissionArgs extends ReviewerArgs {
  cardFields: CardFieldPick[];
  printingFields: PrintingFieldPick[];
  newPrintings: NewPrintingPick[];
  images: ImagePick[];
}

interface SkippedNewPrinting {
  candidatePrintingId: string;
  reason: string;
}

export interface AcceptSubmissionResult {
  status: CardSubmissionStatus;
  applied: number;
  createdPrintingIds: string[];
  skipped: SkippedNewPrinting[];
}

export interface RejectSubmissionArgs extends ReviewerArgs {
  reason: CardSubmissionReason;
  note: string | null;
}

export interface MoveSubmissionArgs extends ReviewerArgs {
  cardId: string;
}

export interface MoveSubmissionResult {
  cardSlug: string;
}

interface CandidateRow {
  id: string;
  provider: string;
  externalId: string;
  name: string;
  normName: string;
}

async function loadCandidate(repos: Repos, args: ReviewerArgs): Promise<CandidateRow> {
  const candidate = await repos.candidateCards.candidateCardById(args.candidateCardId);
  assertFound(candidate, "Candidate card not found");
  assertProvidersInScope([candidate.provider], args.scope);
  return candidate;
}

async function loadOpenSubmission(
  repos: Repos,
  candidateCardId: string,
): Promise<CardSubmissionRow | null> {
  const submission = await repos.cardSubmissions.getByCandidateCardId(candidateCardId);
  if (submission && submission.status !== "pending") {
    throw new AppError(409, ERROR_CODES.CONFLICT, "Submission already settled");
  }
  return submission;
}

async function loadPendingSubmission(
  repos: Repos,
  candidateCardId: string,
): Promise<CardSubmissionRow> {
  const submission = await loadOpenSubmission(repos, candidateCardId);
  assertFound(submission, "Submission not found");
  return submission;
}

async function partitionNewPrintings(
  repos: Repos,
  cardId: string | null,
  picks: readonly NewPrintingPick[],
): Promise<{ usable: NewPrintingPick[]; skipped: SkippedNewPrinting[]; collided: boolean }> {
  if (picks.length === 0) {
    return { usable: [], skipped: [], collided: false };
  }
  const known = await loadKnownPrintingRefs(
    repos,
    picks.flatMap((pick) => pick.printingFields.distributionChannelSlugs ?? []),
  );

  const usable: NewPrintingPick[] = [];
  const skipped: SkippedNewPrinting[] = [];
  const seen = new Set<string>();
  let collided = false;
  for (const pick of picks) {
    const { printingFields } = pick;
    const finish = resolveFinish(printingFields.finish, printingFields.rarity);
    const unknown = unknownPrintingRefs({ ...printingFields, finish }, known);
    if (unknown.length > 0) {
      skipped.push({
        candidatePrintingId: pick.candidatePrintingId,
        reason: describeUnknownRefs(unknown),
      });
      continue;
    }
    if (cardId === null) {
      usable.push(pick);
      continue;
    }
    const identity = newPrintingIdentity(cardId, pick.printingFields);
    const key = buildSizedPrintingLinkKey(identity);
    if (seen.has(key)) {
      skipped.push({
        candidatePrintingId: pick.candidatePrintingId,
        reason:
          "another picked printing has the same short code, finish, size, language and markers",
      });
      continue;
    }
    seen.add(key);
    const conflict = await newPrintingConflict(repos, identity);
    if (conflict) {
      collided = true;
      skipped.push({ candidatePrintingId: pick.candidatePrintingId, reason: conflict });
      continue;
    }
    const faceConflict = await facePrintedFieldConflict(repos, cardId, {
      ...printingFields,
      rarity: knownRarity(known, printingFields.rarity) ?? printingFields.rarity,
    });
    if (faceConflict) {
      skipped.push({ candidatePrintingId: pick.candidatePrintingId, reason: faceConflict });
      continue;
    }
    usable.push(pick);
  }
  return { usable, skipped, collided };
}

async function attachCandidateImage(trx: Repos, args: ImagePick): Promise<string> {
  const candidatePrinting = await trx.printingImages.getCandidatePrintingById(
    args.candidatePrintingId,
  );
  assertFound(candidatePrinting, "Candidate printing not found");
  const { imageUrl } = candidatePrinting;
  if (!imageUrl) {
    throw new AppError(400, ERROR_CODES.BAD_REQUEST, "Candidate printing has no image URL");
  }
  const face = await faceForNewImage(
    trx,
    args.printingId,
    args.faceId === undefined
      ? { shortCode: candidatePrinting.shortCode }
      : { faceId: args.faceId },
  );
  const imageId = await trx.printingImages.insertImage(args.printingId, imageUrl, "main", face);
  assertFound(imageId, "Candidate printing image could not be attached");
  return imageId;
}

export async function acceptSubmission(
  transact: Transact,
  repos: Repos,
  io: Io,
  args: AcceptSubmissionArgs,
): Promise<AcceptSubmissionResult> {
  const { candidateCardId, adminUserId, now, cardFields, printingFields, newPrintings, images } =
    args;
  const candidate = await loadCandidate(repos, args);
  const submission = await loadPendingSubmission(repos, candidateCardId);

  const liveCard = await repos.cardSubmissions.liveCardByNormName(candidate.normName);
  const {
    usable: usableNewPrintings,
    skipped,
    collided,
  } = await partitionNewPrintings(repos, liveCard?.id ?? null, newPrintings);
  if (collided) {
    await relinkCandidatePrintings(repos);
  }
  const pickCount =
    cardFields.length + printingFields.length + usableNewPrintings.length + images.length;
  // A skip is not a decision: settling here would close the submission on nothing.
  if (pickCount === 0 && skipped.length > 0) {
    throw new AppError(
      400,
      ERROR_CODES.BAD_REQUEST,
      `Nothing could be applied. ${skipped.map((entry) => entry.reason).join("; ")}`,
    );
  }
  if (!liveCard && pickCount > 0) {
    throw new AppError(404, ERROR_CODES.NOT_FOUND, "No live card for this submission");
  }

  const created: NewPrinting[] = [];
  const imageIds: string[] = [];

  const { applied, status } = await withPrintingIdentityConflicts(transact)(async (trx) => {
    const inner: Transact = (fn) => fn(trx);
    let count = 0;

    if (liveCard && cardFields.length > 0) {
      const before = await trx.catalogMutations.getFullCardById(liveCard.id);
      for (const pick of cardFields) {
        await writeCardField(trx.catalogMutations, {
          cardId: liveCard.id,
          field: pick.field,
          value: normalizeCardFieldValue(pick.field, pick.value),
          previousName: before?.name ?? null,
        });
      }
      count += cardFields.length;
    }

    for (const pick of printingFields) {
      const side = await sideOfPick(trx, pick);
      const value = await normalizePrintingFieldValue(trx, {
        printingId: pick.printingId,
        field: pick.field,
        value: pick.value,
        source: pick.source,
        side,
      });
      await writePrintingField(inner, trx, {
        printingId: pick.printingId,
        field: pick.field,
        value,
        side,
      });
      count += 1;
    }

    if (liveCard && usableNewPrintings.length > 0) {
      for (const pick of usableNewPrintings) {
        created.push(
          await insertNewPrinting(trx, liveCard.id, pick.printingFields, [
            pick.candidatePrintingId,
          ]),
        );
      }
      count += usableNewPrintings.length;
    }

    for (const pick of images) {
      imageIds.push(await attachCandidateImage(trx, pick));
      count += 1;
    }

    await trx.candidateCards.checkCandidateCard(candidateCardId);
    // A skipped printing is still waiting on an admin list, so checking it here
    // would drop it out of the queue without anyone having decided anything.
    await trx.candidateCards.checkCandidatePrintingsForCard(
      candidateCardId,
      skipped.map((entry) => entry.candidatePrintingId),
    );

    const outcome: CardSubmissionStatus = count > 0 ? "accepted" : "not_applied";
    await trx.cardSubmissions.resolve(submission.id, {
      status: outcome,
      resolvedAt: now,
      resolvedByUserId: adminUserId,
      acceptedCardId: liveCard && count > 0 ? liveCard.id : null,
    });

    return { applied: count, status: outcome };
  });

  await finishPrintingAccepts(repos, io, created, { catalogChanged: applied > 0 });
  rehostImagesInBackground(io, repos.printingImages, imageIds);
  const createdPrintingIds = created.map((printing) => printing.printingId);
  if (status !== "accepted") {
    await discardSubmissionUploads(io, repos, candidateCardId);
  }

  await recordAdminEvent(repos, adminUserId, {
    action: "card-submission.accept",
    entityType: "card",
    entityId: liveCard?.id ?? null,
    entityLabel: candidate.name,
    cardSlug: liveCard?.slug ?? null,
    newValues: {
      candidateCardId,
      status,
      applied,
      cardFields: cardFields.map((pick) => pick.field),
      printingFields: printingFields.map((pick) => `${pick.printingId}:${pick.field}`),
      createdPrintingIds,
      images: images.length,
      skipped,
    },
  });

  return { status, applied, createdPrintingIds, skipped };
}

export async function rejectSubmission(
  transact: Transact,
  repos: Repos,
  io: Io,
  args: RejectSubmissionArgs,
): Promise<void> {
  const { candidateCardId, adminUserId, now, note, reason } = args;
  const candidate = await loadCandidate(repos, args);
  const submission = await loadPendingSubmission(repos, candidateCardId);

  await transact(async (trx) => {
    await trx.cardSubmissions.setResolutionMessage(submission.id, {
      reason,
      note,
      resolvedByUserId: adminUserId,
    });
    await trx.ignoredCandidates.ignoreCard({
      provider: candidate.provider,
      externalId: candidate.externalId,
    });
    await trx.cardSubmissions.resolve(submission.id, {
      status: "rejected",
      resolvedAt: now,
      resolvedByUserId: adminUserId,
    });
  });

  await discardSubmissionUploads(io, repos, candidateCardId);

  await recordAdminEvent(repos, adminUserId, {
    action: "card-submission.reject",
    entityType: "candidate-card",
    entityId: `${candidate.provider}:${candidate.externalId}`,
    entityLabel: candidate.name,
    newValues: { candidateCardId, reason, note },
  });
}

export async function moveSubmission(
  transact: Transact,
  repos: Repos,
  args: MoveSubmissionArgs,
): Promise<MoveSubmissionResult> {
  const { candidateCardId, adminUserId, cardId } = args;
  const candidate = await loadCandidate(repos, args);
  const submission = await loadPendingSubmission(repos, candidateCardId);
  const card = await repos.catalogMutations.getFullCardById(cardId);
  assertFound(card, "Card not found");
  if (card.normName === candidate.normName) {
    throw new AppError(400, ERROR_CODES.BAD_REQUEST, "Submission is already on this card");
  }

  await transact(async (trx) => {
    await trx.candidateCards.removePrintingLinkOverridesForCandidateCard(candidateCardId);
    await trx.candidateCards.moveCandidateCardToCard(candidateCardId, {
      name: card.name,
      normName: card.normName,
    });
    await trx.cardSubmissions.setCard(submission.id, { name: card.name, slug: card.slug });
  });

  await recordAdminEvent(repos, adminUserId, {
    action: "card-submission.move",
    entityType: "card",
    entityId: card.id,
    entityLabel: card.name,
    cardSlug: card.slug,
    newValues: { candidateCardId, from: candidate.name },
  });

  return { cardSlug: card.slug };
}
