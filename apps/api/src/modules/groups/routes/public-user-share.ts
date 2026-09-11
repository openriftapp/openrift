import { publicUserShareContract } from "@openrift/shared/contracts/public-user-share";
import type { PublicListDetailResponse } from "@openrift/shared/types/api/list";
import type { PublicUserBundleResponse } from "@openrift/shared/types/api/user-share";
import { implement } from "@orpc/server";

import { gravatarHashForEmail } from "../../../lib/gravatar.js";
import { requireUser } from "../../../orpc/base.js";
import type { ApiContext } from "../../../orpc/context.js";
import {
  parseListRules,
  toListEntryDetail,
  toPublicList,
} from "../../lists/lib/list-presenters.js";
import { tournamentHistoryForUser } from "../../tournaments/lib/player-history.js";
import {
  PREVIEW_IMAGE_COUNT,
  expandOwnerLists,
  overlapWithViewer,
} from "../lib/user-profile-lists.js";
import { lastActiveBucket } from "../lib/user-profile-presenters.js";

const os = implement(publicUserShareContract).$context<ApiContext>().use(requireUser);

/** The viewer-dependent `Cache-Control` is set in the mount, not here. */
export const publicUserShareRouter = {
  bundle: os.bundle.handler(
    async ({ input, context, errors }): Promise<PublicUserBundleResponse> => {
      const {
        userShares,
        friendGroups,
        lists: listsRepo,
        userProfile,
        canonicalPrintings,
        podTournaments,
      } = context.repos;
      const viewerUserId = context.user?.id ?? null;

      const owner = await userShares.findOwnerByShareToken(input.token);
      if (!owner) {
        throw errors.NOT_FOUND({ message: "Not found" });
      }
      const otherViewerId =
        viewerUserId !== null && viewerUserId !== owner.userId ? viewerUserId : null;

      const [
        lists,
        collections,
        groupsInCommon,
        contactMethods,
        lastActiveAt,
        collection,
        submissions,
        metaEvents,
        decks,
        tournaments,
      ] = await Promise.all([
        userShares.listsForOwner(owner.userId, viewerUserId),
        viewerUserId
          ? friendGroups.collectionsBundleForViewer(owner.userId, viewerUserId)
          : Promise.resolve([]),
        otherViewerId
          ? friendGroups.sharedGroups(otherViewerId, owner.userId)
          : Promise.resolve([]),
        viewerUserId
          ? friendGroups.revealedContactsForViewer(owner.userId, viewerUserId)
          : Promise.resolve([]),
        owner.profileShowLastActive
          ? userProfile.lastActiveAt(owner.userId)
          : Promise.resolve(null),
        owner.profileShowCollection
          ? userProfile.collectionSummary(owner.userId)
          : Promise.resolve(null),
        userProfile.acceptedSubmissionCounts(owner.userId),
        userProfile.metaEventCredits(owner.userId),
        userProfile.deckSummary(owner.userId),
        tournamentHistoryForUser({ userProfile, podTournaments }, owner.userId),
      ]);

      const listRefs = lists.map(({ list }) => ({
        id: list.id,
        kind: list.kind,
        intent: list.intent,
      }));
      const profileRepos = { lists: listsRepo, userProfile, canonicalPrintings };
      const [expanded, collectionPreviews] = await Promise.all([
        expandOwnerLists(profileRepos, listRefs),
        userProfile.collectionPreviewImageIds(
          collections.map((col) => col.collectionId),
          PREVIEW_IMAGE_COUNT,
        ),
      ]);
      const overlap = otherViewerId
        ? await overlapWithViewer(profileRepos, otherViewerId, listRefs, expanded)
        : null;

      const contributionsTotal =
        submissions.corrections + submissions.newCards + submissions.images + metaEvents;

      return {
        owner: {
          displayName: owner.displayName ?? "Anonymous",
          gravatarHash: gravatarHashForEmail(owner.email),
          userId: groupsInCommon.length > 0 ? owner.userId : null,
          isViewer: viewerUserId === owner.userId,
          bio: owner.bio,
          riotId: owner.profileShowRiotId ? owner.riotId : null,
          memberSince: owner.createdAt.toISOString(),
          lastActive: lastActiveBucket(lastActiveAt, new Date()),
          isContributor: contributionsTotal > 0,
        },
        groupsInCommon,
        contactMethods,
        stats: {
          collection,
          contributions: {
            total: contributionsTotal,
            cardFixes: submissions.corrections,
            newCards: submissions.newCards,
            photos: submissions.images,
            metaEvents,
          },
          tournaments,
          decks,
        },
        overlap: overlap
          ? {
              theyWantYouHave: overlap.theyWantYouHave,
              theyOfferYouWant: overlap.theyOfferYouWant,
            }
          : null,
        lists: lists.map(({ list, entryCount, viaGroups }) => ({
          id: list.id,
          name: list.name,
          intent: list.intent,
          kind: list.kind,
          entryCount: expanded.get(list.id)?.entryCount ?? entryCount,
          isPublic: list.shareToken !== null,
          viaGroups,
          createdAt: list.createdAt.toISOString(),
          updatedAt: list.updatedAt.toISOString(),
          hasRule: parseListRules(list.rules).length > 0,
          previewImageIds: expanded.get(list.id)?.previewImageIds ?? [],
          matchCount: overlap ? (overlap.perList.get(list.id) ?? 0) : null,
        })),
        collections: collections.map((col) => ({
          id: col.collectionId,
          name: col.collectionName,
          description: col.collectionDescription,
          viaGroups: col.viaGroups,
          previewImageIds: collectionPreviews.get(col.collectionId) ?? [],
        })),
      };
    },
  ),

  bundleList: os.bundleList.handler(
    async ({ input, context, errors }): Promise<PublicListDetailResponse> => {
      const { userShares, lists } = context.repos;
      const viewerUserId = context.user?.id ?? null;

      const list = await userShares.findListInBundle(input.token, input.listId, viewerUserId);
      if (!list) {
        throw errors.NOT_FOUND({ message: "Not found" });
      }

      const owner = await userShares.findOwnerByShareToken(input.token);
      if (!owner) {
        throw errors.NOT_FOUND({ message: "Not found" });
      }

      const entries = await lists.entriesWithDetailsAnon(list.id, list.kind);

      return {
        list: toPublicList(list),
        entries: entries.map((row) => toListEntryDetail(row)),
        owner: {
          displayName: owner.displayName ?? "Anonymous",
          gravatarHash: gravatarHashForEmail(owner.email),
        },
      };
    },
  ),
};
