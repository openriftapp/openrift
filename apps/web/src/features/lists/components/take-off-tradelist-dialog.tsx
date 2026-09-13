import { ParaglideMessage } from "@inlang/paraglide-js-react";
import type { CopyListMembershipsResponse } from "@openrift/shared/types/api/collection";
import { LoaderIcon, TriangleAlertIcon } from "lucide-react";
import { useState } from "react";

import { Alert } from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { DialogForm } from "@/components/ui/dialog-form";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { disposeConfirmState } from "@/lib/dispose-confirm";
import { m } from "@/paraglide/messages.js";

type Outcome = "keep" | "sold";

interface TakeOffTradelistDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  count: number;
  onKeep: () => void;
  onSold: () => void;
  isPending: boolean;
  memberships?: CopyListMembershipsResponse;
  membershipsLoading?: boolean;
  reservedCount?: number;
}

export function TakeOffTradelistDialog({
  open,
  onOpenChange,
  count,
  onKeep,
  onSold,
  isPending,
  memberships,
  membershipsLoading = false,
  reservedCount = 0,
}: TakeOffTradelistDialogProps) {
  const { showListWarning, needsTypeConfirm, copiesOnAnyList } = disposeConfirmState(
    count,
    memberships,
  );
  // A copy pinned to a live trade can't be disposed without breaking the trade,
  // so block the sold outcome entirely when any target is reserved.
  const soldBlocked = reservedCount > 0;

  const [outcome, setOutcome] = useState<Outcome>("keep");
  const [confirmText, setConfirmText] = useState("");
  const [seededOpen, setSeededOpen] = useState(open);
  if (seededOpen !== open) {
    setSeededOpen(open);
    if (!open) {
      setOutcome("keep");
      setConfirmText("");
    }
  }

  const sold = outcome === "sold";
  const typedConfirmSatisfied = !needsTypeConfirm || confirmText.trim() === String(count);
  const confirmDisabled = isPending || (sold && (membershipsLoading || !typedConfirmSatisfied));

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <DialogForm onSubmit={() => (sold ? onSold() : onKeep())}>
          <AlertDialogTitle>{m.lists_entry_takeoff_title({ count })}</AlertDialogTitle>
          <AlertDialogDescription>{m.lists_entry_takeoff_what({ count })}</AlertDialogDescription>

          <RadioGroup value={outcome} onValueChange={(value) => setOutcome(value as Outcome)}>
            <label
              htmlFor="take-off-keep"
              className="hover:bg-muted/50 flex cursor-pointer items-start gap-3 rounded-lg border p-3"
            >
              <RadioGroupItem id="take-off-keep" value="keep" className="mt-0.5" />
              <span className="space-y-0.5">
                <span className="block font-medium">{m.lists_entry_takeoff_keep({ count })}</span>
                <span className="text-muted-foreground block text-sm">
                  {m.lists_entry_takeoff_keep_hint({ count })}
                </span>
              </span>
            </label>
            <label
              htmlFor="take-off-sold"
              className={
                soldBlocked
                  ? "flex items-start gap-3 rounded-lg border p-3 opacity-60"
                  : "hover:bg-muted/50 flex cursor-pointer items-start gap-3 rounded-lg border p-3"
              }
            >
              <RadioGroupItem
                id="take-off-sold"
                value="sold"
                disabled={soldBlocked}
                className="mt-0.5"
              />
              <span className="space-y-0.5">
                <span className="block font-medium">{m.lists_entry_takeoff_sold({ count })}</span>
                <span className="text-muted-foreground block text-sm">
                  {m.lists_entry_takeoff_sold_hint({ count })}
                </span>
                {soldBlocked && (
                  <span className="text-muted-foreground flex items-start gap-1.5 text-sm">
                    <TriangleAlertIcon className="text-destructive mt-0.5 size-4 shrink-0" />
                    <span>
                      {reservedCount === count
                        ? m.lists_entry_takeoff_reserved_all({ count })
                        : m.lists_entry_takeoff_reserved_some({ count: reservedCount })}
                    </span>
                  </span>
                )}
              </span>
            </label>
          </RadioGroup>

          {sold && showListWarning && (
            <Alert variant="destructive" className="flex gap-3">
              <TriangleAlertIcon className="mt-0.5 size-5 shrink-0" />
              <div className="space-y-1.5">
                <p className="font-medium">
                  {m.lists_entry_takeoff_alsolists({ count: copiesOnAnyList })}
                </p>
                <p>{m.lists_entry_takeoff_drops({ count })}</p>
                <ul className="list-disc space-y-0.5 pl-4">
                  {memberships?.lists.map((list) => (
                    <li key={list.id}>
                      <span className="font-medium">{list.name}</span> ({list.copyCount})
                    </li>
                  ))}
                </ul>
              </div>
            </Alert>
          )}

          {sold && needsTypeConfirm && (
            <div className="space-y-1.5">
              <label htmlFor="take-off-confirm" className="text-sm font-medium">
                <ParaglideMessage
                  message={m.lists_entry_takeoff_type_confirm}
                  inputs={{ count }}
                  markup={{ code: ({ children }) => <span className="font-mono">{children}</span> }}
                />
              </label>
              <Input
                id="take-off-confirm"
                value={confirmText}
                onChange={(event) => setConfirmText(event.target.value)}
                inputMode="numeric"
                autoComplete="off"
                placeholder={String(count)}
                disabled={isPending}
              />
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={isPending}>
              {m.common_cancel()}
            </Button>
            <Button
              type="submit"
              variant={sold ? "destructive" : "default"}
              disabled={confirmDisabled}
            >
              {sold && membershipsLoading ? (
                <>
                  <LoaderIcon className="animate-spin" />
                  {m.lists_entry_takeoff_checking()}
                </>
              ) : isPending ? (
                sold ? (
                  m.lists_entry_takeoff_removing()
                ) : (
                  m.lists_entry_takeoff_takingoff()
                )
              ) : sold ? (
                m.lists_entry_takeoff_remove({ count })
              ) : (
                m.lists_entry_take_off()
              )}
            </Button>
          </div>
        </DialogForm>
      </AlertDialogContent>
    </AlertDialog>
  );
}
