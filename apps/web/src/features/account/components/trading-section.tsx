import type { Currency } from "@openrift/shared/types/api/trade-preferences";
import { CURRENCIES } from "@openrift/shared/types/api/trade-preferences";

import { SettingsRow } from "@/components/layout/settings-row";
import { SettingsSection } from "@/components/layout/settings-section";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { m } from "@/paraglide/messages.js";
import { useDisplayStore } from "@/stores/display-store";

import { EmailNotificationsControls } from "./email-notifications-controls";
import { ResetButton } from "./reset-button";

function currencyLabel(currency: Currency): string {
  return currency === "EUR" ? m.profile_trading_currency_eur() : m.profile_trading_currency_usd();
}

function currencyItems(): { value: Currency; label: string }[] {
  return CURRENCIES.map((value) => ({ value, label: currencyLabel(value) }));
}

export function TradingSection() {
  const currencyOptions = currencyItems();
  const defaultCurrency = useDisplayStore((s) => s.defaultCurrency);
  const setDefaultCurrency = useDisplayStore((s) => s.setDefaultCurrency);
  const overrideSet = useDisplayStore((s) => s.overrides.defaultCurrency) !== null;
  const resetPreference = useDisplayStore((s) => s.resetPreference);

  return (
    <>
      <SettingsSection
        id="trading"
        title={m.profile_trading_title()}
        description={m.profile_trading_description()}
        action={
          overrideSet && (
            <ResetButton
              onClick={() => resetPreference("defaultCurrency")}
              label={m.profile_trading_reset_currency()}
            />
          )
        }
      >
        <SettingsRow label={m.profile_trading_currency_label()} htmlFor="pref-default-currency">
          <Select
            items={currencyOptions}
            value={defaultCurrency}
            onValueChange={(value) => {
              if (CURRENCIES.includes(value as Currency)) {
                setDefaultCurrency(value as Currency);
              }
            }}
          >
            <SelectTrigger id="pref-default-currency" className="w-44">
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
        </SettingsRow>
      </SettingsSection>
      <EmailNotificationsControls />
    </>
  );
}
