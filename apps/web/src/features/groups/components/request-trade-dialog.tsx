import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import type { MatchCopyDetail } from "@/features/groups/lib/trade-derivation";
import { matchCopyConditionLabel, maxTradeQuantity } from "@/features/groups/lib/trade-derivation";
import { useEnumOrders } from "@/hooks/use-enums";
import { m } from "@/paraglide/messages.js";

export type RequestableCopy = MatchCopyDetail & { copyId: string };

interface RequestTradeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "request" | "offer";
  cardName: string;
  availableCount: number;
  demandQuantity: number;
  pending: boolean;
  copies?: readonly RequestableCopy[];
  canExceedWish?: boolean;
  onConfirm: (quantity: number, copyIds?: string[]) => void;
}

function CopyChoices({
  copies,
  selectedIds,
  max,
  disabled,
  onChange,
}: {
  copies: readonly RequestableCopy[];
  selectedIds: ReadonlySet<string>;
  max: number;
  disabled: boolean;
  onChange: (next: Set<string>) => void;
}) {
  const { labels } = useEnumOrders();
  return (
    <ul className="flex flex-col gap-1">
      {copies.map((copy) => {
        const checkboxId = `request-copy-${copy.copyId}`;
        const checked = selectedIds.has(copy.copyId);
        const label = matchCopyConditionLabel(copy, labels);
        return (
          <li key={copy.copyId} className="flex items-center gap-3 px-1 py-1">
            <Checkbox
              id={checkboxId}
              checked={checked}
              disabled={disabled || (!checked && max > 1 && selectedIds.size >= max)}
              onCheckedChange={(next) => {
                if (next === false) {
                  const rest = new Set(selectedIds);
                  rest.delete(copy.copyId);
                  onChange(rest);
                } else {
                  onChange(new Set(max === 1 ? [copy.copyId] : [...selectedIds, copy.copyId]));
                }
              }}
            />
            <label
              htmlFor={checkboxId}
              className="flex min-w-0 flex-1 cursor-pointer flex-wrap items-center gap-1.5"
            >
              {label === null ? (
                <span className="text-muted-foreground text-sm">{m.trades_no_details()}</span>
              ) : (
                <Badge variant="secondary">{label}</Badge>
              )}
              {copy.notesPublic === null ? null : (
                <span className="text-muted-foreground min-w-0 truncate text-sm">
                  “{copy.notesPublic}”
                </span>
              )}
            </label>
          </li>
        );
      })}
    </ul>
  );
}

export function RequestTradeDialog({
  open,
  onOpenChange,
  mode,
  cardName,
  availableCount,
  demandQuantity,
  pending,
  copies,
  canExceedWish = false,
  onConfirm,
}: RequestTradeDialogProps) {
  const { labels } = useEnumOrders();
  const defaultQuantity = maxTradeQuantity(demandQuantity, availableCount);
  const maxQuantity = mode === "request" && canExceedWish ? availableCount : defaultQuantity;
  const [quantity, setQuantity] = useState(() => Math.max(1, defaultQuantity));
  const pickable =
    mode === "request" && copies !== undefined
      ? new Set(copies.map((copy) => matchCopyConditionLabel(copy, labels) ?? "")).size > 1 ||
        copies.some((copy) => copy.notesPublic !== null)
      : false;
  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    () => new Set(copies?.slice(0, Math.max(1, defaultQuantity)).map((copy) => copy.copyId)),
  );
  const requested = pickable ? selectedIds.size : quantity;

  const title = mode === "request" ? m.trades_request_card_title() : m.trades_offer_card_title();
  const verb = mode === "request" ? m.trades_send_request() : m.trades_send_offer();
  const ready = pickable ? selectedIds.size > 0 : maxQuantity > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogForm
          onSubmit={() => {
            if (!ready) {
              return;
            }
            if (pickable && copies !== undefined) {
              const copyIds = copies
                .filter((copy) => selectedIds.has(copy.copyId))
                .map((copy) => copy.copyId);
              onConfirm(copyIds.length, copyIds);
            } else {
              onConfirm(quantity);
            }
          }}
        >
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>
              {mode === "request"
                ? m.trades_request_description({ card: cardName })
                : m.trades_offer_description({ card: cardName })}
            </DialogDescription>
          </DialogHeader>

          {pickable && copies !== undefined ? (
            <div className="flex flex-col gap-2 py-2">
              <span>
                {maxQuantity <= 1
                  ? m.trades_which_copy()
                  : m.trades_request_pick_up_to({ count: maxQuantity })}
              </span>
              <CopyChoices
                copies={copies}
                selectedIds={selectedIds}
                max={Math.max(1, maxQuantity)}
                disabled={pending}
                onChange={setSelectedIds}
              />
              <p className="text-muted-foreground text-sm">{m.trades_request_giver_decides()}</p>
              {requested > demandQuantity ? (
                <p className="text-muted-foreground text-sm">
                  {m.trades_request_raises_wish({ count: requested })}
                </p>
              ) : null}
            </div>
          ) : (
            <>
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
              {mode === "request" && requested > demandQuantity ? (
                <p className="text-muted-foreground text-sm">
                  {m.trades_request_raises_wish({ count: requested })}
                </p>
              ) : null}
            </>
          )}

          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>{m.common_cancel()}</DialogClose>
            <Button type="submit" disabled={pending || !ready}>
              {verb}
            </Button>
          </DialogFooter>
        </DialogForm>
      </DialogContent>
    </Dialog>
  );
}
