import { SettingsRow } from "@/components/layout/settings-row";
import { SettingsSection } from "@/components/layout/settings-section";
import { Switch } from "@/components/ui/switch";
import { useEmailNotifications } from "@/features/account/hooks/use-email-notifications";
import { m } from "@/paraglide/messages.js";

export function AdminNotificationsSection() {
  const { gates, isLoading, isSaving, setChannel } = useEmailNotifications();
  const disabled = isLoading || isSaving;

  return (
    <SettingsSection title={m.profile_admin_title()} description={m.profile_admin_description()}>
      <SettingsRow
        label={m.profile_admin_card_submissions_label()}
        htmlFor="pref-email-card-submissions"
        description={m.profile_admin_card_submissions_description()}
      >
        <Switch
          id="pref-email-card-submissions"
          checked={gates.cardSubmissions}
          disabled={disabled}
          onCheckedChange={(checked: boolean) => setChannel("cardSubmissions", checked)}
        />
      </SettingsRow>
      <SettingsRow
        label="New meta submissions"
        htmlFor="pref-email-meta-submissions"
        description="Get an email each time someone submits a tournament decklist or event correction to the meta archive, with a link to the review queue."
      >
        <Switch
          id="pref-email-meta-submissions"
          checked={gates.metaSubmissions}
          disabled={disabled}
          onCheckedChange={(checked: boolean) => setChannel("metaSubmissions", checked)}
        />
      </SettingsRow>
    </SettingsSection>
  );
}
