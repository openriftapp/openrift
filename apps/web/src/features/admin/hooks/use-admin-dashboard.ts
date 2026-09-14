import { useSuspenseQuery } from "@tanstack/react-query";

import { adminDashboardQueryOptions } from "@/features/admin/lib/admin-dashboard-queries";

export function useAdminDashboard() {
  return useSuspenseQuery(adminDashboardQueryOptions);
}
