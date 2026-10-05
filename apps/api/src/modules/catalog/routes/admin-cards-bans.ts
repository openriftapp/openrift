import { adminCardBansContract } from "@openrift/shared/contracts/admin/card-bans";
import { implement } from "@orpc/server";

import { assertFound } from "../../../lib/assertions.js";
import { requireAuthedUser } from "../../../orpc/base.js";
import type { ApiContext } from "../../../orpc/context.js";
import { recordAdminEvent } from "../../system/services/record-admin-event.js";
import { toCardBanResponse } from "../lib/card-ban-presenters.js";

const os = implement(adminCardBansContract).$context<ApiContext>().use(requireAuthedUser);

/**
 * Admin card-ban management. Not-found / conflict states are thrown as
 * `AppError` (via {@link assertFound} or directly) and mapped by the handler's
 * appErrorInterceptor. `createdAt` is mapped from `Date` to an ISO string for
 * the output schema. The DELETE handler 404s on a no-match, consistent with
 * PATCH — see the inline note in `remove`.
 */
export const adminCardBansRouter = {
  list: os.list.handler(async ({ input, context }) => {
    const { cardBans } = context.repos;
    const rows = await cardBans.listByCard(input.id);
    return {
      bans: rows.map((row) => toCardBanResponse(row)),
    };
  }),

  create: os.create.handler(async ({ input, context, errors }) => {
    const { cardBans, catalogMutations } = context.repos;
    const { id, formatId, bannedAt, reason } = input;

    const card = await catalogMutations.getCardById(id);
    assertFound(card, "Card not found");

    const existing = await cardBans.getActiveBan(id, formatId);
    if (existing) {
      throw errors.CONFLICT({ message: `Card is already banned in ${formatId}` });
    }

    const row = await cardBans.create({ cardId: id, formatId, bannedAt, reason: reason ?? null });

    await recordAdminEvent(context.repos, context.userId, {
      action: "ban.add",
      entityType: "ban",
      entityId: row.id,
      entityLabel: card.name,
      cardSlug: card.slug,
      newValues: { cardId: id, formatId, bannedAt, reason: reason ?? null },
    });

    return {
      ban: toCardBanResponse(row),
    };
  }),

  update: os.update.handler(async ({ input, context }) => {
    const { cardBans } = context.repos;
    const { id, formatId, bannedAt, reason } = input;

    const fields: { bannedAt?: string; reason?: string | null } = {};
    if (bannedAt !== undefined) {
      fields.bannedAt = bannedAt;
    }
    if (reason !== undefined) {
      fields.reason = reason;
    }

    const before = await cardBans.getActiveBan(id, formatId);

    const row = await cardBans.update(id, formatId, fields);
    assertFound(row, `No active ban found for format ${formatId}`);

    await recordAdminEvent(context.repos, context.userId, {
      action: "ban.update",
      entityType: "ban",
      entityId: row.id,
      oldValues: before ? { bannedAt: before.bannedAt, reason: before.reason } : null,
      newValues: fields,
    });

    return {
      ban: toCardBanResponse(row),
    };
  }),

  remove: os.remove.handler(async ({ input, context, errors }): Promise<void> => {
    const { cardBans } = context.repos;
    const { id, formatId } = input;

    const before = await cardBans.getActiveBan(id, formatId);

    const removed = await cardBans.unban(id, formatId);
    if (!removed) {
      throw errors.NOT_FOUND({ message: `No active ban found for format ${formatId}` });
    }

    await recordAdminEvent(context.repos, context.userId, {
      action: "ban.delete",
      entityType: "ban",
      entityId: before?.id ?? null,
      oldValues: { cardId: id, formatId, bannedAt: before?.bannedAt, reason: before?.reason },
    });
  }),
};
