import type { SiteSettingResponse } from "@openrift/shared/types/api/admin";
import type { Selectable } from "kysely";

import type { SiteSettingsTable } from "../../../db/tables/settings.js";

export function toSiteSettingResponse(row: Selectable<SiteSettingsTable>): SiteSettingResponse {
  return {
    key: row.key,
    value: row.value,
    scope: row.scope,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
