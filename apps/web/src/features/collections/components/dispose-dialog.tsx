import { ParaglideMessage } from "@inlang/paraglide-js-react";
import type { CopyListMembershipsResponse } from "@openrift/shared/types/api/collection";
import { LoaderIcon, TriangleAlertIcon } from "lucide-react";
import { useState } from "react";

import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Callout } from "@/components/ui/callout";
import { DialogForm } from "@/components/ui/dialog-form";
import { Input } from "@/components/ui/input";
import { QuantityStepperField } from "@/components/ui/quantity-stepper";
import { disposeConfirmState } from "@/lib/dispose-confirm";
import { m } from "@/paraglide/messages.js";

interface DisposeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  count: number;
  quantity: number;
  onQuantityChange: (quantity: number) => void;
  singleCard?: boolean;
  onConfirm: () => void;
  isPending: boolean;
  memberships?: CopyListMembershipsResponse;
  membershipsLoading?: boolean;
  annotatedCount?: number;
}

/** Disposing hard-deletes each copy, so it silently drops off any list it's also on. */
export function DisposeDialog({
  open,
  onOpenChange,
  count,
  quantity,
  onQuantityChange,
  singleCard = false,
  onConfirm,
  isPending,
  memberships,
  membershipsLoading = false,
  annotatedCount = 0,
}: DisposeDialogProps) {
  const canChooseQuantity = singleCard && count > 1;
  const { showListWarning, needsTypeConfirm, copiesOnAnyList } = disposeConfirmState(
    quantity,
    memberships,
  );
  const listNote = m.collections_dialog_dispose_lists_note({
    count: quantity,
    listed: copiesOnAnyList,
  });

  const [confirmText, setConfirmText] = useState("");
  // Start blank on every reopen so an earlier typed value can't carry over, and
  // on every quantity change — the typed number has to match what is removed.
  const [blankedFor, setBlankedFor] = useState({ open, quantity });
  if (blankedFor.open !== open || blankedFor.quantity !== quantity) {
    setBlankedFor({ open, quantity });
    setConfirmText("");
  }

  const typedConfirmSatisfied = !needsTypeConfirm || confirmText.trim() === String(quantity);
  const confirmDisabled = isPending || membershipsLoading || !typedConfirmSatisfied;

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <DialogForm onSubmit={onConfirm}>
          <AlertDialogTitle>{m.collections_dialog_dispose_title()}</AlertDialogTitle>
          <AlertDialogDescription>
            {m.collections_dialog_dispose_description({ count: quantity })}
          </AlertDialogDescription>

          {canChooseQuantity && (
            <QuantityStepperField
              label={m.collections_dialog_dispose_quantity_label()}
              value={quantity}
              onValueChange={onQuantityChange}
              max={count}
              disabled={isPending}
            />
          )}

          {showListWarning && (
            <Callout variant="inset" className="flex gap-3 text-sm">
              <TriangleAlertIcon className="text-destructive mt-0.5 size-5 shrink-0" />
              <div className="space-y-1.5">
                <p className="font-medium">
                  {m.collections_dialog_dispose_lists_heading({ count: copiesOnAnyList })}
                </p>
                <p>{listNote}</p>
                <ul className="list-disc space-y-0.5 pl-4">
                  {memberships?.lists.map((list) => (
                    <li key={list.id}>
                      <span className="font-medium">{list.name}</span> ({list.copyCount})
                    </li>
                  ))}
                </ul>
              </div>
            </Callout>
          )}

          {annotatedCount > 0 && (
            <Callout variant="inset" className="flex gap-3 text-sm">
              <TriangleAlertIcon className="text-destructive mt-0.5 size-5 shrink-0" />
              <p>
                <span className="font-medium">
                  {m.collections_dialog_dispose_annotated_heading({ count: annotatedCount })}
                </span>{" "}
                {m.collections_dialog_dispose_annotated_note({ count: annotatedCount })}
              </p>
            </Callout>
          )}

          {needsTypeConfirm && (
            <div className="space-y-1.5">
              <label htmlFor="dispose-confirm" className="text-sm font-medium">
                <ParaglideMessage
                  message={m.collections_dialog_dispose_type}
                  inputs={{ quantity }}
                  markup={{ code: ({ children }) => <span className="font-mono">{children}</span> }}
                />
              </label>
              <Input
                id="dispose-confirm"
                value={confirmText}
                onChange={(event) => setConfirmText(event.target.value)}
                inputMode="numeric"
                autoComplete="off"
                placeholder={String(quantity)}
                disabled={isPending}
              />
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={isPending}>
              {m.common_cancel()}
            </Button>
            <Button type="submit" variant="destructive" disabled={confirmDisabled}>
              {membershipsLoading ? (
                <>
                  <LoaderIcon className="animate-spin" />
                  {m.collections_dialog_dispose_checking_lists()}
                </>
              ) : isPending ? (
                m.collections_dialog_removing()
              ) : (
                m.collections_dialog_dispose_confirm({ count: quantity })
              )}
            </Button>
          </div>
        </DialogForm>
      </AlertDialogContent>
    </AlertDialog>
  );
}
