import { adminCardSubmissionsContract } from "@openrift/shared/contracts/admin/card-submissions";
import { implement } from "@orpc/server";

import { requireAuthedUser } from "../../../orpc/base.js";
import type { ApiContext } from "../../../orpc/context.js";
import { recordAdminEvent } from "../../system/services/record-admin-event.js";
import { toAdminCardSubmission } from "../lib/card-submission-presenters.js";

const os = implement(adminCardSubmissionsContract).$context<ApiContext>().use(requireAuthedUser);

/**
 * The outcome is not settable here: it's derived by
 * `card-submission-outcomes.ts` from the check and ignore verbs.
 */
export const adminCardSubmissionsRouter = {
  forCandidate: os.forCandidate.handler(async ({ input, context }) => {
    const submission = await context.repos.cardSubmissions.getByCandidateCardId(
      input.candidateCardId,
    );
    if (!submission) {
      return { submission: null };
    }
    return { submission: toAdminCardSubmission(submission) };
  }),

  setResolution: os.setResolution.handler(async ({ input, context, errors }): Promise<void> => {
    const submission = await context.repos.cardSubmissions.getByCandidateCardId(
      input.candidateCardId,
    );
    if (!submission) {
      throw errors.NOT_FOUND();
    }

    await context.repos.cardSubmissions.setResolutionMessage(submission.id, {
      reason: input.reason,
      note: input.note,
      resolvedByUserId: context.userId,
    });

    await recordAdminEvent(context.repos, context.userId, {
      action: "card-submission.resolution",
      entityType: "card-submission",
      entityId: submission.id,
      entityLabel: submission.cardName,
      newValues: { reason: input.reason, note: input.note },
    });
  }),
};
