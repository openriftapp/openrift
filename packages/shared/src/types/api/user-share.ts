import type {
  profileLastActiveSchema,
  publicUserBundleCollectionResponseSchema,
  publicUserBundleListResponseSchema,
  publicUserBundleResponseSchema,
  publicUserProfileStatsSchema,
} from "@openrift/shared/contracts/public-user-share";
import type { userShareStateResponseSchema } from "@openrift/shared/contracts/user-share";
import type { z } from "zod";

/**
 * `shareToken` is `null` when bundle sharing is disabled; `isPublic` mirrors
 * `shareToken !== null`.
 */
export type UserShareStateResponse = z.infer<typeof userShareStateResponseSchema>;

/**
 * At least one of `isPublic` and `viaGroups` is always truthy, otherwise the
 * row would not appear in the bundle response at all. `matchCount` is `null`
 * for an anonymous viewer, otherwise the count of this list's cards that sit
 * on the viewer's opposite-intent lists.
 */
export type PublicUserBundleListResponse = z.infer<typeof publicUserBundleListResponseSchema>;

/** Group-only: collections never carry a per-collection public share token here. */
export type PublicUserBundleCollectionResponse = z.infer<
  typeof publicUserBundleCollectionResponseSchema
>;

/**
 * `collections` is populated only when the viewer is authenticated and a
 * member of a friend group the owner shared collections to. `owner.userId`
 * is set only when the viewer shares a friend group with the owner;
 * `riotId`, `lastActive` and `stats.collection` are each `null` unless the
 * owner opted in to showing them. `contactMethods` holds what the owner
 * revealed in a group the viewer is also in. `overlap` is `null` for an
 * anonymous viewer or the owner viewing their own page.
 */
export type PublicUserBundleResponse = z.infer<typeof publicUserBundleResponseSchema>;

export type PublicUserProfileStats = z.infer<typeof publicUserProfileStatsSchema>;

export type ProfileLastActive = z.infer<typeof profileLastActiveSchema>;
