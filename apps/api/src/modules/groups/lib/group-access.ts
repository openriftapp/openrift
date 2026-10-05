import { ERROR_CODES } from "@openrift/shared/error-codes";
import { createRoleRank } from "@openrift/shared/friend-group-roles";
import type { FriendGroupRole } from "@openrift/shared/types/api/friend-group";

import type { Repos } from "../../../deps.js";
import { AppError } from "../../../errors.js";
import { assertFound } from "../../../lib/assertions.js";
import type { Group, GroupMember } from "../repositories/friend-groups-shared.js";

export interface GroupContext {
  group: Group;
  membership: GroupMember;
}

/** Resolves rename aliases (`previous_slug`) too, so old bookmarks and email links keep working. */
export async function loadGroupBySlug(repos: Repos, slug: string): Promise<Group> {
  const group = await repos.friendGroups.getBySlugOrPrevious(slug);
  assertFound(group, "Group not found");
  return group;
}

export async function loadGroupForMember(
  repos: Repos,
  slug: string,
  viewerId: string,
): Promise<GroupContext> {
  const group = await loadGroupBySlug(repos, slug);
  const membership = await repos.friendGroups.getMembership(group.id, viewerId);
  assertFound(membership, "Group not found");
  return { group, membership };
}

/** Higher rank = more power; a check passes when the member's rank meets the minimum. */
export const ROLE_RANK = createRoleRank<FriendGroupRole>(["member", "admin", "owner"]);

const ROLE_MINIMUM_MESSAGE: Record<FriendGroupRole, string> = {
  member: "Members only",
  admin: "Admins only",
  owner: "Owner only",
};

export function hasRole(role: FriendGroupRole, minimum: FriendGroupRole): boolean {
  return ROLE_RANK[role] >= ROLE_RANK[minimum];
}

/** Throws 403 unless the membership meets the minimum role; a non-member fails too. */
export function requireRole(
  membership: GroupMember | undefined,
  minimum: FriendGroupRole,
): asserts membership is GroupMember {
  if (!membership || !hasRole(membership.role, minimum)) {
    throw new AppError(403, ERROR_CODES.FORBIDDEN, ROLE_MINIMUM_MESSAGE[minimum]);
  }
}
