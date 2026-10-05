import { adminMarkersContract } from "@openrift/shared/contracts/admin/markers";
import { implement } from "@orpc/server";

import { assertSlugAvailable } from "../../../lib/assertions.js";
import { requireAuthedUser } from "../../../orpc/base.js";
import type { ApiContext } from "../../../orpc/context.js";
import { createKeyedTaxonomyHandlers } from "../lib/slug-taxonomy-router.js";
import { assertSlugFreeForRename } from "../lib/taxonomy-assertions.js";
import { toMarkerResponse } from "../lib/taxonomy-presenters.js";

const os = implement(adminMarkersContract).$context<ApiContext>().use(requireAuthedUser);

const handlers = createKeyedTaxonomyHandlers({
  keyColumn: "id",
  entityName: "Marker",
  inUseBy: "one or more printings",
  repo: (context) => context.repos.markers,
  getByKey: (context, id) => context.repos.markers.getById(id),
  deleteByKey: (context, id) => context.repos.markers.deleteById(id),
  notFoundMessage: () => "Marker not found",
  afterReorder: async (context) => {
    // marker.sort_order feeds canonical_rank.
    await context.repos.catalog.refreshCanonicalRank();
  },
});

/** Markers are keyed by their UUID `id`. */
export const adminMarkersRouter = {
  list: os.list.handler(async ({ context }) => {
    const { markers: repo } = context.repos;
    const rows = await repo.listAll();
    return { markers: rows.map((row) => toMarkerResponse(row)) };
  }),

  reorder: os.reorder.handler(handlers.reorder),

  create: os.create.handler(async ({ input, context }) => {
    const { markers: repo } = context.repos;
    const { slug, label, description } = input;
    const existing = await repo.getBySlug(slug);
    assertSlugAvailable(existing, slug, "Marker");
    const maxSortOrder = await repo.getMaxSortOrder();
    const created = await repo.create({ slug, label, description, sortOrder: maxSortOrder + 1 });
    return { marker: toMarkerResponse(created) };
  }),

  update: os.update.handler(async ({ input, context, errors }): Promise<void> => {
    const { markers: repo } = context.repos;
    const { id, slug, label, description } = input;
    const existing = await repo.getById(id);
    if (!existing) {
      throw errors.NOT_FOUND({ message: "Marker not found" });
    }
    await assertSlugFreeForRename((next) => repo.getBySlug(next), existing.slug, slug);
    await repo.update(id, { slug, label, description });
  }),

  remove: os.remove.handler(handlers.remove),
};
