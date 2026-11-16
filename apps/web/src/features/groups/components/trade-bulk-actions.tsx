import type { CardTradeResponse } from "@openrift/shared/types/api/card-trade";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { ConfirmActionDialog } from "@/components/confirm-action-dialog";
import { Button } from "@/components/ui/button";
import {
  tradeCopyOptionsQueryOptions,
  useAcceptTrade,
  useCancelTrade,
  useDeclineTrade,
} from "@/features/groups/hooks/use-card-trades";
import { runAcceptBatch } from "@/features/groups/lib/trade-accept-batch";
import { readCopyOptionsReported } from "@/features/groups/lib/trade-settle-batch";
import { useTradeActionStore } from "@/features/groups/stores/trade-action-store";
import { useRequiredUserId } from "@/hooks/use-session";
import { memberName } from "@/lib/member-name";
import { runReportedMutation } from "@/lib/run-reported-mutation";
import { m } from "@/paraglide/messages.js";

type BulkMode = "accept-decline" | "cancel" | "none";

const BULK_ACCEPT_CONFIRM_THRESHOLD = 10;

export function BulkTradeActions({
  trades,
  mode,
}: {
  trades: CardTradeResponse[];
  mode: BulkMode;
}) {
  const userId = useRequiredUserId();
  const queryClient = useQueryClient();
  const accept = useAcceptTrade();
  const decline = useDeclineTrade();
  const cancel = useCancelTrade();
  const begin = useTradeActionStore((state) => state.begin);
  const settle = useTradeActionStore((state) => state.settle);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [awaitingChoice, setAwaitingChoice] = useState<readonly string[]>([]);

  const needle = mode === "accept-decline" ? "accept-or-decline" : "cancel";
  const targets = mode === "none" ? [] : trades.filter((trade) => trade.actionNeeded === needle);
  const acting = useTradeActionStore((state) =>
    targets.some((trade) => state.pending.has(trade.id)),
  );
  const waitingForChoice = targets.filter((trade) => awaitingChoice.includes(trade.id)).length;
  // A trade waiting for a copy choice is settled in its own row, so accept-all leaves it out.
  const acceptTargets = targets.filter((trade) => !awaitingChoice.includes(trade.id));

  // Declared above the early returns for the React Compiler.
  async function runAll(mutation: {
    mutateAsync: (variables: { tradeId: string; groupSlug?: string }) => Promise<unknown>;
  }): Promise<void> {
    for (const trade of targets) {
      begin(trade.id);
    }
    for (const trade of targets) {
      await runReportedMutation(() =>
        mutation.mutateAsync({ tradeId: trade.id, groupSlug: trade.groupSlug ?? undefined }),
      );
      settle(trade.id);
    }
  }

  async function acceptAll(): Promise<void> {
    for (const trade of acceptTargets) {
      begin(trade.id);
    }
    const waiting = await runAcceptBatch(acceptTargets, {
      accept: (variables) => accept.mutateAsync(variables),
      readCopyOptions: (tradeId) =>
        readCopyOptionsReported(() =>
          queryClient.query(tradeCopyOptionsQueryOptions(userId, tradeId)),
        ),
      onTradeDone: settle,
    });
    setAwaitingChoice((previous) => [...previous, ...waiting]);
  }

  const choiceLine =
    waitingForChoice === 0 ? null : (
      <p className="text-muted-foreground text-xs">
        {m.trades_accept_all_awaiting_choice({ count: waitingForChoice })}
      </p>
    );

  if (targets.length < 2) {
    return choiceLine;
  }

  if (mode === "cancel") {
    return (
      <Button size="sm" variant="outline" disabled={acting} onClick={() => void runAll(cancel)}>
        {m.trades_cancel_all({ count: targets.length })}
      </Button>
    );
  }
  // A big accept-all reserves real copies on both shelves; above the
  // threshold the button confirms once before firing.
  const needsConfirm = acceptTargets.length > BULK_ACCEPT_CONFIRM_THRESHOLD;
  const counterpartyName = memberName(acceptTargets[0]?.counterparty.name);

  return (
    <div className="flex shrink-0 flex-col items-end gap-1">
      <div className="flex items-center gap-1.5">
        <Button size="sm" variant="outline" disabled={acting} onClick={() => void runAll(decline)}>
          {m.trades_decline_all()}
        </Button>
        {acceptTargets.length >= 2 && (
          <Button
            size="sm"
            disabled={acting}
            onClick={() => (needsConfirm ? setConfirmOpen(true) : void acceptAll())}
          >
            {m.trades_accept_all({ count: acceptTargets.length })}
          </Button>
        )}
      </div>
      {choiceLine}
      {needsConfirm ? (
        <ConfirmActionDialog
          open={confirmOpen}
          onOpenChange={setConfirmOpen}
          onConfirm={() => {
            setConfirmOpen(false);
            void acceptAll();
          }}
          title={m.trades_accept_all_confirm_title({
            count: acceptTargets.length,
            name: counterpartyName,
          })}
          description={m.trades_accept_all_confirm_description()}
          confirmLabel={m.trades_accept_all({ count: acceptTargets.length })}
          destructive={false}
        />
      ) : null}
    </div>
  );
}
