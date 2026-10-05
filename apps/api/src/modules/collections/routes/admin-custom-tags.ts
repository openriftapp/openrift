import { adminCustomTagsContract } from "@openrift/shared/contracts/admin/custom-tags";
import type {
  AdminCustomTagAssignmentsResponse,
  AdminCustomTagListResponse,
} from "@openrift/shared/types/api/admin";
import { implement } from "@orpc/server";

import { assertExisted, assertFound } from "../../../lib/assertions.js";
import { requireAuthedUser } from "../../../orpc/base.js";
import type { ApiContext } from "../../../orpc/context.js";
import { createTagCategoryHandlers } from "../../catalog/lib/tag-category-handlers.js";
import { assertSlugFreeForRename } from "../../catalog/lib/taxonomy-assertions.js";
import { toCustomTag } from "../lib/custom-tag-presenters.js";

const os = implement(adminCustomTagsContract).$context<ApiContext>().use(requireAuthedUser);

const categoryHandlers = createTagCategoryHandlers({
  repo: (context) => context.repos.customTagCategories,
  listTags: (context) => context.repos.customTags.listAll(),
  entityLabel: "Custom-tag category",
});

export const adminCustomTagsRouter = {
  listCategories: os.listCategories.handler(categoryHandlers.listCategories),
  createCategory: os.createCategory.handler(categoryHandlers.createCategory),
  updateCategory: os.updateCategory.handler(categoryHandlers.updateCategory),
  removeCategory: os.removeCategory.handler(categoryHandlers.removeCategory),

  listTags: os.listTags.handler(async ({ context }): Promise<AdminCustomTagListResponse> => {
    const { customTags: repo } = context.repos;
    const [rows, assignments] = await Promise.all([repo.listAll(), repo.assignmentsByCard()]);
    const counts = new Map<string, number>();
    for (const slugs of assignments.values()) {
      for (const slug of slugs) {
        counts.set(slug, (counts.get(slug) ?? 0) + 1);
      }
    }
    return { tags: rows.map((row) => toCustomTag(row, counts.get(row.slug) ?? 0)) };
  }),

  listAssignments: os.listAssignments.handler(
    async ({ context }): Promise<AdminCustomTagAssignmentsResponse> => {
      const { customTags: repo } = context.repos;
      const map = await repo.assignmentsByCard();
      return { assignments: Object.fromEntries(map) };
    },
  ),

  createTag: os.createTag.handler(async ({ input, context, errors }) => {
    const { customTags: repo, customTagCategories: catRepo } = context.repos;
    const { slug, label, categoryId, description } = input;
    const category = await catRepo.getById(categoryId);
    if (!category) {
      throw errors.BAD_REQUEST({ message: `Unknown category id: ${categoryId}` });
    }
    if (await repo.getBySlug(slug)) {
      throw errors.CONFLICT({ message: `Custom tag "${slug}" already exists` });
    }
    const maxSortOrder = await repo.getMaxSortOrder(categoryId);
    const created = await repo.create({
      slug,
      label,
      categoryId,
      description,
      sortOrder: maxSortOrder + 1,
    });
    return { tag: toCustomTag(created, 0) };
  }),

  updateTag: os.updateTag.handler(async ({ input, context, errors }): Promise<void> => {
    const { customTags: repo, customTagCategories: catRepo } = context.repos;
    const { id, ...body } = input;
    const existing = await repo.getById(id);
    assertFound(existing, "Custom tag not found");
    await assertSlugFreeForRename((slug) => repo.getBySlug(slug), existing.slug, body.slug);
    if (body.categoryId !== undefined && body.categoryId !== existing.categoryId) {
      const category = await catRepo.getById(body.categoryId);
      if (!category) {
        throw errors.BAD_REQUEST({ message: `Unknown category id: ${body.categoryId}` });
      }
    }
    await repo.update(id, body);
  }),

  removeTag: os.removeTag.handler(async ({ input, context }): Promise<void> => {
    const deleted = await context.repos.customTags.deleteById(input.id);
    assertExisted(deleted, "Custom tag not found");
  }),

  addCards: os.addCards.handler(async ({ input, context }) => {
    const { customTags: repo } = context.repos;
    const { id, cardIds } = input;
    const existing = await repo.getById(id);
    assertFound(existing, "Custom tag not found");
    const added = await repo.addToCards(id, cardIds);
    return { added, requested: cardIds.length };
  }),

  clearCards: os.clearCards.handler(async ({ input, context }) => {
    const { customTags: repo } = context.repos;
    const { id } = input;
    const existing = await repo.getById(id);
    assertFound(existing, "Custom tag not found");
    const removed = await repo.clearAssignments(id);
    return { removed };
  }),

  getCardTags: os.getCardTags.handler(async ({ input, context }) => {
    const { customTags: repo, catalog } = context.repos;
    const card = await catalog.getCardById(input.id);
    assertFound(card, "Card not found");
    const customTagIds = await repo.tagIdsForCard(input.id);
    return { customTagIds };
  }),

  setCardTags: os.setCardTags.handler(async ({ input, context, errors }): Promise<void> => {
    const { customTags: repo, catalog } = context.repos;
    const { id, customTagIds } = input;
    const card = await catalog.getCardById(id);
    assertFound(card, "Card not found");
    if (customTagIds.length > 0) {
      const tags = await Promise.all(customTagIds.map((tagId) => repo.getById(tagId)));
      const missing = customTagIds.filter((_, i) => tags[i] === undefined);
      if (missing.length > 0) {
        throw errors.BAD_REQUEST({ message: `Unknown custom-tag ids: ${missing.join(", ")}` });
      }
    }
    await repo.setForCard(id, customTagIds);
  }),
};
