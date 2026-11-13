import { userShareContract } from "@openrift/shared/contracts/user-share";
import type { UserShareStateResponse } from "@openrift/shared/types/api/user-share";
import { implement } from "@orpc/server";

import { enableShare } from "../../../lib/share-token.js";
import { requireAuthedUser } from "../../../orpc/base.js";
import type { ApiContext } from "../../../orpc/context.js";

const os = implement(userShareContract).$context<ApiContext>().use(requireAuthedUser);

export const userShareRouter = {
  get: os.get.handler(async ({ context }): Promise<UserShareStateResponse> => {
    const { userShares } = context.repos;
    const row = await userShares.getShareToken(context.userId);
    return { shareToken: row?.shareToken ?? null, isPublic: Boolean(row?.shareToken) };
  }),

  enable: os.enable.handler(async ({ context }): Promise<UserShareStateResponse> => {
    const { userShares } = context.repos;
    const userId = context.userId;
    return await enableShare({
      read: async () => {
        const row = await userShares.getShareToken(userId);
        return row && { shareToken: row.shareToken, isPublic: row.shareToken !== null };
      },
      write: (token) => userShares.setShareToken(userId, token),
    });
  }),

  disable: os.disable.handler(async ({ context, errors }): Promise<void> => {
    const { userShares } = context.repos;
    const updated = await userShares.setShareToken(context.userId, null);
    if (!updated) {
      throw errors.NOT_FOUND({ message: "User not found" });
    }
  }),
};
