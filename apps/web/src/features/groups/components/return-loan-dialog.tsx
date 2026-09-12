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
import { QuantityStepper } from "@/components/ui/quantity-stepper";
import { m } from "@/paraglide/messages.js";

interface ReturnLoanDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  outstanding: number;
  pending: boolean;
  onConfirm: (quantity: number) => void;
}

export function ReturnLoanDialog({
  open,
  onOpenChange,
  outstanding,
  pending,
  onConfirm,
}: ReturnLoanDialogProps) {
  const [quantity, setQuantity] = useState(() => Math.max(1, outstanding));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogForm onSubmit={() => onConfirm(quantity)}>
          <DialogHeader>
            <DialogTitle>{m.loans_mark_returned()}</DialogTitle>
            <DialogDescription>{m.loans_return_description()}</DialogDescription>
          </DialogHeader>

          <div className="flex items-center justify-between gap-4 py-2">
            <span>{m.loans_copies_returned()}</span>
            <QuantityStepper
              value={quantity}
              onValueChange={setQuantity}
              max={Math.max(1, outstanding)}
              editable
            />
          </div>
          <p className="text-muted-foreground text-sm">
            {outstanding === 1
              ? m.loans_still_out_one({ count: outstanding })
              : m.loans_still_out_other({ count: outstanding })}
          </p>

          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>{m.common_cancel()}</DialogClose>
            <Button type="submit" disabled={pending}>
              {m.loans_mark_returned()}
            </Button>
          </DialogFooter>
        </DialogForm>
      </DialogContent>
    </Dialog>
  );
}
