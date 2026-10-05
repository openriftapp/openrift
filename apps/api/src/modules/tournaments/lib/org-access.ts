import { ERROR_CODES } from "@openrift/shared/error-codes";
import { createRoleRank } from "@openrift/shared/friend-group-roles";
import { isUuid } from "@openrift/shared/strings";
import type { OrganizationRole } from "@openrift/shared/types/api/tournament";

import type { Repos } from "../../../deps.js";
import { AppError } from "../../../errors.js";
import { assertFound } from "../../../lib/assertions.js";
import type { Organization, OrganizationMember } from "../repositories/organizations.js";

/**
 * Loads an organization by id or slug; 404 if missing. A non-uuid `id` passed
 * to `getById` throws Postgres `22P02`, so branch on the value's shape.
 */
export async function loadOrg(
  repos: Repos,
  idOrSlug: string,
  notFoundMessage = "Organization not found",
): Promise<Organization> {
  const org = isUuid(idOrSlug)
    ? await repos.organizations.getById(idOrSlug)
    : await repos.organizations.getBySlug(idOrSlug);
  assertFound(org, notFoundMessage);
  return org;
}

export const ORG_ROLE_RANK = createRoleRank<OrganizationRole>(["judge", "manager", "owner"]);

const ORG_ROLE_MINIMUM_MESSAGE: Record<OrganizationRole, string> = {
  judge: "Organization members only",
  manager: "Owner or manager only",
  owner: "Owner only",
};

export function hasOrgRole(role: OrganizationRole, minimum: OrganizationRole): boolean {
  return ORG_ROLE_RANK[role] >= ORG_ROLE_RANK[minimum];
}

/**
 * Loads the caller's membership and asserts it meets the minimum role; throws
 * 403 for a non-member as well as for an under-ranked one.
 */
export async function requireOrgRole(
  repos: Repos,
  orgId: string,
  userId: string,
  minimum: OrganizationRole,
): Promise<OrganizationMember> {
  const membership = await repos.organizations.getMembership(orgId, userId);
  if (!membership || !hasOrgRole(membership.role, minimum)) {
    throw new AppError(403, ERROR_CODES.FORBIDDEN, ORG_ROLE_MINIMUM_MESSAGE[minimum]);
  }
  return membership;
}

/**
 * Must run inside a transaction: the row lock stops two concurrent demotions
 * both passing the count guard and racing the org down to zero owners.
 */
export async function assertNotLastOwner(trxRepos: Repos, orgId: string): Promise<void> {
  await trxRepos.organizations.lockForUpdate(orgId);
  const owners = await trxRepos.organizations.countOwners(orgId);
  if (owners <= 1) {
    throw new AppError(
      400,
      ERROR_CODES.BAD_REQUEST,
      "An organization must keep at least one owner",
    );
  }
}
