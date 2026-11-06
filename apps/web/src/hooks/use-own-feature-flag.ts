import type { SelfServiceFlag } from "@openrift/shared/contracts/feature-flags";
import { ownFeatureFlagsContract } from "@openrift/shared/contracts/feature-flags";
import { createServerFn } from "@tanstack/react-start";

import { useMutationWithInvalidation } from "@/hooks/use-mutation-with-invalidation";
import { featureFlagsKeys } from "@/lib/query-keys";
import { withCookies } from "@/lib/server-fns/middleware";
import { apiOrpcClient } from "@/lib/server-fns/orpc-client";

const setOwnFeatureFlagFn = createServerFn({ method: "POST" })
  .validator((input: { key: SelfServiceFlag; enabled: boolean }) => input)
  .middleware([withCookies])
  .handler(async ({ context, data }) => {
    await apiOrpcClient(ownFeatureFlagsContract, context.cookie).set(data);
  });

export function useSetOwnFeatureFlag() {
  return useMutationWithInvalidation({
    mutationFn: (vars: { key: SelfServiceFlag; enabled: boolean }) =>
      setOwnFeatureFlagFn({ data: vars }),
    invalidates: [featureFlagsKeys.all],
  });
}
