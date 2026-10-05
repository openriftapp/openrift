import { friendGroupsContract } from "@openrift/shared/contracts/friend-groups";
import { ERROR_CODES } from "@openrift/shared/error-codes";
import type {
  FriendGroupShareableCollectionsResponse,
  FriendGroupShareableListsResponse,
  FriendGroupSharedCollectionDetailResponse,
  FriendGroupSharedListDetailResponse,
} from "@openrift/shared/types/api/friend-group";
import { implement } from "@orpc/server";

import { AppError } from "../../../errors.js";
import { assertFound } from "../../../lib/assertions.js";
import { requireAuthedUser } from "../../../orpc/base.js";
import type { ApiContext } from "../../../orpc/context.js";
import { toCopy } from "../../collections/lib/copy-presenters.js";
import { expandRuleListCounts } from "../../lists/lib/list-counts.js";
import { toListEntryDetail } from "../../lists/lib/list-presenters.js";
import { getFavoriteMarketplace } from "../../users/lib/preferences.js";
import { toSharedList } from "../lib/friend-group-presenters.js";
import { loadGroupBySlug, loadGroupForMember } from "../lib/group-access.js";
import { autoCancelUnfillablePendingTrades } from "../services/trade-supply.js";

const os = implement(friendGroupsContract).$context<ApiContext>().use(requireAuthedUser);

