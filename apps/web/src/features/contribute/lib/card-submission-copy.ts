import type {
  CardSubmissionKind,
  CardSubmissionReason,
  CardSubmissionStatus,
} from "@openrift/shared/contracts/card-submissions";

import { m } from "@/paraglide/messages.js";

/**
 * The words a contributor sees for their own submissions, and the same words
 * the admin picks from when replying. Kept in one module so the reason an admin
 * chooses and the sentence the contributor reads can never drift apart.
 */

export function submissionStatusLabels(): Record<CardSubmissionStatus, string> {
  return {
    pending: m.contribute_status_pending(),
    accepted: m.contribute_status_accepted(),
    already_correct: m.contribute_status_already_correct(),
    not_applied: m.contribute_status_not_used(),
    rejected: m.contribute_status_not_used(),
  };
}

/**
 * `not_applied` and `rejected` deliberately look the same: the split is an
 * internal abuse signal, not something to show a good-faith contributor.
 */
export const submissionStatusBadgeVariant: Record<
  CardSubmissionStatus,
  "secondary" | "success" | "outline"
> = {
  pending: "secondary",
  accepted: "success",
  already_correct: "outline",
  not_applied: "outline",
  rejected: "outline",
};

export function submissionStatusHints(): Record<CardSubmissionStatus, string | null> {
  return {
    pending: m.contribute_status_hint_pending(),
    accepted: m.contribute_status_hint_accepted(),
    already_correct: m.contribute_status_hint_already_correct(),
    not_applied: null,
    rejected: null,
  };
}

export function submissionKindLabels(): Record<CardSubmissionKind, string> {
  return {
    new_card: m.contribute_kind_new_card(),
    correction: m.contribute_kind_correction(),
    image: m.contribute_kind_image(),
  };
}

export function submissionReasonSentences(): Record<CardSubmissionReason, string> {
  return {
    duplicate: m.contribute_reason_duplicate(),
    already_correct: m.contribute_reason_already_correct(),
    unverified: m.contribute_reason_unverified(),
    not_a_card: m.contribute_reason_not_a_card(),
    bad_image: m.contribute_reason_bad_image(),
    other: m.contribute_reason_other(),
  };
}

export function submissionReasonLabels(): Record<CardSubmissionReason, string> {
  return {
    duplicate: m.contribute_reason_label_duplicate(),
    already_correct: m.contribute_status_already_correct(),
    unverified: m.contribute_reason_label_unverified(),
    not_a_card: m.contribute_reason_label_not_a_card(),
    bad_image: m.contribute_reason_label_bad_image(),
    other: m.contribute_reason_label_other(),
  };
}

export function submissionExplanation(
  reason: CardSubmissionReason | null,
  note: string | null,
): string | null {
  if (note) {
    return note;
  }
  return reason ? submissionReasonSentences()[reason] : null;
}
