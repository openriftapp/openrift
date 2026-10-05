import type { FriendGroupRole } from "./types/api/friend-group.js";

export function createRoleRank<Role extends string>(order: readonly Role[]): Record<Role, number> {
  return Object.fromEntries(order.map((role, rank) => [role, rank])) as Record<Role, number>;
}

export const GROUP_ADMIN_ROLES = ["admin", "owner"] as const;

export function isGroupAdminRole(
  role: FriendGroupRole | null | undefined,
): role is (typeof GROUP_ADMIN_ROLES)[number] {
  return role === "admin" || role === "owner";
}

/** Admins manage members; only the owner manages admins; nobody manages the owner. Callers exclude self. */
export function canManageMember(
  viewerRole: FriendGroupRole | null | undefined,
  targetRole: FriendGroupRole,
): boolean {
  if (!isGroupAdminRole(viewerRole) || targetRole === "owner") {
    return false;
  }
  return targetRole !== "admin" || viewerRole === "owner";
}
