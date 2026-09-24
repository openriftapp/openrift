import type { Kysely } from "kysely";

import type { Database } from "../../db/tables.js";
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
import {
  acceptTrade,
  applyTradeSync,
  cancelTrade,
  createTrade,
  declineTrade,
  listTradeCopyOptions,
  setTradeQuantity,
  skipTradeSync,
} from "./services/card-trades.js";
import {
  notifyAdminsOfGroupJoinRequest,
  notifyMemberOfGroupApproval,
} from "./services/group-join-notifications.js";
import { ensureInbox } from "./services/inbox.js";
import {
  acknowledgeLoan,
  confirmBorrowerReturn,
  createLoan,
  declareLoanReturn,
  deleteLoan,
  rejectLoan,
  reopenBorrowerReturn,
  returnLoanCopies,
  writeOffLoan,
} from "./services/loans.js";
import type { TradeEmailDeps } from "./services/trade-notifications.js";

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
  listTradeCopyOptions: typeof listTradeCopyOptions;
  acceptTrade: typeof acceptTrade;
  declineTrade: typeof declineTrade;
  cancelTrade: typeof cancelTrade;
  setTradeQuantity: typeof setTradeQuantity;
  applyTradeSync: typeof applyTradeSync;
  skipTradeSync: typeof skipTradeSync;
  createLoan: typeof createLoan;
  returnLoanCopies: typeof returnLoanCopies;
  declareLoanReturn: typeof declareLoanReturn;
  confirmBorrowerReturn: typeof confirmBorrowerReturn;
  reopenBorrowerReturn: typeof reopenBorrowerReturn;
  writeOffLoan: typeof writeOffLoan;
  acknowledgeLoan: typeof acknowledgeLoan;
  rejectLoan: typeof rejectLoan;
  deleteLoan: typeof deleteLoan;
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

export function createGroupsServices(emailDeps?: TradeEmailDeps): GroupsServices {
  return {
    ensureInbox,
    notifyAdminsOfGroupJoinRequest:
      emailDeps === undefined
        ? notifyAdminsOfGroupJoinRequest
        : (repos, request) => notifyAdminsOfGroupJoinRequest(repos, request, emailDeps),
    notifyMemberOfGroupApproval:
      emailDeps === undefined
        ? notifyMemberOfGroupApproval
        : (repos, approval) => notifyMemberOfGroupApproval(repos, approval, emailDeps),
    createTrade:
      emailDeps === undefined
        ? createTrade
        : (repos, input) => createTrade(repos, input, emailDeps),
    listTradeCopyOptions,
    acceptTrade,
    declineTrade,
    cancelTrade,
    setTradeQuantity,
    applyTradeSync,
    skipTradeSync,
    createLoan,
    returnLoanCopies,
    declareLoanReturn,
    confirmBorrowerReturn,
    reopenBorrowerReturn,
    writeOffLoan,
    acknowledgeLoan,
    rejectLoan,
    deleteLoan,
  };
}
