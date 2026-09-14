import { ERROR_CODES } from "@openrift/shared/error-codes";

import type { Repos } from "../../../deps.js";
import { AppError } from "../../../errors.js";
import { claimCopiesForOffers } from "../repositories/trade-offer-claims.js";

export function tooFewAvailable(count: number): AppError {
  const noun = count === 1 ? "copy is" : "copies are";
  return new AppError(409, ERROR_CODES.CONFLICT, `Only ${count} ${noun} still available`);
}

/**
 * Offers count against supply; requests are bids that claim nothing.
 * `excludeTradeId` excludes the trade being resized from its own claim.
 */
export async function assertSupplyAvailable(
  repos: Repos,
  groupId: string,
  giverUserId: string,
  printingId: string,
  quantity: number,
  excludeTradeId?: string,
): Promise<void> {
  const pending = await repos.cardTrades.listPendingForGiverPrinting(giverUserId, printingId);
  const offers = pending.filter(
    (trade) => trade.initiator === "giver" && trade.id !== excludeTradeId,
  );
  const supplyByGroup = await readSupplyByGroup(
    repos,
    new Set([groupId, ...offers.map((offer) => offer.groupId)]),
    giverUserId,
    printingId,
  );
  const { claimed } = claimCopiesForOffers(offers, supplyByGroup);
  const available = (supplyByGroup.get(groupId) ?? []).filter((copyId) => !claimed.has(copyId));
  if (quantity > available.length) {
    throw tooFewAvailable(available.length);
  }
}

/** Sequential: the repos may be bound to a single transaction connection. */
async function readSupplyByGroup(
  repos: Repos,
  groupIds: Iterable<string>,
  giverUserId: string,
  printingId: string,
): Promise<Map<string, string[]>> {
  const byGroup = new Map<string, string[]>();
  for (const groupId of groupIds) {
    const { unreservedCopyIds } = await repos.friendGroupMatches.giverPrintingSupply({
      groupId,
      giverUserId,
      printingId,
    });
    byGroup.set(groupId, unreservedCopyIds);
  }
  return byGroup;
}

/**
 * Threshold is the trade's own `quantity`, not zero. Runs inside the caller's
 * transaction so the supply drop and the cancellations commit together.
 */
export async function autoCancelUnfillablePendingTrades(
  trxRepos: Repos,
  giverUserId: string,
  printingId: string,
): Promise<string[]> {
  const pending = await trxRepos.cardTrades.listPendingForGiverPrinting(giverUserId, printingId);
  if (pending.length === 0) {
    return [];
  }

  const supplyByGroup = await readSupplyByGroup(
    trxRepos,
    new Set(pending.map((trade) => trade.groupId)),
    giverUserId,
    printingId,
  );

  const cancelled: string[] = [];
  const cancel = async (tradeId: string): Promise<void> => {
    // Guarded on `status = 'pending'`, so a concurrent accept/decline that
    // already moved the row wins and nothing is recorded here.
    if ((await trxRepos.cardTrades.markAutoCancelled(tradeId)) > 0) {
      cancelled.push(tradeId);
    }
  };

  // Offers claim first, oldest first — the same allocation assertSupplyAvailable
  // runs, so a trade this sweep keeps is exactly one createTrade would allow.
  const { claimed, unfillable } = claimCopiesForOffers(
    pending.filter((trade) => trade.initiator === "giver"),
    supplyByGroup,
  );
  for (const offer of unfillable) {
    await cancel(offer.id);
  }

  // Requests are bids, not commitments: they never consume from each other, so
  // each is judged against what the surviving offers left.
  for (const trade of pending) {
    if (trade.initiator === "giver") {
      continue;
    }
    const free = (supplyByGroup.get(trade.groupId) ?? []).filter((copyId) => !claimed.has(copyId));
    if (free.length < trade.quantity) {
      await cancel(trade.id);
    }
  }

  return cancelled;
}
