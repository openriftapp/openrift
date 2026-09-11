import { SettingsRow } from "@/components/layout/settings-row";
import { SettingsSection } from "@/components/layout/settings-section";
import { Switch } from "@/components/ui/switch";
import { useEmailNotifications } from "@/features/account/hooks/use-email-notifications";

// Join-request switch is shown to everyone, not just group admins: anyone can
// create a group at any time, and the send side gates on membership anyway.
export function GroupNotificationsSection() {
  const { gates, isLoading, isSaving, setChannel } = useEmailNotifications();
  const disabled = isLoading || isSaving;

  return (
    <SettingsSection
      id="groups"
      title="Groups"
      description="Emails about your groups. Every email has one-click unsubscribe."
    >
      <SettingsRow
        label="Join requests"
        htmlFor="pref-email-group-join-requests"
        description="When someone follows your invite link and asks to join, with a link straight to the approve buttons."
      >
        <Switch
          id="pref-email-group-join-requests"
          checked={gates.groupJoinRequests}
          disabled={disabled}
          onCheckedChange={(checked: boolean) => setChannel("groupJoinRequests", checked)}
        />
      </SettingsRow>
      <SettingsRow
        label="Welcome to a group"
        htmlFor="pref-email-group-approvals"
        description="When an admin approves your request to join, with what the group gets you and a link to choose what you share."
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
