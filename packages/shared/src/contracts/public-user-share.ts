import { extendZodWithOpenApi } from "@asteasolutions/zod-to-openapi";
import {
  contactMethodSchema,
  listIntentResponseSchema,
  listKindResponseSchema,
  publicListDetailResponseSchema,
} from "@openrift/shared/response-schemas";
import { oc } from "@orpc/contract";
import { z } from "zod";

extendZodWithOpenApi(z);

const groupRefSchema = z.object({
  id: z.string(),
  slug: z.string(),
  name: z.string(),
});

export const profileLastActiveSchema = z.enum(["today", "week", "month", "older"]);

export const publicUserBundleListResponseSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    intent: listIntentResponseSchema,
    kind: listKindResponseSchema,
    entryCount: z.number().int().nonnegative(),
    isPublic: z.boolean(),
    viaGroups: z.array(groupRefSchema),
    createdAt: z.string(),
    updatedAt: z.string(),
    hasRule: z.boolean(),
    previewImageIds: z.array(z.string()),
    matchCount: z.number().int().nonnegative().nullable(),
  })
  .openapi("PublicUserBundleListResponse");

export const publicUserProfileStatsSchema = z
  .object({
    collection: z
      .object({
        copies: z.number().int().nonnegative(),
        uniqueCards: z.number().int().nonnegative(),
      })
      .nullable(),
    contributions: z.object({
      total: z.number().int().nonnegative(),
      cardFixes: z.number().int().nonnegative(),
      newCards: z.number().int().nonnegative(),
      photos: z.number().int().nonnegative(),
      metaEvents: z.number().int().nonnegative(),
    }),
    tournaments: z.object({
      played: z.number().int().nonnegative(),
      bestFinish: z
        .object({ rank: z.number().int().positive(), players: z.number().int().positive() })
        .nullable(),
    }),
    decks: z.object({
      total: z.number().int().nonnegative(),
      topLegend: z.object({ name: z.string(), slug: z.string() }).nullable(),
    }),
  })
  .openapi("PublicUserProfileStats");

export const publicUserBundleCollectionResponseSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    description: z.string().nullable(),
    viaGroups: z.array(groupRefSchema),
    previewImageIds: z.array(z.string()),
  })
  .openapi("PublicUserBundleCollectionResponse");

export const publicUserBundleResponseSchema = z
  .object({
    owner: z.object({
      displayName: z.string(),
      gravatarHash: z.string(),
      userId: z.string().nullable(),
      isViewer: z.boolean(),
      bio: z.string().nullable(),
      riotId: z.string().nullable(),
      memberSince: z.string(),
      lastActive: profileLastActiveSchema.nullable(),
      isContributor: z.boolean(),
    }),
    groupsInCommon: z.array(groupRefSchema),
    contactMethods: z.array(contactMethodSchema),
    stats: publicUserProfileStatsSchema,
    overlap: z
      .object({
        theyWantYouHave: z.number().int().nonnegative(),
        theyOfferYouWant: z.number().int().nonnegative(),
      })
      .nullable(),
    lists: z.array(publicUserBundleListResponseSchema),
    collections: z.array(publicUserBundleCollectionResponseSchema),
  })
  .openapi("PublicUserBundleResponse");

/**
 * The bundle token resolves the owner; per-list visibility additionally needs
 * a per-list share token or a friend-group share with the viewer's groups.
 */
export const publicUserShareContract = {
  bundle: oc
    .route({ method: "GET", path: "/api/v1/users/share/{token}", tags: ["User Share"] })
    .meta({ auth: "public", cache: "short", cacheVary: "viewer" })
    .input(z.object({ token: z.string().min(1) }))
    .errors({ NOT_FOUND: { message: "Not found" } })
    .output(publicUserBundleResponseSchema),

  bundleList: oc
    .route({
      method: "GET",
      path: "/api/v1/users/share/{token}/lists/{listId}",
      tags: ["User Share"],
    })
    .meta({ auth: "public", cache: "short", cacheVary: "viewer" })
    .input(z.object({ token: z.string().min(1), listId: z.uuid() }))
    .errors({ NOT_FOUND: { message: "Not found" } })
    .output(publicListDetailResponseSchema),
};

export type PublicUserShareContract = typeof publicUserShareContract;
