import type { TradeCancelConflictData } from "@openrift/shared/contracts/fields";
import { tradeCancelConflictDataSchema } from "@openrift/shared/contracts/fields";
import type { CardTradeLiveAnnotation } from "@openrift/shared/types/api/card-trade";
import type { ORPCError } from "@orpc/client";
import { isDefinedError } from "@orpc/client";

import { UserDeclinedError } from "@/lib/user-declined-error";

export type CancelledTrade = TradeCancelConflictData["trades"][number];

/** The trades an edit would cancel, when the server refused it for want of the user's consent. */
export function tradeCancelConflict(error: unknown): TradeCancelConflictData | undefined {
  const candidate = error as ORPCError<string, unknown>;
  if (!(isDefinedError(candidate) && candidate.code === "CONFLICT")) {
    return undefined;
  }
  const parsed = tradeCancelConflictDataSchema.safeParse(candidate.data);
  return parsed.success ? parsed.data : undefined;
}

/** Without `printingIds`, any pending trade where the viewer gives counts. */
export function hasPendingGiverTrade(
  annotations: readonly CardTradeLiveAnnotation[],
  printingIds?: ReadonlySet<string>,
): boolean {
  return annotations.some(
    (annotation) =>
      annotation.role === "giver" &&
      (annotation.phase === "asked" || annotation.phase === "offered") &&
      (printingIds === undefined || printingIds.has(annotation.printingId)),
  );
}

/** The trade ids one action's writes may cancel; it grows when a later write names new ones and the user agrees. */
export interface TradeCancelConsent {
  tradeIds: Set<string>;
  ask: (trades: CancelledTrade[]) => Promise<boolean>;
}

const consentsByMetadata = new WeakMap<object, TradeCancelConsent>();

/** Mutation metadata that carries `consent` to the collection's persist handler. */
export function tradeCancelConsentMetadata(consent: TradeCancelConsent): Record<string, unknown> {
  const metadata = {};
  consentsByMetadata.set(metadata, consent);
  return metadata;
}

export function tradeCancelConsentOf(metadata: unknown): TradeCancelConsent | undefined {
  return typeof metadata === "object" && metadata !== null
    ? consentsByMetadata.get(metadata)
    : undefined;
}

/**
 * Sends every confirmed id with each call. A refusal naming trades not yet confirmed asks about
 * those alone and resends; a decline rejects with {@link UserDeclinedError}.
 */
export async function sendWithTradeCancelConsent<T>(
  consent: TradeCancelConsent,
  call: (cancelTradeIds?: string[]) => Promise<T>,
): Promise<T> {
  for (;;) {
    try {
      return await call(consent.tradeIds.size === 0 ? undefined : [...consent.tradeIds]);
    } catch (error) {
      const fresh =
        tradeCancelConflict(error)?.trades.filter((trade) => !consent.tradeIds.has(trade.id)) ?? [];
      if (fresh.length === 0) {
        throw error;
      }
      if (!(await consent.ask(fresh))) {
        throw new UserDeclinedError();
      }
      for (const trade of fresh) {
        consent.tradeIds.add(trade.id);
      }
    }
  }
}
