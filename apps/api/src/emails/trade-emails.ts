import type { DisplayLocale } from "@openrift/shared/types/api/preferences";

import { emailButton, escapeHtml, MUTED_TEXT, renderEmailLayout } from "./layout.js";
import { emailMessages } from "./messages.js";
import type { EmailMessages, TradeRequestKind, TradeStatusEvent } from "./messages.js";

/*
 * Transactional trade email builders. Pure: they take already-resolved data
 * plus pre-computed absolute URLs and return `{ subject, html }`. URL
 * construction, preference gating, and sending live in the callers (the
 * `createTrade` service and the digest cron).
 */

function greetingFor(messages: EmailMessages, recipientName: string | null): string {
  return messages.greeting(recipientName === null ? null : escapeHtml(recipientName));
}

export interface TradeRequestEmailInput {
  locale: DisplayLocale;
  /** Display name of the recipient (the non-initiator); may be null. */
  recipientName: string | null;
  initiatorName: string | null;
  cardName: string | null;
  quantity: number;
  /** `wants` = receiver-initiated request, `offers` = giver-initiated offer. */
  kind: TradeRequestKind;
  /** The initiator's revealed contact channels for this group, or `""` if none. */
  initiatorContact?: string;
  sheetUrl: string;
  /** One-click unsubscribe link for the `tradeRequests` channel. */
  unsubscribeUrl: string;
}

/** The instant "someone requested a trade" email. */
export function buildTradeRequestEmail(input: TradeRequestEmailInput): {
  subject: string;
  html: string;
} {
  const messages = emailMessages(input.locale);
  const initiator = input.initiatorName ?? messages.aGroupMember;
  const cardName = input.cardName ?? messages.aCard;
  const card = messages.quantityLabel(input.quantity, cardName);
  const greeting = greetingFor(messages, input.recipientName);

  const lead = messages.requestLead(
    `<strong>${escapeHtml(initiator)}</strong>`,
    `<strong>${escapeHtml(card)}</strong>`,
    input.kind,
  );
  const subject = messages.requestSubject(initiator, cardName, input.kind);

  const contactLine = input.initiatorContact
    ? `<p style="margin:0 0 20px;">${escapeHtml(messages.reachContact(initiator, input.initiatorContact))}</p>`
    : "";

  const bodyHtml = `
    <p style="margin:0 0 12px;">${greeting}</p>
    <p style="margin:0 0 16px;">${lead}</p>
    <p style="margin:0 0 20px;">${messages.requestExpiryNote}</p>
    ${contactLine}
    <p style="margin:0;">${emailButton(messages.viewTradeButton, input.sheetUrl)}</p>
  `;

  return {
    subject,
    html: renderEmailLayout({
      locale: input.locale,
      heading: messages.tradeRequestHeading,
      bodyHtml,
      unsubscribe: {
        url: input.unsubscribeUrl,
        label: messages.unsubscribeLabel("tradeRequests"),
      },
    }),
  };
}

interface CoalescedRequest {
  cardName: string | null;
  quantity: number;
  /** `wants` = they want your card, `offers` = they're offering you one. */
  kind: TradeRequestKind;
}

export interface CoalescedRequestGroup {
  groupName: string;
  tradesUrl: string;
  requests: CoalescedRequest[];
}

export interface CoalescedTradeRequestsEmailInput {
  locale: DisplayLocale;
  /** Display name of the recipient (the non-initiator); may be null. */
  recipientName: string | null;
  /** Display name of the one member whose requests are coalesced here. */
  senderName: string | null;
  groups: CoalescedRequestGroup[];
  /** One-click unsubscribe link for the `tradeRequests` channel. */
  unsubscribeUrl: string;
}

/**
 * Builds the coalesced "{sender} sent you N trade requests" email, folding a
 * burst from a single member into one message.
 *
 * Copy must read correctly whether or not an instant email preceded this one.
 */
