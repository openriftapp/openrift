import type { TradeCancelConflictData } from "@openrift/shared/contracts/fields";
import { pluralize } from "@openrift/shared/strings";

import type { Repos, Transact } from "../../../deps.js";
import type { AppError } from "../../../errors.js";
import { conflict } from "../../../errors.js";
import { claimCopiesForOffers } from "../repositories/trade-offer-claims.js";

export function tooFewAvailable(count: number): AppError {
  const noun = pluralize(count, "copy is", "copies are");
  return conflict(`Only ${count} ${noun} still available`);
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

/** Threshold is the trade's own `quantity`, not zero. */
async function findUnfillablePendingTrades(
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

  // Offers claim first, oldest first — the same allocation assertSupplyAvailable
  // runs, so a trade this sweep keeps is exactly one createTrade would allow.
  const { claimed, unfillable } = claimCopiesForOffers(
    pending.filter((trade) => trade.initiator === "giver"),
    supplyByGroup,
  );
  const doomed = unfillable.map((offer) => offer.id);

  // Requests are bids, not commitments: they never consume from each other, so
  // each is judged against what the surviving offers left.
  for (const trade of pending) {
    if (trade.initiator === "giver") {
      continue;
    }
    const free = (supplyByGroup.get(trade.groupId) ?? []).filter((copyId) => !claimed.has(copyId));
    if (free.length < trade.quantity) {
      doomed.push(trade.id);
    }
  }
  return doomed;
}

async function cancelPendingTrades(
  trxRepos: Repos,
  tradeIds: readonly string[],
): Promise<string[]> {
  const cancelled: string[] = [];
  for (const tradeId of tradeIds) {
    // Guarded on `status = 'pending'`, so a concurrent accept/decline that
    // already moved the row wins and nothing is recorded here.
    if ((await trxRepos.cardTrades.markAutoCancelled(tradeId)) > 0) {
      cancelled.push(tradeId);
    }
  }
  return cancelled;
}

/**
 * Runs inside the caller's transaction so the supply drop and the
 * cancellations commit together.
 */
export async function autoCancelUnfillablePendingTrades(
  trxRepos: Repos,
  giverUserId: string,
  printingId: string,
): Promise<string[]> {
  return cancelPendingTrades(
    trxRepos,
    await findUnfillablePendingTrades(trxRepos, giverUserId, printingId),
  );
}

/** Thrown inside the edit's transaction, so the edit rolls back with it. */
export class TradeCancelConsentRequiredError extends Error {
  readonly data: TradeCancelConflictData;

  constructor(data: TradeCancelConflictData) {
    super("This change would cancel pending trades");
    this.name = "TradeCancelConsentRequiredError";
    this.data = data;
  }
}

export async function refusingUnconfirmedTradeCancels<T>(
  run: Promise<T>,
  refuse: (data: TradeCancelConflictData) => Error,
): Promise<T> {
  try {
    return await run;
  } catch (error) {
    if (error instanceof TradeCancelConsentRequiredError) {
      throw refuse(error.data);
    }
    throw error;
  }
}

/**
 * How a sweep treats the trades it finds unfillable. `silent` is for internal callers whose own
 * action settles the question (settling a trade, writing off a loan). `preview` cancels and
 * records, inside a transaction that is rolled back afterwards.
 */
export type TradeCancelConsent =
  | { readonly kind: "silent" }
  | { readonly kind: "listed"; readonly tradeIds: ReadonlySet<string> }
  | { readonly kind: "preview"; readonly cancelled: Set<string> };

export const CANCEL_WITHOUT_ASKING: TradeCancelConsent = { kind: "silent" };

export function consentedTradeCancels(tradeIds: readonly string[] = []): TradeCancelConsent {
  return { kind: "listed", tradeIds: new Set(tradeIds) };
}

/** Runs inside the caller's transaction after a change that may have shrunk the giver's supply of
 * these printings; under a `listed` consent, a trade it would cancel that is not listed throws. */
export async function sweepGiverPrintings(
  trxRepos: Repos,
  giverUserId: string,
  printingIds: Iterable<string>,
  consent: TradeCancelConsent,
): Promise<void> {
  const doomed: string[] = [];
  for (const printingId of new Set(printingIds)) {
    doomed.push(...(await findUnfillablePendingTrades(trxRepos, giverUserId, printingId)));
  }
  if (consent.kind === "listed" && doomed.some((tradeId) => !consent.tradeIds.has(tradeId))) {
    const trades = await trxRepos.cardTrades.listCancelSummaries(doomed);
    throw new TradeCancelConsentRequiredError({ trades });
  }
  const cancelled = await cancelPendingTrades(trxRepos, doomed);
  if (consent.kind === "preview") {
    for (const tradeId of cancelled) {
      consent.cancelled.add(tradeId);
    }
  }
}

/** Runs inside the caller's transaction after an edit that may have shrunk the giver's supply; a
 * trade it would cancel that is missing from `cancelTradeIds` throws instead of cancelling. */
export async function sweepGiverTradesInGroups(
  trxRepos: Repos,
  giverUserId: string,
  groupIds: Iterable<string>,
  cancelTradeIds: readonly string[],
): Promise<void> {
  const printingIds = new Set<string>();
  for (const groupId of new Set(groupIds)) {
    const pending = await trxRepos.cardTrades.listPendingPrintingIdsForGiverInGroup(
      groupId,
      giverUserId,
    );
    for (const printingId of pending) {
      printingIds.add(printingId);
    }
  }
  await sweepGiverPrintings(
    trxRepos,
    giverUserId,
    printingIds,
    consentedTradeCancels(cancelTradeIds),
  );
}

class PreviewRollbackError extends Error {
  constructor() {
    super("Preview rolled back");
    this.name = "PreviewRollbackError";
  }
}

/** Runs `write` under a recording consent in a transaction that always rolls back, so the answer
 * comes from the code the write itself runs, ownership checks and refusals included. */
export async function previewTradeCancels(
  transact: Transact,
  write: (trxRepos: Repos, consent: TradeCancelConsent) => Promise<unknown>,
): Promise<TradeCancelConflictData> {
  const consent = { kind: "preview" as const, cancelled: new Set<string>() };
  let trades: TradeCancelConflictData["trades"] = [];
  try {
    await transact(async (trxRepos) => {
      await write(trxRepos, consent);
      trades = await trxRepos.cardTrades.listCancelSummaries([...consent.cancelled]);
      throw new PreviewRollbackError();
    });
  } catch (error) {
    if (!(error instanceof PreviewRollbackError)) {
      throw error;
    }
  }
  return { trades };
}
