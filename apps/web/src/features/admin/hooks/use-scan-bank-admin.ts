import { adminScanContract } from "@openrift/shared/contracts/admin/scan";
import type { JobRunStartedResponse } from "@openrift/shared/types/api/admin";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";

import { adminKeys } from "@/features/admin/lib/admin-query-keys";
import { scanKeys } from "@/features/scan/lib/scan-query-keys";
import { withCookies } from "@/lib/server-fns/middleware";
import { apiOrpcClient } from "@/lib/server-fns/orpc-client";

export const REBUILD_SCAN_BANK_KIND = "scan.rebuild_bank";

const rebuildScanBankFn = createServerFn({ method: "POST" })
  .middleware([withCookies])
  .handler(({ context }): Promise<JobRunStartedResponse> =>
    apiOrpcClient(adminScanContract, context.cookie).rebuildBank(),
  );

export function useRebuildScanBank() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => rebuildScanBankFn(),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: adminKeys.jobRunsByKind(REBUILD_SCAN_BANK_KIND),
      });
      void queryClient.invalidateQueries({ queryKey: scanKeys.manifest });
    },
  });
}