export const friendGroupsSharesRouter = {
  shareableLists: os.shareableLists.handler(
    async ({ input, context }): Promise<FriendGroupShareableListsResponse> => {
      const viewerId = context.userId;
      const { friendGroups, lists } = context.repos;

      const ctx = await loadGroupForMember(context.repos, input.slug, viewerId);

      const rows = await friendGroups.listShareableForUserInGroup(ctx.group.id, viewerId);
      // Rule-based lists materialize 0 rows; expand their real counts so the
      // share picker doesn't show "0 cards" for a smart list.
      const expandedCounts = await expandRuleListCounts(lists, rows);
      return {
        items: rows.map((row) => ({
          listId: row.listId,
          listName: row.listName,
          listIntent:
            row.listIntent as FriendGroupShareableListsResponse["items"][number]["listIntent"],
          listKind: row.listKind as FriendGroupShareableListsResponse["items"][number]["listKind"],
          entryCount: expandedCounts.get(row.listId) ?? row.entryCount,
          sharedAt: row.sharedAt ? row.sharedAt.toISOString() : null,
          tradeDefaults: {
            pricePref:
              row.defaultPricePref as FriendGroupShareableListsResponse["items"][number]["tradeDefaults"]["pricePref"],
            priceAbsoluteCents: row.defaultPriceAbsoluteCents,
            tradeType:
              row.defaultTradeType as FriendGroupShareableListsResponse["items"][number]["tradeDefaults"]["tradeType"],
          },
          currency: row.currency as FriendGroupShareableListsResponse["items"][number]["currency"],
          hasRule: row.hasRule,
        })),
      };
    },
  ),

  shareList: os.shareList.handler(async ({ input, context }): Promise<void> => {
    const viewerId = context.userId;
    const { friendGroups, lists } = context.repos;

    const ctx = await loadGroupForMember(context.repos, input.slug, viewerId);

    const list = await lists.getByIdForUser(input.listId, viewerId);
    assertFound(list, "List not found");

    await friendGroups.share(ctx.group.id, input.listId, viewerId);
  }),

  unshareList: os.unshareList.handler(async ({ input, context }): Promise<void> => {
    const viewerId = context.userId;
    const { friendGroups, lists } = context.repos;

    const ctx = await loadGroupForMember(context.repos, input.slug, viewerId);

    const list = await lists.getByIdForUser(input.listId, viewerId);
    assertFound(list, "List not found");

    if (list.intent !== "trade") {
      await friendGroups.unshare(ctx.group.id, input.listId);
      return;
    }

    // The unshare and the pending-trade supply recheck must run in the same transaction.
    await context.transact(async (trxRepos) => {
      await trxRepos.friendGroups.unshare(ctx.group.id, input.listId);
      const printingIds = await trxRepos.cardTrades.listPendingPrintingIdsForGiverInGroup(
        ctx.group.id,
        viewerId,
      );
      for (const printingId of printingIds) {
        // Sequential: the repos are bound to a single transaction connection.
        await autoCancelUnfillablePendingTrades(trxRepos, viewerId, printingId);
      }
    });
  }),

  getSharedList: os.getSharedList.handler(
    async ({ input, context }): Promise<FriendGroupSharedListDetailResponse> => {
      const viewerId = context.userId;
      const { friendGroups, lists } = context.repos;

      const group = await loadGroupBySlug(context.repos, input.slug);

      const shared = await friendGroups.getSharedList(group.id, input.listId, viewerId);
      assertFound(shared, "List not shared with this group");

      const kind = shared.list.kind;
      const entries = await lists.entriesWithDetailsAnon(input.listId, kind);

      return {
        list: toSharedList(shared),
        entries: entries.map((row) => toListEntryDetail(row)),
      };
    },
  ),

  shareableCollections: os.shareableCollections.handler(
    async ({ input, context }): Promise<FriendGroupShareableCollectionsResponse> => {
      const viewerId = context.userId;
      const { friendGroups } = context.repos;

      const ctx = await loadGroupForMember(context.repos, input.slug, viewerId);

      const rows = await friendGroups.collectionShareableForUserInGroup(ctx.group.id, viewerId);
      return {
        items: rows.map((row) => ({
          collectionId: row.collectionId,
          collectionName: row.collectionName,
          sharedAt: row.sharedAt ? row.sharedAt.toISOString() : null,
        })),
      };
    },
  ),

  shareCollection: os.shareCollection.handler(async ({ input, context }): Promise<void> => {
    const viewerId = context.userId;
    const { friendGroups, collections } = context.repos;

    const ctx = await loadGroupForMember(context.repos, input.slug, viewerId);

    // Confirm viewer owns this personal collection. Pooled collections will
    // be rejected by the composite FK anyway, but a 404 here is clearer than
    // a 500 from the DB.
    const access = await collections.getAccessForUser(input.collectionId, viewerId);
    if (!access || access.collection.userId !== viewerId) {
      throw new AppError(404, ERROR_CODES.NOT_FOUND, "Collection not found or not yours to share");
    }

    await friendGroups.shareCollection(ctx.group.id, input.collectionId, viewerId);
  }),

  unshareCollection: os.unshareCollection.handler(async ({ input, context }): Promise<void> => {
    const viewerId = context.userId;
    const { friendGroups, collections } = context.repos;

    const ctx = await loadGroupForMember(context.repos, input.slug, viewerId);

    const access = await collections.getAccessForUser(input.collectionId, viewerId);
    if (!access || access.collection.userId !== viewerId) {
      throw new AppError(404, ERROR_CODES.NOT_FOUND, "Collection not found");
    }

    await friendGroups.unshareCollection(ctx.group.id, input.collectionId);
  }),

  getSharedCollection: os.getSharedCollection.handler(
    async ({ input, context }): Promise<FriendGroupSharedCollectionDetailResponse> => {
      const viewerId = context.userId;
      const repos = context.repos;
      const { friendGroups, copies, marketplace } = repos;

      const group = await loadGroupBySlug(repos, input.slug);

      const shared = await friendGroups.getSharedCollection(group.id, input.collectionId, viewerId);
      assertFound(shared, "Collection not shared with this group");

      // Value uses the owner's favorite marketplace, matching what the owner
      // sees and what the public-share-token page does.
      const favMarketplace = await getFavoriteMarketplace(repos, shared.collection.userId);
      const value = await marketplace.singleCollectionValue(input.collectionId, favMarketplace);
      // Full set (no pagination): the shared-collection detail view renders every
      // copy and reports the exact copyCount. Unbounded by design today.
      const copyRows = await copies.listForCollection(input.collectionId);

      // This route serves personally-owned collections shared into the group,
      // so private notes stay owner-only: null them out for every viewer but
      // the owner. (Group-owned collections flow through the copies feed
      // instead, where members legitimately see private notes.)
      const viewerIsOwner = shared.collection.userId === viewerId;

      return {
        collection: {
          id: shared.collection.id,
          name: shared.collection.name,
          description: shared.collection.description,
          copyCount: copyRows.length,
          totalValueCents: value?.totalValueCents ?? null,
          unpricedCopyCount: value?.unpricedCopyCount ?? null,
          ownerUserId: shared.collection.userId,
          ownerName: shared.ownerName,
        },
        copies: copyRows.map((row) => {
          const copy = toCopy(row);
          return viewerIsOwner ? copy : { ...copy, notesPrivate: null };
        }),
        viewerRole: shared.viewerRole,
      };
    },
  ),
};
