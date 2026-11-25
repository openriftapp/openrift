import { adminFormatSetsContract } from "@openrift/shared/contracts/admin/format-sets";
import { implement } from "@orpc/server";

import { badRequest } from "../../../errors.js";
import { isForeignKeyViolation } from "../../../lib/pg-errors.js";
import { requireAuthedUser } from "../../../orpc/base.js";
import type { ApiContext } from "../../../orpc/context.js";
import { recordAdminEvent } from "../../system/services/record-admin-event.js";
import { assertKnownCircuit } from "../lib/circuit-validation.js";

const os = implement(adminFormatSetsContract).$context<ApiContext>().use(requireAuthedUser);

export const adminFormatSetsRouter = {
  list: os.list.handler(async ({ context }) => {
    const formatSets = await context.repos.formatSets.listAll();
    return { formatSets };
  }),

  upsert: os.upsert.handler(async ({ input, context }) => {
    await assertKnownCircuit(context.repos.cardBans, input.circuit);
    let formatSet;
    try {
      formatSet = await context.repos.formatSets.upsert(input);
    } catch (error) {
      if (isForeignKeyViolation(error)) {
        throw badRequest("Unknown format or set");
      }
      throw error;
    }
    await recordAdminEvent(context.repos, context.userId, {
      action: "format-set.upsert",
      entityType: "format-set",
      entityId: formatSet.id,
      entityLabel: formatSet.setSlug,
      newValues: input,
    });
    return { formatSet };
  }),

  remove: os.remove.handler(async ({ input, context, errors }): Promise<void> => {
    const removed = await context.repos.formatSets.remove(input);
    if (!removed) {
      throw errors.NOT_FOUND();
    }
    await recordAdminEvent(context.repos, context.userId, {
      action: "format-set.delete",
      entityType: "format-set",
      entityId: null,
      oldValues: input,
    });
  }),
};
