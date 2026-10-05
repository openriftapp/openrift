import { enumLabel } from "@openrift/shared/enum-label";
import type { Printing } from "@openrift/shared/types/catalog";
import { useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
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
import { Input } from "@/components/ui/input";
import { QuantityStepper } from "@/components/ui/quantity-stepper";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { RadioOptionRow } from "@/components/ui/radio-option-row";
import { UserAvatar } from "@/components/user-avatar";
import { CardMetaLine } from "@/features/groups/components/trade-row-parts";
import { useCreateLoan, useLoanBorrowerOptions } from "@/features/groups/hooks/use-loans";
import { useEnumOrders } from "@/hooks/use-enums";
import { m } from "@/paraglide/messages.js";

const FREE_TEXT = "__name__";

interface LendCardDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  printing: Printing;
  cardName: string;
  maxQuantity: number;
  contextCollectionId?: string;
}

export function LendCardDialog({
  open,
  onOpenChange,
  printing,
  cardName,
  maxQuantity,
  contextCollectionId,
}: LendCardDialogProps) {
  const { data: options } = useLoanBorrowerOptions(open);
  const { labels } = useEnumOrders();
  const createLoan = useCreateLoan();

  const [quantity, setQuantity] = useState(1);
  const [borrower, setBorrower] = useState<string>(FREE_TEXT);
  const [name, setName] = useState("");

  const members = options?.members ?? [];
  const recentNames = options?.recentNames ?? [];
  const freeText = borrower === FREE_TEXT;
  const trimmedName = name.trim();
  const canConfirm = maxQuantity > 0 && (freeText ? trimmedName.length > 0 : true);

  function confirm(): void {
    createLoan.mutate(
      {
        printingId: printing.id,
        quantity,
        borrowerUserId: freeText ? undefined : borrower,
        borrowerName: freeText ? trimmedName : undefined,
        contextCollectionId,
      },
      {
        onSuccess: () => {
          onOpenChange(false);
          toast.success(m.loans_lent_toast({ card: cardName }));
        },
      },
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogForm onSubmit={confirm}>
          <DialogHeader>
            <DialogTitle>{m.loans_lend_title()}</DialogTitle>
            <DialogDescription>{m.loans_lend_description()}</DialogDescription>
          </DialogHeader>

          <div className="flex items-center gap-2">
            <span className="truncate text-sm font-medium">{cardName}</span>
            <CardMetaLine
              shortCode={printing.shortCode}
              rarity={printing.rarity}
              finish={printing.finish}
              finishLabel={enumLabel(labels.finishes, printing.finish)}
            />
          </div>

          <RadioGroup value={borrower} onValueChange={setBorrower} className="gap-1 py-1">
            {members.map((member) => (
              <RadioOptionRow
                key={member.userId}
                value={member.userId}
                title={
                  <span className="flex min-w-0 items-center gap-3">
                    <UserAvatar
                      image={member.image}
                      name={member.name}
                      gravatarHash={member.gravatarHash}
                      size="sm"
                    />
                    <span className="truncate">{member.name ?? m.loans_member_fallback()}</span>
                  </span>
                }
              />
            ))}
            <label className="hover:bg-muted/50 flex cursor-pointer items-start gap-3 rounded-md px-2 py-2">
              <RadioGroupItem value={FREE_TEXT} className="mt-2" />
              <span className="flex min-w-0 flex-1 flex-col gap-1.5">
                <Input
                  placeholder={
                    members.length > 0
                      ? m.loans_borrower_placeholder_other()
                      : m.loans_borrower_placeholder()
                  }
                  value={name}
                  aria-label={m.loans_borrower_name_label()}
                  onFocus={() => setBorrower(FREE_TEXT)}
                  onChange={(event) => setName(event.target.value)}
                />
                {recentNames.length > 0 && freeText ? (
                  <span className="flex flex-wrap gap-1">
                    {recentNames.map((recent) => (
                      <Badge
                        key={recent}
                        variant="secondary"
                        className="cursor-pointer"
                        onClick={() => setName(recent)}
                      >
                        {recent}
                      </Badge>
                    ))}
                  </span>
                ) : null}
              </span>
            </label>
          </RadioGroup>

          <div className="flex items-center justify-between gap-4">
            <span>{m.loans_how_many()}</span>
            <QuantityStepper
              value={quantity}
              onValueChange={setQuantity}
              max={Math.max(1, maxQuantity)}
              editable
            />
          </div>

          <DialogFooter>
            <DialogCancel />
            <Button type="submit" disabled={createLoan.isPending || !canConfirm}>
              {m.loans_lend_confirm()}
            </Button>
          </DialogFooter>
        </DialogForm>
      </DialogContent>
    </Dialog>
  );
}
