import { publicBoardStatesContract } from "@openrift/shared/contracts/public-board-states";
import type {
  FeaturedBoardStateListResponse,
  PublicBoardStateDetailResponse,
} from "@openrift/shared/types/api/board-state";
import { implement } from "@orpc/server";

import { requireUser } from "../../../orpc/base.js";
import type { ApiContext } from "../../../orpc/context.js";
import { toFeaturedBoardState, toPublicBoardState } from "../lib/board-state-presenters.js";

const os = implement(publicBoardStatesContract).$context<ApiContext>().use(requireUser);

export const publicBoardStatesRouter = {
  share: os.share.handler(
    async ({ input, context, errors }): Promise<PublicBoardStateDetailResponse> => {
      const found = await context.repos.boardStates.findByShareToken(input.token);
      if (!found) {
        throw errors.NOT_FOUND({ message: "Not found" });
      }
      return {
        boardState: toPublicBoardState(found.boardState),
        owner: { displayName: found.ownerName ?? "Anonymous" },
      };
    },
  ),

  featured: os.featured.handler(async ({ context }): Promise<FeaturedBoardStateListResponse> => {
    const rows = await context.repos.boardStates.listFeatured();
    return { items: rows.flatMap((row) => toFeaturedBoardState(row) ?? []) };
  }),
};
