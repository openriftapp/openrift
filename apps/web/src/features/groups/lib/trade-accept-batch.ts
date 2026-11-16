import type {
  CardTradeCopyOptionsResponse,
  CardTradeResponse,
} from "@openrift/shared/types/api/card-trade";

import { runReportedMutation } from "@/lib/run-reported-mutation";

export interface AcceptBatchDeps {
  accept: (variables: { tradeId: string; groupSlug?: string }) => Promise<unknown>;
  /** Resolves null after showing the error. */
  readCopyOptions: (tradeId: string) => Promise<CardTradeCopyOptionsResponse | null>;
  onTradeDone: (tradeId: string) => void;
}

/**
 * Accepts one trade at a time: accept reads the giver's unreserved copies before locking, so
 * parallel accepts collide. A giver's trade whose copies differ is left for its own Accept;
 * resolves the ids of those trades.
 */
export async function runAcceptBatch(
  trades: readonly CardTradeResponse[],
  deps: AcceptBatchDeps,
): Promise<string[]> {
  const awaitingChoice: string[] = [];
  for (const trade of trades) {
    if (trade.role === "giver") {
      const options = await deps.readCopyOptions(trade.id);
      if (options === null) {
        deps.onTradeDone(trade.id);
        continue;
      }
      if (options.choiceMatters) {
        awaitingChoice.push(trade.id);
        deps.onTradeDone(trade.id);
        continue;
      }
    }
    await runReportedMutation(() =>
      deps.accept({ tradeId: trade.id, groupSlug: trade.groupSlug ?? undefined }),
    );
    deps.onTradeDone(trade.id);
  }
  return awaitingChoice;
}
