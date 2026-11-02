import type {
  EmailNotificationPreference,
  TradeRequestEmailCadence,
} from "@openrift/shared/types/api/preferences";
import {
  getTradeRequestEmailCadence,
  isCardSubmissionEmailEnabled,
  isGroupApprovalEmailEnabled,
  isGroupJoinRequestEmailEnabled,
  isMetaSubmissionEmailEnabled,
  isSubmissionAcceptedEmailEnabled,
  isTradeMatchDigestEnabled,
  isTradeRequestEmailEnabled,
  isTradeStatusEmailEnabled,
} from "@openrift/shared/types/api/preferences";

export interface EmailNotificationGates {
  tradeMatches: boolean;
  tradeRequests: boolean;
  tradeStatus: boolean;
  tradeRequestCadence: TradeRequestEmailCadence;
  cardSubmissions: boolean;
  metaSubmissions: boolean;
  groupJoinRequests: boolean;
  groupApprovals: boolean;
  submissionAccepted: boolean;
}

export function resolveEmailNotificationGates(
  prefs: EmailNotificationPreference | undefined,
): EmailNotificationGates {
  return {
    tradeMatches: isTradeMatchDigestEnabled(prefs),
    tradeRequests: isTradeRequestEmailEnabled(prefs),
    tradeStatus: isTradeStatusEmailEnabled(prefs),
    tradeRequestCadence: getTradeRequestEmailCadence(prefs),
    cardSubmissions: isCardSubmissionEmailEnabled(prefs),
    metaSubmissions: isMetaSubmissionEmailEnabled(prefs),
    groupJoinRequests: isGroupJoinRequestEmailEnabled(prefs),
    groupApprovals: isGroupApprovalEmailEnabled(prefs),
    submissionAccepted: isSubmissionAcceptedEmailEnabled(prefs),
  };
}

/** The server merge replaces the whole object, so unchanged keys must be carried over. */
