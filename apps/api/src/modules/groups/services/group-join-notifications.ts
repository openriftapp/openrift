import { groupPath } from "@openrift/shared/site-paths";
import { isGroupApprovalEmailEnabled } from "@openrift/shared/types/api/preferences";

import type { Repos } from "../../../deps.js";
import type { EmailDeps } from "../../../email.js";
import { sendChannelEmail } from "../../../email.js";
import {
  buildGroupApprovedEmail,
  buildGroupJoinRequestEmail,
} from "../../../emails/group-emails.js";

export interface GroupJoinRequest {
  groupId: string;
  groupSlug: string;
  groupName: string;
  requesterUserId: string;
}

/**
 * Never throws. The caller invokes it after the invite row has committed and
 * outside any transaction, so a mail failure can never roll back or 500 the request.
 */
export async function notifyAdminsOfGroupJoinRequest(
  repos: Repos,
  request: GroupJoinRequest,
  deps?: EmailDeps,
): Promise<void> {
  if (deps === undefined) {
    return;
  }

  try {
    const recipients = await repos.userPreferences.listGroupJoinRequestRecipients(request.groupId);
    if (recipients.length === 0) {
      return;
    }

    const requester = await repos.users.getById(request.requesterUserId);
    const membersUrl = deps.appBaseUrl + groupPath(request.groupSlug, "members");

    // Sent individually so admins don't see each other's addresses.
    for (const recipient of recipients) {
      await sendChannelEmail(
        deps,
        recipient,
        "groupJoinRequests",
        ({ unsubscribeUrl }) =>
          buildGroupJoinRequestEmail({
            locale: recipient.displayLocale,
            recipientName: recipient.name,
            requesterName: requester?.name ?? null,
            groupName: request.groupName,
            membersUrl,
            unsubscribeUrl,
          }),
        { groupId: request.groupId },
      );
    }
  } catch (error) {
    deps.log.error(
      { err: error, groupId: request.groupId },
      "Failed to notify admins of a group join request",
    );
  }
}

export interface GroupApproval {
  groupId: string;
  groupSlug: string;
  groupName: string;
  memberUserId: string;
}

/**
 * Same contract as {@link notifyAdminsOfGroupJoinRequest}: never throws, and
 * the caller invokes it after the membership has committed and outside the transaction.
 */
export async function notifyMemberOfGroupApproval(
  repos: Repos,
  approval: GroupApproval,
  deps?: EmailDeps,
): Promise<void> {
  if (deps === undefined) {
    return;
  }

  try {
    const context = await repos.userPreferences.getEmailNotificationContext(approval.memberUserId);
    if (context === undefined || !context.emailVerified) {
      return;
    }
    if (!isGroupApprovalEmailEnabled(context.emailNotifications)) {
      return;
    }

    await sendChannelEmail(
      deps,
      { userId: approval.memberUserId, email: context.email },
      "groupApprovals",
      ({ unsubscribeUrl }) =>
        buildGroupApprovedEmail({
          locale: context.displayLocale,
          recipientName: context.name,
          groupName: approval.groupName,
          groupUrl: deps.appBaseUrl + groupPath(approval.groupSlug),
          manageUrl: deps.appBaseUrl + groupPath(approval.groupSlug, "manage"),
          unsubscribeUrl,
        }),
      { groupId: approval.groupId },
    );
  } catch (error) {
    deps.log.error(
      { err: error, groupId: approval.groupId, memberUserId: approval.memberUserId },
      "Failed to send a group approval email",
    );
  }
}
