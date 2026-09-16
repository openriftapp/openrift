import type { DisplayLocale } from "@openrift/shared/types/api/preferences";

import { BRAND, emailButton, escapeHtml, renderEmailLayout } from "./layout.js";
import { emailMessages } from "./messages.js";
import type { EmailMessages } from "./messages.js";

export type AcceptedSubmission =
  | { kind: "card"; cardName: string }
  | { kind: "decklist"; eventName: string; playerName: string }
  | { kind: "event"; eventName: string };

export type AcceptedSubmissionTarget = "card" | "decklist" | "event" | "submissions";

export interface SubmissionAcceptedEmailInput {
  locale: DisplayLocale;
  recipientName: string | null;
  submission: AcceptedSubmission;
  viewUrl: string;
  viewTarget: AcceptedSubmissionTarget;
  submissionsUrl: string;
  unsubscribeUrl: string;
}

function viewButtonLabel(messages: EmailMessages, input: SubmissionAcceptedEmailInput): string {
  switch (input.viewTarget) {
    case "card": {
      return input.submission.kind === "card"
        ? messages.viewCardButton(input.submission.cardName)
        : messages.viewSubmissionsButton;
    }
    case "decklist": {
      return messages.viewDecklistButton;
    }
    case "event": {
      return messages.viewEventButton;
    }
    default: {
      return messages.viewSubmissionsButton;
    }
  }
}

function subjectAndLead(
  messages: EmailMessages,
  submission: AcceptedSubmission,
): { subject: string; lead: string } {
  switch (submission.kind) {
    case "card": {
      return {
        subject: messages.acceptedCardSubject(submission.cardName),
        lead: messages.acceptedCardLead(`<strong>${escapeHtml(submission.cardName)}</strong>`),
      };
    }
    case "decklist": {
      return {
        subject: messages.acceptedDecklistSubject(submission.eventName),
        lead: messages.acceptedDecklistLead(
          `<strong>${escapeHtml(submission.playerName)}</strong>`,
          `<strong>${escapeHtml(submission.eventName)}</strong>`,
        ),
      };
    }
    default: {
      return {
        subject: messages.acceptedEventSubject(submission.eventName),
        lead: messages.acceptedEventLead(`<strong>${escapeHtml(submission.eventName)}</strong>`),
      };
    }
  }
}

export function buildSubmissionAcceptedEmail(input: SubmissionAcceptedEmailInput): {
  subject: string;
  html: string;
} {
  const messages = emailMessages(input.locale);
  const greeting = messages.greeting(
    input.recipientName === null ? null : escapeHtml(input.recipientName),
  );
  const { submission } = input;

  const { subject, lead } = subjectAndLead(messages, submission);

  const submissionsNote =
    input.viewTarget === "submissions"
      ? ""
      : `<p style="margin:0 0 20px;">${messages.submissionsNote(
          `<a href="${escapeHtml(input.submissionsUrl)}" style="color:${BRAND};">${messages.submissionsLinkLabel}</a>`,
        )}</p>`;

  const bodyHtml = `
    <p style="margin:0 0 12px;">${greeting}</p>
    <p style="margin:0 0 16px;">${lead}</p>
    <p style="margin:0 0 16px;">${messages.acceptedThanks}</p>
    ${submissionsNote}
    <p style="margin:0;">${emailButton(viewButtonLabel(messages, input), input.viewUrl)}</p>
  `;

  return {
    subject,
    html: renderEmailLayout({
      locale: input.locale,
      heading: messages.acceptedHeading,
      bodyHtml,
      footerNote: messages.footerContribution,
      unsubscribe: {
        url: input.unsubscribeUrl,
        label: messages.unsubscribeLabel("submissionAccepted"),
      },
    }),
  };
}
