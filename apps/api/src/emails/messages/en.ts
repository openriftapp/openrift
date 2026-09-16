import type { EmailMessages } from "./shared.js";
import { joinParts, num } from "./shared.js";

export const en: EmailMessages = {
  htmlLang: "en",
  greeting: (nameHtml) => (nameHtml ? `Hi ${nameHtml},` : "Hi,"),
  footerTrading: "You're receiving this because of your trading activity on OpenRift.",
  footerGroupOwner: "You're receiving this because you run a group on OpenRift.",
  footerGroupJoin: "You're receiving this because you asked to join a group on OpenRift.",
  unsubscribeWord: "unsubscribe",
  unsubscribeLabel: (channel) =>
    ({
      groupJoinRequests: "Group join requests",
      groupApprovals: "Group welcome emails",
      submissionAccepted: "Thank-you emails for accepted submissions",
      tradeRequests: "Trade-request emails",
      tradeStatus: "Trade-status emails",
      tradeMatches: "Daily match digest",
    })[channel],

  joinRequestSubject: (groupName) => `Join request for ${groupName}`,
  joinRequestHeading: "New join request",
  someone: "Someone",
  joinRequestLead: (requesterHtml, groupHtml) =>
    `${requesterHtml} asked to join ${groupHtml}. They stay outside the group until an admin approves them.`,
  reviewRequestButton: "Review the request",

  approvedSubject: (groupName) => `You're in: ${groupName}`,
  approvedHeading: "You're in",
  approvedLead: (groupHtml) =>
    `An admin approved your request, so you're now a member of ${groupHtml}.`,
  approvedBenefitsIntro: "What that gets you:",
  approvedBenefits: [
    "Browse every collection, wishlist and tradelist the other members share.",
    "Trade matches: cards on your wishlist that someone in the group has spare.",
    "Follow the group's trades and activity as they happen.",
  ],
  managePageLinkLabel: "manage page",
  approvedVisibilityNote: (linkHtml) =>
    `Nothing of yours is visible yet. Pick which lists and collections the group can see on the ${linkHtml}.`,
  openGroupButton: (groupName) => `Open ${groupName}`,

  aGroupMember: "A group member",
  aMember: "A member",
  aCard: "a card",
  quantityLabel: (quantity, cardName) =>
    quantity > 1 ? `${num("en", quantity)}× ${cardName}` : cardName,
  tradeRequestHeading: "New trade request",
  tradeRequestsHeading: "New trade requests",
  requestLead: (senderHtml, cardHtml, kind) =>
    kind === "wants"
      ? `${senderHtml} wants to trade for your ${cardHtml}.`
      : `${senderHtml} is offering you ${cardHtml}.`,
  requestSubject: (sender, cardName, kind) =>
    kind === "wants"
      ? `${sender} wants to trade for ${cardName}`
      : `${sender} offers you ${cardName}`,
  requestExpiryNote:
    "Open the trade to accept or decline it. Heads up: trade requests expire 7 days after they're sent.",
  reachContact: (name, contact) => `Reach ${name}: ${contact}`,
  viewTradeButton: "View the trade",
  viewTradesButton: "View the trades",
  viewTradesInButton: (groupName) => `View the trades in ${groupName}`,
  inGroupLine: (groupName) => `In ${groupName}`,
  wantsFromYouHeading: "Wants from you",
  offersYouHeading: "Offers you",
  coalescedRequestSubject: (sender, wantsCount, offersCount) => {
    const parts: string[] = [];
    if (wantsCount > 0) {
      parts.push(`wants ${num("en", wantsCount)} of your cards`);
    }
    if (offersCount > 0) {
      parts.push(
        wantsCount > 0
          ? `offers you ${num("en", offersCount)}`
          : `offers you ${num("en", offersCount)} cards`,
      );
    }
    return `${sender} ${joinParts(parts, "and", true)}`;
  },
  coalescedRequestLead: (senderHtml, total) =>
    `${senderHtml} sent you ${num("en", total)} trade requests. Heads up: trade requests expire 7 days after they're sent.`,

  statusHeading: "Trade updates",
  statusOutcomeHeading: (event) =>
    ({ reserved: "Accepted", declined: "Declined", cancelled: "Cancelled" })[event],
  statusPhrase: (actorHtml, cardHtml, event) => {
    switch (event) {
      case "reserved": {
        return `${actorHtml} accepted your request for ${cardHtml}`;
      }
      case "declined": {
        return `${actorHtml} declined your request for ${cardHtml}`;
      }
      case "cancelled": {
        return `${actorHtml} cancelled the trade for ${cardHtml}`;
      }
    }
  },
  singleStatusSubject: (actor, event) => {
    switch (event) {
      case "reserved": {
        return `${actor} accepted your trade request`;
      }
      case "declined": {
        return `${actor} declined your trade request`;
      }
      case "cancelled": {
        return `${actor} cancelled a trade`;
      }
    }
  },
  statusCountSubject: (actor, counts) => {
    const parts = [
      { verb: "accepted", count: counts.reserved },
      { verb: "declined", count: counts.declined },
      { verb: "cancelled", count: counts.cancelled },
    ]
      .filter(({ count }) => count > 0)
      .map(({ verb, count }) => `${verb} ${num("en", count)}`);
    return `${actor} ${joinParts(parts, "and", true)} of your trades`;
  },
  statusLead: (actorHtml) => `${actorHtml} updated some of your trades:`,

  digestHeading: "New trade matches",
  digestSubject: (total) =>
    total === 1
      ? "1 new match in your trading groups"
      : `${num("en", total)} new matches in your trading groups`,
  digestSingleLead: (counterpartyHtml, cardHtml) =>
    `${counterpartyHtml} now has ${cardHtml} from your wishlist.`,
  digestLead: "Members of your groups now have cards on your wishlist:",
  counterpartyHasHeading: (labelHtml) => `${labelHtml} has`,

  otpSubject: (type) =>
    ({
      "sign-in": "Your sign-in code",
      "email-verification": "Verify your email",
      "forget-password": "Reset your password",
      "change-email": "Confirm your email change",
    })[type] ?? "Your verification code",
  otpHeading: "Your verification code",
  otpExpiryNote:
    "This code expires in 5 minutes. If you didn't request this, you can safely ignore this email.",

  footerContribution: "You're receiving this because you sent a submission to OpenRift.",
  acceptedHeading: "Thanks for your help",
  acceptedCardSubject: (cardName) => `Your submission for ${cardName} was accepted`,
  acceptedCardLead: (cardHtml) =>
    `Your submission for ${cardHtml} has been reviewed and accepted. It's now part of the card data on OpenRift.`,
  acceptedDecklistSubject: (eventName) => `Your decklist for ${eventName} was accepted`,
  acceptedDecklistLead: (playerHtml, eventHtml) =>
    `The decklist you sent for ${playerHtml} at ${eventHtml} has been reviewed and accepted. It's now in the meta archive.`,
  acceptedEventSubject: (eventName) => `Your correction to ${eventName} was applied`,
  acceptedEventLead: (eventHtml) =>
    `Your correction to ${eventHtml} has been reviewed and applied. The event page shows it now.`,
  acceptedThanks:
    "OpenRift's data is maintained by one person, so submissions like yours fill in the gaps. Thank you!",
  viewCardButton: (cardName) => `View ${cardName}`,
  viewDecklistButton: "View the decklist",
  viewEventButton: "View the event",
  viewSubmissionsButton: "View your submissions",
  submissionsLinkLabel: "submissions page",
  submissionsNote: (linkHtml) => `Everything you've sent and its status is on your ${linkHtml}.`,
};
