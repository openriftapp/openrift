import { adminLanguagesContract } from "@openrift/shared/contracts/admin/languages";
import { implement } from "@orpc/server";

import { assertSlugAvailable } from "../../../lib/assertions.js";
import { requireAuthedUser } from "../../../orpc/base.js";
import type { ApiContext } from "../../../orpc/context.js";
import { createKeyedTaxonomyHandlers } from "../lib/slug-taxonomy-router.js";
import { toLanguageResponse } from "../lib/taxonomy-presenters.js";

const os = implement(adminLanguagesContract).$context<ApiContext>().use(requireAuthedUser);

const handlers = createKeyedTaxonomyHandlers({
  keyColumn: "code",
  entityName: "Language",
  inUseBy: "one or more printings",
  keyNoun: "language codes",
  repo: (context) => context.repos.languages,
  getByKey: (context, code) => context.repos.languages.getByCode(code),
  deleteByKey: (context, code) => context.repos.languages.deleteByCode(code),
  notFoundMessage: () => "Language not found",
  afterReorder: async (context) => {
    // language.sort_order is the leading canonical_rank term.
    await context.repos.catalog.refreshCanonicalRank();
  },
});

/** Languages are keyed by their `code`. */
export const adminLanguagesRouter = {
  list: os.list.handler(async ({ context }) => {
    const { languages: repo } = context.repos;
    const rows = await repo.listAll();
    return { languages: rows.map((row) => toLanguageResponse(row)) };
  }),

  reorder: os.reorder.handler(handlers.reorder),

  create: os.create.handler(async ({ input, context }) => {
    const { languages: repo } = context.repos;
    const { code, name, color, sortOrder } = input;

    const existing = await repo.getByCode(code);
    assertSlugAvailable(existing, code, "Language");

    const created = await repo.create({ code, name, color, sortOrder });
    return { language: toLanguageResponse(created) };
  }),

  update: os.update.handler(async ({ input, context, errors }): Promise<void> => {
    const { languages: repo } = context.repos;
    const { code, name, color, sortOrder } = input;

    const existing = await repo.getByCode(code);
    if (!existing) {
      throw errors.NOT_FOUND({ message: "Language not found" });
    }

    // `color: null` clears the chip color; `undefined` (omitted) leaves it
    // untouched — Kysely skips undefined values in the SET clause.
    await repo.update(code, { name, color, sortOrder });
  }),

  remove: os.remove.handler(handlers.remove),
};
