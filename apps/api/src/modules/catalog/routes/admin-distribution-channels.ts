import { adminDistributionChannelsContract } from "@openrift/shared/contracts/admin/distribution-channels";
import { implement } from "@orpc/server";

import { assertSlugAvailable, assertValidReorder } from "../../../lib/assertions.js";
import { raisedExceptionMessage } from "../../../lib/pg-errors.js";
import { requireAuthedUser } from "../../../orpc/base.js";
import type { ApiContext } from "../../../orpc/context.js";
import { assertSlugFreeForRename } from "../lib/taxonomy-assertions.js";
import { toDistributionChannelResponse } from "../lib/taxonomy-presenters.js";

const os = implement(adminDistributionChannelsContract)
  .$context<ApiContext>()
  .use(requireAuthedUser);

/**
 * Maps a hierarchy-trigger rejection (cycle, kind mismatch, depth cap, parent
 * already has printings) to a 409; the trigger's message is already human-readable.
 */
function asHierarchyConflict(error: unknown, conflict: (message: string) => Error): unknown {
  const raised = raisedExceptionMessage(error);
  if (raised === null) {
    return error;
  }
  return conflict(raised);
}

/**
 * Channels are keyed by their UUID `id` and may nest via `parentId`.
 */
export const adminDistributionChannelsRouter = {
  list: os.list.handler(async ({ context }) => {
    const { distributionChannels: repo } = context.repos;
    const [rows, counts] = await Promise.all([repo.listAll(), repo.usageCountsByChannel()]);
    const countById = new Map(counts.map((row) => [row.channelId, row.count]));
    return {
      distributionChannels: rows.map((row) =>
        toDistributionChannelResponse(row, countById.get(row.id) ?? 0),
      ),
    };
  }),

  reorder: os.reorder.handler(async ({ input, context }): Promise<void> => {
    const { distributionChannels: repo } = context.repos;
    const { ids } = input;
    const all = await repo.listAll();
    assertValidReorder(ids, all, {
      keyOf: (row) => row.id,
      keyNoun: "ids",
      unknownLabel: "distribution channel ids",
    });
    await repo.reorder(ids);
  }),

  create: os.create.handler(async ({ input, context, errors }) => {
    const { distributionChannels: repo } = context.repos;
    const { slug, label, description, kind, parentId, childrenLabel } = input;
    const existing = await repo.getBySlug(slug);
    assertSlugAvailable(existing, slug, "Distribution channel");
    const resolvedParentId = parentId ?? null;
    const maxSortOrder = await repo.getMaxSortOrderForParent(resolvedParentId);
    const created = await repo
      .create({
        slug,
        label,
        description,
        kind,
        parentId: resolvedParentId,
        childrenLabel: childrenLabel ?? null,
        sortOrder: maxSortOrder + 1,
      })
      .catch((error: unknown) => {
        throw asHierarchyConflict(error, (message) => errors.CONFLICT({ message }));
      });
    return { distributionChannel: toDistributionChannelResponse(created, 0) };
  }),

  update: os.update.handler(async ({ input, context, errors }): Promise<void> => {
    const { distributionChannels: repo } = context.repos;
    const { id, ...body } = input;
    const existing = await repo.getById(id);
    if (!existing) {
      throw errors.NOT_FOUND({ message: "Distribution channel not found" });
    }
    await assertSlugFreeForRename((slug) => repo.getBySlug(slug), existing.slug, body.slug);
    // Coercing an absent `parentId` to null here would reparent every
    // channel to the root on any partial edit.
    const updates = { ...body };
    if (Object.keys(updates).length === 0) {
      return;
    }
    const parentChanged =
      body.parentId !== undefined && (body.parentId ?? null) !== existing.parentId;
    try {
      if (parentChanged) {
        const parentId = body.parentId ?? null;
        const maxSortOrder = await repo.getMaxSortOrderForParent(parentId);
        await repo.update(id, { ...updates, parentId, sortOrder: maxSortOrder + 1 });
      } else {
        await repo.update(id, updates);
      }
    } catch (error) {
      throw asHierarchyConflict(error, (message) => errors.CONFLICT({ message }));
    }
  }),

  remove: os.remove.handler(async ({ input, context, errors }): Promise<void> => {
    const { distributionChannels: repo } = context.repos;
    const { id } = input.params;
    const force = input.query.force === "true";
    const existing = await repo.getById(id);
    if (!existing) {
      throw errors.NOT_FOUND({ message: "Distribution channel not found" });
    }
    const childRow = await repo.hasChildren(id);
    if (childRow) {
      throw errors.CONFLICT({
        message:
          "Cannot delete: distribution channel has child channels. Remove or reparent them first.",
      });
    }
    const usageCount = await repo.countInUse(id);
    if (usageCount > 0 && !force) {
      throw errors.CONFLICT({
        message: `Cannot delete: distribution channel is in use by ${usageCount} printing${usageCount === 1 ? "" : "s"}. Pass force=true to unlink and delete.`,
      });
    }
    if (usageCount > 0) {
      await repo.deleteLinksForChannel(id);
    }
    await repo.deleteById(id);
  }),
};
