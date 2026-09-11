import { SettingsSection } from "@/components/layout/settings-section";
import { Label } from "@/components/ui/label";
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
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-0.5">
          <Label htmlFor="pref-email-group-join-requests" className="font-normal">
            Join requests
          </Label>
          <p className="text-muted-foreground text-sm">
            When someone follows your invite link and asks to join, with a link straight to the
            approve buttons.
          </p>
        </div>
        <Switch
          id="pref-email-group-join-requests"
          checked={gates.groupJoinRequests}
          disabled={disabled}
          onCheckedChange={(checked: boolean) => setChannel("groupJoinRequests", checked)}
        />
      </div>
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-0.5">
          <Label htmlFor="pref-email-group-approvals" className="font-normal">
            Welcome to a group
          </Label>
          <p className="text-muted-foreground text-sm">
            When an admin approves your request to join, with what the group gets you and a link to
            choose what you share.
          </p>
        </div>
        <Switch
          id="pref-email-group-approvals"
          checked={gates.groupApprovals}
          disabled={disabled}
          onCheckedChange={(checked: boolean) => setChannel("groupApprovals", checked)}
        />
      </div>
    </SettingsSection>
  );
}
