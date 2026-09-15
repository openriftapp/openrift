import { adminBoardStatesContract } from "@openrift/shared/contracts/admin/board-states";
import type {
  AdminBoardState,
  AdminBoardStatesResponse,
} from "@openrift/shared/contracts/admin/board-states";
import { implement } from "@orpc/server";

import { assertFound } from "../../../lib/assertions.js";
import { requireAuthedUser } from "../../../orpc/base.js";
import type { ApiContext } from "../../../orpc/context.js";
import { toAdminBoardState } from "../lib/board-state-presenters.js";

const NOT_FOUND = "Board state not found";

const os = implement(adminBoardStatesContract).$context<ApiContext>().use(requireAuthedUser);

export const adminBoardStatesRouter = {
  list: os.list.handler(async ({ context }): Promise<AdminBoardStatesResponse> => {
    const rows = await context.repos.boardStates.listAllWithOwner();
    return { items: rows.map((row) => toAdminBoardState(row)) };
  }),

  setFeatured: os.setFeatured.handler(
    async ({ input, context, errors }): Promise<AdminBoardState> => {
      const { boardStates } = context.repos;
      const current = await boardStates.getById(input.id);
      assertFound(current, NOT_FOUND);
      if (input.featured && (!current.isPublic || current.shareToken === null)) {
        throw errors.BAD_REQUEST({
          message: "Only a shared board state can be featured. The owner has not shared it.",
        });
      }
      const row = await boardStates.setFeatured(input.id, input.featured);
      assertFound(row, NOT_FOUND);
      return toAdminBoardState(row);
    },
  ),
};
