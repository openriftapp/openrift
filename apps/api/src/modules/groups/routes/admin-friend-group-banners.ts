import { adminFriendGroupBannersContract } from "@openrift/shared/contracts/admin/friend-group-banners";
import type { AdminGroupBannersResponse } from "@openrift/shared/contracts/admin/friend-group-banners";
import { implement } from "@orpc/server";

import { assertFound } from "../../../lib/assertions.js";
import { requireAuthedUser } from "../../../orpc/base.js";
import type { ApiContext } from "../../../orpc/context.js";
import { toAdminGroupBanner } from "../lib/friend-group-presenters.js";
import { deleteGroupBanner } from "../services/group-banners.js";

const os = implement(adminFriendGroupBannersContract).$context<ApiContext>().use(requireAuthedUser);

/**
 * Moderation for member-uploaded group banners: every banner in one list, and
 * a takedown that clears the row and unlinks the file.
 */
export const adminFriendGroupBannersRouter = {
  list: os.list.handler(async ({ context }): Promise<AdminGroupBannersResponse> => {
    const rows = await context.repos.friendGroups.listBanners();
    return { items: rows.map((row) => toAdminGroupBanner(row)) };
  }),

  remove: os.remove.handler(async ({ input, context }): Promise<void> => {
    const written = await context.repos.friendGroups.clearBanner(input.groupId);
    assertFound(written, "Group not found");
    await deleteGroupBanner(context.io, written.previous.bannerUrl);
  }),
};
