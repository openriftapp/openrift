import { friendGroupsContract } from "@openrift/shared/contracts/friend-groups";
import type {
  FriendGroupCalendarFeedResponse,
  FriendGroupCalendarFeedsResponse,
} from "@openrift/shared/types/api/friend-group";
import { implement } from "@orpc/server";

import { requireAuthedUser } from "../../../orpc/base.js";
import type { ApiContext } from "../../../orpc/context.js";
import { loadGroupForMember } from "../lib/group-access.js";

const FEED_TOKEN_BYTES = 24;

const os = implement(friendGroupsContract).$context<ApiContext>().use(requireAuthedUser);

export const friendGroupsCalendarFeedsRouter = {
  listCalendarFeeds: os.listCalendarFeeds.handler(
    async ({ input, context }): Promise<FriendGroupCalendarFeedsResponse> => {
      const ctx = await loadGroupForMember(context.repos, input.slug, context.userId);

      const items = await context.repos.friendGroupCalendarFeeds.listForMember(
        ctx.group.id,
        context.userId,
      );
      return { items };
    },
  ),

  enableCalendarFeed: os.enableCalendarFeed.handler(
    async ({ input, context }): Promise<FriendGroupCalendarFeedResponse> => {
      const ctx = await loadGroupForMember(context.repos, input.slug, context.userId);

      const token = Buffer.from(crypto.getRandomValues(new Uint8Array(FEED_TOKEN_BYTES))).toString(
        "base64url",
      );
      return context.repos.friendGroupCalendarFeeds.enable({
        groupId: ctx.group.id,
        userId: context.userId,
        kind: input.kind,
        token,
      });
    },
  ),

  disableCalendarFeed: os.disableCalendarFeed.handler(async ({ input, context }): Promise<void> => {
    const ctx = await loadGroupForMember(context.repos, input.slug, context.userId);

    await context.repos.friendGroupCalendarFeeds.disable(ctx.group.id, context.userId, input.kind);
  }),
};
