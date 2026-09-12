import type { Currency, TradePreference } from "@openrift/shared/types/api/trade-preferences";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DialogForm } from "@/components/ui/dialog-form";
import { m } from "@/paraglide/messages.js";
import { useDisplayStore } from "@/stores/display-store";

import { TradePreferenceEditor } from "./trade-preference-editor";

interface TradePreferenceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cardName: string;
  override: TradePreference;
  listDefault: TradePreference;
  currency: Currency | null;
  isOverridden: boolean;
  onSave: (next: TradePreference, listCurrencyToSet?: Currency) => void;
}

export function TradePreferenceDialog({
  open,
  onOpenChange,
  cardName,
  override,
  listDefault,
  currency,
  isOverridden,
  onSave,
}: TradePreferenceDialogProps) {
  const defaultCurrency = useDisplayStore((s) => s.defaultCurrency);
  const [draft, setDraft] = useState<TradePreference>(override);
  const [draftCurrency, setDraftCurrency] = useState<Currency>(currency ?? defaultCurrency);

  // Dialog is mounted once and reused per entry; resets draft state when a different entry's override arrives.
  const [seed, setSeed] = useState({ open, override, currency, defaultCurrency });
  if (
    seed.open !== open ||
    seed.override !== override ||
    seed.currency !== currency ||
    seed.defaultCurrency !== defaultCurrency
  ) {
    setSeed({ open, override, currency, defaultCurrency });
    if (open) {
      setDraft(override);
      setDraftCurrency(currency ?? defaultCurrency);
    }
  }

  const absoluteNeedsAmount = draft.pricePref === "absolute" && draft.priceAbsoluteCents === null;
  const listMissingCurrency = currency === null;
  const listCurrencyToSet: Currency | undefined =
    listMissingCurrency && draft.pricePref === "absolute" ? draftCurrency : undefined;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogForm
          onSubmit={() => {
            onSave(draft, listCurrencyToSet);
            onOpenChange(false);
          }}
        >
          <DialogHeader>
            <DialogTitle>{m.trade_pref_dialog_title()}</DialogTitle>
            <DialogDescription>
              {m.trade_pref_dialog_description({ card: cardName })}
            </DialogDescription>
          </DialogHeader>

          <TradePreferenceEditor
            value={draft}
            onChange={setDraft}
            currency={draftCurrency}
            showCurrency={listMissingCurrency && draft.pricePref === "absolute"}
            onCurrencyChange={setDraftCurrency}
            idPrefix="entry-dialog"
            listDefault={listDefault}
          />

          <DialogFooter className="flex items-center justify-between gap-2 sm:justify-between">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={!isOverridden && draft.pricePref === null && draft.tradeType === null}
              onClick={() => {
                const reset: TradePreference = {
                  pricePref: null,
                  priceAbsoluteCents: null,
                  tradeType: null,
                };
                setDraft(reset);
                onSave(reset);
                onOpenChange(false);
              }}
            >
              {m.trade_pref_reset()}
            </Button>
            <div className="flex items-center gap-2">
              <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
                {m.common_cancel()}
              </Button>
              <Button type="submit" disabled={absoluteNeedsAmount}>
                {m.common_save()}
              </Button>
            </div>
          </DialogFooter>
        </DialogForm>
      </DialogContent>
    </Dialog>
  );
}
