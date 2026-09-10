import type { AdminAuditEventResponse } from "@openrift/shared/contracts/admin/audit-events";

import {
  CARD_FIELD_LABELS,
  PRINTING_FIELD_LABELS,
} from "@/features/catalog-admin/lib/catalog-field-labels";

export const HISTORY_FILTERS = ["all", "submissions", "edits", "sources"] as const;
export type HistoryFilter = (typeof HISTORY_FILTERS)[number];

export const HISTORY_FILTER_LABELS: Record<HistoryFilter, string> = {
  all: "All",
  submissions: "Submissions",
  edits: "Edits",
  sources: "Sources",
};

export type HistoryKind = Exclude<HistoryFilter, "all">;

export type SubmissionOutcome = "accepted" | "not_applied" | "rejected";

export const SUBMISSION_OUTCOME_LABELS: Record<SubmissionOutcome, string> = {
  accepted: "Accepted",
  not_applied: "Not applied",
  rejected: "Rejected",
};

const ACTION_SENTENCES: Record<string, string> = {
  "ban.add": "Added a ban",
  "ban.delete": "Removed a ban",
  "ban.update": "Edited a ban",
  "candidate-card.ignore": "Ignored a source for this card",
  "candidate-card.unignore": "Stopped ignoring a source for this card",
  "candidate-printing.copy": "Copied an incoming row onto a printing",
  "candidate-printing.delete": "Deleted an incoming row",
  "candidate-printing.ignore": "Ignored an incoming row",
  "candidate-printing.link": "Linked an incoming row to a printing",
  "candidate-printing.patch": "Edited an incoming row",
  "candidate-printing.relink": "Relinked incoming rows",
  "candidate-printing.unignore": "Stopped ignoring an incoming row",
  "candidates.upload": "Uploaded fresh data from a source",
  "card-submission.accept": "Accepted a contributor submission",
  "card-submission.create-card": "Created the card from a contributor submission",
  "card-submission.reject": "Rejected a contributor submission",
  "card-submission.resolution": "Wrote back to the contributor",
  "card.accept-favorites": "Created the card from trusted sources",
  "card.accept-new": "Created the card from a source",
  "card.create": "Created the card",
  "card.delete": "Deleted the card",
  "card.link-unmatched": "Pointed an incoming name at this card",
  "card.rename": "Changed the card ID",
  "card.update": "Edited the card",
  "citation.create": "Added a citation",
  "citation.delete": "Removed a citation",
  "citation.update": "Edited a citation",
  "errata.delete": "Removed the errata",
  "errata.upload": "Uploaded errata in bulk",
  "errata.upsert": "Saved the errata",
  "image.activate": "Made an image the one shown",
  "image.add-url": "Added an image by link",
  "image.credit": "Changed an image credit",
  "image.delete": "Deleted an image",
  "image.face": "Changed which face an image shows",
  "image.quad": "Straightened an image",
  "image.rehost": "Took a copy of an image",
  "image.rotate": "Rotated an image",
  "image.set-from-candidate": "Took the image from a source",
  "image.set-needs-trim": "Flagged an image for trimming",
  "image.unrehost": "Dropped the local copy of an image",
  "image.upload": "Uploaded an image",
  "printing.accept": "Added a printing",
  "printing.accept-favorites": "Added printings from trusted sources",
  "printing.create": "Added a printing",
  "printing.delete": "Deleted a printing",
  "printing.fallback-art": "Changed the stand-in art",
  "printing.update": "Edited a printing",
  "provider.delete-candidates": "Removed a source's data",
};

const FIELD_LABELS: Record<string, string> = {
  ...CARD_FIELD_LABELS,
  ...PRINTING_FIELD_LABELS,
  comment: "Comment",
  maxCopiesOverride: "Max copies override",
};

function changedFields(event: AdminAuditEventResponse): string[] {
  const keys = [
    ...new Set([...Object.keys(event.oldValues ?? {}), ...Object.keys(event.newValues ?? {})]),
  ];
  return keys.map((key) => FIELD_LABELS[key] ?? key);
}

export function historyKind(action: string): HistoryKind {
  if (action.startsWith("card-submission.")) {
    return "submissions";
  }
  if (
    action.startsWith("candidate-card.") ||
    action.startsWith("candidate-printing.") ||
    action.startsWith("candidates.") ||
    action.startsWith("provider.")
  ) {
    return "sources";
  }
  return "edits";
}

export function historySentence(event: AdminAuditEventResponse): string {
  if (event.action === "card.accept-field" || event.action === "printing.accept-field") {
    const fields = changedFields(event);
    const suffix = event.action === "printing.accept-field" ? " on a printing" : "";
    return fields.length === 0
      ? `Changed a field${suffix}`
      : `Changed ${fields.join(", ")}${suffix}`;
  }
  return ACTION_SENTENCES[event.action] ?? event.action;
}

export function submissionOutcome(event: AdminAuditEventResponse): SubmissionOutcome | null {
  if (event.action === "card-submission.reject") {
    return "rejected";
  }
  if (event.action !== "card-submission.accept") {
    return null;
  }
  return event.newValues?.status === "not_applied" ? "not_applied" : "accepted";
}

export function filterHistoryEvents(
  events: readonly AdminAuditEventResponse[],
  cardSlug: string,
  filter: HistoryFilter,
): AdminAuditEventResponse[] {
  // A rejection is recorded against the incoming row, which carries no card slug.
  function belongsToCard(event: AdminAuditEventResponse): boolean {
    if (event.cardSlug !== null) {
      return event.cardSlug === cardSlug;
    }
    return historyKind(event.action) === "submissions";
  }

  return events.filter(
    (event) => belongsToCard(event) && (filter === "all" || historyKind(event.action) === filter),
  );
}
