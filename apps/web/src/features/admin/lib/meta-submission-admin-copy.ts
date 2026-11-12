import type { MetaSubmissionResolution } from "@openrift/shared/contracts/admin/meta-submissions";
import type { MetaSubmissionReason } from "@openrift/shared/types/enums";

export const metaSubmissionReasonLabels: Record<MetaSubmissionReason, string> = {
  duplicate: "Already submitted",
  already_correct: "Already in the archive",
  unverified: "Could not verify",
  incomplete_list: "Too little of the list",
  not_an_event: "No tournament behind it",
};

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
