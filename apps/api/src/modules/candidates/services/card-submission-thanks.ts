import { legendDisplayName } from "@openrift/shared/card-name";
import { cardUrl } from "@openrift/shared/site-paths";

import type { Repos } from "../../../deps.js";
import type { EmailDeps } from "../../../email.js";
import { sendSubmissionAcceptedEmail } from "../../users/services/submission-accepted-notifications.js";
import type { ViewLink } from "../../users/services/submission-accepted-notifications.js";

/**
 * Thanks the submitter of an accepted card submission. Never throws; callers
 * invoke it after the accept has committed, once per pending-to-accepted move.
 */
export async function notifySubmitterOfCardAcceptance(
  repos: Repos,
  submissionId: string,
  deps?: EmailDeps,
): Promise<void> {
  if (deps === undefined) {
    return;
  }

  try {
    const submission = await repos.cardSubmissions.getById(submissionId);
    if (submission?.status !== "accepted") {
      return;
    }
    const card =
      submission.acceptedCardId === null
        ? undefined
        : await repos.catalog.cardNameById(submission.acceptedCardId);
    const submissionsUrl = `${deps.appBaseUrl}/contribute/submissions`;
    const link: ViewLink =
      card === undefined
        ? { viewUrl: submissionsUrl, viewTarget: "submissions" }
        : {
            viewUrl: cardUrl(deps.appBaseUrl, card.slug),
            viewTarget: "card",
          };

    await sendSubmissionAcceptedEmail(repos, deps, {
      userId: submission.userId,
      submission: {
        kind: "card",
        cardName: card === undefined ? submission.cardName : legendDisplayName(card),
      },
      link,
      submissionsUrl,
    });
  } catch (error) {
    deps.log.error(
      { err: error, submissionId },
      "Failed to send a card-submission thank-you email",
    );
  }
}
