import { withParams } from "@openrift/shared/schemas";
import { z } from "zod";

import { keyManagementRoute } from "./_base.js";
import {
  deckCheckKeyMintedResponseSchema,
  deckCheckKeyResponseSchema,
  deckCheckKeysResponseSchema,
  mintDeckCheckKeySchema,
  updateDeckCheckKeySchema,
} from "./deck-check.js";

const TAG = "Deck Check";

const ME_BASE = "/api/v1/me/deck-check-keys";
const ORG_BASE = "/api/v1/organizations/{orgId}/deck-check-keys";

const keyParamSchema = z.object({ keyId: z.uuid() });
const orgParamSchema = z.object({ orgId: z.uuid() });
const orgKeyParamSchema = z.object({ orgId: z.uuid(), keyId: z.uuid() });

// Minting returns the plaintext token exactly once.
export const deckCheckKeysContract = {
  listMine: keyManagementRoute
    .route({ method: "GET", path: ME_BASE, tags: [TAG] })
    .output(deckCheckKeysResponseSchema),
  mintMine: keyManagementRoute
    .route({ method: "POST", path: ME_BASE, tags: [TAG], successStatus: 201 })
    .input(mintDeckCheckKeySchema)
    .output(deckCheckKeyMintedResponseSchema),
  renameMine: keyManagementRoute
    .route({ method: "PATCH", path: `${ME_BASE}/{keyId}`, tags: [TAG] })
    .errors({ NOT_FOUND: { message: "Key not found" } })
    .input(withParams(keyParamSchema, updateDeckCheckKeySchema))
    .output(deckCheckKeyResponseSchema),
  revokeMine: keyManagementRoute
    .route({ method: "DELETE", path: `${ME_BASE}/{keyId}`, tags: [TAG], successStatus: 204 })
    .errors({ NOT_FOUND: { message: "Key not found" } })
    .input(keyParamSchema),
  // Permanently deletes an already-revoked key row (clears it from the list).
  removeMine: keyManagementRoute
    .route({
      method: "DELETE",
      path: `${ME_BASE}/{keyId}/permanent`,
      tags: [TAG],
      successStatus: 204,
    })
    .errors({ NOT_FOUND: { message: "Key not found" } })
    .input(keyParamSchema),

  listForOrg: keyManagementRoute
    .route({ method: "GET", path: ORG_BASE, tags: [TAG] })
    .errors({ NOT_FOUND: { message: "Organization not found" } })
    .input(orgParamSchema)
    .output(deckCheckKeysResponseSchema),
  mintForOrg: keyManagementRoute
    .route({ method: "POST", path: ORG_BASE, tags: [TAG], successStatus: 201 })
    .errors({ NOT_FOUND: { message: "Organization not found" } })
    .input(withParams(orgParamSchema, mintDeckCheckKeySchema))
    .output(deckCheckKeyMintedResponseSchema),
  renameForOrg: keyManagementRoute
    .route({ method: "PATCH", path: `${ORG_BASE}/{keyId}`, tags: [TAG] })
    .errors({ NOT_FOUND: { message: "Organization or key not found" } })
    .input(withParams(orgKeyParamSchema, updateDeckCheckKeySchema))
    .output(deckCheckKeyResponseSchema),
  revokeForOrg: keyManagementRoute
    .route({ method: "DELETE", path: `${ORG_BASE}/{keyId}`, tags: [TAG], successStatus: 204 })
    .errors({ NOT_FOUND: { message: "Organization or key not found" } })
    .input(orgKeyParamSchema),
  removeForOrg: keyManagementRoute
    .route({
      method: "DELETE",
      path: `${ORG_BASE}/{keyId}/permanent`,
      tags: [TAG],
      successStatus: 204,
    })
    .errors({ NOT_FOUND: { message: "Organization or key not found" } })
    .input(orgKeyParamSchema),
};

export type DeckCheckKeysContract = typeof deckCheckKeysContract;
