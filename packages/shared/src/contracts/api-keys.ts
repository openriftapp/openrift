import { z } from "zod";

import { API_KEY_EXPIRY_DAYS } from "../api-key-scopes.js";
import { keyManagementRoute } from "./_base.js";

const TAG = "API Keys";
const BASE = "/api/v1/me/api-keys";

const areaGrantSchema = z.enum(["none", "read", "write"]);

const apiKeyGrantsSchema = z.object({
  collection: areaGrantSchema,
  lists: areaGrantSchema,
  decks: areaGrantSchema,
});

export const createApiKeySchema = z.object({
  name: z.string().trim().min(1).max(120),
  grants: apiKeyGrantsSchema,
  admin: z.boolean(),
  expiresInDays: z
    .literal(API_KEY_EXPIRY_DAYS)
    .nullable()
    .meta({ description: "Days until the key expires; null never expires" }),
});

export const apiKeyResponseSchema = z.object({
  id: z.string(),
  name: z.string().nullable(),
  start: z.string().nullable().meta({ description: "First characters of the key, for display" }),
  grants: apiKeyGrantsSchema,
  admin: z.boolean(),
  createdAt: z.string(),
  expiresAt: z.string().nullable(),
  lastUsedAt: z.string().nullable(),
});

export const apiKeysResponseSchema = z.object({ items: z.array(apiKeyResponseSchema) });

export const apiKeyCreatedResponseSchema = z.object({
  key: apiKeyResponseSchema,
  token: z.string(),
});

const keyParamSchema = z.object({ keyId: z.string().min(1).max(64) });

// The plaintext token is returned once, at creation.
export const apiKeysContract = {
  listMine: keyManagementRoute
    .route({ method: "GET", path: BASE, tags: [TAG] })
    .output(apiKeysResponseSchema),
  createMine: keyManagementRoute
    .route({ method: "POST", path: BASE, tags: [TAG], successStatus: 201 })
    .errors({
      BAD_REQUEST: { message: "Pick at least one scope" },
      CONFLICT: { message: "Key limit reached" },
    })
    .input(createApiKeySchema)
    .output(apiKeyCreatedResponseSchema),
  revokeMine: keyManagementRoute
    .route({ method: "DELETE", path: `${BASE}/{keyId}`, tags: [TAG], successStatus: 204 })
    .errors({ NOT_FOUND: { message: "Key not found" } })
    .input(keyParamSchema),
};

export type ApiKeysContract = typeof apiKeysContract;
