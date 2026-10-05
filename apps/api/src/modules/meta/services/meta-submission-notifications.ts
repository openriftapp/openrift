import type { MetaSubmissionKind } from "@openrift/shared/types/enums";

import type { Repos } from "../../../deps.js";
import { sendChannelEmail } from "../../../email.js";
import type { EmailDeps } from "../../../email.js";
import { buildMetaSubmissionAlertEmail } from "../../../emails/meta-submission-emails.js";

export interface MetaSubmissionAlert {
  submitterUserId: string;
  kind: MetaSubmissionKind;
  eventName: string;
  playerName: string | null;
  note: string | null;
  summary?: string;
}

const KIND_SUMMARIES: Record<MetaSubmissionKind, string> = {
  new_list: "a new decklist",
  completion: "a fuller decklist",
  correction: "a decklist correction",
  event_correction: "an event correction",
};

function reviewUrl(appBaseUrl: string): string {
  return `${appBaseUrl}/admin/meta?tab=review`;
}

/**
 * Emails every admin who opted into the meta-submission channel. Same contract
 * as the card-submission alert: opt-in per admin, never throws, and the caller
 * runs it after the ledger row has committed.
 */
export async function notifyAdminsOfMetaSubmission(
  repos: Repos,
  submission: MetaSubmissionAlert,
  deps?: EmailDeps,
): Promise<void> {
  if (deps === undefined) {
    return;
  }

  try {
    const recipients = await repos.userPreferences.listMetaSubmissionRecipients();
    if (recipients.length === 0) {
      return;
    }

    const submitter = await repos.users.getById(submission.submitterUserId);
    const url = reviewUrl(deps.appBaseUrl);

    for (const recipient of recipients) {
      await sendChannelEmail(deps, recipient, "metaSubmissions", ({ unsubscribeUrl }) =>
        buildMetaSubmissionAlertEmail({
          recipientName: recipient.name,
          submitterName: submitter?.name ?? null,
          submitterEmail: submitter?.email ?? submission.submitterUserId,
          eventName: submission.eventName,
          playerName: submission.playerName,
          summary: submission.summary ?? KIND_SUMMARIES[submission.kind],
          note: submission.note,
          reviewUrl: url,
          unsubscribeUrl,
        }),
      );
    }
  } catch (error) {
    deps.log.error(
      { err: error, submitterUserId: submission.submitterUserId },
      "Failed to notify admins of a meta submission",
    );
  }
}
