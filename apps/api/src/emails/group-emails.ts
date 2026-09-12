import type { DisplayLocale } from "@openrift/shared/types/api/preferences";

import { BRAND, emailButton, escapeHtml, renderEmailLayout } from "./layout.js";
import { emailMessages } from "./messages.js";

export interface GroupJoinRequestEmailInput {
  locale: DisplayLocale;
  recipientName: string | null;
  requesterName: string | null;
  groupName: string;
  membersUrl: string;
  unsubscribeUrl: string;
}

/** Never includes the requester's email, only their name, matching the in-app request band. */
export function buildGroupJoinRequestEmail(input: GroupJoinRequestEmailInput): {
  subject: string;
  html: string;
} {
  const messages = emailMessages(input.locale);
  const requester = escapeHtml(input.requesterName ?? messages.someone);
  const greeting = messages.greeting(
    input.recipientName === null ? null : escapeHtml(input.recipientName),
  );
  const subject = messages.joinRequestSubject(input.groupName);

  const bodyHtml = `
    <p style="margin:0 0 12px;">${greeting}</p>
    <p style="margin:0 0 16px;">${messages.joinRequestLead(`<strong>${requester}</strong>`, `<strong>${escapeHtml(input.groupName)}</strong>`)}</p>
    <p style="margin:0;">${emailButton(messages.reviewRequestButton, input.membersUrl)}</p>
  `;

  return {
    subject,
    html: renderEmailLayout({
      locale: input.locale,
      heading: messages.joinRequestHeading,
      bodyHtml,
      footerNote: messages.footerGroupOwner,
      unsubscribe: {
        url: input.unsubscribeUrl,
        label: messages.unsubscribeLabel("groupJoinRequests"),
      },
    }),
  };
}

export interface GroupApprovedEmailInput {
  locale: DisplayLocale;
  recipientName: string | null;
  groupName: string;
  groupUrl: string;
  manageUrl: string;
  unsubscribeUrl: string;
}

export function buildGroupApprovedEmail(input: GroupApprovedEmailInput): {
  subject: string;
  html: string;
} {
  const messages = emailMessages(input.locale);
  const greeting = messages.greeting(
    input.recipientName === null ? null : escapeHtml(input.recipientName),
  );
  const group = escapeHtml(input.groupName);
  const subject = messages.approvedSubject(input.groupName);

  const benefits = messages.approvedBenefits
    .map((benefit) => `<li style="margin:0 0 6px;">${benefit}</li>`)
    .join("\n      ");
  const manageLink = `<a href="${escapeHtml(input.manageUrl)}" style="color:${BRAND};">${messages.managePageLinkLabel}</a>`;

  const bodyHtml = `
    <p style="margin:0 0 12px;">${greeting}</p>
    <p style="margin:0 0 16px;">${messages.approvedLead(`<strong>${group}</strong>`)}</p>
    <p style="margin:0 0 8px;">${messages.approvedBenefitsIntro}</p>
    <ul style="margin:0 0 16px;padding-left:20px;">
      ${benefits}
    </ul>
    <p style="margin:0 0 16px;">${messages.approvedVisibilityNote(manageLink)}</p>
    <p style="margin:0;">${emailButton(messages.openGroupButton(input.groupName), input.groupUrl)}</p>
  `;

  return {
    subject,
    html: renderEmailLayout({
      locale: input.locale,
      heading: messages.approvedHeading,
      bodyHtml,
      footerNote: messages.footerGroupJoin,
      unsubscribe: {
        url: input.unsubscribeUrl,
        label: messages.unsubscribeLabel("groupApprovals"),
      },
    }),
  };
}
