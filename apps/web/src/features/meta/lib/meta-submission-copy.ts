import type { MetaSubmissionResolution } from "@openrift/shared/contracts/admin/meta-submissions";
import { META_SUBMISSION_REASONS } from "@openrift/shared/types/enums";
import type {
  MetaCreditVisibility,
  MetaListStatus,
  MetaSubmissionKind,
  MetaSubmissionReason,
  MetaSubmissionStatus,
} from "@openrift/shared/types/enums";

import { m } from "@/paraglide/messages.js";

export function metaSubmissionKindLabels(): Record<MetaSubmissionKind, string> {
  return {
    new_list: m.meta_submission_kind_new_list(),
    completion: m.meta_submission_kind_completion(),
    correction: m.meta_submission_kind_correction(),
    event_correction: m.meta_submission_kind_event_correction(),
  };
}

/** The three the decklist form covers; an event correction has its own dialog. */
export type MetaDeckSubmissionKind = Exclude<MetaSubmissionKind, "event_correction">;

export function metaSubmissionFormTitles(): Record<MetaDeckSubmissionKind, string> {
  return {
    new_list: m.meta_submission_form_title_new_list(),
    completion: m.meta_submission_form_title_completion(),
    correction: m.meta_submission_form_title_correction(),
  };
}

export function metaSubmissionStatusLabels(): Record<MetaSubmissionStatus, string> {
  return {
    pending: m.meta_submission_status_pending(),
    accepted: m.meta_submission_status_accepted(),
    already_correct: m.meta_submission_status_already_correct(),
    not_applied: m.meta_submission_status_not_used(),
    rejected: m.meta_submission_status_not_used(),
  };
}

/** `not_applied` and `rejected` share a variant: the split is an internal signal, not something to show a submitter. */
export const metaSubmissionStatusBadgeVariant: Record<
  MetaSubmissionStatus,
  "secondary" | "success" | "outline"
> = {
  pending: "secondary",
  accepted: "success",
  already_correct: "outline",
  not_applied: "outline",
  rejected: "outline",
};

export function metaSubmissionStatusHints(): Record<MetaSubmissionStatus, string | null> {
  return {
    pending: m.meta_submission_hint_pending(),
    accepted: m.meta_submission_hint_accepted(),
    already_correct: m.meta_submission_hint_already_correct(),
    not_applied: null,
    rejected: null,
  };
}

/** An event correction carries no decklist, so it drops the two list-related reasons. */
export function metaSubmissionReasonsFor(
  kind: MetaSubmissionKind,
): readonly MetaSubmissionReason[] {
  if (kind !== "event_correction") {
    return META_SUBMISSION_REASONS;
  }
  return ["already_correct", "unverified", "not_an_event"];
}

/** Worded to cover every kind: a wrong-date submitter must not read that the archive already had their list. */
export function metaSubmissionReasonSentences(): Record<MetaSubmissionReason, string> {
  return {
    duplicate: m.meta_submission_reason_duplicate(),
    already_correct: m.meta_submission_reason_already_correct(),
    unverified: m.meta_submission_reason_unverified(),
    incomplete_list: m.meta_submission_reason_incomplete_list(),
    not_an_event: m.meta_submission_reason_not_an_event(),
  };
}

export const metaSubmissionReasonLabels: Record<MetaSubmissionReason, string> = {
  duplicate: "Already submitted",
  already_correct: "Already in the archive",
  unverified: "Could not verify",
  incomplete_list: "Too little of the list",
  not_an_event: "No tournament behind it",
};

/** Distinct from {@link metaSubmissionStatusLabels}, which prints the same words for both outcomes so a submitter isn't pointed at. */
export const metaSubmissionResolutionLabels: Record<MetaSubmissionResolution, string> = {
  already_correct: "Already in the archive",
  not_applied: "Reviewed, nothing taken",
  rejected: "Reject",
};

export const metaSubmissionResolutionHints: Record<MetaSubmissionResolution, string> = {
  already_correct: "The archive already had this. The usual outcome for a second sender.",
  not_applied: "Read it, took nothing from it, and it is nobody's fault.",
  rejected: "Turned down. Records a signal about the submission, so keep it for real problems.",
};

export function metaSubmissionExplanation(
  reason: MetaSubmissionReason | null,
  note: string | null,
): string | null {
  if (note) {
    return note;
  }
  return reason ? metaSubmissionReasonSentences()[reason] : null;
}

/** `none` is not among them: a submission is a decklist, a standings-only entry never comes from a person. */
export type MetaSubmissionCompleteness = Exclude<MetaListStatus, "none">;

export function metaSubmissionCompletenessLabels(): Record<MetaSubmissionCompleteness, string> {
  return {
    full: m.meta_submission_completeness_full(),
    partial: m.meta_submission_completeness_partial(),
  };
}

export function metaCreditVisibilityLabels(): Record<MetaCreditVisibility, string> {
  return {
    hidden: m.meta_credit_visibility_hidden_label(),
    name: m.meta_credit_visibility_name_label(),
    riot_id: m.meta_credit_visibility_riot_id_label(),
  };
}

export function metaCreditVisibilityHints(): Record<MetaCreditVisibility, string> {
  return {
    hidden: m.meta_credit_visibility_hidden_hint(),
    name: m.meta_credit_visibility_name_hint(),
    riot_id: m.meta_credit_visibility_riot_id_hint(),
  };
}

/** Must mirror the server's own two fallbacks or it promises a line the event page won't produce. */
export interface MetaCreditPreview {
  creditedAs: string | null;
  usesDisplayNameFallback: boolean;
}

export function metaCreditPreview(
  visibility: MetaCreditVisibility,
  profile: { name?: string | null; riotId?: string | null },
): MetaCreditPreview {
  const name = profile.name?.trim() ?? "";
  const riotId = profile.riotId?.trim() ?? "";

  if (visibility === "hidden") {
    return { creditedAs: null, usesDisplayNameFallback: false };
  }
  if (visibility === "riot_id") {
    if (riotId.length > 0) {
      return { creditedAs: riotId, usesDisplayNameFallback: false };
    }
    return { creditedAs: name.length > 0 ? name : null, usesDisplayNameFallback: true };
  }
  return { creditedAs: name.length > 0 ? name : null, usesDisplayNameFallback: false };
}
