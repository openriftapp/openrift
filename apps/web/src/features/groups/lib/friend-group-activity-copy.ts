import { memberName } from "@/lib/member-name";
import { m } from "@/paraglide/messages.js";

interface TradeParties {
  giverUserId: string | null;
  giverName: string | null;
  receiverUserId: string | null;
  receiverName: string | null;
}

function isViewer(userId: string | null, viewerId: string | null | undefined): boolean {
  return userId !== null && userId === viewerId;
}

export function tradeBatchText(
  batch: TradeParties & { totalQuantity: number },
  viewerId: string | null | undefined,
) {
  const count = batch.totalQuantity;
  const giver = memberName(batch.giverName, batch.giverUserId === null);
  const receiver = memberName(batch.receiverName, batch.receiverUserId === null);
  if (isViewer(batch.giverUserId, viewerId)) {
    return m.groups_activity_trade_batch_you_gave({ count, receiver });
  }
  if (isViewer(batch.receiverUserId, viewerId)) {
    return m.groups_activity_trade_batch_you_received({ giver, count });
  }
  return m.groups_activity_trade_batch({ giver, count, receiver });
}

export function tradeCompletedText(
  event: TradeParties & { quantity: number },
  card: string,
  viewerId: string | null | undefined,
) {
  const { quantity } = event;
  const giver = memberName(event.giverName, event.giverUserId === null);
  const receiver = memberName(event.receiverName, event.receiverUserId === null);
  if (isViewer(event.giverUserId, viewerId)) {
    return m.groups_activity_trade_completed_you_gave({ quantity, card, receiver });
  }
  if (isViewer(event.receiverUserId, viewerId)) {
    return m.groups_activity_trade_completed_you_received({ giver, quantity, card });
  }
  return m.groups_activity_trade_completed({ giver, quantity, card, receiver });
}
