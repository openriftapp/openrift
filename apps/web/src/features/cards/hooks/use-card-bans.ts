import { adminCardBansContract } from "@openrift/shared/contracts/admin/card-bans";
import type { CardBanResponse } from "@openrift/shared/contracts/admin/card-bans";
import { MINUTE_MS } from "@openrift/shared/format-date";
import { useQuery } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";

import { adminKeys } from "@/features/admin/lib/admin-query-keys";
import { catalogKeys } from "@/features/cards/lib/cards-query-keys";
import { useMutationWithInvalidation } from "@/hooks/use-mutation-with-invalidation";
import { withCookies } from "@/lib/server-fns/middleware";
import { apiOrpcClient } from "@/lib/server-fns/orpc-client";

const fetchCardBansFn = createServerFn({ method: "GET" })
  .validator((input: { cardId: string }) => input)
  .middleware([withCookies])
  .handler(({ context, data }): Promise<{ bans: CardBanResponse[] }> =>
    apiOrpcClient(adminCardBansContract, context.cookie).list({ id: data.cardId }),
  );

export function useCardBans(cardId: string) {
  return useQuery({
    queryKey: adminKeys.cardBans(cardId),
    queryFn: async (): Promise<CardBanResponse[]> => {
      const data = await fetchCardBansFn({ data: { cardId } });
      return data.bans;
    },
    enabled: Boolean(cardId),
    staleTime: 5 * MINUTE_MS,
  });
}

interface CardBanWrite {
  cardId: string;
  formatId: string;
  circuit: string | null;
  bannedAt: string | null;
  reason: string | null;
}

const createCardBanFn = createServerFn({ method: "POST" })
  .validator((input: CardBanWrite) => input)
  .middleware([withCookies])
  .handler(async ({ context, data }) => {
    await apiOrpcClient(adminCardBansContract, context.cookie).create({
      id: data.cardId,
      formatId: data.formatId,
      circuit: data.circuit,
      bannedAt: data.bannedAt,
      reason: data.reason,
    });
  });

export function useCreateCardBan() {
  return useMutationWithInvalidation({
    mutationFn: async (input: CardBanWrite, signal) => {
      await createCardBanFn({ data: input, signal });
    },
    invalidates: [adminKeys.cardBans.prefix, catalogKeys.all],
  });
}

const updateCardBanFn = createServerFn({ method: "POST" })
  .validator((input: CardBanWrite) => input)
  .middleware([withCookies])
  .handler(async ({ context, data }) => {
    await apiOrpcClient(adminCardBansContract, context.cookie).update({
      id: data.cardId,
      formatId: data.formatId,
      circuit: data.circuit,
      bannedAt: data.bannedAt,
      reason: data.reason,
    });
  });

export function useUpdateCardBan() {
  return useMutationWithInvalidation({
    mutationFn: async (input: CardBanWrite, signal) => {
      await updateCardBanFn({ data: input, signal });
    },
    invalidates: [adminKeys.cardBans.prefix, catalogKeys.all],
  });
}

type CardBanKey = Pick<CardBanWrite, "cardId" | "formatId" | "circuit">;

const removeCardBanFn = createServerFn({ method: "POST" })
  .validator((input: CardBanKey) => input)
  .middleware([withCookies])
  .handler(async ({ context, data }) => {
    await apiOrpcClient(adminCardBansContract, context.cookie).remove({
      id: data.cardId,
      formatId: data.formatId,
      circuit: data.circuit,
    });
  });

export function useRemoveCardBan() {
  return useMutationWithInvalidation({
    mutationFn: async (input: CardBanKey, signal) => {
      await removeCardBanFn({ data: input, signal });
    },
    invalidates: [adminKeys.cardBans.prefix, catalogKeys.all],
  });
}
