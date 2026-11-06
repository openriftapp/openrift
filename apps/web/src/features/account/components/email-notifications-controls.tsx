import type { TradeRequestEmailCadence } from "@openrift/shared/types/api/preferences";

import { SettingsRow } from "@/components/layout/settings-row";
import { SettingsSection } from "@/components/layout/settings-section";
import { SimpleSelect } from "@/components/ui/simple-select";
import { Switch } from "@/components/ui/switch";
import { useEmailNotifications } from "@/features/account/hooks/use-email-notifications";
import { m } from "@/paraglide/messages.js";

function cadenceOptions(): { value: TradeRequestEmailCadence; label: string }[] {
  return [
    { value: "instant", label: m.profile_notifications_cadence_instant() },
    { value: "5min", label: m.profile_notifications_cadence_5min() },
    { value: "15min", label: m.profile_notifications_cadence_15min() },
    { value: "30min", label: m.profile_notifications_cadence_30min() },
    { value: "60min", label: m.profile_notifications_cadence_60min() },
  ];
}

export function EmailNotificationsControls() {
  const { gates, isLoading, isSaving, setChannel, setCadence } = useEmailNotifications();
  const cadences = cadenceOptions();
  const disabled = isLoading || isSaving;

  return (
    <SettingsSection
      title={m.profile_notifications_title()}
      description={m.profile_notifications_description()}
    >
      <SettingsRow
        label={m.profile_notifications_trade_requests_label()}
        htmlFor="pref-email-trade-requests"
        description={m.profile_notifications_trade_requests_description()}
      >
        <Switch
          id="pref-email-trade-requests"
          checked={gates.tradeRequests}
          disabled={disabled}
          onCheckedChange={(checked: boolean) => setChannel("tradeRequests", checked)}
        />
      </SettingsRow>

      <SettingsRow
        label={m.profile_notifications_cadence_label()}
        htmlFor="pref-email-trade-request-cadence"
      >
        <SimpleSelect
          id="pref-email-trade-request-cadence"
          items={cadences}
          value={gates.tradeRequestCadence}
          onChange={(value) => setCadence(value as TradeRequestEmailCadence)}
          disabled={disabled || !gates.tradeRequests}
          className="w-44"
        />
      </SettingsRow>

      <SettingsRow
        label={m.profile_notifications_trade_status_label()}
        htmlFor="pref-email-trade-status"
        description={m.profile_notifications_trade_status_description()}
      >
        <Switch
          id="pref-email-trade-status"
          checked={gates.tradeStatus}
          disabled={disabled}
          onCheckedChange={(checked: boolean) => setChannel("tradeStatus", checked)}
        />
      </SettingsRow>

      <SettingsRow
        label={m.profile_notifications_trade_matches_label()}
        htmlFor="pref-email-trade-matches"
        description={m.profile_notifications_trade_matches_description()}
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
