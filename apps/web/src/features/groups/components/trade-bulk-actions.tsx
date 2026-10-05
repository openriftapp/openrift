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

  // Declared ahead of the early returns below: the React Compiler bails on a
  // function declaration it reaches only after a `return`.
  function runAll(mutation: {
    mutate: (
      variables: { tradeId: string; groupSlug?: string },
      options?: { onSettled?: () => void },
    ) => void;
  }): void {
    for (const trade of targets) {
      begin(trade.id);
      mutation.mutate(
        { tradeId: trade.id, groupSlug: trade.groupSlug ?? undefined },
        { onSettled: () => settle(trade.id) },
      );
    }
  }

  if (targets.length < 2) {
    return null;
  }

  if (mode === "cancel") {
    return (
      <Button size="sm" variant="outline" disabled={acting} onClick={() => runAll(cancel)}>
        {m.trades_cancel_all({ count: targets.length })}
      </Button>
    );
  }
  // A big accept-all reserves real copies on both shelves; above the
  // threshold the button confirms once before firing.
  const needsConfirm = targets.length > BULK_ACCEPT_CONFIRM_THRESHOLD;
  const counterpartyName = targets[0]?.counterparty.name ?? m.trades_this_member();

  return (
    <div className="flex shrink-0 items-center gap-1.5">
      <Button size="sm" variant="outline" disabled={acting} onClick={() => runAll(decline)}>
        {m.trades_decline_all()}
      </Button>
      <Button
        size="sm"
        disabled={acting}
        onClick={() => (needsConfirm ? setConfirmOpen(true) : runAll(accept))}
      >
        {m.trades_accept_all({ count: targets.length })}
      </Button>
      {needsConfirm ? (
        <ConfirmActionDialog
          open={confirmOpen}
          onOpenChange={setConfirmOpen}
          onConfirm={() => {
            setConfirmOpen(false);
            runAll(accept);
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
