import type { AdminCardSubmission } from "@openrift/shared/contracts/admin/card-submissions";
import type { CardSubmissionStatusResponse } from "@openrift/shared/contracts/card-submissions";

import { isoOrNull } from "../../../lib/iso-date.js";
import type { CardSubmissionRow } from "../repositories/card-submissions.js";

/**
 * `proposedDiff`, `candidateCardId` and `acceptedCardId` are deliberately not
 * exposed: they are review-side bookkeeping, and the first would tell a
 * contributor which of their fields the catalog disagreed with before anyone
 * had looked at it.
 */
export function toCardSubmissionStatus(row: CardSubmissionRow): CardSubmissionStatusResponse {
  return {
    id: row.id,
    kind: row.kind,
    cardName: row.cardName,
    cardSlug: row.cardSlug,
    status: row.status,
    note: row.note,
    reason: row.resolutionReason,
    resolutionNote: row.resolutionNote,
    createdAt: row.createdAt.toISOString(),
    resolvedAt: isoOrNull(row.resolvedAt),
  };
}

export function toAdminCardSubmission(row: CardSubmissionRow): AdminCardSubmission {
  return {
    id: row.id,
    kind: row.kind,
    status: row.status,
    cardName: row.cardName,
    note: row.note,
    reason: row.resolutionReason,
    resolutionNote: row.resolutionNote,
    resolvedAt: isoOrNull(row.resolvedAt),
  };
}
