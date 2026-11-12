import { createLogger } from "@openrift/shared/logger";
import { errorMessage } from "@openrift/shared/strings";
import type { Selectable } from "kysely";

import type { CandidatePrintingsTable } from "../../../db/tables/candidates.js";
import type { Repos, Transact } from "../../../deps.js";
import { AppError } from "../../../errors.js";
import type { Io } from "../../../io.js";
import { rehostImagesInBackground } from "../../catalog/services/images/jobs.js";
import type { NewPrinting } from "../../catalog/services/printing-admin.js";
import { createNewPrinting } from "../../catalog/services/printing-admin.js";
import { recordNewPrintingEvent } from "../../catalog/services/record-printing-event.js";
import type { CandidateAcceptFields } from "../lib/candidate-printing-accept.js";
import {
  acceptFieldsFromCandidate,
  groupCandidatePrintings,
} from "../lib/candidate-printing-accept.js";
import { relinkCandidatePrintings } from "./relink-candidates.js";

type CandidatePrintingRow = Selectable<CandidatePrintingsTable>;

const log = createLogger("candidate-accept");

export const UNEXPECTED_FAILURE = "could not be created; the error is in the server log";

interface SkippedCandidateGroup {
  shortCode: string;
  reason: string;
}

type CandidateGroupOutcome =
  | { printing: NewPrinting; fields: CandidateAcceptFields }
  | { reason: string };

export async function acceptCandidateGroup(
  transact: Transact,
  cardId: string,
  group: readonly CandidatePrintingRow[],
): Promise<CandidateGroupOutcome> {
  const [first] = group;
  if (!first) {
    return { reason: "no candidates" };
  }
  const accepted = acceptFieldsFromCandidate(first);
  if (accepted.missing) {
    return { reason: `missing: ${accepted.missing.join(", ")}` };
  }
  const { fields } = accepted;
  try {
    const printing = await createNewPrinting(
      transact,
      cardId,
      fields,
      group.map((cp) => cp.id),
    );
    return { printing, fields };
  } catch (error) {
    if (error instanceof AppError) {
      return { reason: error.message };
    }
    log.error({ cardId, error: errorMessage(error) }, "candidate printing accept failed");
    return { reason: UNEXPECTED_FAILURE };
  }
}

export async function acceptCandidateGroups(
  transact: Transact,
  cardId: string,
  candidates: readonly CandidatePrintingRow[],
): Promise<{ created: NewPrinting[]; skipped: SkippedCandidateGroup[] }> {
  const created: NewPrinting[] = [];
  const skipped: SkippedCandidateGroup[] = [];
  for (const group of groupCandidatePrintings(candidates)) {
    const outcome = await acceptCandidateGroup(transact, cardId, group);
    if ("printing" in outcome) {
      created.push(outcome.printing);
    } else {
      skipped.push({ shortCode: group[0]?.shortCode ?? "", reason: outcome.reason });
    }
  }
  return { created, skipped };
}

type FinishAcceptRepos = Pick<
  Repos,
  "candidateCards" | "catalog" | "ingest" | "printingEvents" | "printingImages"
>;

export async function finishPrintingAccepts(
  repos: FinishAcceptRepos,
  io: Io,
  created: readonly NewPrinting[],
  options: { catalogChanged?: boolean } = {},
): Promise<void> {
  if (created.length === 0) {
    if (options.catalogChanged) {
      await repos.catalog.refreshCatalogViews();
    }
    return;
  }
  for (const { printingId } of created) {
    await recordNewPrintingEvent(repos.printingEvents, printingId);
  }
  await repos.catalog.refreshCatalogViews();
  await relinkCandidatePrintings(repos);
  rehostImagesInBackground(
    io,
    repos.printingImages,
    created.flatMap((printing) => printing.imageIds),
  );
}
