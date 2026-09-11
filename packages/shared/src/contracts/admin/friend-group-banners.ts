import { extendZodWithOpenApi } from "@asteasolutions/zod-to-openapi";
import { isoDateTime } from "@openrift/shared/schemas";
import { z } from "zod";

import { authedRoute } from "../_base.js";

extendZodWithOpenApi(z);

const TAG = "Admin - Group Banners";

const GB = "/api/admin/v1/friend-group-banners";

export const adminGroupBannerSchema = z
  .object({
    groupId: z.string(),
    groupSlug: z.string(),
    groupName: z.string(),
    bannerUrl: z.string(),
    bannerPosition: z.number().int(),
    uploadedAt: isoDateTime.nullable(),
    uploaderUserId: z.string().nullable(),
    uploaderName: z.string().nullable(),
    uploaderEmail: z.string().nullable(),
    memberCount: z.number().int().nonnegative(),
  })
  .openapi("AdminGroupBannerResponse");

/** Admin-gated by the mount, not enforced here. */
export const adminFriendGroupBannersContract = {
  list: authedRoute
    .route({ method: "GET", path: GB, tags: [TAG] })
    .output(z.object({ items: z.array(adminGroupBannerSchema) })),
  remove: authedRoute
    .route({ method: "DELETE", path: `${GB}/{groupId}`, tags: [TAG], successStatus: 204 })
    .errors({ NOT_FOUND: { message: "Group not found" } })
    .input(z.object({ groupId: z.uuid() })),
};

export type AdminFriendGroupBannersContract = typeof adminFriendGroupBannersContract;
export type AdminGroupBanner = z.infer<typeof adminGroupBannerSchema>;
export interface AdminGroupBannersResponse {
  items: AdminGroupBanner[];
}
