import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DialogForm } from "@/components/ui/dialog-form";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { m } from "@/paraglide/messages.js";

interface WriteOffLoanDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cardName: string;
  outstanding: number;
  pending: boolean;
  onConfirm: (removeCopies: boolean) => void;
}

export function WriteOffLoanDialog({
  open,
  onOpenChange,
  cardName,
  outstanding,
  pending,
  onConfirm,
}: WriteOffLoanDialogProps) {
  const [removeCopies, setRemoveCopies] = useState(true);
  const single = outstanding === 1;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogForm onSubmit={() => onConfirm(removeCopies)}>
          <DialogHeader>
            <DialogTitle>{m.loans_write_off_title()}</DialogTitle>
            <DialogDescription>
              {single
                ? m.loans_write_off_description_one({ count: outstanding, card: cardName })
                : m.loans_write_off_description_other({ count: outstanding, card: cardName })}
            </DialogDescription>
          </DialogHeader>

          <RadioGroup
            value={removeCopies ? "remove" : "keep"}
            onValueChange={(value) => setRemoveCopies(value === "remove")}
            className="gap-2 py-1"
          >
            <label
              htmlFor="write-off-remove"
              className="hover:bg-muted/50 flex cursor-pointer items-start gap-3 rounded-md border p-3"
            >
              <RadioGroupItem id="write-off-remove" value="remove" className="mt-0.5" />
              <span className="flex flex-col gap-0.5">
                <span className="text-sm font-medium">{m.loans_write_off_remove_label()}</span>
                <span className="text-muted-foreground text-xs">
                  {single
                    ? m.loans_write_off_remove_hint_one()
                    : m.loans_write_off_remove_hint_other()}
                </span>
              </span>
            </label>
            <label
              htmlFor="write-off-keep"
              className="hover:bg-muted/50 flex cursor-pointer items-start gap-3 rounded-md border p-3"
            >
              <RadioGroupItem id="write-off-keep" value="keep" className="mt-0.5" />
              <span className="flex flex-col gap-0.5">
                <span className="text-sm font-medium">{m.loans_write_off_keep_label()}</span>
                <span className="text-muted-foreground text-xs">
                  {single ? m.loans_write_off_keep_hint_one() : m.loans_write_off_keep_hint_other()}
                </span>
              </span>
            </label>
          </RadioGroup>

          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>{m.common_cancel()}</DialogClose>
            <Button type="submit" variant="destructive" disabled={pending}>
              {m.loans_write_off_confirm()}
            </Button>
          </DialogFooter>
        </DialogForm>
      </DialogContent>
    </Dialog>
  );
}
