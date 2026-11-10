import type { CardSubmissionReason } from "@openrift/shared/contracts/card-submissions";

export const REJECT_REASON_ORDER: readonly CardSubmissionReason[] = [
  "duplicate",
  "already_correct",
  "unverified",
  "not_a_card",
  "bad_image",
  "other",
];

export const CARD_NOTE_PLACEHOLDER = "Shown to the contributor under the sentence above.";

export function canSendRejection(reason: CardSubmissionReason | null, note: string): boolean {
  if (reason === null) {
    return false;
  }
  return reason !== "other" || note.trim().length > 0;
}
