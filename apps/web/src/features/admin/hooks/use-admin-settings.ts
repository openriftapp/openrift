import { useIsAdmin } from "@/features/admin/hooks/use-admin";
import type { AdminSettings } from "@/features/admin/stores/admin-settings-store";
import { useAdminSettingsStore } from "@/features/admin/stores/admin-settings-store";

export function useAdminSettings(): AdminSettings | null {
  const { data: isAdmin } = useIsAdmin();
  const settings = useAdminSettingsStore((s) => s.settings);
  return isAdmin === true ? settings : null;
}
