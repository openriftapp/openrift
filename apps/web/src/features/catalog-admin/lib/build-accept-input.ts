import {
  isAcceptCardField,
  isAcceptPrintingField,
} from "@openrift/shared/contracts/admin/card-mutations";
import type { AcceptSubmissionInput } from "@openrift/shared/contracts/admin/catalog-review";

import type { AttentionSubmission } from "@/features/catalog-admin/lib/attention-items";
import { buildPrintingFieldsFromCandidate } from "@/features/catalog-admin/lib/printing-fields";

export interface AcceptPicks {
  ticked: ReadonlySet<string>;
  edits: ReadonlyMap<string, unknown>;
}

export interface AcceptSubmissionPlan {
  input: AcceptSubmissionInput;
  includedKeys: ReadonlySet<string>;
}

export function buildAcceptSubmissionInput(
  submission: AttentionSubmission,
  picks: AcceptPicks,
): AcceptSubmissionPlan {
  const cardFields: NonNullable<AcceptSubmissionInput["cardFields"]> = [];
  const printingFields: NonNullable<AcceptSubmissionInput["printingFields"]> = [];
  const newPrintings: NonNullable<AcceptSubmissionInput["newPrintings"]> = [];
  const images: NonNullable<AcceptSubmissionInput["images"]> = [];
  const includedKeys = new Set<string>();

  for (const group of submission.groups) {
    if (group.kind === "new-printing") {
      if (picks.ticked.has(group.key) && group.candidate) {
        newPrintings.push({
          candidatePrintingId: group.candidate.id,
          printingFields: buildPrintingFieldsFromCandidate(group.candidate),
        });
        includedKeys.add(group.key);
      }
      continue;
    }

    for (const change of group.changes) {
      if (!picks.ticked.has(change.key)) {
        continue;
      }
      const isEdited = picks.edits.has(change.key);
      const value = isEdited ? picks.edits.get(change.key) : change.proposed;

      if (change.field === "imageUrl") {
        if (group.printingId && group.candidate) {
          images.push({ candidatePrintingId: group.candidate.id, printingId: group.printingId });
          includedKeys.add(change.key);
        }
        continue;
      }
      if (group.kind === "card") {
        if (isAcceptCardField(change.field)) {
          cardFields.push({ field: change.field, value });
          includedKeys.add(change.key);
        }
        continue;
      }
      if (group.printingId && isAcceptPrintingField(change.field)) {
        printingFields.push({
          printingId: group.printingId,
          field: change.field,
          value,
          source: isEdited ? "manual" : "provider",
        });
        includedKeys.add(change.key);
      }
    }
  }

  return {
    input: {
      candidateCardId: submission.candidateCardId,
      cardFields,
      printingFields,
      newPrintings,
      images,
    },
    includedKeys,
  };
}

export function submissionTickKeys(submission: AttentionSubmission): string[] {
  return submission.groups.flatMap((group) =>
    group.kind === "new-printing" ? [group.key] : group.changes.map((change) => change.key),
  );
}

export function printingGroupTickKeys(
  submission: AttentionSubmission,
  printingId: string,
): string[] {
  return submission.groups
    .filter((group) => group.kind === "printing" && group.printingId === printingId)
    .flatMap((group) => group.changes.map((change) => change.key));
}
