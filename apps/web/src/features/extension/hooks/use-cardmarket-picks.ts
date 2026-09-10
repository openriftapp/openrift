import type {
  CardmarketPickRow,
  CardmarketPicksResolution,
} from "@openrift/shared/contracts/cardmarket-picks";
import { cardmarketPicksContract } from "@openrift/shared/contracts/cardmarket-picks";
import { useQuery } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";

import { extensionKeys } from "@/features/extension/lib/extension-query-keys";
import { useRequiredUserId } from "@/lib/auth-session";
import { withCookies } from "@/lib/server-fns/middleware";
import { apiOrpcClient } from "@/lib/server-fns/orpc-client";

const resolveCardmarketPicks = createServerFn({ method: "POST" })
  .validator((input: { rows: CardmarketPickRow[] }) => input)
  .middleware([withCookies])
  .handler(({ context, data }): Promise<CardmarketPicksResolution> =>
    apiOrpcClient(cardmarketPicksContract, context.cookie).resolve(data),
  );

export function useCardmarketPicksResolution(rows: readonly CardmarketPickRow[]) {
  const userId = useRequiredUserId();
  const rowsKey = rows.map((row) => `${row.idProduct}:${row.isFoil}:${row.idLanguage}`).join(",");
  return useQuery({
    queryKey: extensionKeys.cardmarketPicks(userId, rowsKey),
    queryFn: () => resolveCardmarketPicks({ data: { rows: [...rows] } }),
    enabled: rows.length > 0,
    staleTime: Infinity,
  });
}
