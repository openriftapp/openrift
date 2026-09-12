import { emailButton, escapeHtml, MUTED_TEXT, renderEmailLayout } from "./layout.js";

const FOOTER_NOTE = "You're receiving this because you're an OpenRift admin.";

export interface MetaSubmissionAlertEmailInput {
  recipientName: string | null;
  submitterName: string | null;
  submitterEmail: string;
  eventName: string;
  /** Null for an event correction, which carries no player. */
  playerName: string | null;
  summary: string;
  note: string | null;
  reviewUrl: string;
  unsubscribeUrl: string;
}

export function buildMetaSubmissionAlertEmail(input: MetaSubmissionAlertEmailInput): {
  subject: string;
  html: string;
} {
  const submitter = input.submitterName ?? input.submitterEmail;
  const greeting = input.recipientName ? `Hi ${escapeHtml(input.recipientName)},` : "Hi,";
  const subject = `New meta submission: ${input.eventName}`;

  const playerHtml = input.playerName
    ? `<p style="margin:0 0 16px;">Player: ${escapeHtml(input.playerName)}</p>`
    : "";

  const noteHtml = input.note
    ? `<p style="margin:0 0 16px;">Their note: “${escapeHtml(input.note)}”</p>`
    : "";

  const bodyHtml = `
    <p style="margin:0 0 12px;">${greeting}</p>
    <p style="margin:0 0 16px;"><strong>${escapeHtml(submitter)}</strong> submitted ${escapeHtml(input.summary)} for <strong>${escapeHtml(input.eventName)}</strong>.</p>
    ${playerHtml}
    ${noteHtml}
    <p style="margin:0 0 20px;color:${MUTED_TEXT};font-size:12px;">Submitted by ${escapeHtml(input.submitterEmail)}</p>
    <p style="margin:0;">${emailButton("Review submissions", input.reviewUrl)}</p>
  `;

  return {
    subject,
    html: renderEmailLayout({
      heading: "New meta submission",
      bodyHtml,
      footerNote: FOOTER_NOTE,
      unsubscribe: { url: input.unsubscribeUrl, label: "Meta deck submission alerts" },
    }),
  };
}
