import type { CardTradeResponse } from "@openrift/shared/types/api/card-trade";

type SeenFields = Pick<
  CardTradeResponse,
  "autoAccepted" | "status" | "role" | "initiator" | "recipientSeenAt"
>;

type AgreedSeenState = "new" | "unseen-by-them" | "seen-by-them";

export function agreedSeenState(trade: SeenFields): AgreedSeenState | null {
  if (!trade.autoAccepted || trade.status !== "reserved") {
    return null;
  }
  const seen = trade.recipientSeenAt !== null;
  if (trade.role === trade.initiator) {
    return seen ? "seen-by-them" : "unseen-by-them";
  }
  return seen ? null : "new";
}

export function newAgreedTrades<TTrade extends SeenFields>(trades: readonly TTrade[]): TTrade[] {
  return trades.filter((trade) => agreedSeenState(trade) === "new");
}
