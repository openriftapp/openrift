import type {
  Currency,
  TradePreference,
  TradePricePref,
  TradeType,
} from "@openrift/shared/types/api/trade-preferences";
import {
  CURRENCIES,
  TRADE_PRICE_PREFS,
  TRADE_TYPES,
} from "@openrift/shared/types/api/trade-preferences";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useNumericDraft } from "@/hooks/use-numeric-draft";
import { m } from "@/paraglide/messages.js";

import {
  CURRENCY_SYMBOL,
  pricePrefLabel,
  pricePrefShortLabel,
  tradeTypeLabel,
} from "./trade-preference-labels";

const PRICE_PREF_NONE = "__none__";
const TRADE_TYPE_NONE = "__none__";

function currencyItems(): { value: Currency; label: string }[] {
  return CURRENCIES.map((value) => ({
    value,
    label: value === "EUR" ? m.trade_pref_currency_eur() : m.trade_pref_currency_usd(),
  }));
}

export interface TradePreferenceEditorProps {
  value: TradePreference;
  onChange: (next: TradePreference) => void;
  currency: Currency | null;
  showCurrency?: boolean;
  onCurrencyChange?: (next: Currency) => void;
  idPrefix?: string;
  listDefault?: TradePreference;
}

/**
 * "Fixed" (absolute) is a per-card price, not a list-wide rule, so it's hidden
 * from the list-default editor unless the list already defaults to it.
 */
export function offeredPricePrefs(
  isListDefaultEditor: boolean,
  currentPricePref: TradePricePref | null,
): readonly TradePricePref[] {
  if (!isListDefaultEditor || currentPricePref === "absolute") {
    return TRADE_PRICE_PREFS;
  }
  return TRADE_PRICE_PREFS.filter((option) => option !== "absolute");
}

