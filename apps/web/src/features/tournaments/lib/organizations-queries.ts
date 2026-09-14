import {
  adminOrganizationsContract,
  organizationsContract,
} from "@openrift/shared/contracts/organizations";
import type {
  OrganizationDetailResponse,
  OrganizationListResponse,
} from "@openrift/shared/types/api/tournament";
import { queryOptions } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";

import { organizationsKeys } from "@/features/tournaments/lib/tournaments-query-keys";
import { withCookies } from "@/lib/server-fns/middleware";
import { apiOrpcClient } from "@/lib/server-fns/orpc-client";

const fetchMyOrganizations = createServerFn({ method: "GET" })
  .middleware([withCookies])
  .handler(({ context }): Promise<OrganizationListResponse> =>
    apiOrpcClient(organizationsContract, context.cookie).list(),
  );

const fetchOrganization = createServerFn({ method: "GET" })
  .validator((input: string) => input)
  .middleware([withCookies])
  .handler(({ context, data: id }): Promise<OrganizationDetailResponse> =>
    apiOrpcClient(organizationsContract, context.cookie).get({ id }),
  );

const fetchAdminOrganizations = createServerFn({ method: "GET" })
  .middleware([withCookies])
  .handler(({ context }): Promise<OrganizationListResponse> =>
    apiOrpcClient(adminOrganizationsContract, context.cookie).list(),
  );

export function myOrganizationsQueryOptions(userId: string) {
  return queryOptions({
    queryKey: organizationsKeys.mine(userId),
    queryFn: () => fetchMyOrganizations(),
  });
}

export function organizationQueryOptions(userId: string, id: string) {
  return queryOptions({
    queryKey: organizationsKeys.detail(userId, id),
    queryFn: () => fetchOrganization({ data: id }),
  });
}

export const adminOrganizationsQueryOptions = queryOptions({
  queryKey: organizationsKeys.adminAll,
  queryFn: () => fetchAdminOrganizations(),
});
