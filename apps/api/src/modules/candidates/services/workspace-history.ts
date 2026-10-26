import type {
  WorkspaceEventsResponse,
  WorkspaceHistoryInput,
} from "@openrift/shared/contracts/admin/catalog-workspace";
import { ERROR_CODES } from "@openrift/shared/error-codes";

import { AppError } from "../../../errors.js";
import type { AdminAccess } from "../../../middleware/require-admin.js";
import { toWorkspaceEvent } from "../lib/workspace-presenters.js";
import type { WorkspaceRepos } from "./workspace-queue.js";
import { isDeskOnly } from "./workspace-queue.js";

const HISTORY_LIMIT = 200;

function notFound(): AppError {
  return new AppError(404, ERROR_CODES.NOT_FOUND, "Not found");
}

async function resolveTarget(
  repos: Pick<WorkspaceRepos, "workspaceRecords">,
  input: WorkspaceHistoryInput,
): Promise<{ printingIds: string[]; faceIds: string[] }> {
  if (input.printingId !== undefined) {
    const faceIds = await repos.workspaceRecords.printingFaceIds(input.printingId);
    if (faceIds === null) {
      throw notFound();
    }
    return { printingIds: [input.printingId], faceIds };
  }
  const { faceId } = input;
  if (faceId === undefined) {
    throw notFound();
  }
  const [exists, printingIds] = await Promise.all([
    repos.workspaceRecords.faceExists(faceId),
    repos.workspaceRecords.facePrintingIds(faceId),
  ]);
  if (!exists) {
    throw notFound();
  }
  return { printingIds, faceIds: [faceId] };
}

export async function listWorkspaceHistory(
  repos: Pick<WorkspaceRepos, "workspaceRecords">,
  options: { access: AdminAccess | null; userId: string; input: WorkspaceHistoryInput },
): Promise<WorkspaceEventsResponse> {
  const target = await resolveTarget(repos, options.input);
  const deskOnly = isDeskOnly(options.access);
  if (
    deskOnly &&
    !(await repos.workspaceRecords.anyInDeskScope(target.printingIds, options.userId))
  ) {
    if (options.input.faceId !== undefined) {
      return { events: [] };
    }
    throw new AppError(403, ERROR_CODES.FORBIDDEN, "Forbidden");
  }
  const rows = await repos.workspaceRecords.eventsOnPrintings(
    target.printingIds,
    target.faceIds,
    HISTORY_LIMIT,
    deskOnly ? options.userId : undefined,
  );
  return { events: rows.map((row) => toWorkspaceEvent(row)) };
}
