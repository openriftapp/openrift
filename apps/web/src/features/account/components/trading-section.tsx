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
import { useDisplayStore } from "@/stores/display-store";

import { EmailNotificationsControls } from "./email-notifications-controls";
import { ResetButton } from "./reset-button";

const CURRENCY_LABEL: Record<Currency, string> = {
  EUR: "Euro (EUR)",
  USD: "US Dollar (USD)",
};

const CURRENCY_ITEMS: { value: Currency; label: string }[] = CURRENCIES.map((value) => ({
  value,
  label: CURRENCY_LABEL[value],
}));

export function TradingSection() {
  const defaultCurrency = useDisplayStore((s) => s.defaultCurrency);
  const setDefaultCurrency = useDisplayStore((s) => s.setDefaultCurrency);
  const overrideSet = useDisplayStore((s) => s.overrides.defaultCurrency) !== null;
  const resetPreference = useDisplayStore((s) => s.resetPreference);

  return (
    <>
      <SettingsSection
        id="trading"
        title="Trading"
        description="Default for new wishlists and tradelists. Each list can override it."
        action={
          overrideSet && (
            <ResetButton
              onClick={() => resetPreference("defaultCurrency")}
              label="Reset default currency"
            />
          )
        }
      >
        <SettingsRow label="Default currency" htmlFor="pref-default-currency">
          <Select
            items={CURRENCY_ITEMS}
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
              {CURRENCY_ITEMS.map((item) => (
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
