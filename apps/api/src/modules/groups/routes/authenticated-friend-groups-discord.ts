import { friendGroupsContract } from "@openrift/shared/contracts/friend-groups";
import type {
  FriendGroupDiscordLinkCodeResponse,
  FriendGroupDiscordLinksResponse,
} from "@openrift/shared/types/api/friend-group";
import { implement } from "@orpc/server";

import { assertExisted } from "../../../lib/assertions.js";
import { withUniqueShareToken } from "../../../lib/share-token.js";
import { requireAuthedUser } from "../../../orpc/base.js";
import type { ApiContext } from "../../../orpc/context.js";
import { toDiscordLink } from "../lib/friend-group-presenters.js";
import { loadGroupForMember, requireRole } from "../lib/group-access.js";

/** Discord link codes are one-shot and short-lived — 15 minutes to run /link. */
const DISCORD_LINK_CODE_TTL_MS = 15 * 60 * 1000;

const os = implement(friendGroupsContract).$context<ApiContext>().use(requireAuthedUser);

export const friendGroupsDiscordRouter = {
  // Linking a server is the group's consent that the bot may name members and
  // their shared-tradelist cards in replies there, so the whole surface is
  // admin-gated like the join code.
  createDiscordLinkCode: os.createDiscordLinkCode.handler(
    async ({ input, context }): Promise<FriendGroupDiscordLinkCodeResponse> => {
      const ctx = await loadGroupForMember(context.repos, input.slug, context.userId);
      requireRole(ctx.membership, "admin");

      const codeExpiresAt = new Date(Date.now() + DISCORD_LINK_CODE_TTL_MS);
      const code = await withUniqueShareToken(
        async (candidate) => {
          await context.repos.friendGroupDiscordLinks.createPendingLink({
            groupId: ctx.group.id,
            createdByUserId: context.userId,
            code: candidate,
            codeExpiresAt,
          });
          return candidate;
        },
        { constraint: "uq_fg_discord_links_code" },
      );
      return { code, expiresAt: codeExpiresAt.toISOString() };
    },
  ),

  listDiscordLinks: os.listDiscordLinks.handler(
    async ({ input, context }): Promise<FriendGroupDiscordLinksResponse> => {
      const ctx = await loadGroupForMember(context.repos, input.slug, context.userId);
      requireRole(ctx.membership, "admin");

      const links = await context.repos.friendGroupDiscordLinks.listLinks(ctx.group.id);
      return {
        items: links.map((link) => toDiscordLink(link)).filter((item) => item !== null),
      };
    },
  ),

  deleteDiscordLink: os.deleteDiscordLink.handler(async ({ input, context }): Promise<void> => {
    const ctx = await loadGroupForMember(context.repos, input.slug, context.userId);
    requireRole(ctx.membership, "admin");

    const deleted = await context.repos.friendGroupDiscordLinks.deleteLink(
      ctx.group.id,
      input.linkId,
    );
    assertExisted(deleted, "Link not found");
  }),
};
