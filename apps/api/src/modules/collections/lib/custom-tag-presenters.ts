import type { CustomTagResponse } from "@openrift/shared/types/api/admin";

interface CustomTagRow {
  id: string;
  slug: string;
  label: string;
  category: string;
  categoryLabel: string;
  categoryId: string;
  description: string | null;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

export function toCustomTag(row: CustomTagRow, cardCount: number): CustomTagResponse {
  return {
    id: row.id,
    slug: row.slug,
    label: row.label,
    category: row.category,
    categoryLabel: row.categoryLabel,
    categoryId: row.categoryId,
    description: row.description,
    sortOrder: row.sortOrder,
    cardCount,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
