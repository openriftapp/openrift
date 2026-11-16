import type { CardTradeResponse } from "@openrift/shared/types/api/card-trade";
import { useState } from "react";

import { ConfirmActionDialog } from "@/components/confirm-action-dialog";
import { Button } from "@/components/ui/button";
import {
  useAcceptTrade,
  useCancelTrade,
  useDeclineTrade,
} from "@/features/groups/hooks/use-card-trades";
import { useTradeActionStore } from "@/features/groups/stores/trade-action-store";
import { memberName } from "@/lib/member-name";
import { runReportedMutation } from "@/lib/run-reported-mutation";
import { m } from "@/paraglide/messages.js";

type BulkMode = "accept-decline" | "cancel" | "none";

const BULK_ACCEPT_CONFIRM_THRESHOLD = 10;

/** Bulk accept sends no `copyIds`; the server defaults to plainest copies when none are given. */
export function BulkTradeActions({
  trades,
  mode,
}: {
  trades: CardTradeResponse[];
  mode: BulkMode;
}) {
  const accept = useAcceptTrade();
  const decline = useDeclineTrade();
  const cancel = useCancelTrade();
  const begin = useTradeActionStore((state) => state.begin);
  const settle = useTradeActionStore((state) => state.settle);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const needle = mode === "accept-decline" ? "accept-or-decline" : "cancel";
  const targets = mode === "none" ? [] : trades.filter((trade) => trade.actionNeeded === needle);
  const acting = useTradeActionStore((state) =>
    targets.some((trade) => state.pending.has(trade.id)),
  );

  // Declared above the early returns for the React Compiler. Sequential: accept
  // reads the giver's unreserved copies before locking, so parallel accepts collide.
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

  if (targets.length < 2) {
    return null;
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
  const needsConfirm = targets.length > BULK_ACCEPT_CONFIRM_THRESHOLD;
  const counterpartyName = memberName(targets[0]?.counterparty.name);

  return (
    <div className="flex shrink-0 items-center gap-1.5">
      <Button size="sm" variant="outline" disabled={acting} onClick={() => void runAll(decline)}>
        {m.trades_decline_all()}
      </Button>
      <Button
        size="sm"
        disabled={acting}
        onClick={() => (needsConfirm ? setConfirmOpen(true) : void runAll(accept))}
      >
        {m.trades_accept_all({ count: targets.length })}
      </Button>
      {needsConfirm ? (
        <ConfirmActionDialog
          open={confirmOpen}
          onOpenChange={setConfirmOpen}
          onConfirm={() => {
            setConfirmOpen(false);
            void runAll(accept);
          }}
          title={m.trades_accept_all_confirm_title({
            count: targets.length,
            name: counterpartyName,
          })}
          description={m.trades_accept_all_confirm_description()}
          confirmLabel={m.trades_accept_all({ count: targets.length })}
          destructive={false}
        />
      ) : null}
    </div>
  );
}
