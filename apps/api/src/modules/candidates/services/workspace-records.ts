import type {
  WorkspaceRecordsInput,
  WorkspaceRecordsResponse,
} from "@openrift/shared/contracts/admin/catalog-workspace";

import { buildKeysetCursor } from "../../../lib/keyset-cursor.js";
import type { AdminAccess } from "../../../middleware/require-admin.js";
import type { DeskRecordScope } from "../lib/workspace-presenters.js";
import { toWorkspaceRecordRow } from "../lib/workspace-presenters.js";
import type { WorkspaceRepos } from "./workspace-queue.js";
import { deskPrintingScope, isDeskOnly } from "./workspace-queue.js";

const DEFAULT_LIMIT = 100;

export async function listWorkspaceRecords(
  repos: Pick<WorkspaceRepos, "workspaceRecords" | "printingDesk" | "adminEvents">,
  options: { access: AdminAccess | null; userId: string; input: WorkspaceRecordsInput },
): Promise<WorkspaceRecordsResponse> {
  const { input } = options;
  const limit = input.limit ?? DEFAULT_LIMIT;
  let desk: DeskRecordScope | undefined;
  if (isDeskOnly(options.access)) {
    desk = await deskPrintingScope(repos, options.userId);
  }
  const query = {
    q: input.q,
    limit,
    cursor: input.cursor,
    printingIds:
      desk === undefined ? undefined : [...new Set([...desk.promoIds, ...desk.createdIds])],
  };
  const rows =
    input.kind === "printing"
      ? await repos.workspaceRecords.listPrintingRecords(query)
      : await repos.workspaceRecords.listFaceRecords(query);
  const page = rows.slice(0, limit);
  const last = page.at(-1);
  return {
    rows: page.map((row) => toWorkspaceRecordRow(row, input.kind, desk)),
    nextCursor: rows.length > limit && last ? buildKeysetCursor(last.updatedAt, last.id) : null,
  };
}
