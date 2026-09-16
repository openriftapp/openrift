import type { DisplayLocale } from "@openrift/shared/types/api/preferences";

export type TradeRequestKind = "wants" | "offers";

export type TradeStatusEvent = "reserved" | "declined" | "cancelled";

type EmailUnsubscribeChannel =
  | "groupJoinRequests"
  | "groupApprovals"
  | "tradeRequests"
  | "tradeStatus"
  | "tradeMatches"
  | "submissionAccepted";

interface StatusCounts {
  reserved: number;
  declined: number;
  cancelled: number;
}

export interface EmailMessages {
  htmlLang: string;
  greeting: (nameHtml: string | null) => string;
  footerTrading: string;
  footerGroupOwner: string;
  footerGroupJoin: string;
  unsubscribeWord: string;
  unsubscribeLabel: (channel: EmailUnsubscribeChannel) => string;

  joinRequestSubject: (groupName: string) => string;
  joinRequestHeading: string;
  someone: string;
  joinRequestLead: (requesterHtml: string, groupHtml: string) => string;
  reviewRequestButton: string;

  approvedSubject: (groupName: string) => string;
  approvedHeading: string;
  approvedLead: (groupHtml: string) => string;
  approvedBenefitsIntro: string;
  approvedBenefits: readonly [string, string, string];
  managePageLinkLabel: string;
  approvedVisibilityNote: (linkHtml: string) => string;
  openGroupButton: (groupName: string) => string;

  aGroupMember: string;
  aMember: string;
  aCard: string;
  quantityLabel: (quantity: number, cardName: string) => string;
  tradeRequestHeading: string;
  tradeRequestsHeading: string;
  requestLead: (senderHtml: string, cardHtml: string, kind: TradeRequestKind) => string;
  requestSubject: (sender: string, cardName: string, kind: TradeRequestKind) => string;
  requestExpiryNote: string;
  reachContact: (name: string, contact: string) => string;
  viewTradeButton: string;
  viewTradesButton: string;
  viewTradesInButton: (groupName: string) => string;
  inGroupLine: (groupName: string) => string;
  wantsFromYouHeading: string;
  offersYouHeading: string;
  coalescedRequestSubject: (sender: string, wantsCount: number, offersCount: number) => string;
  coalescedRequestLead: (senderHtml: string, total: number) => string;

  statusHeading: string;
  statusOutcomeHeading: (event: TradeStatusEvent) => string;
  statusPhrase: (actorHtml: string, cardHtml: string, event: TradeStatusEvent) => string;
  singleStatusSubject: (actor: string, event: TradeStatusEvent) => string;
  statusCountSubject: (actor: string, counts: StatusCounts) => string;
  statusLead: (actorHtml: string) => string;

  digestHeading: string;
  digestSubject: (total: number) => string;
  digestSingleLead: (counterpartyHtml: string, cardHtml: string) => string;
  digestLead: string;
  counterpartyHasHeading: (labelHtml: string) => string;

  otpSubject: (type: string) => string;
  otpHeading: string;
  otpExpiryNote: string;

  footerContribution: string;
  acceptedHeading: string;
  acceptedCardSubject: (cardName: string) => string;
  acceptedCardLead: (cardHtml: string) => string;
  acceptedDecklistSubject: (eventName: string) => string;
  acceptedDecklistLead: (playerHtml: string, eventHtml: string) => string;
  acceptedEventSubject: (eventName: string) => string;
  acceptedEventLead: (eventHtml: string) => string;
  acceptedThanks: string;
  viewCardButton: (cardName: string) => string;
  viewDecklistButton: string;
  viewEventButton: string;
  viewSubmissionsButton: string;
  submissionsLinkLabel: string;
  submissionsNote: (linkHtml: string) => string;
}

const numberFormats = new Map<DisplayLocale, Intl.NumberFormat>();

export function num(locale: DisplayLocale, value: number): string {
  let format = numberFormats.get(locale);
  if (format === undefined) {
    format = new Intl.NumberFormat(locale);
    numberFormats.set(locale, format);
  }
  return format.format(value);
}

export function joinParts(parts: readonly string[], and: string, oxford: boolean): string {
  if (parts.length <= 1) {
    return parts[0] ?? "";
  }
  if (parts.length === 2) {
    return `${parts[0]} ${and} ${parts[1]}`;
  }
  const head = parts.slice(0, -1).join(", ");
  return oxford ? `${head}, ${and} ${parts.at(-1)}` : `${head} ${and} ${parts.at(-1)}`;
}
