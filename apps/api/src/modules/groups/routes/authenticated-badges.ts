import { badgesContract } from "@openrift/shared/contracts/badges";
import type { BadgesResponse } from "@openrift/shared/types/api/badges";
import { implement } from "@orpc/server";

import { requireAuthedUser } from "../../../orpc/base.js";
import type { ApiContext } from "../../../orpc/context.js";

const os = implement(badgesContract).$context<ApiContext>().use(requireAuthedUser);

export const badgesRouter = {
  get: os.get.handler(async ({ context }): Promise<BadgesResponse> => {
    const { cardTrades, friendGroups, loans } = context.repos;
    const userId = context.userId;
    const [byGroup, people, loanTotal, pendingRequests] = await Promise.all([
      cardTrades.actionNeededCountsForUser(userId),
      cardTrades.actionNeededPeopleForUser(userId),
      loans.actionNeededCountForUser(userId),
      friendGroups.pendingRequestsCountForUser(userId),
    ]);
    return {
      trades: {
        total: byGroup.reduce((sum, entry) => sum + entry.count, 0),
        people,
        byGroup,
      },
      loans: { total: loanTotal },
      groupRequests: { count: pendingRequests },
    };
  }),
};
