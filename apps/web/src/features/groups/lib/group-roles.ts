import type { FriendGroupRole } from "@openrift/shared/types/api/friend-group";

import { m } from "@/paraglide/messages.js";

export function roleLabel(role: FriendGroupRole): string {
  const labels: Record<FriendGroupRole, () => string> = {
    owner: m.groups_role_owner,
    admin: m.groups_role_admin,
    member: m.groups_role_member,
  };
  return labels[role]();
}
