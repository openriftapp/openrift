import { adminPrintingEventsContract } from "@openrift/shared/contracts/admin/printing-events";
import { implement } from "@orpc/server";

import { requireAuthedUser } from "../../../orpc/base.js";
import type { ApiContext } from "../../../orpc/context.js";
import { requireScheduler } from "../../system/services/job-scheduler.js";

const os = implement(adminPrintingEventsContract).$context<ApiContext>().use(requireAuthedUser);

/**
 * Admin printing-events Discord queue. Any thrown `AppError` is mapped by the
 * handler's {@link appErrorInterceptor}.
 */
export const adminPrintingEventsRouter = {
  flush: os.flush.handler(({ context }) =>
    requireScheduler(context.scheduler).runNow("discord.flush_printing_events"),
  ),

  list: os.list.handler(async ({ context }) => {
    const { printingEvents } = context.repos;
    const events = await printingEvents.listByStatus(["pending", "failed"]);
    return {
      events: events.map((e) => ({
        id: e.id,
        status: e.status,
        retryCount: e.retryCount,
        printingId: e.printingId,
        cardName: e.cardName,
        cardSlug: e.cardSlug,
        setName: e.setName,
        shortCode: e.shortCode,
        rarity: e.rarity,
        finish: e.finish,
        finishLabel: e.finishLabel,
        artist: e.artist,
        language: e.language,
        languageName: e.languageName,
        frontImageId: e.frontImageId,
        createdAt: e.createdAt.toISOString(),
      })),
    };
  }),

  retry: os.retry.handler(async ({ input, context }) => {
    const { printingEvents } = context.repos;
    const { ids } = input;
    await printingEvents.retryFailed(ids);
    return { retried: ids.length };
  }),
};
