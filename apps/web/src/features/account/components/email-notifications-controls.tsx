import type { TradeRequestEmailCadence } from "@openrift/shared/types/api/preferences";

import { SettingsRow } from "@/components/layout/settings-row";
import { SettingsSection } from "@/components/layout/settings-section";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useEmailNotifications } from "@/features/account/hooks/use-email-notifications";

const CADENCE_OPTIONS: { value: TradeRequestEmailCadence; label: string }[] = [
  { value: "instant", label: "Instant" },
  { value: "5min", label: "Every 5 minutes" },
  { value: "15min", label: "Every 15 minutes" },
  { value: "30min", label: "Every 30 minutes" },
  { value: "60min", label: "Every hour" },
];

export function EmailNotificationsControls() {
  const { gates, isLoading, isSaving, setChannel, setCadence } = useEmailNotifications();
  const disabled = isLoading || isSaving;

  return (
    <SettingsSection
      title="Email notifications"
      description="Only about your trading activity. Every email has one-click unsubscribe."
    >
      <SettingsRow
        label="Trade requests"
        htmlFor="pref-email-trade-requests"
        description="When someone requests a trade with you."
      >
        <Switch
          id="pref-email-trade-requests"
          checked={gates.tradeRequests}
          disabled={disabled}
          onCheckedChange={(checked: boolean) => setChannel("tradeRequests", checked)}
        />
      </SettingsRow>

      <SettingsRow label="Trade request frequency" htmlFor="pref-email-trade-request-cadence">
        <Select
          value={gates.tradeRequestCadence}
          onValueChange={(value) => {
            if (value) {
              setCadence(value as TradeRequestEmailCadence);
            }
          }}
          items={CADENCE_OPTIONS}
        >
          <SelectTrigger
            id="pref-email-trade-request-cadence"
            className="w-44"
            disabled={disabled || !gates.tradeRequests}
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {CADENCE_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </SettingsRow>

      <SettingsRow
        label="Trade updates"
        htmlFor="pref-email-trade-status"
        description="When your trade is accepted, declined, or cancelled. Same frequency as trade requests."
      >
        <Switch
          id="pref-email-trade-status"
          checked={gates.tradeStatus}
          disabled={disabled}
          onCheckedChange={(checked: boolean) => setChannel("tradeStatus", checked)}
        />
      </SettingsRow>

      <SettingsRow
        label="Daily match digest"
        htmlFor="pref-email-trade-matches"
        description="A once-a-day summary of new cards your groups have that are on your wishlist."
      >
        <Switch
          id="pref-email-trade-matches"
          checked={gates.tradeMatches}
          disabled={disabled}
          onCheckedChange={(checked: boolean) => setChannel("tradeMatches", checked)}
        />
      </SettingsRow>
    </SettingsSection>
  );
}
