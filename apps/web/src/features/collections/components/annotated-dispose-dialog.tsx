import { enumLabel } from "@openrift/shared/enum-label";
import type { CopyResponse } from "@openrift/shared/types/api/collection";
import { legendDisplayName } from "@openrift/shared/utils";

import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { DialogForm } from "@/components/ui/dialog-form";
import type { PendingAnnotatedDispose } from "@/features/collections/hooks/use-quick-add-actions";
import { useEnumOrders } from "@/hooks/use-enums";
import type { EnumLabels } from "@/lib/enum-labels";
import { m } from "@/paraglide/messages.js";

/** Lists what the copy has recorded, for the confirmation body (e.g. "graded PSA 9.5, notes"). */
function recordedDetails(copy: CopyResponse, labels: EnumLabels): string[] {
  const parts: string[] = [];
  if (copy.grader !== null && copy.grade !== null) {
    parts.push(
      m.collections_dialog_annotated_detail_graded({
        grader: enumLabel(labels.graders, copy.grader),
        grade: copy.grade,
      }),
    );
  }
  if (copy.condition !== null) {
    parts.push(
      m.collections_dialog_annotated_detail_condition({
        condition: enumLabel(labels.conditions, copy.condition),
      }),
    );
  }
  if (copy.isAltered) {
    parts.push(m.collections_dialog_annotated_detail_altered());
  }
  if (copy.notesPublic !== null || copy.notesPrivate !== null) {
    parts.push(m.collections_dialog_annotated_detail_notes());
  }
  if (copy.links.length > 0) {
    parts.push(
      copy.links.length === 1
        ? m.collections_dialog_annotated_detail_links_one({ count: copy.links.length })
        : m.collections_dialog_annotated_detail_links_other({ count: copy.links.length }),
    );
  }
  return parts;
}

/**
 * Only appears when a minus-button removal would destroy recorded details;
 * bare copies are removed silently. Stays mounted with a null `pending` so
 * open/close animates.
 */
export function AnnotatedDisposeDialog({
  pending,
  onConfirm,
  onCancel,
  isPending,
}: {
  pending: PendingAnnotatedDispose | null;
  onConfirm: () => void;
  onCancel: () => void;
  isPending: boolean;
}) {
  const { labels } = useEnumOrders();
  const details = pending ? recordedDetails(pending.copy, labels) : [];
  return (
    <AlertDialog
      open={pending !== null}
      onOpenChange={(open) => {
        if (!open) {
          onCancel();
        }
      }}
    >
      <AlertDialogContent>
        <DialogForm onSubmit={onConfirm}>
          <AlertDialogTitle>{m.collections_dialog_annotated_title()}</AlertDialogTitle>
          <AlertDialogDescription>
            {pending
              ? details.length > 0
                ? m.collections_dialog_annotated_body_with_details({
                    card: legendDisplayName(pending.printing.card),
                    details: details.join(", "),
                  })
                : m.collections_dialog_annotated_body({
                    card: legendDisplayName(pending.printing.card),
                  })
              : ""}
          </AlertDialogDescription>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={onCancel} disabled={isPending}>
              {m.common_cancel()}
            </Button>
            <Button type="submit" variant="destructive" disabled={isPending}>
              {isPending
                ? m.collections_dialog_removing()
                : m.collections_dialog_annotated_confirm()}
            </Button>
          </div>
        </DialogForm>
      </AlertDialogContent>
    </AlertDialog>
  );
}
