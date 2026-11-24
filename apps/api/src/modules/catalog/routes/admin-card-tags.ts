import { adminCardTagsContract } from "@openrift/shared/contracts/admin/card-tags";
import type { AdminCardTagListResponse } from "@openrift/shared/types/api/admin";
import { implement } from "@orpc/server";

import { isForeignKeyViolation } from "../../../lib/pg-errors.js";
import { requireAuthedUser } from "../../../orpc/base.js";
import type { ApiContext } from "../../../orpc/context.js";
import { createTagCategoryHandlers } from "../lib/tag-category-handlers.js";
import { discoverTagTranslations } from "../services/tag-translation-discovery.js";

const os = implement(adminCardTagsContract).$context<ApiContext>().use(requireAuthedUser);

const categoryHandlers = createTagCategoryHandlers({
  repo: (context) => context.repos.tagCategories,
  listTags: (context) => context.repos.tagDefinitions.listAll(),
  entityLabel: "Tag category",
  slugConstraint: "uq_tag_categories_slug",
});

/**
 * The tags themselves are card data; only the tag → category mapping is
 * editable here.
 */
export const adminCardTagsRouter = {
  listCategories: os.listCategories.handler(categoryHandlers.listCategories),
  createCategory: os.createCategory.handler(categoryHandlers.createCategory),
  updateCategory: os.updateCategory.handler(categoryHandlers.updateCategory),
  removeCategory: os.removeCategory.handler(categoryHandlers.removeCategory),

  listTags: os.listTags.handler(async ({ context }): Promise<AdminCardTagListResponse> => {
    const { tagDefinitions: repo } = context.repos;
    const tags = await repo.distinctCardTags();
    return { tags };
  }),

  setTagCategory: os.setTagCategory.handler(async ({ input, context, errors }): Promise<void> => {
    const { tagDefinitions: repo, tagCategories: catRepo } = context.repos;
    const { tag, categoryId } = input;
    if (categoryId !== null) {
      const category = await catRepo.getById(categoryId);
      if (!category) {
        throw errors.BAD_REQUEST({ message: `Unknown category id: ${categoryId}` });
      }
    }
    await repo.setCategory(tag, categoryId);
  }),

  detectLegendTags: os.detectLegendTags.handler(async ({ input, context, errors }) => {
    const { tagDefinitions: repo, tagCategories: catRepo, catalog } = context.repos;
    const { categoryId } = input;
    const category = await catRepo.getById(categoryId);
    if (!category) {
      throw errors.BAD_REQUEST({ message: `Unknown category id: ${categoryId}` });
    }
    // Tags the admin already classified are left untouched.
    const allLegendTags = await catalog.championIdentifierTags();
    const legendTags = allLegendTags.filter((tag) => tag !== "" && tag === tag.trim());
    const assigned = await repo.classifyMissing(legendTags, categoryId);
    return { found: legendTags.length, assigned };
  }),

  listTranslations: os.listTranslations.handler(async ({ context }) => {
    const { tagTranslations: repo } = context.repos;
    const [translations, unmapped] = await Promise.all([repo.listAll(), repo.unmappedLabels()]);
    return { translations, unmapped };
  }),

  setTranslation: os.setTranslation.handler(async ({ input, context, errors }): Promise<void> => {
    try {
      await context.repos.tagTranslations.upsert(input);
    } catch (error) {
      if (isForeignKeyViolation(error)) {
        throw errors.BAD_REQUEST({ message: `Unknown language: ${input.language}` });
      }
      throw error;
    }
  }),

  removeTranslation: os.removeTranslation.handler(async ({ input, context }): Promise<void> => {
    await context.repos.tagTranslations.remove(input.language, input.label);
  }),

  discoverTranslations: os.discoverTranslations.handler(({ context }) =>
    discoverTagTranslations(context.repos),
  ),
};
