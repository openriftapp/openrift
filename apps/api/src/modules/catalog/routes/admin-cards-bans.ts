import { adminCardBansContract } from "@openrift/shared/contracts/admin/card-bans";
import { WellKnown } from "@openrift/shared/well-known";
import { implement } from "@orpc/server";

import { assertFound, conflictOnUniqueViolation } from "../../../lib/assertions.js";
import { requireAuthedUser } from "../../../orpc/base.js";
import type { ApiContext } from "../../../orpc/context.js";
import { recordAdminEvent } from "../../system/services/record-admin-event.js";
import { toCardBanResponse } from "../lib/card-ban-presenters.js";
import { assertKnownCircuit } from "../lib/circuit-validation.js";

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
    const circuit = input.circuit ?? null;
    const scope = circuit ? `${formatId} (${circuit})` : formatId;

    const card = await catalogMutations.getCardById(id);
    assertFound(card, "Card not found");
    await assertKnownCircuit(cardBans, circuit);

    const existing = await cardBans.getActiveBan(id, formatId, circuit);
    if (existing) {
      throw errors.CONFLICT({ message: `Card is already banned in ${scope}` });
    }

    // Riot bans a Constructed card in 2v2 too; its 2v2 list is kept as rows of its own.
    const formats =
      circuit === null && formatId === WellKnown.banFormat.CONSTRUCTED
        ? [formatId, WellKnown.banFormat.TWO_V_TWO]
        : [formatId];
    const setCircuits = circuit === null ? await cardBans.setBanListCircuits() : [];
    const added: { formatId: string; circuit: string | null }[] = [];
    const addIfMissing = async (target: { formatId: string; circuit: string | null }) => {
      if (await cardBans.getActiveBan(id, target.formatId, target.circuit)) {
        return;
      }
      await conflictOnUniqueViolation(
        "uq_card_bans_active",
        `Card is already banned in ${scope}`,
        () =>
          cardBans.create({
            cardId: id,
            ...target,
            bannedAt: target.circuit === null ? bannedAt : null,
            reason: reason ?? null,
          }),
      );
      added.push(target);
    };

    // Per-set circuits pick a global ban up only at a local set release. Their pending
    // rows go first, so the global history they copy cannot include this ban.
    for (const target of formats) {
      for (const setCircuit of setCircuits) {
        await addIfMissing({ formatId: target, circuit: setCircuit });
      }
    }
    for (const target of formats.slice(1)) {
      await addIfMissing({ formatId: target, circuit: null });
    }
    const row = await conflictOnUniqueViolation(
      "uq_card_bans_active",
      `Card is already banned in ${scope}`,
      () => cardBans.create({ cardId: id, formatId, circuit, bannedAt, reason: reason ?? null }),
    );

    await recordAdminEvent(context.repos, context.userId, {
      action: "ban.add",
      entityType: "ban",
      entityId: row.id,
      entityLabel: card.name,
      cardSlug: card.slug,
      newValues: { cardId: id, formatId, circuit, bannedAt, reason: reason ?? null, added },
    });

    return {
      ban: toCardBanResponse(row),
    };
  }),

  update: os.update.handler(async ({ input, context }) => {
    const { cardBans } = context.repos;
    const { id, formatId, bannedAt, reason } = input;
    const circuit = input.circuit ?? null;

    const fields: { bannedAt?: string | null; reason?: string | null } = {};
    if (bannedAt !== undefined) {
      fields.bannedAt = bannedAt;
    }
    if (reason !== undefined) {
      fields.reason = reason;
    }

    const before = await cardBans.getActiveBan(id, formatId, circuit);

    const row = await cardBans.update(id, formatId, circuit, fields);
    assertFound(row, `No active ban found for format ${formatId}`);

    await recordAdminEvent(context.repos, context.userId, {
      action: "ban.update",
      entityType: "ban",
      entityId: row.id,
      oldValues: before ? { circuit, bannedAt: before.bannedAt, reason: before.reason } : null,
      newValues: { circuit, ...fields },
    });

    return {
      ban: toCardBanResponse(row),
    };
  }),

  remove: os.remove.handler(async ({ input, context, errors }): Promise<void> => {
    const { cardBans } = context.repos;
    const { id, formatId } = input;
    const circuit = input.circuit ?? null;

    const before = await cardBans.getActiveBan(id, formatId, circuit);

    const removed = await cardBans.unban(id, formatId, circuit);
    if (removed === null) {
      throw errors.NOT_FOUND({ message: `No active ban found for format ${formatId}` });
    }
    // A global ban that never took effect takes the pending circuit rows it created with it.
    if (removed === "deleted" && circuit === null) {
      await cardBans.deleteUndatedCircuitRows(id, formatId);
    }

    await recordAdminEvent(context.repos, context.userId, {
      action: "ban.delete",
      entityType: "ban",
      entityId: before?.id ?? null,
      oldValues: {
        cardId: id,
        formatId,
        circuit,
        bannedAt: before?.bannedAt,
        reason: before?.reason,
      },
    });
  }),
};
