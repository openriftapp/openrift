import { adminOrganizationsContract } from "@openrift/shared/contracts/organizations";
import type {
  OrganizationListResponse,
  OrganizationResponse,
} from "@openrift/shared/types/api/tournament";
import { implement } from "@orpc/server";

import { assertExisted, assertFound, assertSlugAvailable } from "../../../lib/assertions.js";
import { requireAuthedUser } from "../../../orpc/base.js";
import type { ApiContext } from "../../../orpc/context.js";
import { toOrganizationResponse, toOrganizationSummary } from "../lib/tournament-presenters.js";

const os = implement(adminOrganizationsContract).$context<ApiContext>().use(requireAuthedUser);

/**
 * Admin organization provisioning. Mounted under `/api/admin/v1/organizations`,
 * admin-gated by the `requireAdmin` middleware on that prefix. Conflict /
 * not-found states are thrown as `AppError` and mapped by the handler's
 * interceptor.
 */
export const adminOrganizationsRouter = {
  list: os.list.handler(async ({ context }): Promise<OrganizationListResponse> => {
    const rows = await context.repos.organizations.listAll();
    return { items: rows.map((row) => toOrganizationSummary(row)) };
  }),

  create: os.create.handler(async ({ input, context }): Promise<OrganizationResponse> => {
    const { organizations, users } = context.repos;
    const existing = await organizations.getBySlug(input.slug);
    assertSlugAvailable(existing, input.slug, "Organization");
    const owner = await users.getById(input.ownerUserId);
    assertFound(owner, "Owner user not found");
    const org = await organizations.create({
      slug: input.slug,
      name: input.name,
      description: input.description ?? null,
      ownerUserId: input.ownerUserId,
    });
    return toOrganizationResponse(org);
  }),

  update: os.update.handler(async ({ input, context }): Promise<OrganizationResponse> => {
    const { organizations } = context.repos;
    const { id, ...patch } = input;
    const org = await organizations.getById(id);
    assertFound(org, "Organization not found");
    if (patch.slug && patch.slug !== org.slug) {
      const clash = await organizations.getBySlug(patch.slug);
      assertSlugAvailable(clash, patch.slug, "Organization");
    }
    const updated = await organizations.update(id, patch);
    assertFound(updated, "Organization not found");
    return toOrganizationResponse(updated);
  }),

  remove: os.remove.handler(async ({ input, context }): Promise<void> => {
    const deleted = await context.repos.organizations.deleteById(input.id);
    assertExisted(deleted, "Organization not found");
  }),
};