export function TradePreferenceEditor({
  value,
  onChange,
  currency,
  showCurrency = false,
  onCurrencyChange,
  idPrefix = "tp",
  listDefault,
}: TradePreferenceEditorProps) {
  const pricePrefValue = value.pricePref ?? PRICE_PREF_NONE;
  const tradeTypeValue = value.tradeType ?? TRADE_TYPE_NONE;
  const isAbsolute = value.pricePref === "absolute";

  // listDefault undefined means this editor edits the list defaults themselves;
  // only show inheritance labels when a listDefault to inherit from is given.
  const currencyOptions = currencyItems();
  const pricePrefNoneLabel =
    listDefault === undefined
      ? m.trade_pref_no_preference()
      : m.trade_pref_list_default({
          value:
            listDefault.pricePref === null
              ? m.trade_pref_negotiate()
              : pricePrefShortLabel(listDefault.pricePref),
        });
  const tradeTypeNoneLabel =
    listDefault === undefined
      ? m.trade_pref_no_preference()
      : m.trade_pref_list_default({
          value:
            listDefault.tradeType === null
              ? m.trade_pref_negotiate()
              : tradeTypeLabel(listDefault.tradeType),
        });

  const pricePrefItems: { value: string; label: string }[] = [
    { value: PRICE_PREF_NONE, label: pricePrefNoneLabel },
    ...offeredPricePrefs(listDefault === undefined, value.pricePref).map((option) => ({
      value: option,
      label: pricePrefLabel(option),
    })),
  ];
  const tradeTypeItems: { value: string; label: string }[] = [
    { value: TRADE_TYPE_NONE, label: tradeTypeNoneLabel },
    ...TRADE_TYPES.map((option) => ({ value: option, label: tradeTypeLabel(option) })),
  ];

  const handleAmountChange = (text: string) => {
    // Empty input keeps the absolute pref but unsets the amount; the parent
    // must treat that as a draft state and refuse to save.
    if (text.trim() === "") {
      onChange({ ...value, priceAbsoluteCents: null });
      return;
    }
    const cents = parseAmountToCents(text);
    if (cents === null) {
      return;
    }
    onChange({ ...value, priceAbsoluteCents: cents });
  };

  const { inputProps: amountProps, resetDraft: resetAmountDraft } = useNumericDraft({
    display: formatCentsForInput(value.priceAbsoluteCents),
    onCommit: handleAmountChange,
  });

  const handlePricePrefChange = (next: string) => {
    resetAmountDraft();
    if (next === PRICE_PREF_NONE) {
      onChange({ ...value, pricePref: null, priceAbsoluteCents: null });
      return;
    }
    if (next === "absolute") {
      onChange({
        ...value,
        pricePref: "absolute",
        priceAbsoluteCents: value.priceAbsoluteCents ?? 100,
      });
      return;
    }
    onChange({
      ...value,
      pricePref: next as TradePricePref,
      priceAbsoluteCents: null,
    });
  };

  const handleTradeTypeChange = (next: string) => {
    if (next === TRADE_TYPE_NONE) {
      onChange({ ...value, tradeType: null });
      return;
    }
    onChange({ ...value, tradeType: next as TradeType });
  };

  return (
    <div className="flex min-w-0 flex-col gap-3 overflow-hidden">
      <div className="flex items-center gap-2">
        <Label htmlFor={`${idPrefix}-price`} className="w-20 shrink-0 font-normal">
          {m.trade_pref_price_label()}
        </Label>
        <Select
          items={pricePrefItems}
          value={pricePrefValue}
          onValueChange={(next) => {
            if (next !== null) {
              handlePricePrefChange(next);
            }
          }}
        >
          <SelectTrigger id={`${idPrefix}-price`} className="min-w-0 flex-1">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {pricePrefItems.map((item) => (
              <SelectItem key={item.value} value={item.value}>
                {item.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {showCurrency && (
        <div className="flex items-center gap-2">
          <Label htmlFor={`${idPrefix}-currency`} className="w-20 shrink-0 font-normal">
            {m.trade_pref_currency_label()}
          </Label>
          <Select
            items={currencyOptions}
            value={currency ?? "EUR"}
            onValueChange={(next) => {
              if (next && CURRENCIES.includes(next as Currency)) {
                onCurrencyChange?.(next as Currency);
              }
            }}
          >
            <SelectTrigger id={`${idPrefix}-currency`} className="min-w-0 flex-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {currencyOptions.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {isAbsolute && (
        <div className="flex items-center gap-2">
          <Label htmlFor={`${idPrefix}-amount`} className="w-20 shrink-0 font-normal">
            {m.trade_pref_amount_label()}
          </Label>
          <div className="flex flex-1 items-center gap-2">
            <Input
              id={`${idPrefix}-amount`}
              inputMode="decimal"
              placeholder={m.trade_pref_amount_placeholder()}
              {...amountProps}
            />
            <span className="text-muted-foreground text-sm">
              {currency ? CURRENCY_SYMBOL[currency] : "?"}
            </span>
          </div>
        </div>
      )}

      <div className="flex items-center gap-2">
        <Label htmlFor={`${idPrefix}-type`} className="w-20 shrink-0 font-normal">
          {m.trade_pref_accepts_label()}
        </Label>
        <Select
          items={tradeTypeItems}
          value={tradeTypeValue}
          onValueChange={(next) => {
            if (next !== null) {
              handleTradeTypeChange(next);
            }
          }}
        >
          <SelectTrigger id={`${idPrefix}-type`} className="min-w-0 flex-1">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {tradeTypeItems.map((item) => (
              <SelectItem key={item.value} value={item.value}>
                {item.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}

function parseAmountToCents(text: string): number | null {
  const trimmed = text.trim().replace(",", ".");
  if (!/^\d+(?:\.\d{0,2})?$/u.test(trimmed)) {
    return null;
  }
  const value = Number(trimmed);
  if (!Number.isFinite(value) || value <= 0) {
    return null;
  }
  return Math.round(value * 100);
}

function formatCentsForInput(cents: number | null): string {
  if (cents === null) {
    return "";
  }
  const whole = Math.trunc(cents / 100);
  const remainder = cents % 100;
  return `${whole}.${String(remainder).padStart(2, "0")}`;
}