export function buildCoalescedTradeRequestsEmail(input: CoalescedTradeRequestsEmailInput): {
  subject: string;
  html: string;
} {
  const messages = emailMessages(input.locale);
  const sender = input.senderName ?? messages.aGroupMember;
  const senderHtml = escapeHtml(sender);
  const greeting = greetingFor(messages, input.recipientName);
  const allRequests = input.groups.flatMap((group) => group.requests);
  const total = allRequests.length;

  // The email is coalesced per sender, so the intro names the sender once and
  // the lines group by direction ("Wants from you" / "Offers you") — only the
  // cards vary, so that's all a line shows. No verdict colors here: neither
  // direction is good or bad news. The group stays the deep-link location: on
  // the button for a single group, on a muted "In {group}" line when several
  // are involved. A single request keeps the instant email's sentence form.
  const soleGroup = input.groups.find((entry) => entry.requests.length > 0);
  const soleRequest = soleGroup?.requests[0];

  if (total === 1 && soleGroup && soleRequest) {
    const soleCardName = soleRequest.cardName ?? messages.aCard;
    const card = messages.quantityLabel(soleRequest.quantity, soleCardName);
    const bodyHtml = `
      <p style="margin:0 0 12px;">${greeting}</p>
      <p style="margin:0 0 16px;">${messages.requestLead(`<strong>${senderHtml}</strong>`, `<strong>${escapeHtml(card)}</strong>`, soleRequest.kind)}</p>
      <p style="margin:0 0 20px;">${messages.requestExpiryNote}</p>
      <p style="margin:0;">${emailButton(messages.viewTradesInButton(soleGroup.groupName), soleGroup.tradesUrl)}</p>
    `;
    return {
      subject: messages.requestSubject(sender, soleCardName, soleRequest.kind),
      html: renderEmailLayout({
        locale: input.locale,
        heading: messages.tradeRequestHeading,
        bodyHtml,
        unsubscribe: {
          url: input.unsubscribeUrl,
          label: messages.unsubscribeLabel("tradeRequests"),
        },
      }),
    };
  }

  const multiGroup = input.groups.length > 1;

  const requestKinds = [
    { kind: "wants", heading: messages.wantsFromYouHeading },
    { kind: "offers", heading: messages.offersYouHeading },
  ] as const satisfies readonly { kind: TradeRequestKind; heading: string }[];

  const groupBlocks = input.groups
    .map((group) => {
      const sections = requestKinds
        .map(({ kind, heading }) => {
          const cards = group.requests.filter((request) => request.kind === kind);
          if (cards.length === 0) {
            return "";
          }
          const rows = cards
            .map(
              (request) =>
                `<li style="margin:0 0 4px;"><strong>${escapeHtml(messages.quantityLabel(request.quantity, request.cardName ?? messages.aCard))}</strong></li>`,
            )
            .join("");
          return `
          <p style="margin:0 0 4px;font-weight:600;">${heading}</p>
          <ul style="margin:0 0 12px;padding-left:18px;">${rows}</ul>
        `;
        })
        .join("");
      const locationLine = multiGroup
        ? `<p style="margin:0 0 6px;color:${MUTED_TEXT};font-size:13px;">${messages.inGroupLine(escapeHtml(group.groupName))}</p>`
        : "";
      const buttonLabel = multiGroup
        ? messages.viewTradesButton
        : messages.viewTradesInButton(group.groupName);
      return `
        <div style="margin:0 0 20px;">
          ${locationLine}
          ${sections}
          <p style="margin:0;">${emailButton(buttonLabel, group.tradesUrl)}</p>
        </div>
      `;
    })
    .join("");

  // "wants 2 of your cards and offers you 1" — the directions tell the story
  // from the notification tray, before the email is opened.
  const wantsCount = allRequests.filter((request) => request.kind === "wants").length;
  const subject = messages.coalescedRequestSubject(sender, wantsCount, total - wantsCount);

  const bodyHtml = `
    <p style="margin:0 0 12px;">${greeting}</p>
    <p style="margin:0 0 20px;">${messages.coalescedRequestLead(`<strong>${senderHtml}</strong>`, total)}</p>
    ${groupBlocks}
  `;

  return {
    subject,
    html: renderEmailLayout({
      locale: input.locale,
      heading: messages.tradeRequestsHeading,
      bodyHtml,
      unsubscribe: {
        url: input.unsubscribeUrl,
        label: messages.unsubscribeLabel("tradeRequests"),
      },
    }),
  };
}

/** A single status change folded into the coalesced status-update email. */
interface TradeStatusUpdate {
  cardName: string | null;
  quantity: number;
  /** `reserved` = accepted, `declined`, or `cancelled`. */
  event: TradeStatusEvent;
}

export interface TradeStatusUpdateGroup {
  groupName: string;
  tradesUrl: string;
  updates: TradeStatusUpdate[];
}

