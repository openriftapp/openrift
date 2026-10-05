import type { Kysely } from "kysely";

import type { Database } from "../../db/tables.js";
import { bindEmailDeps } from "../../email.js";
import type { EmailDeps } from "../../email.js";
import type { ListRuleProviders } from "../lists/repositories/lists-rules.js";
import { cardTradesRepo } from "./repositories/card-trades.js";
import { friendGroupCalendarFeedsRepo } from "./repositories/friend-group-calendar-feeds.js";
import { friendGroupDiscordLinksRepo } from "./repositories/friend-group-discord-links.js";
import { friendGroupMatchesRepo } from "./repositories/friend-group-matches.js";
import { friendGroupShopsRepo } from "./repositories/friend-group-shops.js";
import { friendGroupsRepo } from "./repositories/friend-groups.js";
import { loansRepo } from "./repositories/loans.js";
import { tradeSuggestionDismissalsRepo } from "./repositories/trade-suggestion-dismissals.js";
import { userSharesRepo } from "./repositories/user-shares.js";
import { createTrade } from "./services/card-trades.js";
import {
  notifyAdminsOfGroupJoinRequest,
  notifyMemberOfGroupApproval,
} from "./services/group-join-notifications.js";
import { ensureInbox } from "./services/inbox.js";

export interface GroupsRepos {
  cardTrades: ReturnType<typeof cardTradesRepo>;
  friendGroups: ReturnType<typeof friendGroupsRepo>;
  friendGroupCalendarFeeds: ReturnType<typeof friendGroupCalendarFeedsRepo>;
  friendGroupDiscordLinks: ReturnType<typeof friendGroupDiscordLinksRepo>;
  friendGroupMatches: ReturnType<typeof friendGroupMatchesRepo>;
  friendGroupShops: ReturnType<typeof friendGroupShopsRepo>;
  loans: ReturnType<typeof loansRepo>;
  tradeSuggestionDismissals: ReturnType<typeof tradeSuggestionDismissalsRepo>;
  userShares: ReturnType<typeof userSharesRepo>;
}

export interface GroupsServices {
  ensureInbox: typeof ensureInbox;
  notifyAdminsOfGroupJoinRequest: typeof notifyAdminsOfGroupJoinRequest;
  notifyMemberOfGroupApproval: typeof notifyMemberOfGroupApproval;
  createTrade: typeof createTrade;
}

export function createGroupsRepos(db: Kysely<Database>, providers: ListRuleProviders): GroupsRepos {
  return {
    cardTrades: cardTradesRepo(db),
    friendGroups: friendGroupsRepo(db),
    friendGroupCalendarFeeds: friendGroupCalendarFeedsRepo(db),
    friendGroupDiscordLinks: friendGroupDiscordLinksRepo(db),
    friendGroupMatches: friendGroupMatchesRepo(db, providers),
    friendGroupShops: friendGroupShopsRepo(db),
    loans: loansRepo(db),
    tradeSuggestionDismissals: tradeSuggestionDismissalsRepo(db),
    userShares: userSharesRepo(db),
  };
}

export function createGroupsServices(emailDeps?: EmailDeps): GroupsServices {
  return {
    ensureInbox,
    notifyAdminsOfGroupJoinRequest: bindEmailDeps(notifyAdminsOfGroupJoinRequest, emailDeps),
    notifyMemberOfGroupApproval: bindEmailDeps(notifyMemberOfGroupApproval, emailDeps),
    createTrade: bindEmailDeps(createTrade, emailDeps),
  };
}
