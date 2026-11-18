import type {
  CardTradeCopyOptionsResponse,
  CardTradeResponse,
} from "@openrift/shared/types/api/card-trade";

import { errorText } from "@/lib/error-text";
import { runReportedMutation } from "@/lib/run-reported-mutation";
import { isStaleServerFnError } from "@/lib/stale-bundle-reload";
import { PERSISTENT_ERROR_TOAST, toastError } from "@/lib/toast";
import { toastableMessage } from "@/lib/toastable-message";
import { m } from "@/paraglide/messages.js";

export interface SettleStep {
  trade: CardTradeResponse;
  quantity: number;
}

export interface PendingSettleChoice {
  trade: CardTradeResponse;
  quantity: number;
  options: CardTradeCopyOptionsResponse;
}

export interface SettleBatchResult {
  pendingChoices: PendingSettleChoice[];
  settledTradeIds: string[];
  failed: boolean;
}

export interface SettleBatchDeps {
  settle: (variables: {
    tradeId: string;
    groupSlug?: string;
    quantity: number;
    targetCollectionId?: string;
  }) => Promise<unknown>;
  readCopyOptions: (tradeId: string) => Promise<CardTradeCopyOptionsResponse | null>;
  targetCollectionId?: string;
}

function reportCopyOptionsError(error: unknown): void {
  // The QueryCache handler already reloads a stale bundle and refreshes an expired session.
  if (isStaleServerFnError(error)) {
    return;
  }
  const fallback = m.common_error_generic();
  toastError(toastableMessage(errorText(error, fallback), fallback), PERSISTENT_ERROR_TOAST);
}

/** Resolves null after showing the error; the caller must not go on without the giver's choice. */
export async function readCopyOptionsReported(
  read: () => Promise<CardTradeCopyOptionsResponse>,
): Promise<CardTradeCopyOptionsResponse | null> {
  let options: CardTradeCopyOptionsResponse;
  try {
    options = await read();
  } catch (error) {
    reportCopyOptionsError(error);
    return null;
  }
  return options;
}

/**
 * Settle hard-deletes a specific copy irreversibly, so a giver's row is held
 * back for a choice when its candidate copies differ; the receiver is never asked.
 */
export async function runSettleBatch(
  steps: readonly SettleStep[],
  deps: SettleBatchDeps,
): Promise<SettleBatchResult> {
  const pendingChoices: PendingSettleChoice[] = [];
  const settledTradeIds: string[] = [];
  let failed = false;

  for (const step of steps) {
    const { trade, quantity } = step;
    if (trade.role === "giver") {
      const options = await deps.readCopyOptions(trade.id);
      if (options === null) {
        failed = true;
        continue;
      }
      if (options.choiceMatters) {
        pendingChoices.push({ trade, quantity, options });
        continue;
      }
    }
    const settled = await runReportedMutation(() =>
      deps.settle({
        tradeId: trade.id,
        groupSlug: trade.groupSlug ?? undefined,
        quantity,
        targetCollectionId: trade.role === "receiver" ? deps.targetCollectionId : undefined,
      }),
    );
    if (settled) {
      settledTradeIds.push(trade.id);
    } else {
      failed = true;
    }
  }

  return { pendingChoices, settledTradeIds, failed };
}
