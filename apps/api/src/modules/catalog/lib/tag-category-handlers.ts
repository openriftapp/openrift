import { ERROR_CODES } from "@openrift/shared/error-codes";
import type { TagCategoryResponse } from "@openrift/shared/types/api/admin";

import { AppError } from "../../../errors.js";
import { assertFound, assertSlugAvailable } from "../../../lib/assertions.js";
import type { ApiContext } from "../../../orpc/context.js";
import { assertSlugFreeForRename } from "./taxonomy-assertions.js";
import { toTagCategoryResponse } from "./taxonomy-presenters.js";

type TagCategoryRow = Parameters<typeof toTagCategoryResponse>[0];

interface TagCategoryFields {
  slug?: string;
  label?: string;
  description?: string | null;
}

export interface TagCategoryRepo {
  listAll: () => Promise<TagCategoryRow[]>;
  getById: (id: string) => Promise<TagCategoryRow | undefined>;
  getBySlug: (slug: string) => Promise<unknown>;
  getMaxSortOrder: () => Promise<number>;
  create: (values: {
    slug: string;
    label: string;
    description?: string | null;
    sortOrder?: number;
  }) => Promise<TagCategoryRow>;
  update: (id: string, updates: TagCategoryFields) => Promise<unknown>;
  deleteById: (id: string) => Promise<unknown>;
  isInUse: (id: string) => Promise<boolean>;
}

export interface TagCategoryHandlersConfig {
  repo: (context: ApiContext) => TagCategoryRepo;
  listTags: (context: ApiContext) => Promise<readonly { categoryId: string }[]>;
  entityLabel: string;
}

export interface TagCategoryHandlers {
  listCategories: (args: { context: ApiContext }) => Promise<{ categories: TagCategoryResponse[] }>;
  createCategory: (args: {
    input: { slug: string; label: string; description?: string | null };
    context: ApiContext;
  }) => Promise<{ category: TagCategoryResponse }>;
  updateCategory: (args: {
    input: { id: string } & TagCategoryFields;
    context: ApiContext;
  }) => Promise<void>;
  removeCategory: (args: { input: { id: string }; context: ApiContext }) => Promise<void>;
}

export function createTagCategoryHandlers(config: TagCategoryHandlersConfig): TagCategoryHandlers {
  const { repo: repoOf, listTags, entityLabel } = config;
  const notFoundMessage = `${entityLabel} not found`;

  return {
    async listCategories({ context }) {
      const [cats, tags] = await Promise.all([repoOf(context).listAll(), listTags(context)]);
      const counts = new Map<string, number>();
      for (const tag of tags) {
        counts.set(tag.categoryId, (counts.get(tag.categoryId) ?? 0) + 1);
      }
      return { categories: cats.map((cat) => toTagCategoryResponse(cat, counts.get(cat.id) ?? 0)) };
    },

    async createCategory({ input, context }) {
      const repo = repoOf(context);
      const { slug, label, description } = input;
      assertSlugAvailable(await repo.getBySlug(slug), slug, "Category");
      const maxSortOrder = await repo.getMaxSortOrder();
      const created = await repo.create({ slug, label, description, sortOrder: maxSortOrder + 1 });
      return { category: toTagCategoryResponse(created, 0) };
    },

    async updateCategory({ input, context }) {
      const repo = repoOf(context);
      const { id, ...body } = input;
      const existing = await repo.getById(id);
      assertFound(existing, notFoundMessage);
      await assertSlugFreeForRename((slug) => repo.getBySlug(slug), existing.slug, body.slug);
      await repo.update(id, body);
    },

    async removeCategory({ input, context }) {
      const repo = repoOf(context);
      const { id } = input;
      assertFound(await repo.getById(id), notFoundMessage);
      if (await repo.isInUse(id)) {
        throw new AppError(
          409,
          ERROR_CODES.CONFLICT,
          "Category is in use by one or more tags — reassign them first",
        );
      }
      await repo.deleteById(id);
    },
  };
}
