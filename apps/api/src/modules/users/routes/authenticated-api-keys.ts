import {
  API_KEY_AREAS,
  MAX_API_KEYS_PER_USER,
  apiKeyGrantFor,
  apiKeyPermissionsFromGrants,
  parseApiKeyPermissions,
} from "@openrift/shared/api-key-scopes";
import { apiKeysContract } from "@openrift/shared/contracts/api-keys";
import type {
  ApiKeyCreatedResponse,
  ApiKeyResponse,
  ApiKeysResponse,
} from "@openrift/shared/types/api/api-key";
import { implement } from "@orpc/server";

import { badRequest, conflict, forbidden } from "../../../errors.js";
import { assertExisted } from "../../../lib/assertions.js";
import { getAdminAccess } from "../../../middleware/require-admin.js";
import { requireAuthedUser } from "../../../orpc/base.js";
import type { ApiContext } from "../../../orpc/context.js";
import type { ApiKeyRow } from "../repositories/api-keys.js";

const DAY_SECONDS = 24 * 60 * 60;

function toApiKey(row: ApiKeyRow): ApiKeyResponse {
  const permissions = parseApiKeyPermissions(row.permissions);
  return {
    id: row.id,
    name: row.name,
    start: row.start,
    grants: {
      collection: apiKeyGrantFor(permissions, "collection"),
      lists: apiKeyGrantFor(permissions, "lists"),
      decks: apiKeyGrantFor(permissions, "decks"),
    },
    admin: permissions.admin !== undefined,
    createdAt: row.createdAt.toISOString(),
    expiresAt: row.expiresAt?.toISOString() ?? null,
    lastUsedAt: row.lastRequest?.toISOString() ?? null,
  };
}

const os = implement(apiKeysContract).$context<ApiContext>().use(requireAuthedUser);

export const apiKeysRouter = {
  listMine: os.listMine.handler(async ({ context }): Promise<ApiKeysResponse> => {
    const rows = await context.repos.apiKeys.listActiveForUser(context.userId, new Date());
    return { items: rows.map((row) => toApiKey(row)) };
  }),

  createMine: os.createMine.handler(async ({ input, context }): Promise<ApiKeyCreatedResponse> => {
    const { repos, userId } = context;
    const hasArea = API_KEY_AREAS.some((area) => input.grants[area] !== "none");
    if (!hasArea && !input.admin) {
      throw badRequest("Pick at least one scope");
    }
    if (input.admin) {
      const access = await getAdminAccess(repos, userId);
      if (!access.isAdmin && access.sections.length === 0) {
        throw forbidden("Only admins can create admin keys");
      }
    }
    const active = await repos.apiKeys.listActiveForUser(userId, new Date());
    if (active.length >= MAX_API_KEYS_PER_USER) {
      throw conflict("Key limit reached");
    }

    const created = await context.auth.api.createApiKey({
      body: {
        userId,
        name: input.name,
        permissions: apiKeyPermissionsFromGrants(input.grants, input.admin),
        ...(input.expiresInDays === null ? {} : { expiresIn: input.expiresInDays * DAY_SECONDS }),
      },
    });
    return {
      key: toApiKey({
        id: created.id,
        name: created.name,
        start: created.start,
        permissions: JSON.stringify(created.permissions ?? null),
        createdAt: new Date(created.createdAt),
        expiresAt: created.expiresAt ? new Date(created.expiresAt) : null,
        lastRequest: null,
      }),
      token: created.key,
    };
  }),

  revokeMine: os.revokeMine.handler(async ({ input, context }): Promise<void> => {
    const removed = await context.repos.apiKeys.deleteForUser(input.keyId, context.userId);
    assertExisted(removed, "Key not found");
  }),
};
