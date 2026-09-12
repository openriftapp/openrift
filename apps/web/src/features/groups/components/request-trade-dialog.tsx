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
import { maxTradeQuantity } from "@/features/groups/lib/trade-derivation";
import { m } from "@/paraglide/messages.js";

interface RequestTradeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "request" | "offer";
  cardName: string;
  availableCount: number;
  demandQuantity: number;
  pending: boolean;
  onConfirm: (quantity: number) => void;
}

export function RequestTradeDialog({
  open,
  onOpenChange,
  mode,
  cardName,
  availableCount,
  demandQuantity,
  pending,
  onConfirm,
}: RequestTradeDialogProps) {
  const maxQuantity = maxTradeQuantity(demandQuantity, availableCount);
  const [quantity, setQuantity] = useState(() => Math.max(1, maxQuantity));

  const title = mode === "request" ? m.trades_request_card_title() : m.trades_offer_card_title();
  const verb = mode === "request" ? m.trades_send_request() : m.trades_send_offer();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogForm onSubmit={() => onConfirm(quantity)}>
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>
              {mode === "request"
                ? m.trades_request_description({ card: cardName })
                : m.trades_offer_description({ card: cardName })}
            </DialogDescription>
          </DialogHeader>

          <div className="flex items-center justify-between gap-4 py-2">
            <span>{m.trades_how_many()}</span>
            <QuantityStepper
              value={quantity}
              onValueChange={setQuantity}
              max={Math.max(1, maxQuantity)}
              editable
            />
          </div>
          <p className="text-muted-foreground text-sm">
            {mode === "offer"
              ? m.trades_offer_counts({ want: demandQuantity, have: availableCount })
              : m.trades_request_counts({ want: demandQuantity, available: availableCount })}
          </p>

          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>{m.common_cancel()}</DialogClose>
            <Button type="submit" disabled={pending || maxQuantity <= 0}>
              {verb}
            </Button>
          </DialogFooter>
        </DialogForm>
      </DialogContent>
    </Dialog>
  );
}
