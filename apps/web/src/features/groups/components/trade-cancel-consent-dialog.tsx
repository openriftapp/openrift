import { ConfirmActionDialog } from "@/components/confirm-action-dialog";
import type { CancelledTrade } from "@/features/groups/lib/trade-cancel-conflict";
import { useTradeCancelConsentStore } from "@/features/groups/stores/trade-cancel-consent-store";
import { memberName } from "@/lib/member-name";
import { m } from "@/paraglide/messages.js";

const MAX_LINES = 5;

export function TradeCancelConsentDialog({
  trades,
  cardName,
}: {
  trades: CancelledTrade[];
  cardName: (trade: CancelledTrade) => string;
}) {
  const answer = useTradeCancelConsentStore((state) => state.answer);
  const shown = trades.slice(0, MAX_LINES);
  const hidden = trades.length - shown.length;

  return (
    <ConfirmActionDialog
      open
      onOpenChange={(open) => {
        if (!open) {
          answer(false);
        }
      }}
      onConfirm={() => answer(true)}
      title={m.trades_cancel_consent_title({ count: trades.length })}
      description={
        <>
          {m.trades_cancel_consent_description()}
          {shown.map((trade) => (
            <span key={trade.id} className="text-foreground mt-1 block">
              {m.trades_cancel_consent_line({
                count: trade.quantity,
                card: cardName(trade),
                name: memberName(trade.counterpartyName),
              })}
            </span>
          ))}
          {hidden > 0 && (
            <span className="mt-1 block">{m.trades_cancel_consent_more({ count: hidden })}</span>
          )}
        </>
      }
      confirmLabel={m.trades_cancel_consent_confirm()}
      cancelLabel={m.trades_cancel_consent_keep()}
    />
  );
}
