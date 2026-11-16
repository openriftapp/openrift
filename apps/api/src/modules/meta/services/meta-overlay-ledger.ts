import type { MetaSubmissionReason } from "@openrift/shared/types/enums";

import type { Repos } from "../../../deps.js";
import type { MetaEventOverlayRow, MetaPlayerOverlayRow } from "../repositories/meta-overlays.js";
import type { MetaSubmissionRow } from "../repositories/meta-submissions.js";

/**
 * Settles the ledger row and credit behind an accepted overlay. Must run
 * after promotion, which resolves the overlay's live player row. Returns the
 * ledger row as it stood when this accept moved it to accepted.
 */
export async function recordOverlayAcceptance(
  repos: Repos,
  overlayId: string,
  metaEventId: string,
  reviewedByUserId: string | null,
  now: Date,
): Promise<MetaSubmissionRow | null> {
  const submission = await repos.metaSubmissions.byPlayerOverlayId(overlayId);
  if (submission === null) {
    return null;
  }
  const settled = await repos.metaOverlays.playerOverlayById(overlayId);
  const metaEventPlayerId = settled?.metaEventPlayerId ?? null;
  const player =
    metaEventPlayerId === null ? undefined : await repos.meta.playerById(metaEventPlayerId);
  await repos.metaSubmissions.recordAcceptance({
    submissionId: submission.id,
    credit: { metaEventId, metaEventPlayerId, userId: submission.userId },
    acceptedDeckId: player?.deckId ?? null,
    resolvedAt: now,
    resolvedByUserId: reviewedByUserId,
  });
  return submission.status === "accepted" ? null : submission;
}

export interface MetaSubmissionResolution {
  reason?: MetaSubmissionReason | null;
  note?: string | null;
  resolvedByUserId?: string | null;
}

/**
 * Settles the ledger rows behind player overlays about to be rejected. An
 * accepted one goes back to rejected and gives up its credit. Must run before
 * the promote, which may drop the row the credit names.
 */
export async function settleRejectedSubmissions(
  repos: Repos,
  overlays: readonly MetaPlayerOverlayRow[],
  eventIds: ReadonlyMap<string, string | null>,
  resolution: MetaSubmissionResolution,
  now: Date,
): Promise<void> {
  const byOverlay = new Map(overlays.map((overlay) => [overlay.id, overlay]));
  const submissions = await repos.metaSubmissions.byPlayerOverlayIds([...byOverlay.keys()]);
  for (const submission of submissions) {
    const overlay =
      submission.playerOverlayId === null ? undefined : byOverlay.get(submission.playerOverlayId);
    if (overlay === undefined) {
      continue;
    }
    const metaEventId = eventIds.get(overlay.id) ?? null;
    if (submission.status === "accepted" && metaEventId !== null) {
      await repos.metaSubmissions.revokeAcceptance({
        submissionId: submission.id,
        credit: {
          metaEventId,
          metaEventPlayerId: overlay.metaEventPlayerId,
          userId: submission.userId,
        },
        resolvedAt: now,
        reason: resolution.reason ?? null,
        note: resolution.note ?? null,
        resolvedByUserId: resolution.resolvedByUserId ?? null,
      });
      continue;
    }
    if (submission.status === "pending" || submission.status === "accepted") {
      await repos.metaSubmissions.resolve(submission.id, {
        status: "rejected",
        resolvedAt: now,
        reason: resolution.reason ?? null,
        note: resolution.note ?? null,
        resolvedByUserId: resolution.resolvedByUserId ?? null,
        acceptedDeckId: null,
      });
    }
  }
}

/** Must run while the overlay still carries the `accepted_at` its correction was settled with. */
export async function revokeEventCorrection(
  repos: Repos,
  overlay: MetaEventOverlayRow,
  resolution: MetaSubmissionResolution,
  now: Date,
): Promise<void> {
  if (overlay.status !== "accepted" || overlay.metaEventId === null) {
    return;
  }
  const submission = await repos.metaSubmissions.acceptedCorrectionForOverlay(overlay);
  if (submission === null) {
    return;
  }
  await repos.metaSubmissions.revokeAcceptance({
    submissionId: submission.id,
    credit: {
      metaEventId: overlay.metaEventId,
      metaEventPlayerId: null,
      userId: submission.userId,
    },
    resolvedAt: now,
    reason: resolution.reason ?? null,
    note: resolution.note ?? null,
    resolvedByUserId: resolution.resolvedByUserId ?? null,
  });
}
