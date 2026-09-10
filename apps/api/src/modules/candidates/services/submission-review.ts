import type {
  AcceptCardField,
  AcceptPrintingBody,
  AcceptPrintingField,
  CreateCardBody,
} from "@openrift/shared/contracts/admin/card-mutations";
import { ERROR_CODES } from "@openrift/shared/error-codes";
import type { CardType, Domain, SuperType } from "@openrift/shared/types/enums";

import type { CardSubmissionReason, CardSubmissionStatus } from "../../../db/tables/candidates.js";
import type { Repos, Transact } from "../../../deps.js";
import { AppError } from "../../../errors.js";
import type { Io } from "../../../io.js";
import { assertFound } from "../../../lib/assertions.js";
import {
  normalizeCardFieldValue,
  writeCardField,
} from "../../catalog/services/card-field-writes.js";
import { rehostSingleImage } from "../../catalog/services/images/jobs.js";
import { acceptPrintingDeferringRehost } from "../../catalog/services/printing-admin.js";
import type { PrintingFieldSource } from "../../catalog/services/printing-field-writes.js";
import {
  normalizePrintingFieldValue,
  writePrintingField,
} from "../../catalog/services/printing-field-writes.js";
import { recordAdminEvent } from "../../system/services/record-admin-event.js";
import type { CardSubmissionRow } from "../repositories/card-submissions.js";
import { assertProvidersInScope } from "./card-review-scope.js";
import { relinkCandidatePrintings } from "./relink-candidates.js";
import { discardSubmissionUploads } from "./submission-uploads.js";

export interface CardFieldPick {
  field: AcceptCardField;
  value: unknown;
}

export interface PrintingFieldPick {
  printingId: string;
  field: AcceptPrintingField;
  value: unknown;
  source: PrintingFieldSource;
}

export interface NewPrintingPick {
  candidatePrintingId: string;
  printingFields: AcceptPrintingBody["printingFields"];
}

export interface ImagePick {
  candidatePrintingId: string;
  printingId: string;
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

export interface AcceptSubmissionResult {
  status: CardSubmissionStatus;
  applied: number;
  createdPrintingIds: string[];
}

export interface RejectSubmissionArgs extends ReviewerArgs {
  reason?: CardSubmissionReason | null;
  note: string | null;
}

export interface CreateCardFromCandidateArgs extends ReviewerArgs {
  cardFields: CreateCardBody;
  printings: NewPrintingPick[];
  images: { candidatePrintingId: string }[];
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
  const submission = await repos.cardSubmissions.findByCandidateCardId(candidateCardId);
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

async function attachCandidateImage(
  trx: Repos,
  args: { candidatePrintingId: string; printingId: string },
): Promise<string> {
  const candidatePrinting = await trx.printingImages.getCandidatePrintingById(
    args.candidatePrintingId,
  );
  assertFound(candidatePrinting, "Candidate printing not found");
  const { imageUrl } = candidatePrinting;
  if (!imageUrl) {
    throw new AppError(400, ERROR_CODES.BAD_REQUEST, "Candidate printing has no image URL");
  }
  const imageId = await trx.printingImages.insertImage(args.printingId, imageUrl, "main");
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

  const pickCount = cardFields.length + printingFields.length + newPrintings.length + images.length;
  const liveCard = await repos.cardSubmissions.liveCardByNormName(candidate.normName);
  if (!liveCard && pickCount > 0) {
    throw new AppError(404, ERROR_CODES.NOT_FOUND, "No live card for this submission");
  }

  const createdPrintingIds: string[] = [];
  const imageIds: string[] = [];

  const { applied, status } = await transact(async (trx) => {
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
      const value = await normalizePrintingFieldValue(trx, {
        printingId: pick.printingId,
        field: pick.field,
        value: pick.value,
        source: pick.source,
      });
      await writePrintingField(inner, trx, {
        printingId: pick.printingId,
        field: pick.field,
        value,
      });
      count += 1;
    }

    if (liveCard && newPrintings.length > 0) {
      for (const pick of newPrintings) {
        const created = await acceptPrintingDeferringRehost(
          inner,
          trx,
          liveCard.id,
          pick.printingFields,
          [pick.candidatePrintingId],
        );
        createdPrintingIds.push(created.printingId);
        imageIds.push(...created.imageIds);
      }
      count += newPrintings.length;
    }

    for (const pick of images) {
      imageIds.push(await attachCandidateImage(trx, pick));
      count += 1;
    }

    await trx.candidateCards.checkCandidateCard(candidateCardId);
    await trx.candidateCards.checkCandidatePrintingsForCard(candidateCardId);

    const outcome: CardSubmissionStatus = count > 0 ? "accepted" : "not_applied";
    await trx.cardSubmissions.resolve(submission.id, {
      status: outcome,
      resolvedAt: now,
      resolvedByUserId: adminUserId,
      acceptedCardId: liveCard && count > 0 ? liveCard.id : null,
    });

    return { applied: count, status: outcome };
  });

