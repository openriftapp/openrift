import { friendGroupsContract } from "@openrift/shared/contracts/friend-groups";
import { ERROR_CODES } from "@openrift/shared/error-codes";
import {
  GROUP_BANNER_DEFAULT_POSITION,
  GROUP_BANNER_MAX_BYTES,
} from "@openrift/shared/group-banner";
import type { FriendGroupResponse } from "@openrift/shared/types/api/friend-group";
import { implement } from "@orpc/server";
import type { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";

import { AppError } from "../../../errors.js";
import { requireAuthedUser } from "../../../orpc/base.js";
import type { ApiContext } from "../../../orpc/context.js";
import { orpcErrorResponse } from "../../../orpc/error-body.js";
import type { Variables } from "../../../types.js";
import { toGroup } from "../lib/friend-group-presenters.js";
import { loadGroupForMember, requireRole } from "../lib/group-access.js";
import { deleteGroupBanner, saveGroupBanner } from "../services/group-banners.js";

const os = implement(friendGroupsContract).$context<ApiContext>().use(requireAuthedUser);

export const friendGroupsBannerRouter = {
  uploadBanner: os.uploadBanner.handler(
    async ({ input, context, errors }): Promise<FriendGroupResponse> => {
      const viewerId = context.userId;
      const { friendGroups } = context.repos;

      if (input.file.size > GROUP_BANNER_MAX_BYTES) {
        throw errors.PAYLOAD_TOO_LARGE();
      }

      const ctx = await loadGroupForMember(context.repos, input.slug, viewerId);
      requireRole(ctx.membership, "admin");

      const result = await saveGroupBanner(context.io, {
        userId: viewerId,
        buffer: Buffer.from(await input.file.arrayBuffer()),
        now: new Date(),
      });
      if (result.status === "rate_limited") {
        throw errors.TOO_MANY_REQUESTS({
          message: `You can upload up to ${result.limit} banners per day. Please try again later.`,
        });
      }
      if (result.status === "not_an_image") {
        throw errors.BAD_REQUEST();
      }

      const written = await friendGroups.setBanner(ctx.group.id, {
        bannerUrl: result.url,
        bannerPosition: GROUP_BANNER_DEFAULT_POSITION,
        bannerUploadedBy: viewerId,
        bannerUploadedAt: new Date(),
      });
      if (!written) {
        await deleteGroupBanner(context.io, result.url);
        throw new AppError(404, ERROR_CODES.NOT_FOUND, "Group not found");
      }

      await deleteGroupBanner(context.io, written.previous.bannerUrl);
      return toGroup(written.updated, true);
    },
  ),

  removeBanner: os.removeBanner.handler(
    async ({ input, context }): Promise<FriendGroupResponse> => {
      const viewerId = context.userId;
      const { friendGroups } = context.repos;

      const ctx = await loadGroupForMember(context.repos, input.slug, viewerId);
      requireRole(ctx.membership, "admin");

      const written = await friendGroups.clearBanner(ctx.group.id);
      if (!written) {
        throw new AppError(404, ERROR_CODES.NOT_FOUND, "Group not found");
      }

      await deleteGroupBanner(context.io, written.previous.bannerUrl);
      return toGroup(written.updated, true);
    },
  ),
};

// Hono matches a `use` path exactly, so the upload path needs its own body limit.
export function mountFriendGroupBannerMiddleware(app: Hono<{ Variables: Variables }>): void {
  app.use(
    "/api/v1/friend-groups/:slug/banner",
    bodyLimit({
      maxSize: GROUP_BANNER_MAX_BYTES,
      onError: (c) => orpcErrorResponse(c, ERROR_CODES.PAYLOAD_TOO_LARGE, "File exceeds 20 MB"),
    }),
  );
}
