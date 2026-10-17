import { featureFlagsContract } from "@openrift/shared/contracts/feature-flags";
import type { FeatureFlagsResponse } from "@openrift/shared/types/api/feature-flags";
import { implement } from "@orpc/server";

import { requireUser } from "../../../orpc/base.js";
import type { ApiContext } from "../../../orpc/context.js";
import { isScanAvailable } from "../../scan/lib/scan-available.js";

const os = implement(featureFlagsContract).$context<ApiContext>().use(requireUser);

async function storedFlags(context: ApiContext): Promise<Record<string, boolean>> {
  if (context.user) {
    return context.repos.userFeatureFlags.listMerged(context.user.id);
  }
  const rows = await context.repos.featureFlags.listKeyEnabled();
  const flags: Record<string, boolean> = {};
  for (const row of rows) {
    flags[row.key] = row.enabled;
  }
  return flags;
}

export const featureFlagsRouter = {
  get: os.get.handler(async ({ context }): Promise<FeatureFlagsResponse> => {
    const [flags, scanIndex] = await Promise.all([
      storedFlags(context),
      context.repos.scanIndex.get(),
    ]);
    flags.scanner = isScanAvailable(scanIndex, context.config.scan);
    return { flags };
  }),
};
