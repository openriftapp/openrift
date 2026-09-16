import type { Logger } from "@openrift/shared/logger";
import { isSubmissionAcceptedEmailEnabled } from "@openrift/shared/types/api/preferences";

import type { Repos } from "../../../deps.js";
import type { createEmailSender } from "../../../email.js";
import { buildSubmissionAcceptedEmail } from "../../../emails/submission-accepted-emails.js";
import type {
  AcceptedSubmission,
  AcceptedSubmissionTarget,
} from "../../../emails/submission-accepted-emails.js";
import { buildUnsubscribeUrls } from "../../../emails/unsubscribe-token.js";

type SendEmail = ReturnType<typeof createEmailSender>;

export interface SubmissionAcceptedEmailDeps {
  sendEmail: SendEmail;
  appBaseUrl: string;
  unsubscribeSecret: string;
  log: Logger;
}

export interface ViewLink {
  viewUrl: string;
  viewTarget: AcceptedSubmissionTarget;
}

/** Sends only to a verified address whose owner has not opted out. */
export async function sendSubmissionAcceptedEmail(
  repos: Repos,
  deps: SubmissionAcceptedEmailDeps,
  message: {
    userId: string;
    submission: AcceptedSubmission;
    link: ViewLink;
    submissionsUrl: string;
  },
): Promise<void> {
  const context = await repos.userPreferences.getEmailNotificationContext(message.userId);
  if (
    context === undefined ||
    !context.emailVerified ||
    !isSubmissionAcceptedEmailEnabled(context.emailNotifications)
  ) {
    return;
  }

  const { pageUrl, oneClickUrl } = buildUnsubscribeUrls(
    deps.appBaseUrl,
    deps.unsubscribeSecret,
    message.userId,
    "submissionAccepted",
  );
  const { subject, html } = buildSubmissionAcceptedEmail({
    locale: context.displayLocale,
    recipientName: context.name,
    submission: message.submission,
    viewUrl: message.link.viewUrl,
    viewTarget: message.link.viewTarget,
    submissionsUrl: message.submissionsUrl,
    unsubscribeUrl: pageUrl,
  });

  await deps.sendEmail({
    to: context.email,
    subject,
    html,
    listUnsubscribeUrl: oneClickUrl,
  });
}
