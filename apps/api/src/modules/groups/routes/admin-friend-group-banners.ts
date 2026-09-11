import { adminFriendGroupBannersContract } from "@openrift/shared/contracts/admin/friend-group-banners";
import type { AdminGroupBannersResponse } from "@openrift/shared/contracts/admin/friend-group-banners";
import { ERROR_CODES } from "@openrift/shared/error-codes";
import { implement } from "@orpc/server";

import { AppError } from "../../../errors.js";
import { requireAuthedUser } from "../../../orpc/base.js";
import type { ApiContext } from "../../../orpc/context.js";
import { deleteGroupBanner } from "../services/group-banners.js";

const os = implement(adminFriendGroupBannersContract).$context<ApiContext>().use(requireAuthedUser);

/**
 * Moderation for member-uploaded group banners: every banner in one list, and
 * a takedown that clears the row and unlinks the file.
 */
export const adminFriendGroupBannersRouter = {
  list: os.list.handler(async ({ context }): Promise<AdminGroupBannersResponse> => {
    const rows = await context.repos.friendGroups.listBanners();
    return {
      items: rows.map((row) => ({
        groupId: row.groupId,
        groupSlug: row.slug,
        groupName: row.name,
        bannerUrl: row.bannerUrl,
        bannerPosition: row.bannerPosition,
        uploadedAt: row.bannerUploadedAt?.toISOString() ?? null,
        uploaderUserId: row.uploaderUserId,
        uploaderName: row.uploaderName,
        uploaderEmail: row.uploaderEmail,
        memberCount: row.memberCount,
      })),
    };
  }),

  remove: os.remove.handler(async ({ input, context }): Promise<void> => {
    const written = await context.repos.friendGroups.clearBanner(input.groupId);
    if (!written) {
      throw new AppError(404, ERROR_CODES.NOT_FOUND, "Group not found");
    }
    await deleteGroupBanner(context.io, written.previous.bannerUrl);
  }),
};
