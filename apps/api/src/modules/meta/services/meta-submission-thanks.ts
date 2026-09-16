import { metaPlayerKey } from "@openrift/shared/utils";

import type { Repos } from "../../../deps.js";
import { sendSubmissionAcceptedEmail } from "../../users/services/submission-accepted-notifications.js";
import type {
  SubmissionAcceptedEmailDeps,
  ViewLink,
} from "../../users/services/submission-accepted-notifications.js";

/**
 * Thanks the submitter of an accepted decklist or applied event correction.
 * Never throws; callers invoke it after the accept has committed, once per
 * pending-to-accepted move.
 */
export async function notifySubmitterOfMetaAcceptance(
  repos: Repos,
  submissionId: string,
  deps?: SubmissionAcceptedEmailDeps,
): Promise<void> {
  if (deps === undefined) {
    return;
  }

  try {
    const submission = await repos.metaSubmissions.byId(submissionId);
    if (submission?.status !== "accepted") {
      return;
    }
    const overlay =
      submission.playerOverlayId === null
        ? undefined
        : await repos.metaOverlays.playerOverlayById(submission.playerOverlayId);
    const playerId = overlay?.metaEventPlayerId ?? submission.metaEventPlayerId;
    const player = playerId === null ? undefined : await repos.meta.playerById(playerId);
    const eventId =
      (playerId === null ? undefined : await repos.meta.eventIdForPlayer(playerId)) ??
      submission.metaEventId;
    const event = eventId === null ? undefined : await repos.meta.eventRowById(eventId);

    const submissionsUrl = `${deps.appBaseUrl}/meta/submissions`;
    const playerKey = metaPlayerKey(player?.sourceIdentity ?? null);
    let link: ViewLink = { viewUrl: submissionsUrl, viewTarget: "submissions" };
    if (event !== undefined) {
      const eventUrl = `${deps.appBaseUrl}/meta/${encodeURIComponent(event.slug)}`;
      link =
        playerKey === null
          ? { viewUrl: eventUrl, viewTarget: "event" }
          : {
              viewUrl: `${eventUrl}/players/${encodeURIComponent(playerKey)}`,
              viewTarget: "decklist",
            };
    }

    await sendSubmissionAcceptedEmail(repos, deps, {
      userId: submission.userId,
      submission:
        submission.playerName === null
          ? { kind: "event", eventName: event?.name ?? submission.eventName }
          : {
              kind: "decklist",
              eventName: event?.name ?? submission.eventName,
              playerName: player?.playerName ?? submission.playerName,
            },
      link,
      submissionsUrl,
    });
  } catch (error) {
    deps.log.error(
      { err: error, submissionId },
      "Failed to send a meta-submission thank-you email",
    );
  }
}
