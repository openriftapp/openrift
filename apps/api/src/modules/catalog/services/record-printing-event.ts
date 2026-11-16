import { createLogger } from "@openrift/shared/logger";

import type { printingEventsRepo } from "../repositories/printing-events.js";

type PrintingEventsRepo = ReturnType<typeof printingEventsRepo>;

const log = createLogger("printing-events");

/** Best-effort: the printing already exists, so a failed event insert is only logged. */
export async function recordNewPrintingEvent(
  repo: PrintingEventsRepo,
  printingId: string,
): Promise<void> {
  try {
    await repo.recordNew(printingId);
  } catch (error) {
    log.warn({ err: error, printingId }, "new-printing event insert failed");
  }
}