export interface TradeStatusUpdateEmailInput {
  locale: DisplayLocale;
  /** Display name of the recipient (the party who didn't act); may be null. */
  recipientName: string | null;
  actorName: string | null;
  groups: TradeStatusUpdateGroup[];
  /** One-click unsubscribe link for the `tradeStatus` channel. */
  unsubscribeUrl: string;
}

/**
 * Per-outcome presentation for the status-update email, in display order:
 * good news first, then declines, then cancellations.
 */
const STATUS_OUTCOMES = [
  { event: "reserved", color: "#15803d" },
  { event: "declined", color: "#b91c1c" },
  { event: "cancelled", color: MUTED_TEXT },
] as const satisfies readonly { event: TradeStatusEvent; color: string }[];

/**
 * Builds the coalesced "{actor} updated your trades" email: folds one
 * member's accept/decline/cancel actions toward this recipient into a single
 * message, so accepting a basket of cards sends one email, not one per card.
 */
export function buildTradeStatusUpdateEmail(input: TradeStatusUpdateEmailInput): {
  subject: string;
  html: string;
} {
  const messages = emailMessages(input.locale);
  const actor = input.actorName ?? messages.aGroupMember;
  const actorHtml = escapeHtml(actor);
  const greeting = greetingFor(messages, input.recipientName);
  const allUpdates = input.groups.flatMap((group) => group.updates);
  const total = allUpdates.length;

  const soleGroup = input.groups.find((entry) => entry.updates.length > 0);
  const soleUpdate = soleGroup?.updates[0];

  if (total === 1 && soleGroup && soleUpdate) {
    const card = `<strong>${escapeHtml(messages.quantityLabel(soleUpdate.quantity, soleUpdate.cardName ?? messages.aCard))}</strong>`;
    const bodyHtml = `
      <p style="margin:0 0 12px;">${greeting}</p>
      <p style="margin:0 0 20px;">${messages.statusPhrase(`<strong>${actorHtml}</strong>`, card, soleUpdate.event)}.</p>
      <p style="margin:0;">${emailButton(messages.viewTradesInButton(soleGroup.groupName), soleGroup.tradesUrl)}</p>
    `;
    return {
      subject: messages.singleStatusSubject(actor, soleUpdate.event),
      html: renderEmailLayout({
        locale: input.locale,
        heading: messages.statusHeading,
        bodyHtml,
        unsubscribe: {
          url: input.unsubscribeUrl,
          label: messages.unsubscribeLabel("tradeStatus"),
        },
      }),
    };
  }

  const multiGroup = input.groups.length > 1;

  const groupBlocks = input.groups
    .map((group) => {
      const sections = STATUS_OUTCOMES.map(({ event, color }) => {
        const cards = group.updates.filter((update) => update.event === event);
        if (cards.length === 0) {
          return "";
        }
        const rows = cards
          .map(
            (update) =>
              `<li style="margin:0 0 4px;"><strong>${escapeHtml(messages.quantityLabel(update.quantity, update.cardName ?? messages.aCard))}</strong></li>`,
          )
          .join("");
        return `
          <p style="margin:0 0 4px;font-weight:600;color:${color};">${messages.statusOutcomeHeading(event)}</p>
          <ul style="margin:0 0 12px;padding-left:18px;">${rows}</ul>
        `;
      }).join("");
      const locationLine = multiGroup
        ? `<p style="margin:0 0 6px;color:${MUTED_TEXT};font-size:13px;">${messages.inGroupLine(escapeHtml(group.groupName))}</p>`
        : "";
      const buttonLabel = multiGroup
        ? messages.viewTradesButton
        : messages.viewTradesInButton(group.groupName);
      return `
        <div style="margin:0 0 20px;">
          ${locationLine}
          ${sections}
          <p style="margin:0;">${emailButton(buttonLabel, group.tradesUrl)}</p>
        </div>
      `;
    })
    .join("");

  // "accepted 2 and declined 1" — the verdict counts tell the story from the
  // notification tray, before the email is opened.
  const subject = messages.statusCountSubject(actor, {
    reserved: allUpdates.filter((update) => update.event === "reserved").length,
    declined: allUpdates.filter((update) => update.event === "declined").length,
    cancelled: allUpdates.filter((update) => update.event === "cancelled").length,
  });

  const bodyHtml = `
    <p style="margin:0 0 12px;">${greeting}</p>
    <p style="margin:0 0 20px;">${messages.statusLead(`<strong>${actorHtml}</strong>`)}</p>
    ${groupBlocks}
  `;

  return {
    subject,
    html: renderEmailLayout({
      locale: input.locale,
      heading: messages.statusHeading,
      bodyHtml,
      unsubscribe: {
        url: input.unsubscribeUrl,
        label: messages.unsubscribeLabel("tradeStatus"),
      },
    }),
  };
}

