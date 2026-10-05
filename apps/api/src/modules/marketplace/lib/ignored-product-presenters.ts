import type { IgnoredProductResponse } from "@openrift/shared/types/api/admin";

import type { IgnoredEntry } from "../repositories/marketplace-admin.js";

export function toIgnoredProductResponse(row: IgnoredEntry): IgnoredProductResponse {
  if (row.level === "product") {
    return {
      level: "product",
      marketplace: row.marketplace,
      externalId: row.externalId,
      productName: row.productName,
      createdAt: row.createdAt.toISOString(),
    };
  }
  return {
    level: "variant",
    marketplace: row.marketplace,
    externalId: row.externalId,
    finish: row.finish,
    language: row.language,
    productName: row.productName,
    createdAt: row.createdAt.toISOString(),
  };
}
