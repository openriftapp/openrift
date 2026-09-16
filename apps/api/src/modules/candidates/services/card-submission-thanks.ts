import type { Repos } from "../../../deps.js";
import { sendSubmissionAcceptedEmail } from "../../users/services/submission-accepted-notifications.js";
import type {
  SubmissionAcceptedEmailDeps,
  ViewLink,
} from "../../users/services/submission-accepted-notifications.js";

/**
 * Thanks the submitter of an accepted card submission. Never throws; callers
 * invoke it after the accept has committed, once per pending-to-accepted move.
 */
export async function notifySubmitterOfCardAcceptance(
  repos: Repos,
  submissionId: string,
  deps?: SubmissionAcceptedEmailDeps,
): Promise<void> {
  if (deps === undefined) {
    return;
  }

  try {
    const submission = await repos.cardSubmissions.findById(submissionId);
    if (submission?.status !== "accepted") {
      return;
    }
    const card =
      submission.acceptedCardId === null
        ? undefined
        : await repos.catalogMutations.getCardById(submission.acceptedCardId);
    const submissionsUrl = `${deps.appBaseUrl}/contribute/submissions`;
    const link: ViewLink =
      card === undefined
        ? { viewUrl: submissionsUrl, viewTarget: "submissions" }
        : {
            viewUrl: `${deps.appBaseUrl}/cards/${encodeURIComponent(card.slug)}`,
            viewTarget: "card",
          };

    await sendSubmissionAcceptedEmail(repos, deps, {
      userId: submission.userId,
      submission: { kind: "card", cardName: card?.name ?? submission.cardName },
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