  if (applied > 0) {
    await repos.catalog.refreshCatalogViews();
  }
  if (createdPrintingIds.length > 0) {
    await relinkCandidatePrintings(repos);
  }
  for (const imageId of imageIds) {
    await rehostSingleImage(io, repos.printingImages, imageId);
  }
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
    },
  });

  return { status, applied, createdPrintingIds };
}

export async function rejectSubmission(
  transact: Transact,
  repos: Repos,
  io: Io,
  args: RejectSubmissionArgs,
): Promise<void> {
  const { candidateCardId, adminUserId, now, note } = args;
  const reason = args.reason ?? null;
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

/**
 * Also serves a scraped provider's new-card group, which has no ledger row: the
 * card is created and the candidate checked, and nothing is settled.
 */
export async function createCardFromCandidate(
  transact: Transact,
  repos: Repos,
  io: Io,
  args: CreateCardFromCandidateArgs,
): Promise<{ cardSlug: string; printingsCreated: number }> {
  const { candidateCardId, adminUserId, now, cardFields, printings, images } = args;
  const candidate = await loadCandidate(repos, args);
  const submission = await loadOpenSubmission(repos, candidateCardId);
  if (submission && submission.kind !== "new_card") {
    throw new AppError(400, ERROR_CODES.BAD_REQUEST, "Submission is not a new-card proposal");
  }

  const existing = await repos.cardSubmissions.liveCardByNormName(candidate.normName);
  if (existing) {
    throw new AppError(409, ERROR_CODES.CONFLICT, `Card already exists: ${existing.slug}`);
  }

  const imageIds: string[] = [];

  await transact(async (trx) => {
    const inner: Transact = (fn) => fn(trx);

    await trx.catalogMutations.acceptNewCardFromSources(
      cardFields as CreateCardBody & {
        types: CardType[];
        domains: Domain[];
        superTypes?: SuperType[];
      },
      candidate.normName,
    );

    const card = await trx.catalogMutations.getCardBySlug(cardFields.id);
    assertFound(card, "Created card not found");

    for (const pick of printings) {
      const created = await acceptPrintingDeferringRehost(
        inner,
        trx,
        card.id,
        pick.printingFields,
        [pick.candidatePrintingId],
      );
      imageIds.push(...created.imageIds);
    }

    for (const pick of images) {
      const candidatePrinting = await trx.printingImages.getCandidatePrintingById(
        pick.candidatePrintingId,
      );
      assertFound(candidatePrinting, "Candidate printing not found");
      if (!candidatePrinting.printingId) {
        throw new AppError(
          400,
          ERROR_CODES.BAD_REQUEST,
          "Candidate printing is not linked to a printing",
        );
      }
      imageIds.push(
        await attachCandidateImage(trx, {
          candidatePrintingId: pick.candidatePrintingId,
          printingId: candidatePrinting.printingId,
        }),
      );
    }

    await trx.candidateCards.checkCandidateCard(candidateCardId);
    await trx.candidateCards.checkCandidatePrintingsForCard(candidateCardId);

    if (submission) {
      await trx.cardSubmissions.resolve(submission.id, {
        status: "accepted",
        resolvedAt: now,
        resolvedByUserId: adminUserId,
        acceptedCardId: card.id,
      });
    }
  });

  await repos.catalog.refreshCatalogViews();
  await relinkCandidatePrintings(repos);
  for (const imageId of imageIds) {
    await rehostSingleImage(io, repos.printingImages, imageId);
  }

  await recordAdminEvent(repos, adminUserId, {
    action: "card-submission.create-card",
    entityType: "card",
    entityId: cardFields.id,
    entityLabel: cardFields.name,
    cardSlug: cardFields.id,
    newValues: { candidateCardId, printingsCreated: printings.length, images: images.length },
  });

  return { cardSlug: cardFields.id, printingsCreated: printings.length };
}
