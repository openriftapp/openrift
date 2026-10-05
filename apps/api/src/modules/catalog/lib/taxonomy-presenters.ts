import type {
  DistributionChannelResponse,
  LanguageResponse,
  MarkerResponse,
  TagCategoryResponse,
} from "@openrift/shared/types/api/admin";
import type { Selectable } from "kysely";

import type { Database } from "../../../db/tables.js";

interface TagCategoryRow {
  id: string;
  slug: string;
  label: string;
  description: string | null;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

export function toTagCategoryResponse(row: TagCategoryRow, tagCount: number): TagCategoryResponse {
  return {
    id: row.id,
    slug: row.slug,
    label: row.label,
    description: row.description,
    sortOrder: row.sortOrder,
    tagCount,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function toMarkerResponse(row: Selectable<Database["markers"]>): MarkerResponse {
  return {
    id: row.id,
    slug: row.slug,
    label: row.label,
    description: row.description,
    sortOrder: row.sortOrder,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function toLanguageResponse(row: Selectable<Database["languages"]>): LanguageResponse {
  return {
    code: row.code,
    name: row.name,
    color: row.color,
    sortOrder: row.sortOrder,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function toDistributionChannelResponse(
  row: Selectable<Database["distributionChannels"]>,
  printingCount: number,
): DistributionChannelResponse {
  return {
    id: row.id,
    slug: row.slug,
    label: row.label,
    description: row.description,
    kind: row.kind,
    sortOrder: row.sortOrder,
    parentId: row.parentId,
    childrenLabel: row.childrenLabel,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    printingCount,
  };
}
