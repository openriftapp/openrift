import { ownFeatureFlagsContract } from "@openrift/shared/contracts/feature-flags";
import type { FeatureFlagsResponse } from "@openrift/shared/types/api/feature-flags";
import { implement } from "@orpc/server";

import { requireAuthedUser } from "../../../orpc/base.js";
import type { ApiContext } from "../../../orpc/context.js";

const os = implement(ownFeatureFlagsContract).$context<ApiContext>().use(requireAuthedUser);

export const ownFeatureFlagsRouter = {
  set: os.set.handler(async ({ input, context }): Promise<FeatureFlagsResponse> => {
    const { featureFlags, userFeatureFlags } = context.repos;
    // Overrides reference the flag row, so the first opt-in creates it, off for everyone else.
    // Opting out stores false so a global switch-on cannot pull the user back in.
    await featureFlags.create({ key: input.key, enabled: false, description: null });
    await userFeatureFlags.upsert(context.userId, input.key, input.enabled);
    return { flags: await userFeatureFlags.listMerged(context.userId) };
  }),
};
