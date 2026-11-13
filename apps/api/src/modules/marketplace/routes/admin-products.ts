import { adminProductsContract } from "@openrift/shared/contracts/admin/products";
import { implement } from "@orpc/server";

import { assertFound } from "../../../lib/assertions.js";
import { auditChange } from "../../../lib/audit-change.js";
import { requireAuthedUser } from "../../../orpc/base.js";
import type { ApiContext } from "../../../orpc/context.js";
import { recordAdminEvent } from "../../system/services/record-admin-event.js";
import { toCoverCards, toProductSummary } from "../lib/product-presenters.js";
import { createProductFromList, resyncProductContents } from "../services/products.js";

const os = implement(adminProductsContract).$context<ApiContext>().use(requireAuthedUser);

/**
 * Admin product management, gated by the `/api/admin/v1/*` mount. Contents
 * are written only by the list snapshot service; metadata edits are a plain
 * PATCH.
 */
export const adminProductsRouter = {
  create: os.create.handler(async ({ input, context }) => {
    const product = await createProductFromList(
      context.repos,
      context.transact,
      context.userId,
      input,
    );
    await recordAdminEvent(context.repos, context.userId, {
      action: "product.create",
      entityType: "product",
      entityId: product.id,
      entityLabel: product.name,
      newValues: { ...input },
    });
    const covers = await context.repos.products.coverCards([product.id]);
    return { product: toProductSummary(product, toCoverCards(covers)) };
  }),

  resyncContents: os.resyncContents.handler(async ({ input, context }): Promise<void> => {
    await resyncProductContents(
      context.repos,
      context.transact,
      context.userId,
      input.id,
      input.listId,
    );
    await recordAdminEvent(context.repos, context.userId, {
      action: "product.resync",
      entityType: "product",
      entityId: input.id,
      newValues: { listId: input.listId },
    });
  }),

  update: os.update.handler(async ({ input, context, errors }): Promise<void> => {
    const { id, ...patch } = input;
    const { products, sets } = context.repos;
    const existing = await products.getById(id);
    assertFound(existing, "Product not found");
    if (patch.slug !== undefined && (await products.slugTaken(patch.slug, id))) {
      throw errors.CONFLICT({ message: `Slug "${patch.slug}" already in use` });
    }
    if (patch.setId !== null && patch.setId !== undefined) {
      assertFound(await sets.getRef(patch.setId), "Set not found");
    }
    await products.update(id, patch);
    await recordAdminEvent(context.repos, context.userId, {
      action: "product.update",
      entityType: "product",
      entityId: id,
      entityLabel: existing.name,
      ...auditChange(existing, patch),
    });
  }),

  remove: os.remove.handler(async ({ input, context, errors }): Promise<void> => {
    const existing = await context.repos.products.getById(input.id);
    const removed = await context.repos.products.remove(input.id);
    if (!removed) {
      throw errors.NOT_FOUND({ message: "Product not found" });
    }
    await recordAdminEvent(context.repos, context.userId, {
      action: "product.delete",
      entityType: "product",
      entityId: input.id,
      entityLabel: existing?.name,
      oldValues: existing && {
        slug: existing.slug,
        name: existing.name,
        setId: existing.setId,
        description: existing.description,
      },
    });
  }),
};
