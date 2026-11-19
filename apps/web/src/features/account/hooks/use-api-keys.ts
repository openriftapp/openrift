import { apiKeysContract } from "@openrift/shared/contracts/api-keys";
import type {
  ApiKeyCreatedResponse,
  ApiKeysResponse,
  CreateApiKeyInput,
} from "@openrift/shared/types/api/api-key";
import { useQuery } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";

import { apiKeysKeys } from "@/features/account/lib/account-query-keys";
import { useMutationWithInvalidation } from "@/hooks/use-mutation-with-invalidation";
import { useRequiredUserId } from "@/hooks/use-session";
import { withCookies } from "@/lib/server-fns/middleware";
import { apiOrpcClient } from "@/lib/server-fns/orpc-client";

const fetchMyKeys = createServerFn({ method: "GET" })
  .middleware([withCookies])
  .handler(({ context }): Promise<ApiKeysResponse> =>
    apiOrpcClient(apiKeysContract, context.cookie).listMine(),
  );

const createMyKeyFn = createServerFn({ method: "POST" })
  .validator((input: CreateApiKeyInput) => input)
  .middleware([withCookies])
  .handler(({ context, data }): Promise<ApiKeyCreatedResponse> =>
    apiOrpcClient(apiKeysContract, context.cookie).createMine(data),
  );

const revokeMyKeyFn = createServerFn({ method: "POST" })
  .validator((input: { keyId: string }) => input)
  .middleware([withCookies])
  .handler(async ({ context, data }) => {
    await apiOrpcClient(apiKeysContract, context.cookie).revokeMine(data);
  });

export function useApiKeys() {
  const userId = useRequiredUserId();
  return useQuery({
    queryKey: apiKeysKeys.mine(userId),
    queryFn: () => fetchMyKeys(),
    select: (response) => response.items,
  });
}

export function useCreateApiKey() {
  const userId = useRequiredUserId();
  return useMutationWithInvalidation({
    mutationFn: (input: CreateApiKeyInput) => createMyKeyFn({ data: input }),
    meta: { inlineError: true },
    invalidates: () => [apiKeysKeys.mine(userId)],
  });
}

export function useDeleteApiKey() {
  const userId = useRequiredUserId();
  return useMutationWithInvalidation({
    mutationFn: (input: { keyId: string }) => revokeMyKeyFn({ data: input }),
    invalidates: () => [apiKeysKeys.mine(userId)],
  });
}
