import { SettingsRow } from "@/components/layout/settings-row";
import { SettingsSection } from "@/components/layout/settings-section";
import { Switch } from "@/components/ui/switch";
import { useEmailNotifications } from "@/features/account/hooks/use-email-notifications";
import { m } from "@/paraglide/messages.js";

export function ContributionNotificationsSection() {
  const { gates, isLoading, isSaving, setChannel } = useEmailNotifications();

  return (
    <SettingsSection
      id="contributions"
      title={m.profile_contributions_title()}
      description={m.profile_contributions_description()}
    >
      <SettingsRow
        label={m.profile_contributions_accepted_label()}
        htmlFor="pref-email-submission-accepted"
        description={m.profile_contributions_accepted_description()}
      >
        <Switch
          id="pref-email-submission-accepted"
          checked={gates.submissionAccepted}
          disabled={isLoading || isSaving}
          onCheckedChange={(checked: boolean) => setChannel("submissionAccepted", checked)}
        />
      </SettingsRow>
    </SettingsSection>
  );
}
