import { preferencesContract } from "@openrift/shared/contracts/preferences";
import type { UserPreferencesResponse } from "@openrift/shared/types/api/preferences";
import { queryOptions } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";

import { preferencesKeys } from "@/features/account/lib/account-query-keys";
import { withCookies } from "@/lib/server-fns/middleware";
import { apiOrpcClient } from "@/lib/server-fns/orpc-client";

const fetchPreferencesFn = createServerFn({ method: "GET" })
  .middleware([withCookies])
  .handler(({ context }): Promise<UserPreferencesResponse> =>
    apiOrpcClient(preferencesContract, context.cookie).get(),
  );

export const preferencesQueryOptions = (userId: string | null) =>
  queryOptions({
    queryKey: preferencesKeys.all(userId ?? ""),
    queryFn: () => fetchPreferencesFn(),
  });
