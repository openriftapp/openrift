import { SettingsRow } from "@/components/layout/settings-row";
import { SettingsSection } from "@/components/layout/settings-section";
import { Switch } from "@/components/ui/switch";
import { useEmailNotifications } from "@/features/account/hooks/use-email-notifications";
import { m } from "@/paraglide/messages.js";

// Join-request switch is shown to everyone, not just group admins: anyone can
// create a group at any time, and the send side gates on membership anyway.
export function GroupNotificationsSection() {
  const { gates, isLoading, isSaving, setChannel } = useEmailNotifications();
  const disabled = isLoading || isSaving;

  return (
    <SettingsSection
      id="groups"
      title={m.profile_groups_title()}
      description={m.profile_groups_description()}
    >
      <SettingsRow
        label={m.profile_groups_join_requests_label()}
        htmlFor="pref-email-group-join-requests"
        description={m.profile_groups_join_requests_description()}
      >
        <Switch
          id="pref-email-group-join-requests"
          checked={gates.groupJoinRequests}
          disabled={disabled}
          onCheckedChange={(checked: boolean) => setChannel("groupJoinRequests", checked)}
        />
      </SettingsRow>
      <SettingsRow
        label={m.profile_groups_approvals_label()}
        htmlFor="pref-email-group-approvals"
        description={m.profile_groups_approvals_description()}
      >
        <Switch
          id="pref-email-group-approvals"
          checked={gates.groupApprovals}
          disabled={disabled}
          onCheckedChange={(checked: boolean) => setChannel("groupApprovals", checked)}
        />
      </SettingsRow>
    </SettingsSection>
  );
}
