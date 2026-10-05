import type { AdminUserResponse, FeatureFlagResponse } from "@openrift/shared/types/api/admin";
import type { Selectable } from "kysely";

import type { FeatureFlagsTable } from "../../../db/tables/settings.js";
import { isoOrNull } from "../../../lib/iso-date.js";
import type { UserWithCounts } from "../repositories/users.js";

export function toAdminUser(row: UserWithCounts): AdminUserResponse {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    image: row.image,
    isAdmin: row.isAdmin,
    cardCount: row.cardCount,
    deckCount: row.deckCount,
    collectionCount: row.collectionCount,
    listCount: row.listCount,
    groups: row.groups,
    createdAt: row.createdAt.toISOString(),
    lastActiveAt: isoOrNull(row.lastActiveAt),
  };
}

export function toFeatureFlag(row: Selectable<FeatureFlagsTable>): FeatureFlagResponse {
  return {
    key: row.key,
    enabled: row.enabled,
    description: row.description,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
