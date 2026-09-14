import { tradeSettlementFingerprint } from "@openrift/shared/trade-settlement";
import type { TradeSettlementOptions } from "@openrift/shared/trade-settlement";

const requests = new Map<string, { requestId: string; completed: boolean }>();

function settlementRequestId(key: string): string {
  const current = requests.get(key);
  if (current !== undefined && !current.completed) {
    return current.requestId;
  }
  let stored: string | null = null;
  try {
    stored = sessionStorage.getItem(key);
  } catch {
    // ignore
  }
  const requestId = stored !== null && stored !== current?.requestId ? stored : crypto.randomUUID();
  requests.set(key, { requestId, completed: false });
  try {
    sessionStorage.setItem(key, requestId);
  } catch {
    // ignore
  }
  return requestId;
}

function completeSettlementRequest(key: string, requestId: string): void {
  if (requests.get(key)?.requestId === requestId) {
    requests.set(key, { requestId, completed: true });
  }
  try {
    if (sessionStorage.getItem(key) === requestId) {
      sessionStorage.removeItem(key);
    }
  } catch {
    // ignore
  }
}

export async function runTradeSettlement<T>(
  userId: string,
  action: "apply" | "skip",
  input: TradeSettlementOptions & { tradeId: string },
  send: (requestId: string) => Promise<T>,
): Promise<T> {
  const key = `openrift-settlement:${JSON.stringify([userId, input.tradeId, tradeSettlementFingerprint(action, input)])}`;
  const requestId = settlementRequestId(key);
  const result = await send(requestId);
  completeSettlementRequest(key, requestId);
  return result;
}
