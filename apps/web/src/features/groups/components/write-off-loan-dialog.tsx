import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogCancel,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DialogForm } from "@/components/ui/dialog-form";
import { RadioGroup } from "@/components/ui/radio-group";
import { RadioOptionRow } from "@/components/ui/radio-option-row";
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogForm onSubmit={() => onConfirm(removeCopies)}>
          <DialogHeader>
            <DialogTitle>{m.loans_write_off_title()}</DialogTitle>
            <DialogDescription>
              {m.loans_write_off_description({ count: outstanding, card: cardName })}
            </DialogDescription>
          </DialogHeader>

          <RadioGroup
            value={removeCopies ? "remove" : "keep"}
            onValueChange={(value) => setRemoveCopies(value === "remove")}
            className="gap-1 py-1"
          >
            <RadioOptionRow
              value="remove"
              title={m.loans_write_off_remove_label()}
              description={m.loans_write_off_remove_hint({ count: outstanding })}
            />
            <RadioOptionRow
              value="keep"
              title={m.loans_write_off_keep_label()}
              description={m.loans_write_off_keep_hint({ count: outstanding })}
            />
          </RadioGroup>

          <DialogFooter>
            <DialogCancel />
            <Button type="submit" variant="destructive" disabled={pending}>
              {m.loans_write_off_confirm()}
            </Button>
          </DialogFooter>
        </DialogForm>
      </DialogContent>
    </Dialog>
  );
}