interface DigestMatch {
  cardName: string | null;
  counterpartyLabel: string | null;
}

export interface DigestGroupSection {
  groupName: string;
  tradesUrl: string;
  matches: DigestMatch[];
}

export interface TradeMatchDigestEmailInput {
  locale: DisplayLocale;
  recipientName: string | null;
  groups: DigestGroupSection[];
  /** One-click unsubscribe link for the `tradeMatches` channel. */
  unsubscribeUrl: string;
}

/** The daily "new matches in your groups" digest email. */
export function buildTradeMatchDigestEmail(input: TradeMatchDigestEmailInput): {
  subject: string;
  html: string;
} {
  const messages = emailMessages(input.locale);
  const totalMatches = input.groups.reduce((sum, group) => sum + group.matches.length, 0);
  const greeting = greetingFor(messages, input.recipientName);

  const subject = messages.digestSubject(totalMatches);

  // Matches group by counterparty ("Garen has …"), not card by card — the
  // person is the call to action, the cards are the detail. The group is the
  // deep-link location, same as the other trade emails: on the button for a
  // single group, on a muted "In {group}" line when several are involved. A
  // single match keeps the plain-sentence form.
  const soleGroup = input.groups.find((entry) => entry.matches.length > 0);
  const soleMatch = soleGroup?.matches[0];

  if (totalMatches === 1 && soleGroup && soleMatch) {
    const bodyHtml = `
      <p style="margin:0 0 12px;">${greeting}</p>
      <p style="margin:0 0 20px;">${messages.digestSingleLead(`<strong>${escapeHtml(soleMatch.counterpartyLabel ?? messages.aMember)}</strong>`, `<strong>${escapeHtml(soleMatch.cardName ?? messages.aCard)}</strong>`)}</p>
      <p style="margin:0;">${emailButton(messages.viewTradesInButton(soleGroup.groupName), soleGroup.tradesUrl)}</p>
    `;
    return {
      subject,
      html: renderEmailLayout({
        locale: input.locale,
        heading: messages.digestHeading,
        bodyHtml,
        unsubscribe: {
          url: input.unsubscribeUrl,
          label: messages.unsubscribeLabel("tradeMatches"),
        },
      }),
    };
  }

  const multiGroup = input.groups.length > 1;

  const groupBlocks = input.groups
    .map((group) => {
      const byCounterparty = Map.groupBy(
        group.matches,
        (match) => match.counterpartyLabel ?? messages.aMember,
      );
      const sections = [...byCounterparty.entries()]
        .map(([counterpartyLabel, matches]) => {
          const rows = matches
            .map(
              (match) =>
                `<li style="margin:0 0 4px;"><strong>${escapeHtml(match.cardName ?? messages.aCard)}</strong></li>`,
            )
            .join("");
          return `
            <p style="margin:0 0 4px;font-weight:600;">${messages.counterpartyHasHeading(escapeHtml(counterpartyLabel))}</p>
            <ul style="margin:0 0 12px;padding-left:18px;">${rows}</ul>
          `;
        })
        .join("");
      const locationLine = multiGroup
        ? `<p style="margin:0 0 6px;color:${MUTED_TEXT};font-size:13px;">${messages.inGroupLine(escapeHtml(group.groupName))}</p>`
        : "";
      const buttonLabel = multiGroup
        ? messages.viewTradesButton
        : messages.viewTradesInButton(group.groupName);
      return `
        <div style="margin:0 0 20px;">
          ${locationLine}
          ${sections}
          <p style="margin:0;">${emailButton(buttonLabel, group.tradesUrl)}</p>
        </div>
      `;
    })
    .join("");

  const bodyHtml = `
    <p style="margin:0 0 12px;">${greeting}</p>
    <p style="margin:0 0 20px;">${messages.digestLead}</p>
    ${groupBlocks}
  `;

  return {
    subject,
    html: renderEmailLayout({
      locale: input.locale,
      heading: messages.digestHeading,
      bodyHtml,
      unsubscribe: {
        url: input.unsubscribeUrl,
        label: messages.unsubscribeLabel("tradeMatches"),
      },
    }),
  };
}
