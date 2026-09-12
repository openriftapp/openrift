import { createLazyFileRoute } from "@tanstack/react-router";

import { SettingsRow } from "@/components/layout/settings-row";
import { SettingsSection } from "@/components/layout/settings-section";
import { Switch } from "@/components/ui/switch";
import { AdminPageTopBar } from "@/features/admin/components/admin-page-top-bar";
import { useAdminSettingsStore } from "@/features/admin/hooks/use-admin-settings";

export const Route = createLazyFileRoute("/_app/_authenticated/admin/debug")({
  component: SettingsPage,
});

function SettingsPage() {
  const settings = useAdminSettingsStore((s) => s.settings);
  const update = useAdminSettingsStore((s) => s.update);

  return (
    <div className="flex flex-col gap-8">
      <AdminPageTopBar title="Settings" />
      <SettingsSection
        title="Developer Tools"
        description="Diagnostic overlays and debugging aids. These settings are stored in your browser."
      >
        <SettingsRow
          label="Debug overlay"
          htmlFor="debug-overlay"
          description="Show card grid layout metrics (row heights, column count, virtualizer state)"
        >
          <Switch
            id="debug-overlay"
            checked={settings.debugOverlay}
            onCheckedChange={(checked: boolean) => update({ debugOverlay: checked })}
          />
        </SettingsRow>
      </SettingsSection>
    </div>
  );
}
